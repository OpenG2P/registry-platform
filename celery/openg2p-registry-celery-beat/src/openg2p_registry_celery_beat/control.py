import sys

from .config import Settings

_config = Settings.get_config()


def task_enabled() -> bool:
    """True unless this producer was turned off.

    The caller must be the beat producer function. The setting name is
    ``<function>_enabled``.
    """
    name = sys._getframe(1).f_code.co_name
    return bool(getattr(_config, f"{name}_enabled", True))


def task_limit() -> int:
    """How many rows this producer claims per tick.

    ``<function>_no_of_tasks`` overrides the shared ``no_of_tasks_to_process``.
    """
    name = sys._getframe(1).f_code.co_name
    specific = getattr(_config, f"{name}_no_of_tasks", None)
    if specific is None:
        return _config.no_of_tasks_to_process
    return int(specific)
