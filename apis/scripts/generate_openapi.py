#!/usr/bin/env python3
"""
Generate OpenAPI JSON for each portal API and write to docs/openapi/.
Usage: python scripts/generate_openapi.py [output_dir]
Default output_dir: docs/openapi
"""
import json
import os
import subprocess
import sys
from pathlib import Path


def generate_openapi(module_name: str, app_attr: str, out_path: Path) -> None:
    mod = __import__(module_name, fromlist=[app_attr])
    app = getattr(mod, app_attr)
    schema = app.openapi()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(schema, f, indent=2)


def generate_openapi_in_subprocess(
    module_name: str, app_attr: str, out_path: Path, env: dict[str, str] | None = None
) -> None:
    result = subprocess.run(
        [
            sys.executable,
            __file__,
            "--generate-one",
            module_name,
            app_attr,
            str(out_path),
        ],
        capture_output=True,
        text=True,
        env={**os.environ, **(env or {})},
    )
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, file=sys.stdout, end="")
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
        raise RuntimeError(f"Failed to generate {out_path.name}")


def main() -> None:
    if len(sys.argv) == 5 and sys.argv[1] == "--generate-one":
        generate_openapi(sys.argv[2], sys.argv[3], Path(sys.argv[4]))
        return

    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/openapi")
    apis = [
        ("openg2p_registry_bene_api.main", "app", "openapi-bene-portal.json"),
        ("openg2p_registry_staff_api.main", "app", "openapi-staff-portal.json"),
        ("openg2p_registry_partner_api.main", "app", "openapi-partner.json"),
        # The agent portal mounts its optional routes only when they are switched
        # on, so a spec built with the defaults would silently leave out
        # /vc-issuance/create_wallet_offer and /vc-verification/verify_vc. The
        # reference documents every route, so switch everything on.
        (
            "openg2p_registry_agent_portal_api.main",
            "app",
            "openapi-agent-portal.json",
            {
                "REGISTRY_AGENT_PORTAL_API_VC_ISSUANCE_ENABLED": "true",
                "REGISTRY_AGENT_PORTAL_API_WALLET_ISSUANCE_ENABLED": "true",
                "REGISTRY_AGENT_PORTAL_API_VC_VERIFICATION_ENABLED": "true",
            },
        ),
    ]
    for module_name, app_attr, filename, *env in apis:
        out_path = out_dir / filename
        generate_openapi_in_subprocess(module_name, app_attr, out_path, *env)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
