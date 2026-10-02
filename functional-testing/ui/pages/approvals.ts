import { Page, expect } from "@playwright/test";
import { localePath, loadFixture } from "../helpers/fixture";
import { aweStageUser, reloginViaKeycloak, searchInTopBar } from "../helpers/auth";

/**
 * Approve the currently assigned AWE stage as a specific user.
 */
export async function approveCurrentAweStage(
  page: Page,
  opts: { comment?: string } = {}
): Promise<number> {
  const approveBtn = page.getByRole("button", { name: /^approve$/i }).first();
  await expect(approveBtn).toBeVisible({ timeout: 20_000 });
  await expect(approveBtn).toBeEnabled({ timeout: 10_000 });

  const comment = page.locator("textarea").first();
  if (await comment.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await comment.fill(opts.comment ?? "Functional AWE approval");
  }
  await approveBtn.click();

  await page
    .getByText(/approval submitted|submitted|success/i)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(3_000);
  return 1;
}

export async function approveTwoStageAweAsAlexThenNina(
  page: Page,
  opts: { reopen: () => Promise<void> }
): Promise<void> {
  const alex = aweStageUser(1);
  await reloginViaKeycloak(page, alex.username, alex.password);
  await opts.reopen();
  await approveCurrentAweStage(page, { comment: "Stage 1 approve by Alex Carter" });

  const nina = aweStageUser(2);
  await reloginViaKeycloak(page, nina.username, nina.password);
  await opts.reopen();
  await approveCurrentAweStage(page, { comment: "Stage 2 approve by Nina Patel" });
}

/** Open intake task via Tasks inbox (falls back to submission URL). */
export async function openIntakeTask(
  page: Page,
  opts: {
    searchText: string;
    submissionId: string;
    registerMnemonic: string;
  }
): Promise<void> {
  const fx = loadFixture();
  const listPath = localePath(fx.locale, "/tasks/intake-form");
  await page.goto(listPath, { waitUntil: "domcontentloaded" });
  await searchInTopBar(page, opts.searchText);

  const taskLink = page.locator(`a[href*="${opts.submissionId}"]`).first();
  if (await taskLink.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await taskLink.click();
  } else {
    // Approvals panel is also on the submission detail page.
    await page.goto(
      localePath(
        fx.locale,
        `/intake-form/${opts.registerMnemonic}/submission/${opts.submissionId}`
      ),
      { waitUntil: "domcontentloaded" }
    );
  }

  await expect(page).toHaveURL(new RegExp(opts.submissionId));
  await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 60_000 });
}

/** Open CR task via Tasks inbox (falls back to CR task detail URL). */
export async function openChangeRequestTask(
  page: Page,
  opts: {
    searchText: string;
    changeRequestId: string;
  }
): Promise<void> {
  const fx = loadFixture();
  await page.goto(localePath(fx.locale, "/tasks/change-request"), {
    waitUntil: "domcontentloaded",
  });
  await searchInTopBar(page, opts.searchText);

  const taskLink = page.locator(`a[href*="${opts.changeRequestId}"]`).first();
  if (await taskLink.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await taskLink.click();
  } else {
    await page.goto(
      localePath(fx.locale, `/tasks/change-request/${opts.changeRequestId}`),
      { waitUntil: "domcontentloaded" }
    );
  }

  await expect(page).toHaveURL(new RegExp(opts.changeRequestId));
  await expect(page.getByText(/approval/i).first()).toBeVisible({ timeout: 60_000 });
}

/** @deprecated Prefer stage-specific helpers — kept for optional specs. */
export async function clickUiApprove(page: Page): Promise<void> {
  await approveCurrentAweStage(page);
}

export async function clickUiReject(page: Page): Promise<void> {
  const rejectBtn = page.getByRole("button", { name: /^reject$/i }).first();
  await expect(rejectBtn).toBeVisible({ timeout: 15_000 });
  await rejectBtn.click();
  await page.waitForTimeout(2_000);
}

export function aweUiDecisionsEnabled(): boolean {
  return process.env.FUNC_UI_AWE_DECISIONS === "1";
}
