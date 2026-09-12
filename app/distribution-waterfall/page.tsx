"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";

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

type SavedDistribution = {
  id: string;
  fund_id: string;
  distribution_name: string | null;
  distribution_date: string | null;
  payment_date: string | null;
  distribution_amount: number | null;
  distribution_type: string | null;
  waterfall_method: string | null;
  status: string | null;
  created_at: string | null;
  funds: { name: string } | { name: string }[] | null;
};
type SavedDistributionInvestor = {
  id: string;
  distribution_id: string;
  investor_id: string | null;
  commitment_id: string | null;
  distribution_amount: number | null;
  allocation_amount: number | null;
  allocation_percentage: number | null;
  status: string | null;
  investors: Investor | Investor[] | null;
  commitments:
    | { commitment_amount: number | null; called_amount: number | null }
    | { commitment_amount: number | null; called_amount: number | null }[]
    | null;
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

function getSavedDistributionFundName(value: SavedDistribution["funds"]) {
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
function getSavedInvestor(value: SavedDistributionInvestor["investors"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getSavedCommitment(value: SavedDistributionInvestor["commitments"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

  if (type.toLowerCase().includes("family")) return "Medium";
  if (type.toLowerCase().includes("insurance")) return "Low";

  return "Low";
}

export default function DistributionWaterfallPage() {
  const {
    activeFundName,
    isReady: activeFundReady,
  } = useActiveFund("");

  return (
    <DistributionWaterfallWorkspace
      key={
        activeFundReady && activeFundName
          ? activeFundName
          : "__fund_loading__"
      }
      activeFundName={activeFundName}
      activeFundReady={activeFundReady}
    />
  );
}

function DistributionWaterfallWorkspace({
  activeFundName,
  activeFundReady,
}: {
  activeFundName: string;
  activeFundReady: boolean;
}) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedFundId, setSelectedFundId] = useState("");
  const [distributionAmountInput, setDistributionAmountInput] = useState("");
  const [distributionType, setDistributionType] = useState("Exit Proceeds");
  const [waterfallMethod, setWaterfallMethod] = useState("European Waterfall");
  const [excludedInvestor, setExcludedInvestor] = useState("None");
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedDistributions, setSavedDistributions] = useState<
    SavedDistribution[]
  >([]);
  const [loadingSavedDistributions, setLoadingSavedDistributions] =
    useState(false);
    const [selectedSavedDistribution, setSelectedSavedDistribution] =
  useState<SavedDistribution | null>(null);
const [savedDistributionAllocations, setSavedDistributionAllocations] =
  useState<SavedDistributionInvestor[]>([]);
const [loadingDistributionAllocation, setLoadingDistributionAllocation] =
  useState(false);
const [distributionAllocationMessage, setDistributionAllocationMessage] =
  useState("");
const [deletingDistributionId, setDeletingDistributionId] = useState("");
const [approvingDistributionId, setApprovingDistributionId] = useState("");
const [distributionActionMessage, setDistributionActionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingCommitments, setLoadingCommitments] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadActiveFund() {
      if (!activeFundReady) {
        return;
      }

      if (!activeFundName) {
        setFunds([]);
        setSelectedFundId("");
        setErrorMessage(
          "No governed active fund is available for this account."
        );
        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        setFunds([]);
        setSelectedFundId("");
        setErrorMessage(
          "The distribution data connection is unavailable."
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("funds")
        .select(
          "id, name, fund_type, category, jurisdiction, currency, committed_capital, called_capital, status"
        )
        .eq("name", activeFundName)
        .limit(2);

      if (error) {
        setFunds([]);
        setSelectedFundId("");
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const fundData = (data ?? []) as Fund[];

      if (fundData.length !== 1) {
        setFunds([]);
        setSelectedFundId("");
        setErrorMessage(
          fundData.length === 0
            ? `No distribution fund record was found for ${activeFundName}.`
            : `Multiple distribution fund records matched ${activeFundName}; refusing ambiguous fund scope.`
        );
        setLoading(false);
        return;
      }

      setFunds(fundData);
      setSelectedFundId(fundData[0].id);
      setErrorMessage("");
      setLoading(false);
    }

    loadActiveFund();
  }, [activeFundName, activeFundReady]);

  useEffect(() => {
    async function loadCommitments() {
      if (!activeFundReady || !activeFundName || !selectedFundId || !supabase) {
        return;
      }

      setLoadingCommitments(true);
      setCommitments([]);
      setErrorMessage("");

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
  }, [activeFundName, activeFundReady, selectedFundId]);

  useEffect(() => {
    if (!selectedFundId) {
      return;
    }

    loadSavedDistributions();
  }, [selectedFundId]);

  const selectedFund = funds.find((fund) => fund.id === selectedFundId);
  const selectedFundName = cleanFundName(selectedFund?.name);
const distributionAmount = Number(distributionAmountInput || 0);
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
        preference: getInvestorPreference(investor),
        risk: getInvestorRisk(investor),
        kycStatus: investor?.kyc_status ?? "Pending",
      };
    });
  }, [commitments]);

  const eligibleInvestors = investorRows.filter((investor) => {
    return excludedInvestor === "None" || investor.name !== excludedInvestor;
  });

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

  const totalDistributionBasis =
    eligibleInvestors.reduce((sum, investor) => {
      return (
        sum +
        (investor.calledTillDate > 0
          ? investor.calledTillDate
          : investor.commitment)
      );
    }, 0) || 0;

  const calculatedInvestors = investorRows.map((investor) => {
    const isEligible =
      excludedInvestor === "None" || investor.name !== excludedInvestor;

    const basis =
      investor.calledTillDate > 0 ? investor.calledTillDate : investor.commitment;

    const ratio =
      isEligible && totalDistributionBasis > 0
        ? basis / totalDistributionBasis
        : 0;

    return {
      ...investor,
      isEligible,
      basis,
      ratio,
      distributionShare: distributionAmount * ratio,
    };
  });

  const eligibleCount = calculatedInvestors.filter(
    (investor) => investor.isEligible
  ).length;

  const hasGovernedWaterfallTerms = false;
  const activeDistributionAmount = selectedSavedDistribution
  ? toCr(selectedSavedDistribution.distribution_amount)
  : distributionAmount;

