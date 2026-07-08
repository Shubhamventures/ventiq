export default function InvestmentTeamAIPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>AI Investment Team</h1>
            <p>
              AI workspace for deal sourcing, diligence, valuation, IC memos,
              founder notes, portfolio monitoring and investment decisions.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <div className="sample-data-ribbon">
  Sample investment workspace preview · Illustrative data
</div>
          <h2>Investment Team Workspace Preview</h2>

          <div className="explain-box">
            VENTIQ reviewed your deal pipeline overnight. 14 active deals are in
            review, 3 need IC attention, 2 have valuation gaps, and 1 portfolio
            company needs follow-on decision this week.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>14</h3>
            <p>Active deals</p>
          </div>

          <div className="impact-card">
            <h3>3</h3>
            <p>IC-ready deals</p>
          </div>

          <div className="impact-card">
            <h3>2</h3>
            <p>Valuation gaps</p>
          </div>

          <div className="impact-card">
            <h3>1</h3>
            <p>Follow-on decision</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Deal Pipeline</h2>

          <div className="queue-grid">
            <div className="queue-item">
              🟢 <strong>Fintech SaaS</strong>
              <br />
              Series A • ₹35 Cr round
              <br />
              AI Score: 91%
            </div>

            <div className="queue-item">
              🟡 <strong>HealthTech Platform</strong>
              <br />
              Pre-Series A • ₹18 Cr round
              <br />
              AI Score: 82%
            </div>

            <div className="queue-item">
              🔴 <strong>D2C Brand</strong>
              <br />
              Growth round • ₹50 Cr round
              <br />
              AI Score: 64%
            </div>

            <div className="queue-item">
              🟢 <strong>B2B Marketplace</strong>
              <br />
              Series B • ₹75 Cr round
              <br />
              AI Score: 88%
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Investment Decision Engine</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>92%</h3>
              <p>Founder quality</p>
            </div>

            <div className="impact-card">
              <h3>89%</h3>
              <p>Market attractiveness</p>
            </div>

            <div className="impact-card">
              <h3>84%</h3>
              <p>Financial strength</p>
            </div>

            <div className="impact-card">
              <h3>₹120 Cr</h3>
              <p>Suggested valuation</p>
            </div>
          </div>

          <div className="explain-box">
            AI recommendation: Proceed to IC for Fintech SaaS. Strong founder
            market fit, improving revenue retention, attractive TAM and
            reasonable valuation after negotiation.
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>AI Diligence Tracker</h2>

            <div className="queue-grid">
              <div className="queue-item">🟢 Founder background verified</div>
              <div className="queue-item">🟢 Revenue cohort uploaded</div>
              <div className="queue-item">🟡 Customer references pending</div>
              <div className="queue-item">🟡 Legal diligence pending</div>
              <div className="queue-item">🔴 Valuation bridge required</div>
              <div className="queue-item">🟢 Market map prepared</div>
            </div>

            <div className="action-row">
              <button>Generate IC Memo</button>
              <button>Prepare Red Flag Report</button>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Ask Investment AI</h2>

            <div className="chat-message">
              Ask: “Should we invest in Fintech SaaS?”
            </div>

            <div className="chat-message">
              Ask: “Generate IC memo.”
            </div>

            <div className="chat-message">
              Ask: “Show valuation concerns.”
            </div>

            <div className="chat-message">
              Ask: “Compare this deal with portfolio companies.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Investment AI Answer Preview</h2>

          <div className="explain-box">
            <strong>Question:</strong> Should we invest in Fintech SaaS?
            <br />
            <br />
            <strong>VENTIQ AI:</strong> Recommend moving to IC with conditions.
            Negotiate valuation from ₹140 Cr to ₹120 Cr, complete customer
            references, and reserve ₹8 Cr for follow-on. Current investment
            confidence is 91%.
          </div>
        </div>

        <div className="preview-card">
          <h2>IC Memo Generator</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Company overview</div>
            <div className="queue-item">✓ Founder assessment</div>
            <div className="queue-item">✓ Market thesis</div>
            <div className="queue-item">✓ Financial analysis</div>
            <div className="queue-item">✓ Valuation bridge</div>
            <div className="queue-item">✓ Risks and mitigants</div>
            <div className="queue-item">✓ Investment recommendation</div>
            <div className="queue-item">✓ IC presentation draft</div>
          </div>

          <div className="action-row">
            <button>Generate IC Memo</button>
            <button>Create IC Deck</button>
          </div>
        </div>
      </section>
    </main>
  );
}