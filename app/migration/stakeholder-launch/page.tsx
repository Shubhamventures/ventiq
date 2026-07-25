"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type LayerKey = "investor" | "pdf" | "portfolio" | "fund" | "compliance";
type LaunchStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";

type LayerState = {
  key: LayerKey;
  title: string;
  ready: boolean;
  count: number;
  batchName: string;
  primaryMetric: string;
  secondaryMetric: string;
  warningCount: number;
};

type StakeholderCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  requiredLayers: LayerKey[];
  status: LaunchStatus;
  missingLayers: LayerKey[];
  metrics: {
    label: string;
    value: string;
  }[];
};

type DataState = Record<LayerKey, LayerState>;

const layerLabels: Record<LayerKey, string> = {
  investor: "Investor Data",
  pdf: "PDF Intelligence",
  portfolio: "Portfolio Data",
  fund: "Fund Data",
  compliance: "Compliance Data",
};

const defaultDataState: DataState = {
  investor: {
    key: "investor",
    title: "Investor Data",
    ready: false,
    count: 0,
    batchName: "No batch loaded",
    primaryMetric: "₹0.00 Cr commitment",
    secondaryMetric: "0 investors",
    warningCount: 0,
  },
  pdf: {
    key: "pdf",
    title: "PDF Intelligence",
    ready: false,
    count: 0,
    batchName: "No batch loaded",
    primaryMetric: "0 PDFs",
    secondaryMetric: "0 review items",
    warningCount: 0,
  },
  portfolio: {
    key: "portfolio",
    title: "Portfolio Data",
    ready: false,
    count: 0,
    batchName: "No batch loaded",
    primaryMetric: "₹0.00 Cr value",
    secondaryMetric: "0 at-risk",
    warningCount: 0,
  },
  fund: {
    key: "fund",
    title: "Fund Data",
    ready: false,
    count: 0,
    batchName: "No batch loaded",
    primaryMetric: "₹0.00 Cr committed",
    secondaryMetric: "0% carry",
    warningCount: 0,
  },
  compliance: {
    key: "compliance",
    title: "Compliance Data",
    ready: false,
    count: 0,
    batchName: "No batch loaded",
    primaryMetric: "0 items",
    secondaryMetric: "0 high-risk",
    warningCount: 0,
  },
};

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function getStatusClass(status: LaunchStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Partial") return "watch";
  if (status === "Needs Review") return "at-risk";
  return "neutral";
}

function evaluateStakeholderStatus(
  requiredLayers: LayerKey[],
  dataState: DataState
) {
  const missingLayers = requiredLayers.filter(
    (layerKey) => !dataState[layerKey].ready
  );

  const warningCount = requiredLayers.reduce(
    (sum, layerKey) => sum + dataState[layerKey].warningCount,
    0
  );

  if (missingLayers.length === requiredLayers.length) {
    return {
      status: "Not Started" as LaunchStatus,
      missingLayers,
    };
  }

  if (missingLayers.length > 0) {
    return {
      status: "Partial" as LaunchStatus,
      missingLayers,
    };
  }

  if (warningCount > 0) {
    return {
      status: "Needs Review" as LaunchStatus,
      missingLayers,
    };
  }

  return {
    status: "Ready" as LaunchStatus,
    missingLayers,
  };
}

