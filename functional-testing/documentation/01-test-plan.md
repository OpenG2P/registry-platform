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


| App                  | Status                              |
| -------------------- | ----------------------------------- |
| **Staff portal API** | Primary — Tier-0 now; Tier-1/2 next |
| **Partner API**      | Tier-3 opt-in (`api/partner`)       |
| **Agent API**        | Deferred (not implemented)          |


Extension under test: `reference-extension` only (platform-owned gate).

## 4. Tiers


| Tier                         | Role                                                                                                                | When                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **0 — Workflow gate**        | Happy-path intake → register → CR (Individual + Household), API↔DB on critical fields                               | **PR compose gate today**        |
| **1 — Staff core endpoints** | Dedicated scenarios per core controller group (register-data, intake, CR, verifications, documents, metadata reads) | After Phase A docs; expand suite |
| **2 — Staff secondary**      | Scores, completion, ingestion/outgestion, AWE, themes/languages, config writes, input mechanisms                    | After Tier-1                     |
| **3 — Partner**              | `/partner/ingest_data`, `/dci/registry/sync/search` (+ DB / async settle)                                           | After Staff complete             |


PR gate stays **Tier-0 only** until we explicitly widen it.

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
    workflows/            # Tier-0 PR gate (parametrized Individual + Household)
    staff/                # Tier-1+ endpoint suites (next)
    partner/              # Tier-3 (after Staff)
    assertions/           # response / db / dual
  helpers/                # functional-owned clients, payloads, flows-as-fixtures
  docker/                 # compose gate
```

## 7. Pass / fail

- Tier-0: all parametrized workflow scenarios green on compose gate.
- Tier-1+: each catalogue row marked **covered** must have a scenario that
dual-asserts (or documents why API-only is sufficient).
- Coverage matrix (`03-coverage-matrix.md`) is the source of truth for status.

## 8. Phased delivery


| Phase | Deliverable                                     | Status          |
| ----- | ----------------------------------------------- | --------------- |
| **A** | Docs: plan + catalogue + coverage matrix        | Done            |
| **B** | Move Tier-0 under `api/workflows/`              | Done            |
| **C** | Functional seed/manifest (small, deterministic) | Done            |
| **D** | Staff Tier-1 endpoint suites                    | Done (core batch) |
| **E** | Staff Tier-2                                    | Done (E1–E6 implemented; opt-in) |
| **F** | Partner Tier-3                                  | Done (ingest + DCI search; opt-in) |
| **G** | Widen PR gate / farmer adoption                 | Later decision  |
| **U-A…** | Slim UI gate (browse/queue + U2 mutations); AWE approve/reject parked | See [`05-ui-test-plan.md`](05-ui-test-plan.md) §9 |


