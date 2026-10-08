import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";

test.describe("intake queue [household]", () => {
  test("search finds finalized pending household intake and opens submission", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { register_mnemonic, pending_intake } = fx.household;

    await searchIntakeAndOpen(
      page,
      pending_intake.search_text,
      pending_intake.submission_id,
      register_mnemonic
    );

    await expect(page).toHaveURL(new RegExp(pending_intake.submission_id));
    await expect(
      page.getByText(pending_intake.search_text, { exact: false }).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
