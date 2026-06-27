export default function InvestorPortalPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Experience</p>
            <h1>AI Investor Portal</h1>
            <p>
              One intelligent view for LP commitments, capital calls,
              distributions, performance, documents and AI-powered investor
              queries.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>Welcome back, SIDBI</h2>

          <div className="explain-box">
            VENTIQ has reviewed your portfolio across 3 active funds. You have
            ₹120 Cr committed, ₹82 Cr called, ₹34 Cr distributed and ₹38 Cr
            remaining commitment.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>₹120 Cr</h3>
            <p>Total commitment</p>
          </div>

          <div className="impact-card">
            <h3>₹82 Cr</h3>
            <p>Capital called</p>
          </div>

          <div className="impact-card">
            <h3>₹34 Cr</h3>
            <p>Distributed</p>
          </div>

          <div className="impact-card">
            <h3>₹38 Cr</h3>
            <p>Remaining commitment</p>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>18.4%</h3>
            <p>Portfolio IRR</p>
          </div>

          <div className="impact-card">
            <h3>2.10x</h3>
            <p>TVPI</p>
          </div>

          <div className="impact-card">
            <h3>1.40x</h3>
            <p>DPI</p>
          </div>

          <div className="impact-card">
            <h3>99%</h3>
            <p>AI health score</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>My Investments</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Growth Fund II</strong>
              <br />
              Commitment: ₹40 Cr
              <br />
              Called: ₹28 Cr
              <br />
              Distributed: ₹16 Cr
              <br />
              IRR: 22%
              <br />
              🟢 Healthy
            </div>

            <div className="queue-item">
              <strong>Venture Debt Fund III</strong>
              <br />
              Commitment: ₹50 Cr
              <br />
              Called: ₹36 Cr
              <br />
              Distributed: ₹12 Cr
              <br />
              IRR: 16%
              <br />
              🟢 Performing
            </div>

            <div className="queue-item">
              <strong>GIFT City Fund I</strong>
              <br />
              Commitment: ₹30 Cr
              <br />
              Called: ₹18 Cr
              <br />
              Distributed: ₹6 Cr
              <br />
              IRR: 14%
              <br />
              🟡 Monitoring
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Pending Actions</h2>

          <div className="queue-grid">
            <div className="queue-item">
              🔵 Capital Call Notice
              <br />
              Due Tomorrow
              <br />
              ₹4.5 Cr
            </div>

            <div className="queue-item">
              🟢 Distribution Approved
              <br />
              ₹3.8 Cr
              <br />
              Ready for download
            </div>

            <div className="queue-item">
              🟡 Tax Certificate
              <br />
              FY 2026
              <br />
              Available
            </div>

            <div className="queue-item">
              🟢 Quarterly Report
              <br />
              Q2 2026
              <br />
              Ready
            </div>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Recent Activity</h2>

            <div className="audit-timeline">
              <div className="audit-item">
                <strong>Today</strong> Distribution posted
              </div>

              <div className="audit-item">
                <strong>Yesterday</strong> NAV updated
              </div>

              <div className="audit-item">
                <strong>3 Days Ago</strong> Capital call generated
              </div>

              <div className="audit-item">
                <strong>1 Week Ago</strong> Valuation approved
              </div>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Ask VENTIQ AI</h2>

            <div className="chat-message">
              Ask: “How much commitment remains?”
            </div>

            <div className="chat-message">
              Ask: “Show my IRR by fund.”
            </div>

            <div className="chat-message">
              Ask: “Why did I receive ₹3.8 Cr distribution?”
            </div>

            <div className="chat-message">
              Ask: “Download my latest SOA.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Investor Answer Preview</h2>

          <div className="explain-box">
            <strong>Question:</strong> How much commitment remains?
            <br />
            <br />
            <strong>VENTIQ AI:</strong> You have ₹38 Cr remaining commitment
            across 3 active funds. The next expected capital call is for ₹4.5 Cr
            in Venture Debt Fund III and is due tomorrow.
          </div>
        </div>

        <div className="preview-card">
          <h2>Quick Actions</h2>

          <div className="queue-grid">
            <div className="queue-item">📄 Download SOA</div>
            <div className="queue-item">📑 Tax Certificate</div>
            <div className="queue-item">💰 Capital Call Notice</div>
            <div className="queue-item">📊 Performance Report</div>
            <div className="queue-item">📧 Contact Fund Manager</div>
            <div className="queue-item">🤖 Ask AI</div>
          </div>
        </div>
      </section>
    </main>
  );
}