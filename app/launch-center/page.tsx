"use client";

import Link from "next/link";

const dashboards = [
  {
    code: "01",
    title: "Managing Partner",
    subtitle: "Executive command",
    href: "/managing-partner-ai",
    detail: "Performance, deployment, portfolio movement, risk and fund-level operating context.",
  },
  {
    code: "02",
    title: "Finance Head",
    subtitle: "Finance operations",
    href: "/finance-head-ai",
    detail: "Capital activity, reconciliations, notices, documents and finance controls.",
  },
  {
    code: "03",
    title: "Investment Team",
    subtitle: "Portfolio intelligence",
    href: "/investment-team-ai",
    detail: "Deal monitoring, valuation, portfolio company context and investment updates.",
  },
  {
    code: "04",
    title: "Compliance",
    subtitle: "Governed control",
    href: "/compliance-ai",
    detail: "Filings, evidence, approvals, due dates, exceptions and regulatory control.",
  },
  {
    code: "05",
    title: "Investor Relations",
    subtitle: "LP operations",
    href: "/investor-portal",
    detail: "Investor servicing, capital activity, statements, documents and reporting context.",
  },
  {
    code: "06",
    title: "Investor / LP",
    subtitle: "Investor experience",
    href: "/investor-portal",
    detail: "Entitled financial position, cashflows, statements and private documents.",
  },
];

const workflows = [
  ["Fund Setup", "Create and maintain the governed fund context.", "/fund-onboarding"],
  ["Data Intake", "Bring structured and historical fund data into VENTIQ.", "/migration/data-intake"],
  ["Activation", "Review readiness, approvals and activation state.", "/migration/activation"],
  ["Debt LMS", "Track borrower schedules, repayments, notices and controls.", "/debt-lms"],
  ["Bank MIS", "Process bank activity, mappings and reconciliations.", "/bank-reconciliation"],
  ["Document Studio", "Generate and govern fund and investor documents.", "/document-studio"],
  ["Data Room & DDQ", "Manage investor diligence documents and controlled access.", "/data-room"],
];

export default function LaunchCenterPage() {
  return (
    <main className="launch-page">
      <section className="launch-shell">
        <header className="launch-header">
          <div>
            <p className="eyebrow">VENTIQ LAUNCH CENTER</p>
            <h1>Open the workspace you need.</h1>
            <p>
              One governed fund context, six role-native views and the core
              operating workflows behind them.
            </p>
          </div>

          <Link className="setup-link" href="/fund-onboarding">
            Setup Control Center →
          </Link>
        </header>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">ROLE-NATIVE WORKSPACES</p>
              <h2>Dashboards</h2>
            </div>
            <p>Workspace access continues to follow the signed-in account&apos;s fund and role permissions.</p>
          </div>

          <div className="dashboard-grid">
            {dashboards.map((item) => (
              <Link className="dashboard-card" href={item.href} key={`${item.code}-${item.title}`}>
                <div className="card-meta">
                  <span>{item.code}</span>
                  <small>{item.subtitle}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <strong>Open workspace →</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OPERATING WORKFLOWS</p>
              <h2>Core modules</h2>
            </div>
          </div>

          <div className="workflow-grid">
            {workflows.map(([label, detail, href]) => (
              <Link href={href} key={href}>
                <div>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
                <b>→</b>
              </Link>
            ))}
          </div>
        </section>

        <div className="security-note">
          <strong>Governed navigation</strong>
          Opening a module never grants new access. Existing fund, role and investor entitlements continue to apply.
        </div>
      </section>

      <style jsx>{`
        .launch-page {
          min-height: calc(100vh - 62px);
          padding: 30px 28px 64px;
          color: #f7fbff;
          background:
            radial-gradient(circle at 10% 0%, rgba(38, 111, 255, 0.12), transparent 30%),
            #030914;
        }

        .launch-shell {
          width: min(1220px, 100%);
          margin: 0 auto;
        }

        .launch-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          padding: 14px 0 24px;
          border-bottom: 1px solid rgba(123, 177, 239, 0.12);
        }

        .launch-header > div {
          max-width: 760px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #68abff;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        h1 {
          margin: 0;
          font-size: clamp(34px, 4.5vw, 52px);
          line-height: 1.02;
          letter-spacing: -0.045em;
        }

        .launch-header p:not(.eyebrow) {
          margin: 12px 0 0;
          max-width: 720px;
          color: #9fb2ca;
          line-height: 1.55;
          font-size: 15px;
        }

        .setup-link {
          flex: 0 0 auto;
          color: #dcecff;
          text-decoration: none;
          border: 1px solid rgba(119, 177, 242, 0.18);
          background: rgba(10, 32, 65, 0.66);
          border-radius: 11px;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 850;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 22px;
          margin: 28px 0 14px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .section-heading > p {
          max-width: 520px;
          margin: 0;
          color: #8297b2;
          font-size: 12px;
          line-height: 1.5;
          text-align: right;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard-card {
          min-height: 205px;
          display: flex;
          flex-direction: column;
          padding: 19px;
          border-radius: 17px;
          border: 1px solid rgba(127, 185, 248, 0.14);
          background: linear-gradient(180deg, rgba(12, 34, 70, 0.76), rgba(4, 16, 35, 0.7));
          color: #eef6ff;
          text-decoration: none;
          transition: transform 0.16s ease, border-color 0.16s ease;
        }

        .dashboard-card:hover {
          transform: translateY(-2px);
          border-color: rgba(104, 171, 255, 0.38);
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .card-meta span {
          color: #79b7ff;
          font-size: 10px;
          font-weight: 950;
          padding: 5px 7px;
          border-radius: 999px;
          background: rgba(52, 126, 255, 0.12);
        }

        .card-meta small {
          color: #7890ae;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 9px;
          font-weight: 900;
        }

        .dashboard-card h3 {
          margin: 16px 0 6px;
          font-size: 20px;
          letter-spacing: -0.02em;
        }

        .dashboard-card p {
          margin: 0;
          color: #a8bbd1;
          font-size: 13px;
          line-height: 1.5;
        }

        .dashboard-card > strong {
          margin-top: auto;
          padding-top: 16px;
          color: #86c0ff;
          font-size: 12px;
        }

        .workflow-section {
          margin-top: 32px;
        }

        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .workflow-grid a {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 15px 16px;
          border-radius: 14px;
          text-decoration: none;
          color: #eaf4ff;
          background: rgba(8, 25, 52, 0.66);
          border: 1px solid rgba(125, 180, 241, 0.12);
        }

        .workflow-grid a:hover {
          border-color: rgba(104, 171, 255, 0.34);
        }

        .workflow-grid strong {
          display: block;
          font-size: 14px;
        }

        .workflow-grid span {
          display: block;
          margin-top: 4px;
          color: #879cb7;
          font-size: 11px;
          line-height: 1.45;
        }

        .workflow-grid b {
          color: #72b4ff;
        }

        .security-note {
          margin-top: 24px;
          padding: 13px 15px;
          border-radius: 13px;
          color: #8fa5bf;
          background: rgba(6, 30, 43, 0.4);
          border: 1px solid rgba(45, 212, 191, 0.12);
          font-size: 11px;
          line-height: 1.5;
        }

        .security-note strong {
          color: #dffaf6;
          margin-right: 7px;
        }

        @media (max-width: 1000px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .launch-page {
            padding: 22px 16px 48px;
          }

          .launch-header,
          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .section-heading > p {
            text-align: left;
          }

          .dashboard-grid,
          .workflow-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
