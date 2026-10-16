import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("register read", () => {
  test("search finds provisioned individual and opens detail", async ({ page }) => {
    const fx = loadFixture();
    const { first_name, last_name, internal_record_id } = fx.individual;

    await searchAndOpenRecord(page, first_name, internal_record_id);

    await expect(page.getByText(first_name, { exact: false }).first()).toBeVisible();
    if (last_name) {
      await expect(page.getByText(last_name, { exact: false }).first()).toBeVisible();
    }
  });
});
