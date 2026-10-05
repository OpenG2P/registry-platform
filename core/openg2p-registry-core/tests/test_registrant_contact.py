from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from openg2p_registry_core.helpers.notification import (
    NotificationWorkflow,
    NotificationHelper,
    change_request_payload,
    resolve_registry_name,
)
from openg2p_registry_core.helpers.registrant_contact import (
    RegistrantContact,
    contact_from_record,
    resolve_registrant_contact,
)


def test_contact_from_record_picks_primary_phone_and_email():
    contact = contact_from_record(
        {
            "internal_record_id": "p1",
            "record_name": "Ada Lovelace",
            "emails": [
                {"address": "other@example.org", "is_primary": False},
                {"address": "ada@example.org", "is_primary": True},
            ],
            "phone_numbers": [
                {"number": "+15550001", "is_primary": True},
                {"number": "+15550002", "is_primary": False},
            ],
        }
    )
    assert contact.person_id == "p1"
    assert contact.email == "ada@example.org"
    assert contact.phone == "+15550001"
    assert contact.name == "Ada Lovelace"
    assert contact.has_channel()


def test_contact_from_record_reads_scalar_columns():
    contact = contact_from_record(
        SimpleNamespace(
            internal_record_id="p2",
            email="bare@example.org",
            phone="+251911",
        )
    )
    assert contact.email == "bare@example.org"
    assert contact.phone == "+251911"
    assert contact.name is None


def test_contact_from_record_none_when_not_a_person():
    assert contact_from_record({"internal_record_id": "h1", "household_head_name": "Ada"}) is None
    assert contact_from_record(None) is None


def test_contact_from_record_person_without_channels():
    contact = contact_from_record(
        {"internal_record_id": "p3", "emails": None, "phone_numbers": []}
    )
    assert contact.person_id == "p3"
    assert contact.email is None
    assert contact.phone is None
    assert not contact.has_channel()


def test_dispatch_forwards_payload_and_skips_empty_recipients():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {"change_request_id": "cr-1", "record_name": "Ada", "approval_status": "pending"}
    empty = contact_from_record({"internal_record_id": "p1", "emails": None, "phone_numbers": []})
    with_email = RegistrantContact(person_id="p1", email="a@b.c", name="Ada")

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: True

    async def _run():
        with patch(
            "openg2p_registry_core.helpers.notification._connector",
            fake_connector,
        ):
            await NotificationHelper.dispatch_notification_staff(
                "staff.workflow", "cr-1", payload, {}
            )
            await NotificationHelper.dispatch_notification_registrant(
                "registrant.workflow", "cr-1", payload, empty
            )
            await NotificationHelper.dispatch_notification_registrant(
                "registrant.workflow", "cr-1", payload, with_email
            )

    asyncio.run(_run())
    send.assert_called_once()
    assert send.call_args.args[0] == "registrant.workflow"
    assert send.call_args.args[1] == "cr-1"
    assert send.call_args.args[2] is payload
    assert send.call_args.args[3].recipient_id == "person:p1"
    assert send.call_args.args[3].recipient_email == "a@b.c"


def test_resolve_registrant_contact_uses_mnemonic_domain_service():
    definition = SimpleNamespace(register_mnemonic="Individual")
    session = SimpleNamespace(get=AsyncMock(return_value=definition))
    person = contact_from_record(
        {
            "internal_record_id": "p1",
            "emails": [{"address": "a@b.c"}],
            "phone_numbers": [{"number": "+1"}],
        }
    )
    service = SimpleNamespace(resolve_contact=AsyncMock(return_value=person))
    factory = SimpleNamespace(get_domain_service=MagicMock(return_value=service))

    async def _run():
        with patch(
            "openg2p_registry_core.interfaces.G2PRegisterDomainFactory.get_component",
            return_value=factory,
        ):
            return await resolve_registrant_contact(session, "reg-1", "p1")

    contact = asyncio.run(_run())
    assert contact.email == "a@b.c"
    factory.get_domain_service.assert_called_once_with("Individual")
    service.resolve_contact.assert_awaited_once()


def test_dispatch_staff_sends_username_name_and_email():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {"record_name": "Ada"}

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: True

    async def _run():
        with patch(
            "openg2p_registry_core.helpers.notification._connector",
            fake_connector,
        ):
            await NotificationHelper.dispatch_notification_staff(
                "staff.workflow",
                "cr-1",
                payload,
                {
                    "preferred_username": "staff-user",
                    "name": "Alex Carter",
                    "email": "alex@example.org",
                },
            )

    asyncio.run(_run())
    send.assert_called_once()
    recipient = send.call_args.args[3]
    assert send.call_args.args[0] == "staff.workflow"
    assert send.call_args.args[2] is payload
    assert recipient.recipient_id == "staff-user"
    assert recipient.recipient_name == "Alex Carter"
    assert recipient.recipient_email == "alex@example.org"


