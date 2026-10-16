/**
 * Provisions API fixtures before Playwright runs (fixtures/provisioned.json).
 * Requires the same FUNC_* env as the provisioning suite (see ../.env.example).
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

async function globalSetup() {
  const uiRoot = __dirname;
  const fixturePath = path.join(uiRoot, "fixtures", "provisioned.json");
  const script = path.join(uiRoot, "scripts", "provision_fixture.py");
  const apiVenvPython = path.resolve(uiRoot, "../.venv/bin/python");
  const python = fs.existsSync(apiVenvPython) ? apiVenvPython : "python3";

  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });

  if (process.env.FUNC_UI_SKIP_PROVISION === "1") {
    if (!fs.existsSync(fixturePath)) {
      throw new Error(
        "FUNC_UI_SKIP_PROVISION=1 but fixtures/provisioned.json is missing. Run npm run provision once."
      );
    }
    console.log(`[ui globalSetup] skipped provision; using ${fixturePath}`);
    return;
  }

  console.log(`[ui globalSetup] provisioning via ${python} ${script}`);
  execFileSync(python, [script], {
    cwd: uiRoot,
    env: process.env,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "inherit", "inherit"],
  });

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`provision_fixture.py did not write ${fixturePath}`);
  }
  JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  console.log(`[ui globalSetup] wrote ${fixturePath}`);
}

export default globalSetup;
