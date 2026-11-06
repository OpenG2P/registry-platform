import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";
import { apiRejectChangeRequest } from "../../helpers/api-bridge";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("change request reject [individual]", () => {
  // Consumes fx.reject.individual (dedicated subject + pending CR).
  test("pending CR rejects; status REJECTED; subject middle_name unchanged", async ({ page }) => {
    const fx = loadFixture();
    test.skip(!fx.reject?.individual?.pending_cr, "reject fixture missing (slim provision)");
    const { subject, pending_cr } = fx.reject!.individual;
    const { change_request_id, first_name, new_middle_name, original_middle_name } = pending_cr;
    test.skip(!original_middle_name, "reject.pending_cr.original_middle_name missing");

    await searchChangeRequestAndOpen(page, first_name, change_request_id);
    await expect(page.locator("body")).toContainText(
      new RegExp(`${first_name}|${new_middle_name}|PENDING|pending`, "i")
    );

    const rejectBtn = page.getByRole("button", { name: /^reject$/i }).first();
    if (await rejectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rejectBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiRejectChangeRequest(change_request_id);
    }

    await page.goto(localePath(fx.locale, `/change-request/${change_request_id}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(/rejected|REJECTED/i, { timeout: 60_000 });

    await searchAndOpenRecord(page, first_name, subject.internal_record_id);
    await expect(page.getByText(original_middle_name!, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
