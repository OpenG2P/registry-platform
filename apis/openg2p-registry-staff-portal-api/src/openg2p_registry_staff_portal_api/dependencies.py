"""FastAPI dependencies for record-level data policies."""

from fastapi import Request

from .data_policy_middleware import DATA_POLICY_MNEMONICS_STATE_KEY


def get_data_policy_mnemonics(request: Request) -> list[str]:
    return list(getattr(request.state, DATA_POLICY_MNEMONICS_STATE_KEY, []) or [])
