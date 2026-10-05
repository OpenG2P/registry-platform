"""Data scopes without a database: references, version resolution, section expansion, filtering."""

from datetime import datetime

import pytest

# Imported when the tests run, not at collection: importing the services package
# while other modules are being collected pins classes they re-import (see
# test_activity_sample_service.py).
ALL = "*"
AllowedFields = ScopeVersionView = grant_from_refs = intersect = parse_ref = None
resolve_scope_grant = section_refs = split_scope_id = union = validate_ref = None


@pytest.fixture(autouse=True)
def _module():
    global AllowedFields, ScopeVersionView, grant_from_refs, intersect, parse_ref
    global resolve_scope_grant, section_refs, split_scope_id, union, validate_ref
    from openg2p_registry_core.services import g2p_data_scope_fields as m

    assert m.ALL == ALL
    AllowedFields, ScopeVersionView, grant_from_refs = m.AllowedFields, m.ScopeVersionView, m.grant_from_refs
    intersect, parse_ref, resolve_scope_grant = m.intersect, m.parse_ref, m.resolve_scope_grant
    section_refs, split_scope_id, union, validate_ref = m.section_refs, m.split_scope_id, m.union, m.validate_ref


T0 = datetime(2026, 1, 1)
T1 = datetime(2026, 3, 1)
T2 = datetime(2026, 6, 1)


def v(number, when, refs, renamed=None):
    return ScopeVersionView(number, when, refs, renamed)


# ---------------------------------------------------------------- references


@pytest.mark.parametrize(
    "ref, expected",
    [
        ("Farmer.phone_number", ("Farmer", "phone_number")),
        ("Land.*", ("Land", ALL)),
        ("Farmer.documents", ("Farmer", "documents")),
        ("Farmer.documents.id_proof", ("Farmer", "documents.id_proof")),
        ("CropSown.activity.crop", ("CropSown.activity", "crop")),
        ("CropSown.aggregate.*", ("CropSown.aggregate", ALL)),
        ("CropSown.context.stage", ("CropSown.context", "stage")),
    ],
)
def test_parse_ref(ref, expected):
    assert parse_ref(ref) == expected


@pytest.mark.parametrize("ref", ["Farmer", "Farmer.", "a.b.c", "CropSown.activity", "X.activity.a.b", ""])
def test_parse_ref_rejects_malformed(ref):
    with pytest.raises(ValueError):
        parse_ref(ref)


def test_validate_ref_names_the_problem():
    targets = {"Farmer": frozenset({"phone_number", "first_name"}), "CropSown.activity": frozenset({"crop"})}
    assert validate_ref("Farmer.phone_number", targets) is None
    assert validate_ref("Farmer.*", targets) is None
    assert validate_ref("Farmer.documents.id_proof", targets) is None
    assert "has no field 'phone'" in validate_ref("Farmer.phone", targets)
    assert "no register 'Land'" in validate_ref("Land.*", targets)
    assert validate_ref("CropSown.activity.crop", targets) is None
    assert "not an activity register" in validate_ref("CropSown.aggregate.x", targets)
    assert "no documents" in validate_ref("CropSown.activity.documents", targets)


def test_grant_set_algebra():
    a = grant_from_refs(["Land.*", "Farmer.first_name", "Farmer.documents"])
    b = grant_from_refs(["Land.area", "Farmer.first_name", "Farmer.phone", "Farmer.documents.id_proof"])
    assert intersect(a, b) == {
        "Land": frozenset({"area"}),
        "Farmer": frozenset({"first_name", "documents.id_proof"}),
    }
    assert union(a, b)["Land"] == ALL
    assert union(a, b)["Farmer"] == frozenset({"first_name", "phone", "documents", "documents.id_proof"})


# ---------------------------------------------------------------- resolution


def test_rename_is_a_new_version_with_the_same_meaning():
    versions = [
        v(1, T0, ["Farmer.first_name", "Farmer.phone"]),
        v(2, T1, ["Farmer.first_name", "Farmer.phone_number"], {"Farmer.phone": "Farmer.phone_number"}),
    ]
    # A consent given before the rename still gets the (renamed) field.
    assert resolve_scope_grant(versions, datetime(2026, 2, 1)) == {
        "Farmer": frozenset({"first_name", "phone_number"})
    }
    assert resolve_scope_grant(versions, T2) == {"Farmer": frozenset({"first_name", "phone_number"})}


