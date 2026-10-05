"""Contact for a register row.

Default ``resolve_contact`` reads ``email`` / ``emails`` and ``phone`` /
``phone_numbers`` off the ORM row. Override that method when the row is not
the person. The override takes ``session`` and ``internal_record_id`` and
returns a ``RegistrantContact``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

_logger = logging.getLogger("g2p-registrant-contact")

_EMAIL_COLUMNS = ("email", "emails")
_PHONE_COLUMNS = ("phone", "phone_numbers")
_EMAIL_KEYS = ("address", "email")
_PHONE_KEYS = ("number", "phone")


@dataclass(frozen=True)
class RegistrantContact:
    person_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None

    def has_channel(self) -> bool:
        return bool(self.email or self.phone)


def _has(record: Any, key: str) -> bool:
    if isinstance(record, dict):
        return key in record
    return hasattr(record, key)


def _get(record: Any, key: str) -> Any:
    if isinstance(record, dict):
        return record.get(key)
    return getattr(record, key, None)


def _text(value: Any, keys: tuple[str, ...]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        for key in keys:
            found = _text(value.get(key), keys)
            if found:
                return found
        return None
    if isinstance(value, list) and value:
        chosen = next(
            (item for item in value if isinstance(item, dict) and item.get("is_primary") is True),
            value[0],
        )
        return _text(chosen, keys)
    return None


def _column(record: Any, columns: tuple[str, ...], keys: tuple[str, ...]) -> Optional[str]:
    for column in columns:
        if _has(record, column):
            found = _text(_get(record, column), keys)
            if found:
                return found
    return None


def contact_from_record(record: Any) -> Optional[RegistrantContact]:
    """Read email and phone columns. None when the row has neither."""
    if record is None:
        return None
    if not any(_has(record, column) for column in (*_EMAIL_COLUMNS, *_PHONE_COLUMNS)):
        return None
    person_id = _get(record, "internal_record_id")
    if not person_id:
        return None
    name = _get(record, "record_name")
    return RegistrantContact(
        person_id=str(person_id),
        email=_column(record, _EMAIL_COLUMNS, _EMAIL_KEYS),
        phone=_column(record, _PHONE_COLUMNS, _PHONE_KEYS),
        name=str(name).strip() if name and str(name).strip() else None,
    )


async def resolve_registrant_contact(
    session,
    register_id: Optional[str],
    internal_record_id: Optional[str],
    register_mnemonic: Optional[str] = None,
) -> Optional[RegistrantContact]:
    """Ask this register's domain service for a contact."""
    if not internal_record_id:
        return None
    try:
        from ..interfaces import G2PRegisterDomainFactory
        from ..models import G2PRegisterDefinition

        mnemonic = register_mnemonic
        if not mnemonic and register_id:
            definition = await session.get(G2PRegisterDefinition, register_id)
            mnemonic = getattr(definition, "register_mnemonic", None) if definition else None
        service = None
        if mnemonic:
            factory = G2PRegisterDomainFactory.get_component() or G2PRegisterDomainFactory()
            service = factory.get_domain_service(mnemonic)
        if service is None:
            from ..services.g2p_register_domain_service import G2PRegisterDomainService

            service = G2PRegisterDomainService.get_component() or G2PRegisterDomainService()
        return await service.resolve_contact(session, str(internal_record_id))
    except Exception:
        _logger.exception(
            "resolve_contact failed for register_id=%s internal_record_id=%s",
            register_id,
            internal_record_id,
        )
        return None
