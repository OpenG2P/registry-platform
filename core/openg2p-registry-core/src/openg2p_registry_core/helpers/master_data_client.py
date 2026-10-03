"""Reads of Master Data (MDS) through its catalogue API.

The registry reads code lists, geography and sample people from MDS. With
``master_data_read_mode = "api"`` (the default) it does so through MDS's
``/catalogue`` (and ``/samples``) API with this client; ``"db"`` keeps the old
direct reads of MDS's current-state tables as a rollback switch.

One client per process (``get_master_data_client()``), shared by the APIs'
request handlers, the Celery worker's tasks and the activity services.

Caching — by version
--------------------
A published catalogue version never changes, so:

* the values of a list are cached under ``(list_id, version_no,
  include_retired)`` and a geography unit with its ancestors under
  ``(unit_id, geo version_no)`` — kept until evicted (bounded LRU), never
  re-read;
* what "latest" (or the pinned release) means — the version number in effect
  for a list, and for the geography — is a small pointer, resolved with
  ``get_list`` / ``get_geo_levels`` and kept until the catalogue changes.

How "latest" is refreshed — the change feed
-------------------------------------------
At most every ``poll_seconds`` (checked on the next read; no background task,
so it works the same in a web worker, a Celery task and a test) the client
reads ``get_changes`` from its stored cursor. A ``list.version.published`` /
``.effective`` / ``.migrated`` event marks that list's pointer stale, a
``geo.version.*`` event the geography pointer, a ``release.*`` event every
pointer when reads are pinned to a release. A stale pointer is re-resolved on
its next use. The first poll only moves the cursor to the head of the feed
(nothing is cached yet). As a safety net a pointer is also re-resolved after
``latest_max_age_seconds`` even if no event named it.

Stale on error
--------------
When MDS cannot be reached (connection error, timeout, HTTP 5xx), a pointer
that cannot be re-resolved keeps its last good version, and that version's
cached data keeps being served; the failure is logged (at most once a minute).
Only data never fetched before raises ``MasterDataUnavailable``.

Authentication
--------------
MDS reads need an authenticated caller. The client obtains a token from
Keycloak with the client-credentials grant (the registry's own confidential
client), caches it until shortly before it expires, and on a 401 drops it and
retries once. A user's token is deliberately NOT forwarded: MDS applies the
caller's data policies to some reads, so a user-specific answer would poison a
cache shared by everyone (and a Celery task has no user anyway).

This module needs only httpx and the standard library.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Union

import httpx

_logger = logging.getLogger("master-data-client")

API = "api"
DB = "db"

VersionRef = Union[int, str, None]

# Events after which what "latest" means for a list / the geography may differ.
_LIST_VERSION_EVENTS = ("list.version.published", "list.version.effective", "list.version.migrated")
_GEO_VERSION_EVENTS = ("geo.version.published", "geo.version.effective", "geo.version.migrated")
_LIST_SET_EVENTS = ("list.created", "list.deleted", "list.updated") + _LIST_VERSION_EVENTS


class MasterDataError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


class MasterDataNotFound(MasterDataError):
    """MDS answered G2P-CAT-404: no such list, value, unit, version or release."""


class MasterDataUnavailable(MasterDataError):
    """MDS could not be reached, timed out or failed (5xx), and nothing cached can stand in."""


@dataclass(frozen=True)
class ListSnapshot:
    """A list's values at one version."""

    list_id: str
    list_code: str
    version_no: int
    values: tuple[dict, ...]

    @property
    def by_code(self) -> dict[str, dict]:
        return {v["value_code"]: v for v in self.values}

    def codes(self, *, active_only: bool = True) -> set[str]:
        return {v["value_code"] for v in self.values if not active_only or v.get("status", "ACTIVE") == "ACTIVE"}

    def labels(self) -> dict[str, Optional[str]]:
        return {v["value_code"]: v.get("display") for v in self.values}


@dataclass(frozen=True)
class GeoUnitView:
    unit_id: str
    name: str
    level_id: str
    level_mnemonic: Optional[str]
    parent_unit_id: Optional[str]
    status: str = "ACTIVE"


