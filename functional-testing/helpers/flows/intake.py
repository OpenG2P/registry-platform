"""Intake create / finalize / approve flows."""

from __future__ import annotations

import time
from typing import Any, Optional

from helpers.config import Config
from helpers.http import StaffApiError, StaffClient
from helpers.models import IntakeResult, ProvisionedRecord
from helpers.payloads import (
    build_household_section_payload,
    build_individual_section_payload,
    extract_tab_sections,
    merge_accumulated,
    section_defs_for,
)
from helpers.payloads.household import household_expected_main_fields, household_expected_supporting
from helpers.payloads.individual import (
    individual_expected_main_fields,
    individual_expected_supporting,
)
from helpers.profiles import HOUSEHOLD, INDIVIDUAL, RegisterProfile
from helpers.util import (
    assert_ok,
    extract_section_record_id,
    extract_section_record_ids,
    noop,
    unique_household_head_name,
    unique_individual_name,
    StepFn,
)

# Gate stacks occasionally return SYS-ERR-001 on first save under load; the
# same household intake path succeeds elsewhere in the suite when retried.
_SAVE_TRANSIENT_MARKERS = ("SYS-ERR-001", "UNEXPECTED_ERROR")
_SAVE_MAX_ATTEMPTS = 3
_SAVE_RETRY_SLEEP_S = 2.0


def save_intake_section(
    staff: StaffClient,
    *,
    submission_id: Optional[str],
    section_id: str,
    section_payload: list[dict],
    section_register_id: str,
    form_id: str,
    register_id: str,
    step: StepFn = noop,
) -> dict[str, Any]:
    """POST save_intake_form_submission with retries for transient SYS-ERR-001."""
    last_err: Optional[StaffApiError] = None
    for attempt in range(1, _SAVE_MAX_ATTEMPTS + 1):
        try:
            return staff.post_json(
                "/intake-form-data/save_intake_form_submission",
                {
                    "submission_id": submission_id,
                    "section_id": section_id,
                    "section_payload": section_payload,
                    "section_register_id": section_register_id,
                    "form_id": form_id,
                    "register_id": register_id,
                },
            )
        except StaffApiError as exc:
            last_err = exc
            msg = str(exc)
            transient = any(m in msg for m in _SAVE_TRANSIENT_MARKERS)
            if not transient or attempt >= _SAVE_MAX_ATTEMPTS:
                raise
            step(
                f"transient save error on {section_id} "
                f"(attempt {attempt}/{_SAVE_MAX_ATTEMPTS}): {exc}; retrying"
            )
            time.sleep(_SAVE_RETRY_SLEEP_S * attempt)
    assert last_err is not None
    raise last_err


def _section_payload_rows(
    defn: dict[str, Any],
    own: dict | list,
    accumulated: dict,
) -> list[dict]:
    """Build save_intake_form_submission.section_payload list for one section.

    Reuses ``internal_record_id`` from prior saves for the same
    ``section_register_id`` so upsert updates the same intake row (UI contract).
    Without this, each section save creates a new subject row and nulls child links.
    """
    section_register_id = defn["section_register_id"]
    is_list = bool(defn.get("is_list"))
    prior = accumulated.get(section_register_id) or {}

    if is_list:
        rows = own if isinstance(own, list) else ([own] if isinstance(own, dict) and own else [])
        rows = [dict(r) for r in rows if isinstance(r, dict)]
        prior_ids = prior.get("_row_ids") or []
        if isinstance(prior_ids, list):
            for idx, row in enumerate(rows):
                if idx < len(prior_ids) and prior_ids[idx] and "internal_record_id" not in row:
                    row["internal_record_id"] = prior_ids[idx]
        return rows

    own_dict = own if isinstance(own, dict) else {}
    merged = merge_accumulated(section_register_id, own_dict, accumulated)
    # merge_accumulated may have stored domain fields; ensure stable id
    if prior.get("internal_record_id") and "internal_record_id" not in merged:
        merged["internal_record_id"] = prior["internal_record_id"]
    # keep id on accumulated for next merge
    if merged.get("internal_record_id"):
        accumulated.setdefault(section_register_id, {})["internal_record_id"] = merged[
            "internal_record_id"
        ]
    return [merged]


def _capture_record_ids(
    save_payload: dict,
    section_register_id: str,
    accumulated: dict,
    *,
    is_list: bool,
    step: StepFn,
) -> None:
    if is_list:
        ids = extract_section_record_ids(save_payload, section_register_id)
        if ids:
            accumulated.setdefault(section_register_id, {})["_row_ids"] = ids
            step(f"captured {len(ids)} row id(s) for {section_register_id}")
        return
    rid = extract_section_record_id(save_payload, section_register_id)
    if rid:
        accumulated.setdefault(section_register_id, {})["internal_record_id"] = rid
        step(f"captured internal_record_id={rid} for {section_register_id}")


