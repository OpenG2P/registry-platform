"""Environment + reference extension constants for functional API / UI tests.

Register / intake form / section IDs match the shipped reference extension
seed SQL (Individual + Household registers).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _env_bool(name: str, default: bool = True) -> bool:
    raw = _env(name, "true" if default else "false").lower()
    return raw in {"1", "true", "yes", "on"}


# Reference extension registers
REGISTER_INDIVIDUAL = "a0000000-0000-4000-8000-000000000001"
REGISTER_HOUSEHOLD = "a0000000-0000-4000-8000-000000000002"
REGISTER_INDIVIDUAL_LAND = "b0000000-0000-4000-8000-000000000012"
REGISTER_INDIVIDUAL_LIVELIHOOD = "b0000000-0000-4000-8000-000000000013"
REGISTER_HOUSEHOLD_HOUSING = "b0000000-0000-4000-8000-000000000011"
REGISTER_HOUSEHOLD_ASSET = "b0000000-0000-4000-8000-000000000030"

INDIVIDUAL_INTAKE_FORM_ID = "c1000000-0000-4000-8000-000000000001"
INDIVIDUAL_INTAKE_TAB_ID = "form_tab_individual_intake"

HOUSEHOLD_INTAKE_FORM_ID = "c1000000-0000-4000-8000-000000000002"
HOUSEHOLD_INTAKE_TAB_ID = "form_tab_household_intake"

# Register UI tabs that host supporting TABLE sections (for get_tab_records)
INDIVIDUAL_LIVELIHOOD_TAB_ID = "individual_livelihood_tab"
HOUSEHOLD_HOUSING_SERVICES_TAB_ID = "household_housing_services_tab"

# Individual sections
DEMOGRAPHIC_SECTION_ID = "in_demographic_details"
HOUSEHOLD_LOOKUP_SECTION_ID = "d1e81461-ee90-483f-8cf2-19028657bca1"
INDIVIDUAL_LAND_SECTION_ID = "in_table_land"
INDIVIDUAL_LIVELIHOOD_SECTION_ID = "in_livelihood_employment"
INDIVIDUAL_LIVELIHOOD_TABLE_SECTION_ID = "in_table_livelihood"

# Household sections (intake + CR)
HH_COMPOSITION_HEADSHIP_SECTION_ID = "hh_composition_headship"
HH_LOCATION_SECTION_ID = "hh_location_details"
HH_DWELLING_SECTION_ID = "hh_dwelling_services"
HH_ASSETS_SECTION_ID = "hh_table_assets"
HH_HOUSING_TABLE_SECTION_ID = "hh_table_housing_services"

SEARCH_MARKER_INDIVIDUAL = "FUNCFT"
SEARCH_MARKER_HOUSEHOLD = "FUNCHH"

CR_FIELD_INDIVIDUAL = "middle_name"
CR_FIELD_HOUSEHOLD = "household_head_name"

# Back-compat aliases used by UI provision scripts
SEARCH_MARKER = SEARCH_MARKER_INDIVIDUAL
CR_DEFAULT_FIELD = CR_FIELD_INDIVIDUAL


@dataclass(frozen=True)
class Config:
    staff_api_base: str
    partner_api_base: str
    keycloak_base: str
    keycloak_realm: str
    oidc_client_id: str
    oidc_client_secret: str
    oidc_username: str
    oidc_password: str
    verify_tls: bool
    registry_dsn: str
    household_id: str
    document_upload_bucket: str
    ui_base: str

    @property
    def can_assert_db(self) -> bool:
        return bool(self.registry_dsn)

    @property
    def token_url(self) -> str:
        return (
            f"{self.keycloak_base.rstrip('/')}"
            f"/realms/{self.keycloak_realm}/protocol/openid-connect/token"
        )

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            staff_api_base=_env("FUNC_STAFF_API_BASE"),
            partner_api_base=_env("FUNC_PARTNER_API_BASE"),
            keycloak_base=_env("FUNC_KEYCLOAK_BASE"),
            keycloak_realm=_env("FUNC_KEYCLOAK_REALM", "staff"),
            oidc_client_id=_env("FUNC_OIDC_CLIENT_ID", "registry-staff-portal"),
            oidc_client_secret=_env("FUNC_OIDC_CLIENT_SECRET"),
            oidc_username=_env("FUNC_OIDC_USERNAME"),
            oidc_password=_env("FUNC_OIDC_PASSWORD"),
            verify_tls=_env_bool("FUNC_VERIFY_TLS", True),
            registry_dsn=_env("FUNC_REGISTRY_DSN"),
            household_id=_env("FUNC_HOUSEHOLD_ID"),
            document_upload_bucket=_env("FUNC_DOCUMENT_UPLOAD_BUCKET", "documents"),
            ui_base=_env("FUNC_UI_BASE"),
        )

    def require_api(self) -> None:
        missing = [
            name
            for name, value in [
                ("FUNC_STAFF_API_BASE", self.staff_api_base),
                ("FUNC_KEYCLOAK_BASE", self.keycloak_base),
                ("FUNC_OIDC_USERNAME", self.oidc_username),
                ("FUNC_OIDC_PASSWORD", self.oidc_password),
            ]
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Missing required env for staff-api provisioning: " + ", ".join(missing)
            )

    def require_partner_api(self) -> None:
        if not self.partner_api_base:
            raise RuntimeError(
                "FUNC_PARTNER_API_BASE is required for Partner Tier-3 tests"
            )

    def require_db(self) -> None:
        """API scenarios always dual-validate response + DB."""
        if not self.registry_dsn:
            raise RuntimeError(
                "FUNC_REGISTRY_DSN is required for API functional tests "
                "(response + DB assertions are mandatory)"
            )

    def require_household(self) -> None:
        if not self.household_id:
            raise RuntimeError(
                "FUNC_HOUSEHOLD_ID is required for individual intake "
                "(an existing Household register internal_record_id), "
                "or provision a household first and pass household_id explicitly"
            )

    def with_oidc_user(self, username: str, password: str) -> "Config":
        """Clone config with a different OIDC password-grant user."""
        return replace(
            self,
            oidc_username=username.strip(),
            oidc_password=password.strip(),
        )
