#!/usr/bin/env python3

# ruff: noqa: I001, E402

# --- Option C: select the domain-model extension module ---
# The platform code imports the domain model by the fixed name
# `openg2p_registry_extensions`. Here we alias the env-selected module into
# sys.modules BEFORE any such import runs, so the reference extension (default in
# RP images) or a variant extension is chosen purely by REGISTRY_EXTENSION_MODULE
# — no wheel.sources alias, no collision, both can coexist in one image.
import os as _os, sys as _sys, importlib as _il  # noqa: E402
_ext = _os.environ.get("REGISTRY_EXTENSION_MODULE", "openg2p_registry_extensions")
if _ext != "openg2p_registry_extensions":
    _sys.modules["openg2p_registry_extensions"] = _il.import_module(_ext)

from openg2p_registry_agent_portal_api.config import Settings
Settings.get_config()

from openg2p_fastapi_common.ping import PingInitializer
from openg2p_registry_agent_portal_api.app import Initializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

from iam_core.user_auth.app import Initializer as IAMInitializer
from iam_core.user_auth.middleware import (
    CsrfMiddleware,
    ResolvePermissionMiddleware,
    ValidateAndRefreshTokenMiddleware,
)

# Unauthenticated by design: liveness and the API description. The eSignet
# callback is NOT here — it is served by the staff portal's registrant-auth
# callback route, which already excludes itself.
AGENT_CSRF_EXCLUDED_PATHS = (
    "/ping",
    "/openapi.json",
    "/docs",
    "/redoc",
    "/docs/oauth2-redirect",
)

IAMInitializer()
CoreInitializer()
ExtensionsInitializer()
initializer = Initializer()
PingInitializer()

_config = Settings.get_config()

app = initializer.return_app()

# Middleware order (last added = outermost on inbound):
# CSRF -> ValidateAndRefresh -> ResolvePermission -> app
#
# Without ResolvePermissionMiddleware the @require_permissions decorators on the
# issuance routes would be inert, so this chain is what actually enforces that an
# agent — and only an agent — can issue.
app.add_middleware(
    ResolvePermissionMiddleware,
    client_id=_config.keycloak_client_id,
    allow_by_default=True,
)
app.add_middleware(ValidateAndRefreshTokenMiddleware)
app.add_middleware(
    CsrfMiddleware,
    enabled=_config.csrf_enabled,
    excluded_paths=AGENT_CSRF_EXCLUDED_PATHS,
)

if __name__ == "__main__":
    initializer.main()
