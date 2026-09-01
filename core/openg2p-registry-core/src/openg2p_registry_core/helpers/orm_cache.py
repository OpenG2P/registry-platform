"""ORM serialization and fastapi_cache key helpers for static schema caching."""

import hashlib
import inspect
import json


def orm_row_to_dict(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def dict_to_orm(model_cls, data: dict):
    obj = model_cls()
    for key, value in data.items():
        setattr(obj, key, value)
    return obj


def _func_name(func) -> str:
    return getattr(func, "__qualname__", getattr(func, "__name__", "unknown"))


def _call_arg(func, kwargs: dict, index: int):
    """Resolve Nth param after self from positional args or keyword args."""
    call_args = kwargs.get("args") or ()
    call_kwargs = kwargs.get("kwargs") or {}
    positional_index = index + 1  # skip self
    if len(call_args) > positional_index:
        return call_args[positional_index]

    params = [
        name
        for name, param in inspect.signature(func).parameters.items()
        if name != "self" and param.kind in (
            inspect.Parameter.POSITIONAL_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        )
    ]
    if index >= len(params):
        raise IndexError(f"Cannot build cache key: missing arg index {index} for { _func_name(func) }")
    name = params[index]
    if name not in call_kwargs:
        raise KeyError(f"Cannot build cache key: missing kwarg '{name}' for {_func_name(func)}")
    return call_kwargs[name]


def single_id_key_builder(func, namespace: str, *args, **kwargs):
    """Unique key from first id arg (after self); ignores session. Includes func name."""
    entity_id = _call_arg(func, kwargs, 0)
    return f"{namespace}:{_func_name(func)}:{entity_id}"


def optional_id_key_builder(func, namespace: str, *args, **kwargs):
    """Key from first optional id arg (after self); None/missing → 'all'. Ignores session."""
    try:
        entity_id = _call_arg(func, kwargs, 0)
    except (IndexError, KeyError):
        entity_id = None
    return f"{namespace}:{_func_name(func)}:{entity_id if entity_id is not None else 'all'}"


def pair_id_key_builder(func, namespace: str, *args, **kwargs):
    """Unique key from first two id args (after self); ignores session. Includes func name."""
    first = _call_arg(func, kwargs, 0)
    second = _call_arg(func, kwargs, 1)
    return f"{namespace}:{_func_name(func)}:{first}:{second}"


def data_policies_key_builder(func, namespace: str, *args, **kwargs):
    """
    Shared key for methods keyed only by data_policies fingerprint.
    Same policies → shared across users; different policies → separate entries.
    """
    try:
        policies = _call_arg(func, kwargs, 0)
    except (IndexError, KeyError):
        policies = None
    raw = json.dumps(policies if policies is not None else [], sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{namespace}:{_func_name(func)}:{digest}"


def policy_lookup_key_builder(func, namespace: str, *args, **kwargs):
    """Unique key from (register_id, policy_type, section_id, intake_form_id); ignores session."""
    call_kwargs = kwargs.get("kwargs") or {}
    register_id = call_kwargs.get("register_id")
    policy_type = call_kwargs.get("policy_type")
    section_id = call_kwargs.get("section_id")
    intake_form_id = call_kwargs.get("intake_form_id")
    return (
        f"{namespace}:{_func_name(func)}:"
        f"{register_id}:{policy_type}:{section_id}:{intake_form_id}"
    )
