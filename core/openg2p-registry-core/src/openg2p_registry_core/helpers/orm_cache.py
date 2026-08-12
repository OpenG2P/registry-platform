"""ORM serialization and fastapi_cache key helpers for static schema caching."""


def orm_row_to_dict(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def dict_to_orm(model_cls, data: dict):
    obj = model_cls()
    for key, value in data.items():
        setattr(obj, key, value)
    return obj


def _func_name(func) -> str:
    return getattr(func, "__qualname__", getattr(func, "__name__", "unknown"))


def single_id_key_builder(func, namespace: str, *args, **kwargs):
    """Unique key from args[1] (after self); ignores session. Includes func name."""
    call_args = kwargs.get("args") or ()
    return f"{namespace}:{_func_name(func)}:{call_args[1]}"


def pair_id_key_builder(func, namespace: str, *args, **kwargs):
    """Unique key from args[1] + args[2] (after self); ignores session. Includes func name."""
    call_args = kwargs.get("args") or ()
    return f"{namespace}:{_func_name(func)}:{call_args[1]}:{call_args[2]}"
