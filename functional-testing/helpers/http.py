"""Authenticated httpx client for staff-portal-api."""

from __future__ import annotations

import uuid
from typing import Any

import httpx

from helpers.auth import TokenCache
from helpers.config import Config
from helpers.request_builder import build_g2p_request


class StaffApiError(AssertionError):
    """Raised when the API returns HTTP error or G2P response_status=ERROR."""


class StaffClient:
    """Thin authenticated wrapper. Failures raise StaffApiError (pytest-friendly)."""

    def __init__(self, cfg: Config, tokens: TokenCache):
        self.cfg = cfg
        self.tokens = tokens
        csrf = uuid.uuid4().hex
        self._client = httpx.Client(
            base_url=cfg.staff_api_base.rstrip("/"),
            verify=cfg.verify_tls,
            timeout=60,
            headers={
                "Authorization": f"Bearer {tokens.token()}",
                "X-CSRF-Token": csrf,
            },
            cookies={"X-CSRF-Token": csrf},
        )

    @classmethod
    def login(cls, cfg: Config) -> "StaffClient":
        return cls(cfg, TokenCache(cfg))

    @classmethod
    def login_as(cls, cfg: Config, username: str, password: str) -> "StaffClient":
        """Authenticate as a specific Keycloak user for AWE stage tests."""
        user_cfg = cfg.with_oidc_user(username, password)
        return cls(user_cfg, TokenCache(user_cfg))

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "StaffClient":
        return self

    def __exit__(self, *args) -> None:
        self.close()

    def _refresh_auth_header(self) -> None:
        self._client.headers["Authorization"] = f"Bearer {self.tokens.token()}"

    def post_json(
        self,
        path: str,
        request_payload: dict[str, Any],
        pagination_request: dict[str, Any] | None = None,
        **envelope_kwargs,
    ) -> dict[str, Any]:
        self._refresh_auth_header()
        body = build_g2p_request(
            request_payload=request_payload,
            pagination_request=pagination_request,
            sender_app_url=self.cfg.staff_api_base,
            **envelope_kwargs,
        )
        response = self._client.post(path, json=body)
        return self._finalize(response, path)

    def post_multipart(self, path: str, files, data: dict[str, str]) -> dict[str, Any]:
        self._refresh_auth_header()
        headers = {k: v for k, v in self._client.headers.items() if k.lower() != "content-type"}
        response = self._client.post(path, files=files, data=data, headers=headers)
        return self._finalize(response, path)

    @staticmethod
    def _finalize(response: httpx.Response, path: str) -> dict[str, Any]:
        try:
            body = response.json()
        except ValueError:
            body = {}

        if response.status_code >= 400:
            raise StaffApiError(f"{path} -> HTTP {response.status_code}: {response.text[:500]}")

        header = body.get("response_header") or {}
        if header.get("response_status") == "ERROR":
            req_id = header.get("request_id") or ""
            raise StaffApiError(
                f"{path} -> ERROR {header.get('response_error_code')}: "
                f"{header.get('response_error_message')}"
                + (f" (request_id={req_id})" if req_id else "")
            )
        return body

    @staticmethod
    def payload(body: dict[str, Any]) -> dict[str, Any]:
        return (body.get("response_body") or {}).get("response_payload") or {}
