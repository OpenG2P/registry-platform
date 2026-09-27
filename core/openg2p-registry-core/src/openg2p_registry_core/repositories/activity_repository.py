"""Data-policy conditions for activity and projection tables.

Unlike ``RegisterRecordRepository``, a policy condition naming a column the
table does not have denies everything instead of being skipped: an activity
register that cannot evaluate a geo policy must not reveal records outside it.
"""

import logging

from sqlalchemy import false

from .register_repository import RegisterRecordRepository

_logger = logging.getLogger(__name__)


class ActivityPolicyRepository(RegisterRecordRepository):
    def _build_condition(self, condition: dict):
        field_id = condition.get("field_id")
        if field_id and getattr(self.model, field_id, None) is None:
            _logger.warning(
                "Policy field '%s' not on %s; denying (activity registers fail closed)",
                field_id,
                self.model.__name__,
            )
            return false()
        return super()._build_condition(condition)
