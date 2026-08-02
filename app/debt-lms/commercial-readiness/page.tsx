import Link from "next/link";

const operatingModes = [
  {
    title: "Manual Servicing Mode",
    tag: "Entry mode",
    description:
      "For fund managers who want structured loan monitoring without using automated bank reconciliation initially.",
    points: [
      "Manual receipt update with principal, interest, fees, penalty and other amount breakup",
      "Auto pending amount calculation",
      "Repayment notice and email queue generation",
      "Overdue and default review workflow",
    ],
  },
  {
    title: "Bank Reconciliation Sync Mode",
    tag: "Connected mode",
    description:
      "For clients using VENTIQ Bank MIS / Bank Reconciliation as the source of truth for receipts.",
    points: [
      "Approved bank receipts sync into Debt LMS",
      "Component-wise receipt allocation",
      "Repayment schedule status update",
      "Daily collection control and exception tracking",
    ],
  },
  {
    title: "Term Sheet Extraction Mode",
    tag: "Document-led onboarding",
    description:
      "For clients who want loan master and covenant setup to start from uploaded sanction letters or term sheets.",
    points: [
      "Upload term sheet or facility document",
      "Review extracted loan terms",
      "Create loan master and repayment structure",
      "Create covenant and security tracker rows",
    ],
  },
  {
    title: "Full Debt Fund OS Mode",
    tag: "Complete module",
    description:
      "For private credit, venture debt and structured credit funds that want an end-to-end servicing layer.",
    points: [
      "Loan master, repayment schedule, receipts and notices",
      "Covenant, breach, waiver and security tracking",
      "Bank reconciliation sync",
      "Default monitoring and fund-level control view",
    ],
  },
];

const dataChecklist = [
  "Borrower name, group, finance contact and escalation contact",
  "Fund name, instrument type, sanction amount and disbursed amount",
  "Disbursement date, repayment start date, maturity date and tenure",
  "Coupon rate, interest frequency, principal frequency and moratorium terms",
  "Processing fee, exit fee, penal interest rate and other fee clauses",
  "Security details, charge creation requirements, ROC / trustee documentation",
  "Covenants, reporting obligations, evidence requirements and due dates",
  "Bank receipt source: manual update or Bank Reconciliation sync",
];

const implementationSteps = [
  {
    step: "01",
    title: "Setup Loan Master",
    detail:
      "Capture borrower, facility, repayment, contact, fee, security and fund mapping details.",
  },
  {
    step: "02",
    title: "Generate Schedule",
    detail:
      "Create repayment rows with principal, interest, fee, penalty and pending amount tracking.",
  },
  {
    step: "03",
    title: "Track Receipts",
    detail:
      "Update receipts manually or sync approved receipts from Bank Reconciliation.",
  },
  {
    step: "04",
    title: "Generate Notices",
    detail:
      "Create reminder, penalty, overdue and default notices from unpaid repayment rows.",
  },
  {
    step: "05",
    title: "Monitor Covenants",
    detail:
      "Track reporting, financial, negative and security covenants with breach and waiver status.",
  },
  {
    step: "06",
    title: "Review Default Risk",
    detail:
      "Apply penalty, calculate days past due and move cases to overdue or default watch.",
  },
];

const demoStories = [
  "Create a new debt loan from manual entry or term sheet review.",
  "Generate repayment schedule for the borrower.",
  "Update receipt with principal and interest breakup.",
  "Show pending amount automatically calculated.",
  "Generate reminder or penalty notice.",
  "Queue email for dispatch.",
  "Sync approved receipt from Bank Reconciliation.",
  "Mark covenant as breached and generate covenant notice.",
  "Update security / charge / ROC / trustee status.",
  "Show final Debt LMS control view to Finance Head / Managing Partner.",
];

