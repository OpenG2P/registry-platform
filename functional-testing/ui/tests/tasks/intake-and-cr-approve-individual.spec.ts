import { test, expect } from "@playwright/test";
import { loadFixture, localePath } from "../../helpers/fixture";
import {
  approveTwoStageAweAsAlexThenNina,
  openChangeRequestTask,
  openIntakeTask,
} from "../../pages/approvals";
import { searchAndOpenRecord } from "../../pages/register";

test.describe("AWE Tasks approve intake [individual]", () => {
  // Two AWE stages (alex then nina) + webhook apply — allow extra time.
  test.setTimeout(180_000);

  test("Tasks → Approve all stages → intake APPROVED", async ({ page }) => {
    const fx = loadFixture();
    const { first_name, submission_id } = fx.awe_approve.individual.pending_intake;

    await approveTwoStageAweAsAlexThenNina(page, {
      reopen: async () => {
        await openIntakeTask(page, {
          searchText: first_name,
          submissionId: submission_id,
          registerMnemonic: fx.register_mnemonic,
        });
      },
    });

    await page.goto(
      localePath(fx.locale, `/intake-form/${fx.register_mnemonic}/submission/${submission_id}`),
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator("body")).toContainText(/approved|APPROVED/i, {
      timeout: 90_000,
    });
  });
});

test.describe("AWE Tasks approve change request [individual]", () => {
  test.setTimeout(180_000);

  test("Tasks → Approve all stages → CR APPROVED; register shows new middle name", async ({
    page,
  }) => {
    const fx = loadFixture();
    const { subject, pending_cr } = fx.awe_approve.individual;
    const { change_request_id, first_name, new_middle_name } = pending_cr;

    await approveTwoStageAweAsAlexThenNina(page, {
      reopen: async () => {
        await openChangeRequestTask(page, {
          searchText: first_name,
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

    await searchAndOpenRecord(page, first_name, subject.internal_record_id);
    await expect(page.getByText(new_middle_name, { exact: false }).first()).toBeVisible({
      timeout: 90_000,
    });
  });
});
