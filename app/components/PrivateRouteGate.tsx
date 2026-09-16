"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";
import { getPrivateRoutePolicy } from "../../lib/auth/privateRoutePolicy";

const PUBLIC_PATHS = new Set([
  "/",
  "/demo",
  "/start",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/product-overview",
  "/auth/login",
  "/auth/mfa",
  "/auth/set-password",
  "/auth/welcome",
  "/auth/unauthorized",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function currentDestination(pathname: string) {
  if (typeof window === "undefined") return pathname;

  return `${pathname}${window.location.search}${window.location.hash}`;
}

export default function PrivateRouteGate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    loading,
    session,
    profile,
    activeRole,
    activeFundName,
    accessError,
    canUseRole,
    canAccessFund,
  } = useVentiqAuth();

  const [perimeterReady, setPerimeterReady] = useState(false);
  const lastUserIdRef = useRef("");
  const lastAccessTokenRef = useRef("");

  const publicRoute = useMemo(
    () => isPublicPath(pathname || "/"),
    [pathname]
  );

  const routePolicy = useMemo(
    () =>
      publicRoute
        ? null
        : getPrivateRoutePolicy(pathname || "/"),
    [pathname, publicRoute]
  );

  const profileIsActive = profile?.status === "Active";
  const roleAllowed = Boolean(
    routePolicy && canUseRole(routePolicy.allowedRoles)
  );
  const fundAllowed = Boolean(
    routePolicy &&
      (!routePolicy.requireFundAccess ||
        (Boolean(activeFundName) &&
          canAccessFund(activeFundName)))
  );
  const needsFundSetup = Boolean(
    routePolicy?.requireFundAccess &&
      activeRole === "fund_admin" &&
      !activeFundName
  );

  useEffect(() => {
    if (publicRoute) {
      setPerimeterReady(true);
      return;
    }

    if (loading) {
      setPerimeterReady(false);
      return;
    }

    const destination = currentDestination(pathname || "/");

    if (!session?.access_token) {
      setPerimeterReady(false);
      lastUserIdRef.current = "";
      lastAccessTokenRef.current = "";

      void fetch("/api/auth/perimeter", {
        method: "DELETE",
        cache: "no-store",
      }).finally(() => {
        router.replace(
          `/auth/login?next=${encodeURIComponent(destination)}`
        );
      });

      return;
    }

    if (
      perimeterReady &&
      lastUserIdRef.current === session.user.id &&
      lastAccessTokenRef.current === session.access_token
    ) {
      if (needsFundSetup) {
        router.replace("/fund-onboarding");
        return;
      }

      if (
        accessError ||
        !profileIsActive ||
        !routePolicy ||
        !roleAllowed ||
        !fundAllowed
      ) {
        router.replace("/auth/unauthorized");
      }

      return;
    }

    let cancelled = false;
    setPerimeterReady(false);

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

        if (response.status === 428) {
          router.replace(
            `/auth/mfa?next=${encodeURIComponent(destination)}`
          );
          return;
        }

        if (response.status === 403) {
          router.replace("/auth/unauthorized");
          return;
        }

        if (!response.ok) {
          router.replace(
            `/auth/login?next=${encodeURIComponent(destination)}`
          );
          return;
        }

        lastUserIdRef.current = session.user.id;
        lastAccessTokenRef.current = session.access_token;
        setPerimeterReady(true);
      } catch {
        if (!cancelled) {
          router.replace(
            `/auth/login?next=${encodeURIComponent(destination)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accessError,
    fundAllowed,
    loading,
    needsFundSetup,
    pathname,
    perimeterReady,
    profileIsActive,
    publicRoute,
    roleAllowed,
    routePolicy,
    router,
    session?.access_token,
  ]);

  if (publicRoute) {
    return <>{children}</>;
  }

  if (
    loading ||
    !session ||
    !perimeterReady ||
    accessError ||
    !profileIsActive ||
    !routePolicy ||
    !roleAllowed ||
    !fundAllowed
  ) {
    return (
      <main className="ventiq-access-gate" aria-live="polite">
        <div>
          <strong>VENTIQ</strong>
          <span>Securing your workspace…</span>
        </div>

        <style jsx>{`
          .ventiq-access-gate {
            min-height: 100vh;
            display: grid;
            place-items: center;
            color: #f5f9ff;
            background:
              radial-gradient(
                circle at 50% 35%,
                rgba(30, 103, 232, 0.18),
                transparent 34%
              ),
              #020814;
          }

          .ventiq-access-gate > div {
            display: grid;
            justify-items: center;
            gap: 10px;
          }

          .ventiq-access-gate strong {
            color: #6aaeff;
            font-size: 18px;
            letter-spacing: 0.12em;
          }

          .ventiq-access-gate span {
            color: #aebfd6;
            font-size: 14px;
          }
        `}</style>
      </main>
    );
  }

  return <>{children}</>;
}
