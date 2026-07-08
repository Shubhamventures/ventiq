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
type SavedCapitalCallInvestor = {
  id: string;
  capital_call_id: string;
  investor_id: string | null;
  commitment_id: string | null;
  call_amount: number | null;
  allocation_amount: number | null;
  allocation_percentage: number | null;
  status: string | null;
  investors: Investor | Investor[] | null;
  commitments: { commitment_amount: number | null } | { commitment_amount: number | null }[] | null;
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
function getSavedInvestor(value: SavedCapitalCallInvestor["investors"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getSavedCommitment(
  value: SavedCapitalCallInvestor["commitments"]
) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function getSavedInvestor(value: SavedCapitalCallInvestor["investors"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getSavedCommitment(
  value: SavedCapitalCallInvestor["commitments"]
) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
const [hasGeneratedCapitalCall, setHasGeneratedCapitalCall] = useState(false);
const [savingDraft, setSavingDraft] = useState(false);
const [saveMessage, setSaveMessage] = useState("");
const [savedDrafts, setSavedDrafts] = useState<SavedCapitalCall[]>([]);
const [loadingSavedDrafts, setLoadingSavedDrafts] = useState(false);
const [selectedSavedDraft, setSelectedSavedDraft] =
  useState<SavedCapitalCall | null>(null);
const [savedDraftAllocations, setSavedDraftAllocations] = useState<
  SavedCapitalCallInvestor[]
>([]);
const [loadingDraftAllocation, setLoadingDraftAllocation] = useState(false);
const [draftAllocationMessage, setDraftAllocationMessage] = useState("");
const [deletingDraftId, setDeletingDraftId] = useState("");
const [draftActionMessage, setDraftActionMessage] = useState("");
const [approvingDraftId, setApprovingDraftId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingCommitments, setLoadingCommitments] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFunds() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage("The sample workflow is temporarily unavailable. Please request a walkthrough.");
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
async function handleOpenSavedDraft(draft: SavedCapitalCall) {
  if (!supabase) {
    setDraftAllocationMessage(
  "The sample allocation workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

 setSelectedSavedDraft(draft);
setIsApproved(draft.status === "approved");
setSavedDraftAllocations([]);
  setDraftAllocationMessage("");
  setLoadingDraftAllocation(true);

  const { data, error } = await supabase
    .from("capital_call_investors")
    .select(
      "id, capital_call_id, investor_id, commitment_id, call_amount, allocation_amount, allocation_percentage, status, investors(name, investor_type, email, country, kyc_status), commitments(commitment_amount)"
    )
    .eq("capital_call_id", draft.id)
    .order("allocation_amount", { ascending: false });

  if (error) {
    setDraftAllocationMessage(
      `Could not load saved allocation: ${error.message}`
    );
    setLoadingDraftAllocation(false);
    return;
  }

  setSavedDraftAllocations(
    (data as unknown as SavedCapitalCallInvestor[]) ?? []
  );

  setLoadingDraftAllocation(false);
}
function handleCloseSavedDraftPreview() {
  setSelectedSavedDraft(null);
  setSavedDraftAllocations([]);
  setDraftAllocationMessage("");
}
async function handleDeleteSavedDraft(draft: SavedCapitalCall) {
  if (!supabase) {
    setDraftActionMessage(
  "The sample capital call workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const confirmed = window.confirm(
    `Delete this saved draft?\n\n${draft.call_name ?? "VENTIQ Capital Call Draft"}`
  );

  if (!confirmed) return;

  setDeletingDraftId(draft.id);
  setDraftActionMessage("");
  setDraftAllocationMessage("");

  const { error: investorDeleteError } = await supabase
    .from("capital_call_investors")
    .delete()
    .eq("capital_call_id", draft.id);

  if (investorDeleteError) {
    setDraftActionMessage(
      `Could not delete investor allocations: ${investorDeleteError.message}`
    );
    setDeletingDraftId("");
    return;
  }

  const { error: draftDeleteError } = await supabase
    .from("capital_calls")
    .delete()
    .eq("id", draft.id);

  if (draftDeleteError) {
    setDraftActionMessage(
      `Could not delete saved draft: ${draftDeleteError.message}`
    );
    setDeletingDraftId("");
    return;
  }

  if (selectedSavedDraft?.id === draft.id) {
    setSelectedSavedDraft(null);
    setSavedDraftAllocations([]);
  }

  await loadSavedDrafts();

  setDraftActionMessage("Saved draft deleted successfully.");
  setDeletingDraftId("");
}
async function handleApproveSavedDraft(draft: SavedCapitalCall) {
  if (!supabase) {
    setDraftActionMessage(
  "The sample capital call workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const confirmed = window.confirm(
    `Approve this capital call draft?\n\n${draft.call_name ?? "VENTIQ Capital Call Draft"}`
  );

  if (!confirmed) return;

  setApprovingDraftId(draft.id);
  setDraftActionMessage("");
  setDraftAllocationMessage("");

  const { error: callUpdateError } = await supabase
    .from("capital_calls")
    .update({ status: "approved" })
    .eq("id", draft.id);

  if (callUpdateError) {
    setDraftActionMessage(
      `Could not approve capital call: ${callUpdateError.message}`
    );
    setApprovingDraftId("");
    return;
  }

  const { error: allocationUpdateError } = await supabase
    .from("capital_call_investors")
    .update({ status: "approved" })
    .eq("capital_call_id", draft.id)
    .eq("status", "ready");

  if (allocationUpdateError) {
    setDraftActionMessage(
      `Capital call approved, but investor allocation status update failed: ${allocationUpdateError.message}`
    );
    setApprovingDraftId("");
    return;
  }

  if (selectedSavedDraft?.id === draft.id) {
    setSelectedSavedDraft({
      ...selectedSavedDraft,
      status: "approved",
    });

    await handleOpenSavedDraft({
      ...draft,
      status: "approved",
    });
  }

setIsApproved(true);

await loadSavedDrafts();

setDraftActionMessage("Capital call draft approved successfully.");
setApprovingDraftId("");
}
function handleProceedWithCapitalCall() {
  if (!selectedFundId) {
    setSaveMessage("Please select a fund before proceeding.");
    return;
  }

  setHasGeneratedCapitalCall(true);
  setIsApproved(false);

  setSaveMessage(
    "Capital call draft generated. Review the draft preview below, then save the draft."
  );

  setTimeout(() => {
    document
      .getElementById("capital-call-draft-preview")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}
async function handleSaveDraft() {
  if (!supabase) {
    setSaveMessage(
  "The sample draft workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  if (!selectedFundId) {
  setSaveMessage("Please select a fund before saving.");
  return;
}

if (!hasGeneratedCapitalCall) {
  setSaveMessage("Please click Proceed with Capital Call before saving the draft.");
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
    status: "draft",
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
                <div className="sample-data-ribbon">
          Live workflow preview · Sample data shown for demonstration
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Capital Call Workspace...</h2>
<p>VENTIQ is preparing the sample fund, investor commitment and allocation workflow.</p>
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

  <p className="eyebrow">Latest saved capital call drafts</p>
  {draftActionMessage && (
  <div className="logic-note">{draftActionMessage}</div>
)}

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
          <th>Action</th>
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
<td>
  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button
      type="button"
      onClick={() => {
        if (selectedSavedDraft?.id === draft.id) {
          handleCloseSavedDraftPreview();
        } else {
          handleOpenSavedDraft(draft);
        }
      }}
      style={{
        border:
          selectedSavedDraft?.id === draft.id
            ? "1px solid rgba(148, 163, 184, 0.45)"
            : "1px solid rgba(96, 165, 250, 0.45)",
        background:
          selectedSavedDraft?.id === draft.id
            ? "rgba(71, 85, 105, 0.22)"
            : "rgba(37, 99, 235, 0.16)",
        color: "#dbeafe",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {selectedSavedDraft?.id === draft.id ? "Close Preview" : "Open Preview"}
    </button>

    {selectedSavedDraft?.id === draft.id && (
      <button
        type="button"
        onClick={() => handleApproveSavedDraft(draft)}
        disabled={draft.status === "approved" || approvingDraftId === draft.id}
        style={{
          border: "1px solid rgba(74, 222, 128, 0.45)",
          background: "rgba(22, 101, 52, 0.18)",
          color: "#bbf7d0",
          borderRadius: "999px",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: 700,
          cursor:
            draft.status === "approved" || approvingDraftId === draft.id
              ? "not-allowed"
              : "pointer",
          opacity:
            draft.status === "approved" || approvingDraftId === draft.id
              ? 0.6
              : 1,
        }}
      >
        {approvingDraftId === draft.id
          ? "Approving..."
          : draft.status === "approved"
          ? "Approved"
          : "Approve"}
      </button>
    )}

    <button
      type="button"
      onClick={() => handleDeleteSavedDraft(draft)}
      disabled={deletingDraftId === draft.id}
      style={{
        border: "1px solid rgba(248, 113, 113, 0.45)",
        background: "rgba(127, 29, 29, 0.18)",
        color: "#fecaca",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 700,
        cursor: deletingDraftId === draft.id ? "not-allowed" : "pointer",
        opacity: deletingDraftId === draft.id ? 0.6 : 1,
      }}
    >
      {deletingDraftId === draft.id ? "Deleting..." : "Delete"}
    </button>
  </div>
</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
{selectedSavedDraft && (
  <div className="preview-card">
    <h2>Opened Draft Allocation</h2>

   <p className="eyebrow">
  Saved investor-wise allocation preview
</p>

    <div className="impact-grid">
      <div className="impact-card">
        <h3>{selectedSavedDraft.call_name ?? "VENTIQ Capital Call Draft"}</h3>
        <p>Draft selected</p>
      </div>

      <div className="impact-card">
        <h3>{formatCr(toCr(selectedSavedDraft.call_amount))}</h3>
        <p>Saved call amount</p>
      </div>

      <div className="impact-card">
        <h3>{formatDate(selectedSavedDraft.call_date)}</h3>
        <p>Call date</p>
      </div>

      <div className="impact-card">
        <h3>{selectedSavedDraft.status ?? "draft"}</h3>
        <p>Saved status</p>
      </div>
    </div>

    {loadingDraftAllocation && <p>Loading saved allocation...</p>}

    {draftAllocationMessage && (
      <div className="explain-box">{draftAllocationMessage}</div>
    )}

    {!loadingDraftAllocation &&
      !draftAllocationMessage &&
      savedDraftAllocations.length === 0 && (
        <div className="explain-box">
          No investor allocation rows found for this saved draft.
        </div>
      )}

    {!loadingDraftAllocation && savedDraftAllocations.length > 0 && (
      <table className="investor-table">
        <thead>
          <tr>
            <th>Investor</th>
            <th>Investor Type</th>
            <th>Commitment</th>
            <th>Allocation %</th>
            <th>Allocation Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {savedDraftAllocations.map((allocation) => {
            const investor = getSavedInvestor(allocation.investors);
            const commitment = getSavedCommitment(allocation.commitments);

            return (
              <tr key={allocation.id}>
                <td>{investor?.name ?? "Unknown Investor"}</td>
                <td>{investor?.investor_type ?? "Investor"}</td>
                <td>{formatCr(toCr(commitment?.commitment_amount))}</td>
                <td>
                  {Number(allocation.allocation_percentage || 0).toFixed(2)}%
                </td>
                <td>
                  {formatCr(
                    toCr(
                      allocation.allocation_amount ??
                        allocation.call_amount
                    )
                  )}
                </td>
                <td>
                  <span className="small-pill">
                    {allocation.status ?? "ready"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </div>
)}
            <div className="preview-card">
              <h2>AI Financial Reasoning</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Selected Fund</span>
                  <strong>{selectedFundName}</strong>
                </div>

                <div className="journal-row">
                  <span>Total Commitments</span>
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
                    setHasGeneratedCapitalCall(false);
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
                  onChange={(event) => {
  setFundType(event.target.value);
  setIsApproved(false);
  setHasGeneratedCapitalCall(false);
}}
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
                    setHasGeneratedCapitalCall(false);
                  }}
                />

                <label>Allocation Method</label>
                <select
                  value={allocationMethod}
                  onChange={(event) => {
                    setAllocationMethod(event.target.value);
                    setIsApproved(false);
                    setHasGeneratedCapitalCall(false);
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
                    setHasGeneratedCapitalCall(false);
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
                    setHasGeneratedCapitalCall(false);
                  }}
                >
                  <option>None</option>
                  {investorRows.map((investor) => (
                    <option key={investor.id}>{investor.name}</option>
                  ))}
                </select>

                <div className="logic-note">
                 VENTIQ pre-filled this capital call using connected fund,
investor and commitment data, while keeping the allocation
editable before approval.
                </div>

                                <div className="action-row">
                  <button
  type="button"
  onClick={handleProceedWithCapitalCall}
  disabled={loadingCommitments || !selectedFundId}
>
  {hasGeneratedCapitalCall
    ? "✓ Draft Generated"
    : "Proceed with Capital Call"}
</button>
                </div>

                {!hasGeneratedCapitalCall && (
                  <div className="logic-note">
                    Choose the fund, amount, allocation method and investor batch.
                    Then click Proceed with Capital Call to generate the draft preview.
                  </div>
                )}

                {saveMessage && <div className="logic-note">{saveMessage}</div>}
              </div>
            </div>

                        <div id="capital-call-draft-preview" className="preview-card">
              <h2>Draft Preview Before Saving</h2>

              {!hasGeneratedCapitalCall && (
                <div className="explain-box">
                  Draft preview will appear here after you click Proceed with
                  Capital Call.
                </div>
              )}
              {hasGeneratedCapitalCall && calculatedInvestors.length === 0 && (
  <div className="explain-box">
    Draft generated, but no investor commitment rows are available for this
    fund. Please check the selected fund or investor commitment data.
  </div>
)}

              {hasGeneratedCapitalCall && (
                <>
                  <div className="impact-grid">
                    <div className="impact-card">
                      <h3>{selectedFundName}</h3>
                      <p>Fund selected</p>
                    </div>

                    <div className="impact-card">
                      <h3>{formatCr(callAmount)}</h3>
                      <p>Draft call amount</p>
                    </div>

                    <div className="impact-card">
                      <h3>{eligibleCount}</h3>
                      <p>Eligible LPs</p>
                    </div>

                    <div className="impact-card">
                      <h3>{excludedCount}</h3>
                      <p>Excluded LPs</p>
                    </div>
                  </div>

                  <div className="explain-box">
                    This is the draft capital call allocation before saving.
                    Review investor-wise allocation, basis, call amount, risk
                    and ETA before creating the saved draft.
                  </div>

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
                            <td>
                              {investor.isEligible ? investor.eta : "Excluded"}
                            </td>
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

                  <div className="action-row">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || calculatedInvestors.length === 0}
                    >
                      {savingDraft ? "Saving Draft..." : "Save Draft"}
                    </button>
                  </div>
                </>
              )}
            </div>

                        {selectedSavedDraft && (
              <div className="preview-card">
                <h2>Approval Workflow</h2>

                <div className="approval-flow">
                  <div className="approval-step">Draft Saved</div>

                  <div
                    className={
                      isApproved ? "approval-step" : "approval-step current"
                    }
                  >
                    Finance Head Review
                  </div>

                  <div className="approval-step">Managing Partner</div>

                  <div
                    className={
                      isApproved ? "approval-step current" : "approval-step"
                    }
                  >
                    Approved
                  </div>

                  <div className="approval-step">Posted</div>
                </div>
              </div>
            )}

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
              {isApproved && (
  <div className="action-row">
    <a
      href="/document-engine"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(96, 165, 250, 0.45)",
        background: "rgba(37, 99, 235, 0.2)",
        color: "#dbeafe",
        borderRadius: "999px",
        padding: "12px 18px",
        fontSize: "15px",
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      Generate Capital Call Notices
    </a>
  </div>
)}
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
                <a
  href="/document-engine"
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 700,
    textDecoration: "none",
  }}
>
  Generate Investor Documents
</a>
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
                  <strong>09:37</strong> ✓ Allocation generated from connected fund data
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