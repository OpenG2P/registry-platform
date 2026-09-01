from sqlalchemy import create_engine

from .config import Settings

_config = Settings.get_config()


def _pool_kwargs(datasource: str) -> dict:
    if not datasource or datasource.startswith("sqlite"):
        return {}
    return {
        "pool_pre_ping": _config.db_pool_pre_ping,
        "pool_recycle": _config.db_pool_recycle,
        "pool_size": _config.db_pool_size,
        "max_overflow": _config.db_pool_max_overflow,
    }


class Engine:
    _engine = None

    def get_engine():
        if Engine._engine is None:
            try:
                Engine._engine = create_engine(
                    _config.db_datasource, **_pool_kwargs(_config.db_datasource)
                )
            except Exception as e:
                raise ValueError(f"Invalid DB datasource: {_config.db_datasource} | ERROR: {e}")
        return Engine._engine
