#!/usr/bin/env python3
"""Create a DRAFT intake (all sections saved, not finalized) for UI finalize specs.

Usage:
  python scripts/create_draft_intake.py [individual|household]

Prints JSON to stdout: submission_id, search_text / names, register_mnemonic.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HELPERS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HELPERS_ROOT))

from helpers.config import Config  # noqa: E402
from helpers.http import StaffClient  # noqa: E402
from helpers.profiles import HOUSEHOLD, INDIVIDUAL  # noqa: E402
from helpers.provision import create_draft_intake  # noqa: E402


def main(argv: list[str]) -> int:
    profile_key = (argv[1] if len(argv) > 1 else "individual").lower()
    profile = HOUSEHOLD if profile_key == "household" else INDIVIDUAL

    cfg = Config.from_env()
    cfg.require_api()
    if profile.key == "individual":
        cfg.require_household()

    with StaffClient.login(cfg) as staff:
        draft = create_draft_intake(
            staff, cfg, profile, step=lambda m: print(f"  {m}", file=sys.stderr)
        )

    payload = {
        "register_mnemonic": "Household" if profile.key == "household" else "Individual",
        "form_id": profile.intake_form_id,
        "submission_id": draft.submission_id,
        "search_text": draft.identity_value,
        "first_name": draft.first_name,
        "middle_name": draft.middle_name,
        "last_name": draft.last_name,
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
