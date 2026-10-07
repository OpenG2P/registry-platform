"""An activity register's configuration file: declarations, output record templates, plausibility rules.

Where it comes from
-------------------
``<extension package>/meta_data/activity-config/<register_mnemonic>.json`` (the
setting ``activity_config_path`` overrides the directory). A register without a
file runs on its domain service's code and the platform defaults. The file::

    {
      "register_mnemonic": "CropSown",                       // optional; must match the file name
      "context_fields": ["farmer_id", "plot_id", "crop_year", "season", "crop"],
      "subject": {"subject_type": "FARMER_ID", "subject_id_fields": ["fayda_fan"]},
      "ui_hints": {"summary_fields": [...], "context_columns": [...], ...},
      "final_on_period_lock": ["FARMER_SEASON_SUMMARY"],
      "search_fields": ["farmer_id", "plot_id", "crop"],
      "formats": {                                           // one entry per output format
        "dci": {
          "state":     {"record_type": "spdci-extensions-agri:CropSeason", "template": "templates/state.json.j2"},
          "aggregate": {"record_type": "...", "template": "templates/aggregate.json.j2"}
        }
      },
      "rules": [
        {"id": "sown_area_vs_plan", "applies_to": ["SOWN"],
         "when":  {"and": [{"var": "payload.area_ha"}, {"var": "latest.PLANNED.area_ha"}]},
         "check": {"<=": [{"var": "payload.area_ha"}, {"*": [{"var": "latest.PLANNED.area_ha"}, 1.5]}]},
         "message": "Area sown {{ payload.area_ha | float }} ha is more than 1.5 × the planned ...",
         "severity": "warn"}
      ]
    }

Precedence: a domain service subclass that sets an attribute (``context_fields``,
``ui_hints``…) or overrides a hook (``search_text_values``, ``validate``,
``dci_state_record``…) wins; otherwise the file; otherwise the platform default.

Output formats
--------------
Records are internal, format-independent dicts (a projection row, an
aggregate), filtered to the partner's consented data scopes before they are
rendered. Each format (``dci`` today; others may follow) names a Jinja template
per record kind (``state``, ``aggregate``), relative to the configuration
directory. A template renders JSON; it sees ``record`` (the filtered record),
``record_type``, ``output_format``, ``kind`` and ``register_mnemonic``, renders
in the platform's lenient environment (a missing key is null under ``tojson``)
and has two filters: ``pick("a", "b")`` (a dict of those keys) and
``or_null`` (a group whose values are all null, e.g. not consented, becomes null).

Rules
-----
Plausibility rules in JSON Logic (see ``helpers.json_logic``), evaluated on
each new or corrected activity of the types in ``applies_to`` (all types when
empty) against::

    {"activity_type": "SOWN", "payload": {...},
     "latest": {"PLANNED": {...}, "SOWN": {...}}}   // the context's latest ACTIVE activity per type

``when`` (optional) says whether the rule applies; ``check`` must hold. A rule
whose ``when`` or ``check`` reads a value that is missing (a ``var`` without a
default) is not applicable. A failed check gives its ``message`` (a Jinja
string over the same data) as a warning (``warn``) or rejects the activity
(``block``).
"""

import importlib
import json
import logging
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Any, Literal, Optional

from jinja2 import ChainableUndefined, Template, TemplateError, Undefined
from jinja2.sandbox import SandboxedEnvironment
from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, ValidationError, field_validator

from ..config import Settings
from ..helpers import json_logic
from ..helpers.template_helper import _json_default, template_environment

_logger = logging.getLogger("g2p-activity-register-config")

_EXTENSIONS_PACKAGE = "openg2p_registry_extensions"
CONFIG_DIRECTORY = "activity-config"
RECORD_KINDS = ("state", "aggregate")


class ActivityRegisterConfigError(ValueError):
    """A configuration file that cannot be used; the message lists every problem."""


# ------------------------------------------------------------------- the model


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActivitySubjectConfig(_Strict):
    # The subject type the register's activities are about by default (e.g. FARMER_ID).
    subject_type: Optional[str] = None
    # Activity fields that hold another identifier of the subject (see
    # G2PActivityDomainService.subject_id_fields).
    subject_id_fields: list[str] = []


class ActivityRecordTemplateConfig(_Strict):
    record_type: Optional[str] = None
    template: str
    _compiled: Optional[Template] = PrivateAttr(default=None)

    @field_validator("template")
    @classmethod
    def _relative(cls, value: str) -> str:
        path = PurePosixPath(value)
        if path.is_absolute() or ".." in path.parts or not value.strip():
            raise ValueError("a path relative to the configuration directory, without '..'")
        return value


