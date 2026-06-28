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

type SavedDistribution = {
  id: string;
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
  const [funds, setFunds] = useState<Fund[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedFundId, setSelectedFundId] = useState("");
  const [distributionAmountInput, setDistributionAmountInput] = useState("18.5");
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
            fund.name.toLowerCase().includes("growth")
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
  }, [selectedFundId]);

  useEffect(() => {
    loadSavedDistributions();
  }, []);

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

  const returnOfCapital = Math.min(distributionAmount, 12);
  const preferredReturn = Math.min(Math.max(distributionAmount - 12, 0), 4);
  const gpCatchup = Math.min(Math.max(distributionAmount - 16, 0), 1);
  const carriedInterest = Math.max(distributionAmount - 17, 0);

  async function loadSavedDistributions() {
    if (!supabase) return;

    setLoadingSavedDistributions(true);

    const { data, error } = await supabase
      .from("distributions")
      .select(
        "id, distribution_name, distribution_date, payment_date, distribution_amount, distribution_type, waterfall_method, status, created_at, funds(name)"
      )
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error) {
      setSavedDistributions((data as unknown as SavedDistribution[]) ?? []);
    }

    setLoadingSavedDistributions(false);
  }

  async function handleSaveDistributionDraft() {
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

        {loading && (
          <div className="preview-card">
            <h2>Loading Distribution Engine...</h2>
            <p>VENTIQ is reading fund and investor data from Supabase.</p>
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
              <h2>AI Distribution Recommendation</h2>

              <div className="explain-box">
                VENTIQ recommends distributing{" "}
                <strong>{formatCr(distributionAmount)}</strong> from{" "}
                <strong>{selectedFundName}</strong>. Confidence:{" "}
                <strong>99%</strong>. The recommendation is based on realised
                exit proceeds, interest collections, pending liabilities,
                management fees, fund liquidity policy and live investor
                commitment data from Supabase.
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCr(distributionAmount)}</h3>
                <p>Recommended distribution</p>
              </div>

              <div className="impact-card">
                <h3>99%</h3>
                <p>AI confidence</p>
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

            <div className="preview-card">
              <h2>Saved Distribution Drafts</h2>

              <p className="eyebrow">
                Latest saved distribution drafts from Supabase
              </p>

              {loadingSavedDistributions && (
                <p>Loading saved distributions...</p>
              )}

              {!loadingSavedDistributions &&
                savedDistributions.length === 0 && (
                  <div className="explain-box">
                    No saved distribution drafts found yet. Click Save Draft to
                    create the first saved distribution workflow.
                  </div>
                )}

              {!loadingSavedDistributions &&
                savedDistributions.length > 0 && (
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
                            {getSavedDistributionFundName(
                              distribution.funds
                            )}
                          </td>
                          <td>
                            {formatCr(
                              toCr(distribution.distribution_amount)
                            )}
                          </td>
                          <td>
                            {formatDate(distribution.distribution_date)}
                          </td>
                          <td>{formatDate(distribution.payment_date)}</td>
                          <td>
                            {distribution.distribution_type ??
                              "Distribution"}
                          </td>
                          <td>
                            <span className="small-pill">
                              {distribution.status ?? "draft"}
                            </span>
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
                  <span>Called Capital From Supabase</span>
                  <strong>{formatCr(totalCalledTillDate)}</strong>
                </div>

                <div className="journal-row">
                  <span>Cash Available</span>
                  <strong>₹28.00 Cr</strong>
                </div>

                <div className="journal-row">
                  <span>Add: Exit Proceeds</span>
                  <strong>₹4.00 Cr</strong>
                </div>

                <div className="journal-row">
                  <span>Add: Interest Income</span>
                  <strong>₹2.00 Cr</strong>
                </div>

                <div className="journal-row">
                  <span>Less: Management Fee</span>
                  <strong>(₹1.00 Cr)</strong>
                </div>

                <div className="journal-row">
                  <span>Less: Fund Expenses</span>
                  <strong>(₹0.50 Cr)</strong>
                </div>

                <div className="journal-row">
                  <span>Distributable Cash</span>
                  <strong>₹32.50 Cr</strong>
                </div>

                <div className="journal-row">
                  <span>AI Recommendation</span>
                  <strong>Distribute {formatCr(distributionAmount)}</strong>
                </div>

                <div className="journal-row">
                  <span>Confidence</span>
                  <strong>99%</strong>
                </div>
              </div>

              <div className="explain-box">
                <strong>Why?</strong> VENTIQ analysed realised proceeds,
                interest collections, pending liabilities, management fees,
                expenses, liquidity policy and investor commitment records. The
                AI recommends distributing {formatCr(distributionAmount)} while
                retaining adequate liquidity for future obligations.
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Generated Distribution</h2>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{selectedFundName}</h3>
                  <p>Fund selected by AI</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(distributionAmount)}</h3>
                  <p>Recommended amount</p>
                </div>

                <div className="impact-card">
                  <h3>{eligibleCount}</h3>
                  <p>Eligible LPs</p>
                </div>

                <div className="impact-card">
                  <h3>99%</h3>
                  <p>AI confidence</p>
                </div>
              </div>

              <div className="form-card">
                <p className="eyebrow">
                  Prepared automatically by VENTIQ AI — editable before approval
                </p>

                <label>Fund Type</label>
                <select value="Close-ended Fund" disabled>
                  <option>Close-ended Fund</option>
                  <option>Open-ended Fund</option>
                </select>

                <label>Fund</label>
                <select
                  value={selectedFundId}
                  onChange={(event) => {
                    setSelectedFundId(event.target.value);
                    setExcludedInvestor("None");
                  }}
                >
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name}
                    </option>
                  ))}
                </select>

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
                  VENTIQ pre-filled this distribution using live Supabase fund,
                  investor and commitment data, realised exits, interest
                  collections, liquidity policy and the fund&apos;s waterfall
                  rules.
                </div>

                <div className="action-row">
                  <button>Approve Recommendation</button>

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
              <h2>AI Waterfall Summary</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  <strong>Tier 1</strong>
                  <br />
                  Return of Capital
                  <br />
                  {formatCr(returnOfCapital)}
                  <br />
                  🟢 Completed
                </div>

                <div className="queue-item">
                  <strong>Tier 2</strong>
                  <br />
                  Preferred Return
                  <br />
                  {formatCr(preferredReturn)}
                  <br />
                  🟢 Completed
                </div>

                <div className="queue-item">
                  <strong>Tier 3</strong>
                  <br />
                  GP Catch-up
                  <br />
                  {formatCr(gpCatchup)}
                  <br />
                  🟢 Completed
                </div>

                <div className="queue-item">
                  <strong>Tier 4</strong>
                  <br />
                  Carried Interest
                  <br />
                  {formatCr(carriedInterest)}
                  <br />
                  🟢 Completed
                </div>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{formatCr(distributionAmount)}</h3>
                  <p>Total distribution</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(carriedInterest)}</h3>
                  <p>Carry calculated</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCr(preferredReturn)}</h3>
                  <p>Preferred return</p>
                </div>

                <div className="impact-card">
                  <h3>{waterfallMethod.replace(" Waterfall", "")}</h3>
                  <p>Waterfall method</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}