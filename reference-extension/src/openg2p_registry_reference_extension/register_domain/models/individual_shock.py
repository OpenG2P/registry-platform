from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceIndividualShock
from .enums import ShockTypeEnum

class G2PIndividualShock:

    shock_type: Mapped[ShockTypeEnum] = mapped_column(String, nullable=True)
    shock_date: Mapped[Date] = mapped_column(Date, nullable=True, index=True)
    shock_period: Mapped[str] = mapped_column(String, nullable=True)
    coping_strategy: Mapped[str] = mapped_column(String, nullable=True)

class G2PRegisterIndividualShock(G2PRegister, G2PIndividualShock):
    __tablename__ = "g2p_register_individual_shocks"

    def get_search_text_fields(self) -> str:
        """Return individual shock fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualShock().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual shock record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualShock().construct_record_name(self.to_dict())

class G2PRegisterHistoryIndividualShock(G2PRegisterHistory, G2PIndividualShock):
    __tablename__ = "g2p_register_history_individual_shocks"

class G2PIntakeFormIndividualShock(G2PIntakeForm, G2PRegister, G2PIndividualShock):
    __tablename__ = "g2p_intake_form_individual_shocks"

    def get_search_text_fields(self) -> str:
        """Return individual shock fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualShock().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual shock record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualShock().construct_intake_record_name(self.to_dict())