class ActivityOutputFormatConfig(_Strict):
    state: Optional[ActivityRecordTemplateConfig] = None
    aggregate: Optional[ActivityRecordTemplateConfig] = None


class ActivityRuleConfig(_Strict):
    id: str = Field(min_length=1)
    description: Optional[str] = None
    applies_to: list[str] = []  # activity types; empty: every type
    when: Optional[Any] = None
    check: Any
    message: str = Field(min_length=1)
    severity: Literal["warn", "block"] = "warn"
    _message: Optional[Template] = PrivateAttr(default=None)


class ActivityRegisterConfig(_Strict):
    description: Optional[str] = None
    register_mnemonic: Optional[str] = None
    context_fields: list[str] = []
    subject: ActivitySubjectConfig = ActivitySubjectConfig()
    ui_hints: dict[str, Any] = {}
    final_on_period_lock: list[str] = []
    search_fields: list[str] = []
    formats: dict[str, ActivityOutputFormatConfig] = {}
    rules: list[ActivityRuleConfig] = []
    _source: Optional[str] = PrivateAttr(default=None)

    def record_template(self, output_format: str, kind: str) -> Optional[ActivityRecordTemplateConfig]:
        entry = self.formats.get(output_format)
        return getattr(entry, kind, None) if entry is not None else None


EMPTY_CONFIG = ActivityRegisterConfig()


# --------------------------------------------------------------- environments


def _is_null(value: Any) -> bool:
    return value is None or isinstance(value, Undefined)


def or_null(group: Any) -> Any:
    """A record group, or null when none of its values is set (e.g. not consented)."""
    if isinstance(group, dict):
        return group if any(not _is_null(value) for value in group.values()) else None
    return None if _is_null(group) else group


def pick(record: Any, *keys: str) -> dict[str, Any]:
    """The named keys of a record, a missing one as null."""
    source = record if isinstance(record, dict) else {}
    return {key: source.get(key) for key in keys}


@lru_cache(maxsize=1)
def record_environment():
    """Where output record templates render: the platform's lenient environment, keys in template order."""
    env = template_environment()
    env.policies["json.dumps_kwargs"] = {"sort_keys": False, "default": _json_default}
    env.filters["or_null"] = or_null
    env.filters["pick"] = pick
    return env


@lru_cache(maxsize=1)
def message_environment() -> SandboxedEnvironment:
    """Where rule messages render: sandboxed, a missing value prints as ""."""
    return SandboxedEnvironment(undefined=ChainableUndefined)


# -------------------------------------------------------------------- loading


def _settings():
    return Settings.get_config(strict=False)


def config_dir() -> Optional[Path]:
    configured = (getattr(_settings(), "activity_config_path", "") or "").strip()
    if configured:
        return Path(configured)
    try:
        package = importlib.import_module(_EXTENSIONS_PACKAGE)
    except ModuleNotFoundError:
        return None
    package_file = getattr(package, "__file__", None)
    if not package_file:
        return None
    return Path(package_file).parent / "meta_data" / CONFIG_DIRECTORY


def _format_validation_error(error: ValidationError) -> list[str]:
    return [f"{'.'.join(str(part) for part in item['loc']) or '(file)'}: {item['msg']}" for item in error.errors()]


def parse_config(data: Any, directory: Optional[Path], source: str, mnemonic: Optional[str] = None
                 ) -> ActivityRegisterConfig:
    """Validate a configuration (already parsed JSON) and compile its templates, rules and messages.

    Raises ActivityRegisterConfigError listing every problem.
    """
    try:
        config = ActivityRegisterConfig.model_validate(data)
    except ValidationError as error:
        raise ActivityRegisterConfigError(
            f"Activity register configuration {source} is invalid:\n  " + "\n  ".join(_format_validation_error(error))
        ) from None
    problems: list[str] = []
    if mnemonic and config.register_mnemonic and config.register_mnemonic != mnemonic:
        problems.append(f"register_mnemonic: {config.register_mnemonic!r} does not match the file name ({mnemonic!r})")

    for output_format, entry in config.formats.items():
        for kind in RECORD_KINDS:
            spec = getattr(entry, kind)
            if spec is None:
                continue
            where = f"formats.{output_format}.{kind}.template"
            path = (directory / spec.template) if directory is not None else None
            if path is None or not path.is_file():
                problems.append(f"{where}: {spec.template!r} not found next to the configuration")
                continue
            try:
                spec._compiled = record_environment().from_string(path.read_text(encoding="utf-8"))
            except TemplateError as error:
                problems.append(f"{where}: {spec.template!r} is not a valid template: {error}")

    seen: set[str] = set()
    for index, rule in enumerate(config.rules):
        where = f"rules[{index}] ({rule.id})"
        if rule.id in seen:
            problems.append(f"{where}: duplicate rule id")
        seen.add(rule.id)
        for name in ("when", "check"):
            expression = getattr(rule, name)
            if expression is None:
                if name == "check":
                    problems.append(f"{where}.check: required")
                continue
            if not isinstance(expression, dict):
                problems.append(f"{where}.{name}: a JSON Logic operation ({{\"<operator>\": [...]}}), "
                                f"got {type(expression).__name__}")
                continue
            problems += [f"{where}.{name}: {problem}" for problem in json_logic.validate(expression)]
        try:
            rule._message = message_environment().from_string(rule.message)
        except TemplateError as error:
            problems.append(f"{where}.message: not a valid template: {error}")

    if problems:
        raise ActivityRegisterConfigError(
            f"Activity register configuration {source} is invalid:\n  " + "\n  ".join(problems)
        )
    config._source = source
    return config


