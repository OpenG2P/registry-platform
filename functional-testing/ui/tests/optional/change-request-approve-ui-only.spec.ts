import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";
import { searchAndOpenRecord } from "../../pages/register";
import { aweUiDecisionsEnabled, clickUiApprove } from "../../pages/approvals";

test.describe("change request approve UI-only [individual]", () => {
  test.skip(
    !aweUiDecisionsEnabled(),
    "set FUNC_UI_AWE_DECISIONS=1 (AWE assignee buttons) to run UI-only approve"
  );

  test("Approve button required; register reflects change without api-bridge", async ({
    page,
  }, testInfo) => {
    const fx = loadFixture();
    const ui = fx.ui_only;
    testInfo.skip(
      !ui?.pending_cr?.change_request_id || !ui?.subject?.internal_record_id,
      "ui_only block missing — re-provision with FUNC_UI_AWE_DECISIONS=1"
    );

    const { change_request_id, first_name, new_middle_name } = ui!.pending_cr;
    const { internal_record_id } = ui!.subject;

    await searchChangeRequestAndOpen(page, first_name, change_request_id);
    await expect(page.locator("body")).toContainText(
      new RegExp(`${first_name}|${new_middle_name}|PENDING|pending`, "i")
    );

    await clickUiApprove(page);

    await page.goto(localePath(fx.locale, `/change-request/${change_request_id}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, { timeout: 60_000 });

    await searchAndOpenRecord(page, first_name, internal_record_id);
    await expect(page.getByText(new_middle_name, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
