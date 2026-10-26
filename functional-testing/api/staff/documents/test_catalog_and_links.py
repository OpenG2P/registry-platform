"""Staff Tier-1: /documents catalog + intake / CR / live-section links (API + DB)."""

from __future__ import annotations

import uuid

import pytest

from assertions import db as db_assert
from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.documents import delete_documents, get_documents, upload_text_document
from helpers.flows.intake import (
    attach_intake_section_documents,
    create_draft_intake,
    verify_and_approve_intake,
)
from helpers.flows.register import wait_for_register_record
from helpers.http import StaffApiError, StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import create_field_cr, provision_record
from helpers.util import assert_ok


def _doc_ids(payload: dict | list | None) -> list[str]:
    docs = payload.get("documents") if isinstance(payload, dict) else None
    if not isinstance(docs, list):
        return []
    return [str(d.get("document_id")) for d in docs if isinstance(d, dict) and d.get("document_id")]


def _cleanup(staff: StaffClient, document_ids: list[str]) -> None:
    remaining = [d for d in document_ids if d]
    if not remaining:
        return
    try:
        delete_documents(staff, remaining)
    except Exception:
        pass


@pytest.mark.tier1
def test_upload_get_delete_catalog(staff: StaffClient, cfg: Config, step):
    suffix = uuid.uuid4().hex[:8]
    filename = f"func-docs-{suffix}.pdf"
    doc_id = None
    try:
        step("upload_documents")
        doc_id = upload_text_document(staff, filename=filename)

        step("get_documents + catalog DB row")
        got = assert_success(get_documents(staff, [doc_id]), "get_documents")
        assert isinstance(got, dict)
        assert doc_id in _doc_ids(got)
        catalog = next(
            (d for d in (got.get("documents") or []) if d.get("document_id") == doc_id),
            None,
        )
        assert isinstance(catalog, dict)
        assert catalog.get("source_filename") == filename
        assert str(catalog.get("bucket") or "").lower() == "documents"
        assert catalog.get("presigned_url")
        row = db_assert.fetch_registry_document(cfg.registry_dsn, doc_id)
        assert row, f"catalog row missing for {doc_id}"
        assert row.get("source_filename") == filename
        assert str(row.get("bucket") or "").lower() == "documents"

        step("delete_documents")
        deleted = assert_success(
            delete_documents(staff, [doc_id]),
            "delete_documents",
        )
        assert isinstance(deleted, dict)
        deleted_ids = deleted.get("deleted_document_ids") or []
        assert doc_id in [str(i) for i in deleted_ids]
        assert db_assert.fetch_registry_document(cfg.registry_dsn, doc_id) is None

        step("get_documents after delete → DOCUMENT_NOT_FOUND")
        with pytest.raises(StaffApiError) as exc_info:
            get_documents(staff, [doc_id])
        assert "DOCUMENT_NOT_FOUND" in str(exc_info.value) or "ERROR" in str(exc_info.value)
        doc_id = None
    finally:
        _cleanup(staff, [doc_id] if doc_id else [])


@pytest.mark.tier1
@pytest.mark.intake
@with_register_profiles
def test_intake_and_section_documents(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    """Attach on draft intake, read intake docs, approve, then live section docs."""
    suffix = uuid.uuid4().hex[:8]
    label = f"FuncIntakeDoc {suffix}"
    filename = f"func-intake-{suffix}.pdf"
    doc_id = None
    try:
        created = create_draft_intake(
            staff, cfg, profile, household_id=household_id_for, step=step
        )
        doc_id = upload_text_document(staff, filename=filename)

        step("attach document to intake CR section")
        assert_ok(
            attach_intake_section_documents(
                staff,
                submission_id=created.submission_id,
                profile=profile,
                documents=[{"document_id": doc_id, "label": label}],
                step=step,
            ),
            "attach intake documents",
        )

        step("get_intake_form_documents + DB junction")
        intake_docs = assert_success(
            staff.post_json(
                "/documents/get_intake_form_documents",
                {"submission_id": created.submission_id},
            ),
            "get_intake_form_documents",
        )
        assert isinstance(intake_docs, dict)
        assert str(intake_docs.get("submission_id")) == created.submission_id
        assert doc_id in _doc_ids(intake_docs)
        attached = next(
            (d for d in (intake_docs.get("documents") or []) if d.get("document_id") == doc_id),
            None,
        )
        assert isinstance(attached, dict)
        assert attached.get("label") == label
        assert attached.get("section_id") == profile.cr_section_id
        junction = db_assert.fetch_intake_section_documents(
            cfg.registry_dsn, created.submission_id
        )
        assert any(row.get("document_id") == doc_id for row in junction), junction

        step("finalize + fixture approve (AWE bypass is provision-only)")
        assert_ok(
            staff.post_json(
                "/intake-form-data/finalize_intake_form_submission",
                {"submission_id": created.submission_id},
            ),
            "finalize",
        )
        verify_and_approve_intake(staff, created.submission_id, step=step)
        hit = wait_for_register_record(staff, profile, created.identity_value)
        internal_id = hit["internal_record_id"]

        step("get_section_documents + live DB junction")
        section_docs = assert_success(
            staff.post_json(
                "/documents/get_section_documents",
                {"internal_record_id": internal_id},
            ),
            "get_section_documents",
        )
        assert isinstance(section_docs, dict)
        assert str(section_docs.get("internal_record_id")) == internal_id
        assert doc_id in _doc_ids(section_docs)
        live = db_assert.fetch_section_documents(cfg.registry_dsn, internal_id)
        assert any(row.get("document_id") == doc_id for row in live), live
    finally:
        _cleanup(staff, [doc_id] if doc_id else [])


@pytest.mark.tier1
@pytest.mark.change_request
@with_register_profiles
def test_change_request_documents(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    suffix = uuid.uuid4().hex[:8]
    label = f"FuncCrDoc {suffix}"
    filename = f"func-cr-{suffix}.pdf"
    doc_id = None
    try:
        subject = provision_record(
            staff, cfg, profile, household_id=household_id_for, step=step
        )
        doc_id = upload_text_document(staff, filename=filename)

        step("create_field_cr with supporting evidence document")
        created = create_field_cr(
            staff,
            cfg,
            profile,
            subject_internal_record_id=subject.internal_record_id,
            identity_value=subject.identity_value,
            documents=[{"document_id": doc_id, "label": label}],
            step=step,
        )

        step("get_change_request_documents + DB junction")
        cr_docs = assert_success(
            staff.post_json(
                "/documents/get_change_request_documents",
                {"change_request_id": created.change_request_id},
            ),
            "get_change_request_documents",
        )
        assert isinstance(cr_docs, dict)
        assert str(cr_docs.get("change_request_id")) == created.change_request_id
        assert doc_id in _doc_ids(cr_docs)
        attached = next(
            (d for d in (cr_docs.get("documents") or []) if d.get("document_id") == doc_id),
            None,
        )
        assert isinstance(attached, dict)
        assert attached.get("label") == label
        junction = db_assert.fetch_change_request_documents(
            cfg.registry_dsn, created.change_request_id
        )
        assert any(row.get("document_id") == doc_id for row in junction), junction
    finally:
        _cleanup(staff, [doc_id] if doc_id else [])
