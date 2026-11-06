# Functional seed fixtures

Deterministic Postgres rows for Staff Tier-1+ dual-asserts.

| File | Role |
|---|---|
| `seed.sql` | UPSERT household / individual / land / assets |
| `seed_manifest.json` | Stable ids + expected fields for tests |

See [`../../documentation/04-seeding.md`](../../documentation/04-seeding.md).
Load: `python3 scripts/load_functional_seed.py` (requires `FUNC_REGISTRY_DSN`).
