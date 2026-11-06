from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import Date, DateTime, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.search.compile import compile_search
from openg2p_registry_core.search.hierarchy import plan_register_loads, snake_case, stitch
from openg2p_registry_core.search.query import ColumnPredicate, CompareOp, RegisterSearch, SearchClause


class Base(DeclarativeBase):
    pass


class Farmer(Base):
    __tablename__ = "g2p_register_farmer"
    internal_record_id: Mapped[str] = mapped_column(String, primary_key=True)
    first_name: Mapped[str] = mapped_column(String)
    birth_date: Mapped[date] = mapped_column(Date)
    search_text: Mapped[str] = mapped_column(String)
    record_status: Mapped[str] = mapped_column(String)
    last_approved_at: Mapped[str] = mapped_column(DateTime, nullable=True)


ALLOWED = {"first_name", "birth_date", "search_text", "record_status", "internal_record_id"}


def _search(clause, sort=None):
    return RegisterSearch("Farmer", clause, sort=sort or [])


def _sql(search):
    conditions, _order = compile_search(Farmer, search, ALLOWED)
    statement = select(Farmer).where(*conditions)
    return str(statement.compile(compile_kwargs={"literal_binds": True}))


def test_expression_columns_and_active_default_are_in_the_filter():
    clause = SearchClause(
        "and",
        [
            ColumnPredicate("first_name", CompareOp.STARTS_WITH, "A"),
            ColumnPredicate("birth_date", CompareOp.GTE, "1990-01-01"),
        ],
    )
    sql = _sql(_search(clause))
    assert "first_name" in sql
    assert "1990-01-01" in sql
    assert "ACTIVE" in sql


def test_search_text_equality_is_a_substring_match():
    sql = _sql(_search(ColumnPredicate("search_text", CompareOp.EQ, "abebe")))
    assert "LIKE" in sql.upper()
    assert "%abebe%" in sql


def test_unknown_field_is_rejected_before_sql():
    with pytest.raises(G2PRegistryException, match="not searchable"):
        _sql(_search(ColumnPredicate("secret", CompareOp.EQ, "x")))


def test_wrong_value_type_is_rejected():
    with pytest.raises(G2PRegistryException, match="date"):
        _sql(_search(ColumnPredicate("birth_date", CompareOp.EQ, "not-a-date")))


def test_explicit_record_status_filter_replaces_the_default():
    sql = _sql(_search(ColumnPredicate("record_status", CompareOp.EQ, "INACTIVE")))
    assert "INACTIVE" in sql
    assert "= 'ACTIVE'" not in sql


def _defn(register_id, mnemonic, master=None):
    return SimpleNamespace(
        register_id=register_id,
        register_mnemonic=mnemonic,
        master_register_id=master,
    )


def test_load_plan_is_one_step_per_related_register():
    household = _defn("hh", "Household")
    farmer = _defn("fa", "Farmer", "hh")
    land = _defn("la", "Land", "fa")
    crop = _defn("cr", "Crop", "la")
    member = _defn("hm", "HouseholdMember", "hh")
    steps = plan_register_loads([household, farmer, land, crop, member], farmer)
    assert [(step.definition.register_mnemonic, step.direction) for step in steps] == [
        ("Land", "down"),
        ("Crop", "down"),
        ("Household", "up"),
        ("HouseholdMember", "down"),
    ]


def test_stitch_nests_children_and_parent_on_the_same_dicts():
    household = _defn("hh", "Household")
    farmer = _defn("fa", "Farmer", "hh")
    land = _defn("la", "Land", "fa")
    steps = plan_register_loads([household, farmer, land], farmer)
    dicts = {
        "fa": {
            "f1": {"internal_record_id": "f1", "first_name": "Abebe", "link_internal_record_id": "h1"},
        },
        "la": {
            "l1": {"internal_record_id": "l1", "link_internal_record_id": "f1", "area": 2},
        },
        "hh": {
            "h1": {"internal_record_id": "h1", "locality": "Ada"},
        },
    }
    records = stitch("fa", ["f1"], dicts, steps)
    assert records[0]["land"][0]["area"] == 2
    assert records[0]["household"]["locality"] == "Ada"
    assert "farmer" not in records[0]["household"]


def test_snake_case_matches_the_template_keys():
    assert snake_case("HouseholdMember") == "household_member"
    assert snake_case("Land") == "land"
