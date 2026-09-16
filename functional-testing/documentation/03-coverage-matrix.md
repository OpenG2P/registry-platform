# Coverage matrix (functional API)

Status of each catalogue endpoint vs the current suite.

| Status | Meaning |
|---|---|
| **covered** | Dedicated or workflow assert with meaningful API (+ DB where applicable) |
| **incidental** | Called as fixture plumbing; no dedicated correctness scenario |
| **missing** | Not exercised |
| **deferred** | Explicitly later (Partner / Agent / Tier-2) |

Update this file when adding scenarios. Source catalogue: [`02-endpoint-catalogue.md`](02-endpoint-catalogue.md).

Profiles: **I** = Individual, **H** = Household. Tier-0 workflows run both unless noted.

---

## Tier-0 workflow map (PR gate today)

| Scenario (`api/workflows/`) | Profiles | Proves |
|---|---|---|
| `test_intake_create` | I+H | finalize → FINAL / PENDING (API+DB) |
| `test_intake_approve` | I+H | approve → register; subject + supporting dual-assert |
| `test_register_read` | I+H | summary, subject, tabs/records, pending CR list |
| `test_cr_create` | I+H | CR PENDING; subject field unchanged |
| `test_cr_approve` | I+H | CR APPROVED; field applied; history linkage |
| `test_cr_supporting_history` | I+H | supporting TABLE CR applied; child history linkage |

---

## Tier-1 Staff endpoint suites (`api/staff/`, opt-in)

| Module | Profiles | Endpoints exercised |
|---|---|---|
| `register_data/test_seeded_reads.py` | I+H | search, get_subject, summary, get_section_records, supporting tabs, schema, versions/history |
| `intake_form_data/test_reject_delete.py` | I+H | reject finalized; delete draft (+ DB) |
| `change_requests/test_reject_and_reads.py` | I+H | reject CR; pending count; summary; verifications; search |
| `metadata/test_reads.py` | I+H | get_all_registers/sections/tabs; get_section/tab; intake form get/render |

Run: `pytest -c api/pytest.ini api/staff -m tier1` or `FUNC_RUN_STAFF_TIER1=1` on the compose gate.

---

## Tier-2 Staff endpoint suites (`api/staff/`, opt-in)

| Batch | Modules | Focus |
|---|---|---|
| E1 | `shell/test_reads`, `scores/*_reads`, `export/test_queue_reads`, `ingestion/*_reads`, `outgestion/*_reads`, `input_mechanism/test_metadata_reads`, `data_model/test_reads`, `change_requests/test_cross_register_reads`, `awe/test_policy_reads`, `registrant_auth/test_reads` | Safe reads |
| E2 | `shell/test_crud` | Language/theme CRUD + reversible config update |
| E3 | `scores/test_definition_crud` | Computation-score CRUD, export enqueue, CR sequence |
| E4 | `data_model/test_crud` | Data-model + ingestion/outgestion/input-mechanism config CRUD |
| E5 | `metadata_writes/test_disposable_register` | Disposable register/tab/section/intake-form lifecycle |
| E6 | `awe/test_policy_crud_and_proxy`, `input_mechanism/test_enqueue_and_ingest` | AWE policy CRUD; env-gated proxy/webhook/auth/ingest; enqueue |

Run: `pytest -c api/pytest.ini api/staff -m tier2` or `FUNC_RUN_STAFF_TIER2=1` on the compose gate.

---

## Staff — core (Tier 1 focus)

### `/register-data`

| Endpoint | Status | Notes |
|---|---|---|
| `search_in_a_register` | covered | Tier-0 + Tier-1 seeded |
| `get_subject_record` | covered | dual-assert `match_fields` |
| `get_tab_records` | covered | register browse + supporting dual-assert |
| `get_register_summary_data` | covered | Tier-0 + Tier-1 |
| `get_section_records` | covered | Tier-1 seeded (subject + child) |
| `get_number_of_versions` | covered | Tier-1 (may be 0 for seed) |
| `get_record_history` | covered | Tier-1 API smoke |
| `get_version_dates` | covered | Tier-1 |
| `get_versions_for_a_date` | missing | needs a dated history row |
| `get_deduplication_register_results` | missing | |
| `get_deduplication_change_request_results` | missing | |
| `get_schema_definition_for_register_section` | covered | Tier-1 |
| `get_allowed_parents_for_a_child_section` | missing | |
| `export_register_records` | covered | Tier-2 E3 |
| `get_export_queue_records` | covered | Tier-2 E1/E3 |
| `get_scores` / `get_score_history` | covered | Tier-2 E1 |
| registrant-auth routes | covered | Tier-2 E1 reads; `authenticate_registrant` env-gated E6 |

### `/intake-form-data`

