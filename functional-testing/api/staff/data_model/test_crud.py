"""Staff Tier-2 E4: data-model + ingestion/outgestion/input-mechanism config CRUD."""

from __future__ import annotations

import uuid

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.documents import delete_documents, upload_template_document
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.util import assert_ok


_PAGE = {"current_page": 1, "page_size": 20}


def _create_data_model(staff: StaffClient, step, suffix: str) -> str:
    step("create_data_model")
    created = assert_success(
        staff.post_json(
            "/data-model/create_data_model",
            {
                "data_model_mnemonic": f"FUNC_T2_DM_{suffix}",
                "pattern_for_data_model": f"$.body.meta.data_model_is=>^FUNC_T2_{suffix}$",
                "is_active": True,
            },
        ),
        "create_data_model",
    )
    assert isinstance(created, dict)
    mid = created.get("data_model_id")
    assert mid
    return str(mid)


@pytest.mark.tier2
def test_data_model_crud(staff: StaffClient, step):
    suffix = uuid.uuid4().hex[:8]
    mid = None
    try:
        mid = _create_data_model(staff, step, suffix)
        step("get_data_model")
        got = assert_success(
            staff.post_json("/data-model/get_data_model", {"data_model_id": mid}),
            "get_data_model",
        )
        assert isinstance(got, dict)

        step("update_data_model")
        assert_success(
            staff.post_json(
                "/data-model/update_data_model",
                {
                    "data_model_id": mid,
                    "data_model_mnemonic": f"FUNC_T2_DM_{suffix}_UPD",
                },
            ),
            "update_data_model",
        )
    finally:
        if mid:
            step("delete_data_model")
            assert_success(
                staff.post_json(
                    "/data-model/delete_data_model",
                    {"data_model_id": mid},
                ),
                "delete_data_model",
            )


