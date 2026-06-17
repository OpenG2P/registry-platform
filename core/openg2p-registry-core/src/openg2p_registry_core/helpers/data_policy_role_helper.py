"""
Keycloak data-policy roles use the DP_ prefix (tactical 1.2.0).

Functional roles are resolved by ResolvePermissionMiddleware; DP_ roles are handled by
DataPolicyMiddleware and Registry policy lookup.
"""

DATA_POLICY_ROLE_PREFIX = "DP_"


def data_policy_role_name(policy_mnemonic: str) -> str:
    """Build Keycloak client role name for a policy mnemonic (e.g. policy-1 -> DP_policy-1)."""
    name = str(policy_mnemonic).strip()
    if not name:
        raise ValueError("policy_mnemonic is required")
    if is_data_policy_role(name):
        return name
    return f"{DATA_POLICY_ROLE_PREFIX}{name}"


def is_data_policy_role(role: str) -> bool:
    return str(role).strip().upper().startswith(DATA_POLICY_ROLE_PREFIX)


def split_functional_and_data_policy_roles(
    roles: list[str] | None,
) -> tuple[list[str], list[str]]:
    """Partition client roles into functional vs data-policy (DP_ prefixed)."""
    if not roles:
        return [], []

    functional_roles: list[str] = []
    data_policy_roles: list[str] = []
    for role in roles:
        role_name = str(role).strip()
        if not role_name:
            continue
        if is_data_policy_role(role_name):
            data_policy_roles.append(role_name)
        else:
            functional_roles.append(role_name)
    return functional_roles, data_policy_roles


def data_policy_mnemonic_from_role(role: str) -> str:
    """Map DP_policy-1 -> policy-1 (prefix match is case-insensitive)."""
    role_name = str(role).strip()
    prefix_len = len(DATA_POLICY_ROLE_PREFIX)
    if role_name.upper().startswith(DATA_POLICY_ROLE_PREFIX):
        return role_name[prefix_len:].strip()
    return role_name


def extract_data_policy_mnemonics_from_roles(roles: list[str] | None) -> list[str]:
    """Return unique policy mnemonics from DP_ prefixed roles."""
    if not roles:
        return []

    mnemonics: list[str] = []
    seen: set[str] = set()
    for role in roles:
        if not is_data_policy_role(role):
            continue
        mnemonic = data_policy_mnemonic_from_role(role)
        if mnemonic and mnemonic not in seen:
            seen.add(mnemonic)
            mnemonics.append(mnemonic)
    return mnemonics
