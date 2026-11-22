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

  const detailData = page.waitForResponse(
    (response) =>
      response.url().includes("/api/register/tab-sections-data") &&
      response.request().method() === "POST" &&
      response.ok(),
    { timeout: 60_000 }
  );

  const link = page.locator(`a[href*="${internalRecordId}"]`).first();
  if (await link.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.goto(
      localePath(fx.locale, `/register/${mnemonic}/${internalRecordId}`),
      { waitUntil: "domcontentloaded" }
    );
  }

  await expect(page).toHaveURL(new RegExp(internalRecordId));
  await detailData.catch(() => undefined);
  // Header record_name is text. Editable fields such as household_head_name
  // keep the same value on an input, which getByText does not see.
  await expect
    .poll(
      async () => {
        if (
          (await page.getByText(searchText, { exact: false }).count()) > 0 &&
          (await page.getByText(searchText, { exact: false }).first().isVisible())
        ) {
          return true;
        }
        const values = await page.locator("input, textarea").evaluateAll((els) =>
          els.map((el) => (el as HTMLInputElement).value || "")
        );
        return values.some((value) => value.includes(searchText));
      },
      { timeout: 60_000 }
    )
    .toBe(true);
}
