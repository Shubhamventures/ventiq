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
    message: "",
  });

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

Message:
${demoForm.message}

Source: useventiq.com`
    );

    window.location.href = `mailto:shubham81079@gmail.com?subject=${subject}&body=${body}`;
    setIsDemoOpen(false);
  }
  return (
    <main>
      <div className="container">
        <nav className="navbar">
          <h2>VENTIQ</h2>

          <div className="nav-links">
                       <a href="#modules">Solutions</a>
            <a href="#all-workspaces">Modules</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>

          </div>
        </nav>

        <section className="hero">
          <h1>
            The AI Operating System
            <br />
            For Private Capital
          </h1>

          <p>
            VENTIQ connects fund operations, compliance, portfolio intelligence,
investor reporting and workflow execution into one secure operating
layer for modern VC, PE, Debt Funds, AIFs and GIFT City managers.
          </p>

<button
  className="btn"
  type="button"
  onClick={() => setIsDemoOpen(true)}
>
  Request Walkthrough
</button>
        </section>

                  <div className="hero-metrics">
            <div className="metric-card">
              <h3>Single Source of Truth</h3>
<p>Fund, investor, portfolio, compliance and workflow data connected in one place.</p>
            </div>

            <div className="metric-card">
              <h3>Stakeholder Dashboards</h3>
              <p>Role-based views for partners, finance, compliance, investment teams and LPs.</p>
            </div>

                       <div className="metric-card">
              <h3>Workflow Engines</h3>
              <p>Capital calls, distributions, repayment notices, compliance and reporting workflows.</p>
            </div>
          </div>

          <section className="section">
          <h2 className="section-title">
            One fund data core. Live intelligence for every stakeholder.
          </h2>

          <div className="premium-os-card">
            <div className="premium-os-header">
              <span>VENTIQ Operating System</span>

              <p>
                VENTIQ brings fund operations, compliance, portfolio updates,
investor reporting and workflows into one connected operating layer —
so every stakeholder sees the right information in real time.
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
                    <span>Numbers rechecked before every partner or investor update</span>
                  </div>
                </div>
              </div>

              <div className="after-card">
                <p className="premium-label">With VENTIQ</p>

                <h3>One fund data core powers every dashboard</h3>

                <div className="core-summary-box">
                  <strong>VENTIQ</strong>
                  <span>One source of truth for dashboards, workflows and reporting</span>
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
                  portfolio updates and investor reporting feed the same operating layer.
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
                <section className="section" id="modules">
          <h2 className="section-title">
            Six stakeholder workspaces. One connected operating experience.
          </h2>

          <div className="stakeholder-workspace-card">
            <div className="stakeholder-workspace-header">
              <span>Role-Based Dashboards</span>

              <p>
                VENTIQ gives each stakeholder a focused workspace built on the
                same fund data core — so every team sees what matters to them
                without waiting for manual MIS, email follow-ups or offline files.
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
                  Capital calls, distributions, reconciliations, notices,
                  fees, investor statements and approval workflows.
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
                  Regulatory obligations, filing calendars, audit evidence,
                  Form 64C, Form 64D, QCR and GIFT City tracking.
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
                  Portfolio updates, company movement, repayment risk,
                  valuation changes, operating signals and exit readiness.
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
                the same fund data core.
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
                    Track QCR, TCR, Form 64C, Form 64D, SEBI, GIFT City,
                    audit readiness and regulatory evidence.
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
                <strong>AIF, GIFT City, IFSCA, FATCA, CRS and AML workflows</strong>
              </div>

              <div>
                <span>Control & Evidence</span>
                <strong>Approvals, notices, audit trail and supporting evidence linked to data</strong>
              </div>

              <div>
                <span>Investor Reporting Layer</span>
                <strong>Capital calls, distribution notices, statements, reports and documents in one place</strong>
              </div>
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
                investor reporting, portfolio intelligence and workflow execution.
              </p>

              <p>
                The platform is shaped around a simple operating problem: critical
                fund information still lives across spreadsheets, emails, fund
                administrators, shared folders and manual reporting cycles.
              </p>

              <div className="about-proof-list">
                <div>
                  <strong>Private capital focused</strong>
                  <span>VC, PE, Debt Funds, AIFs and GIFT City managers</span>
                </div>

                <div>
                  <strong>Workflow-first</strong>
                  <span>Capital calls, distributions, notices, compliance and reporting</span>
                </div>

                <div>
                  <strong>Stakeholder-ready</strong>
                  <span>Dashboards for partners, finance, compliance, investment teams and LPs</span>
                </div>
              </div>
            </div>

            <div className="about-founder-card">
              <span className="about-pill">Founder</span>

              <h3>Shubham Jain, CA</h3>

              <p>
                Chartered Accountant with experience across alternative investment
                funds, fund operations, investor reporting, fund reporting and
                private capital workflows.
              </p>

              <p>
                VENTIQ is being built from practical operating experience — not as
                another fund admin service, but as a connected operating system for
                the teams running private capital funds.
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
                Walk through the operating layer, stakeholder dashboards and
                workflow engines being built for fund operations, compliance,
                investor reporting, portfolio intelligence and LP communication.
              </p>

              <div className="final-cta-points">
                <span>Stakeholder dashboards</span>
                <span>Workflow engines</span>
                <span>Private capital operating layer</span>
              </div>
            </div>

            <div className="final-cta-right">
              <h3>Built for private capital teams ready to operate from one system.</h3>

              <p>
                Designed for fund managers, finance heads, compliance teams,
investment teams, investor relations teams and investors who need
real-time visibility from the same fund data core.
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
                  Submit Request
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