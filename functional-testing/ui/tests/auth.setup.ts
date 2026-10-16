import { test as setup } from "@playwright/test";
import path from "path";
import { loginViaKeycloak } from "../helpers/auth";

const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate via Keycloak", async ({ page }) => {
  const username = process.env.FUNC_OIDC_USERNAME;
  const password = process.env.FUNC_OIDC_PASSWORD;
  if (!username || !password) {
    throw new Error("FUNC_OIDC_USERNAME and FUNC_OIDC_PASSWORD are required for UI auth setup");
  }
  if (!process.env.FUNC_UI_BASE) {
    throw new Error("FUNC_UI_BASE is required for UI auth setup");
  }

  const fs = await import("fs");
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await loginViaKeycloak(page, username, password);
  await page.context().storageState({ path: authFile });
});
