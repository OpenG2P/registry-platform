import { test, expect } from "@playwright/test";
import { loadFixture } from "../../helpers/fixture";
import { searchIntakeAndOpen } from "../../pages/intake";

test.describe("intake queue", () => {
  test("search finds finalized pending intake and opens submission", async ({ page }) => {
    const fx = loadFixture();
    const { first_name, submission_id } = fx.pending_intake;

    await searchIntakeAndOpen(page, first_name, submission_id);

    await expect(page).toHaveURL(new RegExp(submission_id));
    await expect(page.getByText(first_name, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
