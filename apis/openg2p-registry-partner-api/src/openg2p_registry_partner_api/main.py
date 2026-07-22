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


from openg2p_registry_partner_api.config import Settings
Settings.get_config()

from openg2p_registry_partner_api.app import Initializer
from openg2p_fastapi_common.ping import PingInitializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

from openg2p_registry_partner_api.audit_middleware import AuditMiddleware

CoreInitializer()
ExtensionsInitializer()
initializer = Initializer()
PingInitializer()

_config = Settings.get_config()

app = initializer.return_app()

# Partner-api has no ResolvePermissionMiddleware to chain after — AuditMiddleware
# is the only middleware here. It wraps every request, captures the
# outcome, and emits a CloudEvent to Audit Manager (fire-and-forget).
# Default = disabled / no-op until both REGISTRY_PARTNER_API_AUDIT_ENABLED
# and REGISTRY_PARTNER_API_AUDIT_MANAGER_URL are set.
app.add_middleware(
    AuditMiddleware,
    audit_manager_url=_config.audit_manager_url,
    enabled=_config.audit_enabled,
    timeout_seconds=_config.audit_timeout_seconds,
    source=_config.audit_source,
    module=_config.audit_module,
    audit_anonymous_failures=_config.audit_anonymous_failures,
)

if __name__ == "__main__":
    initializer.main()
