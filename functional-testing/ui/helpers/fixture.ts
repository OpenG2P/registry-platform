import fs from "fs";
import path from "path";

export type IndividualSubject = {
  internal_record_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  submission_id: string;
};

export type IndividualPendingIntake = {
  submission_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
};

export type IndividualPendingCr = {
  change_request_id: string;
  first_name: string;
  new_middle_name: string;
  section_id: string;
};

export type HouseholdSubject = {
  internal_record_id: string;
  search_text: string;
  submission_id: string;
};

export type HouseholdPendingIntake = {
  submission_id: string;
  search_text: string;
};

export type HouseholdPendingCr = {
  change_request_id: string;
  search_text: string;
  new_value: string;
  section_id: string;
};

export type HouseholdFixture = {
  register_mnemonic: string;
  subject: HouseholdSubject;
  pending_intake: HouseholdPendingIntake;
  pending_cr: HouseholdPendingCr;
};

export type CreateUiFixture = {
  individual: IndividualSubject;
  household: HouseholdSubject & { register_mnemonic: string };
};

export type AweApproveFixture = {
  individual: {
    subject: IndividualSubject;
    pending_intake: IndividualPendingIntake;
    pending_cr: IndividualPendingCr;
  };
  household: {
    register_mnemonic: string;
    subject: HouseholdSubject;
    pending_intake: HouseholdPendingIntake;
    pending_cr: HouseholdPendingCr;
  };
};

/** Slim-gate fixture: browse + queue + create-UI + AWE Tasks approve subjects. */
export type ProvisionedFixture = {
  locale: string;
  register_mnemonic: string;
  individual: IndividualSubject;
  pending_intake: IndividualPendingIntake;
  pending_cr: IndividualPendingCr;
  household: HouseholdFixture;
  create_ui: CreateUiFixture;
  awe_approve: AweApproveFixture;
  /** Optional / parked — present only with extended provision. */
  reject?: {
    individual: {
      subject: IndividualSubject;
      pending_intake: IndividualPendingIntake;
      pending_cr: IndividualPendingCr & { original_middle_name?: string };
    };
    household: {
      subject: HouseholdSubject;
      pending_intake: HouseholdPendingIntake;
      pending_cr: HouseholdPendingCr & { original_search_text?: string };
    };
  };
  ui_only?: {
    subject?: IndividualSubject;
    pending_intake?: IndividualPendingIntake;
    pending_cr?: IndividualPendingCr;
  };
};

export function loadFixture(): ProvisionedFixture {
  const fixturePath = path.join(__dirname, "..", "fixtures", "provisioned.json");
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing ${fixturePath} — run global setup / npm run provision`);
  }
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as ProvisionedFixture;
  if (!raw.household?.subject?.internal_record_id) {
    throw new Error(`${fixturePath} missing household — re-run provision`);
  }
  if (!raw.create_ui?.individual?.internal_record_id) {
    throw new Error(`${fixturePath} missing create_ui — re-run provision (slim gate)`);
  }
  if (!raw.awe_approve?.individual?.pending_intake?.submission_id) {
    throw new Error(`${fixturePath} missing awe_approve — re-run provision (AWE Tasks)`);
  }
  return raw;
}

export function localePath(locale: string, suffix: string): string {
  const clean = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `/${locale}${clean}`;
}