const activeDistributionName =
  selectedSavedDistribution?.distribution_name ??
  `${selectedFundName} Distribution Preview`;

const isDistributionApproved =
  selectedSavedDistribution?.status === "approved";

const approvedInvestorCount = savedDistributionAllocations.filter(
  (allocation) => allocation.status === "approved"
).length;

const readyInvestorCount = savedDistributionAllocations.filter(
  (allocation) => allocation.status === "ready"
).length;

  async function loadSavedDistributions() {
    if (!supabase || !selectedFundId) {
      setSavedDistributions([]);
      return;
    }

    setLoadingSavedDistributions(true);

    const { data, error } = await supabase
      .from("distributions")
      .select(
        "id, fund_id, distribution_name, distribution_date, payment_date, distribution_amount, distribution_type, waterfall_method, status, created_at, funds(name)"
      )
      .eq("fund_id", selectedFundId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error) {
      setSavedDistributions((data as unknown as SavedDistribution[]) ?? []);
    }

    setLoadingSavedDistributions(false);
  }
async function handleOpenSavedDistribution(distribution: SavedDistribution) {
  if (!selectedFundId || distribution.fund_id !== selectedFundId) {
    setDistributionAllocationMessage(
      "This distribution does not belong to the governed active fund."
    );
    return;
  }

  if (!supabase) {
    setDistributionAllocationMessage(
  "The distribution allocation workflow is unavailable because Supabase is not configured."
);
    return;
  }

  setSelectedSavedDistribution(distribution);
  setSavedDistributionAllocations([]);
  setDistributionAllocationMessage("");
  setLoadingDistributionAllocation(true);

  const { data, error } = await supabase
    .from("distribution_investors")
    .select(
      "id, distribution_id, investor_id, commitment_id, distribution_amount, allocation_amount, allocation_percentage, status, investors(name, investor_type, email, country, kyc_status), commitments(commitment_amount, called_amount)"
    )
    .eq("distribution_id", distribution.id)
    .order("allocation_amount", { ascending: false });

  if (error) {
    setDistributionAllocationMessage(
      `Could not load saved distribution allocation: ${error.message}`
    );
    setLoadingDistributionAllocation(false);
    return;
  }

  setSavedDistributionAllocations(
    (data as unknown as SavedDistributionInvestor[]) ?? []
  );

  setLoadingDistributionAllocation(false);
}

