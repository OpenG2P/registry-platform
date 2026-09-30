"""The generic register configuration must protect an activity register.

It decides what may be edited or deleted from whether the register holds data,
and it used to look only for a G2PRegister<Mnemonic> table and change requests —
neither of which an activity register has — so a register full of activities
read as empty and could be renamed away from its tables or deleted.
"""

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import G2PRegisterDefinition
from openg2p_registry_core.services.g2p_register_service import G2PRegisterService

from .conftest import REGISTER_ID
from .test_activity_service import planned

pytestmark = pytest.mark.asyncio(loop_scope="session")

IDENTITY_FIXED = G2PRegistryErrorCodes.ACTIVITY_REGISTER_IDENTITY_FIXED.value[1]


def _register_service() -> G2PRegisterService:
    # Only the data checks are exercised; skip the component wiring __init__ does.
    return G2PRegisterService.__new__(G2PRegisterService)


async def _has_data(database) -> bool:
    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        definition = await session.get(G2PRegisterDefinition, REGISTER_ID)
        return await _register_service()._check_register_has_data(definition, session)


async def test_activity_register_has_data_once_an_activity_is_recorded(service, activity_types, database):
    assert await _has_data(database) is False
    await service.append(planned(), "da1", "STAFF_PORTAL")
    assert await _has_data(database) is True


async def test_activity_register_mnemonic_and_purpose_are_fixed(database):
    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        definition = await session.get(G2PRegisterDefinition, REGISTER_ID)
    reject = G2PRegisterService._reject_activity_identity_change

    # Re-sending the current values (as an edit form does) is not a change.
    reject(definition, definition.register_mnemonic, definition.register_purpose)
    reject(definition, None, None)

    for mnemonic, purpose in (("Renamed", None), (None, "REGISTER")):
        with pytest.raises(G2PRegistryException) as info:
            reject(definition, mnemonic, purpose)
        assert info.value.code == IDENTITY_FIXED

    # Nor can a record register become an activity register.
    record = G2PRegisterDefinition(register_id="r", register_mnemonic="Farmer", register_purpose="REGISTER")
    with pytest.raises(G2PRegistryException) as info:
        reject(record, None, "ACTIVITY")
    assert info.value.code == IDENTITY_FIXED
    reject(record, "Farmer2", "REGISTER")


async def test_register_summary_lists_activity_registers(service, activity_types, database):
    from .test_activity_service import planned

    await service.append(planned(), "da1", "STAFF_PORTAL")
    await service.append(planned(plot="LND-2"), "da1", "STAFF_PORTAL")
    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        summary = await _register_service()._fetch_register_summary_data(session)
    by_mnemonic = {s.register_mnemonic: s for s in summary}
    # Record registers first, then activity registers; an activity register counts its contexts.
    assert summary[-1].register_mnemonic == "FieldWork"
    assert by_mnemonic["FieldWork"].register_purpose == "ACTIVITY"
    assert by_mnemonic["FieldWork"].total_record_count == 2
    assert by_mnemonic["TestFarmer"].register_purpose == "REGISTER"
    assert "TestPlot" not in by_mnemonic  # a TABLE register, as before
