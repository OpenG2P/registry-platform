"""Staff Tier-2 E6: AWE policy CRUD + env-gated proxy/webhook; registrant auth."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import uuid

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.lists import as_list
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject


def _awe_enabled() -> bool:
    return os.environ.get("FUNC_AWE_ENABLED", "0") == "1"


def _webhook_secret() -> str | None:
    return os.environ.get("FUNC_AWE_WEBHOOK_SECRET") or None


@pytest.mark.tier2
@with_register_profiles
def test_awe_policy_crud(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    """Create/update/delete mirrors staff-ui AWE policy form (REGISTER + Change Request)."""
    suffix = uuid.uuid4().hex[:8]
    # Matches UI constants: AWE_POLICY_TYPE_OPTIONS / seeded keys like registry.cr.*.v1
    policy_type = "registry.change_request"
    policy_key = f"func.tier2.cr.{profile.key}.{suffix}"
    policy_id = None
    try:
        step("create_awe_policy_configuration")
        created = assert_success(
            staff.post_json(
                "/awe-policy-config/create_awe_policy_configuration",
                {
                    "policy_scope": "REGISTER",
                    "register_id": profile.register_id,
                    "intake_form_id": None,
                    "section_id": None,
                    "policy_type": policy_type,
                    "policy_key": policy_key,
                    "context_field_names": None,
                },
            ),
            "create_awe_policy_configuration",
        )
        assert isinstance(created, dict)
        policy_id = created.get("awe_policy_config_id")
        assert policy_id

        step("get + update awe policy")
        assert_success(
            staff.post_json(
                "/awe-policy-config/get_awe_policy_configuration",
                {"awe_policy_config_id": policy_id},
            ),
            "get_awe_policy_configuration",
        )
        # Edit modal sends full form fields (same as staff-ui update route)
        assert_success(
            staff.post_json(
                "/awe-policy-config/update_awe_policy_configuration",
                {
                    "awe_policy_config_id": policy_id,
                    "policy_scope": "REGISTER",
                    "register_id": profile.register_id,
                    "intake_form_id": "",
                    "section_id": "",
                    "policy_type": policy_type,
                    "policy_key": f"{policy_key}.upd",
                    "context_field_names": None,
                },
            ),
            "update_awe_policy_configuration",
        )
    finally:
        if policy_id:
            step("delete_awe_policy_configuration")
            assert_success(
                staff.post_json(
                    "/awe-policy-config/delete_awe_policy_configuration",
                    {"awe_policy_config_id": policy_id},
                ),
                "delete_awe_policy_configuration",
            )


@pytest.mark.tier2
def test_awe_proxy_list_my_tasks(staff: StaffClient, step):
    if not _awe_enabled():
        pytest.skip("set FUNC_AWE_ENABLED=1 to exercise AWE proxy")
    step("awe/list_my_tasks")
    assert_success(
        staff.post_json("/awe/list_my_tasks", {}),
        "list_my_tasks",
    )
    step("awe/my_task_stats")
    assert_success(
        staff.post_json("/awe/my_task_stats", {}),
        "my_task_stats",
    )


@pytest.mark.tier2
def test_awe_webhook_decision_signature(staff: StaffClient, step):
    secret = _webhook_secret()
    if not secret:
        pytest.skip("set FUNC_AWE_WEBHOOK_SECRET to exercise AWE webhook")

    # Body shape matches AweWebhookEvent (core/schemas/awe_webhook.py)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    body = {
        "event_id": f"func-tier2-{uuid.uuid4().hex}",
        "event_type": "request_approved",
        "request_id": f"req-{uuid.uuid4().hex}",
        "artifact_type": "registry.change_request",
        "artifact_id": f"cr-{uuid.uuid4().hex}",
        "status": "APPROVED",
        "occurred_at": now,
    }
    raw = json.dumps(body).encode("utf-8")
    ts = str(int(time.time()))
    message = f"{ts}.".encode("utf-8") + raw
    sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()

    step("POST /awe/webhooks/decision")
    staff._refresh_auth_header()
    response = staff._client.post(
        "/awe/webhooks/decision",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "X-Approval-Signature": f"sha256={sig}",
            "X-Approval-Timestamp": ts,
            "X-Approval-Event-Id": body["event_id"],
        },
    )
    # Signature accepted → not 401; processing may 422 without a real CR
    assert response.status_code != 401, response.text[:500]


@pytest.mark.tier2
@with_register_profiles
def test_authenticate_registrant_env_gated(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    if os.environ.get("FUNC_REGISTRANT_AUTH", "0") != "1":
        pytest.skip("set FUNC_REGISTRANT_AUTH=1 to exercise authenticate_registrant")

    providers = as_list(
        assert_success(
            staff.post_json(
                "/register-data/get_available_authentication_providers",
                {"register_id": profile.register_id},
            ),
            "providers",
        )
    )
    if not providers:
        pytest.skip("no authentication providers configured")
    provider = providers[0] if isinstance(providers[0], dict) else {}
    provider_id = provider.get("provider_id") or provider.get("id")
    if not provider_id:
        pytest.skip(f"provider payload missing id: {provider!r}")

    rid = subject(profile.key)["internal_record_id"]
    step("authenticate_registrant")
    assert_success(
        staff.post_json(
            "/register-data/authenticate_registrant",
            {
                "register_id": profile.register_id,
                "internal_record_id": rid,
                "provider_id": provider_id,
                "initiated_by_staff_id": "func-tier2",
            },
        ),
        "authenticate_registrant",
    )
