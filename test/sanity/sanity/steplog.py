"""Clean, timestamped step output for the e2e suite.

One line per stage, printed directly (pytest runs with -s so there is no capture
and no `live log setup/call` section headers). conftest wraps each test with a
titled banner + a RESULT footer, so `note()` is just the intermediate steps.
"""

import datetime


def _ts() -> str:
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]


def note(message: str) -> None:
    """Emit one intermediate step line inside a test's banner."""
    print(f"    {_ts()}  → {message}", flush=True)
