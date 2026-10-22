"""Unit tests: pending UPDATE CRs from userinfo use provider_config mapping."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from openg2p_registry_core.services.g2p_change_request_section_payload_service import (
    G2PChangeRequestSectionPayloadService,
)
from openg2p_registry_core.services.g2p_register_change_request_service import (
    G2PRegisterChangeRequestService,
)
from openg2p_registry_core.services.g2p_registrant_authentication_service import (
    G2PRegistrantAuthenticationService,
)

REGISTER_ID = "a1a4d25a-1cd4-4356-abac-985a0b3c6bcd"

NSR_STYLE_PROVIDER_CONFIG = {
    "userinfo_change_request": {
        "tab_keys": ["individual_info_tab", "individual_info"],
        "claims": {
            "given_name": {"field": "first_name"},
            "family_name": {"field": "last_name"},
            "name": {
                "field": "full_name",
                "split_into": ["first_name", "middle_name", "last_name"],
            },
            "gender": {"field": "gender", "normalize": "gender"},
            "birthdate": {"field": "birth_date", "normalize": "birth_date"},
            "phone_number": {"field": "primary_phone"},
            "address": {"field": "address_descriptor", "normalize": "address"},
        },
        "sections": [
            {
                "section_keys": [
                    "individual_demographic_section",
                    "individual_demographic_details",
                ],
                "fields": [
                    "full_name",
                    "first_name",
                    "middle_name",
                    "last_name",
                    "gender",
                    "birth_date",
                ],
            },
            {
                "section_keys": [
                    "individual_contact_section",
                    "individual_contact_details",
                ],
                "fields": ["primary_phone", "address_descriptor"],
            },
        ],
    }
}

_DEMOGRAPHIC_ORM_FIELDS = frozenset(
    {
        "full_name",
        "first_name",
        "middle_name",
        "last_name",
        "gender",
        "birth_date",
    }
)
_CONTACT_ORM_FIELDS = frozenset({"primary_phone", "address_descriptor"})


def _section_ui_schema(*field_names: str) -> dict:
    return {
        "panels": [
            {
                "panel-id": "outer",
                "widgets": [
                    {
                        "widget": "text",
                        "widget-data-path": f"{REGISTER_ID}.{name}",
                    }
                    for name in field_names
                ],
            }
        ]
    }


def _demographic_section():
    return SimpleNamespace(
        section_id="individual_demographic_section",
        section_register_id=REGISTER_ID,
        section_mnemonic="individual_demographic_details",
        section_ui_schema=_section_ui_schema(*sorted(_DEMOGRAPHIC_ORM_FIELDS)),
        documents_required=False,
    )


def _contact_section():
    return SimpleNamespace(
        section_id="individual_contact_section",
        section_register_id=REGISTER_ID,
        section_mnemonic="individual_contact_details",
        section_ui_schema=_section_ui_schema(*sorted(_CONTACT_ORM_FIELDS)),
        documents_required=False,
    )


def _definition():
    return SimpleNamespace(
        register_id=REGISTER_ID,
        register_mnemonic="individual",
        register_purpose="REGISTER",
    )


@pytest.mark.asyncio
async def test_create_pending_crs_from_userinfo_creates_update_crs():
    service = G2PRegistrantAuthenticationService.__new__(
        G2PRegistrantAuthenticationService
    )

    demographic_section = _demographic_section()
    contact_section = _contact_section()

    async def find_section(_session, _register_id, section_mapping):
        keys = set(section_mapping.section_keys)
        if "individual_demographic_section" in keys:
            return demographic_section
        if "individual_contact_section" in keys:
            return contact_section
        return None

    service._find_register_section = find_section  # type: ignore[method-assign]
    service._find_tab_id = AsyncMock(return_value="individual_info_tab")  # type: ignore[method-assign]

    created_payloads: list[dict] = []

    class FakeCR:
        def __init__(self, change_request_id):
            self.change_request_id = change_request_id

    class FakeCRService:
        async def create_change_request(self, **kwargs):
            created_payloads.append(kwargs)
            return FakeCR(f"cr-{len(created_payloads)}")

    with patch.object(
        G2PRegisterChangeRequestService,
        "get_component",
        return_value=FakeCRService(),
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id=REGISTER_ID,
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={
                "name": "Abebe Bekele Tessema",
                "gender": "Male",
                "birthdate": "1990-01-02",
                "phone_number": "+251911223344",
                "address": "Addis Ababa",
                "individual_id": "FAN-1",
            },
            provider_config=NSR_STYLE_PROVIDER_CONFIG,
        )

    assert ids == ["cr-1", "cr-2"]
    assert len(created_payloads) == 2

    for call in created_payloads:
        assert call["change_request_source"] == "STAFF_PORTAL"
        assert call["bearer_token"] is None

    demo_row = created_payloads[0]["change_request_request_payload"].change_payload[0]
    assert demo_row.edit_action == "UPDATE"
    assert demo_row.first_name == "Abebe"
    assert demo_row.middle_name == "Bekele"
    assert demo_row.last_name == "Tessema"
    assert demo_row.full_name == "Abebe Bekele Tessema"
    assert demo_row.gender == "MALE"
    assert demo_row.birth_date == "1990-01-02"

    contact_row = created_payloads[1]["change_request_request_payload"].change_payload[0]
    assert contact_row.edit_action == "UPDATE"
    assert contact_row.primary_phone == "+251911223344"
    assert contact_row.address_descriptor == "Addis Ababa"

    section_service = G2PChangeRequestSectionPayloadService()
    section_service._resolve_orm_fields = AsyncMock(  # type: ignore[method-assign]
        return_value=set(_DEMOGRAPHIC_ORM_FIELDS)
    )
    accepted = await section_service.validate(
        [demo_row],
        demographic_section,
        _definition(),
        AsyncMock(),
    )
    assert len(accepted) == 1
    assert accepted[0].first_name == "Abebe"

    section_service._resolve_orm_fields = AsyncMock(  # type: ignore[method-assign]
        return_value=set(_CONTACT_ORM_FIELDS)
    )
    accepted_contact = await section_service.validate(
        [contact_row],
        contact_section,
        _definition(),
        AsyncMock(),
    )
    assert len(accepted_contact) == 1
    assert accepted_contact[0].primary_phone == "+251911223344"


@pytest.mark.asyncio
async def test_skips_when_provider_has_no_change_request_config():
    service = G2PRegistrantAuthenticationService.__new__(
        G2PRegistrantAuthenticationService
    )
    cr_mock = MagicMock()
    cr_mock.create_change_request = AsyncMock()

    with patch.object(
        G2PRegisterChangeRequestService,
        "get_component",
        return_value=cr_mock,
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id="reg-1",
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={"name": "Someone"},
            provider_config={"scope": "openid"},
        )

    assert ids == []
    cr_mock.create_change_request.assert_not_called()


@pytest.mark.asyncio
async def test_skips_when_no_mappable_claims():
    service = G2PRegistrantAuthenticationService.__new__(
        G2PRegistrantAuthenticationService
    )
    service._find_tab_id = AsyncMock(return_value="individual_info_tab")  # type: ignore[method-assign]
    cr_mock = MagicMock()
    cr_mock.create_change_request = AsyncMock()

    with patch.object(
        G2PRegisterChangeRequestService,
        "get_component",
        return_value=cr_mock,
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id="reg-1",
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={"individual_id": "FAN-1", "sub": "x"},
            provider_config=NSR_STYLE_PROVIDER_CONFIG,
        )

    assert ids == []
    cr_mock.create_change_request.assert_not_called()
