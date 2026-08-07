"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useVentiqAuth } from "../../lib/auth/AuthProvider";
import type { VentiqRole } from "../../lib/auth/types";
import { useActiveFund } from "../../lib/useActiveFund";

type ProtectedWorkspaceProps = {
  children: ReactNode;
  allowedRoles: readonly VentiqRole[];
  requireFundAccess?: boolean;
};

type GateMessageProps = {
  title: string;
  message: string;
};

function GateMessage({ title, message }: GateMessageProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background:
          "radial-gradient(circle at top left, #0b2a52 0, #071426 42%, #030914 100%)",
        color: "#f8fbff",
      }}
    >
      <section
        style={{
          width: "min(680px, 100%)",
          border: "1px solid rgba(124, 164, 220, 0.3)",
          borderRadius: "24px",
          padding: "32px",
          background: "rgba(8, 20, 40, 0.88)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            color: "#62a8ff",
            fontWeight: 800,
            letterSpacing: "0.08em",
          }}
        >
          VENTIQ ACCESS CONTROL
        </p>

        <h1
          style={{
            margin: "0 0 14px",
            fontSize: "clamp(28px, 5vw, 46px)",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: 0,
            color: "#c4d2e7",
            lineHeight: 1.7,
          }}
        >
          {message}
        </p>
      </section>
    </main>
  );
}

export default function ProtectedWorkspace({
  children,
  allowedRoles,
  requireFundAccess = true,
}: ProtectedWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    activeFundName,
    isReady: fundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");

  const {
    loading,
    session,
    profile,
    activeRole,
    accessError,
    canUseRole,
    canAccessFund,
  } = useVentiqAuth();

  const signedIn = Boolean(session?.user);
  const profileIsActive = profile?.status === "Active";
  const roleAllowed = canUseRole(allowedRoles);

  const fundAllowed =
    !requireFundAccess ||
    activeRole === "fund_admin" ||
    canAccessFund(activeFundName);

  useEffect(() => {
    if (loading || !fundContextReady) {
      return;
    }

    if (!signedIn) {
      const nextRoute = encodeURIComponent(pathname || "/workspace");

      router.replace(`/auth/login?next=${nextRoute}`);
      return;
    }

    if (!profileIsActive || !roleAllowed || !fundAllowed) {
      router.replace("/auth/unauthorized");
    }
  }, [
    fundAllowed,
    fundContextReady,
    loading,
    pathname,
    profileIsActive,
    roleAllowed,
    router,
    signedIn,
  ]);

  if (loading || !fundContextReady) {
    return (
      <GateMessage
        title="Checking your VENTIQ access"
        message="Reading your authenticated session, organisation membership, role and fund permissions."
      />
    );
  }

  if (accessError) {
    return (
      <GateMessage
        title="Access configuration issue"
        message={accessError}
      />
    );
  }

  if (!signedIn) {
    return (
      <GateMessage
        title="Redirecting to sign in"
        message="A secure VENTIQ session is required for this workspace."
      />
    );
  }

  if (!profileIsActive) {
    return (
      <GateMessage
        title="Account activation required"
        message="Your VENTIQ profile is not currently active. Ask the organisation administrator to activate your account."
      />
    );
  }

  if (!roleAllowed) {
    return (
      <GateMessage
        title="Workspace permission required"
        message="Your assigned VENTIQ role does not have access to this workspace."
      />
    );
  }

  if (!fundAllowed) {
    return (
      <GateMessage
        title="Fund permission required"
        message={`Your account does not currently have access to ${activeFundName}.`}
      />
    );
  }

  return <>{children}</>;
}
