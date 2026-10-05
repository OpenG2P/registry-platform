"""Field references, scope resolution and record filtering for data scopes (no database).

Field references (what a scope version lists):

* ``section:<section_mnemonic>`` — every field a register section shows;
* ``<Register>.<field>`` — one column of a register (``Farmer.phone_number``);
  ``<Register>.*`` — all of a register's own fields (``Land.*``: a child
  register's whole records); ``<Register>.documents`` / ``<Register>.documents.<label>``
  — the record's documents, all or one label;
* activity registers: ``<Register>.<record_type>.<field>`` or ``<Register>.<record_type>.*``
  with record_type ``activity`` (an activity), ``context`` (a context's current
  state, the projection row) or ``aggregate`` (a roll-up row).

A *grant* is what references resolve to: ``{target: fields}`` where target is a
register mnemonic or ``<Register>.<record_type>`` and fields is a frozenset of
field names or ``ALL``.

Resolution for one consented scope (see ``resolve_scope_grant``):
fields of the version in effect at the consent's issue time, carried through
later renames, intersected with the fields of the current version (for a
RETIRED scope, its last version stands in for "current"). So a field added
after the consent never reaches it, a field removed since is gone, and a
renamed field keeps its meaning.

Filtering (``AllowedFields``) runs on the internal record before any output
adapter renders it. A field outside the grant keeps its key with a null value
(the record keeps the shape the templates and shapers already handle for empty
data); a nested register's records the grant does not reach become an empty
list (children) or are dropped (parent).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional, Sequence

ALL = "*"
RECORD_TYPES = ("activity", "context", "aggregate")
SECTION_PREFIX = "section:"
DOCUMENTS = "documents"
# Fields a register record carries besides its table's columns.
RECORD_EXTRA_FIELDS = frozenset({"record_image_url", DOCUMENTS, "actual_score", "ideal_score",
                                 "completion_score_required"})

_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")


class DataScopeCatalogueError(ValueError):
    """The extension's catalogue (or a field reference in it) is not valid."""

    def __init__(self, problems: Sequence[str]):
        self.problems = list(problems)
        super().__init__("Data scope catalogue refused: " + "; ".join(self.problems))


def valid_scope_name(name: str) -> bool:
    return bool(name) and bool(_NAME_PATTERN.match(name))


# ---------------------------------------------------------------- references


def parse_ref(ref: str) -> tuple[str, str]:
    """A concrete reference → (target, field). field is ALL for ``.*``.

    ``Farmer.phone`` → ("Farmer", "phone"); ``Land.*`` → ("Land", ALL);
    ``Farmer.documents.id_proof`` → ("Farmer", "documents.id_proof");
    ``CropSown.activity.crop`` → ("CropSown.activity", "crop").
    """
    parts = [part.strip() for part in str(ref).split(".")]
    if len(parts) < 2 or not all(parts):
        raise ValueError(f"'{ref}' is not a field reference (expected <Register>.<field>)")
    register = parts[0]
    if parts[1] in RECORD_TYPES:
        if len(parts) != 3:
            raise ValueError(f"'{ref}': expected <Register>.{parts[1]}.<field> or <Register>.{parts[1]}.*")
        return f"{register}.{parts[1]}", parts[2]
    if parts[1] == DOCUMENTS:
        if len(parts) > 3:
            raise ValueError(f"'{ref}': expected <Register>.documents or <Register>.documents.<label>")
        return register, ".".join(parts[1:])
    if len(parts) != 2:
        raise ValueError(f"'{ref}' is not a field reference (expected <Register>.<field>)")
    return register, parts[1]


Grant = dict  # target -> frozenset[str] | ALL


def grant_from_refs(refs: Iterable[str]) -> Grant:
    grant: dict[str, Any] = {}
    for ref in refs or []:
        try:
            target, field = parse_ref(ref)
        except ValueError:
            continue  # stored references were validated when published; skip anything odd
        if grant.get(target) == ALL:
            continue
        if field == ALL:
            grant[target] = ALL
        else:
            grant.setdefault(target, set()).add(field)
    return {target: (fields if fields == ALL else frozenset(fields)) for target, fields in grant.items()}


def _covers(fields, field: str) -> bool:
    if fields == ALL:
        return True
    if field in fields:
        return True
    return field.startswith(DOCUMENTS + ".") and DOCUMENTS in fields


