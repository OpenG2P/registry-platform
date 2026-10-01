"""Send notifications through openg2p-notification.

Change-request and intake-form workflows notify the registrant only.
Register-export workflows notify the staff member who requested the
export. A failed send never fails the business request. Without the
connector, sends are skipped.

Payload builders keep IDs for deep links and add related-model display
fields via small soft-fail helpers (register / section / record).
"""

from __future__ import annotations

import asyncio
import logging
import os
from enum import StrEnum
from typing import Any, Optional

from .registrant_contact import (
    RegistrantContact,
    contact_from_record,
    resolve_registrant_contact,
)

_logger = logging.getLogger("g2p-registry-notification")


class NotificationWorkflow(StrEnum):
    CHANGE_REQUEST_CREATED = "change_request.created"
    CHANGE_REQUEST_APPROVED = "change_request.approved"
    CHANGE_REQUEST_REJECTED = "change_request.rejected"
    INTAKE_FORM_SUBMISSION_CREATED = "intake_form.submission_created"
    INTAKE_FORM_SUBMISSION_APPROVED = "intake_form.submission_approved"
    INTAKE_FORM_SUBMISSION_REJECTED = "intake_form.submission_rejected"
    REGISTER_EXPORT_COMPLETED = "register_export.completed"
    REGISTER_EXPORT_FAILED = "register_export.failed"


def _connector():
    try:
        from openg2p_notification import (
            NotificationFactory,
            Recipient,
            registrant_id,
            workflow_enabled,
        )

        return NotificationFactory, Recipient, registrant_id, workflow_enabled
    except ImportError:
        return None, None, None, None


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


# ---------------------------------------------------------------------------
# Related-model resolvers — soft-fail; never raise into business actions.
# ---------------------------------------------------------------------------


async def resolve_register_context(
    session, register_id: Optional[str]
) -> dict[str, Any]:
    """Load friendly register fields from G2PRegisterDefinition by id.

    Always returns the four keys so callers can ``payload.update(...)`` safely.
    Missing rows or lookup errors leave display fields as None.
    """
    result: dict[str, Any] = {
        "register_id": register_id or None,
        "register_mnemonic": None,
        "register_subject": None,
        "register_description": None,
    }
    if not register_id:
        return result
    try:
        from ..models import G2PRegisterDefinition

        definition = await session.get(G2PRegisterDefinition, register_id)
        if definition is None:
            return result
        result["register_mnemonic"] = getattr(definition, "register_mnemonic", None)
        result["register_subject"] = getattr(definition, "register_subject", None)
        result["register_description"] = getattr(definition, "register_description", None)
        return result
    except Exception:  # noqa: BLE001 — notification enrichment must not break sends
        _logger.exception(
            "resolve_register_context failed for register_id=%s", register_id
        )
        return result


async def resolve_section_mnemonic(
    session, section_id: Optional[str]
) -> Optional[str]:
    """Soft-load section_mnemonic from G2PRegisterSection."""
    if not section_id:
        return None
    try:
        from ..models import G2PRegisterSection

        section = await session.get(G2PRegisterSection, section_id)
        return getattr(section, "section_mnemonic", None) if section else None
    except Exception:  # noqa: BLE001
        _logger.exception(
            "resolve_section_mnemonic failed for section_id=%s", section_id
        )
        return None


async def resolve_intake_form_mnemonic(
    session, form_id: Optional[str]
) -> Optional[str]:
    """Soft-load form_mnemonic from G2PIntakeFormDefinition."""
    if not form_id:
        return None
    try:
        from ..models import G2PIntakeFormDefinition

        form = await session.get(G2PIntakeFormDefinition, form_id)
        return getattr(form, "form_mnemonic", None) if form else None
    except Exception:  # noqa: BLE001
        _logger.exception(
            "resolve_intake_form_mnemonic failed for form_id=%s", form_id
        )
        return None