@dataclass(frozen=True)
class GeoChain:
    """A unit and its ancestors at one geography version, top level first (the unit last)."""

    version_no: int
    units: tuple[GeoUnitView, ...]

    @property
    def unit(self) -> GeoUnitView:
        return self.units[-1]

    @property
    def active(self) -> bool:
        return all(u.status == "ACTIVE" for u in self.units)


@dataclass
class _Pointer:
    """What "latest" / the pinned release resolves to, for one list or the geography."""

    version_no: int
    list_id: Optional[str] = None
    list_code: Optional[str] = None
    resolved_at: float = 0.0
    stale: bool = False


@dataclass
class MasterDataClientConfig:
    base_url: str
    token_url: str = ""
    client_id: str = ""
    client_secret: str = ""
    # Pin every read to this catalogue release (a list the release does not pin
    # is read at its latest version, logged once). Empty: latest.
    release: str = ""
    timeout_seconds: float = 10.0
    poll_seconds: float = 30.0
    latest_max_age_seconds: float = 900.0
    max_list_versions: int = 512
    max_geo_units: int = 50000
    page_size: int = 1000
    sender_app_mnemonic: str = "registry"
    extra_headers: dict = field(default_factory=dict)


class _Lru:
    """A small bounded LRU map."""

    def __init__(self, max_entries: int):
        self._max = max(int(max_entries), 1)
        self._data: OrderedDict = OrderedDict()

    def get(self, key, default=None):
        if key in self._data:
            self._data.move_to_end(key)
            return self._data[key]
        return default

    def __contains__(self, key) -> bool:
        return key in self._data

    def put(self, key, value):
        self._data[key] = value
        self._data.move_to_end(key)
        while len(self._data) > self._max:
            self._data.popitem(last=False)
        return value

    def clear(self) -> None:
        self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


_MISSING = object()


