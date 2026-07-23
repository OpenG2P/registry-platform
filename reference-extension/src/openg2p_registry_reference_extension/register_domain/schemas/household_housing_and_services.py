from typing import Optional

from openg2p_registry_core.schemas import (
    G2PRegisterBaseSchema,
    G2PRegisterHistorySchema,
    G2PIntakeFormSchemaBase,
)
from ..models.enums import (
    CookingFuelEnum,
    DwellingTypeEnum,
    FloorMaterialEnum,
    LightingSourceEnum,
    RoofMaterialEnum,
    SanitationTypeEnum,
    TenureStatusEnum,
    WallMaterialEnum,
    WaterSourceTypeEnum,
)


class G2PSchemaHouseholdHousingAndServices:

    dwelling_type: Optional[DwellingTypeEnum] = None
    roof_material: Optional[RoofMaterialEnum] = None
    wall_material: Optional[WallMaterialEnum] = None
    floor_material: Optional[FloorMaterialEnum] = None
    tenure_status: Optional[TenureStatusEnum] = None
    water_source_type: Optional[WaterSourceTypeEnum] = None
    water_distance_minutes: Optional[int] = None
    sanitation_type: Optional[SanitationTypeEnum] = None
    lighting_source: Optional[LightingSourceEnum] = None
    cooking_fuel_type: Optional[CookingFuelEnum] = None


class G2PRegisterSchemaHouseholdHousingAndServices(
    G2PRegisterBaseSchema, G2PSchemaHouseholdHousingAndServices
):
    """
    Schema for HouseholdHousingAndServices register.
    link_internal_record_id -> Household.internal_record_id
    """


class G2PRegisterHistorySchemaHouseholdHousingAndServices(G2PRegisterHistorySchema):
    """
    Schema for HouseholdHousingAndServices history.
    """


class G2PIntakeFormSchemaHouseholdHousingAndServices(
    G2PIntakeFormSchemaBase,
    G2PRegisterBaseSchema,
    G2PSchemaHouseholdHousingAndServices,
):
    """
    Schema for HouseholdHousingAndServices intake form.
    """
