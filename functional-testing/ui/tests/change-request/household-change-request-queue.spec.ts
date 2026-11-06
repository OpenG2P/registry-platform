import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";

test.describe("change request queue [household]", () => {
  test("search finds pending household CR and opens detail", async ({ page }) => {
    const fx = loadFixture();
    const { pending_cr } = fx.household;
    const { change_request_id, search_text, new_value } = pending_cr;

    await searchChangeRequestAndOpen(page, search_text, change_request_id);

    await expect(page).toHaveURL(new RegExp(change_request_id));
    const body = page.locator("body");
    await expect(body).toContainText(
      new RegExp(`${search_text}|${new_value}|${change_request_id.slice(0, 8)}`, "i")
    );
  });
});
