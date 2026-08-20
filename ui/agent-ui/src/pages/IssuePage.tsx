/**
 * The whole agent workflow, on one screen.
 *
 * It is deliberately a single page with four stages rather than a wizard across
 * routes: the agent is standing at a counter with a person in front of them, and
 * the beneficiary's authentication expires in minutes. Everything they need to
 * see — who was found, whether the authentication landed, how long is left —
 * stays visible at once.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api, type AuthStatus, type Beneficiary, type VcType } from "../api/client";

type Stage = "lookup" | "authenticate" | "issue" | "done";

export default function IssuePage() {
  const [nationalId, setNationalId] = useState("");
  const [vcTypes, setVcTypes] = useState<VcType[]>([]);
  const [vcType, setVcType] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [authId, setAuthId] = useState<string>("");
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [stage, setStage] = useState<Stage>("lookup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [issued, setIssued] = useState<{ filename: string; issuanceId: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.vcTypes()
      .then((r) => {
        setVcTypes(r.vc_types);
        if (r.vc_types.length) setVcType(r.vc_types[0].config_id);
      })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  function reset() {
    stopPolling();
    setBeneficiary(null);
    setAuthId("");
    setStatus(null);
    setIssued(null);
    setError("");
    setStage("lookup");
    setNationalId("");
  }

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const found = await api.lookup(nationalId.trim());
      setBeneficiary(found);
      setStage(found.eligible ? "authenticate" : "lookup");
      if (!found.eligible) setError(found.reason ?? "This record cannot be issued a credential.");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function onAuthenticate() {
    if (!beneficiary) return;
    setBusy(true);
    setError("");
    try {
      const started = await api.startAuthentication(beneficiary.internal_record_id);
      setAuthId(started.authentication_id);
      // The beneficiary authenticates at the identity provider, not here. Opening
      // a separate window keeps this screen — and the agent's place in the flow —
      // intact while that happens.
      window.open(started.authorization_url, "beneficiary-auth", "width=520,height=680");
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await api.authenticationStatus(
            beneficiary.internal_record_id,
            started.authentication_id,
          );
          setStatus(s);
          if (s.authorised) {
            stopPolling();
            setStage("issue");
          }
        } catch {
          /* transient; the next tick retries */
        }
      }, 2000);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function onIssue() {
    if (!beneficiary) return;
    setBusy(true);
    setError("");
    try {
      const { blob, filename, issuanceId } = await api.issue(
        beneficiary.internal_record_id,
        authId,
        vcType || undefined,
      );
      // Hand the file to the browser so the agent can print it on whatever
      // printer the counter has.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setIssued({ filename, issuanceId });
      setStage("done");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-stack">
      <section className="card">
        <h2>1 · Find the beneficiary</h2>
        <form onSubmit={onLookup} className="row">
          <input
            aria-label="National ID"
            placeholder="National ID"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            disabled={busy || stage !== "lookup"}
            autoFocus
          />
          <button type="submit" disabled={busy || !nationalId.trim() || stage !== "lookup"}>
            Look up
          </button>
        </form>
        {beneficiary && (
          <dl className="facts">
            <dt>Record</dt>
            <dd>{beneficiary.record_name ?? beneficiary.internal_record_id}</dd>
            <dt>Status</dt>
            <dd>{beneficiary.eligible ? "Eligible" : (beneficiary.reason ?? "Not eligible")}</dd>
          </dl>
        )}
      </section>

      <section className="card" aria-disabled={stage === "lookup"}>
        <h2>2 · Beneficiary authenticates</h2>
        <p className="muted">
          The beneficiary authenticates themselves — by fingerprint at this counter, or
          with a one-time code sent to their phone. A credential cannot be issued
          without it.
        </p>
        <button onClick={onAuthenticate} disabled={busy || !beneficiary?.eligible || stage === "lookup"}>
          {authId ? "Restart authentication" : "Start authentication"}
        </button>
        {status && (
          <p className={status.authorised ? "ok" : "pending"}>
            {status.authorised
              ? `Authenticated — ${status.expires_in_seconds}s remaining to issue`
              : `Waiting… (${status.status})${status.reason ? ` — ${status.reason}` : ""}`}
          </p>
        )}
      </section>

      <section className="card" aria-disabled={stage !== "issue" && stage !== "done"}>
        <h2>3 · Issue and print</h2>
        {vcTypes.length > 1 && (
          <label>
            Credential
            <select value={vcType} onChange={(e) => setVcType(e.target.value)} disabled={busy}>
              {vcTypes.map((t) => (
                <option key={t.config_id} value={t.config_id}>
                  {t.display_name ?? t.config_id}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={onIssue} disabled={busy || stage !== "issue"}>
          Download credential
        </button>
        {issued && (
          <p className="ok">
            Downloaded <strong>{issued.filename}</strong>. Print it and hand it to the
            beneficiary.
            <br />
            <span className="muted">Issuance {issued.issuanceId}</span>
          </p>
        )}
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {(beneficiary || error) && (
        <button className="link" onClick={reset}>
          Start over
        </button>
      )}
    </div>
  );
}
