export default function KnowledgeHub() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Intelligence</p>
            <h1>Knowledge Hub AI</h1>
            <p>
              Search regulations the way you think—not the way regulators name
              them.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>Ask VENTIQ AI</h2>

          <input placeholder="Ask anything... 'Show valuation circular' or 'Explain Form 64C'" />

          <div className="logic-note">
            Natural Language Search • AI Summary • Internal Knowledge • Related
            Workflows
          </div>
        </div>

        <div className="preview-card">
          <h2>Authorities</h2>

          <div className="queue-grid">
            <div className="queue-item">SEBI</div>
            <div className="queue-item">IFSCA</div>
            <div className="queue-item">Income Tax</div>
            <div className="queue-item">RBI</div>
            <div className="queue-item">MCA</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Recently Searched</h2>

          <div className="queue-grid">
            <div className="queue-item">Valuation</div>
            <div className="queue-item">Carry</div>
            <div className="queue-item">NAV</div>
            <div className="queue-item">Capital Call</div>
            <div className="queue-item">64C</div>
            <div className="queue-item">Quarterly Reporting</div>
            <div className="queue-item">GIFT City</div>
            <div className="queue-item">Management Fee</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Search Result</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Official Circular</span>
              <strong>SEBI Circular 23/2025</strong>
            </div>

            <div className="journal-row">
              <span>Saved As</span>
              <strong>Valuation Rules</strong>
            </div>

            <div className="journal-row">
              <span>Authority</span>
              <strong>SEBI</strong>
            </div>

            <div className="journal-row">
              <span>Impact</span>
              <strong>HIGH</strong>
            </div>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Aliases & Internal Names</h2>

            <p>
              VENTIQ allows teams to save technical circulars using the names
              they actually remember.
            </p>

            <div className="alias-grid">
              <span className="alias-pill">Valuation Rules</span>
              <span className="alias-pill">NAV Circular</span>
              <span className="alias-pill">Quarterly Valuation</span>
              <span className="alias-pill">Fair Value</span>
              <span className="alias-pill">QCR Valuation</span>
              <span className="alias-pill">Pricing Circular</span>
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>VENTIQ AI Chat</h2>

            <div className="chat-message">
              Ask: “What changed in this circular?”
            </div>

            <div className="chat-message">
              Ask: “Which workflows are affected?”
            </div>

            <div className="chat-message">
              Ask: “Create an SOP from this circular.”
            </div>

            <div className="chat-message">
              Ask: “Compare with previous circular.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Impact Score</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3 className="impact-score">HIGH</h3>
              <p>Regulatory impact</p>
            </div>

            <div className="impact-card">
              <h3>7</h3>
              <p>Affected workflows</p>
            </div>

            <div className="impact-card">
              <h3>12</h3>
              <p>Funds impacted</p>
            </div>

            <div className="impact-card">
              <h3>3</h3>
              <p>Pending actions</p>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Recommended Actions</h2>

          <div className="recommendation-summary">
            <div className="recommendation-summary-card">
              <h3>HIGH</h3>
              <p>Priority</p>
            </div>

            <div className="recommendation-summary-card">
              <h3>18 min</h3>
              <p>Estimated completion</p>
            </div>

            <div className="recommendation-summary-card">
              <h3>3</h3>
              <p>Teams affected</p>
            </div>

            <div className="recommendation-summary-card">
              <h3>7</h3>
              <p>Workflow links</p>
            </div>
          </div>

          <div className="recommended-actions">
            <div className="recommended-action-card primary">
              <div>
                <h3>⭐ Open Valuation Workspace</h3>
                <p>
                  Launch the valuation module with SEBI Circular 23/2025
                  preloaded.
                </p>
              </div>
              <span className="recommended-action-link">Open Workspace →</span>
            </div>

            <div className="recommended-action-card">
              <div>
                <h3>📋 Generate Compliance Checklist</h3>
                <p>
                  Create department-wise action items for finance, compliance
                  and audit.
                </p>
              </div>
              <span className="recommended-action-link">Generate →</span>
            </div>

            <div className="recommended-action-card">
              <div>
                <h3>📊 Compare Previous Circular</h3>
                <p>
                  Highlight all changes against the previous valuation circular.
                </p>
              </div>
              <span className="recommended-action-link">Compare →</span>
            </div>

            <div className="recommended-action-card">
              <div>
                <h3>👥 Assign Finance Team</h3>
                <p>Create review tasks and assign owners for implementation.</p>
              </div>
              <span className="recommended-action-link">Assign →</span>
            </div>

            <div className="recommended-action-card">
              <div>
                <h3>📣 Notify Auditors</h3>
                <p>Generate a draft notification for external auditors.</p>
              </div>
              <span className="recommended-action-link">Notify →</span>
            </div>

            <div className="recommended-action-card">
              <div>
                <h3>📄 Generate SOP</h3>
                <p>Create an updated SOP using the latest regulatory changes.</p>
              </div>
              <span className="recommended-action-link">Generate SOP →</span>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Related Circulars</h2>

          <div className="queue-grid">
            <div className="queue-item">AIF Valuation Update</div>
            <div className="queue-item">NAV Reporting Circular</div>
            <div className="queue-item">QCR Filing Clarification</div>
            <div className="queue-item">Investor Reporting Rules</div>
            <div className="queue-item">GIFT City Valuation Note</div>
            <div className="queue-item">Audit Support Circular</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>VENTIQ AI Explanation</h2>

          <div className="explain-box">
            This circular updates valuation methodology for Alternative
            Investment Funds. It impacts quarterly valuation, investor
            reporting, NAV calculation and audit support.
          </div>
        </div>

        <div className="preview-card">
          <h2>Compliance Checklist</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Update Valuation Policy</div>
            <div className="queue-item">✓ Inform Auditors</div>
            <div className="queue-item">✓ Review NAV Process</div>
            <div className="queue-item">✓ Update Quarterly Reporting</div>
            <div className="queue-item">✓ Train Finance Team</div>
            <div className="queue-item">✓ Notify Investors</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Affected Workflows</h2>

          <div className="queue-grid">
            <div className="queue-item">Capital Calls</div>
            <div className="queue-item">Valuation</div>
            <div className="queue-item">NAV</div>
            <div className="queue-item">Investor Reporting</div>
            <div className="queue-item">Accounting</div>
            <div className="queue-item">QCR</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Firm Knowledge</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Owner</span>
              <strong>Finance Head</strong>
            </div>

            <div className="journal-row">
              <span>Internal Note</span>
              <strong>
                Use this circular while preparing quarterly valuation packs.
              </strong>
            </div>

            <div className="journal-row">
              <span>Reviewed</span>
              <strong>15 June 2026</strong>
            </div>

            <div className="journal-row">
              <span>Linked SOP</span>
              <strong>Quarterly Valuation SOP v3</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}