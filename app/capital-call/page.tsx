"use client";

import { useMemo, useState } from "react";

const investors = [
  {
    name: "SIDBI",
    commitment: 50,
    initialFee: 1,
    batch: "May 2026 investors",
    preference: "Excel + PDF",
    eligibility: "Eligible",
  },
  {
    name: "SBI",
    commitment: 40,
    initialFee: 0.8,
    batch: "May 2026 investors",
    preference: "Institutional PDF",
    eligibility: "Eligible",
  },
  {
    name: "HDFC Life",
    commitment: 35,
    initialFee: 0.7,
    batch: "June 2026 investors",
    preference: "PDF + Email Body",
    eligibility: "Eligible",
  },
  {
    name: "ICICI Prudential",
    commitment: 30,
    initialFee: 0.6,
    batch: "June 2026 investors",
    preference: "Excel Working",
    eligibility: "Eligible",
  },
  {
    name: "Family Office Investor",
    commitment: 20,
    initialFee: 0.4,
    batch: "July 2026 investors",
    preference: "Standard Notice",
    eligibility: "Deal Opt-out",
  },
];

export default function CapitalCallPage() {
  const [fundType, setFundType] = useState("Close-ended Fund");
  const [callAmount, setCallAmount] = useState(25);
  const [allocationMethod, setAllocationMethod] = useState(
    "Pro-rata based on committed capital"
  );
  const [investorBatch, setInvestorBatch] = useState("All investors");
  const [excludedInvestor, setExcludedInvestor] = useState(
    "Family Office Investor"
  );

  const calculatedInvestors = useMemo(() => {
    const eligibleInvestors = investors.filter((investor) => {
      const batchMatch =
        investorBatch === "All investors" || investor.batch === investorBatch;

      const exclusionMatch =
        excludedInvestor === "None" || investor.name !== excludedInvestor;

      return batchMatch && exclusionMatch;
    });

    const totalBasis = eligibleInvestors.reduce((sum, investor) => {
      const basis =
        allocationMethod === "Pro-rata based on commitment net of initial fees"
          ? investor.commitment - investor.initialFee
          : investor.commitment;

      return sum + basis;
    }, 0);

    return investors.map((investor) => {
      const isEligible = eligibleInvestors.some(
        (item) => item.name === investor.name
      );

      const basis =
        allocationMethod === "Pro-rata based on commitment net of initial fees"
          ? investor.commitment - investor.initialFee
          : investor.commitment;

      const ratio = isEligible && totalBasis > 0 ? basis / totalBasis : 0;
      const investorCall = callAmount * ratio;

      return {
        ...investor,
        isEligible,
        basis,
        ratio,
        investorCall,
      };
    });
  }, [allocationMethod, callAmount, excludedInvestor, investorBatch]);

  const eligibleCount = calculatedInvestors.filter(
    (investor) => investor.isEligible
  ).length;

  const excludedCount = calculatedInvestors.length - eligibleCount;

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">Finance Workspace</p>
            <h1>Capital Call Workspace</h1>
            <p>
              Live allocation engine with investor preferences, eligibility
              rules, approval workflow, output queue, audit trail and AI
              explanations.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="workflow-progress">
          <h2>Capital Call Progress</h2>

          <div className="progress-steps">
            <div className="progress-step active">✓ Fund Selected</div>
            <div className="progress-step active">✓ Amount Entered</div>
            <div className="progress-step active">✓ Allocation Generated</div>
            <div className="progress-step active">◐ Approval Pending</div>
            <div className="progress-step">○ Notices Pending</div>
            <div className="progress-step">○ Portal Pending</div>
            <div className="progress-step">○ Accounting Pending</div>
          </div>
        </div>

        <div className="workspace-three">
          <div className="form-card">
            <h2>Setup</h2>

            <label>Fund Type</label>
            <select
              value={fundType}
              onChange={(event) => setFundType(event.target.value)}
            >
              <option>Close-ended Fund</option>
              <option>Open-ended Fund</option>
            </select>

            <label>Fund</label>
            <select>
              <option>Venture Debt Fund III</option>
              <option>Growth Fund II</option>
              <option>GIFT City Fund I</option>
            </select>

            <label>Capital Call Amount (₹ Cr)</label>
            <input
              type="number"
              value={callAmount}
              onChange={(event) => setCallAmount(Number(event.target.value))}
            />

            <label>Allocation Method</label>
            <select
              value={allocationMethod}
              onChange={(event) => setAllocationMethod(event.target.value)}
            >
              <option>Pro-rata based on committed capital</option>
              <option>
                Pro-rata based on commitment net of initial fees
              </option>
            </select>

            <label>Investor Batch</label>
            <select
              value={investorBatch}
              onChange={(event) => setInvestorBatch(event.target.value)}
            >
              <option>All investors</option>
              <option>May 2026 investors</option>
              <option>June 2026 investors</option>
              <option>July 2026 investors</option>
            </select>

            <label>Exclude Investor</label>
            <select
              value={excludedInvestor}
              onChange={(event) => setExcludedInvestor(event.target.value)}
            >
              <option>None</option>
              {investors.map((investor) => (
                <option key={investor.name}>{investor.name}</option>
              ))}
            </select>

            <div className="logic-note">
              {fundType === "Close-ended Fund"
                ? "Close-ended funds call all eligible investors based on commitment or net commitment."
                : "Open-ended funds call selected investor batches because investors enter periodically."}
            </div>
          </div>

          <div className="preview-card">
            <h2>Live Allocation Preview</h2>

            <table className="investor-table">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Preference</th>
                  <th>Basis</th>
                  <th>Call</th>
                  <th>Eligibility</th>
                </tr>
              </thead>

              <tbody>
                {calculatedInvestors.map((investor) => (
                  <tr key={investor.name}>
                    <td>{investor.name}</td>
                    <td>{investor.preference}</td>
                    <td>
                      {investor.isEligible
                        ? `${(investor.ratio * 100).toFixed(2)}%`
                        : "Excluded"}
                    </td>
                    <td>₹{investor.investorCall.toFixed(2)} Cr</td>
                    <td>
                      <span className="small-pill">
                        {investor.isEligible ? "🟢 Eligible" : "🟡 Opt-out"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="output-grid">
              <div>
                <h3>Total Call</h3>
                <p>₹{callAmount.toFixed(2)} Cr</p>
              </div>

              <div>
                <h3>Eligible LPs</h3>
                <p>{eligibleCount}</p>
              </div>

              <div>
                <h3>Excluded LPs</h3>
                <p>{excludedCount}</p>
              </div>

              <div>
                <h3>Basis</h3>
                <p>
                  {allocationMethod ===
                  "Pro-rata based on commitment net of initial fees"
                    ? "Net commitment"
                    : "Commitment"}
                </p>
              </div>
            </div>
          </div>

          <div className="ai-side-panel">
            <h2>VENTIQ AI</h2>

            <div className="ai-insight">
              ✓ Call amount is ready for allocation across eligible LPs.
            </div>

            <div className="ai-insight">
              ✓ {excludedCount} investor excluded from this call.
            </div>

            <div className="ai-insight">
              ✓ Notices should be generated in investor-specific formats.
            </div>

            <div className="ai-insight">
              Recommendation: Send this call for Finance Head approval before
              generating investor communications.
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Approval Workflow</h2>

          <div className="approval-flow">
            <div className="approval-step">Draft</div>
            <div className="approval-step current">Finance Head Review</div>
            <div className="approval-step">Managing Partner</div>
            <div className="approval-step">Approved</div>
            <div className="approval-step">Posted</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Production Queue</h2>

          <div className="queue-grid">
            <div className="queue-item">✅ Capital Call Notices</div>
            <div className="queue-item">✅ Investor-wise Excel</div>
            <div className="queue-item">✅ Email Drafts</div>
            <div className="queue-item">✅ Institutional Formats</div>
            <div className="queue-item">○ Investor Portal Update</div>
            <div className="queue-item">○ WhatsApp Alerts</div>
            <div className="queue-item">○ Accounting JV</div>
            <div className="queue-item">○ Approval Log</div>
          </div>

          <div className="action-row">
            <button>Generate All</button>
            <button>Send for Approval</button>
            <button>Preview Investor Experience</button>
          </div>
        </div>

        <div className="preview-card">
          <h2>Expected Accounting Entry</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Dr Capital Receivable</span>
              <strong>₹{callAmount.toFixed(2)} Cr</strong>
            </div>

            <div className="journal-row">
              <span>Cr LP Capital Contribution</span>
              <strong>₹{callAmount.toFixed(2)} Cr</strong>
            </div>

            <div className="journal-row">
              <span>Status</span>
              <strong>Pending Approval</strong>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Audit Timeline</h2>

          <div className="audit-timeline">
            <div className="audit-item">
              <strong>09:30</strong> Fund selected
            </div>

            <div className="audit-item">
              <strong>09:35</strong> ₹{callAmount.toFixed(2)} Cr entered
            </div>

            <div className="audit-item">
              <strong>09:36</strong> Investor exclusions applied
            </div>

            <div className="audit-item">
              <strong>09:37</strong> Allocation generated
            </div>

            <div className="audit-item">
              <strong>09:40</strong> Sent for Finance Head review
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}