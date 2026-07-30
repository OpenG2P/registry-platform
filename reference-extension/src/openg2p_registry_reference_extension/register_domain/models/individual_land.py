from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import JSON, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceIndividualLand

class G2PIndividualLand:

    land_access: Mapped[bool] = mapped_column(Boolean, nullable=True)
    land_size: Mapped[float] = mapped_column(Numeric, nullable=True)
    productive_assets: Mapped[list] = mapped_column(JSON, nullable=True)

class G2PRegisterIndividualLand(G2PRegister, G2PIndividualLand):
    __tablename__ = "g2p_register_individual_land"

    def get_search_text_fields(self) -> str:
        """Return individual land fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLand().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual land record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLand().construct_record_name(self.to_dict())

class G2PRegisterHistoryIndividualLand(G2PRegisterHistory, G2PIndividualLand):
    __tablename__ = "g2p_register_history_individual_land"

class G2PIntakeFormIndividualLand(G2PIntakeForm, G2PRegister, G2PIndividualLand):
    __tablename__ = "g2p_intake_form_individual_land"

    def get_search_text_fields(self) -> str:
        """Return individual land fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLand().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual land record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLand().construct_intake_record_name(self.to_dict())
