import importlib
import logging

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import inspect as sa_inspect, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PRegisterDefinition, RegisterPurposeEnum
from ..schemas import AllowedParentRecordData, IntakeAllowedParentsData

_logger = logging.getLogger("g2p-intake-form-link-service")

_DOMAIN_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"
_INTAKE_CLASS_PREFIX = "G2PIntakeForm"
_REGISTER_CLASS_PREFIX = "G2PRegister"


class G2PIntakeFormLinkService(BaseService):
    """Metadata-driven parent linking for intake-form rows.

    Linking rules (immediate parent resolved via
    ``G2PRegisterDefinition.master_register_id``):

    - 0 parent intake rows: required child -> error; optional subject register
      -> null allowed (validate a supplied link against live register).
    - 1 parent intake row: auto-set link (payload may override).
    - 2+ parent intake rows: require payload ``link_internal_record_id`` and
      validate it against the allowed parents.

    On update, an existing link is preserved unless the payload explicitly
    includes ``link_internal_record_id``.
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

    async def list_intake_parent_candidates(
        self,
        submission_id: str,
        section_register_id: str,
        session: AsyncSession,
    ) -> IntakeAllowedParentsData:
        section_register = await self._get_register_definition(section_register_id, session)
        parent_register_id = section_register.master_register_id

        # Root register: no parent metadata, so there are no candidates to list.
        if not parent_register_id:
            return IntakeAllowedParentsData(
                parent_register_id=None,
                parent_register_mnemonic=None,
                requires_selection=False,
                allowed_parents=[],
            )

        parent_register = await self._get_register_definition(parent_register_id, session)
        parent_intake_class = self.get_intake_model_class(parent_register.register_mnemonic)

        # Parent candidates are sibling intake rows already saved in this submission.
        rows = (
            await session.execute(
                select(parent_intake_class).where(
                    parent_intake_class.submission_id == submission_id
                )
            )
        ).scalars().all()

        allowed_parents = [
            AllowedParentRecordData(
                internal_record_id=row.internal_record_id,
                record_name=getattr(row, "record_name", None),
            )
            for row in rows
            if getattr(row, "internal_record_id", None)
        ]

        return IntakeAllowedParentsData(
            parent_register_id=parent_register.register_id,
            parent_register_mnemonic=parent_register.register_mnemonic,
            requires_selection=len(allowed_parents) > 1,  # UI must pick when 2+ parents exist.
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
        # Accept links that match an intake parent row in this submission.
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

        # On update, preserve the existing link unless the payload changes it.
        if not payload_specifies_link and existing_link is not None:
            return existing_link

        # Only read link_internal_record_id from the payload when the caller sent it.
        payload_link = (
            self._normalize_link_value(record.get("link_internal_record_id"))
            if payload_specifies_link
            else None
        )

        # Load parent intake rows saved so far in this submission.
        candidates_data = await self.list_intake_parent_candidates(
            submission_id, section_register_id, session
        )
        candidate_ids = {
            parent.internal_record_id for parent in candidates_data.allowed_parents
        }
        parent_count = len(candidate_ids)

        # Explicit payload link wins after validation against candidates or live register.
        if payload_link:
            await self._validate_resolved_link(
                payload_link,
                section_register.master_register_id,
                candidate_ids,
                allow_live_parent,
                session,
            )
            return payload_link

        # Exactly one parent in the submission: auto-link without user input.
        if parent_count == 1:
            return next(iter(candidate_ids))

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
