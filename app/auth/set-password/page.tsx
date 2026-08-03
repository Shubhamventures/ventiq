"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("/fund-onboarding");
  const [stakeholderId, setStakeholderId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Checking invite session...");

  useEffect(() => {
    async function prepareInviteSession() {
      const params = new URLSearchParams(window.location.search);

      const requestedNext = params.get("next") || "/fund-onboarding";
      const requestedStakeholderId = params.get("stakeholder") || "";

      setNextPath(
        requestedNext.startsWith("/") ? requestedNext : "/fund-onboarding"
      );
      setStakeholderId(requestedStakeholderId);

      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured.");
        setChecking(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setMessage(
            "Invite session not found. Open this page from the latest invite email. If the invite expired, ask admin to resend it."
          );
          setChecking(false);
          return;
        }

        setEmail(user.email || "");
      } else {
        setEmail(session.user.email || "");
      }

      setMessage("Invite verified. Please set your password.");
      setChecking(false);
    }

    prepareInviteSession();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setMessage("Invite verified. Please set your password.");
        setChecking(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      const now = new Date().toISOString();

      if (stakeholderId) {
        await supabase
          .from("ventiq_stakeholders")
          .update({
            invite_status: "Activated",
            activated_at: now,
            last_password_set_at: now,
            access_status: "Active",
          })
          .eq("id", stakeholderId);

        await supabase.from("ventiq_access_audit_logs").insert({
          stakeholder_id: stakeholderId,
          event_type: "Password Set",
          event_title: "Stakeholder password set",
          event_description:
            "Stakeholder completed invite setup and created their password.",
          actor_name: email || "Invited User",
          actor_email: email || "",
        });
      }

      setMessage("Password set successfully. Redirecting...");
      router.push(nextPath);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to set password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="set-password-page">
      <style>{`
        .set-password-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          display: grid;
          place-items: center;
          padding: 34px;
        }

        .password-card {
          width: min(760px, 100%);
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.82);
          border-radius: 32px;
          padding: 38px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
        }

        .eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 950;
          margin: 0 0 14px;
        }

        h1 {
          margin: 0;
          font-size: clamp(40px, 6vw, 72px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .copy {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 17px;
          line-height: 1.65;
        }

        .form-grid {
          display: grid;
          gap: 14px;
          margin-top: 26px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field label {
          color: #c7d7f4;
          font-size: 12px;
          font-weight: 950;
        }

        .field input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(2, 6, 23, 0.34);
          color: #ffffff;
          border-radius: 16px;
          padding: 14px 15px;
          outline: none;
          font: inherit;
          font-size: 16px;
        }

        .primary-button {
          margin-top: 8px;
          border: 0;
          border-radius: 999px;
          background: #f5c85b;
          color: #07101f;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          width: fit-content;
          min-width: 220px;
        }

        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .message {
          margin-top: 16px;
          color: #bbf7d0;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.5;
        }

        .warning {
          margin-top: 16px;
          border: 1px solid rgba(245, 200, 91, 0.24);
          background: rgba(245, 200, 91, 0.1);
          color: #fde68a;
          border-radius: 18px;
          padding: 14px;
          line-height: 1.5;
          font-size: 14px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .meta-card {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(2, 6, 23, 0.24);
          border-radius: 18px;
          padding: 14px;
        }

        .meta-card span {
          display: block;
          color: #9db3d7;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .meta-card strong {
          color: #ffffff;
          word-break: break-word;
        }

        @media (max-width: 720px) {
          .meta-grid {
            grid-template-columns: 1fr;
          }

          .primary-button {
            width: 100%;
          }
        }
      `}</style>

      <section className="password-card">
        <p className="eyebrow">VENTIQ Secure Access</p>
        <h1>Set your password</h1>
        <p className="copy">
          Complete your VENTIQ invite setup. After setting your password, you
          will be routed to your assigned role-based workspace.
        </p>

        <div className="meta-grid">
          <div className="meta-card">
            <span>Email</span>
            <strong>{email || "Checking invite..."}</strong>
          </div>

          <div className="meta-card">
            <span>Assigned Workspace</span>
            <strong>{nextPath}</strong>
          </div>
        </div>

        <form className="form-grid" onSubmit={submitPassword}>
          <div className="field">
            <label>New Password</label>
            <input
              disabled={checking || saving}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="field">
            <label>Confirm Password</label>
            <input
              disabled={checking || saving}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
            />
          </div>

          <button
            className="primary-button"
            disabled={checking || saving}
            type="submit"
          >
            {saving ? "Saving..." : "Set Password & Continue"}
          </button>
        </form>

        <div className="message">{message}</div>

        <div className="warning">
          VENTIQ does not share passwords manually. Each stakeholder creates
          their own password from a secure invite link.
        </div>
      </section>
    </main>
  );
}