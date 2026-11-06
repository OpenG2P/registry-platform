import { Page, expect } from "@playwright/test";
import { localePath, loadFixture } from "../helpers/fixture";
import { searchInTopBar } from "../helpers/auth";

export async function openRegister(page: Page, registerMnemonic?: string) {
  const fx = loadFixture();
  const mnemonic = registerMnemonic ?? fx.register_mnemonic;
  const path = localePath(fx.locale, `/register/${mnemonic}`);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/register/${mnemonic}`, "i"));
}

export async function searchAndOpenRecord(
  page: Page,
  searchText: string,
  internalRecordId: string,
  registerMnemonic?: string
) {
  const fx = loadFixture();
  const mnemonic = registerMnemonic ?? fx.register_mnemonic;
  await openRegister(page, mnemonic);
  await searchInTopBar(page, searchText);

  const link = page.locator(`a[href*="/register/${mnemonic}/${internalRecordId}"]`).first();
  if (await link.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.goto(
      localePath(fx.locale, `/register/${mnemonic}/${internalRecordId}`),
      { waitUntil: "domcontentloaded" }
    );
  }

  await expect(page).toHaveURL(new RegExp(internalRecordId));
  await expect(page.getByText(searchText, { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
}
