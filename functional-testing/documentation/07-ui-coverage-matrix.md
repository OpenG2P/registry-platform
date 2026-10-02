# UI coverage matrix (staff portal)

Status of each catalogue journey vs the current Playwright suite.

| Status | Meaning |
|---|---|
| **covered** | Dedicated spec in `ui/tests/` on slim compose gate |
| **partial** | Covered with caveats (e.g. API approve bridge) — optional suite only |
| **parked** | Spec exists under `tests/optional/`; ignored by default chromium project |
| **deferred** | Explicitly deferred or owned by API |
| **out of scope** | Not planned for UI gate |

Update this file when adding specs. Catalogue: [`06-ui-journey-catalogue.md`](06-ui-journey-catalogue.md).
Plan: [`05-ui-test-plan.md`](05-ui-test-plan.md).

Profiles: **I** = Individual, **H** = Household.

---

## Slim gate — browse / queue / mutations

### U0 — Individual

| ID | Journey | Profile | Status | Spec |
|---|---|---|---|---|
| U0-A1 | Keycloak login → storageState | — | covered | `tests/auth.setup.ts` |
| U0-H1 | Authenticated home shell | — | covered | `tests/home/home.spec.ts` |
| U0-R1 | Register search → open detail | I | covered | `tests/register/register-read.spec.ts` |
| U0-R2 | Subject CR tab shows pending CR | I | covered | `tests/register/register-read-with-cr.spec.ts` |
| U0-I1 | Intake queue search → open | I | covered | `tests/intake/intake-queue.spec.ts` |
| U0-C1 | CR queue search → open | I | covered | `tests/change-request/change-request-queue.spec.ts` |

### U1 — Household

| ID | Journey | Profile | Status | Spec |
|---|---|---|---|---|
| U1-R1 | Register search → open | H | covered | `tests/register/household-register-read.spec.ts` |
| U1-R2 | Subject CR tab pending | H | covered | `tests/register/household-register-read-with-cr.spec.ts` |
| U1-I1 | Intake queue | H | covered | `tests/intake/household-intake-queue.spec.ts` |
| U1-C1 | CR queue | H | covered | `tests/change-request/household-change-request-queue.spec.ts` |

### U2 — Browser mutations

| ID | Journey | Profile | Status | Spec |
|---|---|---|---|---|
| U2-I1 | API draft → UI Submit finalize | I | covered | `tests/intake/intake-finalize-ui.spec.ts` |
| U2-I1 | API draft → UI Submit finalize | H | parked | `tests/optional/household-intake-finalize-ui.spec.ts` (Members table required; API draft skips `hh_members`) |
| U2-C1 | Edit Details → Save creates CR | I | covered | `tests/change-request/change-request-create-ui.spec.ts` |
| U2-C1 | Edit Details → Save creates CR | H | covered | `tests/change-request/household-change-request-create-ui.spec.ts` |
| U2-I2 | Delete draft in UI | — | deferred | No delete control in staff UI (API Tier-1) |

### AWE Tasks approve (compose gate)

Assignees: stage 1 `alex.carter`, stage 2 `nina.patel` (see `awe_meta_data/30_approver_rule.sql`).

| ID | Journey | Profile | Status | Spec |
|---|---|---|---|---|
| U0-I2 | Tasks → Approve intake → APPROVED | I | covered | `tests/tasks/intake-and-cr-approve-individual.spec.ts` |
| U0-C2 | Tasks → Approve CR → field on register | I | covered | `tests/tasks/intake-and-cr-approve-individual.spec.ts` |
| U1-I2 | Tasks → Approve intake → APPROVED | H | covered | `tests/tasks/household-intake-and-cr-approve.spec.ts` |
| U1-C2 | Tasks → Approve CR → head name on register | H | covered | `tests/tasks/household-intake-and-cr-approve.spec.ts` |

Run: compose gate or `cd functional-testing/ui && npx playwright test`.

---

## Optional — hybrid / reject (not on gate)

| ID | Journey | Profile | Status | Spec |
|---|---|---|---|---|
| U0-I2 | Intake approve → APPROVED | I | parked | `tests/optional/intake-approve.spec.ts` (hybrid; gate uses Tasks) |
| U0-C2 | CR approve → APPROVED + register field | I | parked | `tests/optional/change-request-approve.spec.ts` |
| U1-I2 | Intake approve | H | parked | `tests/optional/household-intake-approve.spec.ts` |
| U1-C2 | CR approve + register effect | H | parked | `tests/optional/household-change-request-approve.spec.ts` |
| U1-I3 | Intake reject → REJECTED | I | parked | `tests/optional/intake-reject.spec.ts` |
| U1-I3 | Intake reject → REJECTED | H | parked | `tests/optional/household-intake-reject.spec.ts` |
| U1-C3 | CR reject → REJECTED; subject unchanged | I | parked | `tests/optional/change-request-reject.spec.ts` |
| U1-C3 | CR reject → REJECTED; head name unchanged | H | parked | `tests/optional/household-change-request-reject.spec.ts` |
| U1-I4 | Intake approve UI-only | I | parked | `tests/optional/intake-approve-ui-only.spec.ts` |
| U1-C4 | CR approve UI-only | I | parked | `tests/optional/change-request-approve-ui-only.spec.ts` |

Staff Approve/Reject buttons require AWE task assignment. Slim provision no longer
writes `reject` / `ui_only` blocks. See `tests/optional/README.md`.

---

## U3 — Secondary (out of scope for PR gate)

| ID | Journey | Status | Notes |
|---|---|---|---|
| U3-S1 | Language / theme / registry config UI | out of scope | API Tier-2 `shell/` |
| U3-S2 | Export queue / scores / AWE UI | out of scope | API Tier-2; env-gated deps |

---

## Fixture / isolation notes

| Concern | Slim gate |
|---|---|
| Shared `provisioned.json` | Yes (Individual + Household + `create_ui`) |
| `workers: 1` | Required |
| Queue pending rows | Read-only on gate; re-provision if stale |
| Create-UI subjects | Dedicated; no pending CR on edited section |
| Finalize drafts | Created at runtime per spec |

---

## Mapping to API Tier-0

UI does not replace API dual-assert. Rough pairing:

| API workflow | UI analogue |
|---|---|
| `test_register_read` | U0-R1 (+ U0-R2 pending list smoke) |
| `test_intake_create` / queue reads | U0-I1 (find finalized) |
| `test_cr_create` / search | U0-C1 |
| `test_intake_finalize` (draft → final) | U2-I1 |
| `test_cr_create` (field change) | U2-C1 |
| `test_intake_approve` / `test_cr_approve` | API Tier-1; optional UI parked |
