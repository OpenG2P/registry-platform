"""Load every activity register's sample activities now, and fail loudly if any cannot be.

    python -m openg2p_registry_celery_worker.load_activity_samples

Run by the chart's ``activity-samples`` hook Job (post-install/post-upgrade, after
db-seed) when the worker's ``activity_load_sample_data`` is on, so a broken demo
install fails instead of being reported as installed. It boots exactly as the
Celery worker does (same image, same env, same extension), waits — bounded by
``activity_samples_wait_seconds`` — until every activity register has its
activity types (db-seed loads them), then runs ``load_all(strict=True)``.

Exit 0 when every register's samples are loaded (or already were, or there are no
activity registers); 1 otherwise, with each register's error and a hint.

The beat task ``activity_sample_data_worker`` stays as an idempotent backstop; an
advisory lock per register keeps the two from loading the same samples at once.
"""

import asyncio
import re
import sys
import time

MASTER_DATA_HINT = (
    "a Master Data code list or geography is missing this value — check that Master Data "
    "loaded the lists this registry needs (e.g. masterData.geoSeed.domains)"
)
_MASTER_DATA_MISS = re.compile(r"not a known (code|location)|unknown (code|location)", re.IGNORECASE)


def hint_for(message: str) -> str | None:
    """A one-line hint for a register's failure, when the cause is recognisable."""
    return MASTER_DATA_HINT if _MASTER_DATA_MISS.search(message or "") else None


def report_success(loaded: dict[str, int], out=print) -> int:
    if not loaded:
        out("No activity registers: no sample activities to load.")
        return 0
    for mnemonic, count in loaded.items():
        out(f"{mnemonic}: {count} sample activities recorded" + ("" if count else " (already loaded or none)"))
    return 0


def report_failure(failures: dict[str, str], loaded: dict[str, int] | None = None, out=print) -> int:
    out(f"Sample activities could not be loaded for {len(failures)} register(s):")
    for mnemonic, message in failures.items():
        out(f"  {mnemonic}: {message}")
        hint = hint_for(message)
        if hint:
            out(f"    hint: {hint}")
    for mnemonic, count in (loaded or {}).items():
        out(f"  {mnemonic}: ok ({count} recorded)")
    return 1


async def wait_for_activity_types(service, timeout: float, interval: float, out=print, clock=time.monotonic,
                                  sleep=asyncio.sleep) -> list[str]:
    """Wait until no activity register is missing its activity types. Returns those still missing."""
    deadline = clock() + timeout
    while True:
        try:
            waiting = await service.registers_waiting_for_types()
        except Exception as e:  # tables not created yet, DB restarting, ...
            waiting = [f"(registry not readable yet: {e})"]
        if not waiting or clock() >= deadline:
            return waiting
        out(f"Waiting for activity types (db-seed) for: {', '.join(waiting)}")
        await sleep(interval)


async def run(service, timeout: float, interval: float, out=print) -> int:
    from openg2p_registry_core.services import G2PActivitySampleLoadError

    waiting = await wait_for_activity_types(service, timeout, interval, out=out)
    if waiting:
        out(f"Gave up after {int(timeout)}s: no activity types for {', '.join(waiting)}. "
            "Did db-seed run and load this registry's activity types?")
        return 1
    try:
        loaded = await service.load_all(strict=True)
    except G2PActivitySampleLoadError as e:
        return report_failure(e.failures, e.loaded, out=out)
    return report_success(loaded, out=out)


def main() -> int:
    # Boot as the worker does: main aliases the selected extension module and runs
    # the Initializer (components, Master Data client, factories).
    from . import main as _worker  # noqa: F401
    from openg2p_registry_core.services import G2PActivitySampleService

    from .config import Settings
    from .tasks.activity_worker import _run

    config = Settings.get_config()
    service = G2PActivitySampleService.get_component() or G2PActivitySampleService()
    return _run(lambda: run(service, config.activity_samples_wait_seconds, config.activity_samples_poll_seconds))


if __name__ == "__main__":
    sys.exit(main())
