"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useVentiqAuth } from "../../../lib/auth/AuthProvider";

const SAFE_REDIRECT_BASE = "https://ventiq.local";

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
      url.pathname === "/site-lock"
    ) {
      return "";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const {
    configured,
    loading,
    session,
    signIn,
    getDefaultRoute,
    accessError,
  } = useVentiqAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextRoute, setNextRoute] = useState("");
  const [nextRouteReady, setNextRouteReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [message, setMessage] = useState("");

  const bridgeTokenRef = useRef("");

  useEffect(() => {
    const requestedNext =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") ?? ""
        : "";

    setNextRoute(sanitizeNextRoute(requestedNext));
    setNextRouteReady(true);
  }, []);

  useEffect(() => {
    if (
      !nextRouteReady ||
      loading ||
      !session?.access_token ||
      bridgeTokenRef.current === session.access_token
    ) {
      return;
    }

    let cancelled = false;
    bridgeTokenRef.current = session.access_token;
    setBridging(true);
    setMessage("Verifying your VENTIQ application access...");

    void (async () => {
      try {
        const response = await fetch("/api/auth/perimeter", {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (cancelled) return;

        if (response.status === 403) {
          router.replace("/auth/unauthorized");
          return;
        }

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;

          bridgeTokenRef.current = "";
          setMessage(
            result?.error ||
              "Unable to establish secure VENTIQ application access."
          );
          setSubmitting(false);
          setBridging(false);
          return;
        }

        router.replace(nextRoute || getDefaultRoute());
      } catch {
        if (!cancelled) {
          bridgeTokenRef.current = "";
          setMessage(
            "Unable to establish secure VENTIQ application access."
          );
          setSubmitting(false);
          setBridging(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getDefaultRoute,
    loading,
    nextRoute,
    nextRouteReady,
    router,
    session?.access_token,
  ]);

  const buttonLabel = useMemo(() => {
    if (loading) return "Checking session...";
    if (submitting) return "Signing in...";
    if (bridging) return "Opening VENTIQ...";
    return "Sign in to VENTIQ";
  }, [bridging, loading, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }

    setSubmitting(true);

    const result = await signIn({ email, password });

    if (result.error) {
      setMessage(result.error);
      setSubmitting(false);
      return;
    }

    setMessage("Signed in. Loading your role and fund access...");
  }

  return (
    <main className="ventiq-login-page">
      <section className="ventiq-login-shell">
        <div className="ventiq-login-story">
          <p className="ventiq-login-brand">VENTIQ</p>
          <p className="ventiq-login-eyebrow">
            One fund · Six stakeholders · One source of truth
          </p>
          <h1>Secure access to your private capital operating system.</h1>
          <p>
            Sign in to open your assigned dashboard, active funds, approvals,
            documents and workflows.
          </p>

          <div className="ventiq-login-points">
            <span>Role-specific workspace</span>
            <span>Fund-level permission</span>
            <span>Investor-specific access</span>
            <span>Maker-checker control</span>
          </div>
        </div>

        <form className="ventiq-login-card" onSubmit={handleSubmit}>
          <p className="ventiq-login-eyebrow">VENTIQ ACCESS</p>
          <h2>Welcome back</h2>
          <p>Use the account created for your VENTIQ organisation.</p>

          <label htmlFor="ventiq-email">Email address</label>
          <input
            id="ventiq-email"
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@fund.com"
            type="email"
            value={email}
          />

          <label htmlFor="ventiq-password">Password</label>
          <input
            id="ventiq-password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            type="password"
            value={password}
          />

          {!configured && (
            <div className="ventiq-login-message error">
              Supabase environment variables are not configured.
            </div>
          )}

          {(message || accessError) && (
            <div className="ventiq-login-message">
              {message || accessError}
            </div>
          )}

          <button
            disabled={!configured || loading || submitting || bridging}
            type="submit"
          >
            {buttonLabel}
          </button>

          <a href="/">Back to public VENTIQ site</a>
        </form>
      </section>

      <style jsx>{`
        .ventiq-login-page {
          min-height: 100vh;
          padding: 40px;
          display: grid;
          place-items: center;
          color: #f8fbff;
          background:
            radial-gradient(
              circle at 12% 10%,
              rgba(30, 108, 255, 0.28),
              transparent 34%
            ),
            radial-gradient(
              circle at 88% 16%,
              rgba(52, 199, 255, 0.14),
              transparent 30%
            ),
            linear-gradient(145deg, #020814, #07152b 58%, #061126);
        }

        .ventiq-login-shell {
          width: min(1120px, 100%);
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 56px;
          align-items: center;
        }

        .ventiq-login-brand,
        .ventiq-login-eyebrow {
          margin: 0 0 16px;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #62a8ff;
        }

        .ventiq-login-brand {
          font-size: 20px;
        }

        .ventiq-login-story h1 {
          max-width: 780px;
          margin: 0;
          font-size: clamp(44px, 7vw, 78px);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .ventiq-login-story
          > p:not(.ventiq-login-brand):not(.ventiq-login-eyebrow) {
          max-width: 680px;
          margin: 26px 0;
          color: #b9c9df;
          font-size: 19px;
          line-height: 1.75;
        }

        .ventiq-login-points {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .ventiq-login-points span {
          padding: 10px 14px;
          border: 1px solid rgba(105, 160, 230, 0.3);
          border-radius: 999px;
          color: #d8e5f7;
          background: rgba(9, 26, 52, 0.7);
        }

        .ventiq-login-card {
          padding: 34px;
          display: grid;
          gap: 14px;
          border: 1px solid rgba(120, 167, 226, 0.28);
          border-radius: 26px;
          background: rgba(5, 16, 34, 0.9);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.3);
        }

        .ventiq-login-card h2 {
          margin: 0;
          font-size: 34px;
        }

        .ventiq-login-card > p {
          margin: 0 0 8px;
          color: #aebfd6;
          line-height: 1.6;
        }

        .ventiq-login-card label {
          margin-top: 4px;
          font-weight: 750;
          color: #dce8f8;
        }

        .ventiq-login-card input {
          width: 100%;
          min-height: 52px;
          box-sizing: border-box;
          padding: 0 15px;
          border: 1px solid rgba(125, 167, 219, 0.32);
          border-radius: 13px;
          color: #ffffff;
          background: #071326;
          outline: none;
        }

        .ventiq-login-card input:focus {
          border-color: #4b91ff;
          box-shadow: 0 0 0 3px rgba(75, 145, 255, 0.15);
        }

        .ventiq-login-card button {
          min-height: 54px;
          margin-top: 8px;
          border: 0;
          border-radius: 14px;
          color: #ffffff;
          font-weight: 900;
          font-size: 16px;
          cursor: pointer;
          background: linear-gradient(135deg, #1f67e8, #4189ff);
        }

        .ventiq-login-card button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .ventiq-login-card a {
          color: #93bfff;
          text-align: center;
          text-decoration: none;
        }

        .ventiq-login-message {
          padding: 12px 14px;
          border: 1px solid rgba(250, 194, 84, 0.35);
          border-radius: 12px;
          color: #ffe3a3;
          background: rgba(113, 70, 0, 0.24);
        }

        .ventiq-login-message.error {
          border-color: rgba(255, 107, 107, 0.38);
          color: #ffc4c4;
          background: rgba(104, 18, 30, 0.25);
        }

        @media (max-width: 880px) {
          .ventiq-login-page {
            padding: 24px;
          }

          .ventiq-login-shell {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .ventiq-login-story h1 {
            font-size: clamp(42px, 12vw, 64px);
          }
        }
      `}</style>
    </main>
  );
}