def test_renames_chain_across_versions():
    versions = [
        v(1, T0, ["Farmer.tel"]),
        v(2, T1, ["Farmer.phone"], {"Farmer.tel": "Farmer.phone"}),
        v(3, T2, ["Farmer.phone_number"], {"Farmer.phone": "Farmer.phone_number"}),
    ]
    assert resolve_scope_grant(versions, datetime(2026, 2, 1)) == {"Farmer": frozenset({"phone_number"})}


def test_widening_does_not_reach_older_consents():
    versions = [v(1, T0, ["Farmer.first_name"]), v(2, T1, ["Farmer.first_name", "Farmer.phone_number"])]
    assert resolve_scope_grant(versions, datetime(2026, 2, 1)) == {"Farmer": frozenset({"first_name"})}
    # A consent given after the widening gets it.
    assert resolve_scope_grant(versions, T2) == {"Farmer": frozenset({"first_name", "phone_number"})}
    # Exactly at the new version's effective time: the new version is in effect.
    assert resolve_scope_grant(versions, T1) == {"Farmer": frozenset({"first_name", "phone_number"})}


def test_narrowing_applies_to_every_consent():
    versions = [v(1, T0, ["Farmer.first_name", "Farmer.phone_number"]), v(2, T1, ["Farmer.first_name"])]
    assert resolve_scope_grant(versions, datetime(2026, 2, 1)) == {"Farmer": frozenset({"first_name"})}
    assert resolve_scope_grant(versions, datetime(2025, 1, 1)) == {"Farmer": frozenset({"first_name"})}


def test_a_whole_register_narrowed_to_fields():
    versions = [v(1, T0, ["Land.*"]), v(2, T1, ["Land.area", "Land.crop"])]
    assert resolve_scope_grant(versions, datetime(2026, 2, 1)) == {"Land": frozenset({"area", "crop"})}


def test_no_issue_time_or_older_than_the_scope_reads_the_first_version():
    versions = [v(1, T1, ["Farmer.first_name"]), v(2, T2, ["Farmer.first_name", "Farmer.phone_number"])]
    assert resolve_scope_grant(versions, None) == {"Farmer": frozenset({"first_name"})}
    assert resolve_scope_grant(versions, T0) == {"Farmer": frozenset({"first_name"})}


def test_retired_scope_keeps_its_last_version():
    # A retired scope's versions end with its last one, which stands in for "current".
    versions = [v(1, T0, ["Farmer.first_name", "Farmer.gender"]), v(2, T1, ["Farmer.first_name"])]
    assert resolve_scope_grant(versions, T2) == {"Farmer": frozenset({"first_name"})}


def test_no_versions_grants_nothing():
    assert resolve_scope_grant([], T1) == {}


@pytest.mark.parametrize(
    "scope_id, controller, expected",
    [
        ("farmer-registry.land", "farmer-registry", "land"),
        ("crop-sown-registry.crop_season", "farmer-registry", None),  # another controller's
        ("land", "farmer-registry", None),  # not namespaced
        ("farmer-registry.", "farmer-registry", None),
        ("", "farmer-registry", None),
        ("land", "", "land"),  # no controller configured: bare names
    ],
)
def test_split_scope_id(scope_id, controller, expected):
    assert split_scope_id(scope_id, controller) == expected


# ---------------------------------------------------------------- sections

REGISTERS = {"r-farmer": "Farmer", "r-land": "Land", "r-household": "Household"}


def test_section_refs_from_ui_schema():
    schema = {
        "panels": [
            {"widgets": [
                {"widget": "text", "widget-data-path": "r-farmer.first_name"},
                {"widget": "text", "widget-data-path": "r-farmer.phone_numbers.0.number"},
                {"widget": "geo-hierarchy", "widget-data-path": {
                    "value": "r-farmer.geo_lowest_level_value_id", "hierarchy": "r-farmer.geo_code_hierarchy_json"}},
                {"widget": "file", "widget-data-path": "r-farmer.documents.id_proof"},
                {"widget": "table", "widget-data-path": "r-land.records", "widget-data-columns": [
                    {"widget": "number", "widget-data-path": "land_size"},
                    {"widget": "select", "widget-data-path": "unit"},
                ]},
                {"widget": "scores-display", "widget-data-path": "r-unknown.records"},
                {"widget": "table", "widget-data-path": "r-household.records"},
            ]},
        ],
    }
    refs, unknown = section_refs(schema, "r-farmer", REGISTERS)
    assert refs == sorted([
        "Farmer.first_name", "Farmer.phone_numbers", "Farmer.geo_lowest_level_value_id",
        "Farmer.geo_code_hierarchy_json", "Farmer.documents.id_proof", "Land.land_size", "Land.unit",
        "Household.*",
    ])
    # <id>.records of something that is not a register is reported, not guessed at.
    assert unknown == ["r-unknown.records"]


