from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import JSON, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceHouseholdAsset
from .enums import AssetTypeEnum

class G2PHouseholdAsset:

    asset_type: Mapped[AssetTypeEnum] = mapped_column(String, nullable=True)
    asset_category: Mapped[str] = mapped_column(String, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=True)
    size_value: Mapped[float] = mapped_column(Numeric, nullable=True)
    size_unit: Mapped[str] = mapped_column(String, nullable=True)
    size_band: Mapped[str] = mapped_column(String, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)

class G2PRegisterHouseholdAsset(G2PRegister, G2PHouseholdAsset):
    __tablename__ = "g2p_register_household_assets"

    def get_search_text_fields(self) -> str:
        """Return household asset fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdAsset().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return household asset record_name from domain service implementation."""
        return G2PRegisterDomainServiceHouseholdAsset().construct_record_name(self.to_dict())

class G2PRegisterHistoryHouseholdAsset(G2PRegisterHistory, G2PHouseholdAsset):
    __tablename__ = "g2p_register_history_household_assets"

class G2PIntakeFormHouseholdAsset(G2PIntakeForm, G2PRegister, G2PHouseholdAsset):
    __tablename__ = "g2p_intake_form_household_assets"

    def get_search_text_fields(self) -> str:
        """Return household asset fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdAsset().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return household asset record_name from domain service implementation."""
        return G2PRegisterDomainServiceHouseholdAsset().construct_intake_record_name(self.to_dict())
