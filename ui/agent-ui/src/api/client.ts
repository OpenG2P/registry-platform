/**
 * Agent Portal API client.
 *
 * Two things it hides from the pages:
 *  - the G2P request/response envelope, which is boilerplate at every call;
 *  - the bearer token, refreshed by auth.ts.
 *
 * Issuance is the exception to the envelope: on success the server replies with
 * the PDF itself rather than JSON, so `issue()` returns a Blob.
 */

import { getToken } from "../auth";

const BASE = "/agent_portal/vc";

export interface G2PHeader {
  response_status: "SUCCESS" | "FAILURE";
  response_error_code?: string;
  response_error_message?: string;
}

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function envelope(payload: unknown) {
  return {
    request_header: {
      sender_app_mnemonic: "agent-ui",
      sender_app_url: window.location.origin,
      request_id: crypto.randomUUID(),
      request_timestamp: new Date().toISOString(),
    },
    request_body: { request_payload: payload },
  };
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getToken()}`,
    },
    body: JSON.stringify(envelope(payload)),
  });
  if (!resp.ok) {
    throw new ApiError(String(resp.status), `${resp.status} ${resp.statusText}`);
  }
  const body = await resp.json();
  const header: G2PHeader = body.response_header ?? {};
  if (header.response_status !== "SUCCESS") {
    throw new ApiError(
      header.response_error_code ?? "UNKNOWN",
      header.response_error_message ?? "The request failed.",
    );
  }
  return body.response_body?.response_payload as T;
}

export interface VcType {
  config_id: string;
  display_name?: string;
}

export interface Beneficiary {
  internal_record_id: string;
  register_id: string;
  record_name?: string;
  eligible: boolean;
  reason?: string;
}

export interface StartedAuth {
  authentication_id: string;
  authorization_url: string;
  provider_name?: string;
}

export interface AuthStatus {
  authentication_id?: string;
  status: string;
  authorised: boolean;
  expires_in_seconds?: number;
  reason?: string;
}

export const api = {
  vcTypes: () => post<{ vc_types: VcType[] }>("/get_vc_types", {}),

  lookup: (national_id: string) =>
    post<Beneficiary>("/lookup_beneficiary", { national_id }),

  startAuthentication: (internal_record_id: string) =>
    post<StartedAuth>("/start_authentication", { internal_record_id }),

  authenticationStatus: (internal_record_id: string, authentication_id?: string) =>
    post<AuthStatus>("/authentication_status", {
      internal_record_id,
      authentication_id,
    }),

  /** Returns the printable credential. The server streams the PDF itself. */
  async issue(
    internal_record_id: string,
    authentication_id: string,
    vc_type?: string,
  ): Promise<{ blob: Blob; filename: string; issuanceId: string }> {
    const resp = await fetch(`${BASE}/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getToken()}`,
      },
      body: JSON.stringify(
        envelope({ internal_record_id, authentication_id, vc_type }),
      ),
    });
    if (!resp.ok) {
      // Errors still come back as the JSON envelope.
      let code = String(resp.status);
      let message = resp.statusText;
      try {
        const body = await resp.json();
        code = body.response_header?.response_error_code ?? code;
        message = body.response_header?.response_error_message ?? message;
      } catch {
        /* non-JSON error body; keep the status text */
      }
      throw new ApiError(code, message);
    }
    const disposition = resp.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    return {
      blob: await resp.blob(),
      filename: match?.[1] ?? "credential.pdf",
      issuanceId: resp.headers.get("X-Issuance-Id") ?? "",
    };
  },
};
