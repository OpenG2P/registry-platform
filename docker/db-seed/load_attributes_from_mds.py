#!/usr/bin/env python3
"""Seed the registry's code lists from the Master Data Service.

Why this exists
---------------
A registry's dropdowns and validations currently come from two places: a small
hand-written SQL fixture in each extension, and ~31 Python enums compiled into
the image. The enums are the problem. They make the image country-specific in a
way nothing declares: installing the same Farmer Registry for a second country
means either editing Python or accepting the first country's categories.

There is no universal superset to fall back on — gender is the plain case, where
countries define genuinely different taxonomies rather than subsets of one. So
the country declares its lists in a country pack, Master Data (acting as the
Country Data Service) holds them, and each registry copies them into its OWN
tables at install. After that the registry validates against its own copy and has
no runtime dependency on MDS — an outage stops installs, not registrations.

Backward compatibility
----------------------
Off unless LOAD_ATTRIBUTES=true. An existing deployment upgrading gets exactly
what it got before: the extension's SQL fixture and nothing else.

Even switched on this only ever inserts and updates. The extension's own lists
are left alone unless the pack defines a list with the same attribute_id, in
which case the pack wins — the pack is the country's declaration and the fixture
is a default.

Key mapping
-----------
MDS identifies a value by (attribute_id, value_id), because value_id is not
unique on its own: OTHER appears in thirteen of Ethiopia's lists. The registry's
table predates that and keys on value_id alone. So the registry-side id is
composed:

    MDS  (RELATIONSHIP_TO_HEAD, SELF)  ->  registry  "RELATIONSHIP_TO_HEAD:SELF"

Deterministic, so re-running updates rather than duplicates, and it is the same
scheme the NSR fixture already applies by hand ('PROG_CASH_TRANSFER').

Roles land in g2p_attribute_value_roles — a separate table, because this platform
creates tables with create_all, which never adds a column to an existing one.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import execute_values

MDS_BASE_URL = os.environ.get("MDS_BASE_URL", "").rstrip("/")
# Domains to pull alongside the core lists — 'agriculture' for a Farmer
# Registry. Empty means the core lists only; a social registry has no use for
# crop types and should not carry them.
DOMAINS = [d.strip() for d in os.environ.get("ATTRIBUTE_DOMAINS", "").split(",") if d.strip()]
TIMEOUT = int(os.environ.get("MDS_TIMEOUT_SECONDS", "30"))
PAGE_SIZE = 1000


def log(msg):
    print(f"[attributes] {msg}", flush=True)


# Fail the seed Job when the catalogue cannot be loaded, instead of skipping it.
# Off by default — see skip() for why.
REQUIRED = os.environ.get("ATTRIBUTES_REQUIRED", "false").strip().lower() == "true"


def die(msg):
    print(f"[attributes] ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def skip(msg):
    """Give up on the code lists without failing the whole db-seed Job.

    These lists are OPTIONAL: nothing reads them unless the registry sets
    registry_core validate_attribute_values=true, which is false by default —
    with it off, submissions validate against the compiled enums exactly as
    before. Master Data being absent, unreachable or requiring credentials this
    Job does not have is therefore not a reason to abandon an install: it would
    take down sample data, metadata and views that DO matter, over a catalogue
    nothing currently consumes.

    Set ATTRIBUTES_REQUIRED=true to make it fatal — which is what you want once
    validate_attribute_values is turned on, because from that point a missing
    catalogue means every coded value fails validation later, and failing here
    with a clear message beats that.
    """
    if REQUIRED:
        die(f"{msg} (ATTRIBUTES_REQUIRED=true)")
    print(
        f"[attributes] WARNING: {msg}\n"
        f"[attributes] Skipping code lists — they are optional while "
        f"validate_attribute_values is off. Set ATTRIBUTES_REQUIRED=true to "
        f"make this fatal.",
        file=sys.stderr,
        flush=True,
    )
    sys.exit(0)


def mds_post(path, payload):
    """POST one G2P-envelope request to MDS and return the response payload."""
    body = json.dumps(
        {
            "request_header": {
                "sender_app_mnemonic": "registry-db-seed",
                "sender_app_url": "http://registry-db-seed",
                "request_id": f"db-seed-{path.strip('/').replace('/', '-')}",
                "request_timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "request_body": {"request_payload": payload},
        }
    ).encode()

    req = urllib.request.Request(
        f"{MDS_BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            doc = json.load(resp)
    except urllib.error.URLError as e:
        skip(f"cannot reach Master Data at {MDS_BASE_URL}{path}: {e}")

    header = doc.get("response_header") or {}
    if header.get("response_status") != "SUCCESS":
        skip(
            f"{path} returned {header.get('response_status')}: "
            f"{header.get('response_error_message')}"
        )
    return (doc.get("response_body") or {}).get("response_payload") or {}


def fetch_attributes(domain=None):
    payload = {"domain": domain} if domain else {}
    return mds_post("/attributes/get_all_attributes", payload).get("attributes") or []


def fetch_values(domain=None):
    """Every value in scope, paged. MDS reports the unpaginated total, so a short
    page can be told from a truncated one rather than inferred."""
    out, page = [], 1
    while True:
        payload = {"page_size": PAGE_SIZE, "page_number": page}
        if domain:
            payload["domain"] = domain
        got = mds_post("/attributes/get_attribute_values", payload)
        batch = got.get("attribute_values") or []
        out.extend(batch)
        total = got.get("total")
        if not batch or total is None or len(out) >= total:
            if total is not None and len(out) != total:
                log(f"WARNING: MDS reported {total} values but returned {len(out)}")
            return out
        page += 1


def registry_value_id(attribute_id, value_id):
    return f"{attribute_id}:{value_id}"


def seed(conn, attributes, values):
    now_attrs = [
        (
            a["attribute_id"],
            a.get("attribute_code") or a["attribute_id"],
            a.get("attribute_display") or a["attribute_id"],
            bool(a.get("is_hierarchical")),
        )
        for a in attributes
    ]

    rows, role_rows = [], []
    for v in values:
        attr = v["attribute_id"]
        vid = registry_value_id(attr, v["value_id"])
        rows.append(
            (
                vid,
                attr,
                v.get("value_code") or v["value_id"],
                v.get("value_display") or v["value_id"],
                # A parent is a value of the same list, so it needs the same
                # composition — otherwise a hierarchical list points at ids that
                # do not exist on this side.
                registry_value_id(attr, v["parent_value_id"]) if v.get("parent_value_id") else None,
                v.get("sort_order") or 0,
            )
        )
        for role in v.get("roles") or []:
            role_rows.append((vid, role, attr))

    with conn.cursor() as cur:
        if now_attrs:
            execute_values(
                cur,
                """
                INSERT INTO "public"."g2p_attributes"
                  (attribute_id, attribute_code, attribute_display, is_hierarchical)
                VALUES %s
                ON CONFLICT (attribute_id) DO UPDATE
                  SET attribute_code = EXCLUDED.attribute_code,
                      attribute_display = EXCLUDED.attribute_display,
                      is_hierarchical = EXCLUDED.is_hierarchical
                """,
                now_attrs,
            )
        if rows:
            execute_values(
                cur,
                """
                INSERT INTO "public"."g2p_attribute_values"
                  (value_id, attribute_id, value_code, value_display,
                   parent_value_id, sort_order)
                VALUES %s
                ON CONFLICT (value_id) DO UPDATE
                  SET attribute_id = EXCLUDED.attribute_id,
                      value_code = EXCLUDED.value_code,
                      value_display = EXCLUDED.value_display,
                      parent_value_id = EXCLUDED.parent_value_id,
                      sort_order = EXCLUDED.sort_order
                """,
                rows,
            )
        # Where the pack and an extension fixture define the SAME list, the pack
        # replaces it rather than joining it. Merging looks conservative and is
        # not: NSR's fixture and Ethiopia's pack both define PROGRAM_NAME, so an
        # insert-only sync leaves 18 values under one attribute and every
        # Programme dropdown lists each programme twice. Lists the pack does not
        # define are never touched.
        superseded = []
        if rows:
            cur.execute(
                """
                DELETE FROM "public"."g2p_attribute_values"
                 WHERE attribute_id = ANY(%s) AND NOT (value_id = ANY(%s))
             RETURNING attribute_id, value_id, value_code
                """,
                ([a[0] for a in now_attrs], [r[0] for r in rows]),
            )
            superseded = cur.fetchall()

        if rows:
            # Roles are replaced rather than merged for the values in scope: a
            # role REMOVED from the pack has to disappear here too, and an
            # insert-only sync would leave it behind for the lifetime of the
            # deployment.
            cur.execute(
                'DELETE FROM "public"."g2p_attribute_value_roles" WHERE value_id = ANY(%s)',
                ([r[0] for r in rows],),
            )
        if role_rows:
            execute_values(
                cur,
                """
                INSERT INTO "public"."g2p_attribute_value_roles"
                  (value_id, role, attribute_id)
                VALUES %s
                ON CONFLICT (value_id, role) DO NOTHING
                """,
                role_rows,
            )
    conn.commit()
    return len(now_attrs), len(rows), len(role_rows), superseded


def main():
    if not MDS_BASE_URL:
        skip("MDS_BASE_URL is not set — nothing to read code lists from")

    scopes = [None] + DOMAINS  # None = the core lists every registry uses
    attributes, values, seen_attr = [], [], set()
    for scope in scopes:
        for a in fetch_attributes(scope):
            if a["attribute_id"] not in seen_attr:
                seen_attr.add(a["attribute_id"])
                attributes.append(a)
        values.extend(fetch_values(scope))

    if not attributes:
        # Not fatal. It means Master Data was installed without code lists
        # (geoSeed.load.codelists=false), which is its default — so say what to
        # change rather than failing an otherwise good install.
        log("Master Data returned no attributes. Is geoSeed.load.codelists enabled there?")
        return

    log(f"fetched {len(attributes)} attributes, {len(values)} values from {MDS_BASE_URL}")
    if DOMAINS:
        log(f"domains: {', '.join(DOMAINS)}")

    conn = psycopg2.connect(
        host=os.environ["PGHOST"],
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ["PGDATABASE"],
        user=os.environ["PGUSER"],
        password=os.environ.get("PGPASSWORD", ""),
    )
    try:
        n_attr, n_val, n_role, superseded = seed(conn, attributes, values)
    finally:
        conn.close()
    log(f"seeded {n_attr} attributes, {n_val} values, {n_role} role tags")

    if superseded:
        # Never silent. These rows were another source's version of a list the
        # pack now owns, and anything holding their value_id — rather than their
        # code — is left pointing at nothing.
        pack_codes = {(v["attribute_id"], v.get("value_code") or v["value_id"]) for v in values}
        by_attr = {}
        for attribute_id, value_id, value_code in superseded:
            by_attr.setdefault(attribute_id, []).append(value_code)
        log(f"replaced {len(superseded)} pre-existing value(s) in {len(by_attr)} list(s) "
            f"the pack also defines:")
        for attribute_id, codes in sorted(by_attr.items()):
            gone = sorted(c for c in codes if (attribute_id, c) not in pack_codes)
            log(f"  {attribute_id}: dropped {len(codes)}, of which {len(gone)} "
                f"no longer exist under any id"
                + (f" — {', '.join(gone)}" if gone else ""))
        log("  a record referencing one of these by CODE still resolves wherever "
            "the pack defines the same code; by value_id it does not.")


if __name__ == "__main__":
    main()
