import sys
import types
from pathlib import Path

import openg2p_registry_reference_extension as _reference_extension
import openg2p_registry_reference_extension.config as _reference_config

sys.modules.setdefault("openg2p_registry_extensions", _reference_extension)
sys.modules.setdefault("openg2p_registry_extensions.config", _reference_config)

# Parent packages stay as path packages here so this file can import the
# query decoders without executing search/__init__.py, which loads the
# controller.
_partner_root = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_partner_api"


def _path_package(name: str, path: Path) -> None:
    if name in sys.modules:
        return
    module = types.ModuleType(name)
    module.__path__ = [str(path)]
    module.__package__ = name
    sys.modules[name] = module


_path_package("openg2p_registry_partner_api", _partner_root)
_path_package("openg2p_registry_partner_api.search", _partner_root / "search")
_path_package("openg2p_registry_partner_api.search.dci", _partner_root / "search" / "dci")

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.search.query import ColumnPredicate, CompareOp, SearchClause

from openg2p_registry_partner_api.search.dci.queries import AllowedSearchFields, decode_dci_search
from openg2p_registry_partner_api.search.dci.schemas import (
    DciPagination,
    DciSearchCriteria,
    DciSortItem,
)

ALLOWED = AllowedSearchFields([
    "functional_record_id",
    "first_name",
    "birth_date",
    "foundational_id",
    "gender",
    "search_text",
    "record_status",
])
ID_COLUMNS = {"UIN": "foundational_id", "FUNCTIONAL_ID": "functional_record_id"}


def _criteria(query_type, query, sort=None):
    return DciSearchCriteria(
        reg_type="Farmer",
        reg_record_type="spdci-extensions-dci:Farmer",
        query_type=query_type,
        query=query,
        sort=sort,
        pagination=DciPagination(page_size=5, page_number=2),
    )


def test_expression_and_keeps_every_allowed_field():
    search = decode_dci_search(
        _criteria(
            "expression",
            {
                "type": "ns:org:QueryType:expression",
                "value": {
                    "expression": {
                        "query": {
                            "$and": [
                                {"first_name": {"$startsWith": "A"}},
                                {"birth_date": {"$gte": "1990-01-01"}},
                            ]
                        }
                    }
                },
            },
        ),
        ALLOWED,
        ID_COLUMNS,
    )
    assert isinstance(search.clause, SearchClause)
    assert search.clause.kind == "and"
    assert {child.column for child in search.clause.children} == {"first_name", "birth_date"}
    assert search.page == 2
    assert search.page_size == 5


def test_sanity_search_text_equality_stays_a_column_predicate():
    search = decode_dci_search(
        _criteria(
            "expression",
            {
                "type": "expression",
                "value": {"expression": {"query": {"search_text": {"$eq": "abebe"}}}},
            },
        ),
        ALLOWED,
        ID_COLUMNS,
    )
    assert search.clause == ColumnPredicate("search_text", CompareOp.EQ, "abebe")


def test_idtype_value_uses_the_mapped_column():
    search = decode_dci_search(
        _criteria("idtype-value", {"type": "UIN", "value": "12314567890"}),
        ALLOWED,
        ID_COLUMNS,
    )
    assert search.clause == ColumnPredicate("foundational_id", CompareOp.EQ, "12314567890")


def test_legacy_idtype_value_shape_still_decodes():
    search = decode_dci_search(
        _criteria(
            "idtype-value",
            {"type": "idtype-value", "value": {"id_type": "uin", "id_value": "999"}},
        ),
        ALLOWED,
        ID_COLUMNS,
    )
    assert search.clause.column == "foundational_id"
    assert search.clause.value == "999"


def test_predicate_combines_items_in_seq_order():
    search = decode_dci_search(
        _criteria(
            "predicate",
            [
                {
                    "seq_num": 2,
                    "expression1": {
                        "attribute_name": "gender",
                        "operator": "eq",
                        "attribute_value": "MALE",
                    },
                },
                {
                    "seq_num": 1,
                    "expression1": {
                        "attribute_name": "first_name",
                        "operator": "eq",
                        "attribute_value": "Abebe",
                    },
                    "condition": "and",
                    "expression2": {
                        "attribute_name": "birth_date",
                        "operator": "ge",
                        "attribute_value": "1990-01-01",
                    },
                },
            ],
        ),
        ALLOWED,
        ID_COLUMNS,
    )
    assert search.clause.children[0].kind == "and"
    assert search.clause.children[0].children[0].column == "first_name"
    assert search.clause.children[1].column == "gender"


def test_graphql_identifier_sample_maps_like_idtype_value():
    document = """
    query GetMemberByIdentifier {
      member(identifier: { value: "1", type: "uin" }) {
        demographic_info { name }
      }
    }
    """
    search = decode_dci_search(
        _criteria(
            "expression",
            {"type": "ns:org:QueryType:graphql", "value": {"expression": document}},
        ),
        ALLOWED,
        ID_COLUMNS,
    )
    assert search.clause == ColumnPredicate("foundational_id", CompareOp.EQ, "1")


def test_unknown_field_raises_the_dci_rejection_code():
    try:
        decode_dci_search(
            _criteria(
                "expression",
                {
                    "type": "expression",
                    "value": {"expression": {"query": {"salary": {"$eq": "1"}}}},
                },
                sort=[DciSortItem(attribute_name="first_name", sort_order="asc")],
            ),
            ALLOWED,
            ID_COLUMNS,
        )
    except G2PRegistryException as exc:
        assert exc.code == "rjct.search_criteria.invalid"
        assert "salary" in exc.message
    else:
        raise AssertionError("expected a rejection")


def test_unknown_sort_field_is_rejected():
    try:
        decode_dci_search(
            _criteria(
                "expression",
                {
                    "type": "expression",
                    "value": {"expression": {"query": {"first_name": "A"}}},
                },
                sort=[DciSortItem(attribute_name="salary", sort_order="desc")],
            ),
            ALLOWED,
            ID_COLUMNS,
        )
    except G2PRegistryException as exc:
        assert exc.code == "rjct.search_criteria.invalid"
        assert "salary" in exc.message
    else:
        raise AssertionError("expected a rejection")
