import threading
import time


class TimestampSeededSubmissionReferenceGenerator:
    """
    Simple timestamp-seeded generator.
    Format: (unix_timestamp_ms * 1000) + sequence_in_that_ms.
    """

    MAX_SEQUENCE = 999

    def __init__(self):
        self._lock = threading.Lock()
        self._last_timestamp_ms = -1
        self._sequence = 0

    def next_id(self) -> int:
        with self._lock:
            timestamp_ms = self._current_timestamp_ms()

            if timestamp_ms == self._last_timestamp_ms:
                self._sequence += 1
                if self._sequence > self.MAX_SEQUENCE:
                    timestamp_ms = self._wait_next_millisecond(self._last_timestamp_ms)
                    self._sequence = 0
            else:
                self._sequence = 0

            self._last_timestamp_ms = timestamp_ms
            return (timestamp_ms * 1000) + self._sequence

    def _wait_next_millisecond(self, last_timestamp_ms: int) -> int:
        timestamp_ms = self._current_timestamp_ms()
        while timestamp_ms <= last_timestamp_ms:
            time.sleep(0.0001)
            timestamp_ms = self._current_timestamp_ms()
        return timestamp_ms

    @staticmethod
    def _current_timestamp_ms() -> int:
        return int(time.time() * 1000)


submission_reference_generator = TimestampSeededSubmissionReferenceGenerator()
