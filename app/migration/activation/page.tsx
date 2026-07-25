"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type LayerStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";

type LayerCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  status: LayerStatus;
  countLabel: string;
  countValue: string;
  batchName: string;
  metrics: {
    label: string;
    value: string;
  }[];
};

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function getStatusClass(status: LayerStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Partial") return "watch";
  if (status === "Needs Review") return "at-risk";
  return "neutral";
}

function getStatusLabel(status: LayerStatus) {
  if (status === "Ready") return "Ready";
  if (status === "Partial") return "Partial";
  if (status === "Needs Review") return "Needs Review";
  return "Not Started";
}

const defaultLayers: LayerCard[] = [
  {
    id: "investor",
    title: "Investor Data",
    description:
      "Investor master, commitments, KYC, bank status and investor financial records.",
    route: "/investor-import",
    status: "Not Started",
    countLabel: "Investors",
    countValue: "0",
    batchName: "No batch loaded",
    metrics: [
      { label: "Commitment", value: "₹0.00 Cr" },
      { label: "Status", value: "Not started" },
    ],
  },
  {
    id: "pdf",
    title: "PDF Intelligence",
    description:
      "PDF extraction, investor matching, document classification and deficiency tracking.",
    route: "/migration/pdf-intelligence",
    status: "Not Started",
    countLabel: "PDFs",
    countValue: "0",
    batchName: "No batch loaded",
    metrics: [
      { label: "Ready", value: "0" },
      { label: "Review", value: "0" },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio Data",
    description:
      "Portfolio companies, valuations, repayment schedules, risk and exit visibility.",
    route: "/migration/portfolio-data",
    status: "Not Started",
    countLabel: "Investments",
    countValue: "0",
    batchName: "No batch loaded",
    metrics: [
      { label: "Current value", value: "₹0.00 Cr" },
      { label: "MOIC", value: "0.00x" },
    ],
  },
  {
    id: "fund",
    title: "Fund Data",
    description:
      "Fund structure, close dates, corpus, fees, carry, hurdle, waterfall and parties.",
    route: "/migration/fund-data",
    status: "Not Started",
    countLabel: "Funds",
    countValue: "0",
    batchName: "No batch loaded",
    metrics: [
      { label: "Committed", value: "₹0.00 Cr" },
      { label: "Carry", value: "0%" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance Data",
    description:
      "Regulatory filings, tax evidence, audit trail, valuation support and exceptions.",
    route: "/migration/compliance-data",
    status: "Not Started",
    countLabel: "Items",
    countValue: "0",
    batchName: "No batch loaded",
    metrics: [
      { label: "Evidence", value: "0" },
      { label: "High risk", value: "0" },
    ],
  },
];

export default function DataActivationDashboardPage() {
  const [layers, setLayers] = useState<LayerCard[]>(defaultLayers);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadActivationSnapshot() {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setMessage("Loading migration readiness from Supabase...");

    try {
      const nextLayers = [...defaultLayers];

      const { data: investorBatch } = await client
        .from("investor_import_batches")
        .select("id, batch_name, total_records, total_commitment, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (investorBatch) {
        const totalRecords = Number(investorBatch.total_records ?? 0);
        const totalCommitment = Number(investorBatch.total_commitment ?? 0);

        nextLayers[0] = {
          ...nextLayers[0],
          status: totalRecords > 0 ? "Ready" : "Partial",
          countValue: String(totalRecords),
          batchName: investorBatch.batch_name ?? "Latest investor batch",
          metrics: [
            { label: "Commitment", value: formatCr(totalCommitment) },
            { label: "Status", value: investorBatch.status ?? "published" },
          ],
        };
      }

      const { data: pdfBatch } = await client
        .from("pdf_intelligence_batches")
        .select(
          "id, batch_name, total_files, ready_files, review_files, unmatched_files, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pdfBatch) {
        const totalFiles = Number(pdfBatch.total_files ?? 0);
        const reviewFiles = Number(pdfBatch.review_files ?? 0);
        const unmatchedFiles = Number(pdfBatch.unmatched_files ?? 0);

        nextLayers[1] = {
          ...nextLayers[1],
          status:
            totalFiles === 0
              ? "Not Started"
              : reviewFiles > 0 || unmatchedFiles > 0
                ? "Needs Review"
                : "Ready",
          countValue: String(totalFiles),
          batchName: pdfBatch.batch_name ?? "Latest PDF batch",
          metrics: [
            { label: "Ready", value: String(pdfBatch.ready_files ?? 0) },
            {
              label: "Review / unmatched",
              value: String(reviewFiles + unmatchedFiles),
            },
          ],
        };
      }

      const { data: portfolioBatch } = await client
        .from("portfolio_data_migration_batches")
        .select(
          "id, batch_name, total_records, total_investment_cost, current_portfolio_value, portfolio_moic, at_risk_count, repayment_count, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (portfolioBatch) {
        const totalRecords = Number(portfolioBatch.total_records ?? 0);
        const atRiskCount = Number(portfolioBatch.at_risk_count ?? 0);

        nextLayers[2] = {
          ...nextLayers[2],
          status:
            totalRecords === 0
              ? "Not Started"
              : atRiskCount > 0
                ? "Partial"
                : "Ready",
          countValue: String(totalRecords),
          batchName: portfolioBatch.batch_name ?? "Latest portfolio batch",
          metrics: [
            {
              label: "Current value",
              value: formatCr(Number(portfolioBatch.current_portfolio_value ?? 0)),
            },
            {
              label: "MOIC",
              value: `${Number(portfolioBatch.portfolio_moic ?? 0).toFixed(2)}x`,
            },
          ],
        };
      }

      const { data: fundBatch } = await client
        .from("fund_data_migration_batches")
        .select(
          "id, batch_name, total_funds, total_target_corpus, total_committed_capital, total_sponsor_commitment, average_management_fee, average_carry, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fundBatch) {
        const totalFunds = Number(fundBatch.total_funds ?? 0);

        nextLayers[3] = {
          ...nextLayers[3],
          status: totalFunds > 0 ? "Ready" : "Not Started",
          countValue: String(totalFunds),
          batchName: fundBatch.batch_name ?? "Latest fund batch",
          metrics: [
            {
              label: "Committed",
              value: formatCr(Number(fundBatch.total_committed_capital ?? 0)),
            },
            {
              label: "Carry",
              value: `${Number(fundBatch.average_carry ?? 0).toFixed(0)}%`,
            },
          ],
        };
      }

      const { data: complianceBatch } = await client
        .from("compliance_data_migration_batches")
        .select(
          "id, batch_name, total_items, evidence_available_count, pending_review_count, high_risk_count, ready_count, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (complianceBatch) {
        const totalItems = Number(complianceBatch.total_items ?? 0);
        const pendingReview = Number(complianceBatch.pending_review_count ?? 0);
        const highRisk = Number(complianceBatch.high_risk_count ?? 0);

        nextLayers[4] = {
          ...nextLayers[4],
          status:
            totalItems === 0
              ? "Not Started"
              : highRisk > 0
                ? "Needs Review"
                : pendingReview > 0
                  ? "Partial"
                  : "Ready",
          countValue: String(totalItems),
          batchName: complianceBatch.batch_name ?? "Latest compliance batch",
          metrics: [
            {
              label: "Evidence",
              value: String(complianceBatch.evidence_available_count ?? 0),
            },
            {
              label: "High risk",
              value: String(highRisk),
            },
          ],
        };
      }

      setLayers(nextLayers);
      setMessage("Migration readiness snapshot loaded.");
    } catch (error) {
      setMessage((error as Error).message);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadActivationSnapshot();
  }, []);

  const readiness = useMemo(() => {
    const readyCount = layers.filter((layer) => layer.status === "Ready").length;
    const reviewCount = layers.filter(
      (layer) => layer.status === "Partial" || layer.status === "Needs Review"
    ).length;
    const notStartedCount = layers.filter(
      (layer) => layer.status === "Not Started"
    ).length;

    const readinessScore = Math.round((readyCount / layers.length) * 100);

    return {
      readyCount,
      reviewCount,
      notStartedCount,
      readinessScore,
    };
  }, [layers]);

  return (
    <main className="activation-page">
      <section className="activation-shell">
        <div className="activation-hero">
          <div>
            <p className="activation-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Data Activation Dashboard</h1>

            <p>
              See whether investor, PDF, portfolio, fund and compliance data
              are ready to activate stakeholder dashboards across the investment
              firm.
            </p>

            <div className="activation-actions">
              <button
                className="activation-primary-button"
                disabled={loading}
                onClick={loadActivationSnapshot}
                type="button"
              >
                {loading ? "Refreshing..." : "Refresh Readiness"}
              </button>

              <a className="activation-secondary-button" href="/migration/data-intake">
                Back to Data Intake
              </a>
            </div>
          </div>

          <div className="activation-score-card">
            <span>Readiness Score</span>
            <strong>{readiness.readinessScore}%</strong>
            <p>
              {readiness.readyCount} ready · {readiness.reviewCount} review ·{" "}
              {readiness.notStartedCount} not started
            </p>
          </div>
        </div>

        {message && <div className="activation-note">{message}</div>}

        <div className="activation-kpi-grid">
          <div className="activation-kpi-card">
            <span>✓</span>
            <p>Ready layers</p>
            <h3>{readiness.readyCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◷</span>
            <p>Review layers</p>
            <h3>{readiness.reviewCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◇</span>
            <p>Not started</p>
            <h3>{readiness.notStartedCount}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◎</span>
            <p>Total data layers</p>
            <h3>{layers.length}</h3>
          </div>
        </div>

        <div className="activation-layer-grid">
          {layers.map((layer) => (
            <div className="activation-layer-card" key={layer.id}>
              <div className="activation-layer-top">
                <div>
                  <span className="activation-layer-id">{layer.id}</span>
                  <h2>{layer.title}</h2>
                </div>

                <span
                  className={`activation-status-pill ${getStatusClass(
                    layer.status
                  )}`}
                >
                  {getStatusLabel(layer.status)}
                </span>
              </div>

              <p className="activation-layer-description">
                {layer.description}
              </p>

              <div className="activation-count-row">
                <div>
                  <small>{layer.countLabel}</small>
                  <strong>{layer.countValue}</strong>
                </div>

                <div>
                  <small>Latest batch</small>
                  <strong>{layer.batchName}</strong>
                </div>
              </div>

              <div className="activation-metric-row">
                {layer.metrics.map((metric) => (
                  <div key={`${layer.id}-${metric.label}`}>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <a className="activation-card-link" href={layer.route}>
                Open workspace →
              </a>
            </div>
          ))}
        </div>

        <div className="activation-panel">
          <div>
            <p className="activation-eyebrow">Dashboard Activation Logic</p>
            <h2>What happens after all layers are ready?</h2>
          </div>

          <div className="activation-flow-grid">
            <div>
              <span>1</span>
              <strong>Investor Portal</strong>
              <p>
                Investors receive documents, financial position, capital account
                and notices from migrated investor and PDF data.
              </p>
            </div>

            <div>
              <span>2</span>
              <strong>Finance Head Workspace</strong>
              <p>
                Fund data, investor data, compliance evidence and capital call
                workflows become finance operating views.
              </p>
            </div>

            <div>
              <span>3</span>
              <strong>Investment Team Workspace</strong>
              <p>
                Portfolio data becomes deal monitoring, repayment tracking,
                covenant visibility and exit readiness.
              </p>
            </div>

            <div>
              <span>4</span>
              <strong>Managing Partner Dashboard</strong>
              <p>
                Fund, investor, portfolio, PDF and compliance data become one
                leadership operating dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}