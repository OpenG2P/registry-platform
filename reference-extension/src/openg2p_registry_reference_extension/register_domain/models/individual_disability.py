from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceIndividualDisability
from .enums import DisabilityDomainEnum, DisabilitySeverityEnum

class G2PIndividualDisability:

    disability_domain: Mapped[DisabilityDomainEnum] = mapped_column(String, nullable=True, index=True)
    disability_severity: Mapped[DisabilitySeverityEnum] = mapped_column(String, nullable=True)

class G2PRegisterIndividualDisability(G2PRegister, G2PIndividualDisability):
    __tablename__ = "g2p_register_individual_disabilities"

    def get_search_text_fields(self) -> str:
        """Return individual disability fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualDisability().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual disability record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualDisability().construct_record_name(self.to_dict())

class G2PRegisterHistoryIndividualDisability(G2PRegisterHistory, G2PIndividualDisability):
    __tablename__ = "g2p_register_history_individual_disabilities"

class G2PIntakeFormIndividualDisability(G2PIntakeForm, G2PRegister, G2PIndividualDisability):
    __tablename__ = "g2p_intake_form_individual_disabilities"

    def get_search_text_fields(self) -> str:
        """Return individual disability fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualDisability().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual disability record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualDisability().construct_intake_record_name(self.to_dict())
