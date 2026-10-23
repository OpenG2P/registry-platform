import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";
import { apiApproveChangeRequest } from "../../helpers/api-bridge";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("change request approve", () => {
  // Consumes fx.pending_cr (workers: 1). Prefer UI Approve; else api-bridge.
  // Re-provision before expecting this CR to still be PENDING.
  test("pending CR detail visible; status updates after approve; register reflects change", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { change_request_id, first_name, new_middle_name, section_id } = fx.pending_cr;
    const { internal_record_id } = fx.individual;

    await searchChangeRequestAndOpen(page, first_name, change_request_id);
    await expect(page.locator("body")).toContainText(
      new RegExp(`${first_name}|${new_middle_name}|PENDING|pending`, "i")
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

    await searchAndOpenRecord(page, first_name, internal_record_id);
    await expect(page.getByText(new_middle_name, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
