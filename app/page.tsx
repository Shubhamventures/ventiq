export default function Home() {
  return (
    <main>
      <div className="container">
        <nav className="navbar">
          <h2>VENTIQ</h2>

          <div className="nav-links">
            <a href="#solutions">Solutions</a>
            <a href="#modules">Modules</a>
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
            Manage funds, investors, compliance, accounting, fundraising and
            portfolio intelligence from one intelligent platform built for
            modern VC, PE, Debt Funds, AIFs and GIFT City managers.
          </p>

          <a className="btn" href="#contact">
            Request Demo
          </a>
        </section>

        <section className="metrics">
          <div className="card">
            <h2>₹12,500 Cr</h2>
            <p>Assets Under Management</p>
          </div>

          <div className="card">
            <h2>24.3%</h2>
            <p>Portfolio IRR</p>
          </div>

          <div className="card">
            <h2>98%</h2>
            <p>Compliance Health</p>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">AI Command Center</h2>

          <div className="dashboard-card">
            <div className="dashboard-title">
              Good Morning Shubham 👋
            </div>

            <p>
              VENTIQ reviewed your investment firm overnight. 5 AI teams
              analysed 4 active funds, 187 transactions, 14 deals, 6 compliance
              workflows and ₹640 Cr of fundraising pipeline.
            </p>

            <br />

            <div className="dashboard-grid">
              <div className="dashboard-metric">
                <h3>94%</h3>
                <p>Firm Health</p>
              </div>

              <div className="dashboard-metric">
                <h3>7</h3>
                <p>Priority Actions</p>
              </div>

              <div className="dashboard-metric">
                <h3>2h 18m</h3>
                <p>Workload Today</p>
              </div>
            </div>

            <div className="alert-box">
              <p>💰 Finance AI: ₹18.5 Cr distribution ready</p>
              <p>🛡️ Compliance AI: QCR due in 4 days</p>
              <p>📈 Investment AI: 3 IC-ready deals</p>
              <p>🤝 Fundraising AI: Sovereign Fund close probability 82%</p>
              <p>👔 Managing Partner AI: Fund III TVPI updated to 2.2x</p>
            </div>
          </div>
        </section>

        <section className="section" id="modules">
          <h2 className="section-title">
            One AI. Six Specialists. One Operating System.
          </h2>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="badge">Finance AI</div>

              <h3>Fund Operations</h3>

              <p>
                Bank reconciliation, capital calls, distribution waterfalls,
                management fees and investor reporting.
              </p>

              <br />

              <a href="/finance-head-ai">Open Workspace →</a>
            </div>

            <div className="feature-card">
              <div className="badge">Managing Partner AI</div>

              <h3>Executive Decisions</h3>

              <p>
                Dry powder, deployment, exits, TVPI, fundraising strategy and
                portfolio risk.
              </p>

              <br />

              <a href="/managing-partner-ai">Open Workspace →</a>
            </div>

            <div className="feature-card">
              <div className="badge">Compliance AI</div>

              <h3>Regulatory Control</h3>

              <p>
                QCR, Form 64C, Form 64D, SEBI, GIFT City and audit readiness.
              </p>

              <br />

              <a href="/compliance-ai">Open Workspace →</a>
            </div>

            <div className="feature-card">
              <div className="badge">Investment AI</div>

              <h3>Investment Engine</h3>

              <p>
                Deal sourcing, diligence, valuation, IC memos and investment
                recommendations.
              </p>

              <br />

              <a href="/investment-team-ai">Open Workspace →</a>
            </div>

            <div className="feature-card">
              <div className="badge">Fundraising AI</div>

              <h3>LP Intelligence</h3>

              <p>
                DDQs, LP meetings, fundraising pipeline, relationship
                intelligence and follow-ups.
              </p>

              <br />

              <a href="/fundraising-ai">Open Workspace →</a>
            </div>

            <div className="feature-card">
              <div className="badge">Investor Portal</div>

              <h3>LP Experience</h3>

              <p>
                Capital calls, distributions, fund performance, documents and
                investor communication.
              </p>

              <br />

              <a href="/investor-portal">Open Workspace →</a>
            </div>
          </div>
        </section>

        <section className="section" id="solutions">
          <h2 className="section-title">
            One Platform. Three Experiences.
          </h2>

          <div className="three-users">
            <div className="user-card">
              <h3>Managing Partner</h3>

              <ul>
                <li>IRR, DPI and TVPI tracking</li>
                <li>Fund deployment monitoring</li>
                <li>Portfolio health and risk alerts</li>
                <li>Exit simulation and LP storytelling</li>
                <li>Fundraising deck generation</li>
              </ul>
            </div>

            <div className="user-card">
              <h3>Finance & Compliance</h3>

              <ul>
                <li>Bank reconciliation</li>
                <li>Capital calls and distributions</li>
                <li>Accounting journals</li>
                <li>QCR, TCR, Form 64C and Form 64D</li>
                <li>Audit readiness and evidence tracking</li>
              </ul>
            </div>

            <div className="user-card">
              <h3>Investors and LPs</h3>

              <ul>
                <li>Capital call notices</li>
                <li>Distribution updates</li>
                <li>Fund performance and IRR</li>
                <li>Document vault and tax certificates</li>
                <li>AI-powered investor queries</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <h2 className="section-title">
            Fund Intelligence Platform
          </h2>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="badge">Compliance</div>

              <h3>Compliance Command Center</h3>

              <p>
                Track QCR, TCR, Form 64C, Form 64D, SEBI filings, GIFT City
                compliance and custom regulatory workflows.
              </p>
            </div>

            <div className="feature-card">
              <div className="badge">Economics</div>

              <h3>Fee & Carry Engine</h3>

              <p>
                Monitor management fees, carry accruals, waterfall
                calculations, GP commitments and fund-level revenue.
              </p>
            </div>

            <div className="feature-card">
              <div className="badge">Portfolio</div>

              <h3>Portfolio Intelligence</h3>

              <p>
                Track valuation changes, revenue growth, portfolio risk, exit
                readiness and quarter-on-quarter performance.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">
            Performance Intelligence Snapshot
          </h2>

          <div className="dashboard-card">
            <div className="dashboard-row">
              <div className="mini-card">
                <h4>24.3%</h4>
                <p>Fund IRR</p>
              </div>

              <div className="mini-card">
                <h4>1.8x</h4>
                <p>DPI</p>
              </div>

              <div className="mini-card">
                <h4>2.7x</h4>
                <p>TVPI</p>
              </div>

              <div className="mini-card">
                <h4>₹118 Cr</h4>
                <p>Uncalled Capital</p>
              </div>
            </div>

            <div className="alert-list">
              <p>🟢 Expected Distribution: ₹41 Cr</p>
              <p>🟡 QCR due in 4 days</p>
              <p>🔴 ABC Logistics revenue down 12%</p>
              <p>🟢 Carry Generated: ₹6 Cr</p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">
            AI Collaboration Layer
          </h2>

          <div className="dashboard-card">
            <div className="priority-grid">
              <div className="priority-card">
                <h3>AI-to-AI Signals</h3>

                <div className="priority-item">
                  <span>Finance → Compliance</span>
                  <strong>QCR risk</strong>
                </div>

                <div className="priority-item">
                  <span>Investment → Managing Partner</span>
                  <strong>Exit impact</strong>
                </div>

                <div className="priority-item">
                  <span>Fundraising → MP</span>
                  <strong>LP deck request</strong>
                </div>

                <div className="priority-item">
                  <span>Distribution → Investor Portal</span>
                  <strong>LP update ready</strong>
                </div>

                <div className="recommendation">
                  AI Recommendation: Prioritize bank reconciliation and QCR
                  preparation before releasing investor distribution updates.
                </div>
              </div>

              <div className="priority-card">
                <h3>Recommended Actions</h3>

                <a className="action-button" href="/capital-call">
                  Generate Capital Call
                </a>

                <br />

                <a className="action-button" href="/distribution-waterfall">
                  Run Distribution Waterfall
                </a>

                <br />

                <a className="action-button" href="/compliance-ai">
                  Generate Compliance Pack
                </a>

                <br />

                <a className="action-button" href="/fundraising-ai">
                  Prepare LP Deck
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">
            GIFT City Ready
          </h2>

          <div className="dashboard-card">
            <div className="dashboard-grid">
              <div className="dashboard-metric">
                <h3>IFSCA</h3>
                <p>Compliance Tracking</p>
              </div>

              <div className="dashboard-metric">
                <h3>FATCA</h3>
                <p>CRS Monitoring</p>
              </div>

              <div className="dashboard-metric">
                <h3>AML</h3>
                <p>KYC Management</p>
              </div>
            </div>

            <div className="alert-box">
              <p>✓ International investor reporting</p>
              <p>✓ Regulatory calendar</p>
              <p>✓ Fund-level and investor-level compliance workflows</p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Live Fund Operations Workspace</h2>

          <div className="workspace">
            <div className="workspace-header">
              <div>
                <h3>Today&apos;s Fund Operations</h3>
                <p>
                  Automate the work that finance and compliance teams manually
                  track every quarter.
                </p>
              </div>

              <div className="status-pill">12 tasks need attention</div>
            </div>

            <div className="workflow-grid">
              <div className="workflow-card">
                <h3>Bank Reconciliation Queue</h3>

                <div className="workflow-row">
                  <span>Transactions imported</span>
                  <strong>184</strong>
                </div>

                <div className="workflow-row">
                  <span>Auto-mapped</span>
                  <strong>171</strong>
                </div>

                <div className="workflow-row">
                  <span>Needs review</span>
                  <strong>13</strong>
                </div>

                <a className="workflow-action" href="/finance-head-ai">
                  Review Transactions
                </a>
              </div>

              <div className="workflow-card">
                <h3>Compliance Tracker</h3>

                <div className="workflow-row">
                  <span>QCR</span>
                  <strong>Due in 4 days</strong>
                </div>

                <div className="workflow-row">
                  <span>Form 64C</span>
                  <strong>Pending data</strong>
                </div>

                <div className="workflow-row">
                  <span>GIFT City filing</span>
                  <strong>On track</strong>
                </div>

                <a className="workflow-action" href="/compliance-ai">
                  Open Compliance Hub
                </a>
              </div>

              <div className="workflow-card">
                <h3>Capital Call Workflow</h3>

                <div className="workflow-row">
                  <span>Draft notices</span>
                  <strong>22</strong>
                </div>

                <div className="workflow-row">
                  <span>Institutional format</span>
                  <strong>Required</strong>
                </div>

                <div className="workflow-row">
                  <span>Expected call amount</span>
                  <strong>₹25 Cr</strong>
                </div>

                <a className="workflow-action" href="/capital-call">
                  Generate Capital Call
                </a>
              </div>

              <div className="workflow-card">
                <h3>Investor Communications</h3>

                <div className="workflow-row">
                  <span>Quarterly SOAs</span>
                  <strong>Ready</strong>
                </div>

                <div className="workflow-row">
                  <span>Distribution notices</span>
                  <strong>Drafted</strong>
                </div>

                <div className="workflow-row">
                  <span>Emails pending</span>
                  <strong>48</strong>
                </div>

                <a className="workflow-action" href="/investor-portal">
                  Send Communications
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="contact">
          <div className="final-cta-card">
            <h2>
              Ready to see how VENTIQ runs a private capital firm?
            </h2>

            <p>
              Explore the AI workspaces built for finance, compliance,
              investment teams, managing partners, fundraising teams and LPs.
            </p>

            <div className="final-cta-actions">
              <a className="final-primary-button" href="/finance-head-ai">
                Explore VENTIQ Workspaces →
              </a>
            </div>
          </div>
        </section>
        <footer className="footer">
          © 2026 VENTIQ — AI Powered Operating System for Private Capital
        </footer>
      </div>
    </main>
  );
}