"use client";

import { type FormEvent, useState } from "react";



export default function Home() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  

  const [demoForm, setDemoForm] = useState({
  name: "",
  email: "",
  phone: "",
  company: "",
  role: "",
  firmType: "",
  primaryInterest: "",
  message: "",
});
    const workspacePreviews = [
    {
      label: "Executive AI View",
      role: "Managing Partner",
      title: "Managing Partner Command Center",
      href: "/managing-partner-ai",
      productLabel: "Executive dashboard",
      productSubtitle: "Fund II · Partner View · 31 Mar 2025",
      topMetrics: [
        { label: "Gross IRR", value: "24.3%" },
        { label: "Net IRR", value: "18.7%" },
        { label: "DPI", value: "1.8x" },
        { label: "Dry Powder", value: "₹118 Cr" },
        { label: "Uncalled Capital", value: "₹72 Cr" },
      ],
      primaryTitle: "Fund performance",
      primaryMetrics: [
        { label: "TVPI", value: "2.14x" },
        { label: "MOIC", value: "2.3x" },
        { label: "Deployed", value: "68%" },
        { label: "Expected Exit Value", value: "₹286 Cr" },
      ],
      summaryTitle: "Partner summary",
      summaryRows: [
        { label: "Best performing investment", value: "Alpha Fintech" },
        { label: "Portfolio risk", value: "2 companies need review" },
        { label: "LP update pack", value: "Ready for draft" },
        { label: "Exit readiness", value: "3 assets in watchlist" },
      ],
      aiLabel: "Daily AI Opinion",
      aiTitle: "LP narrative is ready",
      aiBody:
        "Fund performance remains stable. Deployment pace is slightly behind plan, but exit visibility and portfolio movement support a strong LP update narrative.",
      actions: [
        "Generate LP deck",
        "Review portfolio risk",
        "Prepare fundraising update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "AI-prepared LP deck narrative",
        "Fund performance and portfolio risk in one view",
        "Daily partner opinion from connected fund data",
      ],
    },
    {
      label: "Finance AI Workspace",
      role: "Finance Head",
      title: "Finance Head Workspace",
      href: "/finance-head-ai",
      productLabel: "Finance operations",
      productSubtitle: "Fund II · Finance Queue · Today",
      topMetrics: [
        { label: "Capital Calls Ready", value: "2" },
        { label: "Repayment Notices", value: "3" },
        { label: "Distribution Review", value: "₹41 Cr" },
        { label: "Bank Exceptions", value: "1" },
        { label: "Investor Statements", value: "12" },
      ],
      primaryTitle: "Finance queue",
      primaryMetrics: [
        { label: "Capital call approval", value: "Pending" },
        { label: "Distribution working", value: "Ready" },
        { label: "Repayment notice batch", value: "Drafted" },
        { label: "Bank mapping", value: "1 exception" },
      ],
      summaryTitle: "Operating summary",
      summaryRows: [
        { label: "Capital call", value: "Allocation draft prepared" },
        { label: "Distribution", value: "Waterfall ready for review" },
        { label: "Repayment notice", value: "3 emails can be prepared" },
        { label: "Investor reporting", value: "Statement pack pending approval" },
      ],
      aiLabel: "Daily AI Opinion",
      aiTitle: "Finance queue is ready",
      aiBody:
        "Two repayment notices and one distribution working are ready for review. One reconciliation exception needs mapping before the investor statement pack is released.",
      actions: [
        "Generate capital call",
        "Prepare repayment notices",
        "Review bank exception",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Capital calls, distributions and repayment notices in one queue",
        "AI-prepared communication drafts",
        "Approval and audit trail linked to every output",
      ],
    },
    {
      label: "Compliance AI View",
      role: "Compliance Officer",
      title: "Compliance Officer View",
      href: "/compliance-ai",
      productLabel: "Compliance control room",
      productSubtitle: "AIF · GIFT City · Regulatory Tracker",
      topMetrics: [
        { label: "QCR Due", value: "4 days" },
        { label: "Form 64C", value: "Draft" },
        { label: "Form 64D", value: "Data check" },
        { label: "Evidence Gaps", value: "2" },
        { label: "AML Review", value: "Open" },
      ],
      primaryTitle: "Filing readiness",
      primaryMetrics: [
        { label: "QCR", value: "82%" },
        { label: "TCR", value: "Ready" },
        { label: "FATCA / CRS", value: "Review" },
        { label: "Audit evidence", value: "2 gaps" },
      ],
      summaryTitle: "Regulatory summary",
      summaryRows: [
        { label: "Upcoming filing", value: "QCR due in 4 days" },
        { label: "Investor tax data", value: "64D validation pending" },
        { label: "Evidence trail", value: "2 missing documents" },
        { label: "GIFT City tracker", value: "IFSCA review open" },
      ],
      aiLabel: "Compliance AI Opinion",
      aiTitle: "Compliance urgency detected",
      aiBody:
        "QCR is due in 4 days. Two audit evidence items are missing from the document trail and should be collected before final compliance review.",
      actions: [
        "Open filing tracker",
        "Prepare evidence pack",
        "Review compliance calendar",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "AIF, GIFT City, QCR, TCR, Form 64C and Form 64D tracking",
        "Evidence status connected to compliance tasks",
        "Daily compliance urgency summary",
      ],
    },
    {
      label: "Portfolio AI Workspace",
      role: "Investment Team",
      title: "Investment Team Workspace",
      href: "/investment-team-ai",
      productLabel: "Portfolio intelligence",
      productSubtitle: "Portfolio Companies · Movement Tracker",
      topMetrics: [
        { label: "Portfolio Updates", value: "5" },
        { label: "Risk Flags", value: "2" },
        { label: "Valuation Movement", value: "1" },
        { label: "Exit Notes", value: "3" },
        { label: "Follow-on Watch", value: "2" },
      ],
      primaryTitle: "Portfolio movement",
      primaryMetrics: [
        { label: "Revenue movement", value: "Flagged" },
        { label: "Repayment risk", value: "1 company" },
        { label: "Exit readiness", value: "3 assets" },
        { label: "Follow-on need", value: "2 reviews" },
      ],
      summaryTitle: "Investment summary",
      summaryRows: [
        { label: "Alpha Fintech", value: "Revenue movement positive" },
        { label: "Nova Health", value: "Repayment risk increased" },
        { label: "Orbit SaaS", value: "Exit readiness improved" },
        { label: "Valuation input", value: "One update pending" },
      ],
      aiLabel: "Portfolio AI Opinion",
      aiTitle: "Portfolio signal flagged",
      aiBody:
        "One portfolio company shows positive revenue movement, while one debt exposure shows repayment-risk signal. Investment team review is recommended.",
      actions: [
        "Review company update",
        "Flag valuation movement",
        "Prepare exit-readiness note",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Portfolio updates converted into investment-team signals",
        "Debt repayment risk and valuation movement in one view",
        "Exit readiness and follow-on watchlist",
      ],
    },
    {
      label: "IR AI Workspace",
      role: "Investor Relations",
      title: "IR & Fundraising Workspace",
      href: "/fundraising-ai",
      productLabel: "Investor relations",
      productSubtitle: "LP Pipeline · DDQ · Reporting Packs",
      topMetrics: [
        { label: "LP Follow-ups", value: "3" },
        { label: "DDQ Draft", value: "1" },
        { label: "Deck Updates", value: "2" },
        { label: "Warm Investors", value: "4" },
        { label: "Reporting Packs", value: "6" },
      ],
      primaryTitle: "LP communication",
      primaryMetrics: [
        { label: "DDQ response", value: "Auto-draft" },
        { label: "Fundraising deck", value: "Update ready" },
        { label: "LP follow-ups", value: "3 due" },
        { label: "Data room request", value: "2 open" },
      ],
      summaryTitle: "Fundraising summary",
      summaryRows: [
        { label: "Sovereign LP", value: "Follow-up due tomorrow" },
        { label: "Family Office", value: "DDQ draft available" },
        { label: "Pension Fund", value: "Deck update requested" },
        { label: "Quarterly report", value: "Ready for LP pack" },
      ],
      aiLabel: "IR AI Opinion",
      aiTitle: "LP communication pending",
      aiBody:
        "Three LP follow-ups are pending. One DDQ response can be auto-drafted using fund performance, compliance and portfolio data.",
      actions: [
        "Draft LP response",
        "Generate fundraising deck",
        "Prepare investor update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Investor updates, DDQs and fundraising decks from connected data",
        "LP follow-up and reporting pack visibility",
        "Fundraising narrative connected to performance and portfolio signals",
      ],
    },
    {
      label: "Investor AI Portal",
      role: "Investors / LPs",
      title: "Investor Portal",
productLabel: "Investor self-service portal",
productSubtitle: "Fund II · Class A · Investor View",
      topMetrics: [
        { label: "Commitment", value: "₹10.0 Cr" },
        { label: "Capital Called", value: "₹6.8 Cr" },
        { label: "Capital Redeemed", value: "₹32.5 L" },
        { label: "Latest NAV", value: "₹7.5 Cr" },
        { label: "Outstanding Units", value: "6,42,500" },
      ],
      primaryTitle: "Fund performance · as on 31 March 2025",
      primaryMetrics: [
        { label: "Gross XIRR", value: "22.4%" },
        { label: "Net XIRR", value: "18.7%" },
        { label: "TVPI", value: "1.84x" },
        { label: "DPI", value: "0.42x" },
      ],
      summaryTitle: "Investment summary",
      summaryRows: [
        { label: "Onboarded on", value: "22 Mar 2022" },
        { label: "Last login", value: "10 May 2025" },
        { label: "Total distributed to you", value: "₹42.0 L" },
        { label: "Units allotted lifetime", value: "6,75,000" },
      ],
      aiLabel: "AI LP Summary",
      aiTitle: "Investor update ready",
      aiBody:
        "This quarter includes one capital call notice, one performance update and two investor reporting documents available for review.",
      actions: [
        "View capital call notice",
        "Download statements",
        "Read fund update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Investor self-service for capital calls, statements and reports",
        "LP-ready AI summary of fund updates",
        "Reduced email follow-ups for investor documents",
      ],
    },
  ];

