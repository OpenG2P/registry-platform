import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import {
  approveTwoStageAweAsAlexThenNina,
  openChangeRequestTask,
  openIntakeTask,
} from "../../pages/approvals";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("AWE Tasks approve intake [household]", () => {
  test.setTimeout(180_000);

  test("Tasks → Approve all stages → household intake APPROVED", async ({ page }) => {
    const fx = loadFixture();
    const { register_mnemonic, pending_intake } = fx.awe_approve.household;
    const { search_text, submission_id } = pending_intake;

    await approveTwoStageAweAsAlexThenNina(page, {
      reopen: async () => {
        await openIntakeTask(page, {
          searchText: search_text,
          submissionId: submission_id,
          registerMnemonic: register_mnemonic,
        });
      },
    });

    await page.goto(
      localePath(fx.locale, `/intake-form/${register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, {
      timeout: 90_000,
    });
  });
});

test.describe("AWE Tasks approve change request [household]", () => {
  test.setTimeout(180_000);

  test("Tasks → Approve all stages → household CR APPROVED; register shows new head name", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { register_mnemonic, subject, pending_cr } = fx.awe_approve.household;
    const { change_request_id, search_text, new_value } = pending_cr;

    await approveTwoStageAweAsAlexThenNina(page, {
      reopen: async () => {
        await openChangeRequestTask(page, {
          searchText: search_text,
          changeRequestId: change_request_id,
        });
      },
    });

    await page.goto(localePath(fx.locale, `/change-request/${change_request_id}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, {
      timeout: 90_000,
    });

    await searchAndOpenRecord(
      page,
      new_value,
      subject.internal_record_id,
      register_mnemonic
    );
    await expect(page.getByText(new_value, { exact: false }).first()).toBeVisible({
      timeout: 90_000,
    });
  });
});
