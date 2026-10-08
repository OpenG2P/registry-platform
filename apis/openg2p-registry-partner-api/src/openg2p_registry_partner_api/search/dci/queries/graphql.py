"""Closed GraphQL subset for DCI ``graphql`` queries.

Accepts one root field, an ``identifier { type, value }`` argument, and scalar
field arguments. The selection set is ignored: the outbound template shapes
the record. Mutations, fragments, and nested filters are rejected.
"""

import re
from typing import Any

from openg2p_registry_core.search.query import ClauseNode

from .allowlist import AllowedSearchFields
from .common import GRAPHQL_OPERATORS, combine, field_predicates, invalid, resolve_identifier


def decode_graphql(query: Any, allowed: AllowedSearchFields, id_type_columns: dict[str, str]) -> ClauseNode:
    document = _document(query)
    arguments = GraphQLSubset.parse(document)
    children = []
    for name, value in arguments:
        if name == "identifier":
            if not isinstance(value, dict):
                invalid("identifier must be { type, value }.")
            children.append(
                resolve_identifier(value.get("type"), value.get("value"), allowed, id_type_columns)
            )
            continue
        if "." in name:
            invalid(f"Field '{name}' is not a column on this register.")
        children.extend(field_predicates(name, value, allowed, GRAPHQL_OPERATORS))
    if not children:
        invalid("A graphql query must filter on identifier or a field.")
    return combine("and", children)


def _document(query: Any) -> str:
    if not isinstance(query, dict):
        invalid("A graphql query must be an object.")
    value = query.get("value", query)
    expression = value.get("expression") if isinstance(value, dict) else None
    if isinstance(expression, dict):
        expression = expression.get("query") or expression.get("expression")
    if not isinstance(expression, str) or not expression.strip():
        invalid("graphql expression must be a query string.")
    return expression.strip()


class GraphQLSubset:
    """Recursive-descent parser for the one-field subset described above."""

    def __init__(self, source: str):
        self.source = source
        self.index = 0

    @classmethod
    def parse(cls, source: str) -> list[tuple[str, Any]]:
        if re.search(r"\b(mutation|subscription|fragment)\b", source, re.IGNORECASE):
            invalid("Only a single graphql query field is supported.")
        if "..." in source or "@" in source:
            invalid("GraphQL fragments and directives are not supported.")
        parser = cls(source)
        parser._skip()
        if parser._keyword("query"):
            parser._skip()
            if parser._peek().isalpha() or parser._peek() == "_":
                parser._name()
            parser._skip()
        parser._eat("{")
        name = parser._name()
        arguments = parser._arguments() if parser._peek() == "(" else []
        if parser._peek() == "{":
            parser._skip_selection()
        parser._eat("}")
        parser._skip()
        if parser.index < len(parser.source):
            invalid("Only one root graphql field is supported.")
        if not name:
            invalid("A graphql query needs a root field.")
        return arguments

    def _arguments(self) -> list[tuple[str, Any]]:
        self._eat("(")
        arguments = []
        while self._peek() not in {")", ""}:
            name = self._name()
            self._eat(":")
            arguments.append((name, self._value()))
            self._skip()
        self._eat(")")
        return arguments

    def _value(self) -> Any:
        self._skip()
        char = self._peek()
        if char == '"':
            return self._string()
        if char == "{":
            return self._object()
        if char == "[":
            return self._list()
        if char == "-" or char.isdigit():
            return self._number()
        name = self._name()
        if name == "true":
            return True
        if name == "false":
            return False
        if name == "null":
            return None
        return name

    def _object(self) -> dict:
        self._eat("{")
        body = {}
        while self._peek() not in {"}", ""}:
            key = self._name()
            self._eat(":")
            body[key] = self._value()
            self._skip()
        self._eat("}")
        return body

    def _list(self) -> list:
        self._eat("[")
        values = []
        while self._peek() not in {"]", ""}:
            values.append(self._value())
            self._skip()
        self._eat("]")
        return values

    def _string(self) -> str:
        self._eat('"')
        chars = []
        while self.index < len(self.source) and self.source[self.index] != '"':
            if self.source[self.index] == "\\":
                self.index += 1
                if self.index >= len(self.source):
                    invalid("Unterminated string in graphql query.")
            chars.append(self.source[self.index])
            self.index += 1
        self._eat('"')
        return "".join(chars)

    def _number(self) -> int | float:
        start = self.index
        if self.source[self.index] == "-":
            self.index += 1
        while self.index < len(self.source) and (self.source[self.index].isdigit() or self.source[self.index] == "."):
            self.index += 1
        text = self.source[start:self.index]
        return float(text) if "." in text else int(text)

    def _at_boundary(self, index: int) -> bool:
        if index >= len(self.source):
            return True
        char = self.source[index]
        return not (char.isalnum() or char == "_")

    def _name(self) -> str:
        self._skip()
        start = self.index
        while self.index < len(self.source) and (self.source[self.index].isalnum() or self.source[self.index] == "_"):
            self.index += 1
        if start == self.index:
            invalid("Expected a name in the graphql query.")
        return self.source[start:self.index]

    def _keyword(self, word: str) -> bool:
        self._skip()
        end = self.index + len(word)
        if self.source[self.index:end] == word and self._at_boundary(end):
            self.index = end
            return True
        return False

    def _skip_selection(self) -> None:
        self._eat("{")
        depth = 1
        while self.index < len(self.source) and depth:
            if self.source[self.index] == "{":
                depth += 1
            elif self.source[self.index] == "}":
                depth -= 1
            self.index += 1
        if depth:
            invalid("Unbalanced braces in graphql selection set.")

    def _eat(self, char: str) -> None:
        if self._peek() != char:
            invalid(f"Expected '{char}' in graphql query.")
        self.index += 1

    def _peek(self) -> str:
        self._skip()
        if self.index >= len(self.source):
            return ""
        return self.source[self.index]

    def _skip(self) -> None:
        while self.index < len(self.source) and self.source[self.index] in " \n\t\r,":
            self.index += 1
