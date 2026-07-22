from datetime import date

from sqlalchemy import Date, String, select
from sqlalchemy.orm import Mapped, mapped_column, Session

from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm

from ..services import G2PRegisterDomainServiceIndividualProgram
from .enums import ProgramEnum
from .individual import G2PIntakeFormIndividual


class G2PIndividualProgram:
    program_name: Mapped[ProgramEnum] = mapped_column(String, nullable=True)
    program_start_date: Mapped[date] = mapped_column(Date, nullable=True)
    program_exit_date: Mapped[date] = mapped_column(Date, nullable=True)


class G2PRegisterIndividualProgram(G2PRegister, G2PIndividualProgram):
    __tablename__ = "g2p_register_individual_programs"

    def get_record_name_fields(self) -> str:
        """Return individual programs fields used to build record_name."""
        return G2PRegisterDomainServiceIndividualProgram().construct_record_name(self.to_dict())

    def get_search_text_fields(self) -> str:
        """Return individual programs fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualProgram().construct_search_text(self.to_dict())


# All Intake Form classes should have the prefix G2PIntakeForm
class G2PIntakeFormIndividualProgram(G2PIntakeForm, G2PRegister, G2PIndividualProgram):
    __tablename__ = "g2p_intake_form_individual_programs"

    def get_record_name_fields(self) -> str:
        """Return individual programs fields used to build record_name."""
        return G2PRegisterDomainServiceIndividualProgram().construct_intake_record_name(self.to_dict())

    def get_search_text_fields(self) -> str:
        """Return individual programs fields used to build search_text."""
        return G2PRegisterDomainServiceIndividualProgram().construct_search_text(self.to_dict())

    async def get_link_internal_record_id(self, session: Session):
        result = await session.execute(
            select(G2PIntakeFormIndividual).where(
                G2PIntakeFormIndividual.submission_id == self.submission_id
            )
        )
        individual = result.scalars().first()
        if individual:
            self.link_internal_record_id = individual.internal_record_id


class G2PRegisterHistoryIndividualProgram(G2PRegisterHistory, G2PIndividualProgram):
    __tablename__ = "g2p_register_history_individual_programs"