function buildStakeholders(dataState: DataState): StakeholderCard[] {
  const stakeholderDefinitions = [
    {
      id: "investor-portal",
      title: "Investor Portal",
      description:
        "Launch investor login with documents, financial position, capital account and notices.",
      route: "/investor-portal",
      requiredLayers: ["investor", "pdf"] as LayerKey[],
      metrics: [
        {
          label: "Investors",
          value: String(dataState.investor.count),
        },
        {
          label: "PDF documents",
          value: String(dataState.pdf.count),
        },
      ],
    },
    {
      id: "finance-head",
      title: "Finance Head Workspace",
      description:
        "Activate fund economics, investor data, compliance evidence and finance operating workflows.",
      route: "/finance-head-ai",
      requiredLayers: ["investor", "fund", "compliance"] as LayerKey[],
      metrics: [
        {
          label: "Commitment",
          value: dataState.investor.primaryMetric,
        },
        {
          label: "Compliance items",
          value: String(dataState.compliance.count),
        },
      ],
    },
    {
      id: "investment-team",
      title: "Investment Team Workspace",
      description:
        "Activate portfolio monitoring, repayment schedules, risk tracking and exit visibility.",
      route: "/investment-team-ai",
      requiredLayers: ["portfolio", "pdf"] as LayerKey[],
      metrics: [
        {
          label: "Investments",
          value: String(dataState.portfolio.count),
        },
        {
          label: "Portfolio value",
          value: dataState.portfolio.primaryMetric,
        },
      ],
    },
    {
      id: "compliance",
      title: "Compliance Dashboard",
      description:
        "Activate filing status, due dates, risk items, evidence tracking and owner accountability.",
      route: "/compliance-ai",
      requiredLayers: ["fund", "compliance", "pdf"] as LayerKey[],
      metrics: [
        {
          label: "Compliance records",
          value: String(dataState.compliance.count),
        },
        {
          label: "High-risk items",
          value: String(dataState.compliance.warningCount),
        },
      ],
    },
    {
      id: "managing-partner",
      title: "Managing Partner Dashboard",
      description:
        "Activate leadership view across fund, investor, portfolio, PDF and compliance data.",
      route: "/managing-partner-ai",
      requiredLayers: [
        "investor",
        "pdf",
        "portfolio",
        "fund",
        "compliance",
      ] as LayerKey[],
      metrics: [
        {
          label: "Ready layers",
          value: String(
            Object.values(dataState).filter((layer) => layer.ready).length
          ),
        },
        {
          label: "Review signals",
          value: String(
            Object.values(dataState).reduce(
              (sum, layer) => sum + layer.warningCount,
              0
            )
          ),
        },
      ],
    },
    {
      id: "investor-relations",
      title: "Investor Relations",
      description:
        "Activate LP communication layer for investor documents, pending items and reporting follow-ups.",
      route: "/fundraising-ai",
      requiredLayers: ["investor", "pdf", "compliance"] as LayerKey[],
      metrics: [
        {
          label: "Investors",
          value: String(dataState.investor.count),
        },
        {
          label: "Review items",
          value: String(dataState.pdf.warningCount + dataState.compliance.warningCount),
        },
      ],
    },
  ];

  return stakeholderDefinitions.map((definition) => {
    const evaluation = evaluateStakeholderStatus(
      definition.requiredLayers,
      dataState
    );

    return {
      ...definition,
      status: evaluation.status,
      missingLayers: evaluation.missingLayers,
    };
  });
}

