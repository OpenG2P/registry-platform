"""OIDC password-grant token helper for staff-portal-api."""

from __future__ import annotations

import time

import httpx

from helpers.config import Config


class TokenCache:
    """Cached access token; refreshes ~30s before expiry."""

    def __init__(self, cfg: Config):
        self._cfg = cfg
        self._token: str | None = None
        self._exp = 0.0

    def token(self) -> str:
        now = time.time()
        if self._token and now < self._exp - 30:
            return self._token
        self._fetch()
        assert self._token is not None
        return self._token

    def _fetch(self) -> None:
        data = {
            "grant_type": "password",
            "client_id": self._cfg.oidc_client_id,
            "username": self._cfg.oidc_username,
            "password": self._cfg.oidc_password,
            "scope": "openid",
        }
        if self._cfg.oidc_client_secret:
            data["client_secret"] = self._cfg.oidc_client_secret

        response = httpx.post(
            self._cfg.token_url,
            data=data,
            verify=self._cfg.verify_tls,
            timeout=20,
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"password grant failed ({response.status_code}): {response.text[:300]}"
            )
        body = response.json()
        self._token = body["access_token"]
        self._exp = time.time() + int(body.get("expires_in", 300))

    def auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token()}"}