def create_draft_intake(
    staff: StaffClient,
    cfg: Config,
    profile: RegisterProfile = INDIVIDUAL,
    *,
    household_id: Optional[str] = None,
    step: StepFn = noop,
) -> IntakeResult:
    """Save all known intake sections as DRAFT (no finalize). Used by UI finalize specs."""
    section_defs = section_defs_for(profile)

    if profile.key == "individual":
        link_hh = household_id or cfg.household_id
        if not link_hh:
            cfg.require_household()
            link_hh = cfg.household_id
        name = unique_individual_name(profile.search_marker)
        identity = name[0]
        fields = individual_expected_main_fields(name)
        supporting = individual_expected_supporting()
    else:
        link_hh = None
        name = None
        head = unique_household_head_name(profile.search_marker)
        identity = head
        fields = household_expected_main_fields(head)
        supporting = household_expected_supporting()

    step(f"render intake form {profile.intake_form_id} ({profile.key})")
    render = staff.post_json(
        "/intake-form-metadata/render_intake_form",
        {"form_id": profile.intake_form_id},
    )
    assert_ok(render, "render_intake_form")
    tab_sections = extract_tab_sections(render, profile.intake_tab_id)
    assert tab_sections, f"no sections for tab {profile.intake_tab_id}"

    section_ids = [s["section_id"] for s in tab_sections]
    step(f"sections ({len(section_ids)}): {section_ids}")

    submission_id: Optional[str] = None
    accumulated: dict = {}

    for section_id in section_ids:
        defn = section_defs.get(section_id)
        if not defn:
            step(f"skip unknown section {section_id}")
            continue

        if profile.key == "individual":
            own = build_individual_section_payload(section_id, link_hh, name)  # type: ignore[arg-type]
        else:
            own = build_household_section_payload(section_id, identity)

        rows = _section_payload_rows(defn, own, accumulated)
        if not rows:
            step(f"skip empty payload for section {section_id}")
            continue

        step(
            f"save section {section_id} (rows={len(rows)}, "
            f"register={defn['section_register_id']})"
        )
        save_body = save_intake_section(
            staff,
            submission_id=submission_id,
            section_id=section_id,
            section_payload=rows,
            section_register_id=defn["section_register_id"],
            form_id=profile.intake_form_id,
            register_id=profile.register_id,
            step=step,
        )

        save_payload = assert_ok(save_body, f"save:{section_id}")
        if not isinstance(save_payload, dict):
            save_payload = {}
        if submission_id is None:
            submission_id = save_payload.get("submission_id")
            assert submission_id, "first save must return submission_id"
            step(f"submission_id={submission_id}")

        _capture_record_ids(
            save_payload,
            defn["section_register_id"],
            accumulated,
            is_list=bool(defn.get("is_list")),
            step=step,
        )

    assert submission_id
    return IntakeResult(
        submission_id=submission_id,
        identity_value=identity,
        fields=fields,
        supporting=supporting,
    )


def create_and_finalize_intake(
    staff: StaffClient,
    cfg: Config,
    profile: RegisterProfile = INDIVIDUAL,
    *,
    household_id: Optional[str] = None,
    step: StepFn = noop,
) -> IntakeResult:
    created = create_draft_intake(
        staff, cfg, profile, household_id=household_id, step=step
    )
    step("finalize")
    assert_ok(
        staff.post_json(
            "/intake-form-data/finalize_intake_form_submission",
            {"submission_id": created.submission_id},
        ),
        "finalize",
    )
    return created


def verify_and_approve_intake(
    staff: StaffClient, submission_id: str, step: StepFn = noop
) -> None:
    step(f"get submission {submission_id}")
    assert_ok(
        staff.post_json(
            "/intake-form-data/get_intake_form_submission",
            {"submission_id": submission_id},
        ),
        "get submission",
    )
    step("add_verification")
    assert_ok(
        staff.post_json(
            "/verifications/add_verification",
            {"submission_id": submission_id, "is_approved": True},
        ),
        "add_verification",
    )
    step("approve")
    assert_ok(
        staff.post_json(
            "/intake-form-data/approve_intake_form_submission",
            {"submission_id": submission_id},
        ),
        "approve",
    )


def provision_record(
    staff: StaffClient,
    cfg: Config,
    profile: RegisterProfile = INDIVIDUAL,
    *,
    household_id: Optional[str] = None,
    step: StepFn = noop,
) -> ProvisionedRecord:
    from helpers.flows.register import wait_for_register_record

    created = create_and_finalize_intake(
        staff, cfg, profile, household_id=household_id, step=step
    )
    verify_and_approve_intake(staff, created.submission_id, step=step)
    hit = wait_for_register_record(staff, profile, created.identity_value)
    return ProvisionedRecord(
        internal_record_id=hit["internal_record_id"],
        identity_value=created.identity_value,
        fields=created.fields,
        submission_id=created.submission_id,
        supporting=created.supporting,
    )


def provision_individual(
    staff: StaffClient, cfg: Config, step: StepFn = noop
) -> ProvisionedRecord:
    """Provision an approved Individual (UI fixtures + API scenarios)."""
    return provision_record(staff, cfg, INDIVIDUAL, step=step)


def provision_household(
    staff: StaffClient, cfg: Config, step: StepFn = noop
) -> ProvisionedRecord:
    return provision_record(staff, cfg, HOUSEHOLD, step=step)
