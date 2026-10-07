"""Configured rules and search fields on a real register: warnings stored, blocking rules reject."""

from datetime import datetime, timedelta

import pytest
from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.schemas.activity import ActivityInput
from openg2p_registry_core.services.g2p_activity_register_config import EMPTY_CONFIG, parse_config
from sqlalchemy import text

pytestmark = pytest.mark.asyncio(loop_scope="session")

REG = "FieldWork"

CONFIG = {
    "search_fields": ["crop"],
    "rules": [
        {"id": "within_plan", "applies_to": ["SOWN"],
         "when": {"and": [{"var": "payload.area_ha"}, {"var": "latest.PLANNED.planned_ha"}]},
         "check": {"<=": [{"var": "payload.area_ha"}, {"*": [{"var": "latest.PLANNED.planned_ha"}, 1.5]}]},
         "message": "Area {{ payload.area_ha }} ha is over 1.5 × the planned {{ latest.PLANNED.planned_ha }} ha"},
        {"id": "area_cap", "applies_to": ["SOWN"], "check": {"<=": [{"var": "payload.area_ha"}, 100]},
         "message": "Area {{ payload.area_ha }} ha is over 100 ha", "severity": "block"},
    ],
}


def _act(kind, days, **payload):
    return ActivityInput(
        register_mnemonic=REG, activity_type=kind,
        occurred_at=(datetime.utcnow() - timedelta(days=days)).replace(microsecond=0),
        subject_type="PERSON_ID", subject_id="P-1",
        payload={"plot_id": "LND-1", "season": "MEHER", **payload},
    )


@pytest.fixture
def configured(service):
    domain = service.registry.domain_service(REG)
    domain.activity_config = parse_config(CONFIG, None, "test")
    yield
    domain.activity_config = EMPTY_CONFIG


async def test_configured_rules_warn_and_block(service, activity_types, configured, database):
    await service.append(_act("PLANNED", 30, planned_ha=1.0), "da1", "STAFF_PORTAL")

    with pytest.raises(G2PRegistryException) as info:
        await service.append(_act("SOWN", 20, crop="TEFF", area_ha=150, woreda="ET0401"), "da1", "STAFF_PORTAL")
    assert info.value.code == G2PRegistryErrorCodes.ACTIVITY_RULE_FAILED.value[1]
    assert info.value.message == "Area 150 ha is over 100 ha"

    data, _ = await service.append(_act("SOWN", 20, crop="TEFF", area_ha=2, woreda="ET0401"), "da1", "STAFF_PORTAL")
    assert "Area 2 ha is over 1.5 × the planned 1.0 ha" in data.rule_warnings

    async with database.connect() as conn:
        search_text = (await conn.execute(
            text("SELECT search_text FROM g2p_activity_field_works WHERE activity_id = :id"), {"id": data.activity_id}
        )).scalar()
    assert search_text.endswith(" TEFF")  # the configured search field
