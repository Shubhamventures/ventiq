"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type Fund = {
  id: string;
  name: string;
  fund_type: string;
  category: string | null;
  jurisdiction: string | null;
  currency: string | null;
  committed_capital: number | null;
  called_capital: number | null;
  status: string | null;
};

type Investor = {
  name: string;
  investor_type: string | null;
  email: string | null;
  country: string | null;
  kyc_status: string | null;
};

type Commitment = {
  id: string;
  fund_id: string;
  investor_id: string;
  commitment_amount: number;
  called_amount: number | null;
  unfunded_amount: number | null;
  status: string | null;
  investors: Investor | Investor[] | null;
};
type SavedCapitalCall = {
  id: string;
  call_name: string | null;
  call_date: string | null;
  due_date: string | null;
  call_amount: number | null;
  status: string | null;
  created_at: string | null;
  funds: { name: string } | { name: string }[] | null;
};

function getInvestor(value: Investor | Investor[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toCr(value: number | null | undefined) {
  return Number(value || 0) / 10000000;
}

function formatCr(value: number) {
  return `₹${value.toFixed(2)} Cr`;
}

function cleanFundName(name?: string | null) {
  return name?.replace("VENTIQ ", "") ?? "Selected Fund";
}

function getInvestorBatch(investor: Investor | null) {
  const type = investor?.investor_type ?? "";
  const country = investor?.country ?? "";

  if (country !== "India") return "International investors";
  if (type.toLowerCase().includes("family")) return "Family office investors";
  if (type.toLowerCase().includes("insurance")) return "Insurance investors";

  return "Institutional investors";
}

function getInvestorPreference(investor: Investor | null) {
  const type = investor?.investor_type ?? "";

  if (type.toLowerCase().includes("sovereign")) return "Institutional PDF";
  if (type.toLowerCase().includes("insurance")) return "PDF + Email Body";
  if (type.toLowerCase().includes("family")) return "Standard Notice";

  return "Excel + PDF";
}

function getInvestorRisk(investor: Investor | null) {
  const type = investor?.investor_type ?? "";

  if (type.toLowerCase().includes("family")) return "High";
  if (type.toLowerCase().includes("insurance")) return "Medium";

  return "Low";
}

function getInvestorEta(investor: Investor | null) {
  const risk = getInvestorRisk(investor);

  if (risk === "High") return "6 days";
  if (risk === "Medium") return "5 days";

  return "2 days";
}
function getSavedDraftFundName(value: SavedCapitalCall["funds"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown Fund";
  return value?.name ?? "Unknown Fund";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CapitalCallPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedFundId, setSelectedFundId] = useState("");
  const [fundType, setFundType] = useState("Close-ended Fund");
  const [callAmount, setCallAmount] = useState(25);
  const [allocationMethod, setAllocationMethod] = useState(
    "Pro-rata based on committed capital"
  );
  const [investorBatch, setInvestorBatch] = useState("All investors");
  const [excludedInvestor, setExcludedInvestor] = useState("None");
  const [isApproved, setIsApproved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
const [saveMessage, setSaveMessage] = useState("");
const [savedDrafts, setSavedDrafts] = useState<SavedCapitalCall[]>([]);
const [loadingSavedDrafts, setLoadingSavedDrafts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCommitments, setLoadingCommitments] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFunds() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage("Supabase is not configured. Please check .env.local.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("funds")
        .select(
          "id, name, fund_type, category, jurisdiction, currency, committed_capital, called_capital, status"
        )
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
      } else {
        const fundData = data ?? [];
        setFunds(fundData);

        const recommendedFund =
          fundData.find((fund) =>
            fund.name.toLowerCase().includes("venture debt")
          ) ?? fundData[0];

        if (recommendedFund) {
          setSelectedFundId(recommendedFund.id);
        }
      }

      setLoading(false);
    }

    loadFunds();
  }, []);

  useEffect(() => {
    async function loadCommitments() {
      if (!selectedFundId || !supabase) return;
     

      setLoadingCommitments(true);
      setErrorMessage("");
      setCommitments([]);

      const { data, error } = await supabase
        .from("commitments")
        .select(
          "id, fund_id, investor_id, commitment_amount, called_amount, unfunded_amount, status, investors(name, investor_type, email, country, kyc_status)"
        )
        .eq("fund_id", selectedFundId)
        .order("commitment_amount", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setCommitments([]);
      } else {
        setCommitments((data as unknown as Commitment[]) ?? []);
      }

      setLoadingCommitments(false);
    }

    loadCommitments();
  }, [selectedFundId]);
  useEffect(() => {
  loadSavedDrafts();
}, []);

  const selectedFund = funds.find((fund) => fund.id === selectedFundId);

  const investorRows = useMemo(() => {
    return commitments.map((commitment) => {
      const investor = getInvestor(commitment.investors);

     return {
  id: commitment.id,
  commitmentId: commitment.id,
  investorId: commitment.investor_id,
  name: investor?.name ?? "Unknown Investor",
        investorType: investor?.investor_type ?? "Investor",
        commitment: toCr(commitment.commitment_amount),
        calledTillDate: toCr(commitment.called_amount),
        unfunded: toCr(commitment.unfunded_amount),
        initialFee: toCr(commitment.commitment_amount) * 0.01,
        batch: getInvestorBatch(investor),
        preference: getInvestorPreference(investor),
        risk: getInvestorRisk(investor),
        eta: getInvestorEta(investor),
        kycStatus: investor?.kyc_status ?? "Pending",
      };
    });
  }, [commitments]);

  const batchOptions = useMemo(() => {
    return ["All investors", ...Array.from(new Set(investorRows.map((row) => row.batch)))];
  }, [investorRows]);

  const calculatedInvestors = useMemo(() => {
    const eligibleInvestors = investorRows.filter((investor) => {
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

    return investorRows.map((investor) => {
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
  }, [allocationMethod, callAmount, excludedInvestor, investorBatch, investorRows]);

  const eligibleCount = calculatedInvestors.filter(
    (investor) => investor.isEligible
  ).length;

  const excludedCount = calculatedInvestors.length - eligibleCount;

  const totalCommitment = investorRows.reduce(
    (sum, investor) => sum + investor.commitment,
    0
  );

  const totalCalledTillDate = investorRows.reduce(
    (sum, investor) => sum + investor.calledTillDate,
    0
  );

  const totalUnfunded = investorRows.reduce(
    (sum, investor) => sum + investor.unfunded,
    0
  );

  const selectedFundName = cleanFundName(selectedFund?.name);
  async function loadSavedDrafts() {
  if (!supabase) return;

  setLoadingSavedDrafts(true);

  const { data, error } = await supabase
    .from("capital_calls")
    .select(
      "id, call_name, call_date, due_date, call_amount, status, created_at, funds(name)"
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (!error) {
    setSavedDrafts((data as unknown as SavedCapitalCall[]) ?? []);
  }

  setLoadingSavedDrafts(false);
}
async function handleSaveDraft() {
  if (!supabase) {
    setSaveMessage("Supabase is not configured.");
    return;
  }

  if (!selectedFundId) {
    setSaveMessage("Please select a fund before saving.");
    return;
  }

  if (calculatedInvestors.length === 0) {
    setSaveMessage("No investor allocation found to save.");
    return;
  }

  setSavingDraft(true);
  setSaveMessage("");

 const callName = `${selectedFundName} Capital Call - ${new Date().toLocaleDateString(
  "en-IN"
)}`;
const callDate = new Date().toISOString().slice(0, 10);
const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const { data: savedCall, error: callError } = await supabase
  .from("capital_calls")
 .insert({
  call_name: callName,
  call_date: callDate,
  due_date: dueDate,
  fund_id: selectedFundId,
    call_amount: callAmount * 10000000,
    status: isApproved ? "approved" : "draft",
    allocation_method: allocationMethod,
    investor_batch: investorBatch,
    excluded_investor: excludedInvestor === "None" ? null : excludedInvestor,
    created_by: "VENTIQ AI Finance Head",
  })
  .select("id")
  .single();

  if (callError || !savedCall?.id) {
    setSaveMessage(
      `Could not save capital call draft: ${
        callError?.message ?? "Missing saved capital call ID"
      }`
    );
    setSavingDraft(false);
    return;
  }

  const investorPayload = calculatedInvestors.map((investor) => ({
  capital_call_id: savedCall.id,
  commitment_id: investor.commitmentId,
  investor_id: investor.investorId,
  call_amount: investor.investorCall * 10000000,
  allocation_amount: investor.investorCall * 10000000,
  allocation_percentage: Number((investor.ratio * 100).toFixed(4)),
  status: investor.isEligible ? "ready" : "skipped",
}));

  const { error: investorError } = await supabase
    .from("capital_call_investors")
    .insert(investorPayload);

  if (investorError) {
    setSaveMessage(
      `Capital call saved, but investor allocation failed: ${investorError.message}`
    );
    setSavingDraft(false);
    return;
  }

 await loadSavedDrafts();

setSaveMessage(
  `Draft saved successfully for ${selectedFundName}. ${eligibleCount} investor allocations stored.`
);

setSavingDraft(false);
}

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

        {loading && (
          <div className="preview-card">
            <h2>Loading Capital Call Engine...</h2>
            <p>VENTIQ is reading fund and commitment data from Supabase.</p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">
              <strong>Error:</strong> {errorMessage}
            </div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="preview-card">
              <h2>AI Morning Brief</h2>

              <div className="explain-box">
                <strong>Good Morning.</strong>
                <br />
                <br />
                VENTIQ analysed all active funds overnight.
                <br />
                <br />
                {funds.map((fund) => (
                  <span key={fund.id}>
                    {fund.id === selectedFundId ? "⚠" : "✓"}{" "}
                    <strong>{cleanFundName(fund.name)}</strong> —{" "}
                    {fund.id === selectedFundId
                      ? "Capital call recommended"
                      : fund.name.toLowerCase().includes("gift")
                      ? "No funding action required"
                      : "Liquidity healthy"}
                    <br />
                  </span>
                ))}
                <br />
                <strong>Today&apos;s Priority</strong>
                <br />
                Raise <strong>{formatCr(callAmount)}</strong>
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
                <h3>{funds.length}</h3>
                <p>Funds analysed</p>
              </div>

              <div className="impact-card">
                <h3>{formatCr(callAmount)}</h3>
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
  <h2>Saved Capital Call Drafts</h2>

  <p className="eyebrow">Latest saved drafts from Supabase</p>

  {loadingSavedDrafts && <p>Loading saved drafts...</p>}

  {!loadingSavedDrafts && savedDrafts.length === 0 && (
    <div className="explain-box">
      No saved capital call drafts found yet. Click Save Draft to create the
      first saved workflow.
    </div>
  )}

  {!loadingSavedDrafts && savedDrafts.length > 0 && (
    <table className="investor-table">
      <thead>
        <tr>
          <th>Draft Name</th>
          <th>Fund</th>
          <th>Call Amount</th>
          <th>Call Date</th>
          <th>Due Date</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        {savedDrafts.map((draft) => (
          <tr key={draft.id}>
            <td>{draft.call_name ?? "VENTIQ Capital Call Draft"}</td>
            <td>{getSavedDraftFundName(draft.funds)}</td>
            <td>{formatCr(toCr(draft.call_amount))}</td>
            <td>{formatDate(draft.call_date)}</td>
            <td>{formatDate(draft.due_date)}</td>
            <td>
              <span className="small-pill">{draft.status ?? "draft"}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
            <div className="preview-card">
              <h2>AI Financial Reasoning</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Selected Fund</span>
                  <strong>{selectedFundName}</strong>
                </div>

                <div className="journal-row">
                  <span>Total Commitments From Supabase</span>
                  <strong>{formatCr(totalCommitment)}</strong>
                </div>

                <div className="journal-row">
                  <span>Called Till Date</span>
                  <strong>{formatCr(totalCalledTillDate)}</strong>
                </div>

                <div className="journal-row">
                  <span>Unfunded Commitment</span>
                  <strong>{formatCr(totalUnfunded)}</strong>
                </div>

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
                  <strong>Raise {formatCr(callAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Confidence</span>
                  <strong>98%</strong>
                </div>
              </div>

              <div className="explain-box">
                <strong>Why?</strong> Without this capital call, scheduled
                deployments and fund expenses will reduce deployable cash below
                the minimum liquidity threshold.
              </div>
            </div>

            <div className="workflow-progress">
              <h2>Capital Call Progress</h2>

              <div className="progress-steps">
                <div className="progress-step active">✓ Fund Selected</div>
                <div className="progress-step active">✓ AI Recommendation</div>
                <div className="progress-step active">✓ Allocation Generated</div>
                <div className="progress-step active">
                  {isApproved ? "✓ Approved" : "◐ Approval Pending"}
                </div>
                <div className={isApproved ? "progress-step active" : "progress-step"}>
                  {isApproved ? "✓ Notices Ready" : "○ Notices Pending"}
                </div>
                <div className={isApproved ? "progress-step active" : "progress-step"}>
                  {isApproved ? "✓ Portal Queued" : "○ Portal Pending"}
                </div>
                <div className={isApproved ? "progress-step active" : "progress-step"}>
                  {isApproved ? "✓ Accounting Ready" : "○ Accounting Pending"}
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Generated Capital Call</h2>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{selectedFundName}</h3>
                  <p>Fund selected by AI</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(callAmount)}</h3>
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

                <label>Fund</label>
                <select
                  value={selectedFundId}
                  onChange={(event) => {
                    setSelectedFundId(event.target.value);
                    setInvestorBatch("All investors");
                    setExcludedInvestor("None");
                    setIsApproved(false);
                  }}
                >
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name}
                    </option>
                  ))}
                </select>

                <label>Fund Structure</label>
                <select
                  value={fundType}
                  onChange={(event) => setFundType(event.target.value)}
                >
                  <option>Close-ended Fund</option>
                  <option>Open-ended Fund</option>
                </select>

                <label>Capital Call Amount (₹ Cr)</label>
                <input
                  type="number"
                  value={callAmount}
                  onChange={(event) => {
                    setCallAmount(Number(event.target.value));
                    setIsApproved(false);
                  }}
                />

                <label>Allocation Method</label>
                <select
                  value={allocationMethod}
                  onChange={(event) => {
                    setAllocationMethod(event.target.value);
                    setIsApproved(false);
                  }}
                >
                  <option>Pro-rata based on committed capital</option>
                  <option>Pro-rata based on commitment net of initial fees</option>
                </select>

                <label>Investor Batch</label>
                <select
                  value={investorBatch}
                  onChange={(event) => {
                    setInvestorBatch(event.target.value);
                    setIsApproved(false);
                  }}
                >
                  {batchOptions.map((batch) => (
                    <option key={batch}>{batch}</option>
                  ))}
                </select>

                <label>Exclude Investor</label>
                <select
                  value={excludedInvestor}
                  onChange={(event) => {
                    setExcludedInvestor(event.target.value);
                    setIsApproved(false);
                  }}
                >
                  <option>None</option>
                  {investorRows.map((investor) => (
                    <option key={investor.id}>{investor.name}</option>
                  ))}
                </select>

                <div className="logic-note">
                  VENTIQ pre-filled this capital call using live Supabase fund,
                  investor and commitment data, while keeping the allocation
                  editable before approval.
                </div>

                <div className="action-row">
                  <button onClick={() => setIsApproved(true)}>
                    {isApproved ? "✓ Approval Complete" : "Approve Capital Call"}
                  </button>

                <button
  type="button"
  onClick={handleSaveDraft}
  disabled={savingDraft || calculatedInvestors.length === 0}
>
  {savingDraft ? "Saving..." : "Save Draft"}
</button>                </div>
{saveMessage && <div className="logic-note">{saveMessage}</div>}
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Allocation Preview</h2>

              {loadingCommitments && <p>Loading investor commitments...</p>}

              {!loadingCommitments && calculatedInvestors.length === 0 && (
                <div className="explain-box">
                  No investor commitments found for this fund.
                </div>
              )}

              {!loadingCommitments && calculatedInvestors.length > 0 && (
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
                      <tr key={investor.id}>
                        <td>{investor.name}</td>
                        <td>{investor.preference}</td>
                        <td>
                          {investor.isEligible
                            ? `${(investor.ratio * 100).toFixed(2)}%`
                            : "Excluded"}
                        </td>
                        <td>{formatCr(investor.investorCall)}</td>
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
              )}
            </div>

            <div className="preview-card">
              <h2>Approval Workflow</h2>

              <div className="approval-flow">
                <div className="approval-step">Draft</div>
                <div className={isApproved ? "approval-step" : "approval-step current"}>
                  Finance Head Review
                </div>
                <div className="approval-step">Managing Partner</div>
                <div className={isApproved ? "approval-step current" : "approval-step"}>
                  Approved
                </div>
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
                  <p>Journal generated and validated by AI</p>
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
                <div className="queue-item">
                  ✓ {eligibleCount} Investor Email Drafts
                </div>
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
                  <strong>{formatCr(callAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Cr LP Capital Contribution</span>
                  <strong>{formatCr(callAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Dispatch Status</span>
                  <strong>
                    {isApproved
                      ? "Approved and ready for dispatch"
                      : "Waiting for Finance Head approval"}
                  </strong>
                </div>
              </div>

              <div className="explain-box">
                Once approved, VENTIQ will generate investor notices, prepare
                LP-wise workings, draft emails, queue portal updates, create the
                accounting entry and start bank receipt tracking automatically.
              </div>
            </div>

            <div className="preview-card">
              <h2>Downstream Workflow Automation</h2>

              <p className="eyebrow">
                8 automation tasks generated • 4 completed automatically • 4
                waiting for approval
              </p>

              <div className="queue-grid">
                <div className="queue-item">🟢 Capital Call Notice Generated</div>
                <div className="queue-item">🟢 LP Allocation Workbook Ready</div>
                <div className="queue-item">🟢 Investor Email Drafts Ready</div>
                <div className="queue-item">🟢 Institutional Notice Ready</div>
                <div className="queue-item">
                  {isApproved ? "🟢 Investor Portal Update" : "🟡 Investor Portal Update"}
                </div>
                <div className="queue-item">
                  {isApproved ? "🟢 WhatsApp Alerts" : "🟡 WhatsApp Alerts"}
                </div>
                <div className="queue-item">
                  {isApproved ? "🟢 Accounting Entry" : "🟡 Accounting Entry"}
                </div>
                <div className="queue-item">
                  {isApproved ? "🟢 Activity Engine Event" : "🟡 Activity Engine Event"}
                </div>
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
                  <strong>{formatCr(callAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Cr LP Capital Contribution</span>
                  <strong>{formatCr(callAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Status</span>
                  <strong>{isApproved ? "Approved" : "Pending Approval"}</strong>
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
                Without this capital call, projected available cash falls to ₹0
                Cr after approved investments, fees and the required liquidity
                buffer. VENTIQ estimates liquidity stress within 18 days.
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Timeline</h2>

              <div className="audit-timeline">
                <div className="audit-item">
                  <strong>09:30</strong> ✓ Cash forecast reviewed
                </div>

                <div className="audit-item">
                  <strong>09:32</strong> ✓ AI recommended {formatCr(callAmount)} call
                </div>

                <div className="audit-item">
                  <strong>09:35</strong>{" "}
                  {excludedInvestor === "None"
                    ? "✓ No investor exclusions applied"
                    : "✓ Investor exclusions applied"}
                </div>

                <div className="audit-item">
                  <strong>09:37</strong> ✓ Allocation generated from Supabase
                </div>

                <div className="audit-item">
                  <strong>09:38</strong> ✓ Notices and Excel workings drafted
                </div>

                <div className="audit-item">
                  <strong>09:40</strong>{" "}
                  {isApproved
                    ? "Finance Head approval completed"
                    : "Waiting Finance Head approval"}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}