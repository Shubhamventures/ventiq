export default function FundraisingAIPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>AI Fundraising & Investor Relations</h1>
            <p>
              AI workspace for LP pipeline, fundraising progress, DDQs, meeting
              briefs, follow-ups, relationship intelligence and fund close
              prediction.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <div className="sample-data-ribbon">
  Sample investor relations workspace preview · Illustrative data
</div>
          <h2>Investor Relations Workspace Preview</h2>

          <div className="explain-box">
            VENTIQ reviewed your fundraising pipeline overnight. Fund IV is 64%
            subscribed, ₹640 Cr soft commitments are active, 3 DDQs are pending,
            and 2 LP meetings need preparation this week.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>₹640 Cr</h3>
            <p>Soft commitments</p>
          </div>

          <div className="impact-card">
            <h3>64%</h3>
            <p>Fund IV subscribed</p>
          </div>

          <div className="impact-card">
            <h3>3</h3>
            <p>DDQs pending</p>
          </div>

          <div className="impact-card">
            <h3>2</h3>
            <p>LP meetings this week</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI LP Pipeline</h2>

          <div className="queue-grid">
            <div className="queue-item">
              🟢 <strong>Sovereign Fund</strong>
              <br />
              ₹250 Cr potential commitment
              <br />
              Close probability: 82%
            </div>

            <div className="queue-item">
              🟡 <strong>Insurance Company</strong>
              <br />
              ₹150 Cr potential commitment
              <br />
              Close probability: 68%
            </div>

            <div className="queue-item">
              🟢 <strong>Family Office</strong>
              <br />
              ₹75 Cr potential commitment
              <br />
              Close probability: 74%
            </div>

            <div className="queue-item">
              🔴 <strong>Pension Fund</strong>
              <br />
              ₹300 Cr potential commitment
              <br />
              Close probability: 48%
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Fundraising Intelligence</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>₹1,000 Cr</h3>
              <p>Target fund size</p>
            </div>

            <div className="impact-card">
              <h3>₹640 Cr</h3>
              <p>Soft circled</p>
            </div>

            <div className="impact-card">
              <h3>₹360 Cr</h3>
              <p>Remaining target</p>
            </div>

            <div className="impact-card">
              <h3>47 days</h3>
              <p>AI predicted first close</p>
            </div>
          </div>

          <div className="explain-box">
            AI recommendation: Prioritize the sovereign fund and family office.
            Both have high alignment with the strategy, strong engagement, and
            recent activity on the LP presentation.
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>AI Investor Relations Workbench</h2>

            <div className="queue-grid">
              <div className="queue-item">✓ Generate LP meeting brief</div>
              <div className="queue-item">✓ Prepare DDQ responses</div>
              <div className="queue-item">✓ Update fundraising deck</div>
              <div className="queue-item">✓ Draft follow-up emails</div>
              <div className="queue-item">✓ Prepare track record summary</div>
              <div className="queue-item">✓ Identify next best action</div>
            </div>

            <div className="action-row">
              <button>Generate Meeting Brief</button>
              <button>Prepare DDQ Pack</button>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Ask Fundraising AI</h2>

            <div className="chat-message">
              Ask: “Which LPs should we prioritize this week?”
            </div>

            <div className="chat-message">
              Ask: “Generate DDQ response pack.”
            </div>

            <div className="chat-message">
              Ask: “Prepare sovereign fund meeting brief.”
            </div>

            <div className="chat-message">
              Ask: “Draft follow-up email for the family office.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Fundraising AI Answer Preview</h2>

          <div className="explain-box">
            <strong>Question:</strong> Which LPs should we prioritize this week?
            <br />
            <br />
            <strong>VENTIQ AI:</strong> Prioritize the sovereign fund and family
            office. The sovereign fund has reviewed the deck 4 times, requested
            attribution details, and has an 82% close probability. The family
            office has strong sector alignment and a 74% close probability.
          </div>
        </div>

        <div className="preview-card">
          <h2>DDQ Auto Generator</h2>

          <div className="queue-grid">
            <div className="queue-item">✓ Fund strategy responses</div>
            <div className="queue-item">✓ Track record data</div>
            <div className="queue-item">✓ Team bios</div>
            <div className="queue-item">✓ Risk framework</div>
            <div className="queue-item">✓ ESG policy</div>
            <div className="queue-item">✓ Compliance disclosures</div>
            <div className="queue-item">✓ Portfolio construction</div>
            <div className="queue-item">✓ Final review queue</div>
          </div>

          <div className="action-row">
            <button>Generate DDQ Pack</button>
            <button>Create LP Data Room</button>
          </div>
        </div>
      </section>
    </main>
  );
}