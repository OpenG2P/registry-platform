from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceHouseholdHousingAndServices
from .enums import (
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

class G2PHouseholdHousingAndServices:

    dwelling_type: Mapped[DwellingTypeEnum] = mapped_column(String, nullable=True)
    roof_material: Mapped[RoofMaterialEnum] = mapped_column(String, nullable=True)
    wall_material: Mapped[WallMaterialEnum] = mapped_column(String, nullable=True)
    floor_material: Mapped[FloorMaterialEnum] = mapped_column(String, nullable=True)
    tenure_status: Mapped[TenureStatusEnum] = mapped_column(String, nullable=True)
    water_source_type: Mapped[WaterSourceTypeEnum] = mapped_column(String, nullable=True)
    water_distance_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    sanitation_type: Mapped[SanitationTypeEnum] = mapped_column(String, nullable=True)
    lighting_source: Mapped[LightingSourceEnum] = mapped_column(String, nullable=True)
    cooking_fuel_type: Mapped[CookingFuelEnum] = mapped_column(String, nullable=True)

class G2PRegisterHouseholdHousingAndServices(G2PRegister, G2PHouseholdHousingAndServices):
    __tablename__ = "g2p_register_household_housing_and_services"

    def get_search_text_fields(self) -> str:
        """Return household housing and services fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdHousingAndServices().construct_search_text(
            self.to_dict()
        )

    def get_record_name_fields(self) -> str:
        """Return household housing and services record_name from domain service implementation."""
        return G2PRegisterDomainServiceHouseholdHousingAndServices().construct_record_name(
            self.to_dict()
        )

class G2PRegisterHistoryHouseholdHousingAndServices(
    G2PRegisterHistory, G2PHouseholdHousingAndServices
):
    __tablename__ = "g2p_register_history_household_housing_and_services"

class G2PIntakeFormHouseholdHousingAndServices(
    G2PIntakeForm, G2PRegister, G2PHouseholdHousingAndServices
):
    __tablename__ = "g2p_intake_form_household_housing_and_services"

    def get_search_text_fields(self) -> str:
        """Return household housing and services fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdHousingAndServices().construct_search_text(
            self.to_dict()
        )

    def get_record_name_fields(self) -> str:
        """Return household housing and services record_name from domain service implementation."""
        return G2PRegisterDomainServiceHouseholdHousingAndServices().construct_intake_record_name(
            self.to_dict()
        )
