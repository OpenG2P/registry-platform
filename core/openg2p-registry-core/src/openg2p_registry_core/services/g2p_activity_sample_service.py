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
  is skipped without asking its domain service again;
* loading a register is serialised across processes by a PostgreSQL advisory
  lock, so the install's hook Job and the beat task never append the same
  samples at the same time.

The Helm hook Job (``python -m openg2p_registry_celery_worker.load_activity_samples``)
calls ``load_all(strict=True)``: every register is attempted, then any failures
are raised together as ``G2PActivitySampleLoadError`` so the install fails
instead of reporting success with no samples.
"""

import logging
from contextlib import asynccontextmanager

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..errors import G2PRegistryException
from ..models import ActivityChannelEnum, ActivityVerificationStatusEnum, G2PActivityIdempotencyKey
from .g2p_activity_registry_service import G2PActivityRegistryService
from .g2p_activity_service import G2PActivityService

_logger = logging.getLogger("g2p-activity-sample-service")

SAMPLE_ACTOR = "sample-data"
SAMPLE_VERIFIER = "sample-supervisor"
LOCK_PREFIX = "activity-samples:"


class G2PActivitySampleLoadError(Exception):
    """Sample activities could not be loaded for one or more registers (strict mode)."""

    def __init__(self, failures: dict[str, str], loaded: dict[str, int] | None = None):
        self.failures = failures
        self.loaded = loaded or {}
        super().__init__(
            "Sample activities failed for "
            + "; ".join(f"{mnemonic}: {message}" for mnemonic, message in failures.items())
        )


def _describe(error: Exception) -> str:
    return getattr(error, "message", None) or str(error) or type(error).__name__


class G2PActivitySampleService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        self.activities = G2PActivityService.get_component() or G2PActivityService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def load_all(self, strict: bool = False) -> dict[str, int]:
        """Load samples for every activity register. Returns activities recorded per register.

        Not strict (the beat task): a failing register is logged and retried on the
        next run, and a register another process is loading is skipped.
        Strict (the install's hook Job): waits for another process's load to finish,
        attempts every register, then raises ``G2PActivitySampleLoadError`` naming
        each register that failed and why.
        """
        loaded: dict[str, int] = {}
        failures: dict[str, str] = {}
        async with self._session_maker()() as session:
            definitions = await self.registry.list_registers(session)
        for definition in definitions:
            mnemonic = definition.register_mnemonic
            try:
                loaded[mnemonic] = await self.load(mnemonic, wait_for_lock=strict)
            except Exception as e:
                if strict:
                    _logger.exception("Sample data for %s failed", mnemonic)
                    failures[mnemonic] = _describe(e)
                else:
                    _logger.exception("Sample data for %s failed; will retry", mnemonic)
        if failures:
            raise G2PActivitySampleLoadError(failures, loaded)
        return loaded

    async def registers_waiting_for_types(self) -> list[str]:
        """Activity registers this extension has classes for that have no activity types yet."""
        waiting = []
        async with self._session_maker()() as session:
            for definition in await self.registry.list_registers(session):
                try:
                    register = await self.registry.get_register(session, definition.register_mnemonic)
                except G2PRegistryException:
                    continue  # no classes for it in the loaded extension
                if not await self.registry.list_activity_types(session, register.register_id):
                    waiting.append(definition.register_mnemonic)
        return waiting

    async def load(self, register_mnemonic: str, wait_for_lock: bool = True) -> int:
        async with self._register_lock(register_mnemonic, wait_for_lock) as acquired:
            if not acquired:
                _logger.info("Sample data for %s is being loaded by another process", register_mnemonic)
                return 0
            return await self._load(register_mnemonic)

    @staticmethod
    @asynccontextmanager
    async def _register_lock(register_mnemonic: str, wait: bool):
        """Session-level advisory lock on a connection of its own, held for the load.

        The load appends through the activity service's own sessions, so the lock
        cannot ride on one transaction; it is taken and released on a dedicated
        connection (committed straight away so it is never left idle in a
        transaction) and always released.
        """
        engine = dbengine.get()
        if engine.dialect.name != "postgresql":
            yield True
            return
        key = {"key": LOCK_PREFIX + register_mnemonic}
        async with engine.connect() as conn:
            if wait:
                await conn.execute(text("SELECT pg_advisory_lock(hashtext(:key))"), key)
                acquired = True
            else:
                acquired = bool(
                    (await conn.execute(text("SELECT pg_try_advisory_lock(hashtext(:key))"), key)).scalar()
                )
            await conn.commit()
            try:
                yield acquired
            finally:
                if acquired:
                    await conn.execute(text("SELECT pg_advisory_unlock(hashtext(:key))"), key)
                    await conn.commit()

    async def _load(self, register_mnemonic: str) -> int:
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
