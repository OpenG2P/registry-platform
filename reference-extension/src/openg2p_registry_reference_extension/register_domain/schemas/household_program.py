from typing import Optional
from datetime import date
from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import ProgramEnum


class G2PRegisterSchemaHouseholdProgram(G2PRegisterBaseSchema):
    program_name: Optional[ProgramEnum] = None
    program_start_date: Optional[date] = None
    program_exit_date: Optional[date] = None


class G2PIntakeFormSchemaHouseholdProgram(G2PIntakeFormSchemaBase, G2PRegisterSchemaHouseholdProgram):
    pass


class G2PRegisterHistorySchemaHouseholdProgram(G2PRegisterHistorySchema):
    program_name: Optional[ProgramEnum] = None
    program_start_date: Optional[date] = None
    program_exit_date: Optional[date] = None
