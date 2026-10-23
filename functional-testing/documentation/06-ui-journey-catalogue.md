# UI journey catalogue (staff portal)

Inventory of staff-portal journeys under Playwright. Routes use locale prefix
(`/en/...`). Register mnemonic for U0 is **Individual**.

Source of truth for status: [`07-ui-coverage-matrix.md`](07-ui-coverage-matrix.md).
Plan: [`05-ui-test-plan.md`](05-ui-test-plan.md).

---

## Actors and data

| Actor | How |
|---|---|
| Staff user | Keycloak via `auth.setup.ts` → `.auth/user.json` |
| Fixture data | `scripts/provision_fixture.py` (API) → `fixtures/provisioned.json` |

### Fixture fields (slim gate)

| Key | Used by |
|---|---|
| `register_mnemonic`, `locale` | Individual page objects (default) |
| `individual.*` | Register search/open |
| `pending_intake.*` | Intake queue (Individual) |
| `pending_cr.*` | CR queue; register-with-CR (Individual) |
| `household.register_mnemonic` | Household page calls (explicit mnemonic) |
| `household.subject.*` | Household register browse (`search_text` = head name) |
| `household.pending_intake.*` | Household intake queue |
| `household.pending_cr.*` | Household CR queue + register-with-CR |
| `create_ui.individual.*` | Edit Details → create CR (Individual) |
| `create_ui.household.*` | Edit Details → create CR (Household) |
| `awe_approve.individual.*` | Tasks → Approve intake/CR (Individual) |
| `awe_approve.household.*` | Tasks → Approve intake/CR (Household) |

Finalize specs do **not** use provisioned pending rows; they call
`apiCreateDraftIntake` at runtime.

---

## U0 — Critical journeys (compose gate)

### Auth & shell

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U0-A1 | Login via Keycloak | `/api/login` → Keycloak → UI | `tests/auth.setup.ts`, `helpers/auth.ts` |
| U0-H1 | Authenticated home shell | `/{locale}/` | `tests/home/home.spec.ts` |

### Register

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U0-R1 | Search finds subject and opens detail | `/register/Individual` + top-bar search | `register-read.spec.ts`, `pages/register.ts` |
| U0-R2 | Subject change-request tab shows pending CR | `.../register/.../{id}/change-request` | `register-read-with-cr.spec.ts` |

### Intake

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U0-I1 | Search finds finalized pending intake and opens | `/intake-form/Individual` | `intake-queue.spec.ts`, `pages/intake.ts` |

### Change request

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U0-C1 | Search finds pending CR and opens detail | `/change-request` | `change-request-queue.spec.ts`, `pages/change-request.ts` |

### AWE Tasks approve

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U0-I2 | Tasks → Approve intake (all stages) → APPROVED | `/tasks/intake-form` | `tests/tasks/*`, `pages/approvals.ts` |
| U0-C2 | Tasks → Approve CR → register field | `/tasks/change-request` | same |

---

## U1 — Household parity (compose gate)

| ID | Journey | Entry | Spec / helper |
|---|---|---|---|
| U1-R1 | Search finds household and opens detail | `/register/Household` | `household-register-read.spec.ts` |
| U1-R2 | Subject CR tab shows pending CR | `.../register/Household/{id}/change-request` | `household-register-read-with-cr.spec.ts` |
| U1-I1 | Search finds finalized pending household intake | `/intake-form/Household` | `household-intake-queue.spec.ts` |
| U1-C1 | Search finds pending household CR | `/change-request` | `household-change-request-queue.spec.ts` |

---

## U2 — Browser mutations (compose gate)

| ID | Journey | Notes |
|---|---|---|
| U2-I1 | Finalize draft intake in UI | API `create_draft_intake` → open `new/{formId}?sid=` → Next-walk Modified → **Submit** → confirm → FINAL/PENDING (**Individual** on gate; Household parked — Members table required) |
| U2-C1 | Create field CR from subject detail in UI | **Edit Details** → change field → **Save** → CR on subject tab (I middle_name; H head name) |
| U2-I2 | Delete draft intake in UI | **Deferred** — no staff-ui delete control (API Tier-1 covers delete) |

---

## Optional — hybrid / reject leftovers (parked)

Specs under `tests/optional/` (ignored by default chromium). Gate approve lives
in `tests/tasks/` with AWE assignees = `alex.carter` then `nina.patel`.

| ID | Journey | Notes |
|---|---|---|
| — | Intake / CR approve (hybrid api-bridge) | Superseded by Tasks specs |
| U1-I3 / U1-C3 | Intake / CR reject (hybrid) | Prefer UI Reject; else `api-bridge` |
| U1-I4 / U1-C4 | Approve UI-only | Legacy env-gated; use Tasks path instead |

---

## U3 — Secondary smokes (optional)

| ID | Journey | Notes |
|---|---|---|
| U3-S1 | Shell / language / theme smoke | Prefer API Tier-2 for correctness |
| U3-S2 | Export / scores / AWE task list | Env-gated where external deps needed |

---

## Page object map

| Module | Responsibility |
|---|---|
| `pages/register.ts` | Open register list; search + open subject |
| `pages/intake.ts` | Open intake list; search + open submission; draft Submit |
| `pages/change-request.ts` | Open CR list; search + open CR |
| `pages/register-edit.ts` | Edit Details → field change → Save (CR create) |
| `pages/approvals.ts` | UI-only Approve/Reject clicks (optional suite) |
| `helpers/auth.ts` | Keycloak login; top-bar search |
| `helpers/fixture.ts` | Load `provisioned.json`; `localePath` |
| `helpers/api-bridge.ts` | Optional approve/reject + `apiCreateDraftIntake` |

---

## Out of scope

- Pixel / visual regression
- Partner or registrant-facing UI
- Load / performance in the browser
- Full catalogue of every staff config screen (API owns correctness)
