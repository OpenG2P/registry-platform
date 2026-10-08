"""Turn one DCI search_criteria into a RegisterSearch."""

from typing import Any, Union

from openg2p_registry_core.search.query import RegisterSearch, SortKey

from ..schemas import DciSearchCriteria
from .allowlist import AllowedSearchFields
from .common import invalid
from .expression import decode_expression
from .graphql import decode_graphql
from .idtype_value import decode_idtype_value
from .predicate import decode_predicate

QUERY_TYPES = {"idtype-value", "expression", "predicate", "graphql"}


def decode_dci_search(
    criteria: DciSearchCriteria,
    allowed: AllowedSearchFields,
    id_type_columns: dict[str, str],
) -> RegisterSearch:
    query_type = criteria.query_type
    query = _plain_query(criteria.query)
    if query_type not in QUERY_TYPES:
        invalid(
            f"Unsupported query_type '{query_type}'. "
            "Supported query types are: idtype-value, expression, predicate, graphql."
        )
    if query_type == "expression" and _looks_like_graphql(query):
        query_type = "graphql"

    if query_type == "idtype-value":
        clause = decode_idtype_value(query, allowed, id_type_columns)
    elif query_type == "predicate":
        clause = decode_predicate(query, allowed)
    elif query_type == "graphql":
        clause = decode_graphql(query, allowed, id_type_columns)
    else:
        clause = decode_expression(query, allowed)

    return RegisterSearch(
        register_mnemonic=criteria.reg_type,
        clause=clause,
        page=_page(criteria),
        page_size=_page_size(criteria),
        sort=_sort(criteria, allowed),
    )


def _plain_query(query: Any) -> Union[dict, list]:
    if hasattr(query, "model_dump"):
        return query.model_dump()
    return query


def _looks_like_graphql(query: Any) -> bool:
    if not isinstance(query, dict):
        return False
    query_type = str(query.get("type") or "")
    if query_type.endswith("QueryType:graphql") or query_type == "graphql":
        return True
    value = query.get("value")
    expression = value.get("expression") if isinstance(value, dict) else None
    return isinstance(expression, str) and "query " in expression


def _page(criteria: DciSearchCriteria) -> int:
    if criteria.pagination is None:
        return 1
    return criteria.pagination.page_number


def _page_size(criteria: DciSearchCriteria) -> int:
    if criteria.pagination is None:
        return 10
    return criteria.pagination.page_size


def _sort(criteria: DciSearchCriteria, allowed: AllowedSearchFields) -> list[SortKey]:
    keys = []
    for item in criteria.sort or []:
        allowed.require(item.attribute_name)
        keys.append(SortKey(item.attribute_name, item.sort_order))
    return keys
