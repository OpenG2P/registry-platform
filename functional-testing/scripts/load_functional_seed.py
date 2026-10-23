#!/usr/bin/env python3
"""Load functional seed SQL and verify rows against seed_manifest.json.

Usage:
  FUNC_REGISTRY_DSN=postgresql://... python3 scripts/load_functional_seed.py
  python3 scripts/load_functional_seed.py --sql-only
  python3 scripts/load_functional_seed.py --verify-only

Compose gate prefers `psql` via docker exec; this script is for local/DSN use
and optional post-load verification.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError:  # pragma: no cover
    print("psycopg is required (pip install 'psycopg[binary]')", file=sys.stderr)
    sys.exit(2)

_ROOT = Path(__file__).resolve().parents[1]
_SEED_DIR = _ROOT / "fixtures" / "seed"
_SQL_PATH = _SEED_DIR / "seed.sql"
_MANIFEST_PATH = _SEED_DIR / "seed_manifest.json"


def _dsn() -> str:
    dsn = (os.environ.get("FUNC_REGISTRY_DSN") or "").strip()
    if not dsn:
        print("FUNC_REGISTRY_DSN is required", file=sys.stderr)
        sys.exit(2)
    return dsn


def apply_sql(dsn: str, sql_path: Path = _SQL_PATH) -> None:
    """Apply seed.sql (multi-statement). Prefer ``psql -f``; else split statements."""
    import shutil
    import subprocess

    if shutil.which("psql"):
        result = subprocess.run(
            ["psql", dsn, "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            sys.stderr.write(result.stderr or result.stdout or "")
            raise RuntimeError(f"psql failed with exit {result.returncode}")
        print(f"[func-seed] applied {sql_path} via psql")
        return

    raw = sql_path.read_text(encoding="utf-8")
    # Strip transaction wrappers; run statements in one connection transaction.
    body = raw.replace("BEGIN;", "").replace("COMMIT;", "")
    statements = [s.strip() for s in body.split(";") if s.strip()]
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for stmt in statements:
                if all(
                    not ln.strip() or ln.strip().startswith("--")
                    for ln in stmt.splitlines()
                ):
                    continue
                cur.execute(stmt)
        conn.commit()
    print(f"[func-seed] applied {sql_path} via psycopg ({len(statements)} statements)")


def load_manifest(path: Path = _MANIFEST_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _fetch_one(cur, sql: str, params: tuple) -> dict | None:
    cur.execute(sql, params)
    row = cur.fetchone()
    if row is None:
        return None
    cols = [c.name for c in cur.description]
    return dict(zip(cols, row))


def verify(dsn: str, manifest: dict) -> list[str]:
    """Return list of mismatch messages (empty = ok)."""
    errors: list[str] = []
    hh = manifest["subjects"]["household"]
    ind = manifest["subjects"]["individual"]

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            hh_row = _fetch_one(
                cur,
                """
                SELECT internal_record_id, functional_record_id, household_head_name,
                       headship_type, size_total, record_status, address_line_1
                FROM g2p_register_households WHERE internal_record_id = %s
                """,
                (hh["internal_record_id"],),
            )
            if not hh_row:
                errors.append(f"missing household {hh['internal_record_id']}")
            else:
                for key in ("household_head_name", "headship_type", "size_total", "record_status"):
                    expected = hh["fields"][key]
                    actual = hh_row.get(key)
                    if actual != expected and str(actual) != str(expected):
                        errors.append(f"household.{key}: expected {expected!r} got {actual!r}")

            ind_row = _fetch_one(
                cur,
                """
                SELECT internal_record_id, link_internal_record_id, first_name,
                       middle_name, last_name, record_status
                FROM g2p_register_individuals WHERE internal_record_id = %s
                """,
                (ind["internal_record_id"],),
            )
            if not ind_row:
                errors.append(f"missing individual {ind['internal_record_id']}")
            else:
                if ind_row.get("link_internal_record_id") != ind["link_internal_record_id"]:
                    errors.append(
                        f"individual.link: expected {ind['link_internal_record_id']!r} "
                        f"got {ind_row.get('link_internal_record_id')!r}"
                    )
                for key in ("first_name", "middle_name", "last_name", "record_status"):
                    expected = ind["fields"][key]
                    actual = ind_row.get(key)
                    if actual != expected and str(actual) != str(expected):
                        errors.append(f"individual.{key}: expected {expected!r} got {actual!r}")

            for land in manifest["supporting"]["individual_land"]:
                row = _fetch_one(
                    cur,
                    """
                    SELECT internal_record_id, link_internal_record_id, land_access, land_size
                    FROM g2p_register_individual_land WHERE internal_record_id = %s
                    """,
                    (land["internal_record_id"],),
                )
                if not row:
                    errors.append(f"missing land {land['internal_record_id']}")
                elif row.get("link_internal_record_id") != land["link_internal_record_id"]:
                    errors.append(f"land.link mismatch for {land['internal_record_id']}")

            for asset in manifest["supporting"]["household_assets"]:
                row = _fetch_one(
                    cur,
                    """
                    SELECT internal_record_id, link_internal_record_id, asset_type, quantity
                    FROM g2p_register_household_assets WHERE internal_record_id = %s
                    """,
                    (asset["internal_record_id"],),
                )
                if not row:
                    errors.append(f"missing asset {asset['internal_record_id']}")
                elif row.get("link_internal_record_id") != asset["link_internal_record_id"]:
                    errors.append(f"asset.link mismatch for {asset['internal_record_id']}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sql-only", action="store_true", help="Apply SQL only")
    parser.add_argument("--verify-only", action="store_true", help="Verify only")
    args = parser.parse_args()
    dsn = _dsn()
    manifest = load_manifest()

    if not args.verify_only:
        apply_sql(dsn)

    if not args.sql_only:
        errs = verify(dsn, manifest)
        if errs:
            print("[func-seed] VERIFY FAILED:", file=sys.stderr)
            for e in errs:
                print(f"  - {e}", file=sys.stderr)
            return 1
        print(
            "[func-seed] verified "
            f"household={manifest['subjects']['household']['internal_record_id']} "
            f"individual={manifest['subjects']['individual']['internal_record_id']} "
            f"land={len(manifest['supporting']['individual_land'])} "
            f"assets={len(manifest['supporting']['household_assets'])}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