const qaChecklist = [
  "Add New Loan works",
  "Generate Repayment Schedule works",
  "Manual Receipt Update works",
  "Bank Reconciliation Sync works",
  "Generate Reminder Notices works",
  "Email Queue works",
  "Apply Penalty / Default Review works",
  "Upload Term Sheet review works",
  "Add / Update Covenant works",
  "Add / Update Security Item works",
  "Floating access navigation works from connected modules",
];

export default function DebtLmsCommercialReadinessPage() {
  return (
    <main className="readiness-page">
      <style>{`
        .readiness-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.16), transparent 32rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .readiness-shell {
          max-width: 1240px;
          margin: 0 auto;
        }

        .readiness-hero {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.78);
          border-radius: 32px;
          padding: 34px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
          margin-bottom: 22px;
        }

        .readiness-hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
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
          font-size: clamp(42px, 6vw, 74px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .hero-copy {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 820px;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primary-link,
        .secondary-link {
          border-radius: 999px;
          padding: 12px 17px;
          font-size: 14px;
          font-weight: 950;
          text-decoration: none;
          white-space: nowrap;
        }

        .primary-link {
          background: #f5c85b;
          color: #07101f;
        }

        .secondary-link {
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
        }

        .readiness-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .metric-card,
        .panel,
        .mode-card,
        .step-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.74);
          border-radius: 24px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
        }

        .metric-card {
          padding: 20px;
        }

        .metric-card span {
          display: block;
          color: #9db3d7;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .metric-card strong {
          display: block;
          font-size: 25px;
          letter-spacing: -0.04em;
        }

        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .panel-header p {
          margin: 8px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

        .mode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .mode-card {
          padding: 20px;
        }

        .mode-tag {
          display: inline-flex;
          border-radius: 999px;
          background: rgba(245, 200, 91, 0.14);
          border: 1px solid rgba(245, 200, 91, 0.28);
          color: #fde68a;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 14px;
        }

        .mode-card h3,
        .step-card h3 {
          margin: 0;
          font-size: 20px;
        }

        .mode-card p,
        .step-card p {
          color: #c7d7f4;
          line-height: 1.55;
        }

        .mode-card ul,
        .check-list {
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .mode-card li,
        .check-list li {
          color: #dbeafe;
          line-height: 1.45;
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.26);
          border-radius: 14px;
          padding: 11px 12px;
        }

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .step-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .step-card {
          padding: 18px;
        }

        .step-card span {
          color: #f5c85b;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .commercial-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 780px;
        }

        th,
        td {
          padding: 15px;
          text-align: left;
          border-bottom: 1px solid rgba(147, 197, 253, 0.12);
          vertical-align: top;
        }

        th {
          color: #9db3d7;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        td {
          color: #eaf2ff;
          line-height: 1.45;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .go-live-box {
          border: 1px solid rgba(34, 197, 94, 0.26);
          background: rgba(22, 163, 74, 0.12);
          color: #bbf7d0;
          border-radius: 24px;
          padding: 22px;
          margin-top: 18px;
        }

        .go-live-box h2 {
          margin: 0 0 10px;
          letter-spacing: -0.04em;
        }

        .go-live-box p {
          margin: 0;
          line-height: 1.6;
        }

        @media (max-width: 980px) {
          .readiness-hero-top,
          .panel-header {
            flex-direction: column;
          }

          .readiness-grid,
          .mode-grid,
          .two-col,
          .step-grid {
            grid-template-columns: 1fr;
          }

          .hero-actions {
            justify-content: flex-start;
          }
        }
      `}</style>

      <section className="readiness-shell">
        <div className="readiness-hero">
          <div className="readiness-hero-top">
            <div>
              <p className="eyebrow">VENTIQ Debt LMS</p>
              <h1>Commercial Readiness Pack</h1>
              <p className="hero-copy">
                A sellable Debt Fund Loan Monitoring and Servicing module for
                private credit, venture debt and structured credit funds. It
                connects loan onboarding, repayment schedules, receipts,
                notices, covenants, security tracking, bank reconciliation sync
                and default monitoring into one operating layer.
              </p>
            </div>

            <div className="hero-actions">
              <Link className="primary-link" href="/debt-lms">
                Open Debt LMS
              </Link>
              <Link className="secondary-link" href="/finance-head-ai">
                Finance Head View
              </Link>
            </div>
          </div>

          <div className="readiness-grid">
            <div className="metric-card">
              <span>Module type</span>
              <strong>Debt servicing OS</strong>
            </div>

            <div className="metric-card">
              <span>Best fit</span>
              <strong>Private credit</strong>
            </div>

            <div className="metric-card">
              <span>Adoption model</span>
              <strong>Modular</strong>
            </div>

            <div className="metric-card">
              <span>Demo status</span>
              <strong>V1 ready</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Operating Modes</h2>
              <p>
                Debt LMS can be sold as a standalone servicing module or as part
                of the wider VENTIQ operating system.
              </p>
            </div>
          </div>

          <div className="mode-grid">
            {operatingModes.map((mode) => (
              <div className="mode-card" key={mode.title}>
                <span className="mode-tag">{mode.tag}</span>
                <h3>{mode.title}</h3>
                <p>{mode.description}</p>

                <ul>
                  {mode.points.map((point) => (
                    <li key={point}>✓ {point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Client Data Required</h2>
                <p>
                  This is the implementation checklist needed to activate the
                  module for a client.
                </p>
              </div>
            </div>

            <ul className="check-list">
              {dataChecklist.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Demo Storyline</h2>
                <p>
                  Use this walkthrough for stakeholder demos, investor feedback
                  calls and client discovery meetings.
                </p>
              </div>
            </div>

            <ul className="check-list">
              {demoStories.map((item) => (
                <li key={item}>→ {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Implementation Flow</h2>
              <p>
                The module is now structured like a real implementation journey,
                not just a dashboard.
              </p>
            </div>
          </div>

          <div className="step-grid">
            {implementationSteps.map((item) => (
              <div className="step-card" key={item.step}>
                <span>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Commercial Packaging</h2>
              <p>
                Use these package labels during conversations. Do not price yet;
                first validate buyer interest and scope.
              </p>
            </div>
          </div>

          <div className="commercial-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Ideal client</th>
                  <th>Included workflows</th>
                  <th>Upsell path</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>
                    <strong>Debt LMS Starter</strong>
                  </td>
                  <td>Small debt fund or single strategy fund</td>
                  <td>
                    Loan master, repayment schedule, manual receipt update,
                    notices and basic covenant tracker.
                  </td>
                  <td>Bank reconciliation sync and term sheet extraction.</td>
                </tr>

                <tr>
                  <td>
                    <strong>Debt LMS Plus</strong>
                  </td>
                  <td>Private credit / venture debt manager</td>
                  <td>
                    Starter workflows plus bank reconciliation sync, penalty
                    review, default monitoring and email queue.
                  </td>
                  <td>Full VENTIQ Finance Head and Managing Partner dashboards.</td>
                </tr>

                <tr>
                  <td>
                    <strong>Debt Fund OS</strong>
                  </td>
                  <td>Multi-fund credit platform</td>
                  <td>
                    Full loan servicing, term sheet review, covenant, security,
                    bank sync, notices, default control and dashboard layer.
                  </td>
                  <td>
                    Portfolio Intelligence, Investor Portal and Document Studio.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Final QA Checklist</h2>
              <p>
                Complete this checklist before marking Debt LMS v1 as frozen.
              </p>
            </div>
          </div>

          <ul className="check-list">
            {qaChecklist.map((item) => (
              <li key={item}>□ {item}</li>
            ))}
          </ul>

          <div className="go-live-box">
            <h2>Debt LMS v1 freeze condition</h2>
            <p>
              Once all checklist items are tested successfully, Debt LMS can be
              marked as demo-ready and commercially presentable as a standalone
              VENTIQ module.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}