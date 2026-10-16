import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { createHouseholdHeadCrFromRegisterUi } from "../../pages/register-edit";

test.describe("change request create UI [household]", () => {
  // U2-H2: uses create_ui.household (no pending CR on headship section).
  test("edit household head name on register creates pending CR visible on subject", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { register_mnemonic, search_text, internal_record_id } = fx.create_ui.household;
    const newHeadName = `UiHead${Date.now().toString(36).slice(-6)}`;

    await createHouseholdHeadCrFromRegisterUi(page, {
      searchText: search_text,
      internalRecordId: internal_record_id,
      newHeadName,
      registerMnemonic: register_mnemonic,
    });

    await expect(page.locator("body")).toContainText(newHeadName, { timeout: 30_000 });
  });
});
