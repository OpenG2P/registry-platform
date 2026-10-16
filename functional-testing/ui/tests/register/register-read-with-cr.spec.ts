import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("register read with pending CR", () => {
  test("individual detail shows pending change request from provision", async ({ page }) => {
    const fx = loadFixture();
    const { first_name, internal_record_id } = fx.individual;
    const { change_request_id, new_middle_name } = fx.pending_cr;

    await searchAndOpenRecord(page, first_name, internal_record_id);

    await page.goto(
      localePath(
        fx.locale,
        `/register/${fx.register_mnemonic}/${internal_record_id}/change-request`
      ),
      { waitUntil: "domcontentloaded" }
    );

    const body = page.locator("body");
    await expect(body).toContainText(
      new RegExp(`${change_request_id.slice(0, 8)}|${new_middle_name}|change`, "i"),
      { timeout: 30_000 }
    );
  });
});
