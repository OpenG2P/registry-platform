from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm
from sqlalchemy import String, select
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from ..services import G2PRegisterDomainServiceIndividualLivestock
from .enums import LivestockCountBandEnum, LivestockSpeciesEnum


class G2PIndividualLivestock:

    livestock_species: Mapped[LivestockSpeciesEnum] = mapped_column(String, nullable=True)
    livestock_counts: Mapped[LivestockCountBandEnum] = mapped_column(String, nullable=True)


class G2PRegisterIndividualLivestock(G2PRegister, G2PIndividualLivestock):
    __tablename__ = "g2p_register_individual_livestock"

    def get_search_text_fields(self) -> str:
        """Return individual livestock fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLivestock().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual livestock record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLivestock().construct_record_name(self.to_dict())


class G2PRegisterHistoryIndividualLivestock(G2PRegisterHistory, G2PIndividualLivestock):
    __tablename__ = "g2p_register_history_individual_livestock"


class G2PIntakeFormIndividualLivestock(G2PIntakeForm, G2PRegister, G2PIndividualLivestock):
    __tablename__ = "g2p_intake_form_individual_livestock"

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
        """Return individual livestock fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualLivestock().construct_search_text(self.to_dict())

    def get_record_name_fields(self) -> str:
        """Return individual livestock record_name from domain service implementation."""
        return G2PRegisterDomainServiceIndividualLivestock().construct_intake_record_name(self.to_dict())
