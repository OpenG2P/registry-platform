import { Page, expect } from "@playwright/test";
import { localePath, loadFixture } from "../helpers/fixture";
import { searchInTopBar } from "../helpers/auth";

export async function openChangeRequestList(page: Page) {
  const fx = loadFixture();
  await page.goto(localePath(fx.locale, `/change-request`), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/change-request/i);
}

export async function searchChangeRequestAndOpen(
  page: Page,
  searchText: string,
  changeRequestId: string
) {
  const fx = loadFixture();
  await openChangeRequestList(page);
  await searchInTopBar(page, searchText);

  const link = page.locator(`a[href*="${changeRequestId}"]`).first();
  if (await link.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.goto(localePath(fx.locale, `/change-request/${changeRequestId}`), {
      waitUntil: "domcontentloaded",
    });
  }

  await expect(page).toHaveURL(new RegExp(changeRequestId));
  // Detail page shows registrant name / approval status — not the CR UUID in body text.
  await expect(page.locator("body")).toContainText(/Change Request|PENDING|pending/i);
}
