"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { supabase } from "../../../lib/supabaseClient";

const SAFE_REDIRECT_BASE = "https://ventiq.local";

type MfaMode =
  | "checking"
  | "challenge"
  | "enroll-ready"
  | "enrolling"
  | "enroll-verify"
  | "finishing";

function sanitizeNextRoute(value: string) {
  const candidate = value.trim();

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//")
  ) {
    return "";
  }

  try {
    const url = new URL(candidate, SAFE_REDIRECT_BASE);

    if (url.origin !== SAFE_REDIRECT_BASE) {
      return "";
    }

    if (
      url.pathname.startsWith("/api") ||
      url.pathname === "/auth/login" ||
      url.pathname === "/auth/mfa"
    ) {
      return "";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

export default function MfaPage() {
  const router = useRouter();
  const { loading, session, signOut, getDefaultRoute } = useVentiqAuth();

  const [nextRoute, setNextRoute] = useState("");
  const [nextRouteReady, setNextRouteReady] = useState(false);
  const [mode, setMode] = useState<MfaMode>("checking");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState(
    "Checking your multi-factor authentication status..."
  );
  const [error, setError] = useState("");
  const initializedForUserRef = useRef("");

  useEffect(() => {
    const requestedNext =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") ?? ""
        : "";

    setNextRoute(sanitizeNextRoute(requestedNext));
    setNextRouteReady(true);
  }, []);

  const destination = useMemo(
    () => nextRoute || getDefaultRoute(),
    [getDefaultRoute, nextRoute]
  );

  const establishPerimeter = useCallback(async () => {
    const client = supabase;

    if (!client) {
      setError("Supabase is not configured.");
      return false;
    }

    const { data, error: sessionError } =
      await client.auth.getSession();

    const accessToken = data.session?.access_token ?? "";

    if (sessionError || !accessToken) {
      setError("Your authentication session is no longer available.");
      return false;
    }

    const response = await fetch("/api/auth/perimeter", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; code?: string }
      | null;

    if (!response.ok || !payload?.ok) {
      setError(
        payload?.error ||
          "VENTIQ could not establish the governed application session."
      );
      return false;
    }

    return true;
  }, []);

  useEffect(() => {
    if (loading || !nextRouteReady) {
      return;
    }

    if (!session?.user?.id) {
      router.replace(
        `/auth/login?next=${encodeURIComponent(destination)}`
      );
      return;
    }

    if (initializedForUserRef.current === session.user.id) {
      return;
    }

    initializedForUserRef.current = session.user.id;

    let cancelled = false;

    void (async () => {
      const client = supabase;

      if (!client) {
        if (!cancelled) {
          setError("Supabase is not configured.");
        }
        return;
      }

      const aal =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (cancelled) return;

      if (aal.error || !aal.data) {
        setError(
          aal.error?.message ||
            "Unable to verify your authentication level."
        );
        return;
      }

      if (aal.data.currentLevel === "aal2") {
        setMode("finishing");
        setMessage("MFA verified. Opening VENTIQ...");

        if (await establishPerimeter()) {
          router.replace(destination);
        }
        return;
      }

      const factors = await client.auth.mfa.listFactors();

      if (cancelled) return;

      if (factors.error) {
        setError(factors.error.message);
        return;
      }

      const totpFactor = factors.data.totp[0];

      if (totpFactor) {
        setFactorId(totpFactor.id);
        setMode("challenge");
        setMessage(
          "Enter the 6-digit code from your authenticator app."
        );
        return;
      }

      setMode("enroll-ready");
      setMessage(
        "Your VENTIQ role requires multi-factor authentication. Set up an authenticator app to continue."
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    destination,
    establishPerimeter,
    loading,
    nextRouteReady,
    router,
    session?.user?.id,
  ]);

  async function startEnrollment() {
    const client = supabase;

    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    setError("");
    setMode("enrolling");
    setMessage("Preparing your VENTIQ authenticator...");

    const result = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "VENTIQ Authenticator",
    });

    if (result.error) {
      setMode("enroll-ready");
      setError(result.error.message);
      return;
    }

    setFactorId(result.data.id);
    setQrCode(result.data.totp.qr_code);
    setSecret(result.data.totp.secret);
    setMode("enroll-verify");
    setMessage(
      "Scan the QR code, then enter the 6-digit code generated by your authenticator app."
    );
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;
    const code = verificationCode.replace(/\s+/g, "");

    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    if (!factorId) {
      setError("No authenticator factor is available. Please restart MFA setup.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError("");
    setMode("finishing");
    setMessage("Verifying your authenticator code...");

    const result = await client.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (result.error) {
      setMode(qrCode ? "enroll-verify" : "challenge");
      setError(result.error.message);
      return;
    }

    setMessage("MFA verified. Opening VENTIQ...");

    if (await establishPerimeter()) {
      router.replace(destination);
    } else {
      setMode(qrCode ? "enroll-verify" : "challenge");
    }
  }

  async function handleSignOut() {
    const client = supabase;

    if (client && factorId && qrCode) {
      try {
        await client.auth.mfa.unenroll({ factorId });
      } catch {
        // Best effort cleanup for an unverified enrollment.
      }
    }

    await signOut();
    router.replace("/auth/login");
  }

  const busy =
    mode === "checking" ||
    mode === "enrolling" ||
    mode === "finishing";

  return (
    <main className="ventiq-mfa-page">
      <section className="ventiq-mfa-shell">
        <div className="ventiq-mfa-story">
          <p className="ventiq-mfa-brand">VENTIQ</p>
          <p className="ventiq-mfa-eyebrow">SECURE ACCESS</p>
          <h1>Protect privileged fund access with a second factor.</h1>
          <p>
            VENTIQ requires stronger authentication for internal and privileged
            fund roles before private workspaces can open.
          </p>

          <div className="ventiq-mfa-points">
            <span>TOTP authenticator</span>
            <span>AAL2 verified session</span>
            <span>Short-lived privileged perimeter</span>
          </div>
        </div>

        <section className="ventiq-mfa-card" aria-live="polite">
          <p className="ventiq-mfa-eyebrow">MULTI-FACTOR AUTHENTICATION</p>
          <h2>Verify your VENTIQ access</h2>
          <p>{message}</p>

          {mode === "enroll-ready" && (
            <button type="button" onClick={startEnrollment}>
              Set up authenticator
            </button>
          )}

          {mode === "enroll-verify" && (
            <>
              {qrCode && (
                <div className="ventiq-qr-wrap">
                  {/* Supabase returns the TOTP QR as an image-safe data URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="VENTIQ authenticator enrollment QR code"
                    src={qrCode}
                  />
                </div>
              )}

              {secret && (
                <div className="ventiq-secret">
                  <span>Manual setup key</span>
                  <code>{secret}</code>
                </div>
              )}
            </>
          )}

          {(mode === "challenge" || mode === "enroll-verify") && (
            <form onSubmit={submitCode}>
              <label htmlFor="ventiq-mfa-code">Authenticator code</label>
              <input
                id="ventiq-mfa-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setVerificationCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="123456"
                value={verificationCode}
              />

              <button disabled={busy} type="submit">
                Verify and open VENTIQ
              </button>
            </form>
          )}

          {busy && (
            <div className="ventiq-mfa-progress">Securing your session...</div>
          )}

          {error && <div className="ventiq-mfa-error">{error}</div>}

          <button
            className="ventiq-mfa-secondary"
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </section>
      </section>

      <style jsx>{`
        .ventiq-mfa-page {
          min-height: 100vh;
          padding: 40px;
          display: grid;
          place-items: center;
          color: #f8fbff;
          background:
            radial-gradient(circle at 12% 10%, rgba(30, 108, 255, 0.28), transparent 34%),
            radial-gradient(circle at 88% 16%, rgba(52, 199, 255, 0.14), transparent 30%),
            linear-gradient(145deg, #020814, #07152b 58%, #061126);
        }

        .ventiq-mfa-shell {
          width: min(1120px, 100%);
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 56px;
          align-items: center;
        }

        .ventiq-mfa-brand,
        .ventiq-mfa-eyebrow {
          margin: 0 0 16px;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #62a8ff;
        }

        .ventiq-mfa-story h1 {
          max-width: 760px;
          margin: 0;
          font-size: clamp(42px, 6.5vw, 72px);
          line-height: 0.99;
          letter-spacing: -0.05em;
        }

        .ventiq-mfa-story > p:not(.ventiq-mfa-brand):not(.ventiq-mfa-eyebrow) {
          max-width: 660px;
          margin: 26px 0;
          color: #b9c9df;
          font-size: 18px;
          line-height: 1.7;
        }

        .ventiq-mfa-points {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .ventiq-mfa-points span {
          padding: 10px 14px;
          border: 1px solid rgba(105, 160, 230, 0.3);
          border-radius: 999px;
          color: #d8e5f7;
          background: rgba(9, 26, 52, 0.7);
        }

        .ventiq-mfa-card {
          padding: 34px;
          display: grid;
          gap: 16px;
          border: 1px solid rgba(120, 167, 226, 0.28);
          border-radius: 26px;
          background: rgba(5, 16, 34, 0.92);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.3);
        }

        .ventiq-mfa-card h2 {
          margin: 0;
          font-size: 32px;
        }

        .ventiq-mfa-card > p {
          margin: 0;
          color: #aebfd6;
          line-height: 1.6;
        }

        .ventiq-mfa-card form {
          display: grid;
          gap: 12px;
        }

        .ventiq-mfa-card label {
          font-weight: 800;
          color: #dce8f8;
        }

        .ventiq-mfa-card input {
          min-height: 52px;
          padding: 0 15px;
          border: 1px solid rgba(125, 167, 219, 0.32);
          border-radius: 13px;
          color: #fff;
          background: #071326;
          outline: none;
          font-size: 20px;
          letter-spacing: 0.18em;
        }

        .ventiq-mfa-card input:focus {
          border-color: #4b91ff;
          box-shadow: 0 0 0 3px rgba(75, 145, 255, 0.15);
        }

        .ventiq-mfa-card button {
          min-height: 52px;
          border: 0;
          border-radius: 14px;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #1f67e8, #4189ff);
        }

        .ventiq-mfa-card button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .ventiq-mfa-secondary {
          border: 1px solid rgba(136, 174, 226, 0.35) !important;
          color: #dbe8f8 !important;
          background: transparent !important;
        }

        .ventiq-qr-wrap {
          width: min(240px, 100%);
          padding: 14px;
          border-radius: 18px;
          background: #fff;
        }

        .ventiq-qr-wrap img {
          display: block;
          width: 100%;
          height: auto;
        }

        .ventiq-secret {
          display: grid;
          gap: 8px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(7, 19, 38, 0.9);
        }

        .ventiq-secret span {
          color: #aebfd6;
          font-size: 13px;
          font-weight: 800;
        }

        .ventiq-secret code {
          overflow-wrap: anywhere;
          color: #f8fbff;
          font-size: 14px;
        }

        .ventiq-mfa-progress {
          color: #aebfd6;
        }

        .ventiq-mfa-error {
          padding: 12px 14px;
          border: 1px solid rgba(255, 119, 119, 0.34);
          border-radius: 12px;
          color: #ffd0d0;
          background: rgba(93, 20, 29, 0.3);
        }

        @media (max-width: 860px) {
          .ventiq-mfa-page {
            padding: 24px;
          }

          .ventiq-mfa-shell {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .ventiq-mfa-story h1 {
            font-size: clamp(38px, 12vw, 58px);
          }
        }
      `}</style>
    </main>
  );
}
