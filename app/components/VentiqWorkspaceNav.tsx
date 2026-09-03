"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

const publicPaths = new Set([
  "/",
  "/start",
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

const groups = [
  {
    title: "Setup",
    links: [
      ["Setup Control Center", "/fund-onboarding"],
      ["Data Center", "/migration"],
      ["Data Intake", "/migration/data-intake"],
      ["Activation", "/migration/activation"],
    ],
  },
  {
    title: "Dashboards",
    links: [
      ["Managing Partner", "/managing-partner-ai"],
      ["Finance", "/finance-head-ai"],
      ["Investment", "/investment-team-ai"],
      ["Compliance", "/compliance-ai"],
      ["Investor Relations", "/investor-portal"],
      ["Investor / LP", "/investor-portal"],
    ],
  },
  {
    title: "Workflows",
    links: [
      ["Debt LMS", "/debt-lms"],
      ["Bank MIS", "/bank-reconciliation"],
      ["Document Studio", "/document-studio"],
      ["Data Room & DDQ", "/data-room"],
    ],
  },
];

function roleLabel(value: string | null | undefined) {
  if (!value) return "VENTIQ User";

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function VentiqWorkspaceNav({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    session,
    profile,
    activeRole,
    fundAccess,
    signOut,
  } = useVentiqAuth();

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  const displayName =
    profile?.full_name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "VENTIQ User";

  const activeFund =
    fundAccess.find(
      (access) => access.status === "Active" && access.can_view
    )?.fund_name ||
    fundAccess[0]?.fund_name ||
    "Select fund";

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <div className="ventiq-app-frame">
      <aside
        className={`ventiq-app-sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="VENTIQ application navigation"
      >
        <div className="ventiq-sidebar-brand">
          <Link href="/launch-center" onClick={() => setMobileOpen(false)}>
            VENTIQ
          </Link>
          <span>Private Capital OS</span>
        </div>

        <Link
          className={pathname === "/launch-center" ? "ventiq-home-link active" : "ventiq-home-link"}
          href="/launch-center"
          onClick={() => setMobileOpen(false)}
        >
          <span>Launch Center</span>
          <strong aria-hidden="true">&#8962;</strong>
        </Link>

        {groups.map((group) => (
          <div className="ventiq-nav-group" key={group.title}>
            <p>{group.title}</p>
            {group.links.map(([label, href]) => (
              <Link
                className={pathname === href ? "active" : ""}
                href={href}
                key={`${group.title}-${label}`}
                onClick={() => setMobileOpen(false)}
              >
                <span>{label}</span>
                <strong aria-hidden="true">&#8594;</strong>
              </Link>
            ))}
          </div>
        ))}

        <div className="ventiq-sidebar-security">
          Navigation never expands permissions. Fund and investor access remain
          governed by the signed-in account.
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="ventiq-mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <div className="ventiq-app-main">
        <header className="ventiq-app-topbar">
          <div className="ventiq-topbar-left">
            <button
              className="ventiq-mobile-menu"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open VENTIQ navigation"
            >
              &#9776;
            </button>
            <div className="ventiq-fund-context">
              <span>Active fund</span>
              <strong>{activeFund}</strong>
            </div>
          </div>

          <div className="ventiq-account-context">
            <div>
              <strong>{displayName}</strong>
              <span>{roleLabel(activeRole)}</span>
            </div>
            <button onClick={() => void handleSignOut()} type="button">
              Sign out
            </button>
          </div>
        </header>

        <div className="ventiq-app-content">{children}</div>
      </div>

      <style jsx global>{`
        .ventiq-app-frame {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 246px minmax(0, 1fr);
          background: #030914;
          color: #f7fbff;
        }

        .ventiq-app-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 22px 16px 24px;
          background:
            linear-gradient(180deg, rgba(7, 22, 45, 0.98), rgba(3, 11, 25, 0.99));
          border-right: 1px solid rgba(121, 176, 239, 0.14);
          z-index: 8000;
        }

        .ventiq-app-sidebar::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .ventiq-sidebar-brand {
          padding: 4px 8px 20px;
          border-bottom: 1px solid rgba(121, 176, 239, 0.12);
          margin-bottom: 14px;
        }

        .ventiq-sidebar-brand a {
          display: block;
          color: #f7fbff;
          text-decoration: none;
          font-size: 21px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .ventiq-sidebar-brand span {
          display: block;
          margin-top: 4px;
          color: #7890ae;
          font-size: 11px;
          font-weight: 750;
        }

        .ventiq-home-link,
        .ventiq-nav-group a {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 10px;
          padding: 9px 10px;
          color: #cbd9eb;
          text-decoration: none;
          font-size: 13px;
          font-weight: 760;
          transition: background 0.16s ease, color 0.16s ease;
        }

        .ventiq-home-link {
          margin-bottom: 12px;
        }

        .ventiq-home-link:hover,
        .ventiq-home-link.active,
        .ventiq-nav-group a:hover,
        .ventiq-nav-group a.active {
          color: #ffffff;
          background: rgba(50, 123, 232, 0.16);
        }

        .ventiq-home-link strong,
        .ventiq-nav-group a strong {
          color: #6caeff;
        }

        .ventiq-nav-group {
          margin-top: 17px;
        }

        .ventiq-nav-group p {
          margin: 0 8px 6px;
          color: #617a99;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ventiq-sidebar-security {
          margin: 20px 6px 0;
          padding: 12px;
          border-radius: 12px;
          background: rgba(8, 30, 60, 0.56);
          border: 1px solid rgba(105, 171, 244, 0.1);
          color: #7f95b0;
          font-size: 10px;
          line-height: 1.5;
        }

        .ventiq-app-main {
          min-width: 0;
          min-height: 100vh;
          background: #030914;
        }

        .ventiq-app-topbar {
          position: sticky;
          top: 0;
          z-index: 7000;
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 10px 22px;
          background: rgba(3, 10, 23, 0.94);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(121, 176, 239, 0.12);
        }

        .ventiq-topbar-left,
        .ventiq-account-context {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ventiq-fund-context span,
        .ventiq-account-context span {
          display: block;
          color: #7189a8;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ventiq-fund-context strong,
        .ventiq-account-context strong {
          display: block;
          margin-top: 2px;
          color: #eef6ff;
          font-size: 13px;
          font-weight: 850;
        }

        .ventiq-account-context {
          text-align: right;
        }

        .ventiq-account-context button {
          border: 1px solid rgba(126, 181, 242, 0.2);
          border-radius: 10px;
          background: rgba(11, 31, 61, 0.72);
          color: #eaf4ff;
          padding: 8px 11px;
          font: inherit;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .ventiq-mobile-menu {
          display: none;
          border: 1px solid rgba(126, 181, 242, 0.2);
          border-radius: 9px;
          background: rgba(11, 31, 61, 0.72);
          color: #eaf4ff;
          width: 38px;
          height: 36px;
          cursor: pointer;
        }

        .ventiq-mobile-backdrop {
          display: none;
        }

        .ventiq-app-content {
          min-width: 0;
        }

        @media (max-width: 980px) {
          .ventiq-app-frame {
            grid-template-columns: 1fr;
          }

          .ventiq-app-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: min(286px, 86vw);
            transform: translateX(-105%);
            transition: transform 0.18s ease;
            box-shadow: 22px 0 70px rgba(0, 0, 0, 0.48);
          }

          .ventiq-app-sidebar.mobile-open {
            transform: translateX(0);
          }

          .ventiq-mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 7900;
            border: 0;
            background: rgba(0, 0, 0, 0.56);
          }

          .ventiq-mobile-menu {
            display: inline-grid;
            place-items: center;
          }

          .ventiq-app-topbar {
            padding: 9px 14px;
          }
        }

        @media (max-width: 640px) {
          .ventiq-account-context > div {
            display: none;
          }

          .ventiq-fund-context strong {
            max-width: 190px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}
