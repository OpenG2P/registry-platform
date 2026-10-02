# registry-platform functional testing (API + UI)

Functional test suite for the registry-platform against the **reference
extension** (Individual and Household registers).

- **API tests** (pytest): correctness of staff (then partner) APIs — **API
  response + DB** dual-assert. See [`api/README.md`](api/README.md) and
  [`documentation/`](documentation/) (`01`–`04`: plan, catalogue, matrix, seed).
- **UI tests** (Playwright E2E): staff portal critical paths (**U0** Individual +
  **U-C** Household on compose gate). See [`ui/README.md`](ui/README.md) and
  [`documentation/`](documentation/) (`05`–`07`: UI plan, journeys, coverage).

### API coverage model

| Tier | Role | Gate |
|---|---|---|
| **0** | Workflow smoke (intake → register → CR) | **PR compose gate (current)** |
| **1–2** | Staff endpoint suites | Expand after docs (not all on PR yet) |
| **3** | Partner ingest + DCI | After Staff complete |

Performance testing is separate — **no shared methods** with this tree.

Extension-specific API tests (e.g. farmer payloads) live in each extension repo.


## Quick start (Docker Compose gate)

```bash
cd registry-platform
chmod +x functional-testing/docker/run-compose-gate.sh
./functional-testing/docker/run-compose-gate.sh
```

Platform images are built from local Dockerfiles on every gate run.
Commons (Keycloak, IAM, AWE, …) still pull from Docker Hub.

### Subsets

```bash
FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh   # API only
FUNC_SKIP_API=1 ./functional-testing/docker/run-compose-gate.sh  # UI only
FUNC_SKIP_TEARDOWN=1 ./functional-testing/docker/run-compose-gate.sh  # keep stack
FUNC_SKIP_STACK=1 FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh  # reuse stack
```

GitHub Actions: `.github/workflows/functional-gate.yml`.

## Manual run

```bash
# Stack up (or FUNC_SKIP_STACK=1 against a running gate stack)
pip install -r functional-testing/requirements.txt

# API (Tier-0 workflows)
cd functional-testing
PYTHONPATH=. pytest -c api/pytest.ini api/workflows -v
# Staff Tier-1 / Tier-2 (opt-in; needs seed)
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier1 -v
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier2 -v
PYTHONPATH=. pytest -c api/pytest.ini api/partner -m tier3 -v

# UI
cd functional-testing/ui
npm ci && npx playwright install chromium && npx playwright test
```

## Project structure

```
functional-testing/
├── documentation/       # API 01–04 + UI 05–07 (plan, catalogue, matrix, seed)
├── fixtures/seed/       # deterministic SQL + seed_manifest.json
├── api/                 # pytest API suite — see api/README.md
│   ├── workflows/       # Tier-0 PR gate × Individual + Household
│   ├── staff/           # Tier-1/2 endpoint suites (opt-in markers)
│   ├── partner/         # Tier-3 Partner ingest + DCI (opt-in)
│   ├── assertions/      # response + DB + dual validators
│   ├── profile_params.py
│   ├── conftest.py
│   └── pytest.ini
├── helpers/             # shared by API tests + UI fixture scripts
│   ├── config.py, profiles.py, auth.py, http.py, seed_manifest.py
│   ├── payloads/        # section builders (individual / household)
│   ├── flows/           # intake, register, change_request
│   ├── models.py, util.py
│   └── provision.py     # façade re-exports for UI scripts
├── docker/              # Compose gate
├── scripts/             # Keycloak seed + load_functional_seed.py
├── ui/                  # Playwright UI E2E — see ui/README.md
│   ├── helpers/         # fixture, auth, api-bridge
│   ├── pages/           # register / intake / change-request
│   ├── tests/           # home, register, intake, change-request
│   └── scripts/         # provision / approve fixtures
└── requirements.txt
```
