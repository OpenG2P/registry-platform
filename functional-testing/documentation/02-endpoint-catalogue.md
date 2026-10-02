# Endpoint catalogue (functional)

Authoritative list of registry-platform HTTP actions under test for functional
correctness. Derived from live controllers in:

- `apis/openg2p-registry-staff-api/.../controllers/`
- `apis/openg2p-registry-partner-api/.../`

Paths are relative to each service root. All listed routes are **POST** unless
noted. Counts: **Staff ~203**, **Partner 2**. Agent: N/A.

**Class** legend: `read` · `write` · `search` · `metadata` · `async` · `admin`

**Tier** legend: `0` workflow-incidental · `1` staff core · `2` staff secondary · `3` partner

---

## Staff portal API

### `/register-data` — register reads / export / scores

| Full path | Class | Tier |
|---|---|---|
| `/register-data/search_in_a_register` | search | 1 |
| `/register-data/get_subject_record` | read | 1 |
| `/register-data/get_section_records` | read | 1 |
| `/register-data/get_tab_records` | read | 1 |
| `/register-data/get_register_summary_data` | read | 1 |
| `/register-data/get_number_of_versions` | read | 1 |
| `/register-data/get_record_history` | read | 1 |
| `/register-data/get_version_dates` | read | 1 |
| `/register-data/get_versions_for_a_date` | read | 1 |
| `/register-data/get_deduplication_register_results` | search | 1 |
| `/register-data/get_deduplication_change_request_results` | search | 1 |
| `/register-data/get_schema_definition_for_register_section` | metadata | 1 |
| `/register-data/get_allowed_parents_for_a_child_section` | read | 1 |
| `/register-data/export_register_records` | write | 2 |
| `/register-data/get_export_queue_records` | read | 2 |
| `/register-data/get_scores` | read | 2 |
| `/register-data/get_score_history` | read | 2 |
| `/register-data/get_available_authentication_providers` | read | 2 |
| `/register-data/authenticate_registrant` | write | 2 |
| `/register-data/get_registrant_authentication_status` | read | 2 |
| `/register-data/get_registrant_authentication_history` | read | 2 |

Also: `/registrant-auth/callback` (auth callback; Tier 2).

### `/intake-form-data`

| Full path | Class | Tier |
|---|---|---|
| `/intake-form-data/save_intake_form_submission` | write | 1 |
| `/intake-form-data/finalize_intake_form_submission` | write | 1 |
| `/intake-form-data/get_intake_form_submission` | read | 1 |
| `/intake-form-data/search_in_intake_form_submissions` | search | 1 |
| `/intake-form-data/approve_intake_form_submission` | write | 1 |
| `/intake-form-data/reject_intake_form_submission` | write | 1 |
| `/intake-form-data/delete_intake_form_submission` | write | 1 |
| `/intake-form-data/get_tab_records` | read | 1 |
| `/intake-form-data/get_intake_form_submissions_summary` | read | 1 |
| `/intake-form-data/get_intake_allowed_parents` | read | 1 |
| `/intake-form-data/get_deduplication_intake_form_register_results` | search | 1 |
| `/intake-form-data/get_deduplication_intake_form_intake_form_results` | search | 1 |

### `/intake-form-metadata`

| Full path | Class | Tier |
|---|---|---|
| `/intake-form-metadata/render_intake_form` | metadata | 1 |
| `/intake-form-metadata/get_intake_form` | metadata | 1 |
| `/intake-form-metadata/get_all_intake_forms` | metadata | 1 |
| `/intake-form-metadata/get_tab` / `get_all_tabs` | metadata | 1 |
| `/intake-form-metadata/get_all_sections` | metadata | 1 |
| `/intake-form-metadata/create_*` / `update_*` / `delete_*` / `add_section` / `remove_section` | admin | 2 |

### `/change-requests`

| Full path | Class | Tier |
|---|---|---|
| `/change-requests/create_change_request` | write | 1 |
| `/change-requests/approve_change_request` | write | 1 |
| `/change-requests/reject_change_request` | write | 1 |
| `/change-requests/get_change_request` | read | 1 |
| `/change-requests/get_change_requests` | search | 1 |
| `/change-requests/search_in_change_request` | search | 1 |
| `/change-requests/add_verification_for_change_request` | write | 1 |
| `/change-requests/get_verifications_for_change_request` | read | 1 |
| `/change-requests/get_number_of_pending_change_requests` | read | 1 |
| `/change-requests/get_register_change_request_summary_data` | read | 1 |
| `/change-requests/check_change_request_sequence` | read | 1 |
| `/change-requests/get_number_of_cross_register_changes` | read | 2 |
| `/change-requests/get_cross_register_changes` | read | 2 |

### `/change-requests-core-data`

| Full path | Class | Tier |
|---|---|---|
| `/change-requests-core-data/create_change_request_for_core_data` | write | 1 |
| `/change-requests-core-data/approve_change_request_for_core_data` | write | 1 |
| `/change-requests-core-data/reject_change_request_for_core_data` | write | 1 |

### `/verifications`

| Full path | Class | Tier |
|---|---|---|
| `/verifications/add_verification` | write | 1 |
| `/verifications/get_verifications` | read | 1 |

### `/documents`

| Full path | Class | Tier |
|---|---|---|
| `/documents/upload_documents` | write | 1 |
| `/documents/get_documents` | read | 1 |
| `/documents/delete_documents` | write | 1 |
| `/documents/get_change_request_documents` | read | 1 |
| `/documents/get_intake_form_documents` | read | 1 |
| `/documents/get_section_documents` | read | 1 |

### Register / tab / section metadata

| Prefix | Paths (summary) | Class | Tier |
|---|---|---|---|
| `/register-metadata` | get_all / dashboard / child / master / fields / schema; updates; create/edit/delete | metadata / admin | reads **1**, writes **2** |
| `/register-tab-metadata` | get_all_tabs, get_tab, get_sections; create/update/delete/add/remove | metadata / admin | reads **1**, writes **2** |
| `/register-section-metadata` | get_all_sections, get_section, ui_schema; create/update/delete | metadata / admin | reads **1**, writes **2** |

### `/registry-config` · `/registry-language` · `/registry-theme`

Admin / shell config — **Tier 2** (get_* first, then mutations).

### `/completion-score` · `/computation-score`

Score definitions, contributing attributes, computed/ideal scores — **Tier 2**.

### `/ingestion-config` · `/ingestion-data` · `/outgestion-config` · `/outgestion-data`

Partner-pipeline admin + staff browse of ingest/outgest jobs — **Tier 2**.

### `/input-mechanism-metadata` · `/input-mechanism-data`

VC / import-file config + enqueue / ingest — **Tier 2**.

### `/data-model`

CRUD data models — **Tier 2**.

### `/awe` · `/awe-policy-config`

AWE task proxy, webhook decision, policy CRUD — **Tier 2**.

---

## Partner API

| Full path | Class | Tier |
|---|---|---|
| `/partner/ingest_data` | async | 3 |
| `/dci/registry/sync/search` | search | 3 |

UNDP / G2P Connect search packages are stubs — not catalogued until implemented.

---

## Agent API

Not implemented — ignore.

---

## Reference extension domain notes

Functional scenarios parametrize **Individual** and **Household** subject
registers. Supporting TABLE registers exercised in Tier-0 today:

- Individual: `g2p_register_individual_land` (intake section present)
- Household: `g2p_register_household_assets` (intake section present)

Other supporting tables (livelihood TABLE, housing TABLE, livestock, …) need
intake/register meta wiring before Tier-1 supporting coverage expands.
