from openg2p_registry_extensions.config import Settings as ExtSettings
from pydantic_settings import SettingsConfigDict

from . import __version__


class Settings(ExtSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_bene_portal_api_", env_file=".env", extra="allow"
    )

    openapi_title: str = "OpenG2P Registry Beneficiary Portal API"
    openapi_description: str = """
        FastAPI Service for OpenG2P Registry Beneficiary Portal API
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