def intersect(a: Grant, b: Grant) -> Grant:
    result: dict[str, Any] = {}
    for target in set(a) & set(b):
        fa, fb = a[target], b[target]
        if fa == ALL:
            fields = fb
        elif fb == ALL:
            fields = fa
        else:
            fields = frozenset({f for f in fa if _covers(fb, f)} | {f for f in fb if _covers(fa, f)})
        if fields:
            result[target] = fields
    return result


def union(a: Grant, b: Grant) -> Grant:
    result = dict(a)
    for target, fields in b.items():
        current = result.get(target)
        if current is None:
            result[target] = fields
        elif current == ALL or fields == ALL:
            result[target] = ALL
        else:
            result[target] = frozenset(current | fields)
    return result


# ---------------------------------------------------------------- resolution


@dataclass(frozen=True)
class ScopeVersionView:
    version: int
    effective_from: datetime
    resolved_fields: Sequence[str]
    renamed_fields: Optional[Mapping[str, str]] = None


def _apply_renames(refs: Iterable[str], renames: Optional[Mapping[str, str]]) -> list[str]:
    if not renames:
        return list(refs)
    return [renames.get(ref, ref) for ref in refs]


def resolve_scope_grant(versions: Sequence[ScopeVersionView], issued_at: Optional[datetime]) -> Grant:
    """The fields one scope allows a consent issued at ``issued_at``.

    ``versions`` are the scope's versions; the last one (highest number) is
    "current" — for a RETIRED scope that is its last version, so a retired scope
    keeps honouring consents with what it last meant.

    The version in effect at ``issued_at`` is the last one effective on or before
    it. A consent older than the scope's first version (or with no issue time)
    gets the first version: nothing could have been widened before it existed,
    and it is the narrowest reading of a consent without a time.
    """
    ordered = sorted(versions, key=lambda v: v.version)
    if not ordered:
        return {}
    at_issue = ordered[0]
    if issued_at is not None:
        for version in ordered:
            if version.effective_from <= issued_at:
                at_issue = version
    refs = list(at_issue.resolved_fields or [])
    for later in ordered:
        if later.version > at_issue.version:
            refs = _apply_renames(refs, later.renamed_fields)
    return intersect(grant_from_refs(refs), grant_from_refs(ordered[-1].resolved_fields or []))


def split_scope_id(scope_id: str, controller: str) -> Optional[str]:
    """``<controller>.<name>`` → name; None for another controller's scope.

    With no controller configured, scope IDs are the bare names.
    """
    scope_id = str(scope_id or "").strip()
    if not scope_id:
        return None
    if not controller:
        return scope_id
    prefix = controller + "."
    if not scope_id.startswith(prefix):
        return None
    return scope_id[len(prefix):] or None


def scope_id_of(name: str, controller: str) -> str:
    return f"{controller}.{name}" if controller else name


# ---------------------------------------------------------------- sections


def section_refs(
    section_ui_schema: Any,
    section_register_id: str,
    registers: Mapping[str, str],
) -> tuple[list[str], list[str]]:
    """The concrete references a section's UI schema shows, and paths that name no register.

    ``registers`` maps register_id → register_mnemonic. A widget's data path is
    ``<register_id>.<field>`` (a field of that register), ``<register_id>.records``
    (a table: its columns are fields of that register; no columns = the whole
    records), ``<register_id>.documents.<label>``, or a bare ``<field>`` of the
    section's own register. Nested paths (``phone_numbers.0.number``) are the
    top-level column. A path may also be an object of paths (header, geo widgets).
    """
    refs: list[str] = []
    unknown: list[str] = []

    def resolve(path: str, default_register: str) -> tuple[Optional[str], list[str]]:
        parts = [p for p in str(path).split(".") if p != ""]
        if parts and parts[0] in registers:
            return parts[0], parts[1:]
        if len(parts) > 1 and parts[1] in ("records", DOCUMENTS):
            return None, parts  # <id>.records of something that is not a register (e.g. scores)
        return default_register, parts

    def add_path(path: Any, default_register: str, columns: Optional[list] = None) -> None:
        if isinstance(path, dict):
            for value in path.values():
                add_path(value, default_register)
            return
        if not isinstance(path, str) or not path.strip():
            return
        register_id, rest = resolve(path, default_register)
        mnemonic = registers.get(register_id)
        if mnemonic is None or not rest:
            unknown.append(path)
            return
        if rest[0] == "records":
            column_paths = [c.get("widget-data-path") for c in (columns or []) if isinstance(c, dict)]
            column_paths = [c for c in column_paths if isinstance(c, str) and c.strip()]
            if not column_paths:
                refs.append(f"{mnemonic}.{ALL}")
            for column in column_paths:
                refs.append(f"{mnemonic}.{column.split('.')[0]}")
            return
        if rest[0] == DOCUMENTS:
            refs.append(f"{mnemonic}.{DOCUMENTS}" + (f".{rest[1]}" if len(rest) > 1 else ""))
            return
        refs.append(f"{mnemonic}.{rest[0]}")

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if "widget-data-path" in node and ("widget" in node or "widget-type" in node):
                add_path(node.get("widget-data-path"), section_register_id, node.get("widget-data-columns"))
                if node.get("widget-data-columns"):
                    return
            for key, value in node.items():
                if key != "widget-data-columns":
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(section_ui_schema or {})
    return sorted(set(refs)), unknown


