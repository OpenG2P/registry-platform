import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";
import { aweUiDecisionsEnabled, clickUiApprove } from "../../pages/approvals";

test.describe("intake approve UI-only [individual]", () => {
  test.skip(
    !aweUiDecisionsEnabled(),
    "set FUNC_UI_AWE_DECISIONS=1 (AWE assignee buttons) to run UI-only approve"
  );

  test("Approve button required; status updates to APPROVED without api-bridge", async ({
    page,
  }, testInfo) => {
    const fx = loadFixture();
    const ui = fx.ui_only;
    testInfo.skip(
      !ui?.pending_intake?.submission_id,
      "ui_only.pending_intake missing — re-provision with FUNC_UI_AWE_DECISIONS=1"
    );

    const { first_name, submission_id } = ui!.pending_intake;
    await searchIntakeAndOpen(page, first_name, submission_id);
    await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 30_000 });

    await clickUiApprove(page);

    await page.goto(
      localePath(fx.locale, `/intake-form/${fx.register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, { timeout: 60_000 });
  });
});
