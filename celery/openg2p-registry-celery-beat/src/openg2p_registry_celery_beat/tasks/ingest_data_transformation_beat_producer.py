import logging
from typing import List

from openg2p_registry_core.models import IncomingClassifiedData, ProcessStatusEnum
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from ..app import celery_app
from ..config import Settings
from ..engine import Engine
from ..control import task_enabled, task_limit
from ..utils import Workers

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()


@celery_app.task(name="ingest_data_transformation_beat_producer")
def ingest_data_transformation_beat_producer():
    if not task_enabled():
        _logger.info("%s is disabled", "ingest_data_transformation_beat_producer")
        return
    _logger.info("Checking for pending incoming_classified_data tranformation requests")
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)
    
    with session_maker() as session:
        # Fetch rows with pending status
        incoming_classified_data: List[IncomingClassifiedData] = (
            session.execute(
                select(IncomingClassifiedData)
                .filter(
                    IncomingClassifiedData.transformation_status
                    == ProcessStatusEnum.PENDING.value
                )
                .limit(task_limit())
                # .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )
        _logger.info(f"Found {len(incoming_classified_data)} pending incoming_classified_data transformation requests")

        for incoming_classified_datum in incoming_classified_data:
            _logger.info(f"Queueing incoming_classified_data with ingest_id: {incoming_classified_datum.ingest_id} for enrichment and transformation")
            incoming_classified_datum.transformation_status = ProcessStatusEnum.PROCESSING.value
            session.add(incoming_classified_datum)
        session.commit()

        for incoming_classified_datum in incoming_classified_data:
            _logger.info(
                f"Updating status for {Workers.INGEST_DATA_TRANSFORMATION_WORKER} to processing for incoming_classified_data with ingest_id: {incoming_classified_datum.ingest_id}"
            )
            celery_app.send_task(
                Workers.INGEST_DATA_TRANSFORMATION_WORKER,
                args=(incoming_classified_datum.ingest_id,),
                queue=_config.worker_queue,
            )
            _logger.info(
                f"Sent task to {Workers.INGEST_DATA_TRANSFORMATION_WORKER} for incoming_classified_data with ingest_id: {incoming_classified_datum.ingest_id}"
            )

    _logger.info("Completed processing pending incoming_classified_data transformation requests")