def test_change_request_payload_uses_register_mnemonic():
    change_request = SimpleNamespace(
        change_request_id="cr-1",
        record_name="Ada",
        register_id="reg-1",
        tab_id="tab-1",
        section_id="sec-1",
        section_register_id="sreg-1",
        internal_record_id="p1",
        approval_status="PENDING",
        no_of_verifications_required=1,
        no_of_verifications_done=0,
        created_by="staff",
        created_at=None,
        approved_by=None,
        approved_at=None,
        change_request_source="INTAKE_FORM",
        source_partner_id="partner",
        remarks=None,
        rejection_reason=None,
        awe_request_id="awe-1",
        awe_request_status_summary="pending@1",
        deduplication_register_status="PASSED",
        deduplication_register_failure_reason=None,
        deduplication_change_request_status="PASSED",
        deduplication_change_request_failure_reason=None,
    )
    definition = SimpleNamespace(
        register_mnemonic="Individual",
        register_subject="Individuals",
        register_description="Person registry",
    )
    section = SimpleNamespace(section_mnemonic="demographics")

    async def _get(model, key):
        name = getattr(model, "__name__", str(model))
        if "ChangeRequest" in name and not name.endswith("Payload"):
            return change_request
        if "RegisterDefinition" in name:
            return definition
        if "RegisterSection" in name:
            return section
        return None

    session = SimpleNamespace(get=AsyncMock(side_effect=_get))

    with (
        patch(
            "openg2p_registry_core.helpers.notification.resolve_record_display",
            AsyncMock(return_value={"functional_record_id": "FN-9"}),
        ),
        patch(
            "openg2p_registry_core.helpers.notification.resolve_registry_name",
            AsyncMock(return_value="OpenG2P Demo Registry"),
        ),
    ):
        payload = asyncio.run(change_request_payload("cr-1", session))
    assert payload["change_request_id"] == "cr-1"
    assert payload["register_id"] == "reg-1"
    assert payload["register_mnemonic"] == "Individual"
    assert payload["register_subject"] == "Individuals"
    assert payload["register_description"] == "Person registry"
    assert payload["registry_name"] == "OpenG2P Demo Registry"
    assert payload["section_mnemonic"] == "demographics"
    assert payload["functional_record_id"] == "FN-9"
    assert payload["awe_request_id"] == "awe-1"
    assert payload["deduplication_register_status"] == "PASSED"


def test_dispatch_change_request_notification_loads_payload():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {
        "change_request_id": "cr-1",
        "register_mnemonic": "Individual",
        "internal_record_id": "p1",
    }
    contact = RegistrantContact(person_id="p1", email="a@b.c")

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: True

    async def _run():
        with (
            patch(
                "openg2p_registry_core.helpers.notification._connector",
                fake_connector,
            ),
            patch(
                "openg2p_registry_core.helpers.notification.change_request_payload",
                AsyncMock(return_value=payload),
            ),
            patch(
                "openg2p_registry_core.helpers.notification.resolve_registrant_contact",
                AsyncMock(return_value=contact),
            ) as resolve,
        ):
            await NotificationHelper.dispatch_change_request_notification(
                "cr-1",
                NotificationWorkflow.CHANGE_REQUEST_CREATED,
                session="session",
            )
            resolve.assert_awaited_once_with(
                "session",
                None,
                "p1",
                register_mnemonic="Individual",
            )

    asyncio.run(_run())
    send.assert_called_once()
    assert send.call_args.args[0] == NotificationWorkflow.CHANGE_REQUEST_CREATED
    assert send.call_args.args[3].recipient_id == "person:p1"
    assert send.call_args.args[2] is payload


def test_dispatch_intake_form_notification_sends_only_to_registrant():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {
        "submission_id": "sub-1",
        "register_mnemonic": "Individual",
        "internal_record_id": "p1",
    }
    contact = RegistrantContact(person_id="p1", email="a@b.c")

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: True

    async def _run():
        with (
            patch(
                "openg2p_registry_core.helpers.notification._connector",
                fake_connector,
            ),
            patch(
                "openg2p_registry_core.helpers.notification.intake_form_submission_payload",
                AsyncMock(return_value=(payload, contact)),
            ),
        ):
            await NotificationHelper.dispatch_intake_form_notification(
                "sub-1",
                NotificationWorkflow.INTAKE_FORM_SUBMISSION_CREATED,
                session="session",
            )

    asyncio.run(_run())
    send.assert_called_once()
    assert send.call_args.args[0] == NotificationWorkflow.INTAKE_FORM_SUBMISSION_CREATED
    assert send.call_args.args[3].recipient_id == "person:p1"
    assert send.call_args.args[3].recipient_email == "a@b.c"


