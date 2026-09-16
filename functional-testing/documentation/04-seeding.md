# Functional data seeding

## Purpose

Provide a **small, deterministic** Postgres dataset so Staff Tier-1+ endpoint
tests can dual-assert against known ids and search anchors — without provisioning
a full intake workflow for every read.

This is **not** performance bulk seeding. No shared code with any
performance-testing tree.

## Artefacts

| Path | Role |
|---|---|
| [`../fixtures/seed/seed.sql`](../fixtures/seed/seed.sql) | UPSERT household `h001`, individual `i001`, land `land001`, assets |
| [`../fixtures/seed/seed_manifest.json`](../fixtures/seed/seed_manifest.json) | Stable ids, search terms, expected field snapshots |
| [`../scripts/load_functional_seed.py`](../scripts/load_functional_seed.py) | Apply SQL via `FUNC_REGISTRY_DSN` + verify vs manifest |
| [`../helpers/seed_manifest.py`](../helpers/seed_manifest.py) | Pytest helper to read the committed manifest |

## Fixed ids

| Kind | `internal_record_id` | Search / identity |
|---|---|---|
| Household | `h001` | `FUNCSEEDHead001` (also `FUNC_HOUSEHOLD_ID`) |
| Individual | `i001` | `FUNCSEEDInd001` (linked to `h001`) |
| Land | `land001` | linked to `i001` |
| Assets | `asset-land-001`, `asset-livestock-001` | linked to `h001` |

## When it runs

Compose gate (after platform `db-seed`) loads `seed.sql` via `psql` inside the
postgres container, then optionally verifies with `load_functional_seed.py
--verify-only`.

Manual:

```bash
export FUNC_REGISTRY_DSN=postgresql://registry_user:functest123@127.0.0.1:15432/registry
cd functional-testing
python3 scripts/load_functional_seed.py
```

## Relationship to Tier-0

Tier-0 workflows still **provision fresh** subjects via intake APIs (unique
names). They may use `h001` only as the Individual household link
(`FUNC_HOUSEHOLD_ID`). Seed rows are primarily for Tier-1 read/search suites.
