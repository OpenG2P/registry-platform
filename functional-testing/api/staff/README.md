# Staff endpoint suites (Tier-1+)

Dedicated per-endpoint / per-controller-group scenarios. **Not** on the PR gate
by default (`pytest.ini` `testpaths = workflows`).

## Layout

```text
staff/
  register_data/       # Tier-1 seeded register reads
  intake_form_data/    # Tier-1 reject + delete
  change_requests/     # Tier-1 reject/reads + Tier-2 cross-register
  metadata/            # Tier-1 metadata reads
  shell/               # Tier-2 config / language / theme
  scores/              # Tier-2 completion + computation + register scores
  export/              # Tier-2 export queue
  ingestion/           # Tier-2 ingestion config/data reads (+ CRUD via data_model)
  outgestion/          # Tier-2 outgestion reads
  input_mechanism/     # Tier-2 VC/import metadata + enqueue
  data_model/          # Tier-2 data-model + pipeline CRUD
  metadata_writes/     # Tier-2 disposable register lifecycle
  awe/                 # Tier-2 AWE policy (+ env-gated proxy/webhook)
  registrant_auth/     # Tier-2 auth provider/status/history
```

## Run

Requires a stack with functional seed loaded (`load_functional_seed.py`).

```bash
cd functional-testing
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier1 -v --tb=short
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier2 -v --tb=short
# or all staff:
PYTHONPATH=. pytest -c api/pytest.ini api/staff -v --tb=short
```

Compose gate (optional):

```bash
FUNC_RUN_STAFF_TIER1=1 FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh
FUNC_RUN_STAFF_TIER2=1 FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh
```

Env-gated Tier-2 extras:

| Var | Effect |
|---|---|
| `FUNC_AWE_ENABLED=1` | AWE proxy list/stats |
| `FUNC_AWE_WEBHOOK_SECRET` | HMAC webhook probe |
| `FUNC_REGISTRANT_AUTH=1` | `authenticate_registrant` |
| `FUNC_STAFF_INGEST=1` | staff `ingest-data` probe |

Coverage status: [`../../documentation/03-coverage-matrix.md`](../../documentation/03-coverage-matrix.md)
