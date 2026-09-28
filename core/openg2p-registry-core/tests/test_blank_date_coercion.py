from datetime import date, datetime
from typing import Optional

import pytest
from pydantic import ValidationError

from openg2p_registry_core.schemas.g2p_register import G2PRegisterBaseSchema
from openg2p_registry_core.schemas.g2p_register_history import G2PRegisterHistorySchema


class _ProgramSchema(G2PRegisterBaseSchema):
    program_start_date: Optional[date] = None
    program_exit_date: Optional[date] = None


class _ProgramHistorySchema(G2PRegisterHistorySchema):
    program_exit_date: Optional[date] = None


def test_blank_date_strings_become_none_on_register_schema():
    schema = _ProgramSchema(
        program_exit_date="",
        program_start_date="  ",
        created_at="",
        record_name="",
    )
    assert schema.program_exit_date is None
    assert schema.program_start_date is None
    assert schema.created_at is None
    assert schema.record_name == ""


def test_blank_date_strings_become_none_on_history_schema():
    schema = _ProgramHistorySchema(program_exit_date="", approved_at="")
    assert schema.program_exit_date is None
    assert schema.approved_at is None


def test_real_date_values_still_parse():
    schema = _ProgramSchema(
        program_start_date="2024-01-02",
        created_at="2024-01-02T03:04:05",
    )
    assert schema.program_start_date == date(2024, 1, 2)
    assert schema.created_at == datetime(2024, 1, 2, 3, 4, 5)


def test_invalid_date_string_still_fails():
    with pytest.raises(ValidationError):
        _ProgramSchema(program_exit_date="not-a-date")
