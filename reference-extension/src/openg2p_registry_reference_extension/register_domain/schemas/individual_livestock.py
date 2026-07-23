from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import LivestockCountBandEnum, LivestockSpeciesEnum


class G2PSchemaIndividualLivestock:

    livestock_species: Optional[LivestockSpeciesEnum] = None
    livestock_counts: Optional[LivestockCountBandEnum] = None


class G2PRegisterSchemaIndividualLivestock(G2PRegisterBaseSchema, G2PSchemaIndividualLivestock):
    """
    Schema for IndividualLivestock register.
    link_internal_record_id -> Individual.internal_record_id
    """


class G2PRegisterHistorySchemaIndividualLivestock(G2PRegisterHistorySchema):
    """
    Schema for IndividualLivestock history.
    """


class G2PIntakeFormSchemaIndividualLivestock(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaIndividualLivestock
):
    """
    Schema for IndividualLivestock intake form.
    """
