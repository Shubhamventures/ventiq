export default function BankReconciliationPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Finance</p>
            <h1>AI Bank Reconciliation</h1>
            <p>
              Import bank statements, auto-match transactions, review exceptions,
              generate accounting entries and close reconciliation with AI.
            </p>
          </div>

          <a className="back-link" href="/finance">
            Back to Finance
          </a>
        </div>

        <div className="preview-card">
          <h2>Upload Bank Statement</h2>

          <div className="explain-box">
            Drop bank statement here or import from connected bank account.
            VENTIQ AI will read transactions, match ledger entries and flag
            exceptions.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>184</h3>
            <p>Transactions imported</p>
          </div>

          <div className="impact-card">
            <h3>171</h3>
            <p>Auto-matched</p>
          </div>

          <div className="impact-card">
            <h3>13</h3>
            <p>Need review</p>
          </div>

          <div className="impact-card">
            <h3>93%</h3>
            <p>AI match accuracy</p>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>AI Matching Queue</h2>

            <div className="recommended-actions">
              <div className="recommended-action-card primary">
                <div>
                  <h3>⭐ Investor Capital Call Receipt</h3>
                  <p>
                    ₹5 Cr received from SIDBI. AI matched this against Capital
                    Call #CC-2026-07.
                  </p>
                </div>
                <span className="recommended-action-link">Approve →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>🏦 Bank Interest Income</h3>
                  <p>
                    ₹12.4 L interest credited. Suggested ledger: Interest
                    Income.
                  </p>
                </div>
                <span className="recommended-action-link">Approve →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>💸 Management Fee Payment</h3>
                  <p>
                    ₹18 L paid to investment manager. Suggested ledger:
                    Management Fees.
                  </p>
                </div>
                <span className="recommended-action-link">Review →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>⚠️ Unidentified Receipt</h3>
                  <p>
                    ₹42 L receipt detected. No confident ledger match found.
                  </p>
                </div>
                <span className="recommended-action-link">Investigate →</span>
              </div>
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>VENTIQ AI Reconciliation</h2>

            <div className="chat-message">
              Ask: “Why was this transaction unmatched?”
            </div>

            <div className="chat-message">
              Ask: “Show all capital call receipts.”
            </div>

            <div className="chat-message">
              Ask: “Create journal entries for approved matches.”
            </div>

            <div className="chat-message">
              Ask: “Which transactions impact NAV?”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Exception Review</h2>

          <table className="investor-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>AI Suggestion</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>25 Jun</td>
                <td>NEFT SIDBI CAPITAL</td>
                <td>₹5.00 Cr</td>
                <td>Capital Call Receipt</td>
                <td>98%</td>
                <td>🟢 Auto-match</td>
              </tr>

              <tr>
                <td>25 Jun</td>
                <td>BANK INT CREDIT</td>
                <td>₹12.4 L</td>
                <td>Interest Income</td>
                <td>94%</td>
                <td>🟢 Auto-match</td>
              </tr>

              <tr>
                <td>26 Jun</td>
                <td>IM FEE PAYMENT</td>
                <td>₹18.0 L</td>
                <td>Management Fees</td>
                <td>82%</td>
                <td>🟡 Review</td>
              </tr>

              <tr>
                <td>26 Jun</td>
                <td>UNKNOWN CREDIT</td>
                <td>₹42.0 L</td>
                <td>Possible investor receipt</td>
                <td>51%</td>
                <td>🔴 Investigate</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="preview-card">
          <h2>AI Validation</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Opening balance matched</div>
            <div className="queue-item">✓ Closing balance reconciled</div>
            <div className="queue-item">✓ 171 transactions auto-mapped</div>
            <div className="queue-item">⚠ 13 transactions require review</div>
            <div className="queue-item">✓ Capital call receipts identified</div>
            <div className="queue-item">⚠ One unidentified receipt found</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Journal Entry Preview</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Dr Bank</span>
              <strong>₹5.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Cr Capital Receivable — SIDBI</span>
              <strong>₹5.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Status</span>
              <strong>Ready for approval</strong>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Reconciliation Impact</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>38 min</h3>
              <p>AI predicted completion</p>
            </div>

            <div className="impact-card">
              <h3>6 hrs</h3>
              <p>Manual time avoided</p>
            </div>

            <div className="impact-card">
              <h3>₹5.42 Cr</h3>
              <p>Cash classified</p>
            </div>

            <div className="impact-card">
              <h3>89%</h3>
              <p>Time saved</p>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Audit Trail</h2>

          <div className="audit-timeline">
            <div className="audit-item">
              <strong>10:02</strong> Bank statement imported
            </div>

            <div className="audit-item">
              <strong>10:03</strong> AI read 184 transactions
            </div>

            <div className="audit-item">
              <strong>10:04</strong> 171 transactions auto-matched
            </div>

            <div className="audit-item">
              <strong>10:05</strong> 13 exceptions sent to review queue
            </div>

            <div className="audit-item">
              <strong>10:07</strong> Journal entries prepared in draft
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}