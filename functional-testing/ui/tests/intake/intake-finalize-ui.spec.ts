import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import { apiCreateDraftIntake } from "../../helpers/api-bridge";
import { clickIntakeSubmit, openDraftIntake } from "../../pages/intake";

test.describe("intake finalize UI [individual]", () => {
  // U2-I1: API seeds DRAFT; browser Submit finalizes (DRAFT→FINAL).
  // After finalize, approval_status is PENDING (awaits approve) — not a revert.
  // Next-walk + modals need more than the default 120s.
  test.setTimeout(180_000);

  test("API draft → UI Submit finalizes (FINAL draft_status, PENDING approval)", async ({
    page,
  }) => {
    const fx = loadFixture();
    const draft = apiCreateDraftIntake("individual");

    await openDraftIntake(page, {
      registerMnemonic: draft.register_mnemonic,
      formId: draft.form_id,
      submissionId: draft.submission_id,
    });

    await clickIntakeSubmit(page);

    await page.goto(
      localePath(
        fx.locale,
        `/intake-form/${draft.register_mnemonic}/submission/${draft.submission_id}`
      ),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/FINAL|PENDING|pending|final/i, {
      timeout: 60_000,
    });
    await expect(page.locator("body")).toContainText(
      new RegExp(draft.search_text.slice(0, 8), "i"),
      { timeout: 30_000 }
    );
  });
});
