"""Call Master Data over REST (no connection to the master-data database)."""

from __future__ import annotations

import importlib
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from openg2p_fastapi_common.service import BaseService

from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_logger = logging.getLogger("g2p-master-data-client")

_ATTRIBUTE_PAGE_SIZE = 1000
_ATTRIBUTE_MAX_PAGES = 200
_SENDER_APP_MNEMONIC = "openg2p-registry"
_SENDER_APP_URL = "http://registry"


def get_master_data_settings() -> Any:
    """Use the running process Settings (partner-api / celery / staff / core).

    Core ``Settings.get_config`` only reads ``REGISTRY_CORE_*``. Child
    services set the same fields under their own env prefix, so pick the
    first imported Settings object that actually has an MS URL.
    """
    from ..config import Settings as CoreSettings

    candidates: list[Any] = [CoreSettings.get_config(strict=False)]
    for module_path in (
        "openg2p_registry_partner_api.config",
        "openg2p_registry_celery_worker.config",
        "openg2p_registry_staff_api.config",
    ):
        try:
            settings_cls = importlib.import_module(module_path).Settings
        except ImportError:
            continue
        candidates.append(settings_cls.get_config(strict=False))

    def _configured(cfg: Any) -> bool:
        return bool((getattr(cfg, "master_data_api_url", "") or "").strip())

    for cfg in reversed(candidates):
        if _configured(cfg):
            return cfg
    return candidates[0]