@pytest.mark.tier2
@with_register_profiles
def test_ingestion_config_crud(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    suffix = uuid.uuid4().hex[:8]
    mid = None
    key_path_id = None
    semantic_id = None
    reg_sem_id = None
    template_id = None
    doc_id = None
    try:
        mid = _create_data_model(staff, step, suffix)

        step("create_incoming_key_path")
        kp = assert_success(
            staff.post_json(
                "/ingestion-config/create_incoming_key_path",
                {
                    "data_model_id": mid,
                    "key_path_for_message_id": "$.message_id",
                    "key_path_for_sender": "$.sender",
                    "key_path_for_signature": "$.signature",
                    "key_path_for_signature_payload": "$.payload",
                    "is_list": False,
                    "key_path_for_list_elements": "",
                },
            ),
            "create_incoming_key_path",
        )
        assert isinstance(kp, dict)
        key_path_id = kp.get("key_path_id")
        assert key_path_id

        step("update_incoming_key_path")
        assert_success(
            staff.post_json(
                "/ingestion-config/update_incoming_key_path",
                {
                    "key_path_id": key_path_id,
                    "key_path_for_message_id": "$.message_id_updated",
                },
            ),
            "update_incoming_key_path",
        )

        step("create_semantic_pattern")
        sp = assert_success(
            staff.post_json(
                "/ingestion-config/create_semantic_pattern",
                {
                    "data_model_id": mid,
                    "register_id": profile.register_id,
                    "intake_form_id": profile.intake_form_id,
                    "pattern_for_intake_form": f"FUNC_T2_IF_{suffix}",
                    "key_path_for_business_payload": "$.body",
                },
            ),
            "create_semantic_pattern",
        )
        assert isinstance(sp, dict)
        semantic_id = sp.get("semantic_pattern_id")
        assert semantic_id

        step("create_register_semantic_pattern")
        rsp = assert_success(
            staff.post_json(
                "/ingestion-config/create_register_semantic_pattern",
                {
                    "data_model_id": mid,
                    "register_id": profile.register_id,
                    "pattern_for_register": f"FUNC_T2_REG_{suffix}",
                    "key_path_for_record_identifier": "$.id",
                },
            ),
            "create_register_semantic_pattern",
        )
        assert isinstance(rsp, dict)
        reg_sem_id = rsp.get("register_semantic_pattern_id")
        assert reg_sem_id

        doc_id = upload_template_document(staff, filename=f"ingest-tpl-{suffix}.json.j2")
        step("create_ingestion_template")
        tpl = assert_success(
            staff.post_json(
                "/ingestion-config/create_template",
                {
                    "register_id": profile.register_id,
                    "data_model_id": mid,
                    "template_document_id": doc_id,
                },
            ),
            "create_ingestion_template",
        )
        assert isinstance(tpl, dict)
        template_id = tpl.get("template_id")
        assert template_id
    finally:
        if template_id:
            assert_ok(
                staff.post_json(
                    "/ingestion-config/delete_template",
                    {"template_id": template_id},
                ),
                "delete_template",
            )
        if semantic_id:
            assert_ok(
                staff.post_json(
                    "/ingestion-config/delete_semantic_pattern",
                    {"semantic_pattern_id": semantic_id},
                ),
                "delete_semantic_pattern",
            )
        if reg_sem_id:
            assert_ok(
                staff.post_json(
                    "/ingestion-config/delete_register_semantic_pattern",
                    {"register_semantic_pattern_id": reg_sem_id},
                ),
                "delete_register_semantic_pattern",
            )
        if key_path_id:
            assert_ok(
                staff.post_json(
                    "/ingestion-config/delete_incoming_key_path",
                    {"key_path_id": key_path_id},
                ),
                "delete_incoming_key_path",
            )
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
@with_register_profiles
def test_outgestion_topic_crud(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    """Create/update/delete topic only (skip re_register — needs live broker)."""
    suffix = uuid.uuid4().hex[:8]
    mid = None
    topic_id = None
    try:
        mid = _create_data_model(staff, step, suffix)
        step("create_topic")
        topic = assert_success(
            staff.post_json(
                "/outgestion-config/create_topic",
                {
                    "register_id": profile.register_id,
                    "data_model_id": mid,
                    "websub_topic": f"func.tier2.topic.{suffix}",
                    "description": "func tier2 disposable topic",
                },
            ),
            "create_topic",
        )
        assert isinstance(topic, dict)
        topic_id = topic.get("topic_id")
        assert topic_id

        step("get_topic + update_topic + toggle")
        assert_success(
            staff.post_json("/outgestion-config/get_topic", {"topic_id": topic_id}),
            "get_topic",
        )
        assert_success(
            staff.post_json(
                "/outgestion-config/update_topic",
                {
                    "topic_id": topic_id,
                    "description": "func tier2 topic updated",
                },
            ),
            "update_topic",
        )
        assert_ok(
            staff.post_json(
                "/outgestion-config/toggle_topicstatus",
                {"topic_id": topic_id},
            ),
            "toggle_topicstatus",
        )
    finally:
        if topic_id:
            assert_ok(
                staff.post_json(
                    "/outgestion-config/delete_topic",
                    {"topic_id": topic_id},
                ),
                "delete_topic",
            )
        if mid:
            assert_ok(
                staff.post_json(
                    "/data-model/delete_data_model",
                    {"data_model_id": mid},
                ),
                "delete_data_model",
            )


@pytest.mark.tier2
@with_register_profiles
def test_input_mechanism_vc_and_import_file_crud(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    suffix = uuid.uuid4().hex[:8]
    mid = None
    vc_id = None
    if_id = None
    try:
        mid = _create_data_model(staff, step, suffix)

        step("create_vc_configuration")
        vc = assert_success(
            staff.post_json(
                "/input-mechanism-metadata/create_vc_configuration",
                {
                    "register_id": profile.register_id,
                    "intake_form_id": profile.intake_form_id,
                    "data_model_id": mid,
                    "vc_mnemonic": f"FUNC_T2_VC_{suffix}",
                    "descriptor_schema": {"type": "object", "properties": {}},
                },
            ),
            "create_vc_configuration",
        )
        # response may be list or single
        if isinstance(vc, list) and vc:
            vc_row = vc[0]
        else:
            vc_row = vc if isinstance(vc, dict) else {}
        vc_id = vc_row.get("vc_config_id")
        assert vc_id

        step("update_vc_configuration")
        assert_success(
            staff.post_json(
                "/input-mechanism-metadata/update_vc_configuration",
                {
                    "vc_config_id": vc_id,
                    "vc_mnemonic": f"FUNC_T2_VC_{suffix}_UPD",
                    "descriptor_schema": {"type": "object"},
                },
            ),
            "update_vc_configuration",
        )

        step("create_import_file_configuration")
        ifc = assert_success(
            staff.post_json(
                "/input-mechanism-metadata/create_import_file_configuration",
                {
                    "register_id": profile.register_id,
                    "form_id": profile.intake_form_id,
                    "data_model_id": mid,
                    "import_file_template_mnemonic": f"FUNC_T2_IF_{suffix}",
                    "import_file_template_description": "func tier2 import file",
                },
            ),
            "create_import_file_configuration",
        )
        if isinstance(ifc, list) and ifc:
            if_row = ifc[0]
        else:
            if_row = ifc if isinstance(ifc, dict) else {}
        if_id = if_row.get("import_file_configuration_id")
        assert if_id

        step("update_import_file_configuration")
        assert_success(
            staff.post_json(
                "/input-mechanism-metadata/update_import_file_configuration",
                {
                    "import_file_configuration_id": if_id,
                    "import_file_template_description": "func tier2 import file updated",
                },
            ),
            "update_import_file_configuration",
        )
    finally:
        if if_id:
            assert_ok(
                staff.post_json(
                    "/input-mechanism-metadata/delete_import_file_configuration",
                    {"import_file_configuration_id": if_id},
                ),
                "delete_import_file_configuration",
            )
        if vc_id:
            assert_ok(
                staff.post_json(
                    "/input-mechanism-metadata/delete_vc_configuration",
                    {"vc_config_id": vc_id},
                ),
                "delete_vc_configuration",
            )
        if mid:
            assert_ok(
                staff.post_json(
                    "/data-model/delete_data_model",
                    {"data_model_id": mid},
                ),
                "delete_data_model",
            )
