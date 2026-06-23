#!/usr/bin/env python3

# ruff: noqa: I001, E402

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