async function handleDeleteSavedDistribution(distribution: SavedDistribution) {
  if (!selectedFundId || distribution.fund_id !== selectedFundId) {
    setDistributionActionMessage(
      "This distribution does not belong to the governed active fund."
    );
    return;
  }

  if (!supabase) {
    setDistributionActionMessage(
  "The distribution workflow is unavailable because Supabase is not configured."
);
    return;
  }

  const confirmed = window.confirm(
    `Delete this saved distribution draft?\n\n${
      distribution.distribution_name ?? "VENTIQ Distribution Draft"
    }`
  );

  if (!confirmed) return;

  setDeletingDistributionId(distribution.id);
  setDistributionActionMessage("");
  setDistributionAllocationMessage("");

  const { error: investorDeleteError } = await supabase
    .from("distribution_investors")
    .delete()
    .eq("distribution_id", distribution.id);

  if (investorDeleteError) {
    setDistributionActionMessage(
      `Could not delete investor allocations: ${investorDeleteError.message}`
    );
    setDeletingDistributionId("");
    return;
  }

  const { error: distributionDeleteError } = await supabase
    .from("distributions")
    .delete()
    .eq("id", distribution.id)
    .eq("fund_id", selectedFundId);

  if (distributionDeleteError) {
    setDistributionActionMessage(
      `Could not delete saved distribution: ${distributionDeleteError.message}`
    );
    setDeletingDistributionId("");
    return;
  }

  if (selectedSavedDistribution?.id === distribution.id) {
    setSelectedSavedDistribution(null);
    setSavedDistributionAllocations([]);
  }

  await loadSavedDistributions();

  setDistributionActionMessage("Saved distribution draft deleted successfully.");
  setDeletingDistributionId("");
}

