# Partner endpoint suites (Tier-3)

Catalogue endpoints:

| Path | Test |
|---|---|
| `POST /partner/ingest_data` | `test_ingest_data.py` — accept + raw row via staff search |
| `POST /dci/registry/sync/search` | `test_dci_sync_search.py` — consent + signature enforcement |

## Consent / Partner Management

Compose gate runs Partner Management **1.0.3** + Consent Manager **1.0.2**
(CM 1.0.3 is broken: fastapi-common 1.2.1 dropped `utils.crypto`) and enables:

- `REGISTRY_PARTNER_API_SIGNATURE_VALIDATION_ENABLED=true`
- `REGISTRY_PARTNER_API_CONSENT_ENFORCEMENT_ENABLED=true`

`scripts/partner_consent_seed.py` onboards `PARTNER_FUNC_PARTNER` and a CM binding
whose allowed scopes match Individual DCI template top-level keys
(`demographic_info`, `registration_date`).

## Run

```bash
cd functional-testing
PYTHONPATH=. pytest -c api/pytest.ini api/partner -m tier3 -v --tb=short
```

Compose gate:

```bash
FUNC_RUN_PARTNER_TIER3=1 FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh
```

Coverage: [`../../documentation/03-coverage-matrix.md`](../../documentation/03-coverage-matrix.md)
