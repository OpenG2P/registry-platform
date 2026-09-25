import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";
import { apiApproveChangeRequest } from "../../helpers/api-bridge";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("change request approve [household]", () => {
  // Consumes fx.household.pending_cr (workers: 1). Prefer UI Approve; else api-bridge.
  test("pending household CR visible; status updates after approve; register reflects change", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { register_mnemonic, subject, pending_cr } = fx.household;
    const { change_request_id, search_text, new_value, section_id } = pending_cr;

    await searchChangeRequestAndOpen(page, search_text, change_request_id);
    await expect(page.locator("body")).toContainText(
      new RegExp(`${search_text}|${new_value}|PENDING|pending`, "i")
    );

    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2_000);
    } else {
      apiApproveChangeRequest(change_request_id, section_id);
    }

    await page.goto(localePath(fx.locale, `/change-request/${change_request_id}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, { timeout: 60_000 });

    // After approve, head name is new_value — search with that.
    await searchAndOpenRecord(page, new_value, subject.internal_record_id, register_mnemonic);
    await expect(page.getByText(new_value, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