async def resolve_record_display(
    session,
    *,
    internal_record_id: Optional[str],
    register_mnemonic: Optional[str] = None,
    register_id: Optional[str] = None,
) -> dict[str, Any]:
    """Soft-load display fields from the live register row (domain service).

    Uses register_mnemonic when known; otherwise resolves mnemonic from
    register_id. Missing domain wiring or rows yield empty fields.
    """
    result: dict[str, Any] = {"functional_record_id": None}
    if not internal_record_id:
        return result
    try:
        from ..interfaces import G2PRegisterDomainFactory
        from ..models import G2PRegisterDefinition

        mnemonic = register_mnemonic
        if not mnemonic and register_id:
            definition = await session.get(G2PRegisterDefinition, register_id)
            mnemonic = getattr(definition, "register_mnemonic", None) if definition else None
        if not mnemonic:
            return result
        factory = G2PRegisterDomainFactory.get_component() or G2PRegisterDomainFactory()
        service = factory.get_domain_service(mnemonic)
        if service is None:
            return result
        row = await service.load_register_row(session, str(internal_record_id))
        if row is None:
            return result
        functional_id = getattr(row, "functional_record_id", None)
        result["functional_record_id"] = (
            str(functional_id) if functional_id else None
        )
        return result
    except Exception:  # noqa: BLE001
        _logger.exception(
            "resolve_record_display failed for internal_record_id=%s",
            internal_record_id,
        )
        return result


def _selected_record_count(selected_ids: Any) -> Optional[int]:
    if selected_ids is None:
        return None
    try:
        return len(selected_ids)
    except TypeError:
        return None


class NotificationHelper:
    @staticmethod
    async def _send(
        workflow: str,
        entity_id: str,
        payload: dict[str, Any],
        recipient_id: Optional[str],
        *,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        name: Optional[str] = None,
    ) -> None:
        if not workflow or not entity_id or not recipient_id:
            return
        factory_cls, recipient_cls, _, workflow_enabled = _connector()
        if factory_cls is None:
            return
        if not workflow_enabled(str(workflow)):
            return
        try:
            await asyncio.to_thread(
                factory_cls.get_notifier().send,
                str(workflow),
                str(entity_id),
                payload or {},
                recipient_cls(
                    recipient_id=str(recipient_id),
                    recipient_email=email,
                    recipient_phone=phone,
                    recipient_name=name,
                ),
                f"{workflow}:{entity_id}:{recipient_id}",
            )
        except Exception:
            _logger.exception(
                "notification send failed for workflow %s entity_id=%s",
                workflow,
                entity_id,
            )

    @staticmethod
    async def dispatch_notification_staff(
        workflow: str,
        entity_id: str,
        payload: dict[str, Any],
        staff: Optional[dict],
    ) -> None:
        staff = staff or {}
        await NotificationHelper._send(
            workflow,
            entity_id,
            payload,
            staff.get("preferred_username"),
            email=staff.get("email"),
            name=staff.get("name"),
        )

    @staticmethod
    async def dispatch_notification_registrant(
        workflow: str,
        entity_id: str,
        payload: dict[str, Any],
        contact: Optional[RegistrantContact],
    ) -> None:
        if contact is None or not contact.has_channel():
            return
        _, _, registrant_id, _ = _connector()
        if registrant_id is None:
            return
        await NotificationHelper._send(
            workflow,
            entity_id,
            payload,
            registrant_id(str(contact.person_id)),
            email=contact.email,
            phone=contact.phone,
            name=contact.name,
        )

    @staticmethod
    async def dispatch_change_request_notification(
        change_request_id: str,
        workflow: NotificationWorkflow,
        session,
    ) -> None:
        if not change_request_id:
            return
        payload = await change_request_payload(change_request_id, session)
        if not payload:
            return
        contact = await resolve_registrant_contact(
            session,
            payload.get("register_id"),
            payload.get("internal_record_id"),
            register_mnemonic=payload.get("register_mnemonic"),
        )
        await NotificationHelper.dispatch_notification_registrant(
            workflow, change_request_id, payload, contact
        )

    @staticmethod
    async def dispatch_intake_form_notification(
        submission_id: str,
        workflow: NotificationWorkflow,
        session,
    ) -> None:
        if not submission_id:
            return
        loaded = await intake_form_submission_payload(submission_id, session)
        if loaded is None:
            return
        payload, contact = loaded
        await NotificationHelper.dispatch_notification_registrant(
            workflow, submission_id, payload, contact
        )

    @staticmethod
    async def dispatch_register_export_notification(
        export_id: str,
        workflow: NotificationWorkflow,
        session,
    ) -> None:
        if not export_id:
            return
        payload = await register_export_payload(export_id, session)
        if not payload or not payload.get("requested_by"):
            return
        await NotificationHelper.dispatch_notification_staff(
            workflow,
            export_id,
            payload,
            {"preferred_username": payload["requested_by"]},
        )


