"use client";

import { useMemo, useState } from "react";

type AdoptionModule = {
  key: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  bestFor: string;
  dataNeeded: string[];
  firstWorkflow: string;
  launchTime: string;
  workspaceHref?: string;
  financialHref?: string;
financialLabel?: string;
  expansionPath: string[];
};

const adoptionModules: AdoptionModule[] = [
  {
    key: "investor-portal",
    title: "Investor Portal First",
    shortTitle: "Investor Portal",
    subtitle: "Give LPs one secure place for statements, notices and reports.",
    bestFor:
      "Best for funds where investor servicing is still dependent on emails, folders and repeated follow-ups.",
    dataNeeded: [
      "Investor master",
      "Commitment records",
      "Capital call notices",
      "Distribution notices",
      "SOA and account statements",
      "Tax documents",
      "Investor contact details",
    ],
    firstWorkflow:
      "Upload historical investor documents and launch a self-service LP portal.",
    launchTime: "2 to 3 weeks",
    workspaceHref: "/migration/investor-portal",
    financialHref: "/migration/investor-financials",
financialLabel: "Open Financial Migration",
    expansionPath: [
      "Investor document library",
      "Capital call publishing",
      "Distribution reporting",
      "Investor query tracking",
      "Finance Head workspace",
    ],
  },
  {
    key: "data-room",
    title: "Investor Data Room First",
    shortTitle: "Data Room",
    subtitle: "Launch a controlled fundraising and DDQ workspace.",
    bestFor:
      "Best for funds actively fundraising or repeatedly answering the same LP due diligence questions.",
    dataNeeded: [
      "Fund deck",
      "PPM and offer documents",
      "Track record",
      "Portfolio summaries",
      "DDQ responses",
      "Compliance documents",
      "Quarterly reports",
    ],
    firstWorkflow:
      "Import fundraising files, classify documents and track LP engagement.",
    launchTime: "1 to 2 weeks",
    expansionPath: [
      "DDQ answer bank",
      "LP engagement analytics",
      "Investor portal",
      "Fundraising workspace",
      "Managing Partner dashboard",
    ],
  },
  {
    key: "finance-head",
    title: "Finance Head Workspace First",
    shortTitle: "Finance Workspace",
    subtitle: "Control capital calls, payments and fund operations.",
    bestFor:
      "Best for finance teams managing capital calls, reconciliations, notices and investor follow-ups manually.",
    dataNeeded: [
      "Fund master",
      "Investor commitments",
      "Capital call history",
      "Payment receipts",
      "Distribution records",
      "Bank statements",
      "Investor notices",
    ],
    firstWorkflow:
      "Run one capital call cycle with investor-wise allocations and payment tracking.",
    launchTime: "3 to 4 weeks",
    expansionPath: [
      "Capital call engine",
      "Document engine",
      "Payment tracking",
      "Investor portal",
      "Managing Partner dashboard",
    ],
  },
  {
    key: "compliance",
    title: "Compliance Dashboard First",
    shortTitle: "Compliance",
    subtitle: "Track obligations, filings and fund-level evidence.",
    bestFor:
      "Best for AIFs, GIFT City funds and private capital teams managing recurring compliance manually.",
    dataNeeded: [
      "Fund structure",
      "Regulatory calendar",
      "Past filings",
      "Compliance documents",
      "Board records",
      "Investor reporting obligations",
      "Internal approvals",
    ],
    firstWorkflow:
      "Create a fund compliance calendar with obligation status and evidence storage.",
    launchTime: "2 to 3 weeks",
    expansionPath: [
      "Compliance tracker",
      "Evidence room",
      "Finance workspace",
      "Investor reporting",
      "Managing Partner alerts",
    ],
  },
  {
    key: "managing-partner",
    title: "Managing Partner Dashboard First",
    shortTitle: "Managing Partner",
    subtitle: "Give leadership one real-time operating view.",
    bestFor:
      "Best for Managing Partners who want daily visibility without asking multiple teams for updates.",
    dataNeeded: [
      "Fund master",
      "Capital calls",
      "Distributions",
      "Portfolio summary",
      "Valuation data",
      "Cash position",
      "Open operational issues",
    ],
    firstWorkflow:
      "Connect fund-level operating data into one leadership dashboard.",
    launchTime: "3 to 5 weeks",
    expansionPath: [
      "Fund performance metrics",
      "Capital call status",
      "Data room engagement",
      "Finance workspace",
      "Full VENTIQ OS",
    ],
  },
  {
    key: "full-os",
    title: "Full VENTIQ OS",
    shortTitle: "Full OS",
    subtitle: "Migrate fund, investor, finance and compliance workflows together.",
    bestFor:
      "Best for funds ready to move from scattered spreadsheets, emails and folders to a unified operating layer.",
    dataNeeded: [
      "Investor master",
      "Fund master",
      "Commitments",
      "Capital call history",
      "Distribution history",
      "Portfolio records",
      "Compliance tracker",
      "Investor documents",
      "Data room files",
    ],
    firstWorkflow:
      "Create one unified fund data layer and activate stakeholder dashboards.",
    launchTime: "6 to 10 weeks",
    expansionPath: [
      "Finance workspace",
      "Investor portal",
      "Compliance dashboard",
      "Investment team workspace",
      "Managing Partner dashboard",
      "Investor Data Room",
    ],
  },
];

