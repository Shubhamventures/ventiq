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

const PUBLIC_PATHS = new Set([
  "/",
  "/demo",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/product-overview",
  "/auth/login",
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
  const { loading, session } = useVentiqAuth();

  const [perimeterReady, setPerimeterReady] = useState(false);
  const lastTokenRef = useRef("");

  const publicRoute = useMemo(
    () => isPublicPath(pathname || "/"),
    [pathname]
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
      lastTokenRef.current === session.access_token
    ) {
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

        lastTokenRef.current = session.access_token;
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
    loading,
    pathname,
    perimeterReady,
    publicRoute,
    router,
    session?.access_token,
  ]);

  if (publicRoute) {
    return <>{children}</>;
  }

  if (loading || !session || !perimeterReady) {
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
