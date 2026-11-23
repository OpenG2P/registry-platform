import sys

from .config import Settings

_config = Settings.get_config()


def task_enabled() -> bool:
    """True unless this worker was turned off.

    The caller must be the worker task function. The setting name is
    ``<function>_enabled``. A disabled task returns without touching the row.
    """
    name = sys._getframe(1).f_code.co_name
    return bool(getattr(_config, f"{name}_enabled", True))
