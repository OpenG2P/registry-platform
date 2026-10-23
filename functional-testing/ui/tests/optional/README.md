# Optional UI specs (not on compose gate)

Parked journeys that are not on the slim compose gate:

- **Hybrid Approve/Reject** (UI if visible else `api-bridge`) — superseded by
  `tests/tasks/` AWE Tasks approve with `alex.carter` then `nina.patel`.
- **Household intake finalize** — UI Submit validation requires ≥1 **Members**
  table row; API draft provision skips `hh_members`.

Default chromium project **ignores** this folder (`playwright.config.ts`).

## Slim gate AWE approve

AWE `approver_rule` seed assigns **stage 1** to `alex.carter` and **stage 2**
to `nina.patel`. Specs under `tests/tasks/` switch users between stages and
assert APPROVED at the end.
