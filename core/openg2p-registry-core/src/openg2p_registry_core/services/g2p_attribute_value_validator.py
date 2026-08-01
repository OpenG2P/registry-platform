import logging
from typing import Any, Iterable, Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..config import Settings
from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PAttribute, G2PAttributeValue

_config = Settings.get_config()
_logger = logging.getLogger("g2p-attribute-value-validator")


class G2PAttributeValueValidator(BaseService):
    """Check that a record's coded values exist in the country's own lists.

    This is what the compiled enums do today. They cannot keep doing it: an enum
    is fixed at image build time, so a registry that validates against one can
    only ever serve the country it was built for. The lists now come from the
    country pack via Master Data, and this validates against those instead —
    which is what lets the enums be deleted without losing the check.

    OFF BY DEFAULT (registry_core_validate_attribute_values). With it off this
    class is never consulted and submission behaves exactly as before.

    Even switched on it only judges attributes that are actually seeded. A field
    with no matching list is passed through untouched, so enabling it on a
    deployment that seeded four lists validates those four and nothing else.
    """

    def __init__(self):
        super().__init__()
        # attribute_id -> permitted codes. Built once: the lists change at
        # install, not during a request, and this sits on the submission path.
        self._codes: Optional[dict[str, set[str]]] = None

    @property
    def enabled(self) -> bool:
        return bool(getattr(_config, "validate_attribute_values", False))

    def invalidate(self) -> None:
        """Drop the cached lists — call after seeding or editing a list."""
        self._codes = None

    async def _load(self, session: Optional[AsyncSession] = None) -> dict[str, set[str]]:
        if self._codes is not None:
            return self._codes

        async def _run(db_session: AsyncSession) -> dict[str, set[str]]:
            rows = (
                await db_session.execute(
                    select(G2PAttributeValue.attribute_id, G2PAttributeValue.value_code)
                )
            ).all()
            codes: dict[str, set[str]] = {}
            for attribute_id, value_code in rows:
                codes.setdefault(attribute_id, set()).add(value_code)
            # An attribute with no values permits nothing, which would reject
            # every submission naming it. Treat it as unseeded instead — that is
            # what it is.
            declared = (await db_session.execute(select(G2PAttribute.attribute_id))).scalars().all()
            for attribute_id in declared:
                codes.setdefault(attribute_id, set())
            return {a: c for a, c in codes.items() if c}

        if session is not None:
            self._codes = await _run(session)
        else:
            session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
            async with session_maker() as db_session:
                self._codes = await _run(db_session)
        return self._codes

    @staticmethod
    def _attribute_id_for(field: str, field_map: Optional[dict[str, str]]) -> str:
        # Convention, with an escape hatch. Registry columns and pack list ids
        # already agree for 30 of Ethiopia's 34 lists — water_source_type is
        # WATER_SOURCE_TYPE — so a mapping table would be 30 lines restating the
        # obvious and 4 lines of actual information. field_map carries the four:
        # NSR splits LIVELIHOOD into primary_livelihood and secondary_livelihood,
        # for instance, and neither name matches by convention.
        if field_map and field in field_map:
            return field_map[field]
        return field.upper()

    @staticmethod
    def _values_of(value: Any) -> Iterable[Any]:
        # A multi-select arrives as a list; each element is checked separately.
        if isinstance(value, (list, tuple, set)):
            return value
        return [value]

    async def validate_records(
        self,
        records: list[dict],
        *,
        field_map: Optional[dict[str, str]] = None,
        session: Optional[AsyncSession] = None,
    ) -> None:
        """Raise on the first record carrying a value its list does not define.

        Every violation in the batch is reported at once. Reporting only the
        first turns fixing a bulk submission into one round trip per bad value.
        """
        if not self.enabled or not records:
            return

        codes = await self._load(session)
        if not codes:
            # Nothing seeded. Says the registry has no lists to check against,
            # not that everything is invalid.
            return

        problems: list[str] = []
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            for field, raw in record.items():
                attribute_id = self._attribute_id_for(field, field_map)
                permitted = codes.get(attribute_id)
                if not permitted:
                    continue
                for value in self._values_of(raw):
                    if value is None or value == "":
                        continue
                    if not isinstance(value, str):
                        continue
                    if value not in permitted:
                        problems.append(
                            f"record {index}: {field}={value!r} is not a value of "
                            f"{attribute_id} (permitted: {', '.join(sorted(permitted))})"
                        )

        if problems:
            _logger.info("rejected %d coded value(s) against seeded lists", len(problems))
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message="; ".join(problems),
            )
