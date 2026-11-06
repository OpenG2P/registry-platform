import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

function pythonBin(): string {
  const apiVenv = path.resolve(__dirname, "../../.venv/bin/python");
  return fs.existsSync(apiVenv) ? apiVenv : "python3";
}

function runDecision(kind: string, entityId: string, extra?: string): void {
  const script = path.join(__dirname, "../scripts/approve_fixture.py");
  const args = [script, kind, entityId];
  if (extra) args.push(extra);
  execFileSync(pythonBin(), args, {
    env: process.env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

export function apiApproveIntake(submissionId: string): void {
  runDecision("intake", submissionId);
}

export function apiApproveChangeRequest(changeRequestId: string, sectionId?: string): void {
  runDecision("cr", changeRequestId, sectionId);
}

export function apiRejectIntake(submissionId: string): void {
  runDecision("reject-intake", submissionId);
}

export function apiRejectChangeRequest(changeRequestId: string): void {
  runDecision("reject-cr", changeRequestId);
}

export type DraftIntakeFixture = {
  register_mnemonic: string;
  form_id: string;
  submission_id: string;
  search_text: string;
  first_name: string;
  middle_name: string;
  last_name: string;
};

/** Create a DRAFT intake via API (sections saved, not finalized). */
export function apiCreateDraftIntake(
  profile: "individual" | "household" = "individual"
): DraftIntakeFixture {
  const script = path.join(__dirname, "../scripts/create_draft_intake.py");
  const stdout = execFileSync(pythonBin(), [script, profile], {
    env: process.env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const line = stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .pop();
  if (!line) {
    throw new Error(`create_draft_intake.py produced no JSON: ${stdout.slice(0, 300)}`);
  }
  return JSON.parse(line) as DraftIntakeFixture;
}