def test_section_bare_paths_belong_to_the_section_register():
    schema = {"widgets": [{"widget": "number", "widget-data-path": "land_size"}]}
    refs, _ = section_refs(schema, "r-land", REGISTERS)
    assert refs == ["Land.land_size"]


# ---------------------------------------------------------------- filtering

NESTED = {"land": "Land", "household": "Household", "farmer": "Farmer"}


def _farmer():
    return {
        "internal_record_id": "f-1",
        "foundational_id": "FAN-1",
        "first_name": "Almaz",
        "phone_number": "0911",
        "documents": [{"label": "id_proof", "document_id": "d1"}, {"label": "land_document", "document_id": "d2"}],
        "land": [{"internal_record_id": "l-1", "land_size": 2.5, "unit": "H", "owner_note": "x"}],
        "household": {"internal_record_id": "h-1", "size_of_group": 5, "address_line_1": "Kebele 3"},
    }


def test_register_record_filtered_with_linked_records():
    allowed = AllowedFields(grant_from_refs(["Farmer.first_name", "Farmer.documents.id_proof", "Land.land_size"]))
    out = allowed.filter_register_record(_farmer(), "Farmer", NESTED)
    assert out["first_name"] == "Almaz"
    assert out["foundational_id"] is None and out["phone_number"] is None and out["internal_record_id"] is None
    assert out["documents"] == [{"label": "id_proof", "document_id": "d1"}]
    assert out["land"] == [{"internal_record_id": None, "land_size": 2.5, "unit": None, "owner_note": None}]
    assert "household" not in out  # the parent's fields are not consented


def test_whole_child_register_and_parent():
    allowed = AllowedFields(grant_from_refs(["Land.*", "Household.size_of_group"]))
    out = allowed.filter_register_record(_farmer(), "Farmer", NESTED)
    assert out["first_name"] is None and out["documents"] == []
    assert out["land"] == _farmer()["land"]
    assert out["household"] == {"internal_record_id": None, "size_of_group": 5, "address_line_1": None}


def test_nothing_consented_keeps_the_shape_without_data():
    out = AllowedFields({}).filter_register_record(_farmer(), "Farmer", NESTED)
    assert out["land"] == [] and "household" not in out and out["documents"] == []
    assert all(out[k] is None for k in ("internal_record_id", "foundational_id", "first_name", "phone_number"))


def test_flat_records():
    allowed = AllowedFields(grant_from_refs(["CropSown.activity.crop", "CropSown.aggregate.*"]))
    activity = {"activity_id": "a1", "crop": "TEFF", "subject_id": "FAN-1"}
    assert allowed.filter_flat(activity, "CropSown.activity") == {"activity_id": None, "crop": "TEFF",
                                                                  "subject_id": None}
    aggregate = {"aggregate_type": "AREA", "aggregate_value": {"area": 1}}
    assert allowed.filter_flat(aggregate, "CropSown.aggregate") == aggregate
    assert allowed.filter_flat({"stage": "SOWN"}, "CropSown.context") == {"stage": None}


# ---------------------------------------------------------------- templates


@pytest.mark.parametrize(
    "template, expected",
    [
        ("{{ e.x | tojson }}", "null"),
        ("{{ e.x.y.z | tojson }}", "null"),
        ("[{% for i in e.missing %}{{ i }}{% endfor %}]", "[]"),
        ("{{ (e.x or '') | tojson }}", '""'),
        ("{{ e.x | length }}", "0"),
        ("{{ e.get('x') | tojson }}", "null"),
        ("{% if e.x %}yes{% else %}no{% endif %}", "no"),
    ],
)
def test_templates_render_missing_keys(template, expected):
    from openg2p_registry_core.helpers.template_helper import template_environment

    assert template_environment().from_string(template).render(e={}) == expected
