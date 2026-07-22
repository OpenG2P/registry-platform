from datetime import date

from sqlalchemy import Date, String, select
from sqlalchemy.orm import Mapped, mapped_column, Session

from openg2p_registry_core.models import G2PRegister, G2PRegisterHistory
from openg2p_registry_core.models.g2p_intake_form import G2PIntakeForm

from ..services import G2PRegisterDomainServiceHouseholdProgram
from .enums import ProgramEnum
from .household import G2PIntakeFormHousehold


class G2PHouseholdProgram:
    program_name: Mapped[ProgramEnum] = mapped_column(String, nullable=True)
    program_start_date: Mapped[date] = mapped_column(Date, nullable=True)
    program_exit_date: Mapped[date] = mapped_column(Date, nullable=True)


class G2PRegisterHouseholdProgram(G2PRegister, G2PHouseholdProgram):
    __tablename__ = "g2p_register_household_programs"

    def get_record_name_fields(self) -> str:
        """Return household programs fields used to build record_name."""
        return G2PRegisterDomainServiceHouseholdProgram().construct_record_name(self.to_dict())

    def get_search_text_fields(self) -> str:
        """Return household programs fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdProgram().construct_search_text(self.to_dict())


# All Intake Form classes should have the prefix G2PIntakeForm
class G2PIntakeFormHouseholdProgram(G2PIntakeForm, G2PRegister, G2PHouseholdProgram):
    __tablename__ = "g2p_intake_form_household_programs"

    def get_record_name_fields(self) -> str:
        """Return household programs fields used to build record_name."""
        return G2PRegisterDomainServiceHouseholdProgram().construct_intake_record_name(self.to_dict())

    def get_search_text_fields(self) -> str:
        """Return household programs fields used to build search_text."""
        return G2PRegisterDomainServiceHouseholdProgram().construct_search_text(self.to_dict())

    async def get_link_internal_record_id(self, session: Session):
        result = await session.execute(
            select(G2PIntakeFormHousehold).where(
                G2PIntakeFormHousehold.submission_id == self.submission_id
            )
        )
        household = result.scalars().first()
        if household:
            self.link_internal_record_id = household.internal_record_id


class G2PRegisterHistoryHouseholdProgram(G2PRegisterHistory, G2PHouseholdProgram):
    __tablename__ = "g2p_register_history_household_programs"
