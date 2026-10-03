import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from openg2p_registry_core.models import (
    G2PRegisterExportDataQueue,
    ProcessStatusEnum,
)

from ..app import celery_app
from ..config import Settings
from ..engine import Engine
from ..utils import Workers

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()


@celery_app.task(name="register_export_beat_producer")
def register_export_beat_producer():
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)
    with session_maker() as session:
        pending_exports = (
            session.execute(
                select(G2PRegisterExportDataQueue)
                .where(
                    G2PRegisterExportDataQueue.export_status
                    == ProcessStatusEnum.PENDING.value
                )
                .order_by(G2PRegisterExportDataQueue.queued_at.asc())
                .limit(_config.export_no_of_tasks_to_process)
            )
            .scalars()
            .all()
        )

        for queue_item in pending_exports:
            queue_item.export_status = ProcessStatusEnum.PROCESSING.value
            queue_item.export_latest_timestamp = datetime.now()
            session.add(queue_item)
            celery_app.send_task(
                Workers.REGISTER_EXPORT_WORKER,
                args=(queue_item.export_id,),
                queue=_config.worker_queue,
            )

        session.commit()
        _logger.info("Queued %s register export job(s)", len(pending_exports))
