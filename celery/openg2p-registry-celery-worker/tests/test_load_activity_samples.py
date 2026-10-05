import asyncio
import unittest

from openg2p_registry_celery_worker.load_activity_samples import (
    MASTER_DATA_HINT,
    hint_for,
    run,
    wait_for_activity_types,
)
from openg2p_registry_core.services import G2PActivitySampleLoadError


class _Service:
    def __init__(self, waiting=(), result=None, error=None):
        self._waiting = list(waiting)
        self._result = result or {}
        self._error = error
        self.strict = None

    async def registers_waiting_for_types(self):
        return self._waiting.pop(0) if self._waiting else []

    async def load_all(self, strict=False):
        self.strict = strict
        if self._error:
            raise self._error
        return self._result


def _run(service, timeout=5, interval=0):
    lines = []
    code = asyncio.run(run(service, timeout, interval, out=lines.append))
    return code, "\n".join(lines)


class LoadActivitySamplesTests(unittest.TestCase):
    def test_success_exits_zero_with_counts(self):
        service = _Service(result={"CROP_SOWN": 12, "FIELD_WORK": 0})
        code, output = _run(service)
        self.assertEqual(code, 0)
        self.assertTrue(service.strict)
        self.assertIn("CROP_SOWN: 12 sample activities recorded", output)
        self.assertIn("FIELD_WORK: 0", output)

    def test_no_activity_registers_exits_zero(self):
        code, output = _run(_Service(result={}))
        self.assertEqual(code, 0)
        self.assertIn("No activity registers", output)

    def test_failure_exits_non_zero_with_each_error_and_hint(self):
        error = G2PActivitySampleLoadError(
            {"CROP_SOWN": "crop: 'CROP_WHEAT' is not a known code", "HARVEST": "boom"},
            {"FIELD_WORK": 3},
        )
        code, output = _run(_Service(error=error))
        self.assertEqual(code, 1)
        self.assertIn("CROP_SOWN: crop: 'CROP_WHEAT' is not a known code", output)
        self.assertIn("HARVEST: boom", output)
        self.assertEqual(output.count("hint:"), 1)
        self.assertIn(MASTER_DATA_HINT, output)

    def test_hint_only_for_master_data_misses(self):
        self.assertEqual(hint_for("location: 'W9' is not a known location"), MASTER_DATA_HINT)
        self.assertEqual(hint_for("crop: 'X' is not a known code"), MASTER_DATA_HINT)
        self.assertIsNone(hint_for("connection refused"))

    def test_waits_for_activity_types_then_loads(self):
        service = _Service(waiting=[["CROP_SOWN"], ["CROP_SOWN"]], result={"CROP_SOWN": 1})
        code, output = _run(service)
        self.assertEqual(code, 0)
        self.assertIn("Waiting for activity types (db-seed) for: CROP_SOWN", output)

    def test_gives_up_when_types_never_appear(self):
        ticks = iter(range(100))
        service = _Service(waiting=[["CROP_SOWN"]] * 100)
        waiting = asyncio.run(wait_for_activity_types(
            service, timeout=3, interval=0, out=lambda _l: None, clock=lambda: next(ticks),
            sleep=lambda _s: asyncio.sleep(0),
        ))
        self.assertEqual(waiting, ["CROP_SOWN"])
        service = _Service(waiting=[["CROP_SOWN"]] * 100)
        code, output = _run(service, timeout=0)
        self.assertEqual(code, 1)
        self.assertIn("no activity types for CROP_SOWN", output)
        self.assertIsNone(service.strict)  # never tried to load


if __name__ == "__main__":
    unittest.main()
