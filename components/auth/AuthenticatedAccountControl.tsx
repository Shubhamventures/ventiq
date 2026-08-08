"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useVentiqAuth } from "../../lib/auth/AuthProvider";

function formatRole(role: string | null | undefined) {
  if (!role) return "VENTIQ User";

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AuthenticatedAccountControl() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    loading,
    session,
    profile,
    activeRole,
    signOut,
  } = useVentiqAuth();

  const [signingOut, setSigningOut] = useState(false);

  const authPage =
    pathname?.startsWith("/auth/") ||
    pathname === "/site-lock";

  if (
    loading ||
    !session?.user ||
    authPage
  ) {
    return null;
  }

  const displayName =
    profile?.full_name?.trim() ||
    session.user.email ||
    "VENTIQ User";

  const roleLabel = formatRole(activeRole);

  async function handleSignOut() {
    if (signingOut) return;

    try {
      setSigningOut(true);

      await signOut();

      router.replace("/auth/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 18,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 10px 9px 14px",
        borderRadius: 16,
        border: "1px solid rgba(124, 164, 220, 0.28)",
        background: "rgba(7, 20, 39, 0.94)",
        boxShadow: "0 14px 42px rgba(0, 0, 0, 0.26)",
        backdropFilter: "blur(14px)",
        color: "#f8fbff",
        maxWidth: "min(420px, calc(100vw - 32px))",
      }}
    >
      <div
        style={{
          minWidth: 0,
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 190,
          }}
        >
          {displayName}
        </div>

        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: "#9db2cf",
            fontWeight: 700,
          }}
        >
          {roleLabel}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        style={{
          border: "1px solid rgba(120, 164, 224, 0.35)",
          borderRadius: 11,
          padding: "8px 12px",
          background: signingOut
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.09)",
          color: signingOut ? "#8190a5" : "#f8fbff",
          fontSize: 12,
          fontWeight: 800,
          cursor: signingOut ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {signingOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
