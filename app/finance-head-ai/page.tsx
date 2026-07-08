export default function FinanceHeadAIPage() {
  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>AI Finance Head</h1>
            <p>
              Your virtual fund finance controller for capital calls,
              distributions, bank reconciliation, compliance, reporting and
              investor communications.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <div className="sample-data-ribbon">
  Sample finance workspace preview · Illustrative data
</div>
          <h2>Finance Head Workspace Preview</h2>

          <div className="explain-box">
            VENTIQ reviewed your fund operations overnight. You have 2 capital
            call approvals, ₹18.5 Cr distribution ready, 4 unmatched bank
            entries, 64C due in 8 days and ₹8.2 Cr idle cash requiring action.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>2</h3>
            <p>Capital call approvals</p>
          </div>

          <div className="impact-card">
            <h3>₹18.5 Cr</h3>
            <p>Distribution ready</p>
          </div>

          <div className="impact-card">
            <h3>4</h3>
            <p>Bank exceptions</p>
          </div>

          <div className="impact-card">
            <h3>8 days</h3>
            <p>64C filing due</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Today&apos;s AI Priorities</h2>

          <div className="queue-grid">
            <div className="queue-item">
              🟢 <strong>Capital Calls</strong>
              <br />
              2 pending approvals
              <br />
              Recommended: review before 12 PM
            </div>

            <div className="queue-item">
              🟢 <strong>Distribution</strong>
              <br />
              ₹18.5 Cr ready
              <br />
              Recommended: approve waterfall
            </div>

            <div className="queue-item">
              🔴 <strong>Bank Reconciliation</strong>
              <br />
              4 unmatched entries
              <br />
              Recommended: resolve before NAV close
            </div>

            <div className="queue-item">
              🟡 <strong>Regulatory Filing</strong>
              <br />
              Form 64C due in 8 days
              <br />
              Recommended: prepare draft today
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Insights</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>16 days</h3>
              <p>
                Cash runway risk. AI recommends initiating ₹25 Cr capital call
                next week.
              </p>
            </div>

            <div className="impact-card">
              <h3>92%</h3>
              <p>
                Collection probability. SIDBI expected to pay with 2 day delay.
              </p>
            </div>

            <div className="impact-card">
              <h3>₹8.2 Cr</h3>
              <p>
                Idle cash identified. AI recommends liquid fund deployment.
              </p>
            </div>

            <div className="impact-card">
              <h3>+₹32 L</h3>
              <p>
                Carry estimate changed after updated distribution waterfall.
              </p>
            </div>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Recommended Actions</h2>

            <div className="queue-grid">
              <div className="queue-item">✓ Generate Capital Call</div>
              <div className="queue-item">✓ Review Distribution</div>
              <div className="queue-item">✓ Match Bank Entries</div>
              <div className="queue-item">✓ Prepare Form 64C</div>
              <div className="queue-item">✓ Send Investor Notices</div>
              <div className="queue-item">✓ Deploy Idle Cash</div>
            </div>

            <div className="action-row">
              <button>Start Today&apos;s Workflow</button>
              <button>Generate Finance Summary</button>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>Ask Finance AI</h2>

            <div className="chat-message">
              Ask: “What should I complete first today?”
            </div>

            <div className="chat-message">
              Ask: “Which items can delay NAV close?”
            </div>

            <div className="chat-message">
              Ask: “Prepare today&apos;s finance summary.”
            </div>

            <div className="chat-message">
              Ask: “Show all investor notices pending.”
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Finance AI Answer Preview</h2>

          <div className="explain-box">
            <strong>Question:</strong> What should I complete first today?
            <br />
            <br />
            <strong>VENTIQ AI:</strong> Start with bank reconciliation. Four
            unmatched entries may block NAV close, QCR preparation and investor
            reporting. After that, approve the ₹18.5 Cr distribution waterfall.
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Work Queue</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Bank Reconciliation</span>
              <strong>4 exceptions • High priority</strong>
            </div>

            <div className="journal-row">
              <span>Distribution Waterfall</span>
              <strong>₹18.5 Cr • Ready for approval</strong>
            </div>

            <div className="journal-row">
              <span>Capital Calls</span>
              <strong>2 approvals • ₹25 Cr total</strong>
            </div>

            <div className="journal-row">
              <span>Investor Reporting</span>
              <strong>14 notices pending</strong>
            </div>

            <div className="journal-row">
              <span>Compliance</span>
              <strong>64C due in 8 days</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}