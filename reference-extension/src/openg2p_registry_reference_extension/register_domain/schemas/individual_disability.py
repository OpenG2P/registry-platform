from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import DisabilityDomainEnum, DisabilitySeverityEnum


class G2PSchemaIndividualDisability:

    disability_domain: Optional[DisabilityDomainEnum] = None
    disability_severity: Optional[DisabilitySeverityEnum] = None


class G2PRegisterSchemaIndividualDisability(G2PRegisterBaseSchema, G2PSchemaIndividualDisability):
    """
    Schema for IndividualDisability register.
    link_internal_record_id -> Individual.internal_record_id
    """


class G2PRegisterHistorySchemaIndividualDisability(G2PRegisterHistorySchema):
    """
    Schema for IndividualDisability history.
    """


class G2PIntakeFormSchemaIndividualDisability(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaIndividualDisability
):
    """
    Schema for IndividualDisability intake form.
    """
