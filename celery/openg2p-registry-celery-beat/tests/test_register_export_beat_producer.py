import importlib
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from openg2p_registry_core.models import ProcessStatusEnum

sys.modules.setdefault(
    "openg2p_registry_extensions",
    importlib.import_module(
        os.environ.get(
            "REGISTRY_EXTENSION_MODULE",
            "openg2p_registry_farmer_extension",
        )
    ),
)



class RegisterExportBeatProducerTests(unittest.TestCase):
    def test_claims_pending_exports_fifo_and_dispatches_worker(self):
        first = SimpleNamespace(
            export_id="export-1",
            export_status=ProcessStatusEnum.PENDING.value,
            export_latest_timestamp=None,
        )
        second = SimpleNamespace(
            export_id="export-2",
            export_status=ProcessStatusEnum.PENDING.value,
            export_latest_timestamp=None,
        )
        session = MagicMock()
        session.execute.return_value.scalars.return_value.all.return_value = [
            first,
            second,
        ]
        session_cm = MagicMock()
        session_cm.__enter__.return_value = session
        session_cm.__exit__.return_value = False
        session_factory = MagicMock(return_value=session_cm)

        with patch(
            "openg2p_registry_celery_beat.tasks.register_export_beat_producer.sessionmaker",
            return_value=session_factory,
        ), patch(
            "openg2p_registry_celery_beat.tasks.register_export_beat_producer.celery_app"
        ) as celery_app, patch(
            "openg2p_registry_celery_beat.tasks.register_export_beat_producer._config"
        ) as config:
            config.export_no_of_tasks_to_process = 5
            config.worker_queue = "registry_worker_queue"
            from openg2p_registry_celery_beat.tasks.register_export_beat_producer import (
                register_export_beat_producer,
            )

            register_export_beat_producer()

        self.assertEqual(first.export_status, ProcessStatusEnum.PROCESSING.value)
        self.assertEqual(second.export_status, ProcessStatusEnum.PROCESSING.value)
        self.assertEqual(celery_app.send_task.call_count, 2)
        first_call = celery_app.send_task.call_args_list[0]
        self.assertEqual(first_call.args[0], "register_export_worker")
        self.assertEqual(first_call.kwargs["args"], ("export-1",))
        self.assertEqual(first_call.kwargs["queue"], "registry_worker_queue")
        session.commit.assert_called_once()
