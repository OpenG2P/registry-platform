import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";
import { apiRejectIntake } from "../../helpers/api-bridge";

test.describe("intake reject [individual]", () => {
  // Consumes fx.reject.individual.pending_intake. Prefer UI Reject; else api-bridge.
  test("pending submission rejects; status shows REJECTED", async ({ page }) => {
    const fx = loadFixture();
    test.skip(!fx.reject?.individual?.pending_intake, "reject fixture missing (slim provision)");
    const { first_name, submission_id } = fx.reject!.individual.pending_intake;

    await searchIntakeAndOpen(page, first_name, submission_id);
    await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 30_000 });

    const rejectBtn = page.getByRole("button", { name: /^reject$/i }).first();
    if (await rejectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rejectBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiRejectIntake(submission_id);
    }

    await page.goto(
      localePath(fx.locale, `/intake-form/${fx.register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/rejected|REJECTED/i, { timeout: 60_000 });
  });
});
