# Functional API test plan (registry-platform)

## 1. Objectives

Prove **correctness** of registry-platform APIs against the **reference extension**
(Individual + Household):

1. Each in-scope endpoint returns a valid G2P success (or expected error) envelope.
2. For mutating and state-returning calls, **API response fields match Postgres**
  (dual-assert: expected ↔ API ↔ DB).
  1. Coverage is **endpoint-oriented**, not only end-to-end workflow smoke.

UI Playwright coverage is separate (`ui/`) — see
[`05-ui-test-plan.md`](05-ui-test-plan.md). Agent API is out of scope until
implemented. Partner API follows Staff completion.

## 2. Separation from performance testing


|           | Functional (this tree)                                 | Performance                |
| --------- | ------------------------------------------------------ | -------------------------- |
| Question  | Is the data / behaviour correct?                       | How much load / latency?   |
| Tooling   | pytest + httpx                                         | Locust (elsewhere)         |
| Code      | **No shared methods/imports** with performance-testing | Own harness                |
| Catalogue | Authored here from live controllers                    | Independent copy if needed |


Ideas may align (endpoint list, tiers, seed/manifest). **Implementations must not
cross-import.**

## 3. Applications in scope


| App                  | Status                                         |
| -------------------- | ---------------------------------------------- |
| **Staff portal API** | Primary — T0 always; T1/T2 on GitHub PR gate   |
| **Partner API**      | Tier-3 on GitHub PR gate (`api/partner`)       |
| **Agent API**        | Deferred (not implemented)                     |


Extension under test: `reference-extension` only (platform-owned gate).

## 4. Tiers


| Tier                         | Role                                                                                                                | When                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **0 — Workflow gate**        | Happy-path intake → register → CR (Individual + Household), API↔DB on critical fields                               | **Always** (local compose default + GitHub)                      |
| **1 — Staff core endpoints** | Dedicated scenarios per core controller group (register-data, intake, CR, verifications, documents, metadata reads) | **GitHub PR**; local `FUNC_RUN_STAFF_TIER1=1`                    |
| **2 — Staff secondary**      | Scores, completion, ingestion/outgestion, AWE, themes/languages, config writes, input mechanisms                    | **GitHub PR**; local `FUNC_RUN_STAFF_TIER2=1`                    |
| **3 — Partner**              | `/partner/ingest_data`, `/dci/sync/search` (+ DB / async settle)                                                    | **GitHub PR**; local `FUNC_RUN_PARTNER_TIER3=1`                  |


GitHub PR compose gate is **T0–T3 + UI**. Local `run-compose-gate.sh` stays
**T0 + UI** unless the `FUNC_RUN_*` flags are set.

Direct `/approve_intake_form_submission` and `/approve_change_request` are
**fixture-only** (`verify_and_approve_*`). Workflow correctness uses two-stage
AWE (`approve_two_stage_awe`).

## 5. Assert contract


| Call type           | API                           | DB                                                              |
| ------------------- | ----------------------------- | --------------------------------------------------------------- |
| Read                | Envelope OK + contract fields | Optional existence / field match when returning persisted state |
| Write (intake / CR) | Status transitions + payload  | Live row; history **linkage** where product writes history      |
| Reject / validation | Stable error codes            | No unwanted mutation                                            |
| Async (partner)     | Accept response               | Eventual register / ingest state                                |


Do not assert domain columns on history rows unless those fields exist on the
history **schema** (product strips undeclared fields).

## 6. Target layout (evolve toward)

```text
functional-testing/
  documentation/          # this plan, catalogue, coverage matrix
  api/
    workflows/            # Tier-0 (parametrized Individual + Household)
    staff/                # Tier-1+ endpoint suites (GitHub PR; local opt-in)
    partner/              # Tier-3 (GitHub PR; local opt-in)
    assertions/           # response / db / dual
  helpers/                # functional-owned clients, payloads, flows-as-fixtures
  docker/                 # compose gate
```

## 7. Pass / fail

- Tier-0: all parametrized workflow scenarios green on every compose gate.
- GitHub PR: T0 + Staff T1/T2 + Partner T3 + slim UI green.
- Tier-1+: each catalogue row marked **covered** must have a scenario that
dual-asserts (or documents why API-only is sufficient). Fixture plumbing
(`verify_and_approve_*`) is **incidental**, not covered.
- Coverage matrix (`03-coverage-matrix.md`) is the source of truth for status.

## 8. Phased delivery


| Phase | Deliverable                                     | Status          |
| ----- | ----------------------------------------------- | --------------- |
| **A** | Docs: plan + catalogue + coverage matrix        | Done            |
| **B** | Move Tier-0 under `api/workflows/`              | Done            |
| **C** | Functional seed/manifest (small, deterministic) | Done            |
| **D** | Staff Tier-1 endpoint suites                    | Done (core batch + documents) |
| **E** | Staff Tier-2                                    | Done (E1–E6; GitHub PR) |
| **F** | Partner Tier-3                                  | Done (ingest + DCI search; GitHub PR) |
| **G** | Widen GitHub PR gate (T0–T3 + UI)               | **Done** (farmer overlay still later) |
| **U-A…** | Slim UI gate (browse/queue + U2 + AWE Tasks); hybrid/reject parked | See [`05-ui-test-plan.md`](05-ui-test-plan.md) §9 |


