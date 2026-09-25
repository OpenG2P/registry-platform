import { Page, expect } from "@playwright/test";

/** Docker-internal Keycloak hostname used by IAM redirects; browser uses published port. */
const KEYCLOAK_DOCKER_ORIGIN = "http://keycloak:8080";
const KEYCLOAK_BROWSER_ORIGIN = "http://localhost:18080";

function rewriteKeycloakUrl(url: string): string {
  return url.replaceAll(KEYCLOAK_DOCKER_ORIGIN, KEYCLOAK_BROWSER_ORIGIN);
}

/**
 * Staff UI auth goes: /api/login -> IAM -> Keycloak password form -> back to UI.
 *
 * Compose IAM redirects to http://keycloak:8080 (reachable from containers, not
 * from the host browser). Resolve the first redirect Location in Node, rewrite
 * the host to localhost:18080, then continue in the browser.
 *
 * Auth transaction state lives in Redis (IAM_STAFF_AUTH_TRANSACTION_STORE_BACKEND),
 * so starting login via page.request and completing it in the browser is safe.
 */
export async function loginViaKeycloak(page: Page, username: string, password: string) {
  const uiBase = process.env.FUNC_UI_BASE;
  if (!uiBase) {
    throw new Error("FUNC_UI_BASE is required for UI tests");
  }

  // Rewrite any subsequent navigations/resources that still use the docker hostname.
  await page.route(/keycloak:8080/, async (route) => {
    await route.continue({ url: rewriteKeycloakUrl(route.request().url()) });
  });

  const loginUrl = `${uiBase.replace(/\/$/, "")}/api/login?redirect_uri=${encodeURIComponent(uiBase)}`;

  const resp = await page.request.get(loginUrl, { maxRedirects: 0 });
  const location = resp.headers()["location"] || resp.headers()["Location"];
  if (!location) {
    throw new Error(
      `/api/login did not redirect (status=${resp.status()}). Body: ${(await resp.text()).slice(0, 300)}`
    );
  }

  await page.goto(rewriteKeycloakUrl(location), { waitUntil: "domcontentloaded" });

  if (page.url().includes("keycloak:8080")) {
    await page.goto(rewriteKeycloakUrl(page.url()), { waitUntil: "domcontentloaded" });
  }

  const user = page
    .locator(
      '#username, input[name="username"], input[name="email"], input[type="email"], input[autocomplete="username"]'
    )
    .first();
  const pass = page
    .locator(
      '#password, input[name="password"], input[type="password"], input[autocomplete="current-password"]'
    )
    .first();

  await expect(user).toBeVisible({ timeout: 60_000 });
  await user.fill(username);
  await pass.fill(password);

  const submit = page
    .locator(
      '#kc-login, input[type="submit"], button[type="submit"], button:has-text("Sign In"), button:has-text("Log in")'
    )
    .first();
  await submit.click();

  // After Keycloak, IAM callback may briefly hit localhost:18081 before returning to the UI.
  await page.waitForURL(
    (url) => {
      const href = url.href;
      return href.startsWith(uiBase) || href.includes("localhost:18081");
    },
    { timeout: 90_000 }
  );

  if (page.url().includes("localhost:18081")) {
    await page.waitForURL((url) => url.href.startsWith(uiBase), { timeout: 90_000 });
  }

  await expect(page.locator("body")).not.toContainText(/AUTH_GENERIC_ERROR|G2P-AUT-403|G2P-AUT-401/i);
}

export async function logoutOfStaffUi(page: Page) {
  const uiBase = process.env.FUNC_UI_BASE;
  if (!uiBase) {
    throw new Error("FUNC_UI_BASE is required for UI logout");
  }
  await page.goto(`${uiBase.replace(/\/$/, "")}/api/logout`, { waitUntil: "domcontentloaded" });
}

export async function reloginViaKeycloak(page: Page, username: string, password: string) {
  await page.context().clearCookies();
  await logoutOfStaffUi(page).catch(() => undefined);
  await loginViaKeycloak(page, username, password);
}

export function aweStageUser(
  stage: 1 | 2
): { username: string; password: string } {
  if (stage === 1) {
    return {
      username: process.env.FUNC_AWE_STAGE1_USERNAME || "alex.carter",
      password: process.env.FUNC_AWE_STAGE1_PASSWORD || "alex.carter-pass",
    };
  }
  return {
    username: process.env.FUNC_AWE_STAGE2_USERNAME || "nina.patel",
    password: process.env.FUNC_AWE_STAGE2_PASSWORD || "nina.patel-pass",
  };
}

export async function searchInTopBar(page: Page, text: string) {
  const input = page.locator('input[placeholder*="earch" i], input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(text);
  await input.press("Enter");
}
