export default function DemoPage() {
  const demoSteps = [
    {
      step: "01",
      title: "Upload Fund Data",
      description:
        "Start with investor master, commitments, portfolio data, fund economics, compliance records and historical PDFs.",
      href: "/migration/data-intake",
      cta: "Open Data Intake",
      status: "Internal onboarding",
    },
    {
      step: "02",
      title: "Classify Investor PDFs",
      description:
        "VENTIQ reads uploaded PDFs, detects document type, matches investors, assigns confidence and creates a review queue.",
      href: "/migration/pdf-intelligence",
      cta: "Open PDF Intelligence",
      status: "Document intelligence",
    },
    {
      step: "03",
      title: "Validate Migration Readiness",
      description:
        "Review whether investor, fund, portfolio, PDF and compliance layers are ready before launching dashboards.",
      href: "/migration/activation",
      cta: "View Readiness",
      status: "Quality control",
    },
    {
      step: "04",
      title: "Launch Stakeholder Dashboards",
      description:
        "Move from migrated raw data to role-wise dashboards for each stakeholder inside the fund.",
      href: "/migration/stakeholder-launch",
      cta: "Open Launch Center",
      status: "Dashboard activation",
    },
    {
      step: "05",
      title: "Show Managing Partner View",
      description:
        "Show fund-level intelligence, portfolio value, commitments, compliance risks, PDF readiness and stakeholder signals.",
      href: "/managing-partner-ai",
      cta: "Open MP Dashboard",
      status: "Leadership view",
    },
    {
      step: "06",
      title: "Show Finance Head View",
      description:
        "Show capital call readiness, allocation drafts, fund economics, repayment schedules, PDFs and compliance evidence.",
      href: "/finance-head-ai",
      cta: "Open Finance Dashboard",
      status: "Finance control room",
    },
    {
      step: "07",
      title: "Show Investor-Facing Portal",
      description:
        "End with the clean LP experience: commitments, capital calls, distributions, financial position, cashflows and documents.",
      href: "/investor-portal",
      cta: "Open Investor Portal",
      status: "Client-facing proof",
    },
  ];

  const roleDashboards = [
    {
      title: "Managing Partner",
      href: "/managing-partner-ai",
      description: "Fund performance, risk, capital, compliance and portfolio view.",
    },
    {
      title: "Finance Head",
      href: "/finance-head-ai",
      description: "Capital calls, allocations, documents, repayments and finance queue.",
    },
    {
      title: "Investment Team",
      href: "/investment-team-ai",
      description: "Portfolio monitoring, valuation, exits, risk and repayment tracking.",
    },
    {
      title: "Compliance Officer",
      href: "/compliance-ai",
      description: "Filings, evidence, due dates, owners and high-risk compliance items.",
    },
    {
      title: "Investor Relations",
      href: "/fundraising-ai",
      description: "Investor documents, data room, DDQs, engagement and LP readiness.",
    },
    {
      title: "Investor Portal",
      href: "/investor-portal",
      description: "Investor-facing commitments, cashflows, performance and documents.",
    },
  ];

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Client Demo Flow</p>
            <h1>One Guided Walkthrough From Data Migration to Investor Portal</h1>
            <p>
              Use this page during a live walkthrough. It connects the internal
              migration engine, readiness checks, stakeholder dashboards and the
              investor-facing portal into one simple demo journey.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Demo command center · Data intake → PDF intelligence → readiness →
          stakeholder dashboards → investor portal
        </div>

        <div className="preview-card">
          <h2>How to Demo VENTIQ</h2>

          <div className="explain-box">
            The story is simple: a private capital firm gives VENTIQ its
            historical investor, fund, portfolio, compliance and PDF records.
            VENTIQ cleans and activates that data into role-wise dashboards for
            the internal team and a clean portal experience for investors.
          </div>

          <div className="action-row">
            <a className="monitor-btn monitor-btn-primary" href="/migration/data-intake">
              Start Demo
            </a>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/migration/stakeholder-launch"
            >
              Launch Dashboards
            </a>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/investor-portal"
            >
              Show Investor Portal
            </a>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>1</h3>
            <p>Operating data layer</p>
          </div>

          <div className="impact-card">
            <h3>5</h3>
            <p>Migration data sources</p>
          </div>

          <div className="impact-card">
            <h3>6</h3>
            <p>Stakeholder experiences</p>
          </div>

          <div className="impact-card">
            <h3>1</h3>
            <p>Investor-facing portal</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>VENTIQ Demo Journey</h2>

          <div className="queue-grid">
            {demoSteps.map((item) => (
              <a
                key={item.step}
                className="queue-item"
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span className="small-pill">Step {item.step}</span>
                <br />
                <strong>{item.title}</strong>
                <br />
                {item.description}
                <br />
                <br />
                Status: {item.status}
                <br />
                → {item.cta}
              </a>
            ))}
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Recommended Live Demo Script</h2>

            <div className="journal-preview">
              <div className="journal-row">
                <span>Opening</span>
                <strong>“VENTIQ starts by migrating your messy fund data.”</strong>
              </div>

              <div className="journal-row">
                <span>Problem</span>
                <strong>“Today, every team works on separate Excel, PDFs and folders.”</strong>
              </div>

              <div className="journal-row">
                <span>Product shift</span>
                <strong>“VENTIQ creates one operating data layer.”</strong>
              </div>

              <div className="journal-row">
                <span>Internal value</span>
                <strong>“Each stakeholder gets their own real-time dashboard.”</strong>
              </div>

              <div className="journal-row">
                <span>Investor value</span>
                <strong>“LPs get one clean portal for documents and fund position.”</strong>
              </div>

              <div className="journal-row">
                <span>Closing</span>
                <strong>“We can start with one fund and one dashboard first.”</strong>
              </div>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Demo Positioning</h2>

            <div className="chat-message">
              Do not position VENTIQ as only automation software.
            </div>

            <div className="chat-message">
              Position it as the operating system and data layer for private
              capital teams.
            </div>

            <div className="chat-message">
              Show migration first, dashboards second, investor portal last.
            </div>

            <div className="chat-message">
              End by offering a guided pilot for one fund or one stakeholder
              dashboard.
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Role-Wise Dashboard Launch</h2>

          <div className="queue-grid">
            {roleDashboards.map((role) => (
              <a
                key={role.title}
                className="queue-item"
                href={role.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{role.title}</strong>
                <br />
                {role.description}
                <br />
                <br />→ Open dashboard
              </a>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>What This Demo Proves</h2>

          <div className="queue-grid">
            <div className="queue-item">
              ✅ VENTIQ can ingest historical fund data
            </div>

            <div className="queue-item">
              ✅ VENTIQ can classify and match investor PDFs
            </div>

            <div className="queue-item">
              ✅ VENTIQ can validate data readiness before dashboard launch
            </div>

            <div className="queue-item">
              ✅ VENTIQ can power six stakeholder dashboards from the same data
            </div>

            <div className="queue-item">
              ✅ VENTIQ can convert internal fund operations into investor-facing
              portal access
            </div>

            <div className="queue-item">
              ✅ VENTIQ can start as a guided pilot instead of a full replacement
              on day one
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Best Demo Flow for First Client Call</h2>

          <div className="explain-box">
            Start with the migration problem, not the dashboard. Show how raw
            investor data and PDFs become clean operating data. Then show
            readiness. Then open the role dashboards. End with the Investor
            Portal because that is the easiest output for a client to understand.
          </div>

          <div className="action-row">
            <a className="monitor-btn monitor-btn-primary" href="/migration">
              Open Migration Hub
            </a>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/managing-partner-ai"
            >
              Show MP View
            </a>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/investor-portal"
            >
              Show LP Portal
            </a>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/product-overview"
            >
              Product Overview
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}