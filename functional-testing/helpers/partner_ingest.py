"""Ensure DCI ingest key-path config exists for partner ingest tests."""

from __future__ import annotations

from typing import Any

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list, first_id

DCI_DATA_MODEL_ID = "d0000000-0000-4000-8000-000000000001"

# Partner ingest wraps the JSON body as {"headers": ..., "body": <posted json>}.
# JSONPaths must therefore be rooted at $.body.*
KEY_PATHS = {
    "key_path_for_message_id": "$.body.message_id",
    "key_path_for_sender": "$.body.sender",
    "key_path_for_signature": "$.body.signature",
    "key_path_for_signature_payload": "$.body.payload",
    "is_list": False,
    "key_path_for_list_elements": "",
}


def _incoming_key_path_rows(payload: Any) -> list[Any]:
    if isinstance(payload, dict):
        for key in (
            "incoming_key_paths",
            "incoming_model_key_paths",
            "key_paths",
        ):
            if isinstance(payload.get(key), list):
                return payload[key]
    return as_list(payload)


def ensure_dci_incoming_key_path(staff: StaffClient) -> str:
    """Return key_path_id for the DCI data model, creating one if missing."""
    rows = _incoming_key_path_rows(
        assert_success(
            staff.post_json(
                "/ingestion-config/get_all_incoming_key_paths",
                {},
                pagination_request={"current_page": 1, "page_size": 50},
            ),
            "get_all_incoming_key_paths",
        )
    )
    for row in rows:
        if isinstance(row, dict) and row.get("data_model_id") == DCI_DATA_MODEL_ID:
            kid = row.get("key_path_id")
            if kid:
                return str(kid)

    created = assert_success(
        staff.post_json(
            "/ingestion-config/create_incoming_key_path",
            {
                "data_model_id": DCI_DATA_MODEL_ID,
                **KEY_PATHS,
            },
        ),
        "create_incoming_key_path for DCI",
    )
    assert isinstance(created, dict)
    kid = created.get("key_path_id") or first_id([created], "key_path_id")
    assert kid, f"create_incoming_key_path missing id: {created!r}"
    return str(kid)


def build_partner_ingest_body(*, message_id: str, sender: str = "func-partner") -> dict[str, Any]:
    return {
        "message_id": message_id,
        "sender": sender,
        "signature": "func-tier3-unsigned",
        "payload": {
            "source": "functional-testing",
            "note": "tier3 partner ingest",
        },
    }
