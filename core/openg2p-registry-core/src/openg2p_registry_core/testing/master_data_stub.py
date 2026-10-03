"""An in-memory stand-in for Master Data's catalogue API, for tests.

Serves the reads the registry uses — ``/catalogue/get_lists``, ``get_list``,
``get_list_values``, ``get_list_value``, ``get_geo_levels``, ``get_geo_unit``,
``get_geo_units``, ``get_changes``, ``get_releases``, ``get_release`` and
``/samples/get_individuals`` / ``get_households`` — with MDS's envelope,
versioning, paging and error codes, plus a Keycloak-like token endpoint, as an
``httpx.MockTransport``. Publishing a list or geography adds a version and a
change-feed event, so caching and refresh can be tested.

    stub = CatalogueStub()
    stub.publish_list("CROP", [{"value_code": "TEFF", "display": "Teff"}])
    client = stub.client()          # a MasterDataClient wired to the stub
    set_master_data_client(client)

Only httpx and the standard library are used, so extensions' tests can reuse it.
"""

from __future__ import annotations

import json
from collections import Counter
from urllib.parse import parse_qsl
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

import httpx

TOKEN_PATH = "/realms/staff/protocol/openid-connect/token"
BASE_URL = "http://mds.test"
TOKEN_URL = "http://keycloak.test" + TOKEN_PATH


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _version_info(version_no: int, is_latest: bool, **extra) -> dict:
    return {"version_no": version_no, "status": "PUBLISHED", "is_latest": is_latest, **extra}


