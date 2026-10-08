"""Standard-agnostic register search.

Decoders (DCI, and later other partner standards) produce these objects.
They carry column names and operators only — no wire-format details.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any, Literal, Union


class CompareOp(enum.Enum):
    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NIN = "nin"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"


@dataclass
class ColumnPredicate:
    column: str
    op: CompareOp
    value: Any


@dataclass
class SearchClause:
    """Boolean combination of predicates or nested clauses.

    ``and`` and ``or`` take one or more children. ``not`` takes exactly one.
    """

    kind: Literal["and", "or", "not"]
    children: list[ClauseNode]


ClauseNode = Union[ColumnPredicate, SearchClause]


@dataclass
class SortKey:
    column: str
    direction: Literal["asc", "desc"] = "asc"


@dataclass
class RegisterSearch:
    """One paged search against a single register mnemonic.

    The clause filters that register only. Related registers are loaded
    afterwards from the register graph, not from this clause.
    """

    register_mnemonic: str
    clause: ClauseNode
    page: int = 1
    page_size: int = 10
    sort: list[SortKey] = field(default_factory=list)


@dataclass
class RegisterSearchPage:
    records: list[dict]
    total_count: int
    page: int
    page_size: int


def iter_predicates(node: ClauseNode):
    if isinstance(node, ColumnPredicate):
        yield node
        return
    for child in node.children:
        yield from iter_predicates(child)


def mentions_column(node: ClauseNode, column: str) -> bool:
    return any(predicate.column == column for predicate in iter_predicates(node))
