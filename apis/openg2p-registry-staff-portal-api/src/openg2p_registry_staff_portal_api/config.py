from openg2p_registry_extensions.config import Settings as ExtSettings
from pydantic_settings import SettingsConfigDict

from . import __version__


class Settings(ExtSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_staff_portal_api_", env_file=".env", extra="allow"
    )

    openapi_title: str = "OpenG2P Registry Staff Portal API"
    openapi_description: str = """
        FastAPI Service for OpenG2P Registry Staff Portal API
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

    # IAM authentication
    auth_provider_api_url: str | None = None
    keycloak_client_id: str | None = None

    # Keycloak Admin — sync DP_<policy_mnemonic> client roles on add/remove policy
    keycloak_admin_url: str | None = None
    keycloak_admin_client_id: str | None = None
    keycloak_admin_client_secret: str | None = None
    keycloak_admin_realm: str = "staff"
    keycloak_data_policy_role_sync_enabled: bool = True

    # OpenG2P Audit Manager integration
    # Both `audit_enabled=true` AND a non-empty `audit_manager_url` are
    # required to actually emit audits. Default = disabled / no-op.
    audit_enabled: bool = False
    audit_manager_url: str | None = None
    audit_timeout_seconds: float = 2.0
    audit_source: str = "/openg2p/registry-staff-portal-api"
    audit_module: str = "registry-staff-portal-api"

    # When true, also audit anonymous-looking calls that get rejected
    # (any non-2xx response without a valid principal). Captures attempted
    # unauthorized access (401) and JWT-with-missing-roles (403). Set to
    # false to revert to the original "audit only authenticated users" rule.
    audit_anonymous_failures: bool = True