class MasterDataClient(BaseService):
    """Read code lists and geo hierarchy from the Master Data API.

    Cached in-process (``master_data_cache_seconds``). A cache miss walks
    ``POST /attributes/get_attribute_values`` and the geo list endpoints;
    later lookups stay local until TTL.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._access_token: Optional[str] = None
        self._access_token_expires_at: float = 0.0
        self._codes: Optional[dict[str, set[str]]] = None
        self._codes_expires_at: float = 0.0
        self._geo_index: Optional[dict[str, dict[str, Any]]] = None
        self._geo_index_expires_at: float = 0.0

    def _settings(self) -> Any:
        return get_master_data_settings()

    def is_configured(self, cfg: Any | None = None) -> bool:
        cfg = cfg or self._settings()
        return bool((getattr(cfg, "master_data_api_url", "") or "").strip())

    def _cache_ttl(self, cfg: Any) -> float:
        ttl = getattr(cfg, "master_data_cache_seconds", None)
        if ttl is None:
            ttl = getattr(cfg, "cache_expires_in_seconds", 300)
        return float(ttl or 0)

    def _timeout(self, cfg: Any) -> float:
        return float(getattr(cfg, "master_data_timeout_seconds", 10.0) or 10.0)

    def _api_url(self, cfg: Any) -> str:
        return (getattr(cfg, "master_data_api_url", "") or "").rstrip("/")

    def _token_url(self, cfg: Any) -> str:
        return (
            (getattr(cfg, "master_data_token_url", "") or "").strip()
            or (getattr(cfg, "partner_mgmt_admin_token_url", "") or "").strip()
        )

    def _client_id(self, cfg: Any) -> str:
        return (
            (getattr(cfg, "master_data_client_id", "") or "").strip()
            or (getattr(cfg, "partner_mgmt_admin_client_id", "") or "").strip()
        )

    def _client_secret(self, cfg: Any) -> str:
        return (
            (getattr(cfg, "master_data_client_secret", "") or "").strip()
            or (getattr(cfg, "partner_mgmt_admin_client_secret", "") or "").strip()
        )

    def _auth_configured(self, cfg: Any) -> bool:
        return bool(self._token_url(cfg) and self._client_id(cfg) and self._client_secret(cfg))

    def invalidate(self) -> None:
        self._codes = None
        self._codes_expires_at = 0.0
        self._geo_index = None
        self._geo_index_expires_at = 0.0

    def _not_configured(self) -> None:
        raise RuntimeError("Master Data API URL is not configured")

    def _request_failed(self, path: str, detail: str = "") -> None:
        message = f"Master Data API request failed: {path}"
        if detail:
            message = f"{message} ({detail})"
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
            message=message,
        )

    def _envelope(self, payload: dict[str, Any] | None, pagination: dict[str, Any] | None = None) -> dict:
        return {
            "request_header": {
                "sender_app_mnemonic": _SENDER_APP_MNEMONIC,
                "sender_app_url": _SENDER_APP_URL,
                "request_id": uuid.uuid4().hex,
                "request_timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "request_body": {
                "pagination_request": pagination,
                "request_payload": payload if payload is not None else {},
            },
        }

    async def _staff_token(self, client: httpx.AsyncClient, cfg: Any) -> Optional[str]:
        if not self._auth_configured(cfg):
            return None
        if self._access_token and time.monotonic() < self._access_token_expires_at:
            return self._access_token
        self._access_token = None
        resp = await client.post(
            self._token_url(cfg),
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id(cfg),
                "client_secret": self._client_secret(cfg),
            },
            timeout=self._timeout(cfg),
        )
        if resp.status_code >= 400:
            _logger.warning("Master Data token request failed: HTTP %s", resp.status_code)
            return None
        body = resp.json() or {}
        token = body.get("access_token")
        if not token:
            return None
        expires_in = body.get("expires_in")
        try:
            lifetime = float(expires_in) if expires_in is not None else 300.0
        except (TypeError, ValueError):
            lifetime = 300.0
        self._access_token = token
        self._access_token_expires_at = time.monotonic() + max(lifetime - 30.0, 1.0)
        return token

    def _response_payload(self, path: str, resp: httpx.Response) -> Any:
        if resp.status_code >= 400:
            self._request_failed(path, f"HTTP {resp.status_code}")
        try:
            body = resp.json() or {}
        except ValueError:
            self._request_failed(path, "invalid JSON")
        header = body.get("response_header") or {}
        status = str(header.get("response_status") or "").upper()
        if status and status != "SUCCESS":
            detail = header.get("response_error_message") or header.get("response_error_code") or status
            self._request_failed(path, str(detail))
        response_body = body.get("response_body") or {}
        return response_body.get("response_payload")

    async def _post(
        self,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        pagination: dict[str, Any] | None = None,
    ) -> Any:
        cfg = self._settings()
        base = self._api_url(cfg)
        if not base:
            self._not_configured()

        url = f"{base}{path}"
        envelope = self._envelope(payload, pagination)
        timeout = self._timeout(cfg)

        async with httpx.AsyncClient() as client:
            headers: dict[str, str] = {}
            token = await self._staff_token(client, cfg)
            if token:
                headers["Authorization"] = f"Bearer {token}"
            resp = await client.post(url, json=envelope, headers=headers, timeout=timeout)
            if resp.status_code == 401 and token:
                self._access_token = None
                self._access_token_expires_at = 0.0
                token = await self._staff_token(client, cfg)
                headers = {}
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                resp = await client.post(url, json=envelope, headers=headers, timeout=timeout)
            return self._response_payload(path, resp)

    async def get_attribute_codes(self) -> dict[str, set[str]]:
        cfg = self._settings()
        now = time.monotonic()
        ttl = self._cache_ttl(cfg)
        if ttl > 0 and self._codes is not None and now < self._codes_expires_at:
            return self._codes

        if not self.is_configured(cfg):
            self._not_configured()

        codes: dict[str, set[str]] = {}
        total: Optional[int] = None
        for page in range(1, _ATTRIBUTE_MAX_PAGES + 1):
            payload = await self._post(
                "/attributes/get_attribute_values",
                payload={"attribute_id": None},
                pagination={"current_page": page, "page_size": _ATTRIBUTE_PAGE_SIZE},
            )
            if isinstance(payload, dict):
                rows = payload.get("attribute_values") or []
                if total is None:
                    raw_total = payload.get("total")
                    try:
                        total = int(raw_total) if raw_total is not None else None
                    except (TypeError, ValueError):
                        total = None
            elif isinstance(payload, list):
                rows = payload
            else:
                rows = []

            for row in rows:
                if not isinstance(row, dict):
                    continue
                attribute_id = row.get("attribute_id")
                value_code = row.get("value_code")
                if attribute_id and value_code:
                    codes.setdefault(attribute_id, set()).add(value_code)

            if len(rows) < _ATTRIBUTE_PAGE_SIZE:
                break
            if total is not None and page * _ATTRIBUTE_PAGE_SIZE >= total:
                break

        self._codes = codes
        self._codes_expires_at = now + ttl if ttl > 0 else 0.0
        return codes

    async def _load_geo_index(self) -> dict[str, dict[str, Any]]:
        cfg = self._settings()
        now = time.monotonic()
        ttl = self._cache_ttl(cfg)
        if self._geo_index is not None and ttl > 0 and now < self._geo_index_expires_at:
            return self._geo_index

        if not self.is_configured(cfg):
            return {}

        levels_payload = await self._post("/geo/get_all_geo_levels", payload={})
        levels = levels_payload if isinstance(levels_payload, list) else []
        levels_by_id: dict[str, str] = {}
        for level in levels:
            if not isinstance(level, dict):
                continue
            level_id = level.get("level_id")
            mnemonic = level.get("level_mnemonic") or ""
            if level_id:
                levels_by_id[level_id] = mnemonic

        values_by_id: dict[str, dict[str, Any]] = {}
        for level_id, level_mnemonic in levels_by_id.items():
            values_payload = await self._post(
                "/geo/get_geo_level_values",
                payload={"level_id": level_id, "parent_level_value_id": None},
            )
            rows = values_payload if isinstance(values_payload, list) else []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                value_id = row.get("level_value_id")
                if not value_id:
                    continue
                values_by_id[value_id] = {
                    "level_value_id": value_id,
                    "level_id": row.get("level_id") or level_id,
                    "level_value_mnemonic": row.get("level_value_mnemonic") or "",
                    "parent_level_value_id": row.get("parent_level_value_id") or None,
                    "level_mnemonic": level_mnemonic,
                }

        self._geo_index = values_by_id
        self._geo_index_expires_at = now + ttl if ttl > 0 else 0.0
        return values_by_id

    async def get_geo_hierarchy(self, level_value_id: str) -> Optional[dict]:
        if not level_value_id:
            return None
        try:
            index = await self._load_geo_index()
        except Exception as exc:
            _logger.error("Error fetching geo hierarchy for %s: %s", level_value_id, exc)
            return None
        if not index:
            return None

        hierarchy: list[dict[str, Any]] = []
        current = level_value_id
        seen: set[str] = set()
        while current and current not in seen:
            seen.add(current)
            node = index.get(current)
            if not node:
                if not hierarchy:
                    _logger.warning("Geo level value not found: %s", level_value_id)
                    return None
                break
            hierarchy.append(
                {
                    "level_mnemonic": node["level_mnemonic"],
                    "level_value_mnemonic": node["level_value_mnemonic"],
                    "level_value_id": node["level_value_id"],
                }
            )
            current = node.get("parent_level_value_id")

        if not hierarchy:
            return None
        hierarchy.reverse()
        return {"hierarchy": hierarchy}
