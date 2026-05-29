"""
Audit middleware — emits one CloudEvent to OpenG2P Audit Manager per
audited API call.

Mirrors the staff-portal-api middleware, but adapted to partner-api's
auth model:

  * Partner-api does NOT use Keycloak / JWT. Auth is signature-based:
    each request envelope carries `signature` + `header.sender_id` and
    is verified inside the controller via `keymanager_helper.validate_signature`.
  * As a result, `request.state.auth` is never populated by an upstream
    middleware. The middleware here therefore has no JWT/principal path
    to fall back on — see the actor strategy below.

Audit policy (v2):

  Request kind                                              | Audited?
  --------------------------------------------------------- | --------
  Controller set request.state.audit_actor (any outcome)    | YES
  No actor enrichment + outcome 2xx (legitimate sender)     | NO
  No actor enrichment + outcome non-2xx, audit_anonymous_failures=true | YES (anon)
  Health probes / OpenAPI surfaces / OPTIONS preflight      | NO

Actor identity strategy
-----------------------
Partner-api endpoints receive a body containing the sender id, but the
body has already been consumed by the time the middleware's `dispatch`
method runs `call_next`. To avoid double-parsing the body (with all the
`_receive`-replay risks that entails), we expose an OPT-IN hook:

  * If a controller sets `request.state.audit_actor = {...}` (any dict
    matching the OpenG2P Actor schema), the middleware uses that dict
    verbatim as `data.actor`.
  * Otherwise the middleware falls back to `actor.type="service",
    id="anonymous"` with only the IP recorded.

Recommended controller usage (after envelope parse, before the call to
keymanager.validate_signature):

  request.state.audit_actor = {
      "type": "service",
      "id": header.sender_id,
      "name": header.sender_uri or header.sender_id,
  }

This way the audit row carries the real partner identity without the
middleware having to re-read the body.

Known limitations on this service (vs staff-portal-api):

  1. Wrapped-error 200 responses: both `ingest_data` and `search` catch
     exceptions and return 200 with an error envelope. Those audit rows
     will currently show outcome=success — only an unhandled exception
     bubbling out of `call_next` is captured as failure. If you need
     finer-grained outcome tracking, set `request.state.audit_outcome
     = "failure"` (or similar) in the controller's error path; we honour
     it here when present.

  2. Anonymous fallback: until controllers set request.state.audit_actor,
     audit rows will identify callers only by IP. Acceptable for v1, but
     the actor enrichment hook is the right next step.

Emission is fire-and-forget via `asyncio.create_task` — never delays the
response. All errors are logged, never raised to the caller.

Disabled by default: set REGISTRY_PARTNER_API_AUDIT_ENABLED=true AND
REGISTRY_PARTNER_API_AUDIT_MANAGER_URL=<base-url> to turn on. Set
REGISTRY_PARTNER_API_AUDIT_ANONYMOUS_FAILURES=false to skip auditing of
rejected anonymous calls.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match

from .config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


_SKIP_PATHS = frozenset(
    {
        "/ping",
        "/openapi.json",
        "/docs",
        "/redoc",
        "/docs/oauth2-redirect",
    }
)


def _status_to_outcome(status_code: int) -> str:
    """Map HTTP status to CloudEvents outcome enum."""
    if 200 <= status_code < 300:
        return "success"
    if status_code in (401, 403):
        return "denied"
    return "failure"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _client_ip(request: Request) -> str | None:
    """Real client IP — prefer the first hop in `X-Forwarded-For` so audits
    behind Istio / a load balancer record the actual partner caller, not
    the proxy."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else None