async function handleApproveSavedDistribution(distribution: SavedDistribution) {
  if (!selectedFundId || distribution.fund_id !== selectedFundId) {
    setDistributionActionMessage(
      "This distribution does not belong to the governed active fund."
    );
    return;
  }

  if (!supabase) {
    setDistributionActionMessage(
  "The distribution workflow is unavailable because Supabase is not configured."
);
    return;
  }

  const confirmed = window.confirm(
    `Approve this distribution draft?\n\n${
      distribution.distribution_name ?? "VENTIQ Distribution Draft"
    }`
  );

  if (!confirmed) return;

  setApprovingDistributionId(distribution.id);
  setDistributionActionMessage("");
  setDistributionAllocationMessage("");

  const { error: distributionUpdateError } = await supabase
    .from("distributions")
    .update({ status: "approved" })
    .eq("id", distribution.id)
    .eq("fund_id", selectedFundId);

  if (distributionUpdateError) {
    setDistributionActionMessage(
      `Could not approve distribution: ${distributionUpdateError.message}`
    );
    setApprovingDistributionId("");
    return;
  }

  const { error: allocationUpdateError } = await supabase
    .from("distribution_investors")
    .update({ status: "approved" })
    .eq("distribution_id", distribution.id)
    .eq("status", "ready");

  if (allocationUpdateError) {
    setDistributionActionMessage(
      `Distribution approved, but LP allocation status update failed: ${allocationUpdateError.message}`
    );
    setApprovingDistributionId("");
    return;
  }

  if (selectedSavedDistribution?.id === distribution.id) {
    setSelectedSavedDistribution({
      ...selectedSavedDistribution,
      status: "approved",
    });

    await handleOpenSavedDistribution({
      ...distribution,
      status: "approved",
    });
  }

  await loadSavedDistributions();

  setDistributionActionMessage("Distribution draft approved successfully.");
  setApprovingDistributionId("");
}
  async function handleSaveDistributionDraft() {
    if (!supabase) {
      setSaveMessage(
  "The distribution draft workflow is unavailable because Supabase is not configured."
);
      return;
    }

    if (!activeFundReady || !activeFundName || !selectedFundId) {
      setSaveMessage("A governed active fund is required before saving.");
      return;
    }

    if (selectedFund?.name !== activeFundName) {
      setSaveMessage(
        "The resolved distribution fund does not match the governed active fund."
      );
      return;
    }

    if (!Number.isFinite(distributionAmount) || distributionAmount <= 0) {
      setSaveMessage("Enter a distribution amount greater than zero before saving.");
      return;
    }

    if (calculatedInvestors.length === 0) {
      setSaveMessage("No investor allocation found to save.");
      return;
    }

    setSavingDraft(true);
    setSaveMessage("");

    const distributionName = `${selectedFundName} Distribution - ${new Date().toLocaleDateString(
      "en-IN"
    )}`;

    const distributionDate = new Date().toISOString().slice(0, 10);

    const paymentDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: savedDistribution, error: distributionError } = await supabase
      .from("distributions")
      .insert({
        distribution_name: distributionName,
        distribution_date: distributionDate,
        payment_date: paymentDate,
        fund_id: selectedFundId,
        distribution_amount: distributionAmount * 10000000,
        distribution_type: distributionType,
        waterfall_method: waterfallMethod,
        excluded_investor: excludedInvestor === "None" ? null : excludedInvestor,
        status: "draft",
        created_by: "VENTIQ AI Finance Head",
      })
      .select("id")
      .single();

    if (distributionError || !savedDistribution?.id) {
      setSaveMessage(
        `Could not save distribution draft: ${
          distributionError?.message ?? "Missing saved distribution ID"
        }`
      );
      setSavingDraft(false);
      return;
    }

    const investorPayload = calculatedInvestors.map((investor) => ({
      distribution_id: savedDistribution.id,
      commitment_id: investor.commitmentId,
      investor_id: investor.investorId,
      distribution_amount: investor.distributionShare * 10000000,
      allocation_amount: investor.distributionShare * 10000000,
      allocation_percentage: Number((investor.ratio * 100).toFixed(4)),
      status: investor.isEligible ? "ready" : "skipped",
    }));

    const { error: investorError } = await supabase
      .from("distribution_investors")
      .insert(investorPayload);

    if (investorError) {
      setSaveMessage(
        `Distribution saved, but investor allocation failed: ${investorError.message}`
      );
      setSavingDraft(false);
      return;
    }

    await loadSavedDistributions();

    setSaveMessage(
      `Distribution draft saved successfully for ${selectedFundName}. ${eligibleCount} investor allocations stored.`
    );

    setSavingDraft(false);
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Finance</p>
            <h1>AI Distribution Waterfall</h1>
            <p>
              AI-assisted distribution planning, waterfall calculation, carry
              analysis, LP allocation and fund accounting preparation.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>
<div className="sample-data-ribbon">
  {activeFundName || "Governed fund"} · Live governed distribution data
