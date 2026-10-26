# API functional tests

Pytest suite for registry-platform APIs against the **reference extension**
(Individual + Household). Assert **API response and database** (dual-assert).

## Docs (start here for coverage intent)

| Doc | Purpose |
|---|---|
| [`../documentation/01-test-plan.md`](../documentation/01-test-plan.md) | Tiers, assert contract, phases |
| [`../documentation/02-endpoint-catalogue.md`](../documentation/02-endpoint-catalogue.md) | Full Staff + Partner catalogue |
| [`../documentation/03-coverage-matrix.md`](../documentation/03-coverage-matrix.md) | What’s covered vs missing |

**Local pytest / compose default = Tier-0 workflows** (`api/workflows/`).
**GitHub PR gate = T0 + Staff T1/T2 + Partner T3 + UI** (see
`.github/workflows/functional-gate.yml`). Staff suites: `api/staff/`; Partner:
`api/partner/`. No code sharing with performance-testing.

## Mental model

```
helpers/                 shared by API tests + UI fixture scripts
├── config.py            env + register / section IDs
├── profiles.py          RegisterProfile (Individual / Household contract)
├── auth.py, http.py     OIDC + staff API client
├── payloads/            section payload builders per register
├── flows/               lifecycle steps (fixtures + Tier-0)
│   ├── intake.py
│   ├── register.py
│   └── change_request.py
├── models.py            IntakeResult, ProvisionedRecord, ChangeRequestResult
├── util.py              response_payload, assert_ok, unique names
└── provision.py         thin re-export façade (prefer flows/ in new code)

api/
├── workflows/           Tier-0 (always; parametrized × 2 registers)
├── staff/               Tier-1+ endpoint suites (GitHub PR; local opt-in)
├── partner/             Tier-3 (GitHub PR; local opt-in)
├── assertions/          response / db / dual (API↔DB) validators
├── profile_params.py    @with_register_profiles
└── conftest.py          cfg, staff, linked_household, household_id_for

documentation/           catalogue + coverage matrix + seeding (source of truth)
fixtures/seed/           deterministic SQL + seed_manifest.json
```

### Tier-0 workflow map

| File | What it proves |
|------|----------------|
| `workflows/test_intake_create.py` | Finalize → draft FINAL / approval PENDING (API + DB) |
| `workflows/test_intake_approve.py` | Two-stage AWE approve → register row; main `match_fields` + supporting dual-assert |
| `workflows/test_register_read.py` | Summary, subject, tabs, pending CR list |
| `workflows/test_cr_create.py` | CR PENDING; subject field **unchanged** |
| `workflows/test_cr_approve.py` | Two-stage AWE; CR APPROVED; subject field **applied**; **subject history** linkage |
| `workflows/test_cr_supporting_history.py` | Two-stage AWE; supporting TABLE CR applied + **child history** linkage |

### Register profiles

Defined in `helpers/profiles.py`:

| | Individual | Household |
|---|---|---|
| Identity / search | `first_name` | `household_head_name` |
| CR field | `middle_name` | `household_head_name` |
| Strict match fields | demographics, location, livelihood (subject), … | headship, sizes, dwelling, address, … |
| Supporting tables (intake today) | `g2p_register_individual_land` | `g2p_register_household_assets` |
| Supporting CR + history | land `land_size` (live) + history linkage | assets `quantity` (live) + history linkage |
| Needs linked HH | yes | no |

History asserts use `change_request_id` linkage. Domain fields are asserted on
history only when the history **schema** declares them (e.g. Individual
`middle_name`).

`verify_and_approve_intake` / `verify_and_approve_cr` hit `/approve_*` directly
and are **fixture-only** (provision + optional UI hybrids). Workflow scenarios
use two-stage AWE (`approve_two_stage_awe`).

Add `@with_register_profiles` (from `profile_params`) so a scenario runs for both.

### Where to change what

- Coverage status → `documentation/03-coverage-matrix.md`
- Functional seed / manifest → `fixtures/seed/` + `helpers/seed_manifest.py`
- New env / IDs → `helpers/config.py`
- New register variant → `helpers/profiles.py` + `helpers/payloads/<name>.py`
- New HTTP lifecycle step → `helpers/flows/`
- New check → `api/assertions/`
- New Tier-0 workflow → `api/workflows/` + `@with_register_profiles`
- New Tier-1+ endpoint suite → `api/staff/<group>/`

## How to run

Prefer the compose gate (starts stack, seeds Keycloak, runs pytest):

```bash
cd registry-platform
FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh
```

Reuse an already-up stack:

```bash
FUNC_SKIP_STACK=1 FUNC_SKIP_UI=1 FUNC_SKIP_TEARDOWN=1 \
  ./functional-testing/docker/run-compose-gate.sh
```

Manual pytest (stack must be up; `.env` filled):

```bash
cd functional-testing
PYTHONPATH=. pytest -c api/pytest.ini api/workflows -v
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier1 -v   # Tier-1 (needs seed)
PYTHONPATH=. pytest -c api/pytest.ini api/staff -m tier2 -v   # Tier-2 (needs seed)
PYTHONPATH=. pytest -c api/pytest.ini api/partner -m tier3 -v # Partner (needs partner-api)
PYTHONPATH=. pytest -c api/pytest.ini api/workflows -k household -v
```
