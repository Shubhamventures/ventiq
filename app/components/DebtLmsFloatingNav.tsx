"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const allowedRoutes = [
  "/finance",
  "/finance-head-ai",
  "/portfolio-intelligence",
  "/bank-reconciliation",
  "/document-studio",
  "/managing-partner-ai",
  "/investment-team-ai",
  "/debt-lms",
];

function getContextLabel(pathname: string) {
  if (pathname.startsWith("/debt-lms")) return "Debt LMS";
  if (pathname.startsWith("/finance-head-ai")) return "Finance Head";
  if (pathname.startsWith("/finance")) return "Finance Workspace";
  if (pathname.startsWith("/portfolio-intelligence")) {
    return "Portfolio Intelligence";
  }
  if (pathname.startsWith("/bank-reconciliation")) {
    return "Bank Reconciliation";
  }
  if (pathname.startsWith("/document-studio")) return "Document Studio";
  if (pathname.startsWith("/managing-partner-ai")) return "Managing Partner";
  if (pathname.startsWith("/investment-team-ai")) return "Investment Team";

  return "VENTIQ";
}

export default function DebtLmsFloatingNav() {
  const pathname = usePathname();

  const shouldShow = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!shouldShow || pathname.startsWith("/debt-lms/commercial-readiness")) {
    return null;
  }

  const contextLabel = getContextLabel(pathname);
  const isDebtLmsPage = pathname.startsWith("/debt-lms");

  return (
    <>
      <div className="debt-lms-floating-nav">
        <div>
          <span>Connected Workflow</span>
          <strong>{isDebtLmsPage ? "Commercial Pack" : "Debt LMS"}</strong>
          <p>
            {isDebtLmsPage
              ? "Client setup, operating modes and sellable module packaging"
              : `${contextLabel} → loan monitoring, receipts, notices and covenants`}
          </p>
        </div>

        <div className="debt-lms-floating-actions">
          <Link href={isDebtLmsPage ? "/debt-lms/commercial-readiness" : "/debt-lms"}>
            {isDebtLmsPage ? "Open Pack" : "Open Debt LMS"}
          </Link>

          <Link href="/debt-lms/commercial-readiness">
            {isDebtLmsPage ? "QA Checklist" : "Commercial Pack"}
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .debt-lms-floating-nav {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 80;
          width: min(410px, calc(100vw - 44px));
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          border: 1px solid rgba(245, 200, 91, 0.32);
          background: linear-gradient(
            135deg,
            rgba(8, 17, 31, 0.96),
            rgba(15, 23, 42, 0.94)
          );
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(14px);
          color: #ffffff;
          border-radius: 22px;
          padding: 15px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .debt-lms-floating-nav span {
          display: block;
          color: #f5c85b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .debt-lms-floating-nav strong {
          display: block;
          color: #ffffff;
          font-size: 17px;
          letter-spacing: -0.03em;
        }

        .debt-lms-floating-nav p {
          margin: 4px 0 0;
          color: #a9bad7;
          font-size: 12px;
          line-height: 1.35;
        }

        .debt-lms-floating-actions {
          display: grid;
          gap: 8px;
          flex-shrink: 0;
        }

        .debt-lms-floating-actions a {
          border-radius: 999px;
          padding: 9px 12px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .debt-lms-floating-actions a:first-child {
          background: #f5c85b;
          color: #07101f;
        }

        .debt-lms-floating-actions a:last-child {
          border: 1px solid rgba(147, 197, 253, 0.24);
          color: #dbeafe;
          background: rgba(15, 23, 42, 0.75);
        }

        @media (max-width: 720px) {
          .debt-lms-floating-nav {
            left: 14px;
            right: 14px;
            bottom: 14px;
            width: auto;
            flex-direction: column;
            align-items: flex-start;
          }

          .debt-lms-floating-actions {
            display: flex;
            width: 100%;
          }

          .debt-lms-floating-actions a {
            text-align: center;
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}