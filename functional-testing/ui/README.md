# UI functional tests (E2E)

Playwright E2E for the **staff portal** against the **reference extension**.
Journeys mirror the API lifecycle: home → register → intake → change request.

| Doc | Purpose |
|---|---|
| [`../documentation/05-ui-test-plan.md`](../documentation/05-ui-test-plan.md) | Objectives, tiers (U0–U3), assert contract, phases |
| [`../documentation/06-ui-journey-catalogue.md`](../documentation/06-ui-journey-catalogue.md) | Journey inventory + page map |
| [`../documentation/07-ui-coverage-matrix.md`](../documentation/07-ui-coverage-matrix.md) | Covered / planned / out of scope |

API + DB truth: [`../api/README.md`](../api/README.md).

**Slim compose gate:** browse + queue (I+H), Edit Details → create CR, draft
Submit finalize (Individual), **AWE Tasks → Approve** (I+H intake + CR).
Data is **API-seeded** via `global-setup`
(`scripts/provision_fixture.py` → `fixtures/provisioned.json`).

AWE approver rules are seeded production-style: **stage 1 `alex.carter`**, then
**stage 2 `nina.patel`**. Hybrid api-bridge approve/reject specs remain under
`tests/optional/` (ignored).

## Mental model

```
ui/
├── helpers/           # fixture load, Keycloak auth, API create-draft bridge
├── pages/             # browser navigation (register / intake / CR / edit)
├── scripts/           # Python provision (+ approve for optional hybrids)
├── fixtures/          # provisioned.json (generated; gitignored content)
├── tests/
│   ├── auth.setup.ts  # storageState login
│   ├── home/
│   ├── register/
│   ├── intake/
│   ├── change-request/
│   └── optional/      # parked: hybrid approve/reject + AWE UI-only
├── global-setup.ts
└── playwright.config.ts
```

### Journey map (slim gate)

| Folder | Specs | What it proves |
|--------|-------|----------------|
| `home/` | `home.spec.ts` | Authenticated shell renders |
| `register/` | `register-read*.spec.ts`, `household-register-*.spec.ts` | Search/open subject; pending CR visible (I+H) |
| `intake/` | `*-queue`, `*-finalize-ui` | Queue search (I+H); UI finalize draft (**Individual**; Household parked) |
| `change-request/` | `*-queue`, `*-create-ui` | Queue search (I+H); Edit Details → create CR (I+H) |
| `tasks/` | `*-approve*.spec.ts` | AWE Tasks → login as `alex` then `nina`; approve all stages (I+H intake + CR) |
| `optional/` | hybrid / reject / hh finalize | Parked — not on gate |

### Fixture contract

`fixtures/provisioned.json` (written by slim `provision_fixture.py`):

| Field | Purpose |
|-------|---------|
| `locale` | e.g. `en` → paths `/en/...` |
| `register_mnemonic` | Individual default for page helpers |
| `individual` | Approved Individual for register browse |
| `pending_intake` | Finalized PENDING Individual submission (queue) |
| `pending_cr` | PENDING Individual CR (`new_middle_name`) for queue + CR tab |
| `household.register_mnemonic` | `Household` |
| `household.subject` | Approved household (`search_text` = head name) |
| `household.pending_intake` | Finalized PENDING household intake (queue) |
| `household.pending_cr` | PENDING household CR (`new_value` = new head name) |
| `create_ui.individual` / `create_ui.household` | Clean subjects (no pending CR) for Edit Details → create CR |
| `awe_approve.individual` / `awe_approve.household` | Dedicated pending intake + CR for Tasks → Approve (not used by queue) |

Suite uses **`workers: 1`**. Queue specs are read-only against pending entities.
Finalize specs create drafts at runtime; create-UI specs use dedicated subjects.
Re-provision between full runs when pending rows are stale (`global-setup`).

### Where to change what

- New page navigation → `pages/`
- Fixture shape / locale paths → `helpers/fixture.ts` + `scripts/provision_fixture.py`
- Login / top-bar search → `helpers/auth.ts`
- Create CR in browser → `pages/register-edit.ts` (Individual middle_name; Household head name)
- Finalize API draft in browser → `pages/intake.ts` (`openDraftIntake` / `clickIntakeSubmit`) + `apiCreateDraftIntake`
- Optional hybrid approve/reject → `tests/optional/` + `helpers/api-bridge.ts` (not gate)
- New E2E journey → `tests/<domain>/` + update `06` / `07` docs

### Adding a test (checklist)

1. Ensure provision exposes any new ids/names in `provisioned.json`.
2. Add or extend a page helper under `pages/`.
3. Add `tests/<domain>/*.spec.ts` asserting visible outcomes only.
4. Mark the row in `07-ui-coverage-matrix.md` (**covered** / **partial** / **planned**).
5. Prefer role/name selectors; keep API bridges out of slim-gate specs.

## How to run

**Node ≥ 20** required for Playwright (e.g. `nvm use 20`).

Prefer the compose gate (builds staff-ui from `ui/staff-ui` Dockerfile):

```bash
cd registry-platform
FUNC_SKIP_API=1 ./functional-testing/docker/run-compose-gate.sh
```

Reuse stack:

```bash
FUNC_SKIP_STACK=1 FUNC_SKIP_API=1 FUNC_SKIP_TEARDOWN=1 \
  ./functional-testing/docker/run-compose-gate.sh
```

Manual (stack up, `functional-testing/.env` set):

```bash
cd functional-testing/ui
npm ci && npx playwright install chromium
npx playwright test
npx playwright test tests/intake
npm run test:headed
```

Skip re-provision (reuse `fixtures/provisioned.json`):

```bash
FUNC_UI_SKIP_PROVISION=1 npx playwright test
```

### Useful env

| Variable | Role |
|----------|------|
| `FUNC_UI_BASE` | Staff UI origin (gate: `http://localhost:3000`) |
| `FUNC_UI_SKIP_PROVISION` | `1` = skip `provision_fixture.py` |
| `FUNC_VERIFY_TLS` | `false` → `ignoreHTTPSErrors` |
| Staff / Keycloak creds | Same `FUNC_*` as API suite (see `../.env.example`) |

## Debugging

- HTML report: `npx playwright show-report` (or `npm run report`)
- On failure: screenshot + video under `test-results/`; trace on retry
- Keep stack: `FUNC_SKIP_TEARDOWN=1` on the compose gate
- Auth issues: confirm Keycloak browser origin rewrite (`helpers/auth.ts`)

## Out of scope

Pixel regression, Partner/Agent UI, load testing, full secondary staff screens
(correctness stays in API Tier-1/2), and AWE Approve/Reject UI until re-enabled
under `tests/optional/`. See matrix U3 / optional rows.
