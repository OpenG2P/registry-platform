from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import AssetTypeEnum


class G2PSchemaHouseholdAsset:

    asset_type: Optional[AssetTypeEnum] = None
    asset_category: Optional[str] = None
    quantity: Optional[int] = None
    size_value: Optional[float] = None
    size_unit: Optional[str] = None
    size_band: Optional[str] = None
    details: Optional[dict] = None


class G2PRegisterSchemaHouseholdAsset(G2PRegisterBaseSchema, G2PSchemaHouseholdAsset):
    """
    Schema for HouseholdAsset register.
    link_internal_record_id -> Household.internal_record_id
    """


class G2PRegisterHistorySchemaHouseholdAsset(G2PRegisterHistorySchema):
    """
    Schema for HouseholdAsset history.
    """


class G2PIntakeFormSchemaHouseholdAsset(
    G2PIntakeFormSchemaBase, G2PRegisterBaseSchema, G2PSchemaHouseholdAsset
):
    """
    Schema for HouseholdAsset intake form.
    """