| Endpoint | Status | Notes |
|---|---|---|
| `save_intake_form_submission` | covered | Tier-0 create (ID reuse) |
| `finalize_intake_form_submission` | covered | |
| `get_intake_form_submission` | covered | create + approve + reject paths |
| `search_in_intake_form_submissions` | covered | `test_intake_approve` |
| `approve_intake_form_submission` | covered | + DB submission / register |
| `add_verification` (via `/verifications`) | covered | |
| `reject_intake_form_submission` | covered | Tier-1 + DB |
| `delete_intake_form_submission` | covered | Tier-1 draft delete + DB |
| `get_tab_records` (intake) | missing | |
| `get_intake_form_submissions_summary` | missing | |
| `get_intake_allowed_parents` | missing | |
| intake dedup endpoints | missing | |

### `/intake-form-metadata`

| Endpoint | Status | Notes |
|---|---|---|
| `render_intake_form` | covered | Tier-0 incidental + Tier-1 dedicated |
| `get_intake_form` / `get_all_intake_forms` | covered | Tier-1 |
| other get_* tabs/sections | missing | partial via register-tab APIs |
| create/update/delete | deferred | Tier 2 admin |

### `/change-requests`

| Endpoint | Status | Notes |
|---|---|---|
| `create_change_request` | covered | subject + supporting |
| `approve_change_request` | covered | |
| `add_verification_for_change_request` | covered | |
| `get_change_request` | covered | |
| `get_change_requests` | covered | pending list in register_read |
| `reject_change_request` | covered | Tier-1 + subject unchanged |
| `search_in_change_request` | covered | Tier-1 |
| `get_verifications_for_change_request` | covered | Tier-1 |
| `get_number_of_pending_change_requests` | covered | Tier-1 |
| `get_register_change_request_summary_data` | covered | Tier-1 |
| `check_change_request_sequence` | covered | Tier-2 E3 |
| cross-register endpoints | covered | Tier-2 E1 |

### `/change-requests-core-data`

| Endpoint | Status | Notes |
|---|---|---|
| `create_change_request_for_core_data` | incidental | used when section `is_core_section` |
| approve/reject core | missing | |

### `/verifications`

| Endpoint | Status | Notes |
|---|---|---|
| `add_verification` | covered | intake approve |
| `get_verifications` | missing | |

### `/documents`

| Endpoint | Status | Notes |
|---|---|---|
| all | missing | |

### Metadata reads (register / tab / section)

| Endpoint | Status | Notes |
|---|---|---|
| `/register-metadata/get_all_registers` | covered | Tier-1 |
| `/register-section-metadata/get_all_sections` | covered | Tier-1 (was incidental) |
| `/register-section-metadata/get_section` | covered | Tier-1 |
| `/register-tab-metadata/get_all_tabs` | covered | |
| `/register-tab-metadata/get_tab` | covered | Tier-1 |
| `/register-tab-metadata/get_sections` | incidental | CR plumbing |
| metadata writes | covered | Tier-2 E5 disposable register only |

---

## Staff — secondary (Tier 2)

| Prefix / area | Status | Notes |
|---|---|---|
| `/registry-config` reads + reversible update | covered | E1 + E2 |
| `/registry-language` CRUD | covered | E1 reads + E2 CRUD |
| `/registry-theme` CRUD | covered | E1 reads + E2 CRUD |
| `/completion-score` | covered | E1 |
| `/computation-score` | covered | E1 reads + E3 CRUD |
| `/ingestion-config` / `/ingestion-data` | covered | E1 reads + E4 CRUD |
| `/outgestion-config` / `/outgestion-data` | covered | E1 reads + E4 topic CRUD (`re_register_topic` deferred) |
| `/input-mechanism-metadata` | covered | E1 + E4 |
| `/input-mechanism-data` enqueue | covered | E6 |
| `/input-mechanism-data` ingest-data | covered | E6 env-gated probe |
| `/data-model` | covered | E1 + E4 |
| `/awe-policy-config` | covered | E1 + E6 |
| `/awe` proxy / webhook | covered | E6 env-gated |
| `/register-data` export + scores | covered | E1 + E3 |

---

## Partner (Tier 3) — opt-in (`api/partner/`, `-m tier3`)

| Endpoint | Status | Notes |
|---|---|---|
| `/partner/ingest_data` | covered | Accept + correlation_id; ensures DCI key path; staff search/summary |
| `/dci/registry/sync/search` | covered | Individual expression search vs functional seed (`FUNCSEEDInd001`) |

Run: `pytest -c api/pytest.ini api/partner -m tier3` or `FUNC_RUN_PARTNER_TIER3=1` on the compose gate (`FUNC_PARTNER_API_BASE=http://127.0.0.1:18083`).

---

## Agent

Not applicable.

---

## Summary (approx.)

| Bucket | Covered / incidental | Missing / deferred |
|---|---:|---:|
| Staff Tier-1 core (high-value) | ~40 | ~20 |
| Staff Tier-2 | ~most secondary controllers (E1–E6) | `re_register_topic`; full OAuth callback; live ingest body |
| Partner | 2 | 0 (Household DCI template not seeded) |

PR gate remains **Tier-0 workflows** only. Opt-in: `FUNC_RUN_STAFF_TIER1=1` / `FUNC_RUN_STAFF_TIER2=1` / `FUNC_RUN_PARTNER_TIER3=1`.
