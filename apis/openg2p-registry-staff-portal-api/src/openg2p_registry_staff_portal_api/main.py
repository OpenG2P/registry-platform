#!/usr/bin/env python3

# ruff: noqa: I001, E402
from openg2p_registry_staff_portal_api.config import Settings
Settings.get_config()

from openg2p_fastapi_common.ping import PingInitializer
from openg2p_registry_staff_portal_api.app import Initializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

from iam_core.user_auth.app import Initializer as IAMInitializer
from iam_core.user_auth.middleware import AuthMiddleware
from openg2p_registry_staff_portal_api.audit_middleware import AuditMiddleware
from openg2p_registry_staff_portal_api.data_policy_middleware import DataPolicyMiddleware


IAMInitializer()
CoreInitializer()
ExtensionsInitializer()
initializer = Initializer()
PingInitializer()

_config = Settings.get_config()

app = initializer.return_app()

# Middleware order (last added = outermost on inbound):
# Audit -> Auth -> DataPolicy -> app
app.add_middleware(
    DataPolicyMiddleware,
    client_id=_config.keycloak_client_id,
)
app.add_middleware(
    AuthMiddleware,
    client_id=_config.keycloak_client_id,
    allow_by_default=True,
)

# AuditMiddleware is added AFTER AuthMiddleware so it becomes the OUTERMOST
# wrapper. By the time it runs after `call_next`, AuthMiddleware has already
# populated `request.state.auth` and the response status code is final.
app.add_middleware(
    AuditMiddleware,
    audit_manager_url=_config.audit_manager_url,
    enabled=_config.audit_enabled,
    timeout_seconds=_config.audit_timeout_seconds,
    source=_config.audit_source,
    module=_config.audit_module,
    client_id=_config.keycloak_client_id,
    audit_anonymous_failures=_config.audit_anonymous_failures,
)

if __name__ == "__main__":
    initializer.main()
