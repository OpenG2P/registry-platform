"""Register profiles for Individual + Household functional API scenarios."""

from __future__ import annotations

from dataclasses import dataclass

from helpers.config import (
    CR_FIELD_HOUSEHOLD,
    CR_FIELD_INDIVIDUAL,
    DEMOGRAPHIC_SECTION_ID,
    HH_COMPOSITION_HEADSHIP_SECTION_ID,
    HOUSEHOLD_INTAKE_FORM_ID,
    HOUSEHOLD_INTAKE_TAB_ID,
    INDIVIDUAL_INTAKE_FORM_ID,
    INDIVIDUAL_INTAKE_TAB_ID,
    REGISTER_HOUSEHOLD,
    REGISTER_INDIVIDUAL,
    SEARCH_MARKER_HOUSEHOLD,
    SEARCH_MARKER_INDIVIDUAL,
)


@dataclass(frozen=True)
class RegisterProfile:
    key: str
    register_id: str
    intake_form_id: str
    intake_tab_id: str
    cr_section_id: str
    cr_field: str
    search_marker: str
    # Subject identity field used for search + DB lookup
    identity_field: str
    # Extra subject fields that must match between API get_subject_record and DB
    match_fields: tuple[str, ...]
    needs_linked_household: bool
    # True when cr_field is declared on the history *schema* (core person/geo),
    # so CR approve persists it into the history row. Domain-only fields are
    # applied to the live register but intentionally omitted from history schemas.
    history_persists_cr_field: bool
    # Primary register UI tab (version/history + subject section reads)
    primary_tab_id: str


INDIVIDUAL = RegisterProfile(
    key="individual",
    register_id=REGISTER_INDIVIDUAL,
    intake_form_id=INDIVIDUAL_INTAKE_FORM_ID,
    intake_tab_id=INDIVIDUAL_INTAKE_TAB_ID,
    cr_section_id=DEMOGRAPHIC_SECTION_ID,
    cr_field=CR_FIELD_INDIVIDUAL,
    search_marker=SEARCH_MARKER_INDIVIDUAL,
    identity_field="first_name",
    match_fields=(
        "first_name",
        "middle_name",
        "last_name",
        "birth_date",
        "gender",
        "marital_status",
        "address_line_1",
        "postal_code",
        "country_code",
        "relationship_to_head",
        "primary_livelihood",
        "secondary_livelihood",
        "employment_status",
        "coping_strategies_index",
    ),
    needs_linked_household=True,
    # middle_name lives on G2PPersonHistorySchema
    history_persists_cr_field=True,
    primary_tab_id="individual_info_tab",
)

HOUSEHOLD = RegisterProfile(
    key="household",
    register_id=REGISTER_HOUSEHOLD,
    intake_form_id=HOUSEHOLD_INTAKE_FORM_ID,
    intake_tab_id=HOUSEHOLD_INTAKE_TAB_ID,
    cr_section_id=HH_COMPOSITION_HEADSHIP_SECTION_ID,
    cr_field=CR_FIELD_HOUSEHOLD,
    search_marker=SEARCH_MARKER_HOUSEHOLD,
    identity_field="household_head_name",
    match_fields=(
        "household_head_name",
        "headship_type",
        "size_total",
        "size_adults",
        "size_children_u5",
        "address_line_1",
        "postal_code",
        "country_code",
        "dwelling_type",
        "tenure_status",
        "roof_material",
        "wall_material",
        "floor_material",
    ),
    needs_linked_household=False,
    # household_head_name is domain-only; history schema is core+geo (+husband_dead)
    history_persists_cr_field=False,
    primary_tab_id="household_info_tab",
)

ALL_PROFILES: tuple[RegisterProfile, ...] = (INDIVIDUAL, HOUSEHOLD)


def profile_id(profile: RegisterProfile) -> str:
    return profile.key
