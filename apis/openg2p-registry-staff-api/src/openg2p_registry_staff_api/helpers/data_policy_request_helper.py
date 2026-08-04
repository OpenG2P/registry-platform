from fastapi import Request

from iam_core.user_auth.middleware.data_policy import (
    STATE_KEY_DATA_POLICY_MNEMONICS,
    STATE_KEY_DATA_POLICIES,
)


def get_data_policy_mnemonics(request: Request) -> list[str]:
    """Read the DP_ policy mnemonics extracted from the token by DataPolicyMiddleware."""
    return list(getattr(request.state, STATE_KEY_DATA_POLICY_MNEMONICS, []) or [])


def get_data_policies(request: Request) -> list[dict]:
    """Read the complete data policies retrieved from IAM by DataPolicyMiddleware."""
    return list(getattr(request.state, STATE_KEY_DATA_POLICIES, []) or [])