class MasterDataClient:
    def __init__(self, config: MasterDataClientConfig, *, transport: Optional[httpx.AsyncBaseTransport] = None):
        self.config = config
        self._transport = transport
        # One pooled HTTP client, bound to the event loop it was created on. A
        # call from another loop (the sync geo-hierarchy path runs a coroutine
        # in a worker thread; Celery tasks run their own loops) gets a fresh
        # pool when the old loop is gone, else a short-lived client.
        self._http: Optional[httpx.AsyncClient] = None
        self._http_loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        # Token
        self._token: Optional[str] = None
        self._token_expires_at = 0.0
        # Change feed
        self._cursor: Optional[int] = None
        self._next_poll_at = 0.0
        self._polling = False
        # Pointers ("latest"/release -> version) and versioned data
        self._list_pointers: dict[str, _Pointer] = {}
        self._geo_pointer: Optional[_Pointer] = None
        self._lists_summary: Optional[list[dict]] = None
        self._lists_summary_stale = True
        self._lists_summary_at = 0.0
        self._list_values = _Lru(config.max_list_versions)
        self._list_value = _Lru(config.max_geo_units)
        self._geo_levels = _Lru(64)
        self._geo_units = _Lru(config.max_geo_units)
        self._unpinned_logged: set[str] = set()
        self._last_error_log = 0.0
        self.stats = {"requests": 0, "token_requests": 0, "stale_served": 0}

    # ================================================================ plumbing

    def _client_for_loop(self) -> tuple[httpx.AsyncClient, bool]:
        """(client, owned): owned clients must be closed by the caller."""
        loop = asyncio.get_running_loop()
        with self._lock:
            if self._http is not None and self._http_loop is loop:
                return self._http, False
            if self._http is None or self._http_loop is None or self._http_loop.is_closed():
                self._http = self._new_http()
                self._http_loop = loop
                return self._http, False
        return self._new_http(), True

    def _new_http(self) -> httpx.AsyncClient:
        timeout = httpx.Timeout(self.config.timeout_seconds, connect=min(self.config.timeout_seconds, 5.0))
        return httpx.AsyncClient(
            base_url=self.config.base_url.rstrip("/"),
            timeout=timeout,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            transport=self._transport,
        )

    async def aclose(self) -> None:
        http, self._http, self._http_loop = self._http, None, None
        if http is not None:
            await http.aclose()

    def _log_unavailable(self, what: str, error: Exception) -> None:
        now = time.monotonic()
        if now - self._last_error_log >= 60:
            self._last_error_log = now
            _logger.warning("Master Data unreachable (%s): %s — serving the last good data", what, error)

    async def _access_token(self, http: httpx.AsyncClient) -> Optional[str]:
        cfg = self.config
        if not cfg.token_url:
            return None
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token
        self.stats["token_requests"] += 1
        try:
            resp = await http.post(
                cfg.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": cfg.client_id,
                    "client_secret": cfg.client_secret,
                },
            )
        except httpx.HTTPError as error:
            raise MasterDataUnavailable("TOKEN", f"token endpoint unreachable: {error}") from error
        if resp.status_code >= 500:
            raise MasterDataUnavailable("TOKEN", f"token endpoint returned {resp.status_code}")
        if resp.status_code >= 400:
            raise MasterDataError("TOKEN", f"token request refused ({resp.status_code}): {resp.text[:200]}")
        body = resp.json() or {}
        token = body.get("access_token")
        if not token:
            raise MasterDataError("TOKEN", "token response has no access_token")
        try:
            lifetime = float(body.get("expires_in") or 300)
        except (TypeError, ValueError):
            lifetime = 300.0
        # Refresh a little before it expires (30 s, or a tenth of a short lifetime).
        self._token = token
        self._token_expires_at = time.monotonic() + max(lifetime - min(30.0, lifetime / 10), 1.0)
        return token

    async def _post(self, path: str, payload: dict, *, page: Optional[tuple[int, int]] = None) -> tuple[Any, Any]:
        """POST an envelope; (response_payload, pagination_response). Raises MasterData* errors."""
        body: dict[str, Any] = {"request_payload": payload}
        if page:
            body["pagination_request"] = {"current_page": page[0], "page_size": page[1]}
        envelope = {
            "request_header": {
                "sender_app_mnemonic": self.config.sender_app_mnemonic,
                "sender_app_url": "",
                "request_id": str(uuid.uuid4()),
                "request_timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            },
            "request_body": body,
        }
        http, owned = self._client_for_loop()
        try:
            for attempt in (1, 2):
                headers = dict(self.config.extra_headers)
                token = await self._access_token(http)
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                self.stats["requests"] += 1
                try:
                    resp = await http.post(path, json=envelope, headers=headers)
                except httpx.HTTPError as error:
                    raise MasterDataUnavailable("HTTP", f"{path}: {error!r}") from error
                if resp.status_code == 401 and attempt == 1 and self.config.token_url:
                    self._token = None  # expired or revoked early: get a new one, once
                    continue
                break
        finally:
            if owned:
                await http.aclose()
        if resp.status_code >= 500:
            raise MasterDataUnavailable(str(resp.status_code), f"{path}: {resp.text[:200]}")
        if resp.status_code >= 400:
            raise MasterDataError(str(resp.status_code), f"{path}: {resp.text[:200]}")
        data = resp.json() or {}
        header = data.get("response_header") or {}
        if str(header.get("response_status") or "").upper() == "ERROR":
            code = header.get("response_error_code") or "ERROR"
            message = header.get("response_error_message") or ""
            if code.endswith("-404"):
                raise MasterDataNotFound(code, message)
            if code.endswith("-500") or code.endswith("-502"):
                raise MasterDataUnavailable(code, message)
            raise MasterDataError(code, message)
        response_body = data.get("response_body") or {}
        return response_body.get("response_payload"), response_body.get("pagination_response")

    async def _paged(self, path: str, payload: dict, items_key: str) -> tuple[dict, list]:
        """All pages of a paged read: (first page's payload, all items)."""
        size = self.config.page_size
        first, pagination = await self._post(path, payload, page=(1, size))
        first = first or {}
        items = list(first.get(items_key) or [])
        pages = int((pagination or {}).get("number_of_pages") or 1)
        for number in range(2, pages + 1):
            more, _ = await self._post(path, payload, page=(number, size))
            items.extend((more or {}).get(items_key) or [])
        return first, items

    def _selector(self, version: VersionRef = None, as_of: Optional[str] = None) -> dict:
        if version is not None:
            return {"version": version}
        if as_of:
            return {"as_of": as_of}
        if self.config.release:
            return {"release": self.config.release}
        return {"version": "latest"}

    # ============================================================== freshness

    async def _refresh_if_due(self) -> None:
        now = time.monotonic()
        if self._polling or now < self._next_poll_at:
            return
        self._polling = True
        self._next_poll_at = now + max(self.config.poll_seconds, 0.0)
        try:
            await self.poll_changes()
        except MasterDataError as error:
            self._log_unavailable("change feed", error)
        finally:
            self._polling = False

    async def poll_changes(self) -> int:
        """Read the change feed from the stored cursor; mark what changed stale. Returns events seen."""
        first_poll = self._cursor is None
        cursor = self._cursor or 0
        seen = 0
        while True:
            payload, _ = await self._post("/catalogue/get_changes", {"cursor": cursor, "limit": 1000})
            payload = payload or {}
            events = payload.get("events") or []
            seen += len(events)
            if not first_poll:
                for event in events:
                    self._apply_event(event)
            cursor = int(payload.get("next_cursor") or cursor)
            if not payload.get("has_more"):
                break
        self._cursor = cursor
        return seen

    def _apply_event(self, event: dict) -> None:
        kind = event.get("event_type") or ""
        subject = event.get("subject_id")
        details = event.get("details") or {}
        if kind in _LIST_SET_EVENTS:
            self._lists_summary_stale = True
        if kind in _LIST_VERSION_EVENTS:
            names = {n for n in (subject, details.get("list_code"), details.get("list_id")) if n}
            for name, pointer in self._list_pointers.items():
                if name in names or pointer.list_id in names or pointer.list_code in names:
                    pointer.stale = True
        elif kind in _GEO_VERSION_EVENTS:
            if self._geo_pointer is not None:
                self._geo_pointer.stale = True
        elif kind.startswith("release.") and self.config.release:
            for pointer in self._list_pointers.values():
                pointer.stale = True
            if self._geo_pointer is not None:
                self._geo_pointer.stale = True

    def _needs_refresh(self, pointer: Optional[_Pointer]) -> bool:
        if pointer is None or pointer.stale:
            return True
        max_age = self.config.latest_max_age_seconds
        return bool(max_age) and time.monotonic() - pointer.resolved_at > max_age

    # ================================================================== lists

    async def get_lists(self) -> list[dict]:
        """Every list (ListSummary dicts), refreshed when the feed shows a list change."""
        await self._refresh_if_due()
        max_age = self.config.latest_max_age_seconds
        too_old = bool(max_age) and time.monotonic() - self._lists_summary_at > max_age
        if self._lists_summary is not None and not self._lists_summary_stale and not too_old:
            return self._lists_summary
        try:
            payload, _ = await self._post("/catalogue/get_lists", {"include_unpublished": False})
        except MasterDataUnavailable as error:
            if self._lists_summary is None:
                raise
            self._log_unavailable("get_lists", error)
            self.stats["stale_served"] += 1
            return self._lists_summary
        self._lists_summary = list((payload or {}).get("lists") or [])
        self._lists_summary_stale = False
        self._lists_summary_at = time.monotonic()
        return self._lists_summary

    async def _resolve_list(self, list_code: str) -> _Pointer:
        """The version "latest" (or the pinned release) means for a list now."""
        pointer = self._list_pointers.get(list_code)
        if not self._needs_refresh(pointer):
            return pointer
        try:
            try:
                payload, _ = await self._post("/catalogue/get_list", {"list_code": list_code, **self._selector()})
            except MasterDataNotFound:
                if not self.config.release:
                    raise
                # The pinned release does not pin this list: read its latest.
                if list_code not in self._unpinned_logged:
                    self._unpinned_logged.add(list_code)
                    _logger.warning(
                        "Catalogue release %s does not pin list %s; reading its latest version",
                        self.config.release, list_code,
                    )
                payload, _ = await self._post("/catalogue/get_list", {"list_code": list_code, "version": "latest"})
        except MasterDataUnavailable as error:
            if pointer is None:
                raise
            self._log_unavailable(f"list {list_code}", error)
            self.stats["stale_served"] += 1
            return pointer
        except MasterDataNotFound:
            self._list_pointers.pop(list_code, None)
            raise
        summary = (payload or {}).get("list") or {}
        version = (payload or {}).get("version")
        if not version:
            # A list never published (or not yet in effect) has no values to read.
            raise MasterDataNotFound("G2P-CAT-404", f"list {list_code} has no published version in effect")
        pointer = _Pointer(
            version_no=int(version["version_no"]),
            list_id=summary.get("list_id"),
            list_code=summary.get("list_code"),
            resolved_at=time.monotonic(),
        )
        self._list_pointers[list_code] = pointer
        return pointer

    async def list_values(
        self, list_code: str, *, version: VersionRef = None, include_retired: bool = False
    ) -> ListSnapshot:
        """A list's values at ``version`` (default: latest / the pinned release).

        Active values only unless ``include_retired`` (for showing existing data).
        """
        await self._refresh_if_due()
        if version is None or version == "latest":
            pointer = await self._resolve_list(list_code)
            list_key, version_no = pointer.list_id or list_code, pointer.version_no
        else:
            list_key, version_no = list_code, int(version)
        key = (list_key, version_no, bool(include_retired))
        cached = self._list_values.get(key)
        if cached is not None:
            return cached
        first, values = await self._paged(
            "/catalogue/get_list_values",
            {"list_code": list_key, "version": version_no, "include_retired": bool(include_retired)},
            "values",
        )
        snapshot = ListSnapshot(
            list_id=list_key,
            list_code=first.get("list_code") or list_code,
            version_no=int((first.get("version") or {}).get("version_no") or version_no),
            values=tuple(values),
        )
        return self._list_values.put(key, snapshot)

    async def get_list_value(self, list_code: str, value_code: str, *, version: VersionRef = None) -> Optional[dict]:
        """One value by code at a version — including a retired one. None if the list has no such code."""
        await self._refresh_if_due()
        if version is None or version == "latest":
            pointer = await self._resolve_list(list_code)
            list_key, version_no = pointer.list_id or list_code, pointer.version_no
        else:
            list_key, version_no = list_code, int(version)
        # Answer from a cached full list when there is one.
        for retired in (True, False):
            snapshot = self._list_values.get((list_key, version_no, retired))
            if snapshot is not None:
                hit = snapshot.by_code.get(value_code)
                if hit is not None or retired:
                    return hit
        key = (list_key, version_no, value_code)
        cached = self._list_value.get(key, _MISSING)
        if cached is not _MISSING:
            return cached
        try:
            payload, _ = await self._post(
                "/catalogue/get_list_value", {"list_code": list_key, "value_code": value_code, "version": version_no}
            )
            value = (payload or {}).get("value")
        except MasterDataNotFound:
            value = None
        return self._list_value.put(key, value)

    async def all_list_codes(self) -> tuple[dict[str, set[str]], dict[str, int]]:
        """Active codes of every published list, by list id, at latest / the pinned release.

        Returns ({list_id: {codes}}, {list_id: version_no}).
        """
        codes: dict[str, set[str]] = {}
        versions: dict[str, int] = {}
        for summary in await self.get_lists():
            list_id = summary.get("list_id")
            if not list_id or summary.get("current_version_no") is None:
                continue
            try:
                # Unpinned, get_lists already says which version is in effect: no
                # per-list resolution. Pinned, each list resolves through the release.
                version = None if self.config.release else summary["current_version_no"]
                snapshot = await self.list_values(list_id, version=version)
            except MasterDataNotFound:
                continue
            codes[list_id] = snapshot.codes()
            versions[list_id] = snapshot.version_no
        return codes, versions

    # ============================================================== geography

    async def _resolve_geo(self) -> _Pointer:
        pointer = self._geo_pointer
        if not self._needs_refresh(pointer):
            return pointer
        try:
            try:
                payload, _ = await self._post("/catalogue/get_geo_levels", self._selector())
            except MasterDataNotFound:
                if not self.config.release:
                    raise
                if "geography" not in self._unpinned_logged:
                    self._unpinned_logged.add("geography")
                    _logger.warning(
                        "Catalogue release %s does not pin the geography; reading its latest version",
                        self.config.release,
                    )
                payload, _ = await self._post("/catalogue/get_geo_levels", {"version": "latest"})
        except MasterDataUnavailable as error:
            if pointer is None:
                raise
            self._log_unavailable("geography", error)
            self.stats["stale_served"] += 1
            return pointer
        version = (payload or {}).get("version") or {}
        version_no = int(version["version_no"])
        self._geo_levels.put(version_no, list((payload or {}).get("levels") or []))
        self._geo_pointer = _Pointer(version_no=version_no, resolved_at=time.monotonic())
        return self._geo_pointer

    async def geo_version(self) -> int:
        """The geography version in effect for reads now (latest, or the pinned release's)."""
        await self._refresh_if_due()
        return (await self._resolve_geo()).version_no

    async def geo_levels(self, *, version: VersionRef = None) -> tuple[int, list[dict]]:
        """(version_no, levels top-down) at ``version`` (default: latest / the pinned release)."""
        await self._refresh_if_due()
        version_no = (await self._resolve_geo()).version_no if version in (None, "latest") else int(version)
        levels = self._geo_levels.get(version_no)
        if levels is None:
            payload, _ = await self._post("/catalogue/get_geo_levels", {"version": version_no})
            levels = self._geo_levels.put(version_no, list((payload or {}).get("levels") or []))
        return version_no, levels

    async def geo_unit(self, unit_id: str, *, version: VersionRef = None) -> Optional[GeoChain]:
        """A unit with its ancestors (top level first) at ``version``; None if unknown there.

        Returned even when retired (``GeoChain.active`` says whether it is in use),
        so old data still resolves; callers checking NEW data must require ``active``.
        """
        if not unit_id:
            return None
        await self._refresh_if_due()
        version_no = (await self._resolve_geo()).version_no if version in (None, "latest") else int(version)
        key = (unit_id, version_no)
        cached = self._geo_units.get(key, _MISSING)
        if cached is not _MISSING:
            return cached
        try:
            payload, _ = await self._post("/catalogue/get_geo_unit", {"unit_id": unit_id, "version": version_no})
        except MasterDataNotFound:
            return self._geo_units.put(key, None)
        _, levels = await self.geo_levels(version=version_no)
        mnemonic = {level["level_id"]: level.get("level_mnemonic") for level in levels}
        chain_units = [(payload or {}).get("unit") or {}] + list((payload or {}).get("ancestors") or [])
        chain = GeoChain(
            version_no=version_no,
            units=tuple(
                GeoUnitView(
                    unit_id=u["unit_id"],
                    name=u.get("name"),
                    level_id=u.get("level_id"),
                    level_mnemonic=mnemonic.get(u.get("level_id")),
                    parent_unit_id=u.get("parent_unit_id"),
                    status=u.get("status") or "ACTIVE",
                )
                for u in reversed(chain_units)
            ),
        )
        return self._geo_units.put(key, chain)

    async def geo_units(self, *, version: VersionRef = None, level: Optional[str] = None,
                        parent_unit_id: Optional[str] = None, include_retired: bool = False) -> list[dict]:
        """Units at a version (all pages). Not cached: for listings, not per-record lookups."""
        await self._refresh_if_due()
        version_no = (await self._resolve_geo()).version_no if version in (None, "latest") else int(version)
        payload: dict[str, Any] = {"version": version_no, "include_retired": include_retired}
        if level is not None:
            payload["level"] = level
        if parent_unit_id is not None:
            payload["parent_unit_id"] = parent_unit_id
        _, units = await self._paged("/catalogue/get_geo_units", payload, "units")
        return units

    # ======================================================= releases / feed

    async def get_releases(self) -> list[dict]:
        payload, _ = await self._post("/catalogue/get_releases", {})
        return list((payload or {}).get("releases") or [])

    async def get_release(self, release_code: str) -> Optional[dict]:
        try:
            payload, _ = await self._post("/catalogue/get_release", {"release_code": release_code})
        except MasterDataNotFound:
            return None
        return payload

    async def get_changes(self, cursor: int = 0, limit: int = 100) -> dict:
        payload, _ = await self._post("/catalogue/get_changes", {"cursor": cursor, "limit": limit})
        return payload or {"events": [], "next_cursor": cursor, "has_more": False}

    # ================================================================ samples

    async def sample_individuals(self, **filters) -> list[dict]:
        """The country pack's sample people (all pages). Not cached: read once by sample loaders."""
        payload = {k: v for k, v in filters.items() if v is not None}
        _, people = await self._paged("/samples/get_individuals", payload, "individuals")
        return people

    async def sample_households(self, **filters) -> list[dict]:
        payload = {k: v for k, v in filters.items() if v is not None}
        _, households = await self._paged("/samples/get_households", payload, "households")
        return households

    # ================================================================ testing

    def clear_cache(self) -> None:
        """Forget everything cached (tests; an operator-triggered refresh)."""
        self._list_pointers.clear()
        self._geo_pointer = None
        self._lists_summary = None
        self._lists_summary_stale = True
        self._list_values.clear()
        self._list_value.clear()
        self._geo_levels.clear()
        self._geo_units.clear()
        self._cursor = None
        self._next_poll_at = 0.0


# ======================================================================= process-wide client

_client: Optional[MasterDataClient] = None
_client_lock = threading.Lock()


def _settings():
    from ..config import Settings

    return Settings.get_config(strict=False)


def master_data_read_mode(config: Any = None) -> str:
    """``api`` (catalogue API, the default) or ``db`` (direct reads of MDS's tables, the rollback)."""
    config = config if config is not None else _settings()
    mode = str(getattr(config, "master_data_read_mode", API) or API).strip().lower()
    return DB if mode == DB else API


def config_from_settings(settings: Any) -> MasterDataClientConfig:
    return MasterDataClientConfig(
        base_url=str(getattr(settings, "master_data_api_url", "") or ""),
        token_url=str(getattr(settings, "master_data_token_url", "") or ""),
        client_id=str(getattr(settings, "master_data_client_id", "") or ""),
        client_secret=str(getattr(settings, "master_data_client_secret", "") or ""),
        release=str(getattr(settings, "catalogue_release", "") or ""),
        timeout_seconds=float(getattr(settings, "master_data_timeout_seconds", 10.0) or 10.0),
        poll_seconds=float(getattr(settings, "master_data_poll_seconds", 30.0) or 0.0),
        latest_max_age_seconds=float(getattr(settings, "master_data_latest_max_age_seconds", 900.0) or 0.0),
        max_list_versions=int(getattr(settings, "master_data_cache_max_list_versions", 512) or 512),
        max_geo_units=int(getattr(settings, "master_data_cache_max_geo_units", 50000) or 50000),
    )


def get_master_data_client() -> MasterDataClient:
    """The process's client, created from the registry's settings on first use."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                settings = _settings()
                config = config_from_settings(settings)
                if not config.base_url:
                    raise MasterDataError("CONFIG", "master_data_api_url is not configured")
                if not config.token_url:
                    _logger.warning("master_data_token_url is not set: Master Data is called without a token")
                _client = MasterDataClient(config)
    return _client


def set_master_data_client(client: Optional[MasterDataClient]) -> Optional[MasterDataClient]:
    """Install a client (tests, a stand-in MDS); returns the previous one."""
    global _client
    with _client_lock:
        previous, _client = _client, client
    return previous