function getReadinessScore(module: AdoptionModule) {
  const baseScore = 58;
  const dataScore = Math.min(module.dataNeeded.length * 4, 28);
  const expansionScore = Math.min(module.expansionPath.length * 2, 12);

  return Math.min(baseScore + dataScore + expansionScore, 98);
}

export default function MigrationPage() {
  const [selectedKey, setSelectedKey] = useState(adoptionModules[0].key);

  const selectedModule = useMemo(() => {
    return (
      adoptionModules.find((module) => module.key === selectedKey) ||
      adoptionModules[0]
    );
  }, [selectedKey]);

  const readinessScore = getReadinessScore(selectedModule);

  return (
    <main className="migration-page">
      <style>{`
        .migration-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 32rem),
            #070d1a;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 32px;
        }

        .migration-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .migration-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 56px;
        }

        .migration-brand {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .migration-brand strong {
          font-size: 18px;
          letter-spacing: 0.18em;
        }

        .migration-brand span {
          color: #8ea4c8;
          font-size: 13px;
        }

        .migration-home {
          color: #dbeafe;
          text-decoration: none;
          border: 1px solid rgba(147, 197, 253, 0.28);
          background: rgba(15, 23, 42, 0.72);
          padding: 12px 18px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
        }

        .migration-hero {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 32px;
          align-items: stretch;
          margin-bottom: 28px;
        }

        .migration-eyebrow {
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 800;
          margin: 0 0 16px;
        }

        .migration-hero h1 {
          font-size: clamp(42px, 6vw, 76px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          margin: 0;
          max-width: 820px;
        }

        .migration-hero p {
          margin: 24px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 760px;
        }

        .migration-hero-card {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 13, 26, 0.92));
          border-radius: 28px;
          padding: 26px;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.24);
        }

        .migration-hero-card h2 {
          font-size: 26px;
          margin: 0 0 12px;
          letter-spacing: -0.03em;
        }

        .migration-hero-card p {
          margin: 0;
          color: #aebfe2;
          line-height: 1.6;
        }

        .migration-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 28px 0 34px;
        }

        .migration-stat {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 22px;
          padding: 20px;
        }

        .migration-stat span {
          display: block;
          color: #8ea4c8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .migration-stat strong {
          display: block;
          font-size: 26px;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }

        .migration-stat small {
          color: #aebfe2;
          font-size: 13px;
        }

        .migration-section {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(15, 23, 42, 0.7);
          border-radius: 30px;
          padding: 28px;
          margin-top: 24px;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.18);
        }

        .migration-section-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-end;
          margin-bottom: 22px;
        }

        .migration-section h2 {
          font-size: 34px;
          margin: 0;
          letter-spacing: -0.04em;
        }

        .migration-section p {
          color: #bfd0ef;
          line-height: 1.6;
        }

        .module-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .module-card {
          text-align: left;
          cursor: pointer;
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(7, 12, 24, 0.78);
          color: #f8fbff;
          border-radius: 24px;
          padding: 22px;
          min-height: 210px;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .module-card:hover {
          transform: translateY(-3px);
          border-color: rgba(96, 165, 250, 0.55);
          background: rgba(12, 27, 55, 0.85);
        }

        .module-card.active {
          border-color: rgba(96, 165, 250, 0.9);
          background: linear-gradient(180deg, rgba(30, 64, 175, 0.45), rgba(8, 13, 26, 0.82));
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.18);
        }

        .module-pill {
          display: inline-flex;
          color: #bfdbfe;
          border: 1px solid rgba(96, 165, 250, 0.35);
          background: rgba(37, 99, 235, 0.18);
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 18px;
        }

        .module-card h3 {
          color: #ffffff;
          margin: 0 0 10px;
          font-size: 21px;
          letter-spacing: -0.02em;
        }

        .module-card p {
          color: #c7d7f4;
          margin: 0 0 16px;
          font-size: 14px;
          line-height: 1.55;
        }

        .module-card small {
          color: #78a8ff;
          font-weight: 800;
        }

        .migration-detail-grid {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 20px;
          margin-top: 24px;
        }

        .detail-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(8, 13, 26, 0.82);
          border-radius: 26px;
          padding: 26px;
        }

        .detail-card h3 {
          font-size: 30px;
          margin: 0 0 14px;
          letter-spacing: -0.04em;
        }

        .detail-card p {
          color: #c7d7f4;
        }

        .highlight-box {
          border: 1px solid rgba(96, 165, 250, 0.4);
          background: rgba(30, 64, 175, 0.22);
          border-radius: 22px;
          padding: 20px;
          color: #dbeafe;
          line-height: 1.6;
          margin: 22px 0;
        }

        .mini-stat-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .mini-stat {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 18px;
          padding: 16px;
        }

        .mini-stat span {
          display: block;
          color: #8ea4c8;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .mini-stat strong {
          display: block;
          font-size: 24px;
        }

        .data-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .data-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.62);
          border-radius: 18px;
          padding: 14px;
        }

        .data-number {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.22);
          color: #93c5fd;
          font-size: 12px;
          font-weight: 900;
          flex: 0 0 auto;
        }

        .data-item strong {
          display: block;
          font-size: 15px;
          margin-bottom: 4px;
        }

        .data-item span {
          color: #91a7ca;
          font-size: 13px;
        }

        .expansion-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-top: 22px;
        }

        .expansion-card {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(7, 12, 24, 0.82);
          border-radius: 22px;
          padding: 18px;
        }

        .expansion-card span {
          color: #60a5fa;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .expansion-card strong {
          display: block;
          margin: 12px 0 8px;
          font-size: 17px;
        }

        .expansion-card p {
          margin: 0;
          font-size: 13px;
          color: #9eb2d4;
        }

        .pilot-box {
          border: 1px solid rgba(96, 165, 250, 0.4);
          background:
            linear-gradient(90deg, rgba(30, 64, 175, 0.28), rgba(14, 165, 233, 0.12)),
            rgba(15, 23, 42, 0.7);
          border-radius: 24px;
          padding: 24px;
          color: #dbeafe;
          line-height: 1.7;
        }

        .migration-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        .primary-action,
        .secondary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
        }

        .primary-action {
          background: #ffffff;
          color: #071022;
        }

        .secondary-action {
          border: 1px solid rgba(147, 197, 253, 0.22);
          color: #dbeafe;
          background: rgba(15, 23, 42, 0.72);
        }

        @media (max-width: 980px) {
          .migration-page {
            padding: 20px;
          }

          .migration-hero,
          .migration-detail-grid {
            grid-template-columns: 1fr;
          }

          .migration-stat-grid,
          .module-grid,
          .data-list,
          .expansion-grid {
            grid-template-columns: 1fr;
          }

          .migration-section-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="migration-shell">
        <nav className="migration-nav">
          <div className="migration-brand">
            <strong>VENTIQ</strong>
            <span>Private Capital Operating System</span>
          </div>

          <a className="migration-home" href="/">
            Back to Home
          </a>
        </nav>

        <section className="migration-hero">
          <div>
            <p className="migration-eyebrow">Migration and modular adoption</p>
            <h1>Start with one dashboard. Expand into the full VENTIQ OS.</h1>
            <p>
              VENTIQ helps private capital firms launch one high-impact module
              first, migrate existing fund and investor data, and expand into a
              unified operating layer when the team is ready.
            </p>
          </div>

          <div className="migration-hero-card">
            <p className="migration-eyebrow">Commercial pilot model</p>
            <h2>No full replacement on day one.</h2>
            <p>
              Land with Investor Portal, Data Room, Finance Workspace,
              Compliance Dashboard or Managing Partner Dashboard. Then connect
              the next workflow into the same source of truth.
            </p>
          </div>
        </section>

        <section className="migration-stat-grid">
          <div className="migration-stat">
            <span>Adoption model</span>
            <strong>Modular</strong>
            <small>Start with one dashboard</small>
          </div>

          <div className="migration-stat">
            <span>Legacy data</span>
            <strong>Upload</strong>
            <small>Excel, PDFs and reports</small>
          </div>

          <div className="migration-stat">
            <span>First workflow</span>
            <strong>Launch</strong>
            <small>Then expand gradually</small>
          </div>

          <div className="migration-stat">
            <span>End state</span>
            <strong>Full OS</strong>
            <small>One fund data layer</small>
          </div>
        </section>

        <section className="migration-section">
          <div className="migration-section-header">
            <div>
              <p className="migration-eyebrow">Commercial onboarding path</p>
              <h2>Choose the first module to launch</h2>
            </div>
            <p>
              Each fund can begin with one focused use case and gradually move
              into a unified data operating layer.
            </p>
          </div>

          <div className="module-grid">
          {adoptionModules.map((module) => (
  <button
    className={
      selectedModule.key === module.key
        ? "module-card active"
        : "module-card"
    }
    key={module.key}
    onClick={() => {
      if (module.workspaceHref) {
        window.location.href = module.workspaceHref;
        return;
      }

      setSelectedKey(module.key);
    }}
    type="button"
  >
                <span className="module-pill">Start here</span>
                <h3>{module.title}</h3>
                <p>{module.subtitle}</p>
                <small>{module.launchTime} launch path</small>
              </button>
            ))}
          </div>
        </section>

        <section className="migration-detail-grid">
          <div className="detail-card">
            <p className="migration-eyebrow">Selected adoption path</p>
            <h3>{selectedModule.title}</h3>
            <p>{selectedModule.bestFor}</p>

            <div className="highlight-box">
              <strong>First workflow:</strong> {selectedModule.firstWorkflow}
            </div>

            <div className="mini-stat-row">
              <div className="mini-stat">
                <span>Estimated launch</span>
                <strong>{selectedModule.launchTime}</strong>
              </div>

              <div className="mini-stat">
                <span>Readiness score</span>
                <strong>{readinessScore}%</strong>
              </div>
            </div>
           {(selectedModule.workspaceHref || selectedModule.financialHref) && (
  <div className="migration-actions">
    {selectedModule.workspaceHref && (
      <a className="primary-action" href={selectedModule.workspaceHref}>
        Open Document Migration
      </a>
    )}

    {selectedModule.financialHref && (
      <a className="primary-action secondary-action" href={selectedModule.financialHref}>
        {selectedModule.financialLabel ?? "Open Financial Migration"}
      </a>
    )}
  </div>
)}
          </div>

          <div className="detail-card">
            <p className="migration-eyebrow">Legacy data required</p>
            <h3>What the client needs to provide</h3>
            <p>
              VENTIQ maps spreadsheets, documents and historical fund records
              into a structured operating layer.
            </p>

            <div className="data-list">
              {selectedModule.dataNeeded.map((item, index) => (
                <div className="data-item" key={item}>
                  <div className="data-number">{index + 1}</div>
                  <div>
                    <strong>{item}</strong>
                    <span>Required for {selectedModule.shortTitle}.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="migration-section">
          <div className="migration-section-header">
            <div>
              <p className="migration-eyebrow">Expansion path</p>
              <h2>From one module to one operating system</h2>
            </div>
            <p>
              Land with one urgent workflow, then expand into a full private
              capital operating system.
            </p>
          </div>

          <div className="expansion-grid">
            {selectedModule.expansionPath.map((step, index) => (
              <div className="expansion-card" key={step}>
                <span>Step {index + 1}</span>
                <strong>{step}</strong>
                <p>Adds more data into the same VENTIQ operating layer.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="migration-section">
          <p className="migration-eyebrow">Commercial pilot message</p>
          <h2>How VENTIQ should be sold initially</h2>
          <p>
            Position VENTIQ as a limited guided pilot for private capital firms
            that want to modernize fund operations without replacing every
            system on day one.
          </p>

          <div className="pilot-box">
            <strong>Suggested pitch:</strong> We help private capital firms
            launch one high-impact dashboard first using their existing
            historical data. Once the first workflow is live, VENTIQ expands
            into the full fund operating system.
          </div>

          <div className="migration-actions">
            <a className="primary-action" href="/data-room">
              View Data Room
            </a>
            <a className="secondary-action" href="/capital-call">
              View Capital Call Engine
            </a>
            <a className="secondary-action" href="/finance-head-ai">
              View Finance Workspace
            </a>
            <a className="secondary-action" href="/migration/investor-financials">
  View Financial Migration
</a>
          </div>
        </section>
      </div>
    </main>
  );
}