# ---------------------------------------------------------------- validation


def validate_ref(ref: str, targets: Mapping[str, frozenset]) -> Optional[str]:
    """None when ``ref`` names a known field; otherwise why not.

    ``targets`` maps target (register mnemonic or ``<Register>.<record_type>``)
    → its field names. Entity registers also accept their documents.
    """
    try:
        target, field = parse_ref(ref)
    except ValueError as error:
        return str(error)
    fields = targets.get(target)
    if fields is None:
        register = target.split(".")[0]
        if "." in target:
            return f"'{ref}': {register} is not an activity register with {target.split('.')[1]} records"
        return f"'{ref}': no register '{register}'"
    if field == ALL:
        return None
    if field.startswith(DOCUMENTS):
        if "." in target:
            return f"'{ref}': activity records have no documents"
        return None
    if field not in fields:
        return f"'{ref}': {target} has no field '{field}'"
    return None


# ---------------------------------------------------------------- filtering


def snake_case(name: str) -> str:
    """Register mnemonic → its key in an enriched record (as the hierarchy service names it)."""
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class AllowedFields:
    """A resolved grant, applied to internal records before rendering."""

    def __init__(self, grant: Optional[Grant] = None):
        self.grant: Grant = dict(grant or {})

    def __repr__(self) -> str:
        return f"AllowedFields({self.grant!r})"

    def fields_for(self, target: str):
        return self.grant.get(target)

    def allows(self, target: str, field: str) -> bool:
        fields = self.grant.get(target)
        return fields is not None and _covers(fields, field)

    def filter_flat(self, record: Mapping[str, Any], target: str) -> dict:
        """An activity / context / aggregate record: fields outside the grant become null."""
        fields = self.grant.get(target)
        if fields == ALL:
            return dict(record)
        return {key: (value if fields is not None and _covers(fields, key) else None)
                for key, value in record.items()}

    def filter_register_record(
        self, record: Mapping[str, Any], register_mnemonic: str, nested_keys: Mapping[str, str]
    ) -> dict:
        """A register record with its linked records (``enrich_record_hierarchy`` shape).

        ``nested_keys`` maps a nested record's key (snake-cased register mnemonic)
        → its register mnemonic. Each node is filtered by its own register's grant.
        """
        filtered, _ = self._filter_node(record, register_mnemonic, nested_keys)
        return filtered

    def _filter_node(self, record, mnemonic, nested_keys) -> tuple[dict, bool]:
        fields = self.grant.get(mnemonic)
        granted = fields is not None
        out: dict[str, Any] = {}
        reached = granted
        for key, value in record.items():
            child_mnemonic = nested_keys.get(key)
            if child_mnemonic is not None and isinstance(value, list) and all(isinstance(v, dict) for v in value):
                children = []
                for child in value:
                    child_out, child_reached = self._filter_node(child, child_mnemonic, nested_keys)
                    if child_reached:
                        children.append(child_out)
                out[key] = children
                reached = reached or bool(children)
                continue
            if child_mnemonic is not None and isinstance(value, dict):
                child_out, child_reached = self._filter_node(value, child_mnemonic, nested_keys)
                if child_reached:
                    out[key] = child_out
                    reached = True
                continue
            if key == DOCUMENTS and isinstance(value, list):
                out[key] = self._filter_documents(fields, value)
                continue
            out[key] = value if granted and _covers(fields, key) else None
        return out, reached

    @staticmethod
    def _filter_documents(fields, documents: list) -> list:
        if fields is None:
            return []
        if fields == ALL or DOCUMENTS in fields:
            return list(documents)
        labels = {f.split(".", 1)[1] for f in fields if f.startswith(DOCUMENTS + ".")}
        return [d for d in documents if isinstance(d, dict) and d.get("label") in labels]
