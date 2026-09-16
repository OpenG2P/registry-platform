"""Unauthenticated httpx client for partner-api (signature auth; gate disables it)."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from helpers.config import Config


class PartnerApiError(AssertionError):
    """Raised when partner-api returns HTTP error or unexpected envelope."""


class PartnerClient:
    def __init__(self, cfg: Config):
        if not cfg.partner_api_base:
            raise RuntimeError("FUNC_PARTNER_API_BASE is required for PartnerClient")
        self.cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.partner_api_base.rstrip("/"),
            verify=cfg.verify_tls,
            timeout=60,
        )

    @classmethod
    def from_config(cls, cfg: Config) -> "PartnerClient":
        return cls(cfg)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PartnerClient":
        return self

    def __exit__(self, *args) -> None:
        self.close()

    def post_json(
        self,
        path: str,
        body: dict[str, Any],
        *,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        url = path
        if params:
            url = f"{path}?{urlencode(params)}"
        response = self._client.post(url, json=body)
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code >= 400:
            raise PartnerApiError(
                f"{path} -> HTTP {response.status_code}: {response.text[:500]}"
            )
        return payload if isinstance(payload, dict) else {"_raw": payload}
