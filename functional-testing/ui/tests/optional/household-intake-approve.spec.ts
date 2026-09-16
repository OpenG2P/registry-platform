import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";
import { apiApproveIntake } from "../../helpers/api-bridge";

test.describe("intake approve [household]", () => {
  // Consumes fx.household.pending_intake (workers: 1). Prefer UI Approve; else api-bridge.
  test("pending household submission shows approvals panel; status updates after approve", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { register_mnemonic, pending_intake } = fx.household;
    const { search_text, submission_id } = pending_intake;

    await searchIntakeAndOpen(page, search_text, submission_id, register_mnemonic);

    await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 30_000 });

    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiApproveIntake(submission_id);
    }

    await page.goto(
      localePath(fx.locale, `/intake-form/${register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, { timeout: 60_000 });
  });
});
