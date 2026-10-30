import logging
from typing import List

from openg2p_registry_core.models import OutgoingTopic, ProcessStatusEnum
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


@celery_app.task(name="outgest_topic_register_beat_producer")
def outgest_topic_register_beat_producer():
    if not task_enabled():
        _logger.info("%s is disabled", "outgest_topic_register_beat_producer")
        return
    _logger.info("Checking for pending outgoing_topics registration requests")
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)
    
    with session_maker() as session:
        # Fetch rows with pending status
        outgoing_topics: List[OutgoingTopic] = (
            session.execute(
                select(OutgoingTopic)
                .filter(
                    OutgoingTopic.websub_register_status
                    == ProcessStatusEnum.PENDING.value
                )
                .limit(task_limit())
                # .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )
        _logger.info(f"Found {len(outgoing_topics)} pending outgoing_topics registration requests")

        for outgoing_topic in outgoing_topics:
            _logger.info(f"Queueing outgoing_topic with topic_id: {outgoing_topic.topic_id} for registration")
            outgoing_topic.websub_register_status = ProcessStatusEnum.PROCESSING.value
            session.add(outgoing_topic)
        session.commit()

        for outgoing_topic in outgoing_topics:
            _logger.info(
                f"Updating status for {Workers.OUTGEST_TOPIC_REGISTER_WORKER} to processing for outgoing_topic with topic_id: {outgoing_topic.topic_id}"
            )
            celery_app.send_task(
                Workers.OUTGEST_TOPIC_REGISTER_WORKER,
                args=(outgoing_topic.topic_id,),
                queue=_config.worker_queue,
            )
            _logger.info(
                f"Sent task to {Workers.OUTGEST_TOPIC_REGISTER_WORKER} for outgoing_topic with topic_id: {outgoing_topic.topic_id}"
            )

    _logger.info("Completed processing pending outgoing_topics registration requests")