async def change_request_payload(change_request_id: str, session) -> dict[str, Any] | None:
    from ..models import G2PRegisterChangeRequest

    change_request = await session.get(G2PRegisterChangeRequest, change_request_id)
    if change_request is None:
        _logger.warning("change request %s was not found for notification", change_request_id)
        return None

    register = await resolve_register_context(session, change_request.register_id)
    section_mnemonic = await resolve_section_mnemonic(session, change_request.section_id)
    record = await resolve_record_display(
        session,
        internal_record_id=change_request.internal_record_id,
        register_mnemonic=register.get("register_mnemonic"),
        register_id=change_request.register_id,
    )

    return {
        "change_request_id": change_request.change_request_id,
        "record_name": change_request.record_name or "your record",
        **register,
        "tab_id": change_request.tab_id,
        "section_id": change_request.section_id,
        "section_mnemonic": section_mnemonic,
        "section_register_id": change_request.section_register_id,
        "internal_record_id": change_request.internal_record_id,
        "functional_record_id": record.get("functional_record_id"),
        "approval_status": _json_value(change_request.approval_status),
        "no_of_verifications_required": change_request.no_of_verifications_required,
        "no_of_verifications_done": change_request.no_of_verifications_done,
        "created_by": change_request.created_by,
        "created_at": _json_value(change_request.created_at),
        "approved_by": change_request.approved_by,
        "approved_at": _json_value(change_request.approved_at),
        "change_request_source": _json_value(change_request.change_request_source),
        "source_partner_id": change_request.source_partner_id,
        "remarks": change_request.remarks,
        "rejection_reason": getattr(change_request, "rejection_reason", None),
        "awe_request_id": getattr(change_request, "awe_request_id", None),
        "awe_request_status_summary": getattr(
            change_request, "awe_request_status_summary", None
        ),
        "deduplication_register_status": _json_value(
            getattr(change_request, "deduplication_register_status", None)
        ),
        "deduplication_register_failure_reason": getattr(
            change_request, "deduplication_register_failure_reason", None
        ),
        "deduplication_change_request_status": _json_value(
            getattr(change_request, "deduplication_change_request_status", None)
        ),
        "deduplication_change_request_failure_reason": getattr(
            change_request, "deduplication_change_request_failure_reason", None
        ),
    }


