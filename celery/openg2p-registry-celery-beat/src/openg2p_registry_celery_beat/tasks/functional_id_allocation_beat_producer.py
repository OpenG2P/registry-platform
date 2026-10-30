import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from openg2p_registry_core.models import G2PFunctionalIdGenerationQueue
from openg2p_registry_core.models.g2p_functional_id_generation_queue import (
    ProcessStatusEnum as FunctionalIdGenerationStatusEnum,
)

from ..app import celery_app
from ..config import Settings
from ..engine import Engine
from ..control import task_enabled, task_limit
from ..utils import Workers

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()


@celery_app.task(name="functional_id_allocation_beat_producer")
def functional_id_allocation_beat_producer():
    if not task_enabled():
        _logger.info("%s is disabled", "functional_id_allocation_beat_producer")
        return
    _logger.info("Checking for pending functional ID allocation requests")
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)

    with session_maker() as session:
        pending_queue_items: List[G2PFunctionalIdGenerationQueue] = (
            session.execute(
                select(G2PFunctionalIdGenerationQueue)
                .filter(
                    G2PFunctionalIdGenerationQueue.id_allocation_status
                    == FunctionalIdGenerationStatusEnum.PENDING.value
                )
                .limit(task_limit())
                # .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )
        _logger.info(
            f"Found {len(pending_queue_items)} PENDING functional ID allocation requests"
        )

        for queue_item in pending_queue_items:
            _logger.info(
                f"Queueing functional ID allocation for queue_id: {queue_item.queue_id}"
            )
            queue_item.id_allocation_status = FunctionalIdGenerationStatusEnum.PROCESSING.value
            session.add(queue_item)
        session.commit()

        for queue_item in pending_queue_items:
            celery_app.send_task(
                Workers.FUNCTIONAL_ID_ALLOCATION_WORKER,
                args=(queue_item.queue_id,),
                queue=_config.worker_queue,
            )
            _logger.info(
                f"Sent task to {Workers.FUNCTIONAL_ID_ALLOCATION_WORKER} for queue_id: {queue_item.queue_id}"
            )

    _logger.info("Completed processing pending functional ID allocation requests")
