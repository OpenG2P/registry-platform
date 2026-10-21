import importlib
import logging

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import inspect as sa_inspect, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import (
    ApprovalStatusEnum,
    G2PIntakeFormSubmission,
    G2PRegisterDefinition,
    IntakeFormStatusEnum,
    RegisterPurposeEnum,
)
from ..schemas import AllowedParentRecordData, IntakeAllowedParentsData

_logger = logging.getLogger("g2p-intake-form-link-service")

_DOMAIN_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"
_INTAKE_CLASS_PREFIX = "G2PIntakeForm"
_REGISTER_CLASS_PREFIX = "G2PRegister"


class G2PIntakeFormLinkService(BaseService):
    """Metadata-driven parent linking for intake-form rows.

    Linking rules (immediate parent resolved via
    ``G2PRegisterDefinition.master_register_id``):

    - 0 same-submission parent rows: required child -> error; optional subject
      register -> null allowed (a supplied link is validated against selectable
      intake parents or the live register).
    - 1 same-submission parent row: auto-set link (an explicit payload link
      may override).
    - 2+ same-submission parent rows: require payload ``link_internal_record_id``.

    Selectable parents on ``get_intake_allowed_parents`` are same-submission rows.
    Finalized, not-yet-approved REGISTER parents are listed by
    ``list_inflight_register_parents``. A blank or omitted link keeps an
    existing link.
    """

    def get_intake_model_class(self, register_mnemonic: str):
        # Resolve G2PIntakeForm{Mnemonic} from the extension models package.
        module = importlib.import_module(_DOMAIN_MODELS_MODULE)
        return getattr(module, f"{_INTAKE_CLASS_PREFIX}{register_mnemonic}")

    def get_register_model_class(self, register_mnemonic: str, register_purpose: str | None = None):
        # CORE_TABLE registers live in core; everything else in extensions.
        if register_purpose == RegisterPurposeEnum.CORE_TABLE.value:
            module = importlib.import_module("openg2p_registry_core.models")
            return getattr(module, f"{_REGISTER_CLASS_PREFIX}{register_mnemonic}")
        module = importlib.import_module(_DOMAIN_MODELS_MODULE)
        return getattr(module, f"{_REGISTER_CLASS_PREFIX}{register_mnemonic}")

    def intake_model_has_link_column(self, intake_class) -> bool:
        return "link_internal_record_id" in sa_inspect(intake_class).columns

    async def _get_register_definition(
        self, register_id: str, session: AsyncSession
    ) -> G2PRegisterDefinition:
        register = await session.get(G2PRegisterDefinition, register_id)
        if not register:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
                message=f"Register '{register_id}' was not found",
            )
        return register

    @staticmethod
    def _normalize_link_value(value) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return str(value)

    def is_parent_link_required(
        self,
        section_register: G2PRegisterDefinition,
        form_register_id: str,
        section_register_id: str,
    ) -> bool:
        """Required when the section has a parent and is not the form subject.
        The form's subject register (even when it has a parent, e.g.
        Individual -> Household) is optional."""
        if section_register.master_register_id is None:
            return False
        if section_register_id == form_register_id:
            return False
        return True

    def is_optional_subject_parent_link(
        self,
        section_register: G2PRegisterDefinition,
        form_register_id: str,
        section_register_id: str,
    ) -> bool:
        """The form subject register whose register has a parent (e.g. Individual
        on the individual intake form -> Household). Link is optional and, when
        supplied, may point at a live register record."""
        return (
            section_register_id == form_register_id
            and section_register.master_register_id is not None
        )

    @staticmethod
    def _is_register_purpose(register_purpose) -> bool:
        return register_purpose == RegisterPurposeEnum.REGISTER.value or (
            register_purpose == RegisterPurposeEnum.REGISTER
        )

    @staticmethod
    def _to_allowed_parents(rows) -> list[AllowedParentRecordData]:
        seen: set[str] = set()
        allowed: list[AllowedParentRecordData] = []
        for row in rows:
            record_id = getattr(row, "internal_record_id", None)
            if not record_id or record_id in seen:
                continue
            seen.add(record_id)
            allowed.append(
                AllowedParentRecordData(
                    internal_record_id=record_id,
                    record_name=getattr(row, "record_name", None),
                )
            )
        return allowed

    async def _parent_intake_target(self, section_register_id: str, session: AsyncSession):
        """Return (parent register, intake model) or (None, None) when the section has no master."""
        section_register = await self._get_register_definition(section_register_id, session)
        if not section_register.master_register_id:
            return None, None
        parent_register = await self._get_register_definition(
            section_register.master_register_id, session
        )
        parent_intake_class = self.get_intake_model_class(parent_register.register_mnemonic)
        return parent_register, parent_intake_class

    async def list_same_submission_parents(
        self,
        submission_id: str,
        section_register_id: str,
        session: AsyncSession,
    ) -> list[AllowedParentRecordData]:
        """Parent intake rows saved on this submission, any draft status."""
        parent_register, parent_intake_class = await self._parent_intake_target(
            section_register_id, session
        )
        if parent_register is None:
            return []
        rows = (
            await session.execute(
                select(parent_intake_class).where(
                    parent_intake_class.submission_id == submission_id
                )
            )
        ).scalars().all()
        return self._to_allowed_parents(rows)

    async def list_intake_parent_candidates(
        self,
        submission_id: str,
        section_register_id: str,
        session: AsyncSession,
    ) -> IntakeAllowedParentsData:
        parent_register, parent_intake_class = await self._parent_intake_target(
            section_register_id, session
        )
        # Root register: no parent metadata, so there are no candidates to list.
        if parent_register is None:
            return IntakeAllowedParentsData(
                parent_register_id=None,
                parent_register_mnemonic=None,
                requires_selection=False,
                allowed_parents=[],
            )

        # Same submission only. Crops still see lands saved on this form.
        # Finalized, not-yet-approved master rows are listed by
        # list_inflight_register_parents.
        same_rows = (
            await session.execute(
                select(parent_intake_class).where(
                    parent_intake_class.submission_id == submission_id
                )
            )
        ).scalars().all()
        allowed_parents = self._to_allowed_parents(same_rows)
        return IntakeAllowedParentsData(
            parent_register_id=parent_register.register_id,
            parent_register_mnemonic=parent_register.register_mnemonic,
            requires_selection=len(allowed_parents) > 1,
            allowed_parents=allowed_parents,
        )

    async def list_inflight_register_parents(
        self,
        register_id: str,
        session: AsyncSession,
    ) -> IntakeAllowedParentsData:
        """Finalized, not-yet-approved intake rows for a REGISTER parent.

        The household lookup calls this beside the live register search.
        TABLE registers return an empty list so a crop cannot see another
        form's land. A draft form's own rows are already excluded by the
        FINAL filter.
        """
        register = await self._get_register_definition(register_id, session)
        if not self._is_register_purpose(register.register_purpose):
            return IntakeAllowedParentsData(
                parent_register_id=register.register_id,
                parent_register_mnemonic=register.register_mnemonic,
                requires_selection=False,
                allowed_parents=[],
            )

        intake_class = self.get_intake_model_class(register.register_mnemonic)
        rows = (
            await session.execute(
                select(intake_class)
                .join(
                    G2PIntakeFormSubmission,
                    G2PIntakeFormSubmission.submission_id == intake_class.submission_id,
                )
                .where(
                    G2PIntakeFormSubmission.draft_status == IntakeFormStatusEnum.FINAL.value,
                    G2PIntakeFormSubmission.approval_status == ApprovalStatusEnum.PENDING.value,
                )
            )
        ).scalars().all()
        allowed_parents = self._to_allowed_parents(rows)
        return IntakeAllowedParentsData(
            parent_register_id=register.register_id,
            parent_register_mnemonic=register.register_mnemonic,
            requires_selection=len(allowed_parents) > 1,
            allowed_parents=allowed_parents,
        )

    async def validate_live_parent_link(
        self,
        parent_register_id: str,
        link_internal_record_id: str,
        session: AsyncSession,
    ) -> None:
        parent_register = await self._get_register_definition(parent_register_id, session)
        register_class = self.get_register_model_class(
            parent_register.register_mnemonic,
            parent_register.register_purpose,
        )
        # Optional subject links may point at an already-ingested register record.
        live_record = await session.get(register_class, link_internal_record_id)
        if not live_record:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=(
                    f"link_internal_record_id '{link_internal_record_id}' does not exist "
                    f"in register '{parent_register.register_mnemonic}'"
                ),
            )

    async def _validate_resolved_link(
        self,
        link_internal_record_id: str,
        parent_register_id: str,
        candidate_ids: set[str],
        allow_live_parent: bool,
        session: AsyncSession,
    ) -> None:
        # Accept a same-submission parent or a finalized, not-yet-approved REGISTER parent.
        if link_internal_record_id in candidate_ids:
            return
        # Subject sections may instead reference a live register record.
        if allow_live_parent:
            await self.validate_live_parent_link(
                parent_register_id, link_internal_record_id, session
            )
            return
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
            message=(
                f"link_internal_record_id '{link_internal_record_id}' is not an allowed "
                f"parent for this submission"
            ),
        )

    async def resolve_link_internal_record_id(
        self,
        submission_id: str,
        form_register_id: str,
        section_register_id: str,
        record: dict,
        session: AsyncSession,
        existing_link: str | None = None,
        payload_specifies_link: bool = False,
    ) -> str | None:
        section_register = await self._get_register_definition(section_register_id, session)

        # Root register (no parent) never carries a link.
        if section_register.master_register_id is None:
            return None

        # Decide whether a link is mandatory and whether live-register links are allowed.
        parent_link_required = self.is_parent_link_required(
            section_register, form_register_id, section_register_id
        )
        allow_live_parent = self.is_optional_subject_parent_link(
            section_register, form_register_id, section_register_id
        )

        # Only read link_internal_record_id from the payload when the caller sent it.
        payload_link = (
            self._normalize_link_value(record.get("link_internal_record_id"))
            if payload_specifies_link
            else None
        )

        # A blank or omitted link keeps a link the user already chose.
        if existing_link is not None and not payload_link:
            return existing_link

        # Explicit payload link wins after validation against this submission,
        # finalized-not-approved REGISTER parents, or the live register.
        if payload_link:
            candidates_data = await self.list_intake_parent_candidates(
                submission_id, section_register_id, session
            )
            candidate_ids = {
                parent.internal_record_id for parent in candidates_data.allowed_parents
            }
            parent_register = await self._get_register_definition(
                section_register.master_register_id, session
            )
            if self._is_register_purpose(parent_register.register_purpose):
                inflight = await self.list_inflight_register_parents(
                    parent_register.register_id,
                    session,
                )
                candidate_ids.update(
                    parent.internal_record_id for parent in inflight.allowed_parents
                )
            await self._validate_resolved_link(
                payload_link,
                section_register.master_register_id,
                candidate_ids,
                allow_live_parent,
                session,
            )
            return payload_link

        # Auto-link only from this submission. Another form's finalized household
        # must be chosen explicitly.
        same_submission_parents = await self.list_same_submission_parents(
            submission_id, section_register_id, session
        )
        parent_count = len(same_submission_parents)

        if parent_count == 1:
            return same_submission_parents[0].internal_record_id

        # No parents yet: required child sections fail; optional subject sections stay unlinked.
        if parent_count == 0:
            if parent_link_required:
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                    message=(
                        "No parent records exist in this submission; cannot link child "
                        f"row for register '{section_register.register_mnemonic}'"
                    ),
                )
            return None

        # 2+ parents and no link supplied: required sections must ask the user to choose.
        if parent_link_required:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=(
                    "link_internal_record_id is required when multiple parent records "
                    "exist in this submission"
                ),
            )
        return None

    async def backfill_null_child_links_for_same_submission_parent(
        self,
        submission_id: str,
        saved_section_register_id: str,
        session: AsyncSession,
    ) -> None:
        """Point unlinked children at the one parent created in this submission.

        Runs after a REGISTER section save (a household on a farmer form).
        An existing child link is left as it is. More than one parent row
        means the user must choose.
        """
        saved_register = await self._get_register_definition(saved_section_register_id, session)
        if not self._is_register_purpose(saved_register.register_purpose):
            return

        intake_class = self.get_intake_model_class(saved_register.register_mnemonic)
        rows = (
            await session.execute(
                select(intake_class).where(intake_class.submission_id == submission_id)
            )
        ).scalars().all()
        parent_ids = [
            row.internal_record_id
            for row in rows
            if getattr(row, "internal_record_id", None)
        ]
        if len(parent_ids) != 1:
            return
        parent_id = parent_ids[0]

        register_definitions = (
            await session.execute(select(G2PRegisterDefinition))
        ).scalars().all()
        for register_def in register_definitions:
            if register_def.master_register_id != saved_section_register_id:
                continue
            try:
                child_class = self.get_intake_model_class(register_def.register_mnemonic)
            except (AttributeError, ModuleNotFoundError):
                continue
            if not self.intake_model_has_link_column(child_class):
                continue
            await session.execute(
                update(child_class)
                .where(
                    child_class.submission_id == submission_id,
                    child_class.link_internal_record_id.is_(None),
                )
                .values(link_internal_record_id=parent_id)
            )

    async def null_child_links_for_deleted_parents(
        self,
        submission_id: str,
        deleted_internal_record_ids: set[str],
        session: AsyncSession,
    ) -> None:
        if not deleted_internal_record_ids:
            return

        # Orphan policy: scan every intake model that can hold a parent link.
        register_definitions = (
            await session.execute(select(G2PRegisterDefinition))
        ).scalars().all()

        for register_def in register_definitions:
            try:
                intake_class = self.get_intake_model_class(register_def.register_mnemonic)
            except (AttributeError, ModuleNotFoundError):
                continue

            if not self.intake_model_has_link_column(intake_class):
                continue

            # Null matching child links in this submission; never delete the child rows.
            await session.execute(
                update(intake_class)
                .where(
                    intake_class.submission_id == submission_id,
                    intake_class.link_internal_record_id.in_(deleted_internal_record_ids),
                )
                .values(link_internal_record_id=None)
            )
