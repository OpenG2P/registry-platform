from typing import List, Optional

from openg2p_registry_extensions.config import Settings as ExtSettings
from pydantic import BaseModel
from pydantic_settings import SettingsConfigDict

from . import __version__


class VcDefinition(BaseModel):
    """One issuable credential type.

    The Registry Platform owns the *shape* of this contract; each manifestation
    (NSR, Farmer Registry, …) supplies the values, because the claim fields
    differ per registry.
    """

    # The Certify credential_config id this maps to.
    config_id: str
    credential_types: List[str] = []
    # A read-only registry view keyed on internal_record_id.
    view: str
    record_id_column: str = "internal_record_id"
    # Columns exposed as credential claims. Empty = every column except the key.
    claim_columns: List[str] = []
    # Card design shipped via ConfigMap and mounted at svg_template_dir.
    svg_template: Optional[str] = None
    # Where the signed compact QR lands in the credential returned by Certify.
    qr_claim_path: str = "claim169.qrCode"
    display_name: Optional[str] = None


class Settings(ExtSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_agent_portal_api_", env_file=".env", extra="allow"
    )

    openapi_title: str = "OpenG2P Registry Agent Portal API"
    openapi_description: str = """
        FastAPI service for the OpenG2P Registry Agent Portal.

        Issues verifiable credentials to beneficiaries at an agent counter. The
        agent is authenticated against Keycloak's `agent` realm; the beneficiary
        authenticates themselves through eSignet before anything is issued.
        """
    openapi_version: str = __version__

    # ── Feature switch ────────────────────────────────────────────────────────
    # The capability inside this service. The deployment itself is toggled
    # separately in the chart (agentPortalApi.enabled), so an operator can run
    # the service without issuance, or not run it at all. Off by default: an
    # existing registry taking a new chart version must be unaffected.
    vc_issuance_enabled: bool = False

    # Registry Database
    db_username: str = "postgres"
    db_password: str = "password"
    db_hostname: str = "localhost"
    db_port: int = 5432
    db_dbname: str = "registrydb"

    # ── IAM authentication (agents, Keycloak `agent` realm) ───────────────────
    # Agents are a distinct audience from staff: their own realm and their own
    # client, so a staff token carries no rights here.
    auth_provider_api_url: Optional[str] = None
    keycloak_client_id: Optional[str] = None
    # OFF by default, unlike the staff portal API.
    #
    # CsrfMiddleware is a double-submit check: it needs a csrf_token COOKIE that
    # matches an X-CSRF-Token header. That cookie is set by IAM's cookie-based
    # login, which the staff portal uses. The agent portal does NOT: its SPA
    # authenticates with keycloak-js and sends a Bearer token, so the cookie is
    # never issued and every POST — lookup, start_authentication, issue —
    # fails with "CSRF token missing or invalid".
    #
    # It is also unnecessary here. CSRF exploits credentials the browser
    # attaches automatically; an Authorization header is set by the app on each
    # call and is never sent cross-site on its own. Left as a switch so a
    # cookie-session deployment of this API can turn it back on.
    csrf_enabled: bool = False

    # ── Which register credentials are issued from ────────────────────────────
    # Phase 1 issues to an individual.
    vc_register_id: str = ""

    # ── Beneficiary authentication (eSignet, via registrant-authentication) ───
    # The provider row to use. Left empty, the first active provider on the
    # register is used.
    vc_auth_provider_id: str = ""
    # How long a completed beneficiary authentication may authorise an issuance,
    # measured from its completed_at. This is VC policy and is deliberately
    # independent of any expiry the authentication record carries for other
    # consumers of the same subsystem.
    vc_auth_window_seconds: int = 300
    # NOTE: binding the authenticated subject to the record is NOT configurable
    # and is not done here. Core refuses to complete an authentication whose
    # token subject differs from the record's foundational_id, so a SUCCESS
    # status already carries that guarantee.

    # ── Inji Certify ──────────────────────────────────────────────────────────
    # The agent portal is the OpenID4VCI client: it seeds an offer with the
    # claims, redeems the pre-authorized code, and asks for the signed
    # credential. Certify is reached in-cluster and is not exposed publicly.
    certify_base_url: str = "http://commons-services-inji-certify/v1/certify"
    certify_http_timeout: int = 30
    certify_offer_expires_in: int = 600
    certify_tx_code: str = "1234"
    certify_credential_format: str = "ldp_vc"
    certify_credential_context: List[str] = ["https://www.w3.org/2018/credentials/v1"]
    # Must match the audience Certify is configured to accept on the proof JWT.
    certify_audience: str = "http://localhost:8090/v1/certify"

    # ── Credential definitions (supplied by the manifestation) ────────────────
    vc_definitions: List[VcDefinition] = []

    # ── PDF rendering ─────────────────────────────────────────────────────────
    svg_template_dir: str = "/app/pdf-templates"
    pdf_issuer_name: str = "Government of "
    pdf_title: str = "Beneficiary Credential"

    def get_vc_definition(self, config_id: Optional[str] = None) -> Optional[VcDefinition]:
        """Resolve a credential definition, defaulting to the only one configured."""
        if not self.vc_definitions:
            return None
        if not config_id:
            return self.vc_definitions[0]
        for definition in self.vc_definitions:
            if definition.config_id == config_id:
                return definition
        return None