class CatalogueStub:
    def __init__(self, *, require_token: bool = True, token_lifetime: int = 300):
        self.require_token = require_token
        self.token_lifetime = token_lifetime
        self.lists: dict[str, dict] = {}  # list_id -> {list_code, display, is_hierarchical, versions, current}
        self.geo_versions: dict[int, dict] = {}  # version_no -> {levels, units: {unit_id: unit}}
        self.geo_current: Optional[int] = None
        self.releases: dict[str, dict] = {}
        self.events: list[dict] = []
        self.individuals: list[dict] = []
        self.households: list[dict] = []
        self.calls: Counter = Counter()
        self.down = False
        self._tokens: set[str] = set()
        self._token_seq = 0
        self._next_version = 0

    # ----------------------------------------------------------------- data

    def _event(self, event_type: str, subject_type: str, subject_id: str, version_no=None, **details) -> None:
        self.events.append(
            {
                "event_id": len(self.events) + 1,
                "event_type": event_type,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "version_no": version_no,
                "actor": "test",
                "actor_name": None,
                "at": _now(),
                "details": details,
            }
        )

    def _find_list(self, name: str) -> Optional[dict]:
        if name in self.lists:
            return self.lists[name]
        for doc in self.lists.values():
            if doc["list_code"] == name:
                return doc
        return None

    def publish_list(
        self,
        list_code: str,
        values: Iterable[dict],
        *,
        list_id: Optional[str] = None,
        display: Optional[str] = None,
        is_hierarchical: bool = False,
        retired: Iterable[str] = (),
    ) -> int:
        """Publish a new version of a list (creating it first if needed); returns the version number.

        ``values`` are the version's active values (value_code, display, value_id?,
        parent_code?, sort_order?); ``retired`` codes are kept as RETIRED.
        """
        doc = self._find_list(list_id or list_code)
        if doc is None:
            list_id = list_id or list_code
            doc = self.lists[list_id] = {
                "list_id": list_id,
                "list_code": list_code,
                "display": display or list_code,
                "is_hierarchical": is_hierarchical,
                "versions": {},
                "current": None,
            }
            self._event("list.created", "list", list_id, list_code=list_code)
        number = (max(doc["versions"]) + 1) if doc["versions"] else 1
        rows = []
        for index, value in enumerate(values):
            code = value.get("value_code") or value.get("value_id")
            rows.append(
                {
                    "value_id": value.get("value_id") or code,
                    "value_code": code,
                    "display": value.get("display", value.get("value_display")),
                    "display_i18n": None,
                    "parent_code": value.get("parent_code"),
                    "sort_order": value.get("sort_order", index),
                    "attributes": value.get("attributes"),
                    "roles": None,
                    "status": value.get("status", "ACTIVE"),
                }
            )
        retired = set(retired)
        previous = doc["versions"].get(doc["current"]) or []
        for old in previous:
            if old["value_code"] in retired and all(r["value_code"] != old["value_code"] for r in rows):
                rows.append({**old, "status": "RETIRED"})
        doc["versions"][number] = rows
        doc["current"] = number
        self._event(
            "list.version.published", "list", doc["list_id"], number, list_code=doc["list_code"], current_version_no=number
        )
        return number

    def retire_values(self, list_code: str, codes: Iterable[str]) -> int:
        """Publish a version of the list with ``codes`` retired."""
        doc = self._find_list(list_code)
        codes = set(codes)
        current = doc["versions"][doc["current"]]
        active = [v for v in current if v["value_code"] not in codes and v["status"] == "ACTIVE"]
        return self.publish_list(doc["list_code"], active, retired=codes | {
            v["value_code"] for v in current if v["status"] == "RETIRED"})

    def publish_geography(self, levels: Iterable[dict], units: Iterable[dict]) -> int:
        """Publish a geography version. ``levels``: level_id, level_mnemonic, parent_level_id;
        ``units``: unit_id (or level_value_id), level_id, name (or level_value_mnemonic),
        parent_unit_id (or parent_level_value_id), status?"""
        number = (max(self.geo_versions) + 1) if self.geo_versions else 1
        unit_map = {}
        for unit in units:
            unit_id = unit.get("unit_id") or unit.get("level_value_id")
            unit_map[unit_id] = {
                "unit_id": unit_id,
                "level_id": unit["level_id"],
                "name": unit.get("name") or unit.get("level_value_mnemonic"),
                "name_i18n": None,
                "parent_unit_id": unit.get("parent_unit_id", unit.get("parent_level_value_id")),
                "status": unit.get("status", "ACTIVE"),
                "valid_from": None,
                "valid_to": None,
            }
        self.geo_versions[number] = {
            "levels": [
                {
                    "level_id": level["level_id"],
                    "level_mnemonic": level["level_mnemonic"],
                    "parent_level_id": level.get("parent_level_id"),
                    "display": level.get("display"),
                    "display_i18n": None,
                }
                for level in levels
            ],
            "units": unit_map,
        }
        self.geo_current = number
        self._event("geo.version.published", "geo", "geography", number, current_version_no=number)
        return number

    def publish_release(self, release_code: str, members: dict[str, int], geo_version_no: Optional[int] = None):
        self.releases[release_code] = {
            "members": {self._find_list(code)["list_id"]: v for code, v in members.items()},
            "geo_version_no": geo_version_no,
        }
        self._event("release.published", "release", release_code)

    def set_samples(self, individuals: Iterable[dict], households: Iterable[dict] = ()) -> None:
        self.individuals = [dict(i) for i in individuals]
        self.households = [dict(h) for h in households]

    # ------------------------------------------------------------ transport

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def client(self, **config):
        """A MasterDataClient wired to this stub."""
        from ..helpers.master_data_client import MasterDataClient, MasterDataClientConfig

        settings = {
            "base_url": BASE_URL,
            "token_url": TOKEN_URL if self.require_token else "",
            "client_id": "registry-staff-portal",
            "client_secret": "secret",
            **config,
        }
        return MasterDataClient(MasterDataClientConfig(**settings), transport=self.transport())

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls[path] += 1
        if self.down:
            raise httpx.ConnectError("Master Data is down (stub)", request=request)
        if path == TOKEN_PATH:
            form = dict(parse_qsl(request.content.decode()))
            if form.get("grant_type") != "client_credentials" or form.get("client_secret") != "secret":
                return httpx.Response(401, json={"error": "unauthorized_client"})
            self._token_seq += 1
            token = f"token-{self._token_seq}"
            self._tokens.add(token)
            return httpx.Response(
                200, json={"access_token": token, "expires_in": self.token_lifetime, "token_type": "Bearer"}
            )
        if self.require_token:
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer ") or auth[7:] not in self._tokens:
                return httpx.Response(401, json={"error": {"code": "Unauthorized"}})
        body = json.loads(request.content or b"{}")
        payload = (body.get("request_body") or {}).get("request_payload") or {}
        page = (body.get("request_body") or {}).get("pagination_request")
        handler = getattr(self, "_op_" + path.strip("/").replace("/", "_"), None)
        if handler is None:
            return httpx.Response(404, json={"detail": "Not Found"})
        try:
            result = handler(payload, page)
        except _Error as error:
            return self._envelope(None, error=(error.code, error.message))
        if isinstance(result, tuple):
            return self._envelope(*result)
        return self._envelope(result)

    @staticmethod
    def _envelope(payload, pagination=None, error=None) -> httpx.Response:
        header = {
            "request_id": "stub",
            "response_status": "ERROR" if error else "SUCCESS",
            "response_error_code": error[0] if error else "",
            "response_error_message": error[1] if error else "",
            "response_timestamp": _now(),
        }
        return httpx.Response(
            200,
            json={
                "response_header": header,
                "response_body": {"response_payload": payload, "pagination_response": pagination},
            },
        )

    @staticmethod
    def _paginate(items: list, page) -> tuple[list, dict]:
        size = int((page or {}).get("page_size") or 1000)
        number = int((page or {}).get("current_page") or 1)
        total = len(items)
        return items[(number - 1) * size: number * size], {
            "number_of_items": total,
            "number_of_pages": (total + size - 1) // size if total else 0,
        }

    # ---------------------------------------------------------------- lists

    def _list_or_404(self, name: str) -> dict:
        doc = self._find_list(name)
        if doc is None:
            raise _Error("G2P-CAT-404", f"list not found: {name}")
        return doc

    def _list_version(self, doc: dict, payload: dict) -> Optional[int]:
        if payload.get("release"):
            release = self.releases.get(payload["release"])
            if release is None:
                raise _Error("G2P-CAT-404", f"release not found: {payload['release']}")
            if doc["list_id"] not in release["members"]:
                raise _Error("G2P-CAT-404", f"release {payload['release']} pins no version of {doc['list_code']}")
            return release["members"][doc["list_id"]]
        version = payload.get("version")
        if version in (None, "latest"):
            return doc["current"]
        if int(version) not in doc["versions"]:
            raise _Error("G2P-CAT-404", f"version {version} of {doc['list_code']} not found")
        return int(version)

    def _summary(self, doc: dict) -> dict:
        return {
            "list_id": doc["list_id"],
            "list_code": doc["list_code"],
            "display": doc["display"],
            "is_hierarchical": doc["is_hierarchical"],
            "current_version_no": doc["current"],
            "latest_published_version_no": doc["current"],
        }

    def _op_catalogue_get_lists(self, payload, page):
        lists = [self._summary(d) for d in self.lists.values()]
        if payload.get("include_unpublished") is False:
            lists = [s for s in lists if s["current_version_no"] is not None]
        return {"lists": lists}

    def _op_catalogue_get_list(self, payload, page):
        doc = self._list_or_404(payload["list_code"])
        number = self._list_version(doc, payload)
        return {
            "list": self._summary(doc),
            "version": _version_info(number, number == doc["current"]) if number else None,
        }

    def _op_catalogue_get_list_values(self, payload, page):
        doc = self._list_or_404(payload["list_code"])
        number = self._list_version(doc, payload)
        values = list(doc["versions"][number])
        if not payload.get("include_retired"):
            values = [v for v in values if v["status"] == "ACTIVE"]
        if payload.get("parent_code") is not None:
            parent = payload["parent_code"] or None
            values = [v for v in values if v["parent_code"] == parent]
        values.sort(key=lambda v: (v["sort_order"] is None, v["sort_order"] or 0))
        items, pagination = self._paginate(values, page)
        return (
            {
                "list_code": doc["list_code"],
                "version": _version_info(number, number == doc["current"]),
                "values": items,
                "total": len(values),
            },
            pagination,
        )

    def _op_catalogue_get_list_value(self, payload, page):
        doc = self._list_or_404(payload["list_code"])
        number = self._list_version(doc, payload)
        for value in doc["versions"][number]:
            if value["value_code"] == payload["value_code"]:
                return {
                    "list_code": doc["list_code"],
                    "version": _version_info(number, number == doc["current"]),
                    "value": value,
                }
        raise _Error("G2P-CAT-404", f"value not found: {payload['value_code']}")

    # ------------------------------------------------------------ geography

    def _geo_version(self, payload: dict) -> int:
        if payload.get("release"):
            release = self.releases.get(payload["release"])
            if release is None or not release.get("geo_version_no"):
                raise _Error("G2P-CAT-404", f"release {payload['release']} pins no geography")
            return release["geo_version_no"]
        version = payload.get("version")
        if version in (None, "latest"):
            if self.geo_current is None:
                raise _Error("G2P-CAT-404", "no geography published")
            return self.geo_current
        if int(version) not in self.geo_versions:
            raise _Error("G2P-CAT-404", f"geography version {version} not found")
        return int(version)

    def _op_catalogue_get_geo_levels(self, payload, page):
        number = self._geo_version(payload)
        return {
            "version": _version_info(number, number == self.geo_current),
            "levels": self.geo_versions[number]["levels"],
        }

    def _op_catalogue_get_geo_unit(self, payload, page):
        number = self._geo_version(payload)
        units = self.geo_versions[number]["units"]
        unit = units.get(payload["unit_id"])
        if unit is None:
            raise _Error("G2P-CAT-404", f"unit not found: {payload['unit_id']}")
        ancestors, parent = [], unit["parent_unit_id"]
        while parent and parent in units and len(ancestors) < 20:
            ancestors.append(units[parent])
            parent = units[parent]["parent_unit_id"]
        return {"version": _version_info(number, number == self.geo_current), "unit": unit, "ancestors": ancestors}

    def _op_catalogue_get_geo_units(self, payload, page):
        number = self._geo_version(payload)
        data = self.geo_versions[number]
        units = list(data["units"].values())
        if not payload.get("include_retired"):
            units = [u for u in units if u["status"] == "ACTIVE"]
        if payload.get("level"):
            level_ids = {
                lv["level_id"] for lv in data["levels"] if payload["level"] in (lv["level_id"], lv["level_mnemonic"])
            }
            units = [u for u in units if u["level_id"] in level_ids]
        if payload.get("parent_unit_id") is not None:
            parent = payload["parent_unit_id"] or None
            units = [u for u in units if u["parent_unit_id"] == parent]
        items, pagination = self._paginate(units, page)
        return {"version": _version_info(number, number == self.geo_current), "units": items, "total": len(units)}, pagination

    # ------------------------------------------------- feed, releases, samples

    def _op_catalogue_get_changes(self, payload, page):
        cursor = int(payload.get("cursor") or 0)
        limit = int(payload.get("limit") or 100)
        after = [e for e in self.events if e["event_id"] > cursor]
        batch = after[:limit]
        return {
            "events": batch,
            "next_cursor": batch[-1]["event_id"] if batch else cursor,
            "has_more": len(after) > limit,
        }

    def _op_catalogue_get_releases(self, payload, page):
        return {
            "releases": [
                {"release_code": code, "status": "PUBLISHED", "geo_version_no": r["geo_version_no"],
                 "member_count": len(r["members"])}
                for code, r in self.releases.items()
            ]
        }

    def _op_catalogue_get_release(self, payload, page):
        release = self.releases.get(payload["release_code"])
        if release is None:
            raise _Error("G2P-CAT-404", f"release not found: {payload['release_code']}")
        return {
            "release": {"release_code": payload["release_code"], "status": "PUBLISHED",
                        "geo_version_no": release["geo_version_no"], "member_count": len(release["members"])},
            "members": [
                {"list_id": list_id, "list_code": self.lists[list_id]["list_code"], "version_no": v}
                for list_id, v in release["members"].items()
            ],
        }

    def _op_samples_get_individuals(self, payload, page):
        people = [
            p for p in self.individuals
            if all(payload.get(k) is None or p.get(k) == payload[k] for k in ("household_id", "geo_pcode", "country"))
        ]
        people.sort(key=lambda p: p["individual_id"])
        items, pagination = self._paginate(people, page)
        return {"individuals": items, "total": len(people)}, pagination

    def _op_samples_get_households(self, payload, page):
        households = sorted(self.households, key=lambda h: h["household_id"])
        items, pagination = self._paginate(households, page)
        return {"households": items, "total": len(households)}, pagination


