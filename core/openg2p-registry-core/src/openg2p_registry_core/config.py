from openg2p_fastapi_common.config import Settings as BaseSettings
from iam_core.user_auth.config import Settings as IamSettings
from pydantic_settings import SettingsConfigDict

from . import __version__


class Settings(IamSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_core_", env_file=".env", extra="allow"
    )

    openapi_title: str = "OpenG2P Registry Core"
    openapi_description: str = """
        FastAPI Service for OpenG2P Registry Core
        ***********************************
        Further details goes here
        ***********************************
        """
    openapi_version: str = __version__

    # Document Storage Configuration
    # Backend for the DocumentHandler factory. Bucket names are hard-set by
    # the DocumentBucket enum and are not configurable.
    document_storage_backend: str = "minio"

    # MinIO Configuration
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "admin"
    minio_secret_key: str = "secret"
    # Presigned GET URLs; empty falls back to minio_access_key
    minio_read_access_key: str = ""
    minio_read_secret_key: str = ""
    minio_secure: bool = False

    # Document upload validation (`documents` / `default` buckets)
    document_upload_allowed_extensions: str = "png,jpg,jpeg,webp,pdf"
    document_upload_allowed_mime_types: str = (
        "image/png,image/jpeg,image/webp,application/pdf"
    )
    document_upload_max_bytes: int = 10 * 1024 * 1024
    document_upload_max_bytes_by_mime: str = (
        '{"image/png":5242880,"image/jpeg":5242880,'
        '"image/webp":5242880,"application/pdf":10485760}'
    )

    # Template upload validation (`templates` bucket)
    template_upload_allowed_extensions: str = "json.j2"
    template_upload_allowed_mime_types: str = "text/plain,application/json"
    template_upload_max_bytes: int = 1 * 1024 * 1024
    template_upload_max_bytes_by_mime: str = "{}"

    # Partner Management — ingest validates PARTNER here (no local partner table).
    # Staff-portal-api GET /partners/{id} is preferred (client_credentials).
    partner_mgmt_admin_api_url: str = ""  # e.g. http://commons-services-pm-staff-portal-api
    partner_mgmt_admin_token_url: str = ""  # Keycloak token endpoint
    partner_mgmt_admin_client_id: str = ""
    partner_mgmt_admin_client_secret: str = ""
    # Fallback: unauthenticated key-fetch (same partner_id space as staff API).
    partner_mgmt_api_url: str = ""  # e.g. http://commons-services-pm-partner-api
    partner_mgmt_timeout_seconds: float = 5.0
    # In-process TTL for partner lookups (0 disables). Avoids one PM call per ingest row.
    partner_mgmt_cache_seconds: int = 300

    # Master Data Database Configuration
    master_data_db_driver: str = "postgresql+asyncpg"
    master_data_db_username: str = "postgres"
    master_data_db_password: str = "postgres"
    master_data_db_hostname: str = "localhost"
    master_data_db_port: int = 5432
    master_data_db_dbname: str = "openg2p_gen2_master_data_db"

    # Cache Configuration
    cache_expires_in_seconds: int = 60 * 5

    # WebSub Hub
    websub_base_url: str = "http://websub.play.svc.cluster.local"

    # Registrant Authentication (OIDC widget)
    registrant_auth_session_ttl_seconds: int = 300
    registrant_auth_session_store_backend: str = "redis"  # memory|redis
    registrant_auth_redis_url: str | None = "redis://localhost:6379/0"  # Redis URL for storing session data
    registrant_auth_claims_encryption_key: str | None = None

    # Check a record's coded values against the lists seeded from the country
    # pack (see the db-seed LOAD_ATTRIBUTES step). Off by default: with it off,
    # submission validates exactly as it does today, via the compiled enums.
    # Turn it on once the lists are seeded — that is what makes the enums
    # removable, since they are the only thing checking values until then.
    validate_attribute_values: bool = False

    # AWE (Approval Workflow Engine) client
    awe_enabled: bool = False
    # Host only, e.g. https://awe.dev.openg2p.org (do not include /v1/awe)
    awe_base_url: str = "http://localhost:8000"
    awe_http_timeout_seconds: float = 30.0
    awe_default_callback_url: str | None = None
    awe_callback_secret_id: str | None = None
    # Inbound AWE webhook (terminal decision callbacks)
    awe_callback_hmac_secret: str | None = None
    awe_webhook_timestamp_tolerance_seconds: int = 300
    
    # Keycloak Admin API — publish data policies as DP_<mnemonic> client roles (tactical 1.2.0)
    keycloak_admin_url: str | None = "https://keycloak.dev.openg2p.org"
    keycloak_admin_client_id: str | None = "openg2p-staff-portal"
    keycloak_admin_client_secret: str | None = "client-secret"
    keycloak_admin_realm: str = "master"
    keycloak_data_policy_role_sync_enabled: bool = True

    keycloak_client_id: str = "registry-staff-portal"
    keycloak_realm: str = "staff"

    # Intake submission application reference generation
    application_reference_format: str = "{DATE:%Y%b%d|upper}-{SECONDS:5}{RAND:1}"