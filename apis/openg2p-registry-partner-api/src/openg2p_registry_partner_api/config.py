from openg2p_registry_extensions.config import Settings as ExtSettings
from pydantic_settings import SettingsConfigDict

from . import __version__


class Settings(ExtSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_partner_api_", env_file=".env", extra="allow"
    )

    openapi_title: str = "OpenG2P Registry Partner API"
    openapi_description: str = """
        FastAPI Service for OpenG2P Registry Partner API
        ***********************************
        Further details goes here
        ***********************************
        """
    openapi_version: str = __version__

    # Registry Database
    db_username: str = "postgres"
    db_password: str = "password"
    db_hostname: str = "localhost"
    db_port: int = 5432
    db_dbname: str = "registrydb"

    # DCI Expression Search
    dci_expression_allowed_fields: list[str] = [
        "functional_record_id",
        "first_name",
        "middle_name",
        "last_name",
        "given_name",
        "gender",
        "birth_date",
        "foundational_id",
        "record_name",
        "record_status",
        "search_text",
        "marital_status",
        "income_level",
        "education_level",
        "residency_status",
        "disability_status",
        "displacement_status"
    ]

    # ------------------------------------------------------------------
    # Partner signature verification (transport) + Consent enforcement
    # ------------------------------------------------------------------
    # Two INDEPENDENT kill-switches. Both default ON (safe PII-egress
    # posture); dev/sanity deployments turn them OFF for testing. When a
    # switch is OFF the bypass is logged loudly and stamped into the
    # response header meta so a bypassed record is never mistaken for a
    # legitimately-authorised one.
    #
    #  * signature_validation_enabled -> verify the DCI envelope signature
    #    (the partner's detached JWS over {header, message}). OFF = accept
    #    any/unsigned caller.
    #  * consent_enforcement_enabled  -> call the Consent Manager /validate
    #    for the embedded consent object and clamp returned fields to the
    #    effective data scopes. OFF = skip CM entirely, return ALL fields.
    signature_validation_enabled: bool = True
    consent_enforcement_enabled: bool = True

    # Crypto backend selector (openg2p-fastapi-common build_crypto_helper):
    #   "partner-mgmt" -> verify partner keys fetched from Partner Management
    #                     (GET {partner_mgmt_api_url}/keys/{reference_id}).
    #   "keymanager"   -> legacy Mosip Keymanager service (kept selectable,
    #                     not the default; we are not encrypting yet).
    #   "local"        -> seed keys, for tests.
    crypto_backend: str = "partner-mgmt"
    # Algorithms accepted on the partner's DCI envelope JWS. fastapi-common
    # defaults to "RS256" only; partners commonly use EdDSA/ES256, so widen it.
    crypto_allowed_algorithms: str = "EdDSA,ES256,RS256"
    partner_mgmt_api_url: str = ""  # e.g. http://partner-management-partner-api:80

    # Consent Manager (PDP) — the /validate endpoint the registry (PEP) calls.
    consent_manager_url: str = ""  # e.g. http://consent-manager-partner-api:80
    consent_manager_timeout: float = 5.0

    # Keymanager settings
    keymanager_api_base_url: str = ""
    keymanager_api_timeout: int = 10
    keymanager_api_domain: str = "AUTH"
    keymanager_ssl_verify: bool = False
    keymanager_auth_enabled: bool = False
    keymanager_auth_url: str = ""
    keymanager_auth_client_id: str = "openg2p-registry-partner"
    keymanager_auth_client_secret: str = ""
    keymanager_sign_app_id: str = "REGISTRY"
    keymanager_sign_ref_id: str = ""

    # OpenG2P Audit Manager integration
    # Both `audit_enabled=true` AND a non-empty `audit_manager_url` are
    # required to actually emit audits. Default = disabled / no-op.
    audit_enabled: bool = False
    audit_manager_url: str | None = None
    audit_timeout_seconds: float = 2.0
    audit_source: str = "/openg2p/registry-partner-api"
    audit_module: str = "registry-partner-api"

    # When true, also audit anonymous-looking calls that get rejected
    # (any non-2xx response without controller-supplied actor enrichment).
    # Captures attempted unauthorized partner access. Set to false to
    # revert to "audit only enriched calls" rule.
    audit_anonymous_failures: bool = True

