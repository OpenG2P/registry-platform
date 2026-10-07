"""Activity register configuration: loading and validation, precedence, rules, output record templates."""

import json
from decimal import Decimal
from types import SimpleNamespace

import pytest

# Set by _core (below) for each test.
G2PRegistryErrorCodes = G2PRegistryException = G2PActivityDomainService = EMPTY_CONFIG = None
ActivityRegisterConfigError = load_config = parse_config = AllowedFields = None


@pytest.fixture(autouse=True)
def _core():
    """Import the services at test time, not at collection: collecting test_partner_management
    re-imports openg2p_registry_core.errors, and services imported before it would keep the old
    exception class (breaking pytest.raises in later modules)."""
    from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
    from openg2p_registry_core.services.g2p_activity_domain_service import G2PActivityDomainService
    from openg2p_registry_core.services.g2p_activity_register_config import (
        EMPTY_CONFIG,
        ActivityRegisterConfigError,
        load_config,
        parse_config,
    )
    from openg2p_registry_core.services.g2p_data_scope_fields import AllowedFields

    globals().update(
        G2PRegistryErrorCodes=G2PRegistryErrorCodes, G2PRegistryException=G2PRegistryException,
        G2PActivityDomainService=G2PActivityDomainService, EMPTY_CONFIG=EMPTY_CONFIG,
        ActivityRegisterConfigError=ActivityRegisterConfigError, load_config=load_config,
        parse_config=parse_config, AllowedFields=AllowedFields,
    )

STATE_TEMPLATE = """{
  "@type": {{ record_type | tojson }},
  "subject": {{ record | pick("subject_id", "alt_id") | or_null | tojson }},
  "season": {{ {"id": record.context_id, "stage": record.stage} | or_null | tojson }},
  "measures": {{ record | pick("area_ha", "note") | or_null | tojson }},
  "location": {{ (record.geo_dimensions or none) | tojson }}
}"""

AGGREGATE_TEMPLATE = """{"kind": {{ kind | tojson }}, "format": {{ output_format | tojson }},
 "register": {{ register_mnemonic | tojson }}, "year": {{ record.custom_dimensions.year | tojson }},
 "value": {{ record.aggregate_value | tojson }}}"""

RULES = [
    {"id": "within_plan", "applies_to": ["SOWN"],
     "when": {"and": [{"var": "payload.area_ha"}, {"var": "latest.PLANNED.area_ha"}]},
     "check": {"<=": [{"var": "payload.area_ha"}, {"*": [{"var": "latest.PLANNED.area_ha"}, 1.5]}]},
     "message": "Area {{ payload.area_ha | float }} ha is over 1.5 × the planned {{ latest.PLANNED.area_ha | float }} ha"},
    {"id": "not_negative", "check": {">=": [{"var": ["payload.area_ha", 0]}, 0]},
     "message": "Area {{ payload.area_ha }} is negative", "severity": "block"},
    {"id": "yield_cap", "applies_to": ["HARVESTED"], "check": {"<=": [{"var": "payload.yield"}, 150]},
     "message": "Yield {{ payload.yield }} is implausible"},
]


def _write(tmp_path, mnemonic="Work", **overrides):
    (tmp_path / "templates").mkdir(exist_ok=True)
    (tmp_path / "templates" / "state.json.j2").write_text(STATE_TEMPLATE)
    (tmp_path / "templates" / "aggregate.json.j2").write_text(AGGREGATE_TEMPLATE)
    config = {
        "register_mnemonic": mnemonic,
        "context_fields": ["plot_id", "season"],
        "subject": {"subject_type": "PERSON_ID", "subject_id_fields": ["alt_id"]},
        "ui_hints": {"summary_fields": ["plot_id"]},
        "final_on_period_lock": ["SEASON_TOTAL"],
        "search_fields": ["plot_id", "crop"],
        "formats": {
            "dci": {"state": {"record_type": "ex:Season", "template": "templates/state.json.j2"},
                    "aggregate": {"template": "templates/aggregate.json.j2"}},
        },
        "rules": RULES,
        **overrides,
    }
    (tmp_path / f"{mnemonic}.json").write_text(json.dumps(config))
    return tmp_path


def _service(tmp_path, cls=None, **overrides):
    service = (cls or G2PActivityDomainService)(name="test-activity-domain")
    service.register_mnemonic = "Work"
    service.activity_config = load_config("Work", _write(tmp_path, **overrides))
    return service


def activity(kind, area_ha=None, payload=None):
    return SimpleNamespace(activity_type=kind, area_ha=area_ha, payload=payload or {})


# ------------------------------------------------------------------- loading


