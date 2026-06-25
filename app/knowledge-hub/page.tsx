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

        {/* AI Search */}

        <div className="preview-card">
          <h2>Ask VENTIQ AI</h2>

          <input
            placeholder="Ask anything... 'Show valuation circular' or 'Explain Form 64C'"
          />

          <div className="logic-note">
            Natural Language Search • AI Summary • Internal Knowledge • Related
            Workflows
          </div>
        </div>

        {/* Authorities */}

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

        {/* Recent */}

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

        {/* Search Result */}

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

        {/* AI Explanation */}

        <div className="preview-card">

          <h2>VENTIQ AI Explanation</h2>

          <div className="explain-box">

            This circular updates valuation methodology for Alternative
            Investment Funds. It impacts quarterly valuation,
            investor reporting, NAV calculation and audit support.

          </div>

        </div>

        {/* Compliance */}

        <div className="preview-card">

          <h2>Compliance Checklist</h2>

          <div className="queue-grid">

            <div className="queue-item">
              ✓ Update Valuation Policy
            </div>

            <div className="queue-item">
              ✓ Inform Auditors
            </div>

            <div className="queue-item">
              ✓ Review NAV Process
            </div>

            <div className="queue-item">
              ✓ Update Quarterly Reporting
            </div>

            <div className="queue-item">
              ✓ Train Finance Team
            </div>

            <div className="queue-item">
              ✓ Notify Investors
            </div>

          </div>

        </div>

        {/* Affected */}

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

        {/* Firm Knowledge */}

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