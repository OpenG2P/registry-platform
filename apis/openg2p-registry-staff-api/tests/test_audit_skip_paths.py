"""The audit middleware skips health probes, the OpenAPI pages and the configured
skip paths (by default the staff portal's per-page configuration, theme and
language loads), and audits every other authenticated call."""

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from openg2p_registry_staff_api.audit_middleware import AuditMiddleware
from openg2p_registry_staff_api.config import Settings


def _app(skip_paths):
    app = FastAPI()

    @app.middleware("http")
    async def _authenticated(request: Request, call_next):
        request.state.audit_actor = {"type": "service", "id": "test"}
        return await call_next(request)

    @app.post("/registry-config/get_registry_configuration")
    async def get_registry_configuration():
        return {}

    @app.post("/register-data/get_tab_records")
    async def get_tab_records():
        return {}

    @app.get("/ping")
    async def ping():
        return "pong"

    app.add_middleware(
        AuditMiddleware,
        audit_manager_url="http://audit.test",
        skip_paths=skip_paths,
    )
    return app


def _emitted(monkeypatch, skip_paths, calls):
    events = []

    async def _emit(self, event):
        events.append(event)

    monkeypatch.setattr(AuditMiddleware, "_emit", _emit)
    with TestClient(_app(skip_paths)) as client:
        for method, path in calls:
            client.request(method, path)
    return [e["data"]["context"]["api"] for e in events]


def test_default_skip_paths_are_the_portal_page_loads():
    defaults = Settings.model_fields["audit_skip_paths"].default
    assert set(defaults) == {
        "/registry-config/get_registry_configuration",
        "/registry-theme/get_theme_values",
        "/registry-language/get_language",
    }


def test_skip_paths_are_not_audited(monkeypatch):
    apis = _emitted(
        monkeypatch,
        ["/registry-config/get_registry_configuration"],
        [
            ("POST", "/registry-config/get_registry_configuration"),
            ("POST", "/register-data/get_tab_records"),
            ("GET", "/ping"),
        ],
    )
    assert apis == ["POST /register-data/get_tab_records"]


def test_empty_skip_paths_audit_the_page_loads(monkeypatch):
    apis = _emitted(
        monkeypatch,
        [],
        [("POST", "/registry-config/get_registry_configuration"), ("GET", "/ping")],
    )
    assert apis == ["POST /registry-config/get_registry_configuration"]
