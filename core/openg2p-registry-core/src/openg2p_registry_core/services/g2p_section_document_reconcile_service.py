from __future__ import annotations

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    DocumentHistoryEventTypeEnum,
    G2PRegisterChangeRequest,
    G2PRegisterDocumentHistory,
    G2PRegisterSectionDocument,
)
from ..schemas.file_payload import DocumentAttachment


class G2PSectionDocumentReconcileService(BaseService):
    """Apply a desired section-document set and append ADD/REMOVE events."""

    async def reconcile(
        self,
        *,
        change_request: G2PRegisterChangeRequest,
        section_id: str,
        internal_record_id: str,
        desired_documents: list[DocumentAttachment],
        session: AsyncSession,
    ) -> None:
        # A row lock cannot serialize an empty desired/live set. PostgreSQL's
        # transaction-scoped advisory lock covers that gap and is released
        # automatically with the surrounding approval transaction.
        await session.execute(
            text(
                "SELECT pg_advisory_xact_lock("
                "hashtextextended(:document_scope, 0))"
            ),
            {
                "document_scope": (
                    f"{internal_record_id}\x1f{section_id}"
                )
            },
        )
        existing_rows = (
            await session.execute(
                select(G2PRegisterSectionDocument).where(
                    G2PRegisterSectionDocument.internal_record_id
                    == internal_record_id,
                    G2PRegisterSectionDocument.section_id == section_id,
                )
            )
        ).scalars().all()
        existing_by_id = {row.document_id: row for row in existing_rows}
        desired_by_id = {
            document.document_id: document for document in desired_documents
        }

        for document_id, existing in existing_by_id.items():
            desired = desired_by_id.get(document_id)
            if desired is None:
                self._add_history(
                    change_request=change_request,
                    section_id=section_id,
                    internal_record_id=internal_record_id,
                    document_id=document_id,
                    label=existing.label,
                    event_type=DocumentHistoryEventTypeEnum.REMOVE,
                    session=session,
                )
                await session.delete(existing)
                continue

            if existing.label != desired.label:
                self._add_history(
                    change_request=change_request,
                    section_id=section_id,
                    internal_record_id=internal_record_id,
                    document_id=document_id,
                    label=existing.label,
                    event_type=DocumentHistoryEventTypeEnum.REMOVE,
                    session=session,
                )
                existing.label = desired.label
                self._add_history(
                    change_request=change_request,
                    section_id=section_id,
                    internal_record_id=internal_record_id,
                    document_id=document_id,
                    label=desired.label,
                    event_type=DocumentHistoryEventTypeEnum.ADD,
                    session=session,
                )

        for document_id, desired in desired_by_id.items():
            if document_id in existing_by_id:
                continue
            session.add(
                G2PRegisterSectionDocument(
                    internal_record_id=internal_record_id,
                    document_id=document_id,
                    section_id=section_id,
                    label=desired.label,
                )
            )
            self._add_history(
                change_request=change_request,
                section_id=section_id,
                internal_record_id=internal_record_id,
                document_id=document_id,
                label=desired.label,
                event_type=DocumentHistoryEventTypeEnum.ADD,
                session=session,
            )

    def _add_history(
        self,
        *,
        change_request: G2PRegisterChangeRequest,
        section_id: str,
        internal_record_id: str,
        document_id: str,
        label: str,
        event_type: DocumentHistoryEventTypeEnum,
        session: AsyncSession,
    ) -> None:
        session.add(
            G2PRegisterDocumentHistory(
                internal_record_id=internal_record_id,
                section_id=section_id,
                document_id=document_id,
                label=label,
                event_type=event_type.value,
                change_request_id=change_request.change_request_id,
                change_request_source=change_request.change_request_source,
                created_by=change_request.created_by,
                created_at=change_request.created_at,
                approved_by=change_request.approved_by or "system",
                approved_at=change_request.approved_at,
            )
        )
