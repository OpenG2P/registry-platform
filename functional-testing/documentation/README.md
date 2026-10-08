# Functional testing documentation

| Doc | Purpose |
|---|---|
| [`01-test-plan.md`](01-test-plan.md) | API objectives, tiers, assert contract, phased delivery |
| [`02-endpoint-catalogue.md`](02-endpoint-catalogue.md) | Staff + Partner endpoint inventory |
| [`03-coverage-matrix.md`](03-coverage-matrix.md) | Per-endpoint API coverage status |
| [`04-seeding.md`](04-seeding.md) | Deterministic functional seed + manifest |
| [`05-ui-test-plan.md`](05-ui-test-plan.md) | UI objectives, tiers (U0–U3), assert contract |
| [`06-ui-journey-catalogue.md`](06-ui-journey-catalogue.md) | Staff UI journey inventory |
| [`07-ui-coverage-matrix.md`](07-ui-coverage-matrix.md) | Per-journey UI coverage status |

Suite layout: Tier-0 lives in `api/workflows/`; Staff Tier-1/2 in `api/staff/`
(`-m tier1` / `-m tier2`); Partner in `api/partner/`. UI E2E in `ui/` (U0 on
compose gate). Performance testing is **out of scope** and must not share code
with this tree.

Runbooks: [`../api/README.md`](../api/README.md), [`../ui/README.md`](../ui/README.md).