def test_no_file_or_directory_is_the_empty_configuration(tmp_path):
    assert load_config("Work", tmp_path) is EMPTY_CONFIG
    assert load_config("Work", tmp_path / "absent") is EMPTY_CONFIG
    service = G2PActivityDomainService(name="plain")
    assert service.context_fields == () and service.ui_hints == {} and service.subject_type is None
    assert service.validate("SOWN", {"area_ha": -1}, []) == []
    assert service.render_record("dci", "state", {"x": 1}) is None


def test_invalid_json_is_reported_with_the_file(tmp_path):
    (tmp_path / "Work.json").write_text("{not json")
    with pytest.raises(ActivityRegisterConfigError, match=r"Work\.json is not valid JSON"):
        load_config("Work", tmp_path)


def test_every_problem_is_listed(tmp_path):
    _write(tmp_path)
    with pytest.raises(ActivityRegisterConfigError) as info:
        parse_config({"context_fields": "plot_id", "unknown_key": 1, "rules": [{"id": "r"}]}, tmp_path, "Work.json")
    message = str(info.value)
    assert "context_fields" in message and "unknown_key" in message
    assert "rules.0.check" in message and "rules.0.message" in message

    bad = {
        "register_mnemonic": "Other",
        "formats": {"dci": {"state": {"template": "templates/missing.j2"},
                            "aggregate": {"template": "templates/broken.j2"}},
                    "other": {"state": {"template": "../outside.j2"}}},
        "rules": [
            {"id": "r1", "check": {"exec": ["x"]}, "message": "m"},
            {"id": "r1", "check": {"<": [1, 2]}, "when": "yes", "message": "{{ broken"},
        ],
    }
    (tmp_path / "templates" / "broken.j2").write_text("{{ record.x ")
    with pytest.raises(ActivityRegisterConfigError) as info:
        parse_config(bad, tmp_path, "Work.json", "Work")
    assert "outside.j2" in str(info.value) or "without '..'" in str(info.value)

    del bad["formats"]["other"]
    with pytest.raises(ActivityRegisterConfigError) as info:
        parse_config(bad, tmp_path, "Work.json", "Work")
    problems = str(info.value)
    for expected in ("does not match the file name", "missing.j2' not found", "broken.j2' is not a valid template",
                     "unknown operator 'exec'", "duplicate rule id", "rules[1] (r1).when", "rules[1] (r1).message"):
        assert expected in problems, expected


def test_registry_reports_an_invalid_configuration(tmp_path, monkeypatch):
    from openg2p_registry_core.services import g2p_activity_registry_service as registry_module

    (tmp_path / "Work.json").write_text(json.dumps({"rules": [{"id": "r", "check": {"bad": 1}, "message": "m"}]}))
    monkeypatch.setattr(registry_module, "load_config", lambda mnemonic: load_config(mnemonic, tmp_path))
    registry = registry_module.G2PActivityRegistryService()
    with pytest.raises(G2PRegistryException) as info:
        registry.domain_service("Work")
    assert info.value.code == G2PRegistryErrorCodes.ACTIVITY_REGISTER_CONFIG_INVALID.value[1]
    assert "unknown operator 'bad'" in info.value.message


# ---------------------------------------------------------------- precedence


def test_declarations_come_from_the_configuration(tmp_path):
    service = _service(tmp_path)
    assert service.context_fields == ("plot_id", "season")
    assert service.subject_type == "PERSON_ID" and service.subject_id_fields == ("alt_id",)
    assert service.ui_hints == {"summary_fields": ["plot_id"]}
    assert service.final_on_period_lock == ("SEASON_TOTAL",)
    assert service.search_text_values("SOWN", {"plot_id": "P1", "crop": "", "other": "x"}) == ["P1"]


def test_code_wins_over_the_configuration(tmp_path):
    class Coded(G2PActivityDomainService):
        context_fields = ("worker_id",)
        ui_hints = {"summary_fields": ["worker_id"]}

        def search_text_values(self, activity_type, payload):
            return ["coded"]

        def validate(self, activity_type, payload, context_activities):
            return ["code rule"] + super().validate(activity_type, payload, context_activities)

        def dci_state_record(self, state):
            return {"coded": True}

    service = _service(tmp_path, Coded)
    assert service.context_fields == ("worker_id",)
    assert service.ui_hints == {"summary_fields": ["worker_id"]}
    assert service.final_on_period_lock == ("SEASON_TOTAL",)  # not overridden: from the file
    assert service.search_text_values("SOWN", {"plot_id": "P1"}) == ["coded"]
    assert service.dci_state_record({}) == {"coded": True}
    assert service.dci_aggregate_record({"aggregate_value": 1})["value"] == 1  # from the file
    assert service.validate("SOWN", {"area_ha": 4}, [activity("PLANNED", Decimal(2))])[0] == "code rule"
    # An instance may set a declaration too.
    service.final_on_period_lock = ("OTHER",)
    assert service.final_on_period_lock == ("OTHER",)
    assert G2PActivityDomainService.context_fields == ()


