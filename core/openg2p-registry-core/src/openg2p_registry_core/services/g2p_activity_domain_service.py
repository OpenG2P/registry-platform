"""Extension hooks for an activity register.

An extension provides ``G2PActivityDomainService<Mnemonic>`` in
``openg2p_registry_extensions.register_domain.services``, subclassing this
class. Every hook has a working default, so a register only overrides what its
domain needs.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Optional

from openg2p_fastapi_common.service import BaseService


class ActivityContextSpec(dict):
    """What ``build_context`` returns: context_key plus optional context_type, subject and attributes."""


@dataclass
class ActivityAggregateResult:
    """One roll-up value, returned by ``aggregate``; the platform stores it and keeps its history.

    The subject may differ from the activity's (a farmer's season summary from a
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


class G2PActivityDomainService(BaseService):
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
        """Domain rules beyond the configured ones. Return warnings; raise G2PRegistryException to block."""
        return []

    def search_text_values(self, activity_type: str, payload: dict[str, Any]) -> list[str]:
        """Payload values to include in the activity's search_text."""
        return []

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

    def now(self) -> datetime:
        return datetime.utcnow()
