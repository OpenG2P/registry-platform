"""Activity register background work, scheduled directly by celery beat.

* activity_outbox_worker        — outgest and aggregate hooks for new activity events
* activity_reconcile_worker     — repair projections that disagree with their activities
* activity_partition_worker     — create next year's partitions ahead of time
* activity_odk_pull_worker      — pull new ODK Central submissions into activities

The activity services are asynchronous. Each task runs them on its own event
loop with a NullPool engine, so no connection outlives the loop it was made on.
"""

import asyncio
import logging

from openg2p_fastapi_common.context import dbengine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from ..app import celery_app
from ..config import Settings
from ..engine import Engine

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


def _run(work):
    async def runner():
        engine = create_async_engine(Engine.construct_async_db_datasource(), poolclass=NullPool)
        previous = dbengine.get()
        dbengine.set(engine)
        try:
            return await work()
        finally:
            dbengine.set(previous)
            await engine.dispose()

    return asyncio.run(runner())


def _service(cls):
    return cls.get_component() or cls()


@celery_app.task(name="activity_outbox_worker")
def activity_outbox_worker():
    from openg2p_registry_core.services import G2PActivityOutboxService

    service = _service(G2PActivityOutboxService)

    async def work():
        processed = await service.process_batch()
        health = await service.backlog()
        if health["oldest_pending_seconds"] > 300 or health["counts"].get("FAILED"):
            _logger.warning("Activity outbox backlog: %s", health)
        return processed

    processed = _run(work)
    if processed:
        _logger.info("Activity outbox: processed %s events", processed)
    return processed


@celery_app.task(name="activity_reconcile_worker")
def activity_reconcile_worker():
    from openg2p_registry_core.services import G2PActivityOutboxService

    return _run(_service(G2PActivityOutboxService).reconcile)


@celery_app.task(name="activity_partition_worker")
def activity_partition_worker():
    from openg2p_registry_core.app import extension_activity_models
    from openg2p_registry_core.services import G2PActivityPartitionService

    partitions = _service(G2PActivityPartitionService)
    activities, _ = extension_activity_models()

    async def work():
        for model in activities:
            await partitions.ensure_activity_table(model)
        return [model.__tablename__ for model in activities]

    return _run(work)


@celery_app.task(name="activity_odk_pull_worker")
def activity_odk_pull_worker():
    if not _config.activity_odk_enabled:
        return {}
    from openg2p_registry_core.services import G2PActivityOdkService

    result = _run(_service(G2PActivityOdkService).pull_all)
    _logger.info("ODK pull: %s", result)
    return result
