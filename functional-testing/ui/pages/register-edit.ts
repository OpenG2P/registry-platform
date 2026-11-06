import { Page, expect } from "@playwright/test";
import { localePath, loadFixture } from "../helpers/fixture";
import { searchAndOpenRecord } from "./register";

/**
 * On register subject detail: Edit Details → change a text field → Save
 * (creates a change request via staff UI).
 *
 * Edit UI is an absolute portal (`[data-section-id="${sectionId}-edit"]`), not
 * inline in the read-only section. Scope Edit Details to the section that owns
 * the widget — iterating every Edit Details button is flaky on multi-section
 * registers (e.g. Household).
 */
export async function createFieldCrFromRegisterUi(
  page: Page,
  opts: {
    searchText: string;
    internalRecordId: string;
    newValue: string;
    /** Widget schema id, e.g. middle_name / household_head_name. */
    widgetId: string;
    registerMnemonic?: string;
  }
) {
  const fx = loadFixture();
  const mnemonic = opts.registerMnemonic ?? fx.register_mnemonic;

  await searchAndOpenRecord(page, opts.searchText, opts.internalRecordId, mnemonic);

  // Read-only section that owns this widget (exclude any leftover edit portals).
  const viewSection = page
    .locator(
      `[data-section-id]:not([data-section-id$="-edit"]):has([data-widget-id="${opts.widgetId}"])`
    )
    .first();
  await expect(viewSection).toBeVisible({ timeout: 30_000 });
  const sectionId = await viewSection.getAttribute("data-section-id");
  expect(sectionId, `section for widget ${opts.widgetId}`).toBeTruthy();

  await viewSection
    .locator(`[data-widget-id="${opts.widgetId}"]`)
    .first()
    .scrollIntoViewIfNeeded();

  const editBtn = viewSection.getByRole("button", { name: /edit details/i });
  await expect(editBtn).toBeVisible({ timeout: 30_000 });
  await editBtn.click();

  // Portal mounts after rAF position calc; wait on the matching *-edit section.
  const editPortal = page.locator(`[data-section-id="${sectionId}-edit"]`);
  await expect(editPortal).toBeVisible({ timeout: 20_000 });

  const editInput = editPortal
    .locator(
      `[data-widget-id="${opts.widgetId}"] input:not([disabled]), ` +
        `[data-widget-id="${opts.widgetId}"] textarea:not([disabled])`
    )
    .first();
  await expect(
    editInput,
    `editable [data-widget-id="${opts.widgetId}"] in section ${sectionId}-edit`
  ).toBeVisible({ timeout: 20_000 });
  await editInput.scrollIntoViewIfNeeded();
  await editInput.fill("");
  await editInput.fill(opts.newValue);

  const saveBtn = editPortal.getByRole("button", { name: /^save$/i }).first();
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();

  await page
    .getByText(/change request|created|success/i)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);

  await page.goto(
    localePath(fx.locale, `/register/${mnemonic}/${opts.internalRecordId}/change-request`),
    { waitUntil: "domcontentloaded" }
  );

  // List card shows subject/status; field delta is on CR detail (esp. Individual middle_name).
  await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 30_000 });
  const viewDetails = page.getByText(/view details/i).first();
  await expect(viewDetails).toBeVisible({ timeout: 15_000 });
  await viewDetails.click();
  await expect(page.locator("body")).toContainText(opts.newValue, { timeout: 60_000 });
}

/** Individual: Edit Details → middle_name → Save. */
export async function createMiddleNameCrFromRegisterUi(
  page: Page,
  opts: {
    firstName: string;
    internalRecordId: string;
    newMiddleName: string;
    registerMnemonic?: string;
  }
) {
  await createFieldCrFromRegisterUi(page, {
    searchText: opts.firstName,
    internalRecordId: opts.internalRecordId,
    newValue: opts.newMiddleName,
    widgetId: "middle_name",
    registerMnemonic: opts.registerMnemonic,
  });
}

/** Household: Edit Details → household_head_name → Save. */
export async function createHouseholdHeadCrFromRegisterUi(
  page: Page,
  opts: {
    searchText: string;
    internalRecordId: string;
    newHeadName: string;
    registerMnemonic?: string;
  }
) {
  await createFieldCrFromRegisterUi(page, {
    searchText: opts.searchText,
    internalRecordId: opts.internalRecordId,
    newValue: opts.newHeadName,
    widgetId: "household_head_name",
    registerMnemonic: opts.registerMnemonic ?? "Household",
  });
}
