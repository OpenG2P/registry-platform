#!/usr/bin/env python3
"""Create the demo staff users in Keycloak (sample data only).

The sample approval policies name demo approvers (alex.carter, nina.patel), so
the demo staff are sample data too: db-seed runs this only with
LOAD_SAMPLE_DATA=true. A production install creates no demo users; the country
creates its staff in Keycloak.

Each user is created in the staff realm with an initial password to be changed
at first login (as keycloak-init creates users), and gets the release's staff
client roles listed for it. A user that exists already is left as it is; only
missing roles are added.

Environment:
  SAMPLE_STAFF_USERS      JSON list of {username, firstName, lastName, email, clientRoles}
  SAMPLE_STAFF_PASSWORD   initial password (global.aweApproverUserPassword)
  SAMPLE_STAFF_CLIENT_ID  the release's staff client (global.authClientId)
  KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD
  SAMPLE_STAFF_WAIT_SECONDS  how long to wait for the staff client (default 300)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def log(message: str) -> None:
    print(f"[sample-staff-users] {message}", flush=True)


class Keycloak:
    def __init__(self, base_url: str, realm: str, admin_user: str, admin_password: str):
        self.base_url = base_url.rstrip("/")
        self.realm = realm
        self.admin_user = admin_user
        self.admin_password = admin_password
        self.token = ""

    def login(self) -> None:
        body = urllib.parse.urlencode(
            {
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": self.admin_user,
                "password": self.admin_password,
            }
        ).encode()
        url = f"{self.base_url}/realms/master/protocol/openid-connect/token"
        with urllib.request.urlopen(urllib.request.Request(url, data=body), timeout=30) as resp:
            self.token = json.load(resp)["access_token"]

    def call(self, method: str, path: str, params=None, payload=None):
        url = f"{self.base_url}/admin/realms/{self.realm}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=30) as resp:
                raw = resp.read()
                return resp.status, (json.loads(raw) if raw else None), resp.headers
        except urllib.error.HTTPError as exc:
            return exc.code, None, exc.headers

    def get(self, path: str, params=None):
        status, body, _ = self.call("GET", path, params=params)
        if status != 200:
            raise RuntimeError(f"GET {path} returned {status}")
        return body


def client_uuid(kc: Keycloak, client_id: str, wait_seconds: int) -> str:
    """The staff client is created by keycloak-init; wait for it."""
    deadline = time.monotonic() + wait_seconds
    while True:
        clients = kc.get("/clients", {"clientId": client_id})
        if clients:
            return clients[0]["id"]
        if time.monotonic() > deadline:
            raise RuntimeError(f"client '{client_id}' not found in realm '{kc.realm}'")
        log(f"waiting for client '{client_id}' ...")
        time.sleep(10)


def ensure_user(kc: Keycloak, user: dict, password: str) -> str:
    username = user["username"]
    existing = kc.get("/users", {"username": username, "exact": "true"})
    if existing:
        log(f"user '{username}' exists; left as it is")
        return existing[0]["id"]
    payload = {
        "username": username,
        "email": user.get("email", ""),
        "firstName": user.get("firstName", username),
        "lastName": user.get("lastName", ""),
        "emailVerified": True,
        "enabled": True,
        "credentials": [{"type": "password", "value": password, "temporary": True}],
        "requiredActions": ["UPDATE_PASSWORD"],
    }
    status, _, _ = kc.call("POST", "/users", payload=payload)
    if status not in (201, 409):
        raise RuntimeError(f"creating user '{username}' returned {status}")
    log(f"user '{username}' created")
    return kc.get("/users", {"username": username, "exact": "true"})[0]["id"]


def assign_client_roles(kc: Keycloak, user_id: str, username: str, uuid: str, roles: list) -> None:
    mapping = f"/users/{user_id}/role-mappings/clients/{uuid}"
    have = {r["name"] for r in (kc.get(mapping) or [])}
    to_add = []
    for name in roles:
        if name in have:
            continue
        status, role, _ = kc.call("GET", f"/clients/{uuid}/roles/{urllib.parse.quote(name)}")
        if status == 200:
            to_add.append(role)
        else:
            log(f"warning: client role '{name}' not found; not given to '{username}'")
    if to_add:
        status, _, _ = kc.call("POST", mapping, payload=to_add)
        if status not in (200, 204):
            raise RuntimeError(f"assigning roles to '{username}' returned {status}")
        log(f"'{username}': {', '.join(r['name'] for r in to_add)}")


def main() -> int:
    users = json.loads(os.environ.get("SAMPLE_STAFF_USERS") or "[]")
    if not users:
        log("no sample staff users configured; nothing to do")
        return 0
    base_url = os.environ.get("KEYCLOAK_BASE_URL", "")
    admin_password = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "")
    if not base_url or not admin_password:
        log("Keycloak admin access is not configured; the demo staff users are not created")
        return 1
    kc = Keycloak(
        base_url,
        os.environ.get("KEYCLOAK_REALM", "staff"),
        os.environ.get("KEYCLOAK_ADMIN_USER", "admin"),
        admin_password,
    )
    client_id = os.environ["SAMPLE_STAFF_CLIENT_ID"]
    password = os.environ.get("SAMPLE_STAFF_PASSWORD", "")
    kc.login()
    uuid = client_uuid(kc, client_id, int(os.environ.get("SAMPLE_STAFF_WAIT_SECONDS", "300")))
    for user in users:
        user_id = ensure_user(kc, user, password)
        assign_client_roles(kc, user_id, user["username"], uuid, user.get("clientRoles") or [])
    log(f"{len(users)} demo staff user(s) ready on client '{client_id}'")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        log(f"FAILED: {exc}")
        sys.exit(1)
