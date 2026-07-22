from datetime import date
from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import ShockTypeEnum


class G2PSchemaIndividualShock:

    shock_type: Optional[ShockTypeEnum] = None
    shock_date: Optional[date] = None
    shock_period: Optional[str] = None
    coping_strategy: Optional[str] = None


class G2PRegisterSchemaIndividualShock(G2PRegisterBaseSchema, G2PSchemaIndividualShock):
    """
    Schema for IndividualShock register.
    link_internal_record_id -> Individual.internal_record_id
    """


class G2PRegisterHistorySchemaIndividualShock(G2PRegisterHistorySchema):
    """
    Schema for IndividualShock history.
    """


class G2PIntakeFormSchemaIndividualShock(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaIndividualShock
):
    """
    Schema for IndividualShock intake form.
    """
