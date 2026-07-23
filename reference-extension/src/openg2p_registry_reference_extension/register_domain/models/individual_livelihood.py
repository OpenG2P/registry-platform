from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import Integer, String, select
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceIndividualLivelihood
from .enums import EmploymentStatusEnum, LivelihoodEnum, MobilePhoneTypeEnum


class G2PIndividualLivelihood:

    primary_livelihood: Mapped[LivelihoodEnum] = mapped_column(String, nullable=True)
    secondary_livelihood: Mapped[LivelihoodEnum] = mapped_column(String, nullable=True)
    employment_status: Mapped[EmploymentStatusEnum] = mapped_column(String, nullable=True)
    coping_strategies_index: Mapped[int] = mapped_column(Integer, nullable=True)
    mobile_phone_type: Mapped[MobilePhoneTypeEnum] = mapped_column(String, nullable=True)


class G2PRegisterIndividualLivelihood(G2PRegister, G2PIndividualLivelihood):
    __tablename__ = "g2p_register_individual_livelihoods"

    def get_search_text_fields(self) -> str:
        """Return individual livelihood fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLivelihood().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual livelihood record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLivelihood().construct_record_name(self.to_dict())


class G2PRegisterHistoryIndividualLivelihood(G2PRegisterHistory, G2PIndividualLivelihood):
    __tablename__ = "g2p_register_history_individual_livelihoods"


class G2PIntakeFormIndividualLivelihood(G2PIntakeForm, G2PRegister, G2PIndividualLivelihood):
    __tablename__ = "g2p_intake_form_individual_livelihoods"

    async def get_link_internal_record_id(self, session):
        from .individual import G2PIntakeFormIndividual

        result = await session.execute(
            select(G2PIntakeFormIndividual).where(
                G2PIntakeFormIndividual.submission_id == self.submission_id
            )
        )
        individual = result.scalars().first()
        if individual:
            self.link_internal_record_id = individual.internal_record_id

    def get_search_text_fields(self) -> str:
        """Return individual livelihood fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLivelihood().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual livelihood record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLivelihood().construct_intake_record_name(self.to_dict())
