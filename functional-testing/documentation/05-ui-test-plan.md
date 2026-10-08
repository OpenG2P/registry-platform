# Functional UI test plan (registry-platform)

## 1. Objectives

Prove **staff portal critical paths** in the browser against the **reference
extension**, using the same lifecycle the API suite already validates:

1. Authenticated shell loads without auth failures.
2. Staff can **find and open** provisioned register / intake / change-request
   records.
3. Staff can complete **browser mutations** that the staff UI actually owns:
   finalize draft intake (Submit) and create a change request (Edit Details).

API + DB dual-assert remains owned by [`01-test-plan.md`](01-test-plan.md) and
`api/`. UI tests assert **user-visible** outcomes only.

Performance testing and Partner/Agent UIs are out of scope.

## 2. Separation from API functional tests

| | API (`api/`) | UI (`ui/`) |
|---|---|---|
| Question | Is the operation / data correct? | Does the staff portal surface the journey? |
| Tooling | pytest + httpx | Playwright (Chromium) |
| Truth | G2P envelope + Postgres | Route, labels, status text, downstream screen |
| Data | Seed + live create in tests | **API-provisioned** fixtures (`global-setup`) |
| Code | Shared `helpers/` for HTTP/flows | Page objects + thin TS helpers; Python scripts call the same `helpers/` |

Ideas align (lifecycle, Individual + Household). Implementations must not
import from performance-testing.

## 3. Applications in scope

| Surface | Status |
|---|---|
| **Staff UI** (`ui/staff-ui`) | Primary — slim gate in compose |
| Partner / Agent UI | Out of scope |

Extension under test: `reference-extension` (platform-owned gate).

## 4. Tiers

| Tier | Role | When |
|---|---|---|
| **U0 — Critical journeys** | Home, register read, intake queue, CR queue (**Individual**) | **Compose gate** |
| **U1 — Household parity** | Same browse/queue journeys for Household | **Compose gate** |
| **U2 — Browser mutations** | Finalize API draft in UI; create CR via Edit Details (**I+H**) | **Compose gate** |
| **Optional — AWE decisions** | Hybrid / reject leftovers | Parked in `tests/optional/` |
| **U3 — Secondary smokes** | Config, scores, AWE list, export | Opt-in / nightly |

Staff UI Approve/Reject are **AWE task decisions**. Compose gate seeds
**stage 1 `alex.carter`** and **stage 2 `nina.patel`**; `tests/tasks/`
exercises Tasks → Approve (no api-bridge).
Legacy direct `approve_*` remains in API Tier-1 provision helpers.

## 5. Assert contract

| Step | Assert |
|---|---|
| Auth / shell | No `AUTH_GENERIC_ERROR` / `G2P-AUT-*`; expected nav or route |
| Find | Search finds provisioned entity; detail URL + key name / id fragment |
| Create CR | Edit Details → Save → new value visible on subject / CR tab |
| Finalize | Draft intake → Submit → FINAL / PENDING visible |
| State | Body contains expected status text where the journey mutates status |

Do **not** dual-assert DB from Playwright. If a journey needs DB truth, keep it
in `api/` and only smoke the UI.

## 6. Fixture model

```text
global-setup.ts
  → scripts/provision_fixture.py   (StaffClient + helpers/provision)
  → fixtures/provisioned.json
tests/* load via helpers/fixture.ts
```

Slim fixture (default):

- Approved Individual + Household (register browse)
- Pending intake + pending CR (I+H) for queue / subject CR tab
- Dedicated `create_ui` subjects (I+H) with no pending CR on the edited section
- Finalize specs create drafts at runtime (`apiCreateDraftIntake`)

Skip re-provision: `FUNC_UI_SKIP_PROVISION=1` (requires existing fixture file).

`chromium` project sets `testIgnore: /\/optional\//` so parked approve/reject
specs never run on the gate.

## 7. Target layout

```text
functional-testing/ui/
  helpers/          # fixture, auth, api-bridge (optional + draft create)
  pages/            # register / intake / change-request / register-edit
  scripts/          # provision_fixture.py, approve_fixture.py
  fixtures/         # provisioned.json (generated)
  tests/
    auth.setup.ts
    home/
    register/
    intake/
    change-request/
    optional/       # parked hybrid approve/reject + AWE UI-only
  global-setup.ts
  playwright.config.ts
```

Catalogue + coverage: [`06-ui-journey-catalogue.md`](06-ui-journey-catalogue.md),
[`07-ui-coverage-matrix.md`](07-ui-coverage-matrix.md). Runbook:
[`../ui/README.md`](../ui/README.md).

## 8. Pass / fail

- Slim gate: all chromium specs outside `tests/optional/` green on compose gate.
- Matrix (`07`) is the source of truth for journey status.

## 9. Phased delivery

| Phase | Deliverable | Status |
|---|---|---|
| **U-A** | Docs: plan + catalogue + coverage matrix; expand `ui/README.md` | **Done** |
| **U-B** | Harden U0 fixture ownership / ordering notes in code | **Done** |
| **U-C** | Household browse/queue | **Done** (on slim gate) |
| **U-D** | Reject + UI-only approve | **Parked** (`tests/optional/`; needs AWE) |
| **U-E** | Browser mutations (U2) | **Done** (I+H finalize + CR create; delete deferred) |
| **Slim** | Drop hybrid approve/reject from default gate + provision | **Done** |
| **U-F** | Farmer-registry adoption of UI pattern | Later |
