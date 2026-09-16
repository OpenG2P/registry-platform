import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("register read [household]", () => {
  test("search finds provisioned household and opens detail", async ({ page }) => {
    const fx = loadFixture();
    const { register_mnemonic, subject } = fx.household;

    await searchAndOpenRecord(
      page,
      subject.search_text,
      subject.internal_record_id,
      register_mnemonic
    );

    await expect(page.getByText(subject.search_text, { exact: false }).first()).toBeVisible();
  });
});
