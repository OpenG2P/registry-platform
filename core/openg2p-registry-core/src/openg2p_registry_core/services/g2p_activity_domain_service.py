"""Extension hooks for an activity register.

An extension provides ``G2PActivityDomainService<Mnemonic>`` in
``openg2p_registry_extensions.register_domain.services``, subclassing this
class, and/or a configuration file
``meta_data/activity-config/<Mnemonic>.json`` (see
``g2p_activity_register_config``). Every hook has a working default, so a
register only overrides what its domain needs.

Precedence, per declaration or hook: a subclass that sets the attribute or
overrides the method wins; otherwise the configuration file; otherwise the
platform default. Configured from the file: ``context_fields``,
``subject_type``/``subject_id_fields``, ``ui_hints``, ``final_on_period_lock``,
``search_text_values`` (``search_fields``), ``validate`` (``rules``) and the
output records (``formats``: ``render_record``, used by ``dci_state_record``
and ``dci_aggregate_record``).
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Optional

from openg2p_fastapi_common.service import BaseService

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from .g2p_activity_register_config import (
    EMPTY_CONFIG,
    ActivityRegisterConfig,
    evaluate_rules,
    load_config,
)
from .g2p_activity_register_config import (
    render_record as _render_record,
)


@dataclass
class SampleStep:
    """One sample activity, and what to do with it once recorded."""

    activity: Any  # ActivityInput
    verify: bool = False  # verify it (when its type requires verification)
    correction: Optional[dict[str, Any]] = None  # {"reason": ..., "payload": {...}}: supersede it


class ActivityContextSpec(dict):
    """What ``build_context`` returns: context_key plus optional context_type, subject and attributes."""


@dataclass
class ActivityAggregateResult:
    """One roll-up value, returned by ``aggregate``; the platform stores it and keeps its history.

    The subject may differ from the activity's (a person's season summary from a
    plot's harvest). ``period_key`` is the domain's label for the period, with
    its date range for sorting and filtering. Leave ``geo_dimensions`` unset to
    have the platform copy the triggering activity's geography.
    """

    subject_type: str
    subject_id: str
    aggregate_type: str
    period_key: str
    aggregate_value: dict[str, Any]
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    subject_internal_record_id: Optional[str] = None
    subject_register_mnemonic: Optional[str] = None
    geo_dimensions: Optional[dict[str, Any]] = None
    custom_dimensions: Optional[dict[str, Any]] = field(default=None)


class _Configured:
    """A declaration read from the register's configuration file unless set in code.

    A subclass's class attribute of the same name replaces this descriptor (code
    wins); an instance may also set it.
    """

    def __init__(self, read, default):
        self.read, self.default = read, default

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self.default
        if self.name in instance.__dict__:
            return instance.__dict__[self.name]
        return self.read(instance.activity_config)

    def __set__(self, instance, value):
        instance.__dict__[self.name] = value


_UNLOADED = object()


class G2PActivityDomainService(BaseService):
    # Payload fields that define which context an activity belongs to (e.g. a
    # crop season's plot, year, season and crop; an attendance day's worker and
    # date). A correction keeps its context, so it may not change them: the
    # staff UI locks them, and supersede rejects a change. Void and record anew
    # to move an activity to another context.
    context_fields: tuple[str, ...] = _Configured(lambda c: tuple(c.context_fields), ())

    # How the staff UI presents this register, so the platform UI holds no
    # register-specific field names. All keys optional:
    #   summary_fields        payload fields shown on an activity's row in lists
    #   context_columns       projection columns shown in the context list
    #   batch_carry_fields    fields a new batch row copies from the row above
    #   search_placeholder    hint in the activity search box
    #   context_search_placeholder  hint in the context search box
    ui_hints: dict[str, Any] = _Configured(lambda c: dict(c.ui_hints), {})

    # Aggregate types that become final when a period lock (for all activity
    # types) covers their whole period, e.g. a worker's monthly attendance once
    # the month is closed. Others are never marked final.
    final_on_period_lock: tuple[str, ...] = _Configured(lambda c: tuple(c.final_on_period_lock), ())

    # Activity fields that hold another identifier of the subject (e.g. a
    # person's Fayda FAN beside the register's own ID). A partner's consent names the
    # person by one identifier; a search by another is allowed only when the
    # register's own data links the two.
    subject_id_fields: tuple[str, ...] = _Configured(lambda c: tuple(c.subject.subject_id_fields), ())

    # The subject type the register's activities are about by default (e.g.
    # FARMER_ID), for build_context and aggregate to use.
    subject_type: Optional[str] = _Configured(lambda c: c.subject.subject_type, None)

    # The register this service is for; set by G2PActivityRegistryService, and
    # used to find the configuration file.
    register_mnemonic: Optional[str] = None
    _activity_config = _UNLOADED

    @property
    def activity_config(self) -> ActivityRegisterConfig:
        """The register's configuration file (validated), or the empty configuration."""
        if self._activity_config is _UNLOADED:
            self._activity_config = load_config(self.register_mnemonic) if self.register_mnemonic else EMPTY_CONFIG
        return self._activity_config

    @activity_config.setter
    def activity_config(self, config: ActivityRegisterConfig) -> None:
        self._activity_config = config

    def build_context(
        self,
        activity_type: str,
        subject_type: Optional[str],
        subject_id: Optional[str],
        payload: dict[str, Any],
    ) -> Optional[ActivityContextSpec]:
        """Derive the context an activity belongs to when the caller did not name one.

        Return ``None`` when the context cannot be derived; activity types that
        require a context are then rejected.
        """
        return None

    def enrich_payload(self, activity_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Add derived values (e.g. yield per hectare) before validation."""
        return payload

    def validate(self, activity_type: str, payload: dict[str, Any], context_activities: list) -> list[str]:
        """Plausibility rules against the context's latest activities. Return warnings; raise to block.

        The default evaluates the configuration's ``rules``: a failed ``warn``
        rule is a warning, a failed ``block`` rule rejects the activity
        (ACTIVITY_RULE_FAILED, every failed blocking rule's message). An
        override that adds code rules calls ``super().validate(...)`` to keep
        the configured ones.
        """
        outcomes = evaluate_rules(self.activity_config, activity_type, payload, context_activities)
        blocking = [outcome.message for outcome in outcomes if outcome.severity == "block"]
        if blocking:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.ACTIVITY_RULE_FAILED.value[1], message="; ".join(blocking)
            )
        return [outcome.message for outcome in outcomes]

    def search_text_values(self, activity_type: str, payload: dict[str, Any]) -> list[str]:
        """Payload values to include in the activity's search_text (default: the configured search_fields)."""
        return [str(payload[field]) for field in self.activity_config.search_fields if payload.get(field)]

    def project(self, context, activities: list) -> dict[str, Any]:
        """Compute the projection columns for one context.

        ``activities`` are the context's ACTIVE, non-rejected activities in
        ``occurred_at`` order. Return a dict of column values for the
        extension's ``G2PActivityProjection<Mnemonic>`` model; the core fills
        the base columns (counts, last activity, context status).
        """
        return {}

    async def resolve_external_reference(self, rule: dict, value: str) -> Optional[dict]:
        """Look up an identifier held by another system.

        Return ``{"found": True, "display": "..."}`` / ``{"found": False}``, or
        ``None`` when the system cannot be reached or no resolver is configured
        (treated as unresolved, i.e. a warning in LENIENT mode).
        """
        return None

    def reference_display(self, field: str, value: Any) -> Optional[str]:
        """A display label for a referenced value not covered by code lists or geo."""
        return None

    # ------------------------------------------------ asynchronous layer
    #
    # Both run from the outbox worker after an activity event (appended,
    # superseded, voided, verified, rejected), in the worker's transaction, so
    # they may read the register's activities and projections through
    # ``session``. Both must be idempotent: an event can be processed again.

    async def enrich(self, session, register, activity) -> Optional[dict[str, Any]]:
        """Derived or external data for an activity (e.g. rainfall at the plot on the sowing date).

        Returned data is stored beside the activity, never in it, and shown with
        it. Return ``None`` for nothing to add. Called for APPENDED events only.
        """
        return None

    async def aggregate(self, session, register, activity, event_type: str) -> list[ActivityAggregateResult]:
        """Roll-ups affected by this event, recomputed from current data (not incremented).

        Return every roll-up whose value may have changed; each replaces the
        stored value for its subject, type and period, and is appended to history.
        """
        return []

    # ------------------------------------------------------------- sharing

    # A partner search on an activity register can return, instead of
    # activities, a subject's current state per context or its aggregates. The
    # records are internal and format-independent (a projection row, an
    # aggregate row, JSON-ready), and already filtered to the consented data
    # scopes (fields outside them are null) before they are shaped, so a hook
    # or template reads fields with .get and never needs to know about consent.
    #
    # Each sharing standard is an output format. ``render_record`` shapes a
    # record with the template the configuration names for the format and
    # kind; DCI (format "dci") is one such format, with the hooks below
    # (reg_record_type naming the context type, e.g. ...:CropSeason, or
    # ...:Aggregate). Another standard's API asks for its own format.

    def render_record(self, output_format: str, kind: str, record: dict[str, Any]) -> Optional[dict[str, Any]]:
        """A record (kind "state" or "aggregate") in an output format, or None when none is configured."""
        return _render_record(self.activity_config, output_format, kind, record, self.register_mnemonic)

    def dci_state_record(self, state: dict[str, Any]) -> dict[str, Any]:
        """One context's current state as a DCI record: the configured dci template, else generic."""
        rendered = self.render_record("dci", "state", state)
        if rendered is not None:
            return rendered
        base = {"context_id", "context_key", "subject_type", "subject_id", "context_status", "activity_count",
                "last_activity_id", "last_activity_type", "last_occurred_at", "last_recorded_at", "projected_at",
                "geo_dimensions", "geo_code_hierarchy_json"}
        return {
            "subject_reference": {"subject_type": state.get("subject_type"), "subject_id": state.get("subject_id")},
            "context": {key: state.get(key) for key in ("context_id", "context_key", "context_status",
                                                         "activity_count", "last_activity_type", "last_occurred_at")},
            "state": {key: value for key, value in state.items() if key not in base},
            "location": state.get("geo_dimensions"),
        }

    def dci_aggregate_record(self, aggregate: dict[str, Any]) -> dict[str, Any]:
        """One aggregate as a DCI record: the configured dci template, else generic."""
        rendered = self.render_record("dci", "aggregate", aggregate)
        if rendered is not None:
            return rendered
        return {
            "subject_reference": {
                "subject_type": aggregate.get("subject_type"),
                "subject_id": aggregate.get("subject_id"),
                "subject_register": aggregate.get("subject_register_mnemonic"),
            },
            "aggregate": {key: aggregate.get(key) for key in (
                "aggregate_type", "period_key", "period_start", "period_end", "computed_at")},
            "measures": aggregate.get("aggregate_value"),
            "location": aggregate.get("geo_dimensions"),
            "dimensions": aggregate.get("custom_dimensions"),
        }

    # ------------------------------------------------------------- samples

    async def sample_activities(self, register) -> list["SampleStep"]:
        """Sample activities for a demo install, in order (see G2PActivitySampleService).

        Every step's activity must carry an idempotency key, so loading is
        exactly-once. Return [] while what the samples refer to is not ready
        yet; the loader asks again on its next run.
        """
        return []

    def now(self) -> datetime:
        return datetime.utcnow()
