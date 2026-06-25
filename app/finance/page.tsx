export default function FinancePage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">Finance Workspace</p>
            <h1>Mission Control</h1>
            <p>
              One daily dashboard for fund finance, compliance, investor
              reporting, cash movement, valuation and AI-driven priority
              management.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="workflow-progress">
          <h2>Today&apos;s Finance Priorities</h2>

          <div className="progress-steps">
            <div className="progress-step active">QCR due in 4 days</div>
            <div className="progress-step active">13 bank items pending</div>
            <div className="progress-step active">48 LP emails pending</div>
            <div className="progress-step active">64C data pending</div>
            <div className="progress-step">NAV review pending</div>
            <div className="progress-step">Audit query open</div>
            <div className="progress-step">GIFT filing review</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Daily Brief</h2>

          <div className="explain-box">
            VENTIQ recommends starting with bank reconciliation because 13
            transactions are unmapped. This may impact NAV, QCR and investor
            reporting if not closed today.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>₹25 Cr</h3>
            <p>Capital call under approval</p>
          </div>

          <div className="impact-card">
            <h3>13</h3>
            <p>Bank transactions need review</p>
          </div>

          <div className="impact-card">
            <h3>4 days</h3>
            <p>QCR filing due</p>
          </div>

          <div className="impact-card">
            <h3>48</h3>
            <p>Investor emails pending</p>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Fund Operations Queue</h2>

            <div className="recommended-actions">
              <div className="recommended-action-card primary">
                <div>
                  <h3>🏦 Bank Reconciliation</h3>
                  <p>
                    184 transactions imported, 171 auto-mapped, 13 need review.
                  </p>
                </div>
                <span className="recommended-action-link">Review →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>💰 Capital Call</h3>
                  <p>
                    ₹25 Cr call is awaiting Finance Head review before notices
                    are generated.
                  </p>
                </div>
                <span className="recommended-action-link">Open →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>📩 Investor Communications</h3>
                  <p>
                    SOA and distribution notice emails are drafted for 48 LPs.
                  </p>
                </div>
                <span className="recommended-action-link">Send →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>📊 Valuation Pack</h3>
                  <p>
                    Quarterly fair value comparison needs final finance review.
                  </p>
                </div>
                <span className="recommended-action-link">Review →</span>
              </div>
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>VENTIQ AI</h2>

            <div className="chat-message">
              Ask: “What should I complete first today?”
            </div>

            <div className="chat-message">
              Ask: “Which tasks impact QCR?”
            </div>

            <div className="chat-message">
              Ask: “Show investor emails pending approval.”
            </div>

            <div className="chat-message">
              Ask: “Prepare today&apos;s finance summary.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Compliance Tracker</h2>

          <div className="queue-grid">
            <div className="queue-item">QCR — Due in 4 days</div>
            <div className="queue-item">TCR — On track</div>
            <div className="queue-item">Form 64C — Pending data</div>
            <div className="queue-item">Form 64D — Drafting</div>
            <div className="queue-item">GIFT City — Review required</div>
            <div className="queue-item">FATCA / CRS — Scheduled</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Investor Reporting</h2>

          <div className="queue-grid">
            <div className="queue-item">Quarterly SOA — Ready</div>
            <div className="queue-item">Distribution Notices — Drafted</div>
            <div className="queue-item">Capital Call Notices — Pending Approval</div>
            <div className="queue-item">LP Queries — 12 Open</div>
            <div className="queue-item">Portal Uploads — Pending</div>
            <div className="queue-item">WhatsApp Alerts — Not Sent</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Finance Audit Trail</h2>

          <div className="audit-timeline">
            <div className="audit-item">
              <strong>09:15</strong> Bank statement imported
            </div>

            <div className="audit-item">
              <strong>09:18</strong> 171 transactions auto-mapped
            </div>

            <div className="audit-item">
              <strong>09:24</strong> QCR checklist updated
            </div>

            <div className="audit-item">
              <strong>09:31</strong> Capital call allocation sent for approval
            </div>

            <div className="audit-item">
              <strong>09:40</strong> Investor communication drafts generated
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}