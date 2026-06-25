export default function BankReconciliationPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Finance</p>
            <h1>AI Bank Reconciliation</h1>
            <p>
              AI-powered reconciliation that reads bank statements, explains
              matches, prepares journal entries and updates downstream fund
              workflows.
            </p>
          </div>

          <a className="back-link" href="/finance">
            Back to Finance
          </a>
        </div>

        <div className="preview-card">
          <h2>AI Processing Center</h2>

          <div className="explain-box">
            ████████████████████░ 96% complete
            <br />
            ✓ Bank statement imported
            <br />
            ✓ Reading narrations
            <br />
            ✓ Matching investor receipts
            <br />
            ✓ Comparing historical entries
            <br />
            ✓ Validating opening balance
            <br />
            ⏳ Preparing journal entries
            <br />
            <br />
            184 transactions processed • 171 auto-matched • 13 require review •
            estimated finish 38 seconds
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>184</h3>
            <p>Transactions imported</p>
          </div>

          <div className="impact-card">
            <h3>171</h3>
            <p>AI auto-matched</p>
          </div>

          <div className="impact-card">
            <h3>13</h3>
            <p>Review queue</p>
          </div>

          <div className="impact-card">
            <h3>98%</h3>
            <p>AI confidence</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Confidence</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>98%</h3>
              <p>Overall confidence</p>
            </div>

            <div className="impact-card">
              <h3>✓</h3>
              <p>Narration match</p>
            </div>

            <div className="impact-card">
              <h3>✓</h3>
              <p>Amount match</p>
            </div>

            <div className="impact-card">
              <h3>✓</h3>
              <p>Investor history</p>
            </div>
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
                    AI Confidence: 98%. Matched because narration contains
                    SIDBI, amount equals Capital Call #CC-2026-07, and the same
                    LP paid from this account last quarter.
                  </p>
                </div>
                <span className="recommended-action-link">Approve →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>🏦 Bank Interest Income</h3>
                  <p>
                    AI Confidence: 94%. Interest narration matched previous 11
                    months. Suggested ledger: Interest Income.
                  </p>
                </div>
                <span className="recommended-action-link">Approve →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>💸 Management Fee Payment</h3>
                  <p>
                    AI Confidence: 82%. Vendor recognised, but amount differs by
                    ₹5,000 from prior month. Needs finance review.
                  </p>
                </div>
                <span className="recommended-action-link">Review →</span>
              </div>

              <div className="recommended-action-card">
                <div>
                  <h3>⚠️ Unidentified Receipt</h3>
                  <p>
                    AI Confidence: 51%. Possible LP contribution, but no
                    matching capital call or historical pattern found.
                  </p>
                </div>
                <span className="recommended-action-link">Investigate →</span>
              </div>
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>VENTIQ AI</h2>

            <div className="chat-message">
              Ask: “Why was this transaction unmatched?”
            </div>

            <div className="chat-message">
              Ask: “Show AI reasoning for SIDBI receipt.”
            </div>

            <div className="chat-message">
              Ask: “Which transactions impact NAV?”
            </div>

            <div className="chat-message">
              Ask: “Create journal entries for approved matches.”
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
          <h2>Generated Journal Entry</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Source</span>
              <strong>Investor Capital Call Receipt</strong>
            </div>

            <div className="journal-row">
              <span>AI Confidence</span>
              <strong>98%</strong>
            </div>

            <div className="journal-row">
              <span>Dr Bank</span>
              <strong>₹5.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Cr Capital Receivable — SIDBI</span>
              <strong>₹5.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>AI Validation</span>
              <strong>Amount, narration and ledger verified</strong>
            </div>

            <div className="journal-row">
              <span>Status</span>
              <strong>Ready for approval</strong>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Validation Summary</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Opening balance verified</div>
            <div className="queue-item">✓ Closing balance reconciled</div>
            <div className="queue-item">✓ Capital call receipts identified</div>
            <div className="queue-item">✓ Interest income classified</div>
            <div className="queue-item">✓ 171 journal entries prepared</div>
            <div className="queue-item">⚠ 13 exceptions await review</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Learning</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>4</h3>
              <p>Patterns learned today</p>
            </div>

            <div className="impact-card">
              <h3>SIDBI</h3>
              <p>Capital call receipt pattern</p>
            </div>

            <div className="impact-card">
              <h3>94% → 99%</h3>
              <p>Future receipt confidence</p>
            </div>

            <div className="impact-card">
              <h3>11</h3>
              <p>Interest patterns matched</p>
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
          <h2>AI Timeline</h2>

          <div className="audit-timeline">
            <div className="audit-item">
              <strong>10:02</strong> ✓ Bank statement imported
            </div>

            <div className="audit-item">
              <strong>10:03</strong> ✓ AI extracted 184 transactions
            </div>

            <div className="audit-item">
              <strong>10:04</strong> ✓ AI matched 171 entries
            </div>

            <div className="audit-item">
              <strong>10:05</strong> ✓ AI generated journal entries
            </div>

            <div className="audit-item">
              <strong>10:06</strong> ⚠ Unknown receipt detected
            </div>

            <div className="audit-item">
              <strong>10:07</strong> Waiting finance approval
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Processing Summary</h2>

          <div className="queue-grid">
            <div className="queue-item">184 imported</div>
            <div className="queue-item">171 auto-matched</div>
            <div className="queue-item">13 exceptions</div>
            <div className="queue-item">4 journal entries generated</div>
            <div className="queue-item">1 unknown receipt</div>
            <div className="queue-item">Ready for finance approval</div>
          </div>
        </div>
      </section>
    </main>
  );
}