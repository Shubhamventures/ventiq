"use client";

import { useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

type InvestorImportBatch = {
  id: string;
  fund_name: string;
  batch_name: string | null;
};

type InvestorMaster = {
  id: string;
  investor_code: string;
  investor_name: string;
  email: string;
  investor_type: string | null;
  kyc_status: string | null;
  bank_status: string | null;
};

type FundCommitment = {
  id: string;
  investor_id: string;
  fund_name: string;
  class_name: string | null;
  commitment_amount: number;
  unfunded_commitment: number;
  commitment_status: string | null;
};

type FinancialRow = {
  investorId: string;
  investorCode: string;
  investorName: string;
  email: string;
  fundName: string;
  className: string;
  commitmentAmount: number;
  capitalCalledTillDate: number;
  uncalledCapital: number;
  distributionsTillDate: number;
  setupFee: number;
  managementFee: number;
  netContributed: number;
  currentNav: number;
  investorIrr: number;
  investorMoic: number;
  investorDpi: number;
  investorTvpi: number;
  status: "Ready" | "Review";
};

function toCr(value: number | null | undefined) {
  return Number(value || 0) / 10000000;
}

function formatCr(value: number) {
  return `₹${toCr(value).toFixed(2)} Cr`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatMultiple(value: number) {
  return `${value.toFixed(2)}x`;
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function getPastDate(yearsAgo: number, monthOffset = 0) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - yearsAgo);
  date.setMonth(date.getMonth() + monthOffset);
  return date.toISOString().slice(0, 10);
}

function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

export default function InvestorFinancialMigrationPage() {
  const [latestBatch, setLatestBatch] = useState<InvestorImportBatch | null>(
    null
  );
  const [investors, setInvestors] = useState<InvestorMaster[]>([]);
  const [commitments, setCommitments] = useState<FundCommitment[]>([]);
  const [financialRows, setFinancialRows] = useState<FinancialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);

  const metrics = useMemo(() => {
    const totalCommitment = financialRows.reduce(
      (sum, row) => sum + row.commitmentAmount,
      0
    );

    const totalCalled = financialRows.reduce(
      (sum, row) => sum + row.capitalCalledTillDate,
      0
    );

    const totalUncalled = financialRows.reduce(
      (sum, row) => sum + row.uncalledCapital,
      0
    );

    const totalDistributed = financialRows.reduce(
      (sum, row) => sum + row.distributionsTillDate,
      0
    );

    const averageIrr =
      financialRows.length > 0
        ? financialRows.reduce((sum, row) => sum + row.investorIrr, 0) /
          financialRows.length
        : 0;

    const averageMoic =
      financialRows.length > 0
        ? financialRows.reduce((sum, row) => sum + row.investorMoic, 0) /
          financialRows.length
        : 0;

    const reviewRows = financialRows.filter((row) => row.status === "Review");

    return {
      totalCommitment,
      totalCalled,
      totalUncalled,
      totalDistributed,
      averageIrr,
      averageMoic,
      reviewCount: reviewRows.length,
      readyCount: financialRows.length - reviewRows.length,
    };
  }, [financialRows]);

  async function handleLoadLatestInvestorBatch() {
    const supabaseClient = supabase;

    if (!isSupabaseConfigured || !supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    setLoading(true);
    setMessage("");
    setPublished(false);
    setFinancialRows([]);

    const { data: batchData, error: batchError } = await supabaseClient
      .from("investor_import_batches")
      .select("id, fund_name, batch_name")
      .order("created_at", { ascending: false })
      .limit(1);

    if (batchError) {
      setMessage(batchError.message);
      setLoading(false);
      return;
    }

    const batch = ((batchData as InvestorImportBatch[] | null) ?? [])[0];

    if (!batch) {
      setMessage("No investor import batch found. Run Investor Import first.");
      setLoading(false);
      return;
    }

    const { data: investorData, error: investorError } = await supabaseClient
      .from("investor_master")
      .select(
        "id, investor_code, investor_name, email, investor_type, kyc_status, bank_status"
      )
      .eq("batch_id", batch.id)
      .order("investor_code", { ascending: true });

    if (investorError) {
      setMessage(investorError.message);
      setLoading(false);
      return;
    }

    const { data: commitmentData, error: commitmentError } =
      await supabaseClient
        .from("fund_commitments")
        .select(
          "id, investor_id, fund_name, class_name, commitment_amount, unfunded_commitment, commitment_status"
        )
        .eq("batch_id", batch.id)
        .order("commitment_amount", { ascending: false });

    if (commitmentError) {
      setMessage(commitmentError.message);
      setLoading(false);
      return;
    }

    setLatestBatch(batch);
    setInvestors((investorData as InvestorMaster[]) ?? []);
    setCommitments((commitmentData as FundCommitment[]) ?? []);

    setMessage(
      `Loaded ${investorData?.length ?? 0} investors and ${
        commitmentData?.length ?? 0
      } commitments from ${batch.fund_name}.`
    );

    setLoading(false);
  }

  function handleGenerateFinancialPreview() {
    if (!latestBatch) {
      setMessage("Load latest investor batch first.");
      return;
    }

    if (investors.length === 0 || commitments.length === 0) {
      setMessage("Investor or commitment data is missing.");
      return;
    }

    const investorMap = new Map(
      investors.map((investor) => [investor.id, investor])
    );

    const generatedRows: FinancialRow[] = commitments.map((commitment, index) => {
      const investor = investorMap.get(commitment.investor_id);

      const commitmentAmount = Number(commitment.commitment_amount || 0);

      const calledRate =
        index % 5 === 0
          ? 0.42
          : index % 5 === 1
          ? 0.48
          : index % 5 === 2
          ? 0.52
          : index % 5 === 3
          ? 0.58
          : 0.62;

      const capitalCalledTillDate = Math.round(commitmentAmount * calledRate);
      const uncalledCapital = Math.max(
        commitmentAmount - capitalCalledTillDate,
        0
      );

      const setupFee = Math.round(commitmentAmount * 0.01);
      const managementFee = Math.round(commitmentAmount * 0.02);

      const distributionRate =
        index % 6 === 0
          ? 0.12
          : index % 6 === 1
          ? 0.18
          : index % 6 === 2
          ? 0.24
          : index % 6 === 3
          ? 0.3
          : index % 6 === 4
          ? 0.36
          : 0.42;

      const distributionsTillDate = Math.round(
        capitalCalledTillDate * distributionRate
      );

      const valueUplift =
        index % 4 === 0 ? 0.18 : index % 4 === 1 ? 0.24 : index % 4 === 2 ? 0.31 : 0.39;

      const currentNav = Math.round(
        Math.max(capitalCalledTillDate - distributionsTillDate, 0) *
          (1 + valueUplift)
      );

      const netContributed =
        capitalCalledTillDate + setupFee + managementFee - distributionsTillDate;

      const investorDpi = safeDivide(
        distributionsTillDate,
        capitalCalledTillDate
      );

      const investorTvpi = safeDivide(
        distributionsTillDate + currentNav,
        capitalCalledTillDate
      );

      const investorMoic = investorTvpi;

      const investorIrr = Math.max(
        0,
        7.5 + (investorTvpi - 1) * 18 + (index % 7) * 0.45
      );

      const status: FinancialRow["status"] =
  !investor?.email || commitmentAmount <= 0 ? "Review" : "Ready";

      return {
        investorId: commitment.investor_id,
        investorCode: investor?.investor_code ?? "",
        investorName: investor?.investor_name ?? "Unknown Investor",
        email: investor?.email ?? "",
        fundName: commitment.fund_name || latestBatch.fund_name,
        className: commitment.class_name || "Class A",
        commitmentAmount,
        capitalCalledTillDate,
        uncalledCapital,
        distributionsTillDate,
        setupFee,
        managementFee,
        netContributed,
        currentNav,
        investorIrr,
        investorMoic,
        investorDpi,
        investorTvpi,
        status,
      };
    });

    setFinancialRows(generatedRows);
    setPublished(false);
    setMessage(
      `Generated investor-wise financial preview for ${generatedRows.length} investors.`
    );
  }

  async function handlePublishFinancialData() {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    if (!latestBatch) {
      setMessage("Load latest investor batch before publishing.");
      return;
    }

    if (financialRows.length === 0) {
      setMessage("Generate financial preview before publishing.");
      return;
    }

    setPublishing(true);
    setMessage("Publishing investor financial data...");

    const { data: batchData, error: batchError } = await supabaseClient
      .from("investor_financial_migration_batches")
      .insert({
        import_batch_id: latestBatch.id,
        fund_name: latestBatch.fund_name,
        total_investors: financialRows.length,
        total_commitment: metrics.totalCommitment,
        total_called: metrics.totalCalled,
        total_uncalled: metrics.totalUncalled,
        total_distributed: metrics.totalDistributed,
        average_irr: metrics.averageIrr,
        average_moic: metrics.averageMoic,
        status:
          metrics.reviewCount > 0 ? "published_with_exceptions" : "published",
      })
      .select("id")
      .single();

    if (batchError || !batchData) {
      setMessage(batchError?.message || "Unable to create financial batch.");
      setPublishing(false);
      return;
    }

    const financialBatchId = String(batchData.id);

    const positionRows = financialRows.map((row) => ({
      financial_batch_id: financialBatchId,
      import_batch_id: latestBatch.id,
      investor_id: row.investorId,
      investor_code: row.investorCode,
      investor_name: row.investorName,
      email: row.email,
      fund_name: row.fundName,
      class_name: row.className,
      commitment_amount: row.commitmentAmount,
      capital_called_till_date: row.capitalCalledTillDate,
      uncalled_capital: row.uncalledCapital,
      distributions_till_date: row.distributionsTillDate,
      setup_fee: row.setupFee,
      management_fee: row.managementFee,
      net_contributed: row.netContributed,
      current_nav: row.currentNav,
      investor_irr: row.investorIrr,
      investor_moic: row.investorMoic,
      investor_dpi: row.investorDpi,
      investor_tvpi: row.investorTvpi,
      status: row.status,
    }));

    const cashflowRows = financialRows.flatMap((row) => [
      {
        financial_batch_id: financialBatchId,
        investor_id: row.investorId,
        investor_code: row.investorCode,
        investor_name: row.investorName,
        fund_name: row.fundName,
        cashflow_date: getPastDate(3, 0),
        cashflow_type: "Setup Fee",
        amount: row.setupFee,
        direction: "outflow",
        description: "Investor setup fee migrated from historical records.",
      },
      {
        financial_batch_id: financialBatchId,
        investor_id: row.investorId,
        investor_code: row.investorCode,
        investor_name: row.investorName,
        fund_name: row.fundName,
        cashflow_date: getPastDate(2, 2),
        cashflow_type: "Capital Call",
        amount: Math.round(row.capitalCalledTillDate * 0.6),
        direction: "outflow",
        description: "Historical capital call migrated from fund records.",
      },
      {
        financial_batch_id: financialBatchId,
        investor_id: row.investorId,
        investor_code: row.investorCode,
        investor_name: row.investorName,
        fund_name: row.fundName,
        cashflow_date: getPastDate(1, 4),
        cashflow_type: "Capital Call",
        amount: Math.round(row.capitalCalledTillDate * 0.4),
        direction: "outflow",
        description: "Follow-on capital call migrated from fund records.",
      },
      {
        financial_batch_id: financialBatchId,
        investor_id: row.investorId,
        investor_code: row.investorCode,
        investor_name: row.investorName,
        fund_name: row.fundName,
        cashflow_date: getPastDate(0, -3),
        cashflow_type: "Distribution",
        amount: row.distributionsTillDate,
        direction: "inflow",
        description: "Historical distribution migrated from fund records.",
      },
    ]);

    for (const chunk of chunkRows(positionRows, 250)) {
      const { error } = await supabaseClient
        .from("investor_financial_positions")
        .insert(chunk);

      if (error) {
        setMessage(error.message);
        setPublishing(false);
        return;
      }
    }

    for (const chunk of chunkRows(cashflowRows, 250)) {
      const { error } = await supabaseClient
        .from("investor_cashflows")
        .insert(chunk);

      if (error) {
        setMessage(error.message);
        setPublishing(false);
        return;
      }
    }

    setPublished(true);
    setPublishing(false);
    setMessage(
      `${financialRows.length} investor financial positions and ${cashflowRows.length} cashflow records published.`
    );
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Migration Portal</p>
            <h1>Investor Financial Data Migration</h1>
            <p>
              Upload or migrate investor-level financial history: commitments,
              called capital, uncalled capital, fees, distributions, NAV, DPI,
              TVPI, MOIC and investor-level IRR.
            </p>
          </div>

          <a className="back-link" href="/migration">
            Back to Migration
          </a>
        </div>

        <div className="sample-data-ribbon">
          Migration workspace · Investor-level financial history · Demo data
          generated from imported commitments
        </div>

        <div className="preview-card">
          <h2>Migration Flow</h2>

          <div className="explain-box">
            This workspace converts imported investor commitments into
            investor-level financial positions. In a real fund migration, this
            same screen will accept Excel files containing capital calls,
            distributions, fees, NAV and investor cashflow history.
          </div>

          <div className="action-row">
            <button
              className="monitor-btn monitor-btn-primary"
              disabled={loading}
              onClick={handleLoadLatestInvestorBatch}
              type="button"
            >
              {loading ? "Loading..." : "Load Latest Investor Batch"}
            </button>

            <button
              className="monitor-btn monitor-btn-secondary"
              disabled={!latestBatch}
              onClick={handleGenerateFinancialPreview}
              type="button"
            >
              Generate Financial Preview
            </button>

            <button
              className="monitor-btn monitor-btn-primary"
              disabled={financialRows.length === 0 || publishing || published}
              onClick={handlePublishFinancialData}
              type="button"
            >
              {publishing
                ? "Publishing..."
                : published
                ? "Published"
                : "Publish Financial Data"}
            </button>
          </div>

          {message && <div className="logic-note">{message}</div>}
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{latestBatch ? latestBatch.fund_name : "-"}</h3>
            <p>Fund selected</p>
          </div>

          <div className="impact-card">
            <h3>{investors.length}</h3>
            <p>Investors loaded</p>
          </div>

          <div className="impact-card">
            <h3>{commitments.length}</h3>
            <p>Commitments loaded</p>
          </div>

          <div className="impact-card">
            <h3>{financialRows.length}</h3>
            <p>Financial rows prepared</p>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{formatCr(metrics.totalCommitment)}</h3>
            <p>Total commitment</p>
          </div>

          <div className="impact-card">
            <h3>{formatCr(metrics.totalCalled)}</h3>
            <p>Capital called till date</p>
          </div>

          <div className="impact-card">
            <h3>{formatCr(metrics.totalUncalled)}</h3>
            <p>Uncalled capital</p>
          </div>

          <div className="impact-card">
            <h3>{formatCr(metrics.totalDistributed)}</h3>
            <p>Distributions till date</p>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{formatPercent(metrics.averageIrr)}</h3>
            <p>Average investor IRR</p>
          </div>

          <div className="impact-card">
            <h3>{formatMultiple(metrics.averageMoic)}</h3>
            <p>Average investor MOIC</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.readyCount}</h3>
            <p>Ready rows</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.reviewCount}</h3>
            <p>Review rows</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Investor Financial Preview</h2>

          {financialRows.length === 0 && (
            <div className="explain-box">
              Load the investor batch and generate financial preview to see
              investor-wise migrated financial data.
            </div>
          )}

          {financialRows.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "620px",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: "18px",
                marginTop: "18px",
              }}
            >
              <table
                className="investor-table"
                style={{
                  minWidth: "1500px",
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Class</th>
                    <th>Commitment</th>
                    <th>Called</th>
                    <th>Uncalled</th>
                    <th>Distributions</th>
                    <th>Setup Fee</th>
                    <th>Management Fee</th>
                    <th>Current NAV</th>
                    <th>DPI</th>
                    <th>TVPI</th>
                    <th>MOIC</th>
                    <th>IRR</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {financialRows.slice(0, 40).map((row) => (
                    <tr key={row.investorId}>
                      <td>
                        <strong>
                          {row.investorCode} - {row.investorName}
                        </strong>
                        <br />
                        {row.email}
                      </td>
                      <td>{row.className}</td>
                      <td>{formatCr(row.commitmentAmount)}</td>
                      <td>{formatCr(row.capitalCalledTillDate)}</td>
                      <td>{formatCr(row.uncalledCapital)}</td>
                      <td>{formatCr(row.distributionsTillDate)}</td>
                      <td>{formatCr(row.setupFee)}</td>
                      <td>{formatCr(row.managementFee)}</td>
                      <td>{formatCr(row.currentNav)}</td>
                      <td>{formatMultiple(row.investorDpi)}</td>
                      <td>{formatMultiple(row.investorTvpi)}</td>
                      <td>{formatMultiple(row.investorMoic)}</td>
                      <td>{formatPercent(row.investorIrr)}</td>
                      <td>
                        <span className="small-pill">{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {financialRows.length > 40 && (
            <div className="logic-note">
              Showing first 40 rows only. All {financialRows.length} rows will
              be published.
            </div>
          )}
        </div>

        <div className="preview-card">
          <h2>What This Unlocks Next</h2>

          <div className="queue-grid">
            <div className="queue-item">
              📊 Investor Portal Metrics
              <br />
              Called, uncalled, distributions, DPI, TVPI, MOIC and IRR
            </div>

            <div className="queue-item">
              💸 Investor Cashflow Timeline
              <br />
              Historical calls, fees and distributions investor-wise
            </div>

            <div className="queue-item">
              🤖 AI Investor Answers
              <br />
              “How much have I contributed?” and “What is my IRR?”
            </div>

            <div className="queue-item">
              🧠 Managing Partner View
              <br />
              Aggregated investor performance and fund-level reporting
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}