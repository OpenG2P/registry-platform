"""Thin façade for UI scripts and scenarios — re-exports flows + models + util.

Prefer importing from ``helpers.flows.*`` in new code; this module preserves
stable import paths used by Playwright fixture scripts.
"""

from __future__ import annotations

from helpers.flows import (
    approve_artifact_stage,
    approve_two_stage_awe,
    create_and_finalize_intake,
    create_draft_intake,
    create_field_cr,
    create_middle_name_cr,
    create_supporting_update_cr,
    get_subject_record,
    provision_household,
    provision_individual,
    provision_record,
    search_register_by_text,
    stage1_user,
    stage2_user,
    verify_and_approve_cr,
    verify_and_approve_intake,
    wait_for_register_record,
)
from helpers.models import ChangeRequestResult, IntakeResult, ProvisionedRecord
from helpers.util import assert_ok, response_payload, unique_cr_value

__all__ = [
    "ChangeRequestResult",
    "IntakeResult",
    "ProvisionedRecord",
    "approve_artifact_stage",
    "approve_two_stage_awe",
    "assert_ok",
    "create_and_finalize_intake",
    "create_draft_intake",
    "create_field_cr",
    "create_middle_name_cr",
    "create_supporting_update_cr",
    "get_subject_record",
    "provision_household",
    "provision_individual",
    "provision_record",
    "response_payload",
    "search_register_by_text",
    "stage1_user",
    "stage2_user",
    "unique_cr_value",
    "verify_and_approve_cr",
    "verify_and_approve_intake",
    "wait_for_register_record",
]
