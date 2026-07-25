"use client";

import { Fragment, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type FundRow = {
  id: string;
  fundName: string;
  fundType: string;
  category: string;
  jurisdiction: string;
  firstCloseDate: string;
  secondCloseDate: string;
  finalCloseDate: string;
  targetCorpus: number;
  committedCapital: number;
  greenShoe: number;
  managementFeeRate: number;
  setupCostRate: number;
  carryRate: number;
  hurdleRate: number;
  waterfallType: string;
  sponsorCommitment: number;
  trusteeName: string;
  investmentManager: string;
  status: "Ready" | "Review";
};

type FundDbRow = {
  id: string;
  fund_code: string | null;
  fund_name: string | null;
  fund_type: string | null;
  category: string | null;
  jurisdiction: string | null;
  first_close_date: string | null;
  second_close_date: string | null;
  final_close_date: string | null;
  target_corpus: number | string | null;
  committed_capital: number | string | null;
  green_shoe: number | string | null;
  management_fee_rate: number | string | null;
  setup_cost_rate: number | string | null;
  carry_rate: number | string | null;
  hurdle_rate: number | string | null;
  waterfall_type: string | null;
  sponsor_commitment: number | string | null;
  trustee_name: string | null;
  investment_manager: string | null;
  migration_status: string | null;
};

const sampleFunds: FundRow[] = [
  {
    id: "F001",
    fundName: "VENTIQ Growth Fund II",
    fundType: "Close-ended",
    category: "Category II AIF",
    jurisdiction: "India",
    firstCloseDate: "2024-01-31",
    secondCloseDate: "2024-09-30",
    finalCloseDate: "2025-03-31",
    targetCorpus: 1000000000,
    committedCapital: 981500000,
    greenShoe: 250000000,
    managementFeeRate: 2,
    setupCostRate: 1,
    carryRate: 20,
    hurdleRate: 10,
    waterfallType: "European",
    sponsorCommitment: 50000000,
    trusteeName: "ABC Trusteeship Services",
    investmentManager: "VENTIQ Capital Advisors",
    status: "Ready",
  },
];

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function toNullableDate(value: string) {
  return value.trim() ? value : null;
}

function normalizeFundStatus(value: string | null): FundRow["status"] {
  if (value === "Ready" || value === "Review") {
    return value;
  }

  return "Ready";
}

function downloadFundTemplate() {
  const headers = [
    "fund_name",
    "fund_type",
    "category",
    "jurisdiction",
    "first_close_date",
    "second_close_date",
    "final_close_date",
    "target_corpus",
    "committed_capital",
    "green_shoe",
    "management_fee_rate",
    "setup_cost_rate",
    "carry_rate",
    "hurdle_rate",
    "waterfall_type",
    "sponsor_commitment",
    "trustee_name",
    "investment_manager",
  ];

  const sample = [
    "VENTIQ Growth Fund II",
    "Close-ended",
    "Category II AIF",
    "India",
    "2024-01-31",
    "2024-09-30",
    "2025-03-31",
    "1000000000",
    "981500000",
    "250000000",
    "2",
    "1",
    "20",
    "10",
    "European",
    "50000000",
    "ABC Trusteeship Services",
    "VENTIQ Capital Advisors",
  ];

  const csv = [headers, sample]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "ventiq-fund-data-template.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function FundDataMigrationPage() {
  const [funds, setFunds] = useState<FundRow[]>(sampleFunds);
  const [message, setMessage] = useState("");
  const [activeBatchName, setActiveBatchName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [loadingLatestBatch, setLoadingLatestBatch] = useState(false);

  function handleFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setMessage(
      `${fileList.length} fund data file staged. CSV/XLSX parsing will be connected in the next step. You can publish current staged records to Supabase now.`
    );
  }

  const metrics = useMemo(() => {
    const totalTargetCorpus = funds.reduce(
      (sum, fund) => sum + fund.targetCorpus,
      0
    );

    const committedCapital = funds.reduce(
      (sum, fund) => sum + fund.committedCapital,
      0
    );

    const greenShoe = funds.reduce((sum, fund) => sum + fund.greenShoe, 0);

    const sponsorCommitment = funds.reduce(
      (sum, fund) => sum + fund.sponsorCommitment,
      0
    );

    const commitmentCoverage = totalTargetCorpus
      ? Math.round((committedCapital / totalTargetCorpus) * 100)
      : 0;

    const averageManagementFee =
      funds.length > 0
        ? funds.reduce((sum, fund) => sum + fund.managementFeeRate, 0) /
          funds.length
        : 0;

    const averageCarry =
      funds.length > 0
        ? funds.reduce((sum, fund) => sum + fund.carryRate, 0) / funds.length
        : 0;

    return {
      totalTargetCorpus,
      committedCapital,
      greenShoe,
      sponsorCommitment,
      commitmentCoverage,
      averageManagementFee,
      averageCarry,
    };
  }, [funds]);

  async function publishFundData() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (funds.length === 0) {
      setMessage("No fund records available to publish.");
      return;
    }

    setPublishing(true);
    setMessage("Publishing fund records to Supabase...");

    const batchName = `Fund Data Migration Batch - ${new Date().toLocaleString()}`;

    const { data: batchData, error: batchError } = await supabase
      .from("fund_data_migration_batches")
      .insert({
        batch_name: batchName,
        total_funds: funds.length,
        total_target_corpus: metrics.totalTargetCorpus,
        total_committed_capital: metrics.committedCapital,
        total_green_shoe: metrics.greenShoe,
        total_sponsor_commitment: metrics.sponsorCommitment,
        average_management_fee: metrics.averageManagementFee,
        average_carry: metrics.averageCarry,
        status: "published",
      })
      .select("id")
      .single();

    if (batchError || !batchData) {
      setMessage(batchError?.message ?? "Unable to create fund batch.");
      setPublishing(false);
      return;
    }

    const batchId = batchData.id as string;

    const payload = funds.map((fund) => ({
      batch_id: batchId,
      fund_code: fund.id,
      fund_name: fund.fundName,
      fund_type: fund.fundType,
      category: fund.category,
      jurisdiction: fund.jurisdiction,
      first_close_date: toNullableDate(fund.firstCloseDate),
      second_close_date: toNullableDate(fund.secondCloseDate),
      final_close_date: toNullableDate(fund.finalCloseDate),
      target_corpus: fund.targetCorpus,
      committed_capital: fund.committedCapital,
      green_shoe: fund.greenShoe,
      management_fee_rate: fund.managementFeeRate,
      setup_cost_rate: fund.setupCostRate,
      carry_rate: fund.carryRate,
      hurdle_rate: fund.hurdleRate,
      waterfall_type: fund.waterfallType,
      sponsor_commitment: fund.sponsorCommitment,
      trustee_name: fund.trusteeName,
      investment_manager: fund.investmentManager,
      migration_status: fund.status,
    }));

    const { error: fundError } = await supabase.from("fund_master").insert(payload);

    if (fundError) {
      setMessage(fundError.message);
      setPublishing(false);
      return;
    }

    setActiveBatchName(batchName);
    setMessage(`${funds.length} fund record(s) published to Supabase.`);
    setPublishing(false);
  }

  async function loadLatestFundBatch() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoadingLatestBatch(true);
    setMessage("Loading latest fund data migration batch...");

    const { data: batchData, error: batchError } = await supabase
      .from("fund_data_migration_batches")
      .select("id, batch_name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batchError) {
      setMessage(batchError.message);
      setLoadingLatestBatch(false);
      return;
    }

    if (!batchData) {
      setMessage("No fund data migration batch found yet.");
      setLoadingLatestBatch(false);
      return;
    }

    const batchId = batchData.id as string;
    const batchName = (batchData.batch_name as string) ?? "Latest fund batch";

    const { data: fundData, error: fundError } = await supabase
      .from("fund_master")
      .select(
        "id, fund_code, fund_name, fund_type, category, jurisdiction, first_close_date, second_close_date, final_close_date, target_corpus, committed_capital, green_shoe, management_fee_rate, setup_cost_rate, carry_rate, hurdle_rate, waterfall_type, sponsor_commitment, trustee_name, investment_manager, migration_status"
      )
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (fundError) {
      setMessage(fundError.message);
      setLoadingLatestBatch(false);
      return;
    }

    const dbRows = (fundData as FundDbRow[] | null) ?? [];

    const loadedFunds: FundRow[] = dbRows.map((fund) => ({
      id: fund.fund_code ?? fund.id,
      fundName: fund.fund_name ?? "Unknown Fund",
      fundType: fund.fund_type ?? "Not provided",
      category: fund.category ?? "Not provided",
      jurisdiction: fund.jurisdiction ?? "Not provided",
      firstCloseDate: fund.first_close_date ?? "",
      secondCloseDate: fund.second_close_date ?? "",
      finalCloseDate: fund.final_close_date ?? "",
      targetCorpus: Number(fund.target_corpus ?? 0),
      committedCapital: Number(fund.committed_capital ?? 0),
      greenShoe: Number(fund.green_shoe ?? 0),
      managementFeeRate: Number(fund.management_fee_rate ?? 0),
      setupCostRate: Number(fund.setup_cost_rate ?? 0),
      carryRate: Number(fund.carry_rate ?? 0),
      hurdleRate: Number(fund.hurdle_rate ?? 0),
      waterfallType: fund.waterfall_type ?? "Not provided",
      sponsorCommitment: Number(fund.sponsor_commitment ?? 0),
      trusteeName: fund.trustee_name ?? "Not provided",
      investmentManager: fund.investment_manager ?? "Not provided",
      status: normalizeFundStatus(fund.migration_status),
    }));

    setFunds(loadedFunds);
    setActiveBatchName(batchName);
    setMessage(`${loadedFunds.length} fund record(s) loaded from latest batch.`);
    setLoadingLatestBatch(false);
  }

  return (
    <main className="portfolio-migration-page">
      <section className="portfolio-shell">
        <div className="portfolio-hero">
          <div>
            <p className="portfolio-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Fund Data Migration</h1>

            <p className="portfolio-hero-copy">
              Upload fund structure, close dates, corpus, fee, carry, hurdle,
              waterfall, sponsor and trustee data. This becomes the operating
              layer for Finance, Compliance, Waterfall and Managing Partner
              dashboards.
            </p>

            <div className="portfolio-tags">
              <span>Fund setup</span>
              <span>Closes</span>
              <span>Fees</span>
              <span>Carry</span>
              <span>Waterfall</span>
              <span>Compliance</span>
            </div>
          </div>

          <div className="portfolio-hero-visual" aria-hidden="true">
            <div className="database-orb">◎</div>

            <div className="data-lines">
              <span />
              <span />
              <span />
            </div>

            <div className="mini-dashboard-card">
              <i />
              <i />
              <i />
            </div>
          </div>

          <a className="portfolio-back-link" href="/migration/data-intake">
            ← Back to Data Intake
          </a>
        </div>

        <div className="portfolio-persistence-panel">
          <div>
            <span>Saved fund workspace</span>
            <strong>{activeBatchName || "No fund batch loaded"}</strong>
            <p>
              Publish fund structure and economic terms to Supabase or reload
              the latest saved batch to continue after refresh.
            </p>
          </div>

          <div className="portfolio-persistence-actions">
            <button
              className="portfolio-secondary-button"
              disabled={loadingLatestBatch}
              onClick={loadLatestFundBatch}
              type="button"
            >
              {loadingLatestBatch ? "Loading..." : "Load Latest Batch"}
            </button>

            <button
              className="portfolio-primary-button"
              disabled={publishing}
              onClick={publishFundData}
              type="button"
            >
              {publishing ? "Publishing..." : "Publish Fund Data"}
            </button>
          </div>
        </div>

        <div className="portfolio-upload-card">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⇧</span>

              <div>
                <p className="portfolio-eyebrow">Fund Upload Workspace</p>
                <h2>Upload fund data using VENTIQ template</h2>
              </div>
            </div>

            <span className="portfolio-status-pill purple">
              Template required
            </span>
          </div>

          <div className="portfolio-upload-grid">
            <div className="portfolio-step-card">
              <span className="step-number">1</span>

              <h3>Download template</h3>

              <p>
                Use VENTIQ fields for fund setup, category, close dates, corpus,
                fees, carry, hurdle, waterfall and sponsor commitment.
              </p>

              <button
                className="portfolio-primary-button"
                onClick={downloadFundTemplate}
                type="button"
              >
                ↓ Download Fund Template
              </button>
            </div>

            <div className="portfolio-step-card">
              <span className="step-number">2</span>

              <h3>Upload completed file</h3>

              <p>
                Upload CSV/XLSX after filling fund structure and economic terms.
              </p>

              <label className="portfolio-dropzone">
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => handleFileSelected(event.target.files)}
                  type="file"
                />

                <span>⇧</span>
                <strong>Choose fund data file</strong>
                <small>CSV/XLSX template upload</small>
              </label>
            </div>
          </div>

          {message && <div className="portfolio-note">{message}</div>}
        </div>

        <div className="portfolio-kpi-grid">
          <div className="portfolio-kpi-card blue">
            <span>₹</span>
            <p>Target corpus</p>
            <h3>{formatCr(metrics.totalTargetCorpus)}</h3>
          </div>

          <div className="portfolio-kpi-card green">
            <span>↗</span>
            <p>Committed capital</p>
            <h3>{formatCr(metrics.committedCapital)}</h3>
          </div>

          <div className="portfolio-kpi-card purple">
            <span>%</span>
            <p>Commitment coverage</p>
            <h3>{metrics.commitmentCoverage}%</h3>
          </div>

          <div className="portfolio-kpi-card amber">
            <span>◎</span>
            <p>Sponsor commitment</p>
            <h3>{formatCr(metrics.sponsorCommitment)}</h3>
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">▥</span>

              <div>
                <p className="portfolio-eyebrow">Fund Migration Preview</p>
                <h2>Fund records staged for dashboard activation</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">{funds.length} fund</span>
          </div>

          <div className="portfolio-record-list">
            {funds.map((fund) => (
              <details className="portfolio-record-card" key={fund.id} open>
                <summary>
                  <div className="company-icon healthy">
                    {fund.fundName.charAt(0)}
                  </div>

                  <div className="company-main">
                    <strong>{fund.fundName}</strong>
                    <span>
                      {fund.category} · {fund.jurisdiction}
                    </span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Fund type</small>
                    <span>{fund.fundType}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Target corpus</small>
                    <span>{formatCr(fund.targetCorpus)}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Committed</small>
                    <span>{formatCr(fund.committedCapital)}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Carry</small>
                    <span>{fund.carryRate}%</span>
                  </div>

                  <span className="risk-badge healthy">{fund.status}</span>

                  <span className="record-chevron">⌄</span>
                </summary>

                <div className="portfolio-record-details">
                  <div>
                    <small>First close</small>
                    <strong>{fund.firstCloseDate || "Not provided"}</strong>
                  </div>

                  <div>
                    <small>Second close</small>
                    <strong>{fund.secondCloseDate || "Not provided"}</strong>
                  </div>

                  <div>
                    <small>Final close</small>
                    <strong>{fund.finalCloseDate || "Not provided"}</strong>
                  </div>

                  <div>
                    <small>Green shoe</small>
                    <strong>{formatCr(fund.greenShoe)}</strong>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">%</span>

              <div>
                <p className="portfolio-eyebrow">Fee & Carry Engine Inputs</p>
                <h2>Fund economics ready for calculation workflows</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">
              {metrics.averageCarry.toFixed(0)}% carry
            </span>
          </div>

          <div className="exit-card-grid">
            {funds.map((fund) => (
              <div className="exit-card healthy" key={`${fund.id}-fees`}>
                <div className="company-icon-row">
                  <div className="company-icon healthy">%</div>
                  <strong>{fund.fundName}</strong>
                </div>

                <dl>
                  <div>
                    <dt>Management fee</dt>
                    <dd>{fund.managementFeeRate}%</dd>
                  </div>

                  <div>
                    <dt>Setup cost</dt>
                    <dd>{fund.setupCostRate}%</dd>
                  </div>

                  <div>
                    <dt>Carry</dt>
                    <dd>{fund.carryRate}%</dd>
                  </div>

                  <div>
                    <dt>Hurdle</dt>
                    <dd>{fund.hurdleRate}%</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">≋</span>

              <div>
                <p className="portfolio-eyebrow">Waterfall & Governance</p>
                <h2>Economic terms and fund parties</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">Waterfall ready</span>
          </div>

          <div className="portfolio-flow-grid">
            {funds.map((fund) => (
              <Fragment key={fund.id}>
                <div className="portfolio-flow-card blue">
                  <span>≋</span>
                  <strong>Waterfall type</strong>
                  <p>
                    {fund.waterfallType} waterfall for distribution and carry
                    calculations.
                  </p>
                </div>

                <div className="portfolio-flow-card green">
                  <span>●</span>
                  <strong>Trustee</strong>
                  <p>{fund.trusteeName}</p>
                </div>

                <div className="portfolio-flow-card purple">
                  <span>▥</span>
                  <strong>Investment Manager</strong>
                  <p>{fund.investmentManager}</p>
                </div>

                <div className="portfolio-flow-card amber">
                  <span>◎</span>
                  <strong>Sponsor Commitment</strong>
                  <p>{formatCr(fund.sponsorCommitment)} committed by sponsor.</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⌘</span>

              <div>
                <h2>Where this fund data flows</h2>
              </div>
            </div>
          </div>

          <div className="portfolio-flow-grid">
            <div className="portfolio-flow-card blue">
              <span>◔</span>
              <strong>Finance Head Workspace</strong>
              <p>
                Management fee, setup cost, fund economics, fund-level MIS and
                financial reporting.
              </p>
            </div>

            <div className="portfolio-flow-card green">
              <span>●</span>
              <strong>Compliance Dashboard</strong>
              <p>
                AIF category, jurisdiction, close dates and fund structure can
                drive obligation tracking.
              </p>
            </div>

            <div className="portfolio-flow-card purple">
              <span>▥</span>
              <strong>Waterfall Engine</strong>
              <p>
                Carry, hurdle and waterfall terms can power distribution and
                performance allocation workflows.
              </p>
            </div>

            <div className="portfolio-flow-card amber">
              <span>◎</span>
              <strong>Managing Partner Dashboard</strong>
              <p>
                Corpus, commitment coverage, sponsor commitment and fund
                economics become MP-level signals.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}