def test_dispatch_register_export_notification_sends_to_requester():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {
        "export_id": "export-1",
        "register_mnemonic": "Individual",
        "requested_by": "staff-user",
        "export_status": "completed",
    }

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: True

    async def _run():
        with (
            patch(
                "openg2p_registry_core.helpers.notification._connector",
                fake_connector,
            ),
            patch(
                "openg2p_registry_core.helpers.notification.register_export_payload",
                AsyncMock(return_value=payload),
            ),
        ):
            await NotificationHelper.dispatch_register_export_notification(
                "export-1",
                NotificationWorkflow.REGISTER_EXPORT_COMPLETED,
                session="session",
            )

    asyncio.run(_run())
    send.assert_called_once()
    assert send.call_args.args[0] == NotificationWorkflow.REGISTER_EXPORT_COMPLETED
    assert send.call_args.args[1] == "export-1"
    assert send.call_args.args[2] is payload
    assert send.call_args.args[3].recipient_id == "staff-user"


def test_dispatch_skips_unmapped_workflow():
    send = MagicMock()
    factory = MagicMock()
    factory.get_notifier.return_value.send = send
    payload = {
        "change_request_id": "cr-1",
        "register_mnemonic": "Individual",
        "internal_record_id": "p1",
    }
    contact = RegistrantContact(person_id="p1", email="a@b.c")

    def fake_connector():
        return factory, SimpleNamespace, lambda person_id: f"person:{person_id}", lambda _workflow: False

    async def _run():
        with (
            patch(
                "openg2p_registry_core.helpers.notification._connector",
                fake_connector,
            ),
            patch(
                "openg2p_registry_core.helpers.notification.change_request_payload",
                AsyncMock(return_value=payload),
            ),
            patch(
                "openg2p_registry_core.helpers.notification.resolve_registrant_contact",
                AsyncMock(return_value=contact),
            ),
        ):
            await NotificationHelper.dispatch_notification_registrant(
                NotificationWorkflow.CHANGE_REQUEST_CREATED,
                "cr-1",
                payload,
                contact,
            )
            await NotificationHelper.dispatch_change_request_notification(
                "cr-1",
                NotificationWorkflow.CHANGE_REQUEST_CREATED,
                session="session",
            )

    asyncio.run(_run())
    send.assert_not_called()


def test_resolve_registry_name_soft_loads_singleton():
    config = SimpleNamespace(registry_name="National Social Registry")
    result = SimpleNamespace(scalar_one_or_none=MagicMock(return_value=config))
    session = SimpleNamespace(execute=AsyncMock(return_value=result))

    name = asyncio.run(resolve_registry_name(session))
    assert name == "National Social Registry"
    session.execute.assert_awaited_once()


def test_resolve_registry_name_soft_fails_on_error():
    session = SimpleNamespace(execute=AsyncMock(side_effect=RuntimeError("db down")))
    assert asyncio.run(resolve_registry_name(session)) is None


def test_change_request_payload_keeps_register_subject_without_registry_name():
    """Soft-fail resolve leaves registry_name None; register_subject still present."""
    change_request = SimpleNamespace(
        change_request_id="cr-2",
        record_name="Ada",
        register_id="reg-1",
        tab_id=None,
        section_id=None,
        section_register_id=None,
        internal_record_id="p1",
        approval_status="PENDING",
        no_of_verifications_required=1,
        no_of_verifications_done=0,
        created_by="staff",
        created_at=None,
        approved_by=None,
        approved_at=None,
        change_request_source=None,
        source_partner_id=None,
        remarks=None,
        rejection_reason=None,
        awe_request_id=None,
        awe_request_status_summary=None,
        deduplication_register_status=None,
        deduplication_register_failure_reason=None,
        deduplication_change_request_status=None,
        deduplication_change_request_failure_reason=None,
    )
    definition = SimpleNamespace(
        register_mnemonic="Individual",
        register_subject="Individuals",
        register_description=None,
    )

    async def _get(model, key):
        name = getattr(model, "__name__", str(model))
        if "ChangeRequest" in name:
            return change_request
        if "RegisterDefinition" in name:
            return definition
        return None

    session = SimpleNamespace(get=AsyncMock(side_effect=_get))
    with (
        patch(
            "openg2p_registry_core.helpers.notification.resolve_record_display",
            AsyncMock(return_value={"functional_record_id": None}),
        ),
        patch(
            "openg2p_registry_core.helpers.notification.resolve_registry_name",
            AsyncMock(return_value=None),
        ),
    ):
        payload = asyncio.run(change_request_payload("cr-2", session))
    assert "registry_name" in payload
    assert payload["registry_name"] is None
    assert payload["register_subject"] == "Individuals"
