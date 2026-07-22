from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)


class G2PSchemaIndividualLand:

    land_access: Optional[bool] = None
    land_size: Optional[float] = None
    productive_assets: Optional[list] = None


class G2PRegisterSchemaIndividualLand(G2PRegisterBaseSchema, G2PSchemaIndividualLand):
    """
    Schema for IndividualLand register.
    link_internal_record_id -> Individual.internal_record_id
    """


class G2PRegisterHistorySchemaIndividualLand(G2PRegisterHistorySchema):
    """
    Schema for IndividualLand history.
    """


class G2PIntakeFormSchemaIndividualLand(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaIndividualLand
):
    """
    Schema for IndividualLand intake form.
    """