# --------------------------------------------------------------------- rules


def test_warn_rule_against_the_latest_activity_per_type(tmp_path):
    service = _service(tmp_path)
    planned_twice = [activity("PLANNED", Decimal(4)), activity("SOWN", 1), activity("PLANNED", Decimal(2))]
    assert service.validate("SOWN", {"area_ha": 3}, planned_twice) == []  # 3 <= 2 × 1.5
    assert service.validate("SOWN", {"area_ha": 3.5}, planned_twice) == [
        "Area 3.5 ha is over 1.5 × the planned 2.0 ha"
    ]
    # Not for other types.
    assert service.validate("HARVESTED", {"area_ha": 9, "yield": 10}, planned_twice) == []


def test_rule_with_a_missing_value_does_not_apply(tmp_path):
    service = _service(tmp_path)
    assert service.validate("SOWN", {"area_ha": 9}, []) == []  # no PLANNED
    assert service.validate("SOWN", {"area_ha": 9}, [activity("PLANNED", None)]) == []
    assert service.validate("SOWN", {}, [activity("PLANNED", 1)]) == []
    assert service.validate("HARVESTED", {}, []) == []  # yield missing
    assert service.validate("HARVESTED", {"yield": 151}, []) == ["Yield 151 is implausible"]
    # Payload values are read from the latest activity's payload too.
    assert service.validate("SOWN", {"area_ha": 9}, [activity("PLANNED", None, {"area_ha": 2})]) == [
        "Area 9.0 ha is over 1.5 × the planned 2.0 ha"
    ]


def test_block_rule_rejects_with_its_message(tmp_path):
    service = _service(tmp_path)
    with pytest.raises(G2PRegistryException) as info:
        service.validate("NOTE", {"area_ha": -1}, [])
    assert info.value.code == G2PRegistryErrorCodes.ACTIVITY_RULE_FAILED.value[1]
    assert info.value.message == "Area -1 is negative"
    assert service.validate("NOTE", {}, []) == []  # defaulted to 0: holds


# ------------------------------------------------------------ output records


def test_record_template_per_format_with_null_groups(tmp_path):
    service = _service(tmp_path)
    record = {"subject_id": "P1", "alt_id": None, "context_id": "c1", "stage": None,
              "area_ha": None, "note": None, "geo_dimensions": {}}
    assert service.dci_state_record(record) == {
        "@type": "ex:Season",
        "subject": {"subject_id": "P1", "alt_id": None},
        "season": {"id": "c1", "stage": None},
        "measures": None,  # nothing set: null, not a group of nulls
        "location": None,
    }
    assert list(service.dci_state_record(record)) == ["@type", "subject", "season", "measures", "location"]
    assert service.render_record("dci", "state", record) == service.dci_state_record(record)
    assert service.render_record("other-standard", "state", record) is None
    assert service.dci_aggregate_record({"custom_dimensions": None, "aggregate_value": {"n": 1}}) == {
        "kind": "aggregate", "format": "dci", "register": "Work", "year": None, "value": {"n": 1},
    }


def test_records_are_filtered_to_the_consented_scopes_before_rendering(tmp_path):
    """As the partner API does: filter to the consented data scopes, then render. A group outside is null."""
    service = _service(tmp_path)
    record = {"subject_id": "P1", "alt_id": "F9", "context_id": "c1", "stage": "SOWN",
              "area_ha": 1.5, "note": "n", "geo_dimensions": {"woreda": {"code": "W1"}}}
    allowed = AllowedFields({"Work.context": frozenset({"subject_id", "context_id", "stage"})})
    rendered = service.dci_state_record(allowed.filter_flat(record, "Work.context"))
    assert rendered["subject"] == {"subject_id": "P1", "alt_id": None}
    assert rendered["season"] == {"id": "c1", "stage": "SOWN"}
    assert rendered["measures"] is None and rendered["location"] is None
    nothing = service.dci_state_record(AllowedFields({}).filter_flat(record, "Work.context"))
    assert nothing == {"@type": "ex:Season", "subject": None, "season": None, "measures": None, "location": None}


def test_a_second_format_beside_dci(tmp_path):
    (tmp_path / "templates").mkdir()
    (tmp_path / "templates" / "other.json.j2").write_text('{"id": {{ record.context_id | tojson }}}')
    service = _service(tmp_path, formats={"other": {"state": {"template": "templates/other.json.j2"}}})
    assert service.render_record("other", "state", {"context_id": "c1"}) == {"id": "c1"}
    # No dci template configured: the platform's generic DCI record.
    assert set(service.dci_state_record({"context_id": "c1"})) == {"subject_reference", "context", "state", "location"}