async def intake_form_submission_payload(
    submission_id: str, session
) -> tuple[dict[str, Any], RegistrantContact | None] | None:
    from ..models import G2PIntakeFormSubmission
    from ..services.intake_form_data_service import G2PIntakeFormDataService

    submission = await session.get(G2PIntakeFormSubmission, submission_id)
    if submission is None:
        _logger.warning("intake submission %s was not found for notification", submission_id)
        return None

    register = await resolve_register_context(session, submission.register_id)
    intake_form_mnemonic = await resolve_intake_form_mnemonic(session, submission.form_id)

    service = G2PIntakeFormDataService.get_component() or G2PIntakeFormDataService()
    sections = await service._build_section_payloads(submission, session)
    register_mnemonic = register.get("register_mnemonic")
    internal_record_id = await service._resolve_submission_subject_internal_record_id(
        submission, sections, session
    )
    record = await resolve_record_display(
        session,
        internal_record_id=internal_record_id,
        register_mnemonic=register_mnemonic,
        register_id=submission.register_id,
    )
    contact = await resolve_registrant_contact(
        session,
        submission.register_id,
        internal_record_id,
        register_mnemonic=register_mnemonic,
    )
    if contact is None or not contact.has_channel():
        contact = _contact_from_sections(sections)

    payload = {
        "submission_id": submission.submission_id,
        "application_reference": submission.application_reference,
        "record_name": service._extract_record_name(sections) or "your record",
        **register,
        "intake_form_mnemonic": intake_form_mnemonic,
        "form_id": submission.form_id,
        "internal_record_id": internal_record_id,
        "functional_record_id": record.get("functional_record_id"),
        "approval_status": _json_value(submission.approval_status),
        "draft_status": _json_value(submission.draft_status),
        "created_by": submission.created_by,
        "first_created_at": _json_value(submission.first_created_at),
        "last_updated_at": _json_value(submission.last_updated_at),
        "finalized_at": _json_value(submission.finalized_at),
        "approved_by": submission.approved_by,
        "approved_at": _json_value(submission.approved_at),
        "remarks": submission.remarks,
        "rejection_reason": getattr(submission, "rejection_reason", None),
        "submission_source": _json_value(submission.submission_source),
        "partner_id": submission.partner_id,
        "awe_request_id": getattr(submission, "awe_request_id", None),
        "awe_request_status_summary": getattr(
            submission, "awe_request_status_summary", None
        ),
        "number_of_verifications_required": submission.number_of_verifications_required,
        "number_of_verifications_done": submission.number_of_verifications_done,
        "register_ingest_process_status": _json_value(
            submission.register_ingest_process_status
        ),
        "register_ingest_processed_timestamp": _json_value(
            submission.register_ingest_processed_timestamp
        ),
        "register_ingest_process_attempts": submission.register_ingest_process_attempts,
        "register_ingest_process_last_error_code": (
            submission.register_ingest_process_last_error_code
        ),
        "deduplication_status_vs_intake_forms": _json_value(
            submission.deduplication_status_vs_intake_forms
        ),
        "deduplication_intake_forms_process_timestamp": _json_value(
            submission.deduplication_intake_forms_process_timestamp
        ),
        "deduplication_intake_forms_attempts": (
            submission.deduplication_intake_forms_attempts
        ),
        "deduplication_intake_forms_error": submission.deduplication_intake_forms_error,
        "deduplication_status_vs_register": _json_value(
            submission.deduplication_status_vs_register
        ),
        "deduplication_register_process_timestamp": _json_value(
            submission.deduplication_register_process_timestamp
        ),
        "deduplication_register_forms_attempts": (
            submission.deduplication_register_forms_attempts
        ),
        "deduplication_register_error": submission.deduplication_register_error,
    }
    return payload, contact


def _contact_from_sections(sections) -> RegistrantContact | None:
    for section in sections or []:
        for record in getattr(section, "records", None) or []:
            contact = contact_from_record(record)
            if contact is not None and contact.has_channel():
                return contact
    return None


async def register_export_payload(export_id: str, session) -> dict[str, Any] | None:
    from ..models import G2PRegisterExportDataQueue

    export = await session.get(G2PRegisterExportDataQueue, export_id)
    if export is None:
        _logger.warning("export %s was not found for notification", export_id)
        return None

    register = await resolve_register_context(session, export.register_id)
    selected_ids = getattr(export, "selected_internal_record_ids", None)

    return {
        "export_id": export.export_id,
        **register,
        "export_format": _json_value(export.export_format),
        "export_status": _json_value(export.export_status),
        "selection_mode": _json_value(export.selection_mode),
        "selected_record_count": _selected_record_count(selected_ids),
        "total_records_exported": export.total_records_exported,
        "export_latest_error_code": export.export_latest_error_code,
        "export_no_of_attempts": export.export_no_of_attempts,
        "export_latest_timestamp": _json_value(export.export_latest_timestamp),
        "file_object_name": export.file_object_name,
        "file_presigned_url": export.file_presigned_url,
        "file_url_expires_at": _json_value(export.file_url_expires_at),
        "requested_by": export.requested_by,
        "queued_at": _json_value(export.queued_at),
        "staff_portal_base_url": os.environ.get(
            "NOTIFICATION_STAFF_PORTAL_BASE_URL", ""
        ).rstrip("/"),
        "batch_size": export.batch_size,
        "last_processed_offset": export.last_processed_offset,
        "search_text": export.search_text,
        "sort_by": export.sort_by,
        "filter_by": export.filter_by,
        "policy_mnemonics": export.policy_mnemonics,
    }
