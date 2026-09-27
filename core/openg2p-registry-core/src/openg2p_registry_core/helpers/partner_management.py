"""Look up and validate partners in Partner Management (no local partner table)."""

from __future__ import annotations

import importlib
import time
from dataclasses import dataclass
from typing import Any, Iterable, Optional

import httpx
from openg2p_fastapi_common.service import BaseService

from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_CACHE_MAX_ENTRIES = 1024


def partner_reference_id(sender_id: str) -> str:
    """Map an envelope sender / mnemonic to the PM partner_id.

    Same convention as DCI search and g2p-bridge: ``PARTNER_<SENDER>``
    (upper-cased, ``-`` → ``_``). A value that already starts with
    ``PARTNER_`` is only normalised.
    """
    raw = (sender_id or "").strip()
    normalised = raw.replace("-", "_").replace(" ", "_").upper()
    if normalised.startswith("PARTNER_"):
        return normalised
    return f"PARTNER_{normalised}" if normalised else ""


def get_partner_mgmt_settings() -> Any:
    """Use the running process Settings (partner-api / celery / staff / core).

    Core ``Settings.get_config`` only reads ``REGISTRY_CORE_*``. Child
    services set the same fields under their own env prefix, so pick the
    first imported Settings object that actually has a PM URL.
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
        return bool(
            (getattr(cfg, "partner_mgmt_admin_api_url", "") or "").strip()
            or (getattr(cfg, "partner_mgmt_api_url", "") or "").strip()
        )

    for cfg in reversed(candidates):
        if _configured(cfg):
            return cfg
    return candidates[0]


@dataclass(frozen=True)
class RegisteredPartner:
    partner_id: str
    name: str = ""
    status: str = "active"


class PartnerManagementClient(BaseService):
    """Validate a partner against Partner Management.

    Preferred: PM **staff-portal-api** ``GET /partners/{partner_id}``
    (client_credentials). Fallback: PM **partner-api** ``GET /keys/{id}``
    when staff credentials are not configured. Neither URL set → skip
    remote check (local/tests).
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._access_token: Optional[str] = None
        self._access_token_expires_at: float = 0.0
        # key -> (expires_at monotonic, partner or None for cached miss)
        self._partner_cache: dict[str, tuple[float, Optional[RegisteredPartner]]] = {}

    def _settings(self) -> Any:
        return get_partner_mgmt_settings()

    def _cache_ttl(self, cfg: Any) -> float:
        ttl = getattr(cfg, "partner_mgmt_cache_seconds", None)
        if ttl is None:
            ttl = getattr(cfg, "cache_expires_in_seconds", 300)
        return float(ttl or 0)

    def _cache_get(self, key: str) -> tuple[bool, Optional[RegisteredPartner]]:
        entry = self._partner_cache.get(key)
        if not entry:
            return False, None
        expires_at, partner = entry
        if time.monotonic() >= expires_at:
            self._partner_cache.pop(key, None)
            return False, None
        return True, partner

    def _cache_put(
        self, keys: Iterable[str], partner: Optional[RegisteredPartner], ttl: float
    ) -> None:
        if ttl <= 0:
            return
        now = time.monotonic()
        if len(self._partner_cache) >= _CACHE_MAX_ENTRIES:
            expired = [k for k, (exp, _) in self._partner_cache.items() if now >= exp]
            for k in expired:
                self._partner_cache.pop(k, None)
            if len(self._partner_cache) >= _CACHE_MAX_ENTRIES:
                self._partner_cache.clear()
        expires_at = now + ttl
        for key in keys:
            if key:
                self._partner_cache[key] = (expires_at, partner)

    def _admin_configured(self, cfg: Any) -> bool:
        return bool(
            (getattr(cfg, "partner_mgmt_admin_api_url", "") or "").strip()
            and (getattr(cfg, "partner_mgmt_admin_token_url", "") or "").strip()
            and (getattr(cfg, "partner_mgmt_admin_client_id", "") or "").strip()
            and (getattr(cfg, "partner_mgmt_admin_client_secret", "") or "").strip()
        )

    def _keys_configured(self, cfg: Any) -> bool:
        return bool((getattr(cfg, "partner_mgmt_api_url", "") or "").strip())

    def _timeout(self, cfg: Any) -> float:
        return float(getattr(cfg, "partner_mgmt_timeout_seconds", 5.0) or 5.0)

    async def _staff_token(self, client: httpx.AsyncClient, cfg: Any) -> str:
        if self._access_token and time.monotonic() < self._access_token_expires_at:
            return self._access_token
        self._access_token = None
        resp = await client.post(
            cfg.partner_mgmt_admin_token_url.rstrip("/"),
            data={
                "grant_type": "client_credentials",
                "client_id": cfg.partner_mgmt_admin_client_id,
                "client_secret": cfg.partner_mgmt_admin_client_secret,
            },
            timeout=self._timeout(cfg),
        )
        if resp.status_code >= 400:
            self._not_registered()
        body = resp.json() or {}
        token = body.get("access_token")
        if not token:
            self._not_registered()
        expires_in = body.get("expires_in")
        try:
            lifetime = float(expires_in) if expires_in is not None else 300.0
        except (TypeError, ValueError):
            lifetime = 300.0
        self._access_token = token
        self._access_token_expires_at = time.monotonic() + max(lifetime - 30.0, 1.0)
        return token

    def _not_registered(self) -> None:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.PARTNER_NOT_REGISTERED.value[1],
            message=G2PRegistryErrorCodes.PARTNER_NOT_REGISTERED.value[0],
        )

    async def _get_via_staff_api(
        self, client: httpx.AsyncClient, partner_id: str, cfg: Any
    ) -> Optional[RegisteredPartner]:
        token = await self._staff_token(client, cfg)
        url = f"{cfg.partner_mgmt_admin_api_url.rstrip('/')}/partners/{partner_id}"
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=self._timeout(cfg),
        )
        if resp.status_code == 401:
            self._access_token = None
            self._access_token_expires_at = 0.0
            token = await self._staff_token(client, cfg)
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=self._timeout(cfg),
            )
        if resp.status_code == 404:
            return None
        if resp.status_code >= 400:
            return None
        body = resp.json() or {}
        status = (body.get("status") or "").lower()
        if status != "active":
            return None
        return RegisteredPartner(
            partner_id=body.get("partner_id") or partner_id,
            name=body.get("name") or "",
            status=status,
        )

    async def _get_via_keys_api(
        self, client: httpx.AsyncClient, partner_id: str, cfg: Any
    ) -> Optional[RegisteredPartner]:
        url = f"{cfg.partner_mgmt_api_url.rstrip('/')}/keys/{partner_id}"
        resp = await client.get(url, timeout=self._timeout(cfg))
        if resp.status_code == 200:
            return RegisteredPartner(partner_id=partner_id, status="active")
        return None

    async def require_active_partner(self, sender_or_mnemonic: str) -> RegisteredPartner:
        mapped = partner_reference_id(sender_or_mnemonic)
        candidates = []
        raw = (sender_or_mnemonic or "").strip()
        if raw:
            candidates.append(raw)
        if mapped and mapped not in candidates:
            candidates.append(mapped)

        cfg = self._settings()
        ttl = self._cache_ttl(cfg)

        if ttl > 0:
            for candidate in candidates:
                hit, cached = self._cache_get(candidate)
                if hit:
                    if cached is None:
                        self._not_registered()
                    return cached

        if not self._admin_configured(cfg) and not self._keys_configured(cfg):
            partner_id = mapped or raw
            if not partner_id:
                self._not_registered()
            return RegisteredPartner(partner_id=partner_id)

        async with httpx.AsyncClient() as client:
            for candidate in candidates:
                partner: Optional[RegisteredPartner] = None
                if self._admin_configured(cfg):
                    partner = await self._get_via_staff_api(client, candidate, cfg)
                if partner is None and self._keys_configured(cfg):
                    partner = await self._get_via_keys_api(client, candidate, cfg)
                if partner is not None:
                    self._cache_put(
                        (*candidates, partner.partner_id),
                        partner,
                        ttl,
                    )
                    return partner

        self._cache_put(candidates, None, ttl)
        self._not_registered()
