from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import EmploymentStatusEnum, LivelihoodEnum, MobilePhoneTypeEnum


class G2PSchemaIndividualLivelihood:

    primary_livelihood: Optional[LivelihoodEnum] = None
    secondary_livelihood: Optional[LivelihoodEnum] = None
    employment_status: Optional[EmploymentStatusEnum] = None
    coping_strategies_index: Optional[int] = None
    mobile_phone_type: Optional[MobilePhoneTypeEnum] = None


class G2PRegisterSchemaIndividualLivelihood(G2PRegisterBaseSchema, G2PSchemaIndividualLivelihood):
    """
    Schema for IndividualLivelihood register (table `g2p_register_individual_livelihoods`).
    link_internal_record_id -> Individual.internal_record_id
    """


class G2PRegisterHistorySchemaIndividualLivelihood(G2PRegisterHistorySchema):
    """
    Schema for IndividualLivelihood history.
    """


class G2PIntakeFormSchemaIndividualLivelihood(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaIndividualLivelihood
):
    """
    Schema for IndividualLivelihood intake form.
    """