class _Error(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def stub_from_tables(
    attributes: Iterable[dict] = (),
    attribute_values: Iterable[dict] = (),
    levels: Iterable[dict] = (),
    level_values: Iterable[dict] = (),
    individuals: Iterable[dict] = (),
    **kwargs: Any,
) -> CatalogueStub:
    """A stub holding the same data as MDS's legacy current-state tables.

    ``attributes``: attribute_id, attribute_code, attribute_display, is_hierarchical;
    ``attribute_values``: attribute_id, value_id, value_code, value_display,
    parent_value_id, sort_order; ``levels`` / ``level_values``: rows of
    g2p_geo_levels / g2p_geo_level_values. Each list and the geography become
    version 1.
    """
    stub = CatalogueStub(**kwargs)
    values = list(attribute_values)
    for attribute in attributes:
        rows = [v for v in values if v["attribute_id"] == attribute["attribute_id"]]
        code_of = {v["value_id"]: v.get("value_code") or v["value_id"] for v in rows}
        stub.publish_list(
            attribute.get("attribute_code") or attribute["attribute_id"],
            [
                {
                    "value_id": v["value_id"],
                    "value_code": v.get("value_code") or v["value_id"],
                    "display": v.get("value_display"),
                    "parent_code": code_of.get(v.get("parent_value_id")),
                    "sort_order": v.get("sort_order"),
                }
                for v in rows
            ],
            list_id=attribute["attribute_id"],
            display=attribute.get("attribute_display"),
            is_hierarchical=bool(attribute.get("is_hierarchical")),
        )
    levels, level_values = list(levels), list(level_values)
    if levels or level_values:
        stub.publish_geography(levels, level_values)
    stub.set_samples(individuals)
    return stub