export default function StakeholderLaunchCenterPage() {
  const [dataState, setDataState] = useState<DataState>(defaultDataState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadLaunchSnapshot() {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setMessage("Loading stakeholder launch readiness...");

    try {
      const nextState: DataState = structuredClone(defaultDataState);

      const { data: investorBatch } = await client
        .from("investor_import_batches")
        .select("id, batch_name, total_records, total_commitment, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (investorBatch) {
        const totalRecords = Number(investorBatch.total_records ?? 0);
        const totalCommitment = Number(investorBatch.total_commitment ?? 0);

        nextState.investor = {
          ...nextState.investor,
          ready: totalRecords > 0,
          count: totalRecords,
          batchName: investorBatch.batch_name ?? "Latest investor batch",
          primaryMetric: `${formatCr(totalCommitment)} commitment`,
          secondaryMetric: `${totalRecords} investors`,
          warningCount: 0,
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

        nextState.pdf = {
          ...nextState.pdf,
          ready: totalFiles > 0,
          count: totalFiles,
          batchName: pdfBatch.batch_name ?? "Latest PDF intelligence batch",
          primaryMetric: `${totalFiles} PDFs processed`,
          secondaryMetric: `${reviewFiles + unmatchedFiles} review items`,
          warningCount: reviewFiles + unmatchedFiles,
        };
      }

      const { data: portfolioBatch } = await client
        .from("portfolio_data_migration_batches")
        .select(
          "id, batch_name, total_records, current_portfolio_value, portfolio_moic, at_risk_count, repayment_count, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (portfolioBatch) {
        const totalRecords = Number(portfolioBatch.total_records ?? 0);
        const currentValue = Number(
          portfolioBatch.current_portfolio_value ?? 0
        );
        const atRiskCount = Number(portfolioBatch.at_risk_count ?? 0);
        const moic = Number(portfolioBatch.portfolio_moic ?? 0);

        nextState.portfolio = {
          ...nextState.portfolio,
          ready: totalRecords > 0,
          count: totalRecords,
          batchName: portfolioBatch.batch_name ?? "Latest portfolio batch",
          primaryMetric: `${formatCr(currentValue)} value`,
          secondaryMetric: `${moic.toFixed(2)}x MOIC`,
          warningCount: atRiskCount,
        };
      }

      const { data: fundBatch } = await client
        .from("fund_data_migration_batches")
        .select(
          "id, batch_name, total_funds, total_committed_capital, average_carry, status"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fundBatch) {
        const totalFunds = Number(fundBatch.total_funds ?? 0);
        const committedCapital = Number(
          fundBatch.total_committed_capital ?? 0
        );
        const averageCarry = Number(fundBatch.average_carry ?? 0);

        nextState.fund = {
          ...nextState.fund,
          ready: totalFunds > 0,
          count: totalFunds,
          batchName: fundBatch.batch_name ?? "Latest fund data batch",
          primaryMetric: `${formatCr(committedCapital)} committed`,
          secondaryMetric: `${averageCarry.toFixed(0)}% carry`,
          warningCount: 0,
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
        const pendingReview = Number(
          complianceBatch.pending_review_count ?? 0
        );
        const highRisk = Number(complianceBatch.high_risk_count ?? 0);
        const evidenceAvailable = Number(
          complianceBatch.evidence_available_count ?? 0
        );

        nextState.compliance = {
          ...nextState.compliance,
          ready: totalItems > 0,
          count: totalItems,
          batchName:
            complianceBatch.batch_name ?? "Latest compliance data batch",
          primaryMetric: `${evidenceAvailable} evidence items`,
          secondaryMetric: `${highRisk} high-risk items`,
          warningCount: pendingReview + highRisk,
        };
      }

      setDataState(nextState);
      setMessage("Stakeholder launch readiness loaded.");
    } catch (error) {
      setMessage((error as Error).message);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLaunchSnapshot();
  }, []);

  const stakeholders = useMemo(
    () => buildStakeholders(dataState),
    [dataState]
  );

  const launchSummary = useMemo(() => {
    const readyStakeholders = stakeholders.filter(
      (stakeholder) => stakeholder.status === "Ready"
    ).length;

    const reviewStakeholders = stakeholders.filter(
      (stakeholder) =>
        stakeholder.status === "Partial" ||
        stakeholder.status === "Needs Review"
    ).length;

    const notStartedStakeholders = stakeholders.filter(
      (stakeholder) => stakeholder.status === "Not Started"
    ).length;

    const readyLayers = Object.values(dataState).filter(
      (layer) => layer.ready
    ).length;

    return {
      readyStakeholders,
      reviewStakeholders,
      notStartedStakeholders,
      readyLayers,
      launchScore: Math.round(
        (readyStakeholders / stakeholders.length) * 100
      ),
    };
  }, [dataState, stakeholders]);

  return (
    <main className="activation-page">
      <section className="activation-shell">
        <div className="activation-hero">
          <div>
            <p className="activation-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Stakeholder Launch Center</h1>

            <p>
              Convert migrated fund data into live stakeholder dashboards. This
              page checks which dashboards are ready for Investor, Finance,
              Investment, Compliance, IR and Managing Partner users.
            </p>

            <div className="activation-actions">
              <button
                className="activation-primary-button"
                disabled={loading}
                onClick={loadLaunchSnapshot}
                type="button"
              >
                {loading ? "Refreshing..." : "Refresh Launch Readiness"}
              </button>

              <a
                className="activation-secondary-button"
                href="/migration/activation"
              >
                Back to Activation Dashboard
              </a>

              <a
                className="activation-secondary-button"
                href="/migration/data-intake"
              >
                Back to Data Intake
              </a>
            </div>
          </div>

          <div className="activation-score-card">
            <span>Launch Score</span>
            <strong>{launchSummary.launchScore}%</strong>
            <p>
              {launchSummary.readyStakeholders} ready ·{" "}
              {launchSummary.reviewStakeholders} review ·{" "}
              {launchSummary.notStartedStakeholders} not started
            </p>
          </div>
        </div>

        {message && <div className="activation-note">{message}</div>}

        <div className="activation-kpi-grid">
          <div className="activation-kpi-card">
            <span>✓</span>
            <p>Ready stakeholders</p>
            <h3>{launchSummary.readyStakeholders}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◷</span>
            <p>Review stakeholders</p>
            <h3>{launchSummary.reviewStakeholders}</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◇</span>
            <p>Ready data layers</p>
            <h3>{launchSummary.readyLayers}/5</h3>
          </div>

          <div className="activation-kpi-card">
            <span>◎</span>
            <p>Total dashboards</p>
            <h3>{stakeholders.length}</h3>
          </div>
        </div>

        <div className="stakeholder-layer-strip">
          {Object.values(dataState).map((layer) => (
            <div className="stakeholder-layer-card" key={layer.key}>
              <div>
                <span>{layer.title}</span>
                <strong>{layer.count}</strong>
              </div>

              <p>{layer.primaryMetric}</p>
              <small>{layer.secondaryMetric}</small>

              <span
                className={`activation-status-pill ${
                  layer.ready ? "healthy" : "neutral"
                }`}
              >
                {layer.ready ? "Loaded" : "Missing"}
              </span>
            </div>
          ))}
        </div>

        <div className="stakeholder-grid">
          {stakeholders.map((stakeholder) => (
            <div className="stakeholder-card" key={stakeholder.id}>
              <div className="stakeholder-card-top">
                <div>
                  <span>{stakeholder.id}</span>
                  <h2>{stakeholder.title}</h2>
                </div>

                <span
                  className={`activation-status-pill ${getStatusClass(
                    stakeholder.status
                  )}`}
                >
                  {stakeholder.status}
                </span>
              </div>

              <p>{stakeholder.description}</p>

              <div className="stakeholder-requirements">
                <small>Required data layers</small>

                <div>
                  {stakeholder.requiredLayers.map((layerKey) => (
                    <span
                      className={
                        dataState[layerKey].ready
                          ? "requirement-chip ready"
                          : "requirement-chip missing"
                      }
                      key={`${stakeholder.id}-${layerKey}`}
                    >
                      {layerLabels[layerKey]}
                    </span>
                  ))}
                </div>
              </div>

              {stakeholder.missingLayers.length > 0 && (
                <div className="stakeholder-warning">
                  Missing:{" "}
                  {stakeholder.missingLayers
                    .map((layerKey) => layerLabels[layerKey])
                    .join(", ")}
                </div>
              )}

              <div className="activation-metric-row">
                {stakeholder.metrics.map((metric) => (
                  <div key={`${stakeholder.id}-${metric.label}`}>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <a className="activation-card-link" href={stakeholder.route}>
                Open dashboard →
              </a>
            </div>
          ))}
        </div>

        <div className="activation-panel">
          <div>
            <p className="activation-eyebrow">Commercial Demo Narrative</p>
            <h2>What this proves in a client walkthrough</h2>
          </div>

          <div className="activation-flow-grid">
            <div>
              <span>1</span>
              <strong>Upload once</strong>
              <p>
                Historical investor, PDF, portfolio, fund and compliance data
                can be uploaded into one operating layer.
              </p>
            </div>

            <div>
              <span>2</span>
              <strong>Validate readiness</strong>
              <p>
                The fund team can see what is ready, what is missing and what
                requires review before dashboard launch.
              </p>
            </div>

            <div>
              <span>3</span>
              <strong>Launch by role</strong>
              <p>
                Every stakeholder gets a role-specific dashboard instead of
                searching through files, emails and Excel sheets.
              </p>
            </div>

            <div>
              <span>4</span>
              <strong>Operate continuously</strong>
              <p>
                The same data layer later supports capital calls, notices,
                repayments, filings, reporting and investor communication.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}