</div>
        {loading && (
  <div className="preview-card">
    <h2>Preparing Distribution Waterfall Preview...</h2>
    <p>
      VENTIQ is loading the governed fund, investor commitments and distribution
      allocation workflow.
    </p>
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
              <h2>Distribution Planning Snapshot</h2>

              <div className="explain-box">
                VENTIQ is using the governed active fund and connected investor
                commitment records below. Enter the proposed distribution amount
                before saving a draft. No distributable-cash forecast or AI
                confidence is inferred unless the required governed cash,
                liability, fee and waterfall inputs are connected.
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{selectedFundName}</h3>
                <p>Governed active fund</p>
              </div>
              <div className="impact-card">
                <h3>{formatCr(totalCommitment)}</h3>
                <p>Total commitments</p>
              </div>
              <div className="impact-card">
                <h3>{formatCr(totalCalledTillDate)}</h3>
                <p>Called capital</p>
              </div>
              <div className="impact-card">
                <h3>{eligibleCount}</h3>
                <p>Eligible LPs</p>
              </div>
            </div>

            <div className="preview-card">
  <h2>Saved Distribution Drafts</h2>

  <p className="eyebrow">
    Latest saved distribution drafts
  </p>

  {distributionActionMessage && (
    <div className="logic-note">{distributionActionMessage}</div>
  )}

  {loadingSavedDistributions && (
    <p>Loading saved distributions...</p>
  )}

  {!loadingSavedDistributions && savedDistributions.length === 0 && (
    <div className="explain-box">
      No saved distribution drafts found yet. Click Save Draft to create the
      first saved distribution workflow.
    </div>
  )}

  {!loadingSavedDistributions && savedDistributions.length > 0 && (
    <table className="investor-table">
      <thead>
        <tr>
          <th>Draft Name</th>
          <th>Fund</th>
          <th>Amount</th>
          <th>Distribution Date</th>
          <th>Payment Date</th>
          <th>Type</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {savedDistributions.map((distribution) => (
          <tr key={distribution.id}>
            <td>
              {distribution.distribution_name ??
                "VENTIQ Distribution Draft"}
            </td>

            <td>
              {getSavedDistributionFundName(distribution.funds)}
            </td>

            <td>
              {formatCr(toCr(distribution.distribution_amount))}
            </td>

            <td>
              {formatDate(distribution.distribution_date)}
            </td>

            <td>{formatDate(distribution.payment_date)}</td>

            <td>
              {distribution.distribution_type ?? "Distribution"}
            </td>

            <td>
              <span className="small-pill">
                {distribution.status ?? "draft"}
              </span>
            </td>

<td>
  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
    <button
      type="button"
      onClick={() => handleOpenSavedDistribution(distribution)}
      style={{
        border: "1px solid rgba(96, 165, 250, 0.45)",
        background: "rgba(37, 99, 235, 0.16)",
        color: "#dbeafe",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Open
    </button>

    <button
      type="button"
      onClick={() => handleApproveSavedDistribution(distribution)}
      disabled={
        distribution.status === "approved" ||
        approvingDistributionId === distribution.id
      }
      style={{
        border: "1px solid rgba(74, 222, 128, 0.45)",
        background: "rgba(22, 101, 52, 0.18)",
        color: "#bbf7d0",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 700,
        cursor:
          distribution.status === "approved" ||
          approvingDistributionId === distribution.id
            ? "not-allowed"
            : "pointer",
        opacity:
          distribution.status === "approved" ||
          approvingDistributionId === distribution.id
            ? 0.6
            : 1,
      }}
    >
      {approvingDistributionId === distribution.id
        ? "Approving..."
        : distribution.status === "approved"
        ? "Approved"
        : "Approve"}
    </button>
{distribution.status === "approved" && (
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
      padding: "8px 16px",
      fontSize: "14px",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    Documents
  </a>
)}
    <button
      type="button"
      onClick={() => handleDeleteSavedDistribution(distribution)}
      disabled={deletingDistributionId === distribution.id}
      style={{
        border: "1px solid rgba(248, 113, 113, 0.45)",
        background: "rgba(127, 29, 29, 0.18)",
        color: "#fecaca",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 700,
        cursor:
          deletingDistributionId === distribution.id
            ? "not-allowed"
            : "pointer",
        opacity: deletingDistributionId === distribution.id ? 0.6 : 1,
      }}
    >
      {deletingDistributionId === distribution.id ? "Deleting..." : "Delete"}
    </button>
  </div>
</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>

{selectedSavedDistribution && (
  <div className="preview-card">
    <h2>Opened Distribution Allocation</h2>

    <p className="eyebrow">
      Saved LP-wise distribution allocation preview
    </p>

    <div className="impact-grid">
      <div className="impact-card">
        <h3>
          {selectedSavedDistribution.distribution_name ??
            "VENTIQ Distribution Draft"}
        </h3>
        <p>Draft selected</p>
      </div>

      <div className="impact-card">
        <h3>
          {formatCr(toCr(selectedSavedDistribution.distribution_amount))}
        </h3>
        <p>Saved distribution amount</p>
      </div>

      <div className="impact-card">
        <h3>{formatDate(selectedSavedDistribution.distribution_date)}</h3>
        <p>Distribution date</p>
      </div>

      <div className="impact-card">
        <h3>{selectedSavedDistribution.status ?? "draft"}</h3>
        <p>Saved status</p>
      </div>
    </div>

    {loadingDistributionAllocation && (
      <p>Loading saved distribution allocation...</p>
    )}

    {distributionAllocationMessage && (
      <div className="explain-box">{distributionAllocationMessage}</div>
    )}

    {!loadingDistributionAllocation &&
      !distributionAllocationMessage &&
      savedDistributionAllocations.length === 0 && (
        <div className="explain-box">
          No investor allocation rows found for this saved distribution.
        </div>
      )}

    {!loadingDistributionAllocation &&
      savedDistributionAllocations.length > 0 && (
        <table className="investor-table">
          <thead>
            <tr>
              <th>Investor</th>
              <th>Investor Type</th>
              <th>Commitment</th>
              <th>Called Capital</th>
              <th>Allocation %</th>
              <th>Distribution Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {savedDistributionAllocations.map((allocation) => {
              const investor = getSavedInvestor(allocation.investors);
              const commitment = getSavedCommitment(allocation.commitments);

              return (
                <tr key={allocation.id}>
                  <td>{investor?.name ?? "Unknown Investor"}</td>
                  <td>{investor?.investor_type ?? "Investor"}</td>
                  <td>{formatCr(toCr(commitment?.commitment_amount))}</td>
                  <td>{formatCr(toCr(commitment?.called_amount))}</td>
                  <td>
                    {Number(allocation.allocation_percentage || 0).toFixed(2)}%
                  </td>
                  <td>
                    {formatCr(
                      toCr(
                        allocation.allocation_amount ??
                          allocation.distribution_amount
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
{selectedSavedDistribution && (
  <div className="preview-card">
    <h2>Distribution Accounting & Investor Updates</h2>

    <p className="eyebrow">
      Post-approval automation preview for the selected distribution draft
    </p>

    <div className="impact-grid">
      <div className="impact-card">
        <h3>{isDistributionApproved ? "Approved" : "Pending"}</h3>
        <p>Distribution status</p>
      </div>

      <div className="impact-card">
        <h3>{formatCr(activeDistributionAmount)}</h3>
        <p>Accounting amount</p>
      </div>

      <div className="impact-card">
        <h3>{savedDistributionAllocations.length}</h3>
        <p>LP allocation rows</p>
      </div>

      <div className="impact-card">
        <h3>{isDistributionApproved ? approvedInvestorCount : readyInvestorCount}</h3>
        <p>{isDistributionApproved ? "Approved LP rows" : "Ready LP rows"}</p>
      </div>
    </div>

    <div className="journal-preview">
      <div className="journal-row">
        <span>Selected Distribution</span>
        <strong>{activeDistributionName}</strong>
      </div>

      <div className="journal-row">
        <span>Dr LP Distribution Payable</span>
        <strong>{formatCr(activeDistributionAmount)}</strong>
      </div>

      <div className="journal-row">
        <span>Cr Bank / Cash</span>
        <strong>{formatCr(activeDistributionAmount)}</strong>
      </div>

      <div className="journal-row">
        <span>Accounting Status</span>
        <strong>
          {isDistributionApproved
            ? "Approved and ready for posting"
            : "Waiting for distribution approval"}
        </strong>
      </div>
    </div>

    <div className="queue-grid">
      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} LP-wise distribution statement
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Investor email drafts
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Investor portal update
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} WhatsApp notification queue
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Accounting journal validation
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Bank payment instruction file
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Audit trail event
      </div>

      <div className="queue-item">
        {isDistributionApproved ? "🟢" : "🟡"} Compliance review log
      </div>
    </div>

    <div className="audit-timeline">
      <div className="audit-item">
        <strong>09:30</strong> ✓ Distribution draft selected
      </div>

      <div className="audit-item">
        <strong>09:32</strong> ✓ LP-wise allocation loaded from connected fund data
      </div>

      <div className="audit-item">
        <strong>09:34</strong> ✓ Accounting journal prepared
      </div>

      <div className="audit-item">
        <strong>09:36</strong>{" "}
        {isDistributionApproved
          ? "Distribution approved — investor updates ready"
          : "Waiting for approval before investor dispatch"}
      </div>

      <div className="audit-item">
        <strong>09:38</strong>{" "}
        {isDistributionApproved
          ? "Portal, email and payment workflows queued"
          : "Automation paused until approval"}
      </div>
    </div>

    <div className="explain-box">
      Once the distribution draft is approved, VENTIQ prepares the accounting
      entry, LP-wise distribution statements, investor emails, portal updates,
      WhatsApp notifications, bank payment instruction file and audit trail.
    </div>
    {isDistributionApproved && (
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
      Generate Investor Documents
    </a>
  </div>
)}
  </div>
)}
            <div className="preview-card">
              <h2>Governed Distribution Inputs</h2>

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
                  <span>Called Capital</span>
                  <strong>{formatCr(totalCalledTillDate)}</strong>
                </div>
                <div className="journal-row">
                  <span>Unfunded Commitments</span>
                  <strong>{formatCr(totalUnfunded)}</strong>
                </div>
                <div className="journal-row">
                  <span>Proposed Distribution</span>
                  <strong>{formatCr(distributionAmount)}</strong>
                </div>
              </div>

              <div className="explain-box">
                Cash availability, realised proceeds, income, liabilities, fees,
                expenses and confidence scores are not displayed until those inputs
                are connected to governed canonical records.
              </div>
            </div>

            <div className="preview-card">
              <h2>Distribution Draft</h2>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{selectedFundName}</h3>
                  <p>Governed active fund</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(distributionAmount)}</h3>
                  <p>Proposed distribution amount</p>
                </div>

                <div className="impact-card">
                  <h3>{eligibleCount}</h3>
                  <p>Eligible LPs</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(totalUnfunded)}</h3>
                  <p>Unfunded commitments</p>
                </div>
              </div>

              <div className="form-card">
                <p className="eyebrow">
                  Prepared from governed fund and commitment data — editable before approval
                </p>

                <label>Fund Type</label>
                <select value="Close-ended Fund" disabled>
                  <option>Close-ended Fund</option>
                  <option>Open-ended Fund</option>
                </select>

                <label>Fund</label>
                <select value={selectedFundId} disabled>
                  {selectedFund ? (
                    <option value={selectedFund.id}>{selectedFund.name}</option>
                  ) : (
                    <option value="">No governed active fund resolved</option>
                  )}
                </select>
                <p className="field-help">
                  Fund scope is controlled by the authenticated VENTIQ Active Fund selector.
                </p>

                <label>Distribution Amount (₹ Cr)</label>
                <input
  type="number"
  value={distributionAmountInput}
  onChange={(event) => setDistributionAmountInput(event.target.value)}
/>

                <label>Distribution Type</label>
                <select
                  value={distributionType}
                  onChange={(event) => setDistributionType(event.target.value)}
                >
                  <option>Exit Proceeds</option>
                  <option>Income Distribution</option>
                  <option>Capital Distribution</option>
                  <option>Interest Income</option>
                </select>

                <label>Waterfall Method</label>
                <select
                  value={waterfallMethod}
                  onChange={(event) => setWaterfallMethod(event.target.value)}
                >
                  <option>European Waterfall</option>
                  <option>American Waterfall</option>
                  <option>Deal-by-deal Waterfall</option>
                </select>

                <label>Exclude Investor</label>
                <select
                  value={excludedInvestor}
                  onChange={(event) => setExcludedInvestor(event.target.value)}
                >
                  <option>None</option>
                  {investorRows.map((investor) => (
                    <option key={investor.id}>{investor.name}</option>
                  ))}
                </select>

                <div className="logic-note">
                  VENTIQ allocated the entered distribution amount using the
                  connected investor commitment basis shown below. Fund-specific
                  waterfall economics are not inferred unless governed waterfall
                  terms are available.
                </div>

                <div className="action-row">
                  <button type="button" disabled>Approval available after a governed draft is saved</button>

                  <button
                    type="button"
                    onClick={handleSaveDistributionDraft}
                    disabled={savingDraft || calculatedInvestors.length === 0}
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                </div>

                {saveMessage && <div className="logic-note">{saveMessage}</div>}
              </div>
            </div>

            <div className="preview-card">
              <h2>AI LP Distribution Preview</h2>

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
                      <th>Distribution</th>
                      <th>Risk</th>
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
                        <td>{formatCr(investor.distributionShare)}</td>
                        <td>{investor.risk}</td>
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
              <h2>Waterfall Calculation Status</h2>

              <div className="explain-box">
                {hasGovernedWaterfallTerms
                  ? "Governed fund-specific waterfall terms are available for deterministic calculation."
                  : "Fund-specific hurdle, preferred return, catch-up and carried-interest terms are not connected on this workspace. VENTIQ will not display illustrative waterfall amounts as production results."}
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{formatCr(distributionAmount)}</h3>
                  <p>Entered distribution amount</p>
                </div>
                <div className="impact-card">
                  <h3>{waterfallMethod.replace(" Waterfall", "")}</h3>
                  <p>Selected method</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}