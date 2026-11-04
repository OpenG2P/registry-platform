import logging

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from openg2p_registry_core.models import (
    G2PIntakeFormSubmission,
    ProcessStatusEnum,
    ApprovalStatusEnum
)

from ..app import celery_app
from ..config import Settings
from ..engine import Engine
from ..control import task_enabled, task_limit
from ..utils import Workers

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()


@celery_app.task(name="intake_form_register_ingest_beat_producer")
def intake_form_register_ingest_beat_producer():
    if not task_enabled():
        _logger.info("%s is disabled", "intake_form_register_ingest_beat_producer")
        return
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)

    with session_maker() as session:
        submissions = (
            session.execute(
                select(G2PIntakeFormSubmission)
                .where(
                    G2PIntakeFormSubmission.approval_status == ApprovalStatusEnum.APPROVED.value,
                    G2PIntakeFormSubmission.register_ingest_process_status == ProcessStatusEnum.PENDING.value,
                )
                .limit(task_limit())
                # .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )

        for submission in submissions:
            submission.register_ingest_process_status = ProcessStatusEnum.PROCESSING.value
            session.add(submission)
        session.commit()

        for submission in submissions:
            celery_app.send_task(
                Workers.INTAKE_FORM_REGISTER_INGEST_WORKER,
                args=(submission.submission_id,),
                queue=_config.worker_queue,
            )
            _logger.info(
                "Sent task to %s for submission: %s",
                Workers.INTAKE_FORM_REGISTER_INGEST_WORKER,
                submission.submission_id,
            )
