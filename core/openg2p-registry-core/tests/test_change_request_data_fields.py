from openg2p_registry_core.schemas.change_request import (
    ChangeRequestData,
    ChangeRequestFlattenedData,
)


def _change_request_data(**extra) -> ChangeRequestData:
    payload = {
        "change_request_id": "cr1",
        "register_id": "r1",
        "tab_id": "t1",
        "internal_record_id": "i1",
        "section_id": "s1",
        "section_mnemonic": "personal",
        "section_register_id": "sr1",
        "source_partner_id": "staff",
        "created_by": "user",
    }
    payload.update(extra)
    return ChangeRequestData(**payload)


def test_change_request_data_lookup_fields_are_optional():
    data = _change_request_data()
    assert data.register_mnemonic is None
    assert data.tab_label is None


def test_change_request_data_includes_register_mnemonic_and_tab_label():
    data = _change_request_data(
        register_mnemonic="Farmer",
        tab_label="personal_info",
    )
    dumped = data.model_dump()
    assert dumped["register_mnemonic"] == "Farmer"
    assert dumped["tab_label"] == "personal_info"


def test_flattened_change_request_data_lookup_fields_are_optional():
    data = ChangeRequestFlattenedData(
        change_request_id="cr1",
        register_id="r1",
        tab_id="t1",
        internal_record_id="i1",
        section_id="s1",
        section_mnemonic="personal",
        source_partner_id="staff",
        created_by="user",
        first_name="Ada",
    )
    assert data.register_mnemonic is None
    assert data.tab_label is None
    assert data.first_name == "Ada"


def test_flattened_change_request_data_includes_register_mnemonic_and_tab_label():
    data = ChangeRequestFlattenedData(
        change_request_id="cr1",
        register_id="r1",
        register_mnemonic="Farmer",
        tab_id="t1",
        tab_label="personal_info",
        internal_record_id="i1",
        section_id="s1",
        section_mnemonic="personal",
        source_partner_id="staff",
        created_by="user",
    )
    dumped = data.model_dump()
    assert dumped["register_mnemonic"] == "Farmer"
    assert dumped["tab_label"] == "personal_info"
