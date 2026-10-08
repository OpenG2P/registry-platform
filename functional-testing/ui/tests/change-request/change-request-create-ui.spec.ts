import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { createMiddleNameCrFromRegisterUi } from "../../pages/register-edit";

test.describe("change request create UI [individual]", () => {
  // U2-C1: uses create_ui.individual (no pending CR on demographic section).
  test("edit middle name on register creates pending CR visible on subject", async ({ page }) => {
    const fx = loadFixture();
    const { first_name, internal_record_id } = fx.create_ui.individual;
    const newMiddleName = `UiMid${Date.now().toString(36).slice(-6)}`;

    await createMiddleNameCrFromRegisterUi(page, {
      firstName: first_name,
      internalRecordId: internal_record_id,
      newMiddleName,
    });

    await expect(page.locator("body")).toContainText(newMiddleName, { timeout: 30_000 });
  });
});
