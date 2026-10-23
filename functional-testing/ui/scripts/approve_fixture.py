#!/usr/bin/env python3
"""Approve or reject a pending intake / CR by id (Playwright hybrid UI specs).

Usage:
  python scripts/approve_fixture.py intake <submission_id>
  python scripts/approve_fixture.py cr <change_request_id> [section_id]
  python scripts/approve_fixture.py reject-intake <submission_id>
  python scripts/approve_fixture.py reject-cr <change_request_id>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HELPERS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HELPERS_ROOT))

from helpers.config import Config  # noqa: E402
from helpers.http import StaffClient  # noqa: E402
from helpers.provision import verify_and_approve_cr, verify_and_approve_intake  # noqa: E402
from helpers.util import assert_ok  # noqa: E402


def _reject_intake(staff: StaffClient, submission_id: str) -> None:
    print("reject_intake_form_submission", file=sys.stderr)
    assert_ok(
        staff.post_json(
            "/intake-form-data/reject_intake_form_submission",
            {"submission_id": submission_id},
        ),
        "reject_intake",
    )


def _reject_cr(staff: StaffClient, change_request_id: str) -> None:
    print("reject_change_request", file=sys.stderr)
    assert_ok(
        staff.post_json(
            "/change-requests/reject_change_request",
            {
                "change_request_id": change_request_id,
                "rejection_reason": "func-ui-reject",
            },
        ),
        "reject_cr",
    )


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    kind, entity_id = argv[1], argv[2]

    cfg = Config.from_env()
    cfg.require_api()
    with StaffClient.login(cfg) as staff:
        if kind == "intake":
            verify_and_approve_intake(staff, entity_id, step=lambda m: print(m, file=sys.stderr))
        elif kind == "cr":
            verify_and_approve_cr(staff, entity_id, step=lambda m: print(m, file=sys.stderr))
        elif kind == "reject-intake":
            _reject_intake(staff, entity_id)
        elif kind == "reject-cr":
            _reject_cr(staff, entity_id)
        else:
            print(f"unknown kind {kind!r}", file=sys.stderr)
            return 2

    print(json.dumps({"ok": True, "kind": kind, "id": entity_id}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
