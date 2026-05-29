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

