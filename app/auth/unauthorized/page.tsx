"use client";

import { useRouter } from "next/navigation";
import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { getRoleLabel } from "../../../lib/auth/types";

export default function UnauthorizedPage() {
  const router = useRouter();
  const {
    session,
    profile,
    activeRole,
    memberships,
    fundAccess,
    signOut,
    getDefaultRoute,
  } = useVentiqAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        display: "grid",
        placeItems: "center",
        color: "#f8fbff",
        background:
          "radial-gradient(circle at top left, #0c2b55 0, #071426 44%, #030914 100%)",
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          padding: "34px",
          border: "1px solid rgba(124, 164, 220, 0.3)",
          borderRadius: "24px",
          background: "rgba(8, 20, 40, 0.9)",
        }}
      >
        <p style={{ color: "#62a8ff", fontWeight: 900, letterSpacing: "0.1em" }}>
          VENTIQ ACCESS CONTROL
        </p>
        <h1 style={{ margin: "0 0 14px", fontSize: "clamp(34px, 6vw, 58px)" }}>
          This workspace is not assigned to your account.
        </h1>
        <p style={{ color: "#c4d2e7", lineHeight: 1.7 }}>
          Your account is signed in, but the required organisation role or fund
          permission is missing.
        </p>

        <div
          style={{
            marginTop: "24px",
            padding: "18px",
            borderRadius: "16px",
            background: "rgba(4, 12, 26, 0.72)",
            lineHeight: 1.8,
          }}
        >
          <div>Email: {profile?.email || session?.user?.email || "-"}</div>
          <div>Role: {getRoleLabel(activeRole)}</div>
          <div>Organisation memberships: {memberships.length}</div>
          <div>Fund permissions: {fundAccess.length}</div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" }}>
          <button
            onClick={() => router.replace(getDefaultRoute())}
            style={{
              minHeight: "48px",
              padding: "0 18px",
              border: 0,
              borderRadius: "12px",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              background: "#276deb",
            }}
            type="button"
          >
            Open my workspace
          </button>

          <button
            onClick={handleSignOut}
            style={{
              minHeight: "48px",
              padding: "0 18px",
              border: "1px solid rgba(136, 174, 226, 0.35)",
              borderRadius: "12px",
              color: "#dbe8f8",
              fontWeight: 800,
              cursor: "pointer",
              background: "transparent",
            }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
