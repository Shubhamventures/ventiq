import Link from "next/link";

const journeySteps = [
  {
    step: "01",
    title: "Create the fund and establish secure Fund Admin access",
    description:
      "Start with the governed fund master, then add the people who will operate the fund. Each person receives a secure invitation and sets their own password.",
    outcome: "Fund + people established",
  },
  {
    step: "02",
    title: "Bring historical fund data into one structure",
    description:
      "Investor, fund, portfolio, compliance and document records are brought into a governed fund context instead of remaining scattered across spreadsheets, PDFs and folders.",
    outcome: "One operating data foundation",
  },
  {
    step: "03",
    title: "Review data quality and activation readiness",
    description:
      "VENTIQ surfaces readiness, reconciliation, exceptions and maker-checker controls before migrated information becomes the basis for stakeholder workflows.",
    outcome: "Governed activation",
  },
  {
    step: "04",
    title: "Activate the fund and launch role-native workspaces",
    description:
      "Once the required data layers are approved, the fund is activated and Finance, Investment, Compliance, Management and Investor workflows launch from one control centre.",
    outcome: "Role-native operations",
  },
  {
    step: "05",
    title: "Turn governed data into investor outputs",
    description:
      "Investor financial position, cashflows, documents and diligence workflows remain connected to the fund and the entitled investor relationship.",
    outcome: "Controlled investor delivery",
  },
  {
    step: "06",
    title: "Expand one workflow at a time",
    description:
      "A firm can begin with one controlled fund and expand into additional workflows without replacing every operating process on day one.",
    outcome: "Modular adoption",
  },
];

const stakeholderViews = [
  {
    title: "Managing Partner",
    description:
      "Fund performance, deployment, portfolio movement, risk, capital and decision context.",
  },
  {
    title: "Finance Head",
    description:
      "Capital calls, distributions, fund economics, documents, repayments and operating queues.",
  },
  {
    title: "Investment Team",
    description:
      "Portfolio monitoring, valuation context, exits, risk and repayment tracking.",
  },
  {
    title: "Compliance",
    description:
      "Filings, evidence, due dates, ownership, approvals and compliance priorities.",
  },
  {
    title: "Investor Relations",
    description:
      "Investor documents, Data Room, DDQ, engagement and LP servicing context.",
  },
  {
    title: "Investor",
    description:
      "Entitled commitments, cashflows, financial position and private documents.",
  },
];

const capabilityGroups = [
  {
    title: "Migration & data readiness",
    body:
      "Historical structured data and documents move through validation, exception review and governed activation.",
  },
  {
    title: "Investor operations",
    body:
      "Capital calls, distributions, statements, documents and investor access stay connected to the underlying fund context.",
  },
  {
    title: "Portfolio operations",
    body:
      "Portfolio monitoring supports strategy-specific information such as valuation, exits, repayment schedules and risk.",
  },
  {
    title: "Governance & controls",
    body:
      "Role-aware access, maker-checker workflows, private document delivery and audit evidence travel with the workflow.",
  },
];

