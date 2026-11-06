"""Staff Tier-2 E6: enqueue_import_file + env-gated staff ingest-data."""

from __future__ import annotations

import os
import uuid

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.documents import delete_documents, upload_text_document
from helpers.http import StaffApiError, StaffClient
from helpers.profiles import RegisterProfile
from helpers.util import assert_ok


@pytest.mark.tier2
@with_register_profiles
def test_enqueue_import_file(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    suffix = uuid.uuid4().hex[:8]
    mid = None
    doc_id = None
    try:
        step("create disposable data model for enqueue")
        created = assert_success(
            staff.post_json(
                "/data-model/create_data_model",
                {
                    "data_model_mnemonic": f"FUNC_T2_ENQ_{suffix}",
                    "pattern_for_data_model": "*",
                    "is_active": True,
                },
            ),
            "create_data_model",
        )
        assert isinstance(created, dict)
        mid = created.get("data_model_id")
        assert mid

        doc_id = upload_text_document(
            staff,
            filename=f"enqueue-{suffix}.pdf",
        )

        step("enqueue_import_file")
        queued = assert_success(
            staff.post_json(
                "/input-mechanism-data/enqueue_import_file",
                {
                    "document_id": doc_id,
                    "data_model_id": mid,
                    "register_id": profile.register_id,
                    "intake_form_id": profile.intake_form_id,
                },
            ),
            "enqueue_import_file",
        )
        assert queued is not None
    finally:
        if mid:
            assert_ok(
                staff.post_json(
                    "/data-model/delete_data_model",
                    {"data_model_id": mid},
                ),
                "delete_data_model",
            )
        if doc_id:
            try:
                delete_documents(staff, [doc_id])
            except Exception:
                pass


@pytest.mark.tier2
def test_staff_ingest_data_env_gated(staff: StaffClient, step):
    """Partner-style ingest via staff; requires FUNC_STAFF_INGEST=1."""
    if os.environ.get("FUNC_STAFF_INGEST", "0") != "1":
        pytest.skip("set FUNC_STAFF_INGEST=1 to exercise /input-mechanism-data/ingest-data")

    step("ingest-data minimal probe")
    try:
        staff.post_json("/input-mechanism-data/ingest-data", {})
    except StaffApiError as exc:
        assert "ERROR" in str(exc) or "HTTP" in str(exc)
