export default function ComplianceAIPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>AI Compliance Officer</h1>
            <p>
              AI control tower for SEBI AIF, GIFT City, tax reporting,
              regulatory filings, audit readiness and compliance workflows.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>Good Morning, Compliance Team</h2>

          <div className="explain-box">
            VENTIQ reviewed all compliance obligations overnight. QCR is due in
            4 days, Form 64C is due in 8 days, 2 investor KYC records need
            refresh, and audit evidence is 91% complete.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>4 days</h3>
            <p>QCR due</p>
          </div>

          <div className="impact-card">
            <h3>8 days</h3>
            <p>Form 64C due</p>
          </div>

          <div className="impact-card">
            <h3>2</h3>
            <p>KYC refresh pending</p>
          </div>

          <div className="impact-card">
            <h3>91%</h3>
            <p>Audit evidence ready</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Compliance Priority Radar</h2>

          <div className="queue-grid">
            <div className="queue-item">
              🔴 <strong>QCR Filing</strong>
              <br />
              Due in 4 days
              <br />
              NAV and investor data required
            </div>

            <div className="queue-item">
              🟡 <strong>Form 64C</strong>
              <br />
              Due in 8 days
              <br />
              Investor allocation data pending
            </div>

            <div className="queue-item">
              🟡 <strong>GIFT City Reporting</strong>
              <br />
              Monthly filing draft ready
              <br />
              Awaiting finance review
            </div>

            <div className="queue-item">
              🟢 <strong>Audit Trail</strong>
              <br />
              91% evidence complete
              <br />
              6 documents pending
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Compliance Checklist</h2>

          <div className="queue-grid">
            <div className="queue-item">🟢 NAV data imported</div>
            <div className="queue-item">🟢 Investor capital accounts mapped</div>
            <div className="queue-item">🟢 Distribution data validated</div>
            <div className="queue-item">🟡 Form 64C working pending review</div>
            <div className="queue-item">🟡 QCR narrative draft pending</div>
            <div className="queue-item">🔴 2 KYC refreshes pending</div>
            <div className="queue-item">🟢 Audit logs generated</div>
            <div className="queue-item">🟡 Trustee approval pending</div>
          </div>

          <div className="action-row">
            <button>Generate QCR Draft</button>
            <button>Prepare Form 64C</button>
            <button>Export Compliance Pack</button>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Filing Calendar</h2>

            <div className="journal-preview">
              <div className="journal-row">
                <span>QCR Filing</span>
                <strong>Due in 4 days • High priority</strong>
              </div>

              <div className="journal-row">
                <span>Form 64C</span>
                <strong>Due in 8 days • Draft required</strong>
              </div>

              <div className="journal-row">
                <span>Form 64D</span>
                <strong>Due in 21 days • Data gathering</strong>
              </div>

              <div className="journal-row">
                <span>GIFT Monthly Report</span>
                <strong>Draft ready • Finance review pending</strong>
              </div>

              <div className="journal-row">
                <span>Trustee Reporting</span>
                <strong>Next board pack due in 12 days</strong>
              </div>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Ask Compliance AI</h2>

            <div className="chat-message">
              Ask: “Which filings are due this week?”
            </div>

            <div className="chat-message">
              Ask: “What can delay QCR filing?”
            </div>

            <div className="chat-message">
              Ask: “Prepare Form 64C working.”
            </div>

            <div className="chat-message">
              Ask: “Show missing audit evidence.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Compliance AI Answer Preview</h2>

          <div className="explain-box">
            <strong>Question:</strong> What can delay QCR filing?
            <br />
            <br />
            <strong>VENTIQ AI:</strong> QCR may be delayed by pending NAV close,
            4 unresolved bank reconciliation exceptions, trustee approval and
            final investor capital account validation.
          </div>
        </div>

        <div className="preview-card">
          <h2>Audit Readiness</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>91%</h3>
              <p>Evidence completed</p>
            </div>

            <div className="impact-card">
              <h3>6</h3>
              <p>Documents pending</p>
            </div>

            <div className="impact-card">
              <h3>2</h3>
              <p>Open auditor queries</p>
            </div>

            <div className="impact-card">
              <h3>42 min</h3>
              <p>AI estimated completion</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}