export default function DemoPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Guided Product Experience</p>
            <h1>See one fund move from fragmented data to connected operations.</h1>
            <p>
              Explore how VENTIQ brings historical fund information into one
              governed operating layer, then serves the right context to
              internal stakeholders and investors.
            </p>
          </div>

          <Link className="back-link" href="/">
            Back to Home
          </Link>
        </div>

        <div className="sample-data-ribbon">
          Migration & data readiness → governed workflows → stakeholder views →
          investor experience
        </div>

        <div className="preview-card">
          <p className="eyebrow">THE CONNECTED JOURNEY</p>
          <h2>A guided view of the VENTIQ operating model</h2>

          <div className="explain-box">
            Private-capital teams often operate across spreadsheets, PDFs,
            shared folders, fund-administrator outputs and manual follow-ups.
            VENTIQ connects those inputs into a governed fund context so the
            same underlying information can support operations, approvals,
            management views and investor access.
          </div>

          <div className="action-row">
            <Link className="monitor-btn monitor-btn-primary" href="/start">
              Start fund onboarding
            </Link>

            <a className="monitor-btn monitor-btn-secondary" href="#journey">
              Explore the journey
            </a>

            <a className="monitor-btn monitor-btn-secondary" href="#stakeholders">
              See stakeholder views
            </a>
          </div>
        </div>

        <div className="impact-grid" aria-label="VENTIQ product model">
          <div className="impact-card"><h3>1</h3><p>Governed fund layer</p></div>
          <div className="impact-card"><h3>5</h3><p>Core data-readiness layers</p></div>
          <div className="impact-card"><h3>6</h3><p>Stakeholder experiences</p></div>
          <div className="impact-card"><h3>1</h3><p>Connected investor experience</p></div>
        </div>

        <div className="preview-card" id="journey">
          <p className="eyebrow">PRODUCT JOURNEY</p>
          <h2>From historical data to governed stakeholder delivery</h2>
          <div className="queue-grid">
            {journeySteps.map((item) => (
              <div className="queue-item" key={item.step}>
                <span className="small-pill">Step {item.step}</span><br />
                <strong>{item.title}</strong><br />
                {item.description}<br /><br />
                <span className="small-pill">{item.outcome}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card" id="stakeholders">
          <p className="eyebrow">ROLE-NATIVE EXPERIENCES</p>
          <h2>One fund context. Different views for the people who run it.</h2>
          <div className="queue-grid">
            {stakeholderViews.map((role) => (
              <div className="queue-item" key={role.title}>
                <strong>{role.title}</strong><br />
                {role.description}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card" id="capabilities">
          <p className="eyebrow">OPERATING CAPABILITIES</p>
          <h2>Start with the workflow that creates the most immediate value.</h2>
          <div className="queue-grid">
            {capabilityGroups.map((item) => (
              <div className="queue-item" key={item.title}>
                <strong>{item.title}</strong><br />
                {item.body}
              </div>
            ))}
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <p className="eyebrow">WHY THE MODEL MATTERS</p>
            <h2>Governance stays attached as information moves.</h2>
            <div className="journal-preview">
              <div className="journal-row"><span>Data</span><strong>Bring historical records into one fund context.</strong></div>
              <div className="journal-row"><span>Control</span><strong>Review readiness and approvals before activation.</strong></div>
              <div className="journal-row"><span>Operations</span><strong>Serve role-native workspaces from the same layer.</strong></div>
              <div className="journal-row"><span>Investors</span><strong>Release only entitled information and documents.</strong></div>
            </div>
          </div>

          <div className="ai-side-panel">
            <p className="eyebrow">GUIDED PILOT</p>
            <h2>Start focused. Expand after the workflow is proven.</h2>
            <div className="chat-message">Begin with one agreed fund and a clearly defined operating use case.</div>
            <div className="chat-message">Migrate the data required for that workflow and resolve exceptions before activation.</div>
            <div className="chat-message">Add stakeholder and investor experiences only within the approved scope.</div>
            <div className="chat-message">Expand into additional workflows as the operating model proves useful.</div>
          </div>
        </div>

        <div className="preview-card" id="pilot">
          <p className="eyebrow">SEE VENTIQ AROUND YOUR FUND</p>
          <h2>A walkthrough is most useful when it starts with your operating reality.</h2>
          <div className="explain-box">
            Tell us which workflow creates the most friction today—historical
            migration, investor operations, finance, compliance, portfolio
            monitoring or LP servicing—and we can focus the walkthrough around
            that use case.
          </div>
          <div className="action-row">
            <Link className="monitor-btn monitor-btn-primary" href="/start">Get started with one fund</Link>
            <Link className="monitor-btn monitor-btn-secondary" href="/#contact">Request a private walkthrough</Link>
            <Link className="monitor-btn monitor-btn-secondary" href="/security">Security & controls</Link>
          </div>
          <p style={{ marginTop: "20px", opacity: 0.72 }}>
            Public product views use sample or illustrative information and do
            not expose private client workspaces.
          </p>
        </div>
      </section>
    </main>
  );
}