const [selectedWorkspaceIndex, setSelectedWorkspaceIndex] = useState(0);
const selectedWorkspace = workspacePreviews[selectedWorkspaceIndex];

  function handleDemoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = encodeURIComponent("VENTIQ Walkthrough Request");

    const body = encodeURIComponent(
      `New VENTIQ walkthrough request:

Name: ${demoForm.name}
Email: ${demoForm.email}
Phone: ${demoForm.phone}
Company / Fund: ${demoForm.company}
Role: ${demoForm.role}
Firm Type: ${demoForm.firmType}
Primary Interest: ${demoForm.primaryInterest}

Message:
${demoForm.message}

Source: useventiq.com`
    );

    window.location.href = `mailto:shubham81079@gmail.com?subject=${subject}&body=${body}`;
    setIsDemoOpen(false);
  }
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://useventiq.com/#organization",
        name: "VENTIQ",
        url: "https://useventiq.com",
        logo: "https://useventiq.com/icon",
        description:
          "VENTIQ is an AI operating system for private capital teams, designed for fund operations, investor reporting, compliance workflows, portfolio intelligence and workflow execution.",
      },
      {
        "@type": "WebSite",
        "@id": "https://useventiq.com/#website",
        url: "https://useventiq.com",
        name: "VENTIQ",
        publisher: {
          "@id": "https://useventiq.com/#organization",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://useventiq.com/#software",
        name: "VENTIQ",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://useventiq.com",
        description:
          "AI operating system for private capital teams covering capital calls, distributions, repayment notices, investor reporting, compliance workflows and portfolio intelligence.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          availability: "https://schema.org/PreOrder",
          description:
            "VENTIQ is available for walkthroughs and product discussions. Pricing depends on funds, users and enabled workflows.",
        },
      },
    ],
  };
  return (
    <main>
            <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <div className="container">
        <header className="ventiq-header">
  <a className="ventiq-brand" href="#">
    VENTIQ
  </a>

  <div className="ventiq-header-links">
    <a href="#solutions">Solutions</a>
    <a href="#modules">Workspaces</a>
    <a href="#all-workspaces">Modules</a>
    <a href="#about">About</a>

    <button
      className="ventiq-header-cta"
      type="button"
      onClick={() => setIsDemoOpen(true)}
    >
      Request Walkthrough
    </button>
  </div>
</header>

        <section className="hero">
          <div className="hero-eyebrow">
            AI operating layer for private capital teams
          </div>

          <h1>
            The AI Operating System
            <br />
            For Private Capital
          </h1>

          <p>
            Replace scattered spreadsheets, email follow-ups and manual MIS with
            one connected operating layer for fund operations, compliance,
            portfolio intelligence, investor reporting and workflow execution.
          </p>

          <div className="hero-founder-signal">
            Built from real AIF, fund reporting and private capital operations
            experience.
          </div>

          <div className="hero-actions">
            <button
              className="btn"
              type="button"
              onClick={() => setIsDemoOpen(true)}
            >
              Request Walkthrough
            </button>

            <a className="btn-secondary" href="#ai-workspace-preview">
              Explore AI Workspaces
            </a>
          </div>
        </section>

        <div className="hero-metrics">
          <div className="metric-card">
            <h3>Single Source of Truth</h3>
            <p>
              Fund, investor, portfolio, compliance and workflow data connected
              in one place.
            </p>
          </div>

          <div className="metric-card">
            <h3>Stakeholder Dashboards</h3>
            <p>
              Role-based views for partners, finance, compliance, investment
              teams and LPs.
            </p>
          </div>

          <div className="metric-card">
            <h3>Workflow Engines</h3>
            <p>
              Capital calls, distributions, repayment notices, compliance and
              reporting workflows.
            </p>
          </div>
        </div>
             <section className="security-control-strip">
  <div className="metric-card trust-card">
    <h3>Role-Based Access</h3>
    <p>Dashboards structured around stakeholder responsibility and access needs.</p>
  </div>

  <div className="metric-card trust-card">
    <h3>Control & Evidence</h3>
    <p>Approvals, notices, documents and workflow history stay linked to the same operating layer.</p>
  </div>

  <div className="metric-card trust-card">
    <h3>Audit Trail Ready</h3>
    <p>Actions, generated outputs and follow-ups are designed to remain traceable.</p>
  </div>
</section>

        <section className="section">
          <h2 className="section-title">
            One connected layer replacing scattered fund operations.
          </h2>

          <div className="premium-os-card">
            <div className="premium-os-header">
              <span>VENTIQ Operating System</span>

              <p>
                VENTIQ brings fund operations, compliance, portfolio updates,
                investor reporting and workflows into one connected operating
                layer — so every stakeholder sees the right information in real
                time.
              </p>
            </div>

            <div className="before-after-grid">
              <div className="before-card">
                <p className="premium-label">Today</p>

                <h3>Information is scattered</h3>

                <div className="clean-list">
                  <div>
                    <strong>Excel files</strong>
                    <span>Capital calls, distributions, investor workings</span>
                  </div>

                  <div>
                    <strong>Email threads</strong>
                    <span>Approvals, queries, follow-ups and confirmations</span>
                  </div>

                  <div>
                    <strong>Fund admin reports</strong>
                    <span>NAV files, statements, schedules and investor data</span>
                  </div>

                  <div>
                    <strong>Shared folders</strong>
                    <span>Documents, evidence, notices and historical files</span>
                  </div>

                  <div>
                    <strong>Manual MIS</strong>
                    <span>
                      Numbers rechecked before every partner or investor update
                    </span>
                  </div>
                </div>
              </div>

              <div className="after-card">
                <p className="premium-label">With VENTIQ</p>

                <h3>Live dashboards, AI opinions and workflow actions</h3>

                <div className="core-summary-box">
                  <strong>VENTIQ</strong>
                  <span>
                    One operating layer for dashboards, workflows, AI
                    assessments and reporting
                  </span>
                </div>

                <div className="dashboard-pill-grid">
                  <span>Managing Partner Dashboard</span>
                  <span>Finance Head Workspace</span>
                  <span>Compliance Officer View</span>
                  <span>Investment Team Workspace</span>
                  <span>Investor Relations View</span>
                  <span>Investor Portal</span>
                </div>
              </div>
            </div>

            <div className="workflow-proof-row">
              <div>
                <strong>Workflow-backed dashboards</strong>
                <p>
                  Capital calls, distributions, repayment notices, compliance,
                  portfolio updates and investor reporting feed the same
                  operating layer.
                </p>
              </div>

              <div className="workflow-proof-pills">
                <span>Capital Calls</span>
                <span>Distributions</span>
                <span>Repayment Notices</span>
                <span>Compliance</span>
                <span>Portfolio Intelligence</span>
                <span>Investor Reporting</span>
              </div>
            </div>
          </div>
        </section>

               <section className="section" id="ai-workspace-preview">
          <h2 className="section-title">
            Interactive AI product previews for every stakeholder.
          </h2>

          <div className="ai-preview-card">
            <div className="ai-preview-header">
              <span>Interactive Product Preview</span>

              <p>
                Choose a role to see a realistic VENTIQ workspace mockup with
                live metrics, daily AI opinion, recommended actions and
                stakeholder-specific operating intelligence.
              </p>
            </div>

            <div className="role-selector-grid">
              {workspacePreviews.map((workspace, index) => (
                <button
                  key={workspace.role}
                  type="button"
                  className={`role-selector-card ${
                    selectedWorkspaceIndex === index ? "active" : ""
                  }`}
                  onClick={() => setSelectedWorkspaceIndex(index)}
                >
                  <span>{workspace.label}</span>
                  <strong>{workspace.role}</strong>
                </button>
              ))}
            </div>

            <div className="product-preview-shell">
              <div className="product-preview-screen">
                <div className="product-preview-topbar">
                  <div>
                    <span>{selectedWorkspace.productLabel}</span>
                    <h3>{selectedWorkspace.title}</h3>
                    <p>{selectedWorkspace.productSubtitle}</p>
                  </div>

                  <a href={selectedWorkspace.href}>Open full workspace →</a>
                </div>

                <div className="product-metric-grid">
                  {selectedWorkspace.topMetrics.map((metric) => (
                    <div key={metric.label} className="product-metric-card">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="product-preview-main-grid">
                  <div className="product-panel product-panel-large">
                    <h4>{selectedWorkspace.primaryTitle}</h4>

                    <div className="product-performance-grid">
                      {selectedWorkspace.primaryMetrics.map((metric) => (
                        <div key={metric.label}>
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="product-panel product-ai-panel">
                    <span>{selectedWorkspace.aiLabel}</span>
                    <h4>{selectedWorkspace.aiTitle}</h4>
                    <p>{selectedWorkspace.aiBody}</p>
                  </div>
                </div>

                <div className="product-preview-main-grid">
                  <div className="product-panel">
                    <h4>{selectedWorkspace.summaryTitle}</h4>

                    <div className="product-row-list">
                      {selectedWorkspace.summaryRows.map((row) => (
                        <div key={row.label}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="product-panel">
                    <span className="product-panel-kicker">
                      Recommended actions
                    </span>

                    <div className="product-action-list">
                      {selectedWorkspace.actions.map((action) => (
                        <a key={action} href={selectedWorkspace.href}>
                          {action}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="product-speciality-strip">
                  <div>
                    <span>Speciality</span>
                    <strong>{selectedWorkspace.proofTitle}</strong>
                  </div>

                  <div className="product-speciality-points">
                    {selectedWorkspace.proofRows.map((point) => (
                      <span key={point}>{point}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="modules">
          <h2 className="section-title">
            Six stakeholder workspaces. One connected operating experience.
          </h2>

          <div className="stakeholder-workspace-card">
            <div className="stakeholder-workspace-header">
              <span>Role-Based Dashboards</span>

              <p>
                VENTIQ gives each stakeholder a focused workspace built on the
                same operating layer — so every team sees what matters to them
                without waiting for manual MIS, email follow-ups or offline
                files.
              </p>
            </div>

            <div className="stakeholder-workspace-grid">
              <a className="stakeholder-workspace-item" href="/managing-partner-ai">
                <div className="workspace-tag">Leadership</div>

                <h3>Managing Partner Dashboard</h3>

                <p>
                  Fund performance, deployment, dry powder, portfolio risk,
                  exits and LP narrative in one executive view.
                </p>

                <div className="workspace-micro-list">
                  <span>IRR / DPI / TVPI</span>
                  <span>Portfolio risk</span>
                  <span>Fundraising visibility</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>

              <a className="stakeholder-workspace-item" href="/finance-head-ai">
                <div className="workspace-tag">Finance</div>

                <h3>Finance Head Workspace</h3>

                <p>
                  Capital calls, distributions, reconciliations, notices, fees,
                  investor statements and approval workflows.
                </p>

                <div className="workspace-micro-list">
                  <span>Capital movement</span>
                  <span>Repayment notices</span>
                  <span>Investor reporting</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>

              <a className="stakeholder-workspace-item" href="/compliance-ai">
                <div className="workspace-tag">Compliance</div>

                <h3>Compliance Officer View</h3>

                <p>
                  Regulatory obligations, filing calendars, audit evidence, Form
                  64C, Form 64D, QCR and GIFT City tracking.
                </p>

                <div className="workspace-micro-list">
                  <span>Due dates</span>
                  <span>Audit trail</span>
                  <span>Filing evidence</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>

              <a className="stakeholder-workspace-item" href="/investment-team-ai">
                <div className="workspace-tag">Investment</div>

                <h3>Investment Team Workspace</h3>

                <p>
                  Portfolio updates, company movement, repayment risk, valuation
                  changes, operating signals and exit readiness.
                </p>

                <div className="workspace-micro-list">
                  <span>Portfolio movement</span>
                  <span>Risk signals</span>
                  <span>Exit readiness</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>

              <a className="stakeholder-workspace-item" href="/fundraising-ai">
                <div className="workspace-tag">Investor Relations</div>

                <h3>IR & Fundraising Workspace</h3>

                <p>
                  LP pipeline, DDQs, investor follow-ups, reporting packs,
                  fundraising decks and relationship intelligence.
                </p>

                <div className="workspace-micro-list">
                  <span>LP pipeline</span>
                  <span>DDQs</span>
                  <span>Deck preparation</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>

              <a className="stakeholder-workspace-item" href="/investor-portal">
                <div className="workspace-tag">Investors</div>

                <h3>Investor Portal</h3>

                <p>
                  Investor-facing access to commitments, capital calls,
                  distributions, notices, reports, statements and documents.
                </p>

                <div className="workspace-micro-list">
                  <span>Statements</span>
                  <span>Documents</span>
                  <span>Fund updates</span>
                </div>

                <strong>Open Workspace →</strong>
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="ai-intelligence">
          <h2 className="section-title">
            AI intelligence built into the operating layer.
          </h2>

          <div className="ai-intelligence-card">
            <div className="ai-intelligence-header">
              <span>What AI does inside VENTIQ</span>

              <p>
                VENTIQ is designed to generate daily opinions, surface
                exceptions, recommend next actions and help teams prepare
                stakeholder-ready communication from connected fund data.
              </p>
            </div>

            <div className="ai-intelligence-grid">
              <div>
                <span>01</span>
                <h3>Daily AI Opinions</h3>
                <p>
                  Fund health, portfolio movement, compliance urgency and
                  investor reporting readiness summarized every day for each
                  stakeholder.
                </p>
              </div>

              <div>
                <span>02</span>
                <h3>Recommended Actions</h3>
                <p>
                  Suggested next actions across capital calls, distributions,
                  repayment notices, compliance evidence and LP communication.
                </p>
              </div>

              <div>
                <span>03</span>
                <h3>Auto-Drafted Outputs</h3>
                <p>
                  Draft repayment notices, investor updates, DDQ responses,
                  compliance summaries and reporting packs from connected data.
                </p>
              </div>

              <div>
                <span>04</span>
                <h3>Exception & Risk Flags</h3>
                <p>
                  Identify missing documents, overdue approvals, portfolio risk,
                  reconciliation gaps and upcoming regulatory deadlines.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="all-workspaces">
          <h2 className="section-title">
            Workflow engines powering the operating system.
          </h2>

          <div className="roadmap-board-card">
            <div className="roadmap-board-header">
              <span>Product Roadmap</span>

              <p>
                The stakeholder dashboards are powered by workflow engines behind
                the scenes. Some workflows are live for walkthroughs, while
                others are in foundation or build phase as VENTIQ expands around
                the same operating layer.
              </p>
            </div>

            <div className="roadmap-status-row">
              <div>
                <strong>Live workflows</strong>
                <p>Ready to show in product demos</p>
              </div>

              <div>
                <strong>Foundation ready</strong>
                <p>Core direction and page structure are in place</p>
              </div>

              <div>
                <strong>Build phase</strong>
                <p>Being expanded into deeper automation</p>
              </div>
            </div>

            <div className="roadmap-columns">
              <div className="roadmap-column">
                <div className="roadmap-column-top">
                  <span className="status-live">Live</span>
                  <h3>Ready for walkthrough</h3>
                </div>

                <a href="/capital-call">
                  <strong>Capital Call Workflow</strong>
                  <p>
                    Generate investor allocations, approval flows, capital call
                    notices and accounting-ready outputs.
                  </p>
                </a>

                <a href="/repayment-notice">
                  <strong>Repayment Notice Workflow</strong>
                  <p>
                    Generate repayment notices, prepare email drafts, track
                    dispatch status and maintain audit history.
                  </p>
                </a>

                <a href="/distribution-waterfall">
                  <strong>Distribution Waterfall & Notices</strong>
                  <p>
                    Model distributable cash, LP payouts, waterfalls, carry and
                    prepare distribution communication workflows.
                  </p>
                </a>
              </div>

              <div className="roadmap-column">
                <div className="roadmap-column-top">
                  <span className="status-ready">Foundation</span>
                  <h3>Core workflow foundation</h3>
                </div>

                <a href="/portfolio-intelligence">
                  <strong>Portfolio Intelligence</strong>
                  <p>
                    Track portfolio movement, company updates, repayment risk,
                    valuation changes, news alerts and exit readiness.
                  </p>
                </a>

                <a href="/document-engine">
                  <strong>Investor Document Status</strong>
                  <p>
                    Organize investor documents, notices, reporting packs,
                    certificates, workflow evidence and document status.
                  </p>
                </a>

                <a href="/compliance-ai">
                  <strong>Compliance & Regulatory Tracker</strong>
                  <p>
                    Track QCR, TCR, Form 64C, Form 64D, SEBI, GIFT City, audit
                    readiness and regulatory evidence.
                  </p>
                </a>

                <a href="/activity-engine">
                  <strong>Activity Engine</strong>
                  <p>
                    Track workflow activity, AI actions, approvals, dependencies
                    and operating history across the platform.
                  </p>
                </a>
              </div>

              <div className="roadmap-column">
                <div className="roadmap-column-top">
                  <span className="status-build">Build phase</span>
                  <h3>Expansion workflows</h3>
                </div>

                <a href="/bank-reconciliation">
                  <strong>Bank Reconciliation</strong>
                  <p>
                    Match bank transactions, review exceptions and prepare
                    accounting entries for fund operations.
                  </p>
                </a>

                <a href="/finance">
                  <strong>Finance Mission Control</strong>
                  <p>
                    Monitor finance workflows, priorities, operating risk,
                    approvals and fund-level action items.
                  </p>
                </a>

                <a href="/distribution-waterfall">
                  <strong>Fee & Carry Engine</strong>
                  <p>
                    Monitor management fees, carry accruals, waterfall outputs,
                    GP commitments and fund-level economics.
                  </p>
                </a>

                <a href="/knowledge-hub">
                  <strong>Knowledge Hub</strong>
                  <p>
                    Search regulations, circulars, fund documents, internal
                    policies and compliance references.
                  </p>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="solutions">
          <h2 className="section-title">
            Connected fund data. Clearer decisions. Faster execution.
          </h2>

          <div className="operating-preview-card">
            <div className="operating-preview-header">
              <span>Operating Intelligence Layer</span>

              <p>
                VENTIQ is designed to turn connected fund data into live
                decisions, task visibility, reporting readiness and stakeholder
                communication across the firm.
              </p>
            </div>

            <div className="operating-preview-grid">
              <div className="operating-left-panel">
                <h3>Live operating view</h3>

                <div className="operating-metric-row">
                  <div>
                    <strong>24.3%</strong>
                    <span>Fund IRR</span>
                  </div>

                  <div>
                    <strong>1.8x</strong>
                    <span>DPI</span>
                  </div>

                  <div>
                    <strong>₹118 Cr</strong>
                    <span>Dry Powder</span>
                  </div>
                </div>

                <div className="operating-signal-list">
                  <div>
                    <span>Expected distribution</span>
                    <strong>₹41 Cr ready for review</strong>
                  </div>

                  <div>
                    <span>Compliance</span>
                    <strong>QCR due in 4 days</strong>
                  </div>

                  <div>
                    <span>Portfolio</span>
                    <strong>Revenue movement flagged</strong>
                  </div>

                  <div>
                    <span>Investor reporting</span>
                    <strong>LP update pack in progress</strong>
                  </div>
                </div>
              </div>

              <div className="operating-right-panel">
                <h3>Recommended actions</h3>

                <div className="action-stack">
                  <a href="/capital-call">
                    <strong>Generate Capital Call</strong>
                    <span>Prepare allocation, notice and approval workflow</span>
                  </a>

                  <a href="/distribution-waterfall">
                    <strong>Run Distribution Waterfall</strong>
                    <span>Review payouts, carry and LP communication impact</span>
                  </a>

                  <a href="/repayment-notice">
                    <strong>Prepare Repayment Notices</strong>
                    <span>Draft notices, email text and dispatch history</span>
                  </a>

                  <a href="/compliance-ai">
                    <strong>Open Compliance Tracker</strong>
                    <span>Review QCR, Form 64C, Form 64D and audit evidence</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="trust-layer-row">
              <div>
                <span>Regulatory Coverage</span>
                <strong>
                  AIF, GIFT City, IFSCA, FATCA, CRS and AML workflows
                </strong>
              </div>

              <div>
                <span>Control & Evidence</span>
                <strong>
                  Approvals, notices, audit trail and supporting evidence linked
                  to data
                </strong>
              </div>

              <div>
                <span>Investor Reporting Layer</span>
                <strong>
                  Capital calls, distribution notices, statements, reports and
                  documents in one place
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="security">
          <h2 className="section-title">
            Built for fund data, controls and audit trails.
          </h2>

          <div className="security-trust-card">
            <div>
              <span>Role-Based Access</span>
              <strong>Different stakeholders see only the views relevant to them.</strong>
            </div>

            <div>
              <span>Document Controls</span>
              <strong>
                Notices, statements, evidence and reports linked back to the
                workflow.
              </strong>
            </div>

            <div>
              <span>Audit Trail Thinking</span>
              <strong>
                Actions, approvals, generated outputs and communication history
                designed to remain traceable.
              </strong>
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <div className="about-premium-card">
            <div className="about-premium-left">
              <span className="about-pill">About VENTIQ</span>

              <h2>Built from real private capital operations.</h2>

              <p>
                VENTIQ is being built for private capital firms that need one
                connected operating layer across fund operations, compliance,
                investor reporting, portfolio intelligence and workflow
                execution.
              </p>

              <p>
                The platform is shaped around a simple operating problem:
                critical fund information still lives across spreadsheets,
                emails, fund administrators, shared folders and manual reporting
                cycles.
              </p>

              <div className="about-proof-list">
                <div>
                  <strong>Private capital focused</strong>
                  <span>VC, PE, Debt Funds, AIFs and GIFT City managers</span>
                </div>

                <div>
                  <strong>Workflow-first</strong>
                  <span>
                    Capital calls, distributions, notices, compliance and
                    reporting
                  </span>
                </div>

                <div>
                  <strong>Stakeholder-ready</strong>
                  <span>
                    Dashboards for partners, finance, compliance, investment
                    teams and LPs
                  </span>
                </div>
              </div>
            </div>

            <div className="about-founder-card">
              <span className="about-pill">Founder</span>

              <h3>Shubham Jain, CA</h3>

              <p>
                Chartered Accountant with experience across alternative
                investment funds, fund operations, investor reporting, fund
                reporting and private capital workflows.
              </p>

              <p>
                VENTIQ is being built from practical operating experience — not
                as another fund admin service, but as a connected operating
                system for the teams running private capital funds.
              </p>

              <div className="founder-chip-row">
                <span>AIF operations</span>
                <span>Investor reporting</span>
                <span>Fund workflows</span>
                <span>Private capital systems</span>
              </div>

              <button
                className="action-button"
                type="button"
                onClick={() => setIsDemoOpen(true)}
              >
                Contact Founder →
              </button>
            </div>
          </div>
        </section>

        <section className="section" id="contact">
          <div className="final-cta-card">
            <div className="final-cta-left">
              <span className="about-pill">Request Walkthrough</span>

              <h2>See how VENTIQ connects private capital operations.</h2>

              <p>
                Walk through the operating layer, AI stakeholder dashboards and
                workflow engines being built for fund operations, compliance,
                investor reporting, portfolio intelligence and LP communication.
              </p>

              <div className="final-cta-points">
                <span>AI stakeholder dashboards</span>
                <span>Workflow engines</span>
                <span>Private capital operating layer</span>
              </div>
            </div>

            <div className="final-cta-right">
              <h3>
                Built for private capital teams ready to operate from one system.
              </h3>

              <p>
                Designed for fund managers, finance heads, compliance teams,
                investment teams, investor relations teams and investors who need
                real-time visibility from the same operating layer.
              </p>

              <button
                className="action-button final-cta-button"
                type="button"
                onClick={() => setIsDemoOpen(true)}
              >
                Request Walkthrough →
              </button>
            </div>
          </div>
        </section>

                <footer className="footer">
          <span>© 2026 VENTIQ</span>

          <div className="footer-links">
            <a href="/security">Security</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>

          <span>AI operating system for private capital teams</span>
        </footer>
      </div>

      {isDemoOpen && (
        <div className="demo-modal-overlay">
          <div className="demo-modal">
            <div className="demo-modal-header">
              <div>
                <p className="about-label">Request Walkthrough</p>

                <h2>See how VENTIQ connects your private capital workflows.</h2>

                <p>
                  Share your details and we will reach out with a product
                  walkthrough.
                </p>
              </div>

              <button
                className="demo-close-button"
                type="button"
                onClick={() => setIsDemoOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="demo-form" onSubmit={handleDemoSubmit}>
              <div className="demo-form-grid">
                <label>
                  Name *
                  <input
                    required
                    type="text"
                    placeholder="Your name"
                    value={demoForm.name}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, name: event.target.value })
                    }
                  />
                </label>

                <label>
                  Email *
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={demoForm.email}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, email: event.target.value })
                    }
                  />
                </label>

                <label>
                  Phone Number *
                  <input
                    required
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={demoForm.phone}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, phone: event.target.value })
                    }
                  />
                </label>

                <label>
                  Company / Fund
                  <input
                    type="text"
                    placeholder="Fund, company or firm name"
                    value={demoForm.company}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, company: event.target.value })
                    }
                  />
                </label>

                <label>
                  Role
                  <input
                    type="text"
                    placeholder="Finance Head, Founder, Partner, IR..."
                    value={demoForm.role}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, role: event.target.value })
                    }
                  />
                </label>
                <label>
  Firm Type
  <select
    value={demoForm.firmType}
    onChange={(event) =>
      setDemoForm({ ...demoForm, firmType: event.target.value })
    }
  >
    <option value="">Select firm type</option>
    <option>VC Fund</option>
    <option>Private Equity Fund</option>
    <option>Private Credit / Venture Debt Fund</option>
    <option>Category II AIF</option>
    <option>GIFT City Fund</option>
    <option>Family Office</option>
    <option>Fund Administrator</option>
    <option>Other</option>
  </select>
</label>

<label>
  Primary Interest
  <select
    value={demoForm.primaryInterest}
    onChange={(event) =>
      setDemoForm({ ...demoForm, primaryInterest: event.target.value })
    }
  >
    <option value="">Select interest</option>
    <option>Managing Partner Dashboard</option>
    <option>Capital Call Workflow</option>
    <option>Distribution Waterfall</option>
    <option>Repayment Notices</option>
    <option>Investor Portal</option>
    <option>Compliance / Knowledge Hub</option>
    <option>Full VENTIQ walkthrough</option>
  </select>
</label>

                <label className="demo-message-field">
                  Message
                  <textarea
                    placeholder="Tell us what you want to explore in VENTIQ"
                    value={demoForm.message}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, message: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="demo-modal-actions">
                <button className="btn" type="submit">
                  Send Walkthrough Request
                </button>

                <button
                  className="demo-secondary-button"
                  type="button"
                  onClick={() => setIsDemoOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}