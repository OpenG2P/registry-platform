import { Page, expect } from "@playwright/test";
import { localePath, loadFixture } from "../helpers/fixture";
import { searchInTopBar } from "../helpers/auth";

export async function openIntakeList(page: Page, registerMnemonic?: string) {
  const fx = loadFixture();
  const mnemonic = registerMnemonic ?? fx.register_mnemonic;
  await page.goto(localePath(fx.locale, `/intake-form/${mnemonic}`), {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(new RegExp(`/intake-form/${mnemonic}`, "i"));
}

export async function searchIntakeAndOpen(
  page: Page,
  searchText: string,
  submissionId: string,
  registerMnemonic?: string
) {
  const fx = loadFixture();
  const mnemonic = registerMnemonic ?? fx.register_mnemonic;
  await openIntakeList(page, mnemonic);
  await searchInTopBar(page, searchText);

  const link = page.locator(`a[href*="${submissionId}"]`).first();
  if (await link.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.goto(
      localePath(fx.locale, `/intake-form/${mnemonic}/submission/${submissionId}`),
      { waitUntil: "domcontentloaded" }
    );
  }

  await expect(page).toHaveURL(new RegExp(submissionId));
  const body = page.locator("body");
  await expect(body).toContainText(new RegExp(`${searchText}|${submissionId.slice(0, 8)}`, "i"));
}

/** Open a DRAFT submission in editable intake mode (new?sid=). */
export async function openDraftIntake(
  page: Page,
  opts: { registerMnemonic: string; formId: string; submissionId: string }
) {
  const fx = loadFixture();
  const path = localePath(
    fx.locale,
    `/intake-form/${opts.registerMnemonic}/new/${opts.formId}?sid=${opts.submissionId}`
  );
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/submit|next|cancel/i, { timeout: 60_000 });
}

/**
 * API-seeded drafts hydrate into the widget store *after* the dirty baseline is
 * captured, so sections show "Modified". Submit is blocked until dirty sections
 * are saved via accordion **Next**. Accordion also gates later sections behind
 * sequential Next, so walk Next from the start through the whole form.
 */
export async function saveAllIntakeSectionsViaNext(page: Page) {
  await expect(page.locator("button.intake-form-accordion-header").first()).toBeVisible({
    timeout: 60_000,
  });

  // Allow schema/values to finish hydrating before walking (otherwise late dirty).
  await page
    .getByText(/^Modified$/)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1_500);

  for (let step = 0; step < 30; step++) {
    const nextBtn = page.getByRole("button", { name: /^next$/i }).first();
    if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nextBtn.scrollIntoViewIfNeeded();
      await nextBtn.click();
      // Wait for save + accordion advance.
      await page.waitForTimeout(1_500);
      continue;
    }

    // No Next: expand first interactive header if collapsed, else we're done walking.
    const firstInteractive = page
      .locator("button.intake-form-accordion-header[data-interactive='true']")
      .first();
    if (
      (await firstInteractive.isVisible({ timeout: 2_000 }).catch(() => false)) &&
      (await firstInteractive.getAttribute("aria-expanded")) !== "true"
    ) {
      await firstInteractive.click();
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }

  await expect(
    page.getByText(/^Modified$/),
    "Modified sections must be saved via Next before Submit"
  ).toHaveCount(0);
}

/**
 * Finalize draft intake: save Modified sections → Submit → confirm modal → Close.
 */
export async function clickIntakeSubmit(page: Page) {
  await saveAllIntakeSectionsViaNext(page);

  const formSubmit = page.getByRole("button", { name: /^submit$/i }).first();
  await expect(formSubmit).toBeVisible({ timeout: 30_000 });
  await expect(formSubmit).toBeEnabled({ timeout: 10_000 });
  await formSubmit.click();

  // Warning ActionModal: "Are you sure ?" + confirm labeled Submit.
  const confirmModal = page.locator("div.fixed.inset-0").filter({ hasText: /are you sure/i });
  await expect(confirmModal).toBeVisible({ timeout: 15_000 });
  await confirmModal.getByRole("button", { name: /^submit$/i }).click();

  // Success modal — do not use bare /^close$/i (matches Form Details aria-label Close).
  const successModal = page
    .locator("div.fixed.inset-0")
    .filter({ hasText: /submitted successfully/i });
  await expect(successModal).toBeVisible({ timeout: 60_000 });
  await Promise.all([
    page.waitForURL(/\/intake-form\/[^/]+\/?$/, { timeout: 30_000 }),
    successModal.getByRole("button", { name: /^close$/i }).click(),
  ]);
}
