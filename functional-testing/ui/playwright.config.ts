import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const baseURL = process.env.FUNC_UI_BASE || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: require.resolve("./global-setup"),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: process.env.FUNC_VERIFY_TLS === "false",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      // Hybrid approve/reject + AWE UI-only live under tests/optional/ (not gate).
      testIgnore: [/\/optional\//],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, ".auth/user.json"),
      },
    },
  ],
});
