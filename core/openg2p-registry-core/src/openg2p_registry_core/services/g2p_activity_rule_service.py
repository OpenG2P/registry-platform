"""Configured rules for activities: payload schema, dates, period locks, sequence, uniqueness."""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from jsonschema import Draft202012Validator, FormatChecker
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import and_, or_, select

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PActivityPeriodLock

_logger = logging.getLogger("g2p-activity-rule-service")

BLOCK = "BLOCK"


def _raise(code: G2PRegistryErrorCodes, message: str):
    raise G2PRegistryException(code=code.value[1], message=message)


class G2PActivityRuleService(BaseService):
    # ----------------------------------------------------------------- schema

    @staticmethod
    def validate_payload(payload_schema: Optional[dict], payload: dict[str, Any]) -> None:
        if not payload_schema:
            return
        validator = Draft202012Validator(payload_schema, format_checker=FormatChecker())
        errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
        if errors:
            details = "; ".join(
                f"{'.'.join(str(part) for part in error.absolute_path) or 'payload'}: {error.message}"
                for error in errors[:10]
            )
            _raise(G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID, details)

    # ------------------------------------------------------------------ dates

    @staticmethod
    def check_dates(activity_type_row, occurred_at: datetime, now: datetime) -> None:
        if occurred_at > now + timedelta(minutes=5) and not activity_type_row.allow_future_dated:
            _raise(G2PRegistryErrorCodes.ACTIVITY_FUTURE_DATED, "occurred_at is in the future")
        max_days = activity_type_row.max_backdate_days
        if max_days is not None and occurred_at < now - timedelta(days=max_days):
            _raise(
                G2PRegistryErrorCodes.ACTIVITY_BACKDATED_TOO_FAR,
                f"{activity_type_row.activity_type} may be recorded at most {max_days} days after it happened",
            )

    @staticmethod
    async def check_period_lock(session, register_id: str, activity_type: str, occurred_at: datetime) -> None:
        day = occurred_at.date()
        lock = (
            await session.execute(
                select(G2PActivityPeriodLock).where(
                    G2PActivityPeriodLock.register_id == register_id,
                    G2PActivityPeriodLock.is_active.is_(True),
                    G2PActivityPeriodLock.period_start <= day,
                    G2PActivityPeriodLock.period_end >= day,
                    or_(
                        G2PActivityPeriodLock.activity_type.is_(None),
                        G2PActivityPeriodLock.activity_type == activity_type,
                    ),
                )
            )
        ).scalar()
        if lock is not None:
            _raise(
                G2PRegistryErrorCodes.ACTIVITY_PERIOD_LOCKED,
                f"Period {lock.period_start} – {lock.period_end} is closed"
                + (f": {lock.reason}" if lock.reason else ""),
            )

    # ---------------------------------------------------------- context rules

    @staticmethod
    def check_context_rules(
        activity_type_row,
        payload: dict[str, Any],
        context_activities: list,
        occurred_at: datetime,
    ) -> list[str]:
        """Rules against the context's current (ACTIVE, not rejected) activities. Returns warnings."""
        warnings: list[str] = []
        same_type = [a for a in context_activities if a.activity_type == activity_type_row.activity_type]

        if not activity_type_row.is_repeatable and same_type:
            _raise(
                G2PRegistryErrorCodes.ACTIVITY_NOT_REPEATABLE,
                f"{activity_type_row.activity_type} is already recorded for this context "
                f"(activity {same_type[0].activity_id}); supersede it to correct it",
            )

        fields = activity_type_row.uniqueness_fields or []
        if fields:
            key = tuple(_normalise(payload.get(field)) for field in fields)
            for existing in same_type:
                if tuple(_normalise((existing.payload or {}).get(field)) for field in fields) == key:
                    _raise(
                        G2PRegistryErrorCodes.ACTIVITY_DUPLICATE,
                        f"{activity_type_row.activity_type} with the same {', '.join(fields)} already exists "
                        f"(activity {existing.activity_id})",
                    )

        prior = activity_type_row.requires_prior_types or []
        if prior:
            present = {a.activity_type for a in context_activities if a.occurred_at <= occurred_at}
            missing = [t for t in prior if t not in present]
            if missing:
                message = (
                    f"{activity_type_row.activity_type} recorded before {', '.join(missing)} "
                    "for this context"
                )
                if (activity_type_row.sequence_enforcement or "").upper() == BLOCK:
                    _raise(G2PRegistryErrorCodes.ACTIVITY_OUT_OF_SEQUENCE, message)
                warnings.append(message)
        return warnings

    # --------------------------------------------------------------- due work

    @staticmethod
    def due_window(due_rule: Optional[dict], after_occurred_at: datetime) -> Optional[tuple[datetime, Optional[datetime]]]:
        if not due_rule or not due_rule.get("after_type"):
            return None
        due_from = after_occurred_at + timedelta(days=int(due_rule.get("min_days") or 0))
        max_days = due_rule.get("max_days")
        due_by = after_occurred_at + timedelta(days=int(max_days)) if max_days is not None else None
        return due_from, due_by

    @staticmethod
    def due_status(due_from: datetime, due_by: Optional[datetime], now: datetime) -> str:
        if due_by is not None and now > due_by:
            return "OVERDUE"
        if now >= due_from:
            return "DUE"
        return "NOT_YET_DUE"


def _normalise(value):
    if isinstance(value, str):
        return value.strip().lower()
    if isinstance(value, list):
        return tuple(sorted(_normalise(v) for v in value))
    return value


# Kept for callers that combine SQL-side filters with Python-side rules.
def active_filter(model):
    from ..models import ActivityStatusEnum, ActivityVerificationStatusEnum

    return and_(
        model.status == ActivityStatusEnum.ACTIVE.value,
        model.verification_status != ActivityVerificationStatusEnum.REJECTED.value,
    )
