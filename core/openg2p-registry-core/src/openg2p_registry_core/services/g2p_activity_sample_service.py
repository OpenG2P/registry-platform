"""Load each activity register's sample activities once, through the normal write path.

A demo install wants activities on every screen, but activities are not rows a
seed can insert: each one opens or joins a context, is located, updates the
projection, queues summaries and is checked against its type's rules. So an
extension supplies samples as ``SampleStep``\\ s from its domain service's
``sample_activities`` hook, and this service appends them exactly as a user or
partner would — verified or corrected where the step says so.

Run by the Celery task ``activity_sample_data_worker`` when
``activity_load_sample_data`` is on. It is safe to run repeatedly:

* samples are only loaded once the register and its activity types exist (they
  come from db-seed, which runs after the APIs start);
* every sample carries an idempotency key, so a sample already recorded is
  returned, not duplicated;
* when the last step of a register's samples is already recorded, the register
  is skipped without asking its domain service again.
"""

import logging

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..errors import G2PRegistryException
from ..models import ActivityChannelEnum, ActivityVerificationStatusEnum, G2PActivityIdempotencyKey
from .g2p_activity_registry_service import G2PActivityRegistryService
from .g2p_activity_service import G2PActivityService

_logger = logging.getLogger("g2p-activity-sample-service")

SAMPLE_ACTOR = "sample-data"
SAMPLE_VERIFIER = "sample-supervisor"


class G2PActivitySampleService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        self.activities = G2PActivityService.get_component() or G2PActivityService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def load_all(self) -> dict[str, int]:
        """Load samples for every activity register. Returns activities recorded per register."""
        loaded: dict[str, int] = {}
        async with self._session_maker()() as session:
            definitions = await self.registry.list_registers(session)
        for definition in definitions:
            try:
                loaded[definition.register_mnemonic] = await self.load(definition.register_mnemonic)
            except Exception:
                _logger.exception("Sample data for %s failed; will retry", definition.register_mnemonic)
        return loaded

    async def load(self, register_mnemonic: str) -> int:
        async with self._session_maker()() as session:
            try:
                register = await self.registry.get_register(session, register_mnemonic)
            except G2PRegistryException:
                return 0  # no classes for it in the loaded extension
            if not await self.registry.list_activity_types(session, register.register_id):
                return 0  # db-seed has not loaded its types yet
            steps = await register.domain_service.sample_activities(register) or []
            if not steps:
                return 0
            if await self._recorded(session, register.register_id, steps[-1].activity.idempotency_key):
                return 0  # already loaded
        created = 0
        for step in steps:
            activity = step.activity
            if not activity.idempotency_key:
                raise ValueError(f"Sample {activity.activity_type} has no idempotency key")
            data, outcome = await self.activities.append(
                activity, SAMPLE_ACTOR, ActivityChannelEnum.SYSTEM.value, seeding=True
            )
            created += outcome == "CREATED"
            if outcome != "CREATED":
                continue
            if step.verify and data.verification_status == ActivityVerificationStatusEnum.SUBMITTED.value:
                await self.activities.verify(register_mnemonic, data.activity_id, SAMPLE_VERIFIER, "Sample: checked")
            if step.correction:
                await self.activities.supersede(
                    register_mnemonic, data.activity_id, step.correction["reason"], SAMPLE_ACTOR,
                    ActivityChannelEnum.SYSTEM.value,
                    payload={**data.payload, **(step.correction.get("payload") or {})},
                    idempotency_key=f"{activity.idempotency_key}:corrected", seeding=True,
                )
                created += 1  # the correcting activity
        if created:
            _logger.info("Loaded %s sample activities into %s", created, register_mnemonic)
        return created

    @staticmethod
    async def _recorded(session, register_id: str, key: str) -> bool:
        return await session.get(G2PActivityIdempotencyKey, (register_id, key)) is not None
