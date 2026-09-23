'use client';

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

import {
  ApiError,
  api,
  type AuthStatus,
  type Beneficiary,
  type VcType,
  type WalletOffer,
} from "@/api/client";

/** Stop polling eventually — the beneficiary may simply walk away. */
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type Stage = "lookup" | "authenticate" | "issue" | "done";

/**
 * How the credential reaches the citizen.
 *
 * Steps 1 and 2 -- find the beneficiary, have them authenticate -- are identical
 * either way, which is why this is one component with a mode rather than two
 * flows that would drift apart. Only the last step differs: print a PDF, or hand
 * the wallet an offer.
 */
export type DeliveryMode = "print" | "wallet";

export default function IssueFlow({ mode = "print" }: { mode?: DeliveryMode }) {
  const wallet = mode === "wallet";
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
  const [offer, setOffer] = useState<WalletOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

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
    setOffer(null);
    setSecondsLeft(0);
    setError("");
    setStage("lookup");
    setNationalId("");
  }

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const found = await api.lookup(nationalId.trim(), vcType || undefined);
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
      const started = await api.startAuthentication(
        beneficiary.internal_record_id,
        vcType || undefined,
      );
      setAuthId(started.authentication_id);

      // The beneficiary authenticates at the identity provider, not here. A
      // centred popup mirrors the registry's own ID-authentication widget — the
      // same size, because eSignet's screens (biometric capture especially) do
      // not fit a narrow window.
      const w = 1024;
      const h = 800;
      const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      const popup = window.open(
        started.authorization_url,
        "beneficiary-auth",
        `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
      );
      if (!popup) {
        setError("The authentication window was blocked. Allow popups for this site and try again.");
        setBusy(false);
        return;
      }
      popupRef.current = popup;
      popup.focus?.();

      stopPolling();
      const startedAt = Date.now();
      pollRef.current = window.setInterval(async () => {
        // Give up rather than poll forever: the beneficiary may walk away, or
        // close the window without finishing.
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          setError("Authentication timed out. Ask the beneficiary to try again.");
          return;
        }
        try {
          const s = await api.authenticationStatus(
            beneficiary.internal_record_id,
            started.authentication_id,
          );
          setStatus(s);
          if (s.authorised) {
            stopPolling();
            popupRef.current?.close?.();
            setStage("issue");
            return;
          }
        } catch {
          /* transient; the next tick retries */
        }
        // Closed without success — say so instead of spinning silently. Checked
        // after the status call so a popup that closes on completion still wins.
        if (popupRef.current?.closed) {
          stopPolling();
          setError("The authentication window was closed before it completed.");
        }
      }, 2000);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  // The offer is short-lived on purpose. Show the agent how long is left rather
  // than letting them read out a code that has already lapsed.
  useEffect(() => {
    if (!offer) return;
    setSecondsLeft(offer.expires_in);
    const t = window.setInterval(
      () => setSecondsLeft((n) => (n > 0 ? n - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(t);
  }, [offer]);

  async function onOffer() {
    if (!beneficiary) return;
    setBusy(true);
    setError("");
    try {
      setOffer(
        await api.walletOffer(
          beneficiary.internal_record_id,
          authId,
          vcType || undefined,
        ),
      );
      setStage("done");
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
        {/* The credential is chosen HERE, not at the issue step: each definition
            names the registry view the beneficiary is looked up through, so the
            choice has to be made before the lookup runs. Locked once a record is
            resolved -- changing it then would leave a record found in one view
            about to be issued against another. */}
        {vcTypes.length > 1 && (
          <label>
            Credential
            <select
              value={vcType}
              onChange={(e) => setVcType(e.target.value)}
              disabled={busy || stage !== "lookup"}
            >
              {vcTypes.map((t) => (
                <option key={t.config_id} value={t.config_id}>
                  {t.display_name ?? t.config_id}
                </option>
              ))}
            </select>
          </label>
        )}
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
        <h2>3 · {wallet ? "Hand it to their wallet" : "Issue and print"}</h2>

        {wallet ? (
          <>
            <button onClick={onOffer} disabled={busy || stage !== "issue"}>
              {offer ? "Create a new offer" : "Create wallet offer"}
            </button>

            {offer && (
              <div className="offer">
                <p className="muted">
                  Ask the beneficiary to scan this with their wallet app.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={offer.qr_png}
                  alt="Credential offer QR code"
                  className="offer-qr"
                  width={260}
                  height={260}
                />

                {/* Spoken, not printed. This code is the only thing tying the
                    offer to the person at the counter, so showing it where a
                    photograph of the screen would capture it defeats the point. */}
                <p className="offer-code">
                  Read this code aloud: <strong>{offer.tx_code}</strong>
                </p>
                <p className={secondsLeft > 30 ? "muted" : "pending"}>
                  {secondsLeft > 0
                    ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : "This offer has expired — create a new one."}
                </p>
                <p className="muted">Nothing is issued until their wallet accepts it.</p>
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
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
