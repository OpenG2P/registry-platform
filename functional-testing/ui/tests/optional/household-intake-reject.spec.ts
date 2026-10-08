import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";
import { apiRejectIntake } from "../../helpers/api-bridge";

test.describe("intake reject [household]", () => {
  // Consumes fx.reject.household.pending_intake. Prefer UI Reject; else api-bridge.
  test("pending household submission rejects; status shows REJECTED", async ({ page }) => {
    const fx = loadFixture();
    test.skip(!fx.reject?.household?.pending_intake, "reject fixture missing (slim provision)");
    const { register_mnemonic } = fx.household;
    const { search_text, submission_id } = fx.reject!.household.pending_intake;

    await searchIntakeAndOpen(page, search_text, submission_id, register_mnemonic);
    await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 30_000 });

    const rejectBtn = page.getByRole("button", { name: /^reject$/i }).first();
    if (await rejectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rejectBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiRejectIntake(submission_id);
    }

    await page.goto(
      localePath(fx.locale, `/intake-form/${register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/rejected|REJECTED/i, { timeout: 60_000 });
  });
});
