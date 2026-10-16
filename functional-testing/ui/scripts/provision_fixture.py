#!/usr/bin/env python3
"""Provision fixtures for the slim staff-UI Playwright gate.

Core journeys:
  - approved Individual + Household (register browse)
  - pending intake (I+H) for queue search
  - pending CR (I+H) for queue + subject CR tab
  - clean create_ui subjects (I+H) for Edit Details → create CR
  - dedicated awe_approve pending intake + CR (I+H) for Tasks → Approve

Finalize-draft specs create their own draft via apiCreateDraftIntake at runtime.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HELPERS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HELPERS_ROOT))

from helpers.config import Config  # noqa: E402
from helpers.http import StaffClient  # noqa: E402
from helpers.profiles import HOUSEHOLD  # noqa: E402
from helpers.provision import (  # noqa: E402
    create_and_finalize_intake,
    create_field_cr,
    create_middle_name_cr,
    provision_household,
    provision_individual,
)

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "provisioned.json"


def _log(msg: str) -> None:
    print(msg, file=sys.stderr)


def main() -> int:
    cfg = Config.from_env()
    cfg.require_api()
    cfg.require_household()

    with StaffClient.login(cfg) as staff:
        _log("-> provision approved individual for register browse")
        ind = provision_individual(staff, cfg, step=lambda m: _log(f"  {m}"))

        _log("-> provision finalized (pending) intake for intake queue (individual)")
        pending_intake = create_and_finalize_intake(
            staff, cfg, step=lambda m: _log(f"  {m}")
        )

        _log("-> provision pending change request (individual)")
        cr = create_middle_name_cr(
            staff,
            cfg,
            subject_internal_record_id=ind.internal_record_id,
            first_name=ind.first_name,
            step=lambda m: _log(f"  {m}"),
        )

        _log("-> provision dedicated individual for create-UI CR (no pending CR)")
        ind_create_ui = provision_individual(staff, cfg, step=lambda m: _log(f"  {m}"))

        _log("-> provision dedicated individual + pending for AWE Tasks approve")
        ind_awe = provision_individual(staff, cfg, step=lambda m: _log(f"  {m}"))
        awe_pending_intake = create_and_finalize_intake(
            staff, cfg, step=lambda m: _log(f"  {m}")
        )
        awe_pending_cr = create_middle_name_cr(
            staff,
            cfg,
            subject_internal_record_id=ind_awe.internal_record_id,
            first_name=ind_awe.first_name,
            step=lambda m: _log(f"  {m}"),
        )

        _log("-> provision approved household for register browse")
        hh = provision_household(staff, cfg, step=lambda m: _log(f"  {m}"))

        _log("-> provision finalized (pending) intake for intake queue (household)")
        hh_pending_intake = create_and_finalize_intake(
            staff, cfg, HOUSEHOLD, step=lambda m: _log(f"  {m}")
        )

        _log("-> provision pending change request (household)")
        hh_cr = create_field_cr(
            staff,
            cfg,
            HOUSEHOLD,
            subject_internal_record_id=hh.internal_record_id,
            identity_value=hh.identity_value,
            step=lambda m: _log(f"  {m}"),
        )

        _log("-> provision dedicated household for create-UI CR (no pending CR)")
        hh_create_ui = provision_household(staff, cfg, step=lambda m: _log(f"  {m}"))

        _log("-> provision dedicated household + pending for AWE Tasks approve")
        hh_awe = provision_household(staff, cfg, step=lambda m: _log(f"  {m}"))
        hh_awe_pending_intake = create_and_finalize_intake(
            staff, cfg, HOUSEHOLD, step=lambda m: _log(f"  {m}")
        )
        hh_awe_pending_cr = create_field_cr(
            staff,
            cfg,
            HOUSEHOLD,
            subject_internal_record_id=hh_awe.internal_record_id,
            identity_value=hh_awe.identity_value,
            step=lambda m: _log(f"  {m}"),
        )

    fixture = {
        "locale": "en",
        "register_mnemonic": "Individual",
        "individual": {
            "internal_record_id": ind.internal_record_id,
            "first_name": ind.first_name,
            "middle_name": ind.middle_name,
            "last_name": ind.last_name,
            "submission_id": ind.submission_id,
        },
        "pending_intake": {
            "submission_id": pending_intake.submission_id,
            "first_name": pending_intake.first_name,
            "middle_name": pending_intake.middle_name,
            "last_name": pending_intake.last_name,
        },
        "pending_cr": {
            "change_request_id": cr.change_request_id,
            "first_name": cr.first_name,
            "new_middle_name": cr.new_value,
            "section_id": cr.section_id,
        },
        "household": {
            "register_mnemonic": "Household",
            "subject": {
                "internal_record_id": hh.internal_record_id,
                "search_text": hh.identity_value,
                "submission_id": hh.submission_id,
            },
            "pending_intake": {
                "submission_id": hh_pending_intake.submission_id,
                "search_text": hh_pending_intake.identity_value,
            },
            "pending_cr": {
                "change_request_id": hh_cr.change_request_id,
                "search_text": hh_cr.identity_value,
                "new_value": hh_cr.new_value,
                "section_id": hh_cr.section_id,
            },
        },
        "create_ui": {
            "individual": {
                "internal_record_id": ind_create_ui.internal_record_id,
                "first_name": ind_create_ui.first_name,
                "middle_name": ind_create_ui.middle_name,
                "last_name": ind_create_ui.last_name,
                "submission_id": ind_create_ui.submission_id,
            },
            "household": {
                "register_mnemonic": "Household",
                "internal_record_id": hh_create_ui.internal_record_id,
                "search_text": hh_create_ui.identity_value,
                "submission_id": hh_create_ui.submission_id,
            },
        },
        "awe_approve": {
            "individual": {
                "subject": {
                    "internal_record_id": ind_awe.internal_record_id,
                    "first_name": ind_awe.first_name,
                    "middle_name": ind_awe.middle_name,
                    "last_name": ind_awe.last_name,
                    "submission_id": ind_awe.submission_id,
                },
                "pending_intake": {
                    "submission_id": awe_pending_intake.submission_id,
                    "first_name": awe_pending_intake.first_name,
                    "middle_name": awe_pending_intake.middle_name,
                    "last_name": awe_pending_intake.last_name,
                },
                "pending_cr": {
                    "change_request_id": awe_pending_cr.change_request_id,
                    "first_name": awe_pending_cr.first_name,
                    "new_middle_name": awe_pending_cr.new_value,
                    "section_id": awe_pending_cr.section_id,
                },
            },
            "household": {
                "register_mnemonic": "Household",
                "subject": {
                    "internal_record_id": hh_awe.internal_record_id,
                    "search_text": hh_awe.identity_value,
                    "submission_id": hh_awe.submission_id,
                },
                "pending_intake": {
                    "submission_id": hh_awe_pending_intake.submission_id,
                    "search_text": hh_awe_pending_intake.identity_value,
                },
                "pending_cr": {
                    "change_request_id": hh_awe_pending_cr.change_request_id,
                    "search_text": hh_awe_pending_cr.identity_value,
                    "new_value": hh_awe_pending_cr.new_value,
                    "section_id": hh_awe_pending_cr.section_id,
                },
            },
        },
    }
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(fixture, indent=2) + "\n"
    FIXTURE_PATH.write_text(payload, encoding="utf-8")
    print(payload, end="")
    _log(f"-> wrote {FIXTURE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