def load_config(mnemonic: str, directory: Optional[Path] = None) -> ActivityRegisterConfig:
    """The register's configuration file, validated; the empty configuration when it has none."""
    directory = directory if directory is not None else config_dir()
    if directory is None:
        return EMPTY_CONFIG
    path = directory / f"{mnemonic}.json"
    if not path.is_file():
        return EMPTY_CONFIG
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ActivityRegisterConfigError(f"Activity register configuration {path} is not valid JSON: {error}") from None
    config = parse_config(data, directory, str(path), mnemonic)
    _logger.info("Activity register %s: configuration loaded from %s", mnemonic, path)
    return config


# ------------------------------------------------------------------ rendering


def render_record(config: ActivityRegisterConfig, output_format: str, kind: str, record: dict[str, Any],
                  register_mnemonic: Optional[str] = None) -> Optional[dict[str, Any]]:
    """One record in an output format, or None when the configuration has no template for it."""
    spec = config.record_template(output_format, kind)
    if spec is None or spec._compiled is None:
        return None
    rendered = spec._compiled.render(
        record=record, record_type=spec.record_type, output_format=output_format, kind=kind,
        register_mnemonic=register_mnemonic or config.register_mnemonic,
    )
    try:
        return json.loads(rendered)
    except ValueError as error:
        raise ActivityRegisterConfigError(
            f"Template {spec.template!r} ({output_format}.{kind}) did not render valid JSON: {error}"
        ) from None


# ---------------------------------------------------------------------- rules


def activity_values(activity: Any) -> dict[str, Any]:
    """What a rule sees of a recorded activity: its payload, overlaid with its set columns."""
    values = dict(getattr(activity, "payload", None) or {})
    table = getattr(activity, "__table__", None)
    names = [column.name for column in table.columns] if table is not None else [
        name for name in getattr(activity, "__dict__", {}) if not name.startswith("_")
    ]
    for name in names:
        if name in ("payload", "search_text"):
            continue
        value = getattr(activity, name, None)
        if value is not None:
            values[name] = value
    return json_logic.json_value(values)


def rule_data(activity_type: str, payload: dict[str, Any], context_activities: list) -> dict[str, Any]:
    latest: dict[str, Any] = {}
    for activity in context_activities:  # oldest first: the last of a type wins
        latest[activity.activity_type] = activity
    return {
        "activity_type": activity_type,
        "payload": json_logic.json_value(dict(payload or {})),
        "latest": {kind: activity_values(activity) for kind, activity in latest.items()},
    }


class RuleOutcome(BaseModel):
    rule_id: str
    severity: str
    message: str


def evaluate_rules(config: ActivityRegisterConfig, activity_type: str, payload: dict[str, Any],
                   context_activities: list) -> list[RuleOutcome]:
    """The configured rules this activity fails, in configuration order."""
    rules = [rule for rule in config.rules if not rule.applies_to or activity_type in rule.applies_to]
    if not rules:
        return []
    data = rule_data(activity_type, payload, context_activities)
    failed: list[RuleOutcome] = []
    for rule in rules:
        if rule.when is not None:
            evaluation = json_logic.Evaluation(data)
            applies = evaluation.apply(rule.when)
            if evaluation.missing or not json_logic.truthy(applies):
                continue
        evaluation = json_logic.Evaluation(data)
        holds = evaluation.apply(rule.check)
        if evaluation.missing or json_logic.truthy(holds):
            continue
        template = rule._message or message_environment().from_string(rule.message)
        failed.append(RuleOutcome(rule_id=rule.id, severity=rule.severity, message=template.render(**data)))
    return failed
