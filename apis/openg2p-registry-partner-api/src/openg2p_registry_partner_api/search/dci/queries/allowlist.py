"""One gate for every column name a DCI query or sort may mention."""

from openg2p_registry_core.errors import G2PRegistryException

from ..schemas import DciSearchStatusReasonCode


class AllowedSearchFields:
    def __init__(self, names: list[str] | set[str]):
        self._names = frozenset(names)

    def require(self, field: str) -> str:
        if field not in self._names:
            raise G2PRegistryException(
                code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
                message=f"Field '{field}' is not searchable.",
            )
        return field

    def as_set(self) -> set[str]:
        return set(self._names)
