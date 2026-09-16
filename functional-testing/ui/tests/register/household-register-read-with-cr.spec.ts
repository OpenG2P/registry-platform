import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("register read with pending CR [household]", () => {
  test("household detail shows pending change request from provision", async ({ page }) => {
    const fx = loadFixture();
    const { register_mnemonic, subject, pending_cr } = fx.household;

    await searchAndOpenRecord(
      page,
      subject.search_text,
      subject.internal_record_id,
      register_mnemonic
    );

    await page.goto(
      localePath(
        fx.locale,
        `/register/${register_mnemonic}/${subject.internal_record_id}/change-request`
      ),
      { waitUntil: "domcontentloaded" }
    );

    const body = page.locator("body");
    await expect(body).toContainText(
      new RegExp(
        `${pending_cr.change_request_id.slice(0, 8)}|${pending_cr.new_value}|change`,
        "i"
      ),
      { timeout: 30_000 }
    );
  });
});
