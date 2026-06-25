"use client";

import { useMemo, useState } from "react";

const investors = [
  {
    name: "SIDBI",
    commitment: 50,
    initialFee: 1,
    batch: "May 2026 investors",
    preference: "Excel + PDF",
    risk: "Low",
    expectedCollection: "2 days",
  },
  {
    name: "SBI",
    commitment: 40,
    initialFee: 0.8,
    batch: "May 2026 investors",
    preference: "Institutional PDF",
    risk: "Low",
    expectedCollection: "3 days",
  },
  {
    name: "HDFC Life",
    commitment: 35,
    initialFee: 0.7,
    batch: "June 2026 investors",
    preference: "PDF + Email Body",
    risk: "Medium",
    expectedCollection: "5 days",
  },
  {
    name: "ICICI Prudential",
    commitment: 30,
    initialFee: 0.6,
    batch: "June 2026 investors",
    preference: "Excel Working",
    risk: "Medium",
    expectedCollection: "6 days",
  },
  {
    name: "Family Office Investor",
    commitment: 20,
    initialFee: 0.4,
    batch: "July 2026 investors",
    preference: "Standard Notice",
    risk: "High",
    expectedCollection: "Excluded",
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
            <p className="eyebrow">VENTIQ Finance</p>
            <h1>AI Capital Calls</h1>
            <p>
              AI-assisted capital call planning, LP allocation, approval,
              notices, payment tracking, accounting impact and downstream fund
              workflows.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>AI Capital Call Recommendation</h2>

          <div className="explain-box">
            VENTIQ recommends raising ₹{callAmount.toFixed(2)} Cr today.
            Confidence: 98%. Reason: current deployable cash will fall below the
            minimum liquidity buffer after upcoming investments, management fees
            and operating reserves.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>₹{callAmount.toFixed(2)} Cr</h3>
            <p>Recommended call</p>
          </div>

          <div className="impact-card">
            <h3>98%</h3>
            <p>AI confidence</p>
          </div>

          <div className="impact-card">
            <h3>{eligibleCount}</h3>
            <p>Eligible LPs</p>
          </div>

          <div className="impact-card">
            <h3>92%</h3>
            <p>Expected collection</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>How AI Reached This Decision</h2>

          <div className="decision-tree">
            <div className="decision-node">
              <h3>Current Cash Position</h3>
              <p>₹81 Cr</p>
            </div>

            <div className="decision-arrow">↓</div>

            <div className="decision-node">
              <h3>Approved Investments</h3>
              <p>₹63 Cr</p>
            </div>

            <div className="decision-arrow">↓</div>

            <div className="decision-node">
              <h3>Management Fees Due</h3>
              <p>₹8 Cr</p>
            </div>

            <div className="decision-arrow">↓</div>

            <div className="decision-node">
              <h3>Liquidity Buffer Required</h3>
              <p>₹10 Cr</p>
            </div>

            <div className="decision-arrow">↓</div>

            <div className="decision-node highlight-node">
              <h3>AI Decision</h3>
              <p>Raise ₹{callAmount.toFixed(2)} Cr</p>
              <span className="small-pill">98% Confidence</span>
            </div>
          </div>

          <div className="decision-summary">
            <strong>Why?</strong>
            <p>
              VENTIQ analysed cash runway, approved deployments, management fee
              schedule, liquidity buffer, investor commitments and historical LP
              payment behaviour. Based on this, AI recommends initiating the
              capital call today.
            </p>
          </div>
        </div>

        <div className="workflow-progress">
          <h2>Capital Call Progress</h2>

          <div className="progress-steps">
            <div className="progress-step active">✓ Fund Selected</div>
            <div className="progress-step active">✓ AI Recommendation</div>
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
              <option>Pro-rata based on commitment net of initial fees</option>
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
            <h2>AI Allocation Preview</h2>

            <table className="investor-table">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Preference</th>
                  <th>Basis</th>
                  <th>Call</th>
                  <th>Risk</th>
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
                    <td>{investor.risk}</td>
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
              ✓ AI recommends this call based on cash runway and upcoming
              deployment.
            </div>

            <div className="ai-insight">
              ✓ {excludedCount} investor excluded from the eligible commitment
              base.
            </div>

            <div className="ai-insight">
              ✓ Investor-specific formats detected for institutional LPs.
            </div>

            <div className="ai-insight">
              Recommendation: Send for Finance Head approval before releasing LP
              communications.
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Collection Forecast</h2>

          <table className="investor-table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Call Amount</th>
                <th>Collection Probability</th>
                <th>Expected Timing</th>
                <th>Risk</th>
              </tr>
            </thead>

            <tbody>
              {calculatedInvestors.map((investor) => (
                <tr key={investor.name}>
                  <td>{investor.name}</td>
                  <td>₹{investor.investorCall.toFixed(2)} Cr</td>
                  <td>{investor.isEligible ? "92%" : "Excluded"}</td>
                  <td>{investor.expectedCollection}</td>
                  <td>{investor.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="preview-card">
          <h2>Capital Call Simulator</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>₹15 Cr</h3>
              <p>High liquidity risk · possible deployment delay</p>
            </div>

            <div className="impact-card">
              <h3>₹{callAmount.toFixed(0)} Cr</h3>
              <p>Best option · runway protected</p>
            </div>

            <div className="impact-card">
              <h3>₹35 Cr</h3>
              <p>Idle cash risk · higher LP burden</p>
            </div>

            <div className="impact-card">
              <h3>61 days</h3>
              <p>Projected runway after collection</p>
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
          <h2>Downstream Workflow Automation</h2>

          <div className="queue-grid">
            <div className="queue-item">Approve Capital Call</div>
            <div className="queue-item">Generate Notices</div>
            <div className="queue-item">Send Emails</div>
            <div className="queue-item">Update Investor Portal</div>
            <div className="queue-item">Create Receivable JV</div>
            <div className="queue-item">Start Bank Receipt Watch</div>
            <div className="queue-item">Update NAV</div>
            <div className="queue-item">Create Activity Engine Event</div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Validation</h2>

          <div className="validation-grid">
            <div className="validation-item">
              ✓ Total allocation matches ₹{callAmount.toFixed(2)} Cr
            </div>
            <div className="validation-item">
              ✓ No investor exceeds remaining commitment
            </div>
            <div className="validation-item">
              ✓ {excludedCount} investor exclusion applied
            </div>
            <div className="validation-item">
              ✓ Notice dates ready for approval
            </div>
            <div className="validation-item">✓ Accounting entry is balanced</div>
            <div className="validation-item">
              ✓ Investor-specific formats detected
            </div>
          </div>

          <div className="explain-box">
            <strong>Explain Allocation:</strong> ₹{callAmount.toFixed(2)} Cr is
            allocated across {eligibleCount} eligible LPs using{" "}
            {allocationMethod}. Excluded investors are removed from the eligible
            commitment base, so remaining investors receive proportionate
            allocations.
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
          <h2>AI Timeline</h2>

          <div className="audit-timeline">
            <div className="audit-item">
              <strong>09:30</strong> ✓ Cash forecast reviewed
            </div>

            <div className="audit-item">
              <strong>09:32</strong> ✓ AI recommended ₹{callAmount.toFixed(2)} Cr
              call
            </div>

            <div className="audit-item">
              <strong>09:35</strong> ✓ Investor exclusions applied
            </div>

            <div className="audit-item">
              <strong>09:37</strong> ✓ Allocation generated
            </div>

            <div className="audit-item">
              <strong>09:38</strong> ✓ Notices and Excel workings drafted
            </div>

            <div className="audit-item">
              <strong>09:40</strong> Waiting Finance Head approval
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}