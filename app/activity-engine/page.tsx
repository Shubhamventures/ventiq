export default function ActivityEnginePage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Intelligence Layer</p>
            <h1>AI Activity Engine</h1>
            <p>
              The central intelligence layer connecting bank reconciliation,
              capital calls, NAV, investor reporting, compliance and audit.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>96%</h3>
            <p>System intelligence score</p>
          </div>
          <div className="impact-card">
            <h3>42</h3>
            <p>AI events processed today</p>
          </div>
          <div className="impact-card">
            <h3>8</h3>
            <p>Workflows connected</p>
          </div>
          <div className="impact-card">
            <h3>89%</h3>
            <p>Manual work reduced</p>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Live AI Activity Feed</h2>

            <div className="audit-timeline">
              <div className="audit-item">
                <strong>09:02</strong> Bank statement imported — AI classified
                184 transactions
              </div>
              <div className="audit-item">
                <strong>09:05</strong> 171 bank entries auto-matched and journal
                entries drafted
              </div>
              <div className="audit-item">
                <strong>09:07</strong> Capital Call #CC-2026-07 linked to SIDBI
                receipt
              </div>
              <div className="audit-item">
                <strong>09:09</strong> Cash forecast updated — runway increased
                to 61 days
              </div>
              <div className="audit-item">
                <strong>09:11</strong> NAV recalculation queued after bank
                reconciliation
              </div>
              <div className="audit-item">
                <strong>09:13</strong> QCR checklist updated automatically
              </div>
              <div className="audit-item">
                <strong>09:16</strong> Investor SOA generation prepared for 48
                LPs
              </div>
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>Ask Activity AI</h2>

            <div className="chat-message">
              Ask: “What changed across the platform today?”
            </div>
            <div className="chat-message">
              Ask: “Which event is blocking NAV?”
            </div>
            <div className="chat-message">
              Ask: “Explain why SIDBI receipt was linked.”
            </div>
            <div className="chat-message">
              Ask: “Show downstream impact of bank reconciliation.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Workflow Dependency Graph</h2>

          <div className="queue-grid">
            <div className="queue-item">Bank Statement Imported</div>
            <div className="queue-item">AI Transaction Reader</div>
            <div className="queue-item">Ledger Prediction</div>
            <div className="queue-item">Journal Entry Drafted</div>
            <div className="queue-item">Cash Position Updated</div>
            <div className="queue-item">NAV Recalculation</div>
            <div className="queue-item">Investor SOA Updated</div>
            <div className="queue-item">QCR Checklist Updated</div>
          </div>

          <div className="explain-box">
            One approved bank receipt can update accounting, capital calls, cash
            forecast, NAV, investor reporting, compliance checklists and the
            audit trail automatically.
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Reasoning</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Decision</span>
              <strong>Matched SIDBI receipt to Capital Call #CC-2026-07</strong>
            </div>
            <div className="journal-row">
              <span>Confidence</span>
              <strong>98%</strong>
            </div>
            <div className="journal-row">
              <span>Evidence</span>
              <strong>Narration, amount, investor history and ledger pattern</strong>
            </div>
            <div className="journal-row">
              <span>Risk</span>
              <strong>Low</strong>
            </div>
            <div className="journal-row">
              <span>Recommended Action</span>
              <strong>Approve match and post journal entry</strong>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Memory</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>SIDBI</h3>
              <p>Investor pattern learned</p>
            </div>
            <div className="impact-card">
              <h3>18</h3>
              <p>Past capital receipts matched</p>
            </div>
            <div className="impact-card">
              <h3>99.4%</h3>
              <p>Future confidence</p>
            </div>
            <div className="impact-card">
              <h3>2 days</h3>
              <p>Average payment delay</p>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Downstream Impact</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Journal entry ready</div>
            <div className="queue-item">✓ Cash position updated</div>
            <div className="queue-item">✓ Capital call marked received</div>
            <div className="queue-item">✓ NAV recalculation queued</div>
            <div className="queue-item">✓ Investor SOA updated</div>
            <div className="queue-item">✓ QCR checklist updated</div>
            <div className="queue-item">✓ Audit trail recorded</div>
            <div className="queue-item">✓ Mission Control health improved</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Learning Dashboard</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>12</h3>
              <p>Patterns learned today</p>
            </div>
            <div className="impact-card">
              <h3>4</h3>
              <p>New investors recognised</p>
            </div>
            <div className="impact-card">
              <h3>7</h3>
              <p>New narration styles</p>
            </div>
            <div className="impact-card">
              <h3>6h 42m</h3>
              <p>Manual work avoided</p>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>System Health</h2>

          <div className="queue-grid">
            <div className="queue-item">AI Engine — Operational</div>
            <div className="queue-item">Bank Reconciliation — 93% matched</div>
            <div className="queue-item">Capital Calls — 1 pending approval</div>
            <div className="queue-item">NAV — Waiting on review</div>
            <div className="queue-item">Compliance — QCR due in 4 days</div>
            <div className="queue-item">Investor Reporting — Drafted</div>
          </div>
        </div>
      </section>
    </main>
  );
}