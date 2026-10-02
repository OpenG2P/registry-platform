import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";

test.describe("home", () => {
  test("authenticated home renders staff portal shell", async ({ page }) => {
    const fx = loadFixture();
    await page.goto(localePath(fx.locale, "/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(/AUTH_GENERIC_ERROR|G2P-AUT-403/i);
    await expect(page.locator("body")).toContainText(/register|intake|change|task/i);
  });
});
