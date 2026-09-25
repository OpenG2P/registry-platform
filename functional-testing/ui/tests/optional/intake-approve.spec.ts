import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";
import { apiApproveIntake } from "../../helpers/api-bridge";

test.describe("intake approve", () => {
  // Consumes fx.pending_intake (workers: 1). Prefer UI Approve; else api-bridge.
  // Re-provision before expecting this entity to still be PENDING.
  test("pending submission shows approvals panel; status updates after approve", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { first_name, submission_id } = fx.pending_intake;

    await searchIntakeAndOpen(page, first_name, submission_id);

    await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 30_000 });

    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiApproveIntake(submission_id);
    }

    await page.goto(
      localePath(fx.locale, `/intake-form/${fx.register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, { timeout: 60_000 });
  });
});
