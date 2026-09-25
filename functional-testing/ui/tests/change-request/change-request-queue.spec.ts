import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchChangeRequestAndOpen } from "../../pages/change-request";

test.describe("change request queue", () => {
  test("search finds pending CR and opens detail", async ({ page }) => {
    const fx = loadFixture();
    const { change_request_id, first_name, new_middle_name } = fx.pending_cr;

    await searchChangeRequestAndOpen(page, first_name, change_request_id);

    await expect(page).toHaveURL(new RegExp(change_request_id));
    const body = page.locator("body");
    await expect(body).toContainText(
      new RegExp(`${first_name}|${new_middle_name}|${change_request_id.slice(0, 8)}`, "i")
    );
  });
});
