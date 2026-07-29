"use client";

import { FormEvent, useEffect, useState } from "react";

export default function SiteLockPage() {
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next && next.startsWith("/")) {
      setNextPath(next);
    }
  }, []);

  async function unlockSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setBusy(true);
      setMessage("Checking password...");

      const response = await fetch("/api/site-lock/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to unlock VENTIQ.");
      }

      setMessage("Unlocked. Opening VENTIQ...");
      window.location.href = nextPath || "/";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to unlock VENTIQ."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lock-page">
      <section className="lock-card">
        <div className="brand-pill">VENTIQ Private Preview</div>

        <h1>This VENTIQ workspace is locked</h1>

        <p>
          This private build contains product workflows, dashboard ideas,
          migration logic and document studio concepts. Enter the access password
          to continue.
        </p>

        <form onSubmit={unlockSite}>
          <label>
            Access password
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
            />
          </label>

          <button disabled={busy || !password.trim()} type="submit">
            {busy ? "Unlocking..." : "Unlock VENTIQ"}
          </button>
        </form>

        {message && <div className="lock-message">{message}</div>}

        <div className="lock-note">
          Private founder access only. Public walkthrough access will be enabled
          later through role-based login.
        </div>
      </section>

      <style>{`
        .lock-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at top left, rgba(184, 138, 24, 0.22), transparent 32%),
            linear-gradient(135deg, #06142d 0%, #081b3a 46%, #020617 100%);
          color: #fff;
          padding: 28px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .lock-card {
          width: 100%;
          max-width: 520px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(18px);
          border-radius: 26px;
          padding: 34px;
        }

        .brand-pill {
          display: inline-flex;
          border: 1px solid rgba(245, 199, 91, 0.5);
          color: #f4c760;
          background: rgba(154, 115, 18, 0.18);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1.05;
          letter-spacing: -0.05em;
        }

        p {
          color: #cbd5e1;
          line-height: 1.6;
          margin: 16px 0 24px;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #e5e7eb;
          font-weight: 800;
          font-size: 13px;
        }

        input {
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-radius: 14px;
          padding: 14px 15px;
          font: inherit;
          outline: none;
        }

        input::placeholder {
          color: #94a3b8;
        }

        button {
          border: 0;
          border-radius: 14px;
          padding: 14px 16px;
          font-weight: 900;
          cursor: pointer;
          background: #f4c760;
          color: #06142d;
          font-size: 15px;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .lock-message {
          margin-top: 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.08);
          color: #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          font-size: 14px;
        }

        .lock-note {
          margin-top: 22px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }
      `}</style>
    </main>
  );
}