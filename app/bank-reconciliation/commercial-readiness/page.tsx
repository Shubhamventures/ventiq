import Link from "next/link";

const operatingModes = [
  {
    title: "Bank Account Access Mode",
    tag: "Automated mode",
    description:
      "For clients who are comfortable giving VENTIQ secure access to bank feeds so daily MIS can be fetched automatically.",
    points: [
      "Daily transaction fetch from connected bank account",
      "Opening and closing balance validation",
      "Narration, amount and counterparty mapping",
      "Daily Finance Head MIS without manual uploads",
    ],
  },
  {
    title: "Daily Statement Upload Mode",
    tag: "Controlled mode",
    description:
      "For clients who prefer uploading bank statements daily, weekly or periodically instead of giving live bank access.",
    points: [
      "Upload CSV, Excel or PDF bank statement",
      "AI reads transaction narrations and amounts",
      "Transactions are classified into receipts, payments and exceptions",
      "Finance team keeps control of source files",
    ],
  },
  {
    title: "AI Exception Review Mode",
    tag: "Learning mode",
    description:
      "For transactions that cannot be mapped confidently, VENTIQ asks Finance Head for guidance and learns the rule.",
    points: [
      "Unmatched transactions shown separately",
      "Finance Head guides the correct mapping once",
      "Similar future entries are auto-mapped",
      "AI confidence improves over time",
    ],
  },
  {
    title: "Downstream Sync Mode",
    tag: "Operating system mode",
    description:
      "Approved bank mappings flow into downstream modules like Debt LMS, accounting, capital calls, NAV and finance dashboards.",
    points: [
      "Debt receipts sync into Debt LMS",
      "Investor receipts can sync into capital call tracking",
      "Journal entries can be prepared for finance review",
      "Finance Head gets daily control over cash and exceptions",
    ],
  },
];

const dataChecklist = [
  "Bank account name, bank name, account number masking and fund mapping",
  "Statement source: connected bank access or manual upload",
  "Expected receipt sources: LP capital calls, debt repayments, interest income, portfolio exits",
  "Expected payment sources: management fees, expenses, investments, taxes, distributions",
  "Borrower / investor / vendor master mapping",
  "Historical narration patterns, if available",
  "Ledger mapping rules for accounting entries",
  "Approval users for review, override and AI learning rules",
];

const implementationSteps = [
  {
    step: "01",
    title: "Connect or Upload",
    detail:
      "Client either connects bank access or uploads bank statement files into VENTIQ.",
  },
  {
    step: "02",
    title: "Import Transactions",
    detail:
      "VENTIQ reads date, narration, debit, credit, balance and reference number.",
  },
  {
    step: "03",
    title: "AI Mapping",
    detail:
      "Transactions are mapped using narration, amount, counterparty and historical rules.",
  },
  {
    step: "04",
    title: "Exception Review",
    detail:
      "Low-confidence or unmatched transactions are shown to Finance Head for review.",
  },
  {
    step: "05",
    title: "AI Learning",
    detail:
      "Finance Head guidance becomes a reusable rule for similar future transactions.",
  },
  {
    step: "06",
    title: "Downstream Sync",
    detail:
      "Approved items flow to Debt LMS, accounting, capital calls and finance dashboards.",
  },
];

const demoStories = [
  "Select Bank Account Access mode and run daily Bank MIS.",
  "Switch to Daily Statement Upload mode and upload a statement file.",
  "Show transactions imported and auto-mapped.",
  "Open exception queue and explain why a transaction is unmatched.",
  "Guide AI for one unmatched transaction.",
  "Show AI learning rule created from Finance Head guidance.",
  "Approve a debt repayment receipt.",
  "Open Debt LMS and sync from Bank Reconciliation.",
  "Show journal entry preview for approved transaction.",
  "Show daily Finance Head summary of mapped, pending and review items.",
];

const qaChecklist = [
  "Bank Account Access mode selector works",
  "Daily Statement Upload mode selector works",
  "Run Daily Bank MIS works",
  "File upload interaction works",
  "Transaction mapping table is visible",
  "Approved / Sync button works for debt repayment rows",
  "bank_reconciliation_debt_receipts receives rows",
  "Debt LMS sync receives approved bank receipt rows",
  "Guide AI modal / action works",
  "AI Learning Rules update after guidance",
  "Journal entry preview is visible",
  "Commercial readiness page opens correctly",
];

const packages = [
  {
    name: "Bank MIS Starter",
    idealClient: "Small fund or finance team doing daily manual bank checks",
    included:
      "Daily statement upload, transaction import, basic auto-mapping, exception queue and finance review.",
    upsell: "Bank account access and Debt LMS sync.",
  },
  {
    name: "Bank MIS Plus",
    idealClient: "AIF / private credit / VC fund with regular receipts and payments",
    included:
      "Starter plus AI learning rules, journal entry preview, receipt classification and downstream workflow sync.",
    upsell: "Finance Head dashboard and full accounting workflow.",
  },
  {
    name: "Bank MIS OS",
    idealClient: "Multi-fund platform with daily cash movement across funds",
    included:
      "Connected bank feeds, daily MIS, AI mapping, exception workflow, learning rules, Debt LMS sync and finance control view.",
    upsell: "Full VENTIQ Finance OS, Investor Portal and Document Studio.",
  },
];

export default function BankMisCommercialReadinessPage() {
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
              <p className="eyebrow">VENTIQ Bank MIS</p>
              <h1>Commercial Readiness Pack</h1>
              <p className="hero-copy">
                A sellable Bank MIS and AI reconciliation module for fund
                finance teams. It connects daily bank activity, AI transaction
                mapping, exception review, AI learning, journal preparation and
                downstream sync into one operating layer.
              </p>
            </div>

            <div className="hero-actions">
              <Link className="primary-link" href="/bank-reconciliation">
                Open Bank MIS
              </Link>
              <Link className="secondary-link" href="/debt-lms">
                Debt LMS Sync
              </Link>
            </div>
          </div>

          <div className="readiness-grid">
            <div className="metric-card">
              <span>Module type</span>
              <strong>Bank MIS OS</strong>
            </div>

            <div className="metric-card">
              <span>Source modes</span>
              <strong>Access / Upload</strong>
            </div>

            <div className="metric-card">
              <span>Core output</span>
              <strong>Daily cash control</strong>
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
                Bank MIS can be adopted gradually: daily uploads first, bank
                account access later, then full downstream sync.
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
                  Implementation checklist needed to activate Bank MIS for a
                  fund finance team.
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
                  Use this walkthrough for CFO, Finance Head and fund operations
                  demos.
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
                The module is structured as a real cash-control workflow, not a
                static reconciliation screen.
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
                Use these package labels during client conversations. Validate
                workflow pain first before final pricing.
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
                {packages.map((item) => (
                  <tr key={item.name}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.idealClient}</td>
                    <td>{item.included}</td>
                    <td>{item.upsell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Final QA Checklist</h2>
              <p>Complete this checklist before marking Bank MIS v1 as frozen.</p>
            </div>
          </div>

          <ul className="check-list">
            {qaChecklist.map((item) => (
              <li key={item}>□ {item}</li>
            ))}
          </ul>

          <div className="go-live-box">
            <h2>Bank MIS v1 freeze condition</h2>
            <p>
              Once the checklist passes, Bank MIS can be marked as demo-ready
              and commercially presentable as a standalone VENTIQ module and as
              a connected workflow feeding Debt LMS, finance dashboards and
              accounting.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}