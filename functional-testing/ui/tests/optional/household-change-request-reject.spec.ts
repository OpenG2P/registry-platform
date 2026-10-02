import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";
import { apiRejectChangeRequest } from "../../helpers/api-bridge";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("change request reject [household]", () => {
  // Consumes fx.reject.household (dedicated subject + pending CR).
  test("pending household CR rejects; status REJECTED; head name unchanged", async ({ page }) => {
    const fx = loadFixture();
    test.skip(!fx.reject?.household?.pending_cr, "reject fixture missing (slim provision)");
    const { subject, pending_cr } = fx.reject!.household;
    const { change_request_id, search_text, new_value, original_search_text } = pending_cr;
    test.skip(!original_search_text, "reject.pending_cr.original_search_text missing");
    const mnemonic = fx.household.register_mnemonic;

    await searchChangeRequestAndOpen(page, search_text, change_request_id);
    await expect(page.locator("body")).toContainText(
      new RegExp(`${search_text}|${new_value}|PENDING|pending`, "i")
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

    await searchAndOpenRecord(
      page,
      original_search_text!,
      subject.internal_record_id,
      mnemonic
    );
    await expect(page.getByText(original_search_text!, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