class AuditMiddleware(BaseHTTPMiddleware):
    """Emit one CloudEvent to Audit Manager per audited partner-api call."""

    def __init__(
        self,
        app,
        *,
        audit_manager_url: str | None,
        enabled: bool = True,
        timeout_seconds: float = 2.0,
        source: str = "/openg2p/registry-partner-api",
        module: str = "registry-partner-api",
        type_prefix: str = "org.openg2p.partner_api",
        actor_state_key: str = "audit_actor",
        outcome_state_key: str = "audit_outcome",
        audit_anonymous_failures: bool = True,
    ):
        super().__init__(app)
        self._url = (audit_manager_url or "").rstrip("/")
        self._enabled = enabled and bool(self._url)
        self._timeout_seconds = timeout_seconds
        self._source = source
        self._module = module
        self._type_prefix = type_prefix.rstrip(".")
        self._actor_state_key = actor_state_key
        self._outcome_state_key = outcome_state_key
        self._audit_anonymous_failures = audit_anonymous_failures
        self._client: httpx.AsyncClient | None = None

        if self._enabled:
            _logger.info(
                "AuditMiddleware enabled — emitting to %s "
                "(audit_anonymous_failures=%s)",
                self._url + "/v1/auditmanager/events",
                self._audit_anonymous_failures,
            )
        else:
            _logger.info(
                "AuditMiddleware disabled (enabled=%s, url=%r). No-op.",
                enabled,
                audit_manager_url,
            )

    def _get_client(self) -> httpx.AsyncClient:
        # Lazy-create on first emit so import time is unaffected.
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout_seconds),
            )
        return self._client

    def _match_route(self, request: Request) -> Any | None:
        """Match the request to its FastAPI route."""
        router = getattr(request.app, "router", None)
        for route in getattr(router, "routes", []):
            match, _ = route.matches(request.scope)
            if match == Match.FULL:
                return route
        return None

    # ---------- audit decision ----------

    async def dispatch(self, request: Request, call_next):
        # Always run the inner stack first — never delay the caller's response.
        # If the inner stack raises, we still emit an audit event marked as
        # a 5xx failure before re-raising — exactly the kind of incident
        # operators want recorded.
        response = None
        raised: BaseException | None = None
        try:
            response = await call_next(request)
        except BaseException as exc:  # noqa: BLE001 — we re-raise below
            raised = exc

        # Skip-list checks apply to both success and failure paths.
        if self._enabled \
                and request.method != "OPTIONS" \
                and request.url.path not in _SKIP_PATHS:
            self._maybe_emit(request, response, raised)

        if raised is not None:
            raise raised
        return response

    def _maybe_emit(self, request: Request, response, raised) -> None:
        """Decide whether to emit, build the event, fire-and-forget."""
        actor_override = getattr(request.state, self._actor_state_key, None)
        outcome_override = getattr(request.state, self._outcome_state_key, None)

        # If the inner stack raised, treat this as outcome=failure / 500.
        # The actor may still be available (controller stashed it before
        # the crash) or may be missing.
        if raised is not None:
            status_code = 500
            is_success = False
        else:
            status_code = response.status_code
            # Honour controller-supplied outcome override (handles partner-api's
            # wrapped 200-on-error pattern). Fall back to HTTP status.
            if outcome_override in ("success", "failure", "denied"):
                is_success = (outcome_override == "success")
            else:
                is_success = 200 <= status_code < 300

        # Audit decision
        if actor_override is not None:
            pass  # controller set actor — always audit
        elif (not is_success) and self._audit_anonymous_failures:
            pass  # rejected anonymous — audit per v2 policy
        else:
            return  # successful anonymous — skip

        try:
            route = self._match_route(request)
            actor = self._build_actor(request, actor_override)
            event = self._build_event(
                request,
                response,
                status_code,
                actor,
                route,
                raised,
                outcome_override,
            )
            asyncio.create_task(self._emit(event))
        except Exception:
            _logger.exception("AuditMiddleware: failed to build event; skipping")

    # ---------- actor construction ----------

    def _build_actor(self, request: Request, actor_override) -> dict:
        """Produce the `data.actor` payload.

        Two paths, in order of preference:
          1. Controller-supplied dict via `request.state.audit_actor` —
             used verbatim. We add `ip` if it isn't already present.
          2. Anonymous fallback — actor.type=anonymous, only IP recorded.
        """
        ip = _client_ip(request)

        if isinstance(actor_override, dict):
            # Make a shallow copy so we don't mutate caller's state.
            actor = dict(actor_override)
            actor.setdefault("type", "service")
            actor.setdefault("id", "unknown")
            actor.setdefault("ip", ip)
            return actor

        # Anonymous fallback — controller didn't enrich identity, or the
        # inner stack crashed before it could.
        return {
            "type": "anonymous",
            "id": "anonymous",
            "ip": ip,
        }

    # ---------- event construction ----------

    def _build_event(
        self,
        request: Request,
        response,
        status_code: int,
        actor: dict,
        route,
        raised: BaseException | None,
        outcome_override,
    ) -> dict:
        # Endpoint function name → CloudEvents `type` and `action` derivation.
        func_name = "unknown"
        if route is not None and getattr(route, "endpoint", None) is not None:
            func_name = route.endpoint.__name__

        # First word of the function name as the action verb (best effort).
        # `ingest_data` → `ingest`, `search` → `search`. Keeps the action
        # column low-cardinality across the platform; full func_name is
        # preserved in `type` and the wire-level path in context.api.
        action = func_name.split("_", 1)[0] if "_" in func_name else func_name

        # Resolve outcome: controller override > exception > HTTP status
        if raised is not None:
            outcome = "failure"
        elif outcome_override in ("success", "failure", "denied"):
            outcome = outcome_override
        else:
            outcome = _status_to_outcome(status_code)

        # Build context, plus a `reason` when the inner stack raised.
        context: dict = {
            "api": f"{request.method} {request.url.path}",
            "module": self._module,
            "http_status": status_code,
            "request_id": request.headers.get("x-request-id"),
        }
        data: dict = {
            "actor": actor,
            "action": action,
            "outcome": outcome,
            "context": context,
        }
        if raised is not None:
            # Capture exception class + truncated message into reason so
            # ops can grep for "Connection refused" / etc. without leaking
            # full stack traces into the audit store.
            data["reason"] = (
                f"{type(raised).__name__}: {str(raised)[:200]}"
            )

        return {
            "specversion": "1.0",
            "id": str(uuid4()),
            "source": self._source,
            "type": f"{self._type_prefix}.{func_name}",
            "time": _now_iso(),
            "datacontenttype": "application/json",
            "data": data,
        }

    # ---------- emission ----------

    async def _emit(self, event: dict) -> None:
        """POST a single CloudEvent. Errors logged, never raised."""
        try:
            client = self._get_client()
            url = f"{self._url}/v1/auditmanager/events"
            resp = await client.post(url, json=event)
            if resp.status_code != 202:
                _logger.warning(
                    "Audit Manager returned %s for event %s: %s",
                    resp.status_code,
                    event["id"],
                    resp.text[:200],
                )
        except httpx.HTTPError as exc:
            _logger.warning(
                "Audit emission failed for event %s: %s", event["id"], exc
            )
        except Exception:
            _logger.exception(
                "Audit emission failed unexpectedly for event %s",
                event.get("id"),
            )
