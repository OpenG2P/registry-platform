/**
 * Agent Portal API client.
 *
 * Calls this app's own BFF routes under /api/agent/*, never the Agent Portal
 * API directly. The access token lives in an httpOnly cookie the browser cannot
 * read; the BFF reads it server-side and adds the backend's auth headers. This
 * mirrors the staff portal exactly — the page code never handles a token.
 *
 * Issuance is the exception to the envelope: on success the server replies with
 * the PDF itself rather than JSON, so `issue()` returns a Blob.
 */

import { csrfHeaders } from "../shared/utils/csrf";

const BASE = "/api/agent";

export interface G2PHeader {
  response_status: "SUCCESS" | "FAILURE" | "ERROR";
  response_error_code?: string;
  response_error_message?: string;
}

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Send the browser to login, preserving where the agent was. */
function toLogin(): never {
  window.location.href = `/api/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
  throw new ApiError("G2P-AUT-401", "Redirecting to sign in…");
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  const resp = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(payload),
  });
  if (resp.status === 401) toLogin();
  if (!resp.ok) {
    let code = String(resp.status);
    let message = resp.statusText;
    try {
      const body = await resp.json();
      code = body.response_header?.response_error_code ?? body.errors?.[0]?.code ?? code;
      message = body.response_header?.response_error_message ?? body.errors?.[0]?.message ?? message;
    } catch {
      /* non-JSON error body; keep the status text */
    }
    throw new ApiError(code, message);
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
  vcTypes: () => post<{ vc_types: VcType[] }>("get_vc_types", {}),

  lookup: (national_id: string) =>
    post<Beneficiary>("lookup_beneficiary", { national_id }),

  startAuthentication: (internal_record_id: string) =>
    post<StartedAuth>("start_authentication", { internal_record_id }),

  authenticationStatus: (internal_record_id: string, authentication_id?: string) =>
    post<AuthStatus>("authentication_status", {
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ internal_record_id, authentication_id, vc_type }),
    });
    if (resp.status === 401) toLogin();
    if (!resp.ok) {
      // Errors still come back as the JSON envelope.
      let code = String(resp.status);
      let message = resp.statusText;
      try {
        const body = await resp.json();
        code = body.response_header?.response_error_code ?? body.errors?.[0]?.code ?? code;
        message = body.response_header?.response_error_message ?? body.errors?.[0]?.message ?? message;
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
