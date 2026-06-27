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
    eta: "2 days",
  },
  {
    name: "SBI",
    commitment: 40,
    initialFee: 0.8,
    batch: "May 2026 investors",
    preference: "Institutional PDF",
    risk: "Low",
    eta: "3 days",
  },
  {
    name: "HDFC Life",
    commitment: 35,
    initialFee: 0.7,
    batch: "June 2026 investors",
    preference: "PDF + Email Body",
    risk: "Medium",
    eta: "5 days",
  },
  {
    name: "ICICI Prudential",
    commitment: 30,
    initialFee: 0.6,
    batch: "June 2026 investors",
    preference: "Excel Working",
    risk: "Medium",
    eta: "6 days",
  },
  {
    name: "Family Office Investor",
    commitment: 20,
    initialFee: 0.4,
    batch: "July 2026 investors",
    preference: "Standard Notice",
    risk: "High",
    eta: "Excluded",
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
const [isApproved, setIsApproved] = useState(false);
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

      return {
        ...investor,
        isEligible,
        basis,
        ratio,
        investorCall: callAmount * ratio,
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
          <h2>AI Morning Brief</h2>

          <div className="explain-box">
            <strong>Good Morning.</strong>
            <br />
            <br />
            VENTIQ analysed all active funds overnight.
            <br />
            <br />✓ <strong>Growth Fund II</strong> — Liquidity healthy
            <br />⚠ <strong>Venture Debt Fund III</strong> — Capital call
            recommended
            <br />✓ <strong>GIFT City Fund I</strong> — No funding action
            required
            <br />
            <br />
            <strong>Today&apos;s Priority</strong>
            <br />
            Raise <strong>₹{callAmount.toFixed(2)} Cr</strong>
            <br />
            Confidence: <strong>98%</strong>
            <br />
            Expected Collection: <strong>92% within 7 days</strong>
            <br />
            <br />
            <strong>Reason</strong>
            <br />
            Based on overnight cash forecasting, approved investments,
            management fee schedule and the fund&apos;s minimum liquidity
            policy, VENTIQ recommends initiating a capital call today.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>3</h3>
            <p>Funds analysed</p>
          </div>

          <div className="impact-card">
            <h3>₹{callAmount.toFixed(2)} Cr</h3>
            <p>Capital required</p>
          </div>

          <div className="impact-card">
            <h3>92%</h3>
            <p>Expected collection</p>
          </div>

          <div className="impact-card">
            <h3>LOW</h3>
            <p>Liquidity risk after call</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Financial Reasoning</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Current Deployable Cash</span>
              <strong>₹81 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Less: Approved Investments</span>
              <strong>(₹63 Cr)</strong>
            </div>

            <div className="journal-row">
              <span>Less: Management Fees Due</span>
              <strong>(₹8 Cr)</strong>
            </div>

            <div className="journal-row">
              <span>Less: Liquidity Buffer Required</span>
              <strong>(₹10 Cr)</strong>
            </div>

            <div className="journal-row">
              <span>Projected Available Cash</span>
              <strong>₹0 Cr</strong>
            </div>

            <div className="journal-row">
              <span>AI Recommendation</span>
              <strong>Raise ₹{callAmount.toFixed(2)} Cr</strong>
            </div>

            <div className="journal-row">
              <span>Confidence</span>
              <strong>98%</strong>
            </div>
          </div>

          <div className="explain-box">
            <strong>Why?</strong> Without this capital call, scheduled
            deployments and fund expenses will reduce deployable cash below the
            minimum liquidity threshold.
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

       <div className="preview-card">
  <h2>AI Generated Capital Call</h2>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>Venture Debt Fund III</h3>
      <p>Fund selected by AI</p>
    </div>

    <div className="impact-card">
      <h3>₹{callAmount.toFixed(2)} Cr</h3>
      <p>Recommended amount</p>
    </div>

    <div className="impact-card">
      <h3>{eligibleCount}</h3>
      <p>Eligible LPs</p>
    </div>

    <div className="impact-card">
      <h3>98%</h3>
      <p>AI confidence</p>
    </div>
  </div>

  <div className="form-card">
    <p className="eyebrow">
      Prepared automatically by VENTIQ AI — editable before approval
    </p>

    <label>Fund Type</label>
    <select value={fundType} onChange={(event) => setFundType(event.target.value)}>
      <option>Close-ended Fund</option>
      <option>Open-ended Fund</option>
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
    <select value={investorBatch} onChange={(event) => setInvestorBatch(event.target.value)}>
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
      VENTIQ pre-filled this capital call based on cash runway, approved
      deployments, liquidity policy and historical LP payment behaviour.
    </div>

    <div className="action-row">
  <button onClick={() => setIsApproved(true)}>
    {isApproved ? "✓ Approval Complete" : "Approve Capital Call"}
  </button>

  <button>Save Draft</button>
</div>
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
        <th>ETA</th>
        <th>Status</th>
      </tr>
    </thead>

    <tbody>
      {calculatedInvestors.map((investor) => (
        <tr key={investor.name}>
          <td>{investor.name}</td>
          <td>{investor.preference}</td>
          <td>{investor.isEligible ? `${(investor.ratio * 100).toFixed(2)}%` : "Excluded"}</td>
          <td>₹{investor.investorCall.toFixed(2)} Cr</td>
          <td>{investor.risk}</td>
          <td>{investor.isEligible ? investor.eta : "Excluded"}</td>
          <td>
            <span className="small-pill">
              {investor.isEligible ? "Ready" : "Skipped"}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
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
  <h2>Post-Approval Automation</h2>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>📄 Documents</h3>
      <p>Notices, Excel, emails and accounting entry prepared</p>
    </div>

    <div className="impact-card">
      <h3>📘 Accounting</h3>

<p>
Journal generated and
validated by AI
</p>
    </div>

    <div className="impact-card">
      <h3>📲 Investor Updates</h3>
      <p>Portal, email and WhatsApp communication queued</p>
    </div>

    <div className="impact-card">
      <h3>⚙️ AI Timeline</h3>
      <p>Execution log created for audit trail</p>
    </div>
  </div>

  <div className="queue-grid">
    <div className="queue-item">✓ Capital Call Notice PDF</div>
    <div className="queue-item">✓ LP-wise Excel Working</div>
    <div className="queue-item">✓ 4 Investor Email Drafts</div>
    <div className="queue-item">✓ Accounting Journal Drafted</div>
<div className="queue-item">
  {isApproved ? "✓ Investor Portal Update" : "○ Investor Portal Update"}
</div>

<div className="queue-item">
  {isApproved ? "✓ WhatsApp Alerts Scheduled" : "○ WhatsApp Alerts"}
</div>

<div className="queue-item">
  {isApproved ? "✓ Bank Receipt Watch Started" : "○ Bank Receipt Watch"}
</div>

<div className="queue-item">
  {isApproved ? "✓ Activity Engine Event Created" : "○ Activity Engine Event"}
</div>
  </div>

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
      <span>Dispatch Status</span>
      <strong>Waiting for Finance Head approval</strong>
    </div>
  </div>

  <div className="explain-box">
    Once approved, VENTIQ will generate investor notices, prepare LP-wise
    workings, draft emails, queue portal updates, create the accounting entry and
    start bank receipt tracking automatically.
  </div>
</div>
        <div className="preview-card">
          <h2>Downstream Workflow Automation</h2>
<p className="eyebrow">
  8 automation tasks generated • 4 completed automatically • 4 waiting for approval
</p>
          <div className="queue-grid">
          <div className="queue-item">🟢 Capital Call Notice Generated</div>
<div className="queue-item">🟢 LP Allocation Workbook Ready</div>
<div className="queue-item">🟢 Investor Email Drafts Ready</div>
<div className="queue-item">🟢 Institutional Notice Ready</div>
<div className="queue-item">🟡 Investor Portal Update</div>
<div className="queue-item">🟡 WhatsApp Alerts</div>
<div className="queue-item">🟡 Accounting Entry</div>
<div className="queue-item">🟡 Activity Engine Event</div>
          </div>

          <div className="action-row">
           <button>Generate Documents</button>
<button>Request Approval</button>
<button>Preview LP Notice</button>
          </div>
        </div>

        <div className="preview-card">
         <h2>Accounting Journal Preview</h2>
<p className="eyebrow">
Generated automatically by the VENTIQ Accounting Engine
</p>
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
          <h2>What Happens If You Ignore This Recommendation?</h2>

          <div className="validation-grid">
            <div className="validation-item">⚠ Liquidity policy breach likely</div>
            <div className="validation-item">⚠ Investment deployment may delay</div>
            <div className="validation-item">⚠ NAV close may be impacted</div>
            <div className="validation-item">⚠ Investor communication delayed</div>
            <div className="validation-item">⚠ Cash forecast turns negative</div>
            <div className="validation-item">⚠ Management review escalated</div>
          </div>

          <div className="explain-box">
            Without this capital call, projected available cash falls to ₹0 Cr
            after approved investments, fees and the required liquidity buffer.
            VENTIQ estimates liquidity stress within 18 days.
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