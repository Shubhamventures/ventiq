"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type InvestmentActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};

function getString(row: DataRow | undefined, keys: string[], fallback = "-") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow | undefined, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function getId(row: DataRow | undefined) {
  return getString(row, ["id"], "");
}

function formatCurrencyCr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0 Cr";

  return `₹${(value / 10000000).toFixed(1)} Cr`;
}

function formatMultiple(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";

  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";

  return `${value.toFixed(2)}%`;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActivityIcon(status: string) {
  const value = status.toLowerCase();

  if (value.includes("healthy")) return "🟢";
  if (value.includes("watch")) return "🟡";
  if (value.includes("risk")) return "🔴";
  if (value.includes("repayment")) return "💸";
  if (value.includes("exit")) return "🚀";
  if (value.includes("pdf")) return "📄";
  if (value.includes("compliance")) return "🧾";
  if (value.includes("valuation")) return "📊";
  if (value.includes("covenant")) return "🛡️";
  if (value.includes("imported")) return "📥";

  return "⚪";
}

function getRiskEmoji(value: string) {
  const risk = value.toLowerCase();

  if (risk.includes("healthy") || risk.includes("low")) return "🟢";
  if (risk.includes("watch") || risk.includes("medium")) return "🟡";
  if (risk.includes("risk") || risk.includes("high")) return "🔴";

  return "⚪";
}

function averageFromRows(rows: DataRow[], keys: string[]) {
  const values = rows
    .map((row) => getNumber(row, keys))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function InvestmentTeamAIPage() {
  const [latestPortfolioBatch, setLatestPortfolioBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);

  const [portfolioInvestments, setPortfolioInvestments] = useState<DataRow[]>(
    []
  );
  const [complianceItems, setComplianceItems] = useState<DataRow[]>([]);
  const [fundMasterRows, setFundMasterRows] = useState<DataRow[]>([]);
  const [fundCommitments, setFundCommitments] = useState<DataRow[]>([]);
  const [financialPositions, setFinancialPositions] = useState<DataRow[]>([]);
  const [pdfIntelligenceDocuments, setPdfIntelligenceDocuments] = useState<
    DataRow[]
  >([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInvestmentTeamWorkspace() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The sample Investment Team workspace is temporarily unavailable. Please request a walkthrough."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const db = supabase as any;

    async function selectRows(
      tableName: string,
      options?: {
        orderBy?: string;
        ascending?: boolean;
        eq?: {
          column: string;
          value: string;
        };
      }
    ) {
      try {
        let query = db.from(tableName).select("*");

        if (options?.eq) {
          query = query.eq(options.eq.column, options.eq.value);
        }

        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? false,
          });
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            `VENTIQ investment dashboard skipped ${tableName}:`,
            error.message
          );
          return [] as DataRow[];
        }

        return (data ?? []) as DataRow[];
      } catch (error) {
        console.warn(`VENTIQ investment dashboard skipped ${tableName}:`, error);
        return [] as DataRow[];
      }
    }

    async function latestRow(tableName: string) {
      try {
        const { data, error } = await db
          .from(tableName)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn(
            `VENTIQ investment dashboard skipped latest ${tableName}:`,
            error.message
          );
          return null;
        }

        return (data as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          `VENTIQ investment dashboard skipped latest ${tableName}:`,
          error
        );
        return null;
      }
    }

    try {
      const [
        portfolioInvestmentRows,
        complianceRows,
        fundMasterData,
        fundCommitmentRows,
        financialPositionRows,
        pdfDocumentRows,
        investorDocumentRows,

        portfolioBatch,
        pdfBatch,
        fundBatch,
        complianceBatch,
        investorBatch,
      ] = await Promise.all([
        selectRows("portfolio_investments"),
        selectRows("compliance_items"),
        selectRows("fund_master"),
        selectRows("fund_commitments"),
        selectRows("investor_financial_positions"),
        selectRows("pdf_intelligence_documents"),
        selectRows("investor_documents"),

        latestRow("portfolio_data_migration_batches"),
        latestRow("pdf_intelligence_batches"),
        latestRow("fund_data_migration_batches"),
        latestRow("compliance_data_migration_batches"),
        latestRow("investor_import_batches"),
      ]);

      setPortfolioInvestments(portfolioInvestmentRows);
      setComplianceItems(complianceRows);
      setFundMasterRows(fundMasterData);
      setFundCommitments(fundCommitmentRows);
      setFinancialPositions(financialPositionRows);
      setPdfIntelligenceDocuments(pdfDocumentRows);
      setInvestorDocuments(investorDocumentRows);

      setLatestPortfolioBatch(portfolioBatch);
      setLatestPdfBatch(pdfBatch);
      setLatestFundBatch(fundBatch);
      setLatestComplianceBatch(complianceBatch);
      setLatestInvestorBatch(investorBatch);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Investment Team workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvestmentTeamWorkspace();
  }, []);

  const investmentMetrics = useMemo(() => {
    const totalRecords = getNumber(latestPortfolioBatch ?? undefined, [
      "total_records",
    ]);

    const batchInvestmentCost = getNumber(latestPortfolioBatch ?? undefined, [
      "total_investment_cost",
    ]);

    const batchCurrentValue = getNumber(latestPortfolioBatch ?? undefined, [
      "current_portfolio_value",
    ]);

    const batchRealisedValue = getNumber(latestPortfolioBatch ?? undefined, [
      "realised_value",
      "realized_value",
    ]);

    const batchExpectedExitValue = getNumber(
      latestPortfolioBatch ?? undefined,
      ["expected_exit_value"]
    );

    const batchMoic = getNumber(latestPortfolioBatch ?? undefined, [
      "portfolio_moic",
    ]);

    const batchAtRiskCount = getNumber(latestPortfolioBatch ?? undefined, [
      "at_risk_count",
    ]);

    const batchRepaymentCount = getNumber(latestPortfolioBatch ?? undefined, [
      "repayment_count",
    ]);

    const rowInvestmentCost = portfolioInvestments.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "investment_cost",
          "original_investment_amount",
          "cost",
          "amount_invested",
        ]),
      0
    );

    const rowCurrentValue = portfolioInvestments.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "current_value",
          "current_fair_value",
          "fair_value",
          "valuation",
        ]),
      0
    );

    const rowRealisedValue = portfolioInvestments.reduce(
      (sum, row) =>
        sum + getNumber(row, ["realised_value", "realized_value"]),
      0
    );

    const rowExpectedExitValue = portfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["expected_exit_value"]),
      0
    );

    const investmentCost = batchInvestmentCost || rowInvestmentCost;
    const currentValue = batchCurrentValue || rowCurrentValue;
    const realisedValue = batchRealisedValue || rowRealisedValue;
    const expectedExitValue = batchExpectedExitValue || rowExpectedExitValue;

    const moic =
      batchMoic ||
      averageFromRows(portfolioInvestments, ["moic", "projected_moic"]) ||
      (investmentCost > 0 ? (currentValue + realisedValue) / investmentCost : 0);

    const irr = averageFromRows(portfolioInvestments, [
      "irr",
      "projected_irr",
      "gross_irr",
    ]);

    const tvpi = averageFromRows(financialPositions, ["tvpi", "investor_tvpi"]);
    const dpi = averageFromRows(financialPositions, ["dpi", "investor_dpi"]);

    const atRiskRows = portfolioInvestments.filter((row) => {
      const risk = getString(row, ["risk_status"], "").toLowerCase();

      return (
        risk.includes("risk") ||
        risk.includes("watch") ||
        risk.includes("attention") ||
        risk.includes("high")
      );
    });

    const repaymentRows = portfolioInvestments.filter((row) =>
      Boolean(getString(row, ["repayment_due_date"], ""))
    );

    const exitRows = portfolioInvestments.filter((row) =>
      Boolean(getString(row, ["expected_exit_date"], ""))
    );

    const covenantRows = portfolioInvestments.filter((row) => {
      return (
        Boolean(getString(row, ["covenants"], "")) ||
        Boolean(getString(row, ["security_or_charge"], ""))
      );
    });

    const pdfTotal = Math.max(
      getNumber(latestPdfBatch ?? undefined, ["total_files"]),
      pdfIntelligenceDocuments.length,
      investorDocuments.length
    );

    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]) +
      pdfIntelligenceDocuments.filter((row) => {
        const status = getString(row, ["status"], "").toLowerCase();

        return (
          status.includes("review") ||
          status.includes("unmatched") ||
          status.includes("failed")
        );
      }).length;

    const pdfReady = Math.max(
      getNumber(latestPdfBatch ?? undefined, ["ready_files"]),
      pdfIntelligenceDocuments.filter((row) => {
        const status = getString(row, ["status"], "").toLowerCase();

        return status.includes("ready") || status.includes("published");
      }).length
    );

    const complianceHighRisk = Math.max(
      getNumber(latestComplianceBatch ?? undefined, ["high_risk_count"]),
      complianceItems.filter(
        (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
      ).length
    );

    const compliancePending = Math.max(
      getNumber(latestComplianceBatch ?? undefined, ["pending_review_count"]),
      complianceItems.filter((row) => {
        const status = getString(row, ["filing_status", "migration_status"], "")
          .toLowerCase();

        return status === "pending" || status === "review" || status === "overdue";
      }).length
    );

    const fundCommittedCapital =
      getNumber(latestFundBatch ?? undefined, ["total_committed_capital"]) ||
      fundMasterRows.reduce(
        (sum, row) =>
          sum +
          getNumber(row, [
            "committed_capital",
            "total_committed_capital",
            "commitment_amount",
          ]),
        0
      ) ||
      fundCommitments.reduce(
        (sum, row) =>
          sum +
          getNumber(row, [
            "commitment_amount",
            "committed_amount",
            "commitment",
            "amount",
          ]),
        0
      );

    const activeFunds =
      getNumber(latestFundBatch ?? undefined, ["total_funds"]) ||
      fundMasterRows.length ||
      new Set(
        portfolioInvestments
          .map((row) => getString(row, ["fund_name"], ""))
          .filter(Boolean)
      ).size;

    const riskCount = Math.max(batchAtRiskCount, atRiskRows.length);
    const repaymentCount = Math.max(batchRepaymentCount, repaymentRows.length);

    const activeCompanies = totalRecords || portfolioInvestments.length;

    const investmentReadinessScore = Math.min(
      95,
      Math.max(
        0,
        45 +
          Math.min(20, activeCompanies * 5) +
          Math.min(15, exitRows.length * 4) +
          Math.min(10, repaymentCount * 3) +
          Math.min(10, covenantRows.length * 2) +
          Math.min(10, pdfReady * 2) -
          Math.min(15, riskCount * 5) -
          Math.min(10, pdfReview * 2)
      )
    );

    return {
      activeCompanies,
      investmentCost,
      currentValue,
      realisedValue,
      expectedExitValue,
      moic,
      irr,
      tvpi,
      dpi,
      riskCount,
      repaymentCount,
      exitPipelineCount: exitRows.length,
      covenantCount: covenantRows.length,
      pdfTotal,
      pdfReady,
      pdfReview,
      complianceHighRisk,
      compliancePending,
      fundCommittedCapital,
      activeFunds,
      investmentReadinessScore,
    };
  }, [
    latestPortfolioBatch,
    latestPdfBatch,
    latestFundBatch,
    latestComplianceBatch,
    portfolioInvestments,
    financialPositions,
    pdfIntelligenceDocuments,
    investorDocuments,
    complianceItems,
    fundMasterRows,
    fundCommitments,
  ]);

  const atRiskInvestments = useMemo(() => {
    return portfolioInvestments
      .filter((row) => {
        const risk = getString(row, ["risk_status"], "").toLowerCase();

        return (
          risk.includes("risk") ||
          risk.includes("watch") ||
          risk.includes("attention") ||
          risk.includes("high")
        );
      })
      .slice(0, 6);
  }, [portfolioInvestments]);

  const repaymentScheduleRows = useMemo(() => {
    return portfolioInvestments
      .filter((row) => Boolean(getString(row, ["repayment_due_date"], "")))
      .sort((a, b) => {
        const aTime = new Date(
          getString(a, ["repayment_due_date"], "")
        ).getTime();
        const bTime = new Date(
          getString(b, ["repayment_due_date"], "")
        ).getTime();

        return aTime - bTime;
      })
      .slice(0, 6);
  }, [portfolioInvestments]);

  const exitPipelineRows = useMemo(() => {
    return portfolioInvestments
      .filter((row) => Boolean(getString(row, ["expected_exit_date"], "")))
      .sort((a, b) => {
        const aTime = new Date(
          getString(a, ["expected_exit_date"], "")
        ).getTime();
        const bTime = new Date(
          getString(b, ["expected_exit_date"], "")
        ).getTime();

        return aTime - bTime;
      })
      .slice(0, 6);
  }, [portfolioInvestments]);

  const investmentActivityEvents = useMemo(() => {
    const events: InvestmentActivityEvent[] = [];

    if (latestPortfolioBatch) {
      events.push({
        id: `portfolio-batch-${getId(latestPortfolioBatch)}`,
        time: getString(latestPortfolioBatch, ["created_at"], ""),
        module: "Portfolio Data Migration",
        title: "Portfolio data loaded",
        description: `${getNumber(
          latestPortfolioBatch,
          ["total_records"]
        )} portfolio investment record(s) loaded with ${formatCurrencyCr(
          getNumber(latestPortfolioBatch, ["current_portfolio_value"])
        )} current value.`,
        status: "valuation imported",
      });
    }

    portfolioInvestments.slice(0, 8).forEach((row) => {
      const companyName = getString(
        row,
        ["portfolio_company"],
        "Portfolio company"
      );

      const riskStatus = getString(row, ["risk_status"], "Review");

      events.push({
        id: `portfolio-investment-${getId(row)}`,
        time: getString(row, ["created_at", "investment_date"], ""),
        module: "Portfolio Monitoring",
        title: `${companyName} portfolio record reviewed`,
        description: `${getString(row, ["sector"], "Sector not provided")} • ${getString(
          row,
          ["instrument_type"],
          "Instrument not provided"
        )} • ${formatCurrencyCr(
          getNumber(row, ["current_value", "current_fair_value", "valuation"])
        )} current value.`,
        status: riskStatus,
      });

      if (getString(row, ["repayment_due_date"], "")) {
        events.push({
          id: `repayment-${getId(row)}`,
          time: getString(row, ["repayment_due_date"], ""),
          module: "Repayment Tracking",
          title: `${companyName} repayment date identified`,
          description: `Repayment due on ${formatDate(
            row["repayment_due_date"]
          )}. ${getString(row, ["security_or_charge"], "Security not provided")}`,
          status: "repayment",
        });
      }

      if (getString(row, ["expected_exit_date"], "")) {
        events.push({
          id: `exit-${getId(row)}`,
          time: getString(row, ["expected_exit_date"], ""),
          module: "Exit Pipeline",
          title: `${companyName} exit window tracked`,
          description: `Expected exit value ${formatCurrencyCr(
            getNumber(row, ["expected_exit_value"])
          )}.`,
          status: "exit",
        });
      }
    });

    if (latestPdfBatch) {
      const reviewCount =
        getNumber(latestPdfBatch, ["review_files"]) +
        getNumber(latestPdfBatch, ["unmatched_files"]);

      events.push({
        id: `pdf-evidence-${getId(latestPdfBatch)}`,
        time: getString(latestPdfBatch, ["created_at"], ""),
        module: "PDF Evidence",
        title: "PDF intelligence connected",
        description: `${getNumber(
          latestPdfBatch,
          ["total_files"]
        )} document(s) processed, ${reviewCount} requiring review.`,
        status: reviewCount > 0 ? "pdf review" : "pdf ready",
      });
    }

    complianceItems
      .filter((row) => {
        const risk = getString(row, ["risk_level"], "").toLowerCase();
        const category = getString(row, ["category"], "").toLowerCase();

        return risk === "high" || category.includes("valuation");
      })
      .slice(0, 4)
      .forEach((row) => {
        events.push({
          id: `compliance-${getId(row)}`,
          time: getString(row, ["created_at", "due_date"], ""),
          module: "Compliance Evidence",
          title: `${getString(
            row,
            ["document_name"],
            "Compliance item"
          )} requires investment review`,
          description: `${getString(
            row,
            ["authority"],
            "Authority"
          )} • ${getString(row, ["remarks"], "No remarks")}`,
          status: "compliance review",
        });
      });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [
    latestPortfolioBatch,
    latestPdfBatch,
    portfolioInvestments,
    complianceItems,
  ]);

  const investmentActions = useMemo(() => {
    return [
      {
        title: "Review at-risk portfolio companies",
        value: `${investmentMetrics.riskCount} item(s)`,
        href: "/migration/portfolio-data",
        priority: investmentMetrics.riskCount > 0 ? "High" : "Clear",
      },
      {
        title: "Monitor repayment schedules",
        value: `${investmentMetrics.repaymentCount} repayment item(s)`,
        href: "/repayment-notice",
        priority: investmentMetrics.repaymentCount > 0 ? "Medium" : "Clear",
      },
      {
        title: "Review exit pipeline",
        value: `${investmentMetrics.exitPipelineCount} exit item(s)`,
        href: "/migration/portfolio-data",
        priority:
          investmentMetrics.exitPipelineCount > 0 ? "On track" : "Not started",
      },
      {
        title: "Review PDF evidence queue",
        value: `${investmentMetrics.pdfReview} document(s) need review`,
        href: "/migration/pdf-intelligence",
        priority: investmentMetrics.pdfReview > 0 ? "Medium" : "Clear",
      },
      {
        title: "Check valuation / compliance evidence",
        value: `${investmentMetrics.complianceHighRisk} high-risk compliance item(s)`,
        href: "/migration/compliance-data",
        priority:
          investmentMetrics.complianceHighRisk > 0 ? "High" : "On track",
      },
      {
        title: "Open migration readiness",
        value: `${investmentMetrics.investmentReadinessScore}% investment readiness`,
        href: "/migration/activation",
        priority: "Live",
      },
    ];
  }, [investmentMetrics]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Investment Team Workspace</h1>
            <p>
              Live investment control room connected to migrated portfolio,
              repayment, valuation, PDF evidence, fund and compliance data.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Connected investment workspace · Reading migrated portfolio,
          repayment, valuation, PDF and compliance records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investment Team Workspace...</h2>
            <p>
              VENTIQ is reading portfolio investments, repayment schedules, exit
              dates, valuation data, PDF intelligence and compliance evidence.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Migration Data Connected</p>
                  <h2>Live portfolio data is now powering this dashboard</h2>
                </div>

                <button
                  className="monitor-btn monitor-btn-secondary"
                  onClick={loadInvestmentTeamWorkspace}
                  type="button"
                >
                  Refresh Dashboard Data
                </button>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{portfolioInvestments.length}</h3>
                  <p>Portfolio records</p>
                </div>

                <div className="impact-card">
                  <h3>{fundMasterRows.length}</h3>
                  <p>Fund records</p>
                </div>

                <div className="impact-card">
                  <h3>{fundCommitments.length}</h3>
                  <p>Commitment records</p>
                </div>

                <div className="impact-card">
                  <h3>{financialPositions.length}</h3>
                  <p>Financial position records</p>
                </div>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{pdfIntelligenceDocuments.length}</h3>
                  <p>PDF intelligence records</p>
                </div>

                <div className="impact-card">
                  <h3>{complianceItems.length}</h3>
                  <p>Compliance records</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCurrencyCr(investmentMetrics.currentValue)}</h3>
                  <p>Current portfolio value</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCurrencyCr(investmentMetrics.expectedExitValue)}</h3>
                  <p>Expected exit value</p>
                </div>
              </div>

              <div className="explain-box">
                This Investment Team dashboard now reads directly from
                portfolio_investments, portfolio_data_migration_batches,
                fund_master, fund_commitments, investor_financial_positions,
                pdf_intelligence_documents, investor_documents and
                compliance_items.
              </div>
            </div>

            <div className="preview-card">
              <h2>Investment Team Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {investmentMetrics.activeCompanies} migrated
                portfolio investment record(s),{" "}
                {formatCurrencyCr(investmentMetrics.currentValue)} current
                portfolio value, {investmentMetrics.repaymentCount} repayment
                schedule item(s), {investmentMetrics.exitPipelineCount} exit
                pipeline item(s), {investmentMetrics.pdfReview} PDF review
                item(s) and {investmentMetrics.riskCount} portfolio risk
                signal(s).
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/portfolio-data"
                >
                  Review Portfolio Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/repayment-notice"
                >
                  Generate Repayment Notice
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/pdf-intelligence"
                >
                  Review PDF Evidence
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/compliance-data"
                >
                  Review Compliance Evidence
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  View Migration Readiness
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{investmentMetrics.activeCompanies}</h3>
                <p>Portfolio investments</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(investmentMetrics.investmentCost)}</h3>
                <p>Investment cost</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(investmentMetrics.currentValue)}</h3>
                <p>Current value</p>
              </div>

              <div className="impact-card">
                <h3>{formatMultiple(investmentMetrics.moic)}</h3>
                <p>Portfolio MOIC</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCurrencyCr(investmentMetrics.realisedValue)}</h3>
                <p>Realised value</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(investmentMetrics.expectedExitValue)}</h3>
                <p>Expected exit value</p>
              </div>

              <div className="impact-card">
                <h3>{formatPercent(investmentMetrics.irr)}</h3>
                <p>Projected IRR</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.investmentReadinessScore}%</h3>
                <p>Investment readiness</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{investmentMetrics.riskCount}</h3>
                <p>Risk / watchlist items</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.repaymentCount}</h3>
                <p>Repayment schedules</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.exitPipelineCount}</h3>
                <p>Exit pipeline items</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.covenantCount}</h3>
                <p>Covenant / security items</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Portfolio Company Monitoring</h2>

              {portfolioInvestments.length === 0 && (
                <div className="explain-box">
                  No migrated portfolio records found yet. Publish portfolio
                  data from the migration workspace to activate this dashboard.
                </div>
              )}

              {portfolioInvestments.length > 0 && (
                <div className="queue-grid">
                  {portfolioInvestments.slice(0, 8).map((row) => {
                    const companyName = getString(
                      row,
                      ["portfolio_company"],
                      "Portfolio company"
                    );
                    const riskStatus = getString(row, ["risk_status"], "Review");

                    return (
                      <div className="queue-item" key={getId(row)}>
                        {getRiskEmoji(riskStatus)}{" "}
                        <strong>{companyName}</strong>
                        <br />
                        {getString(row, ["sector"], "Sector not provided")} ·{" "}
                        {getString(
                          row,
                          ["instrument_type"],
                          "Instrument not provided"
                        )}
                        <br />
                        Cost:{" "}
                        {formatCurrencyCr(
                          getNumber(row, [
                            "investment_cost",
                            "original_investment_amount",
                            "cost",
                          ])
                        )}
                        {" · "}
                        Current:{" "}
                        {formatCurrencyCr(
                          getNumber(row, [
                            "current_value",
                            "current_fair_value",
                            "valuation",
                          ])
                        )}
                        <br />
                        Status: {riskStatus}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Repayment & Covenant Tracker</h2>

                {repaymentScheduleRows.length === 0 && (
                  <div className="explain-box">
                    No repayment schedules found in migrated portfolio data.
                  </div>
                )}

                {repaymentScheduleRows.length > 0 && (
                  <div className="journal-preview">
                    {repaymentScheduleRows.map((row) => (
                      <div className="journal-row" key={`repayment-${getId(row)}`}>
                        <span>
                          {getString(
                            row,
                            ["portfolio_company"],
                            "Portfolio company"
                          )}
                          <br />
                          Due: {formatDate(row["repayment_due_date"])} ·{" "}
                          {getString(
                            row,
                            ["security_or_charge"],
                            "Security not provided"
                          )}
                        </span>
                        <strong>
                          {getNumber(row, ["interest_rate"]).toFixed(2)}%
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-side-panel">
                <h2>Ask Investment AI</h2>

                <div className="chat-message">
                  Ask: “Which portfolio companies need attention?”
                </div>

                <div className="chat-message">
                  Ask: “Show repayment dates coming up.”
                </div>

                <div className="chat-message">
                  Ask: “Which investments are exit-ready?”
                </div>

                <div className="chat-message">
                  Ask: “Which companies have covenant or charge details?”
                </div>

                <div className="chat-message">
                  Ask: “Summarize portfolio value movement.”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Exit Pipeline</h2>

              {exitPipelineRows.length === 0 && (
                <div className="explain-box">
                  No expected exit dates found in migrated portfolio data.
                </div>
              )}

              {exitPipelineRows.length > 0 && (
                <div className="journal-preview">
                  {exitPipelineRows.map((row) => (
                    <div className="journal-row" key={`exit-${getId(row)}`}>
                      <span>
                        {getString(row, ["portfolio_company"], "Portfolio company")}
                        <br />
                        Expected exit date: {formatDate(row["expected_exit_date"])}
                      </span>
                      <strong>
                        {formatCurrencyCr(
                          getNumber(row, ["expected_exit_value"])
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Investment Control Queue</h2>

              <div className="queue-grid">
                {investmentActions.map((action) => (
                  <a
                    key={action.title}
                    className="queue-item"
                    href={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <strong>{action.title}</strong>
                    <br />
                    {action.value}
                    <br />
                    Priority: {action.priority}
                  </a>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Portfolio Risk Watchlist</h2>

              {atRiskInvestments.length === 0 && (
                <div className="explain-box">
                  No high-risk or watchlist portfolio records found.
                </div>
              )}

              {atRiskInvestments.length > 0 && (
                <div className="queue-grid">
                  {atRiskInvestments.map((row) => (
                    <div className="queue-item" key={`risk-${getId(row)}`}>
                      🔴{" "}
                      <strong>
                        {getString(row, ["portfolio_company"], "Portfolio company")}
                      </strong>
                      <br />
                      {getString(row, ["latest_update"], "No update provided")}
                      <br />
                      Risk status: {getString(row, ["risk_status"], "Review")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Live Investment Activity Feed</h2>

              {investmentActivityEvents.length === 0 && (
                <div className="explain-box">
                  No investment activity found yet. Publish portfolio data,
                  process PDF evidence or add compliance evidence to activate the
                  investment activity trail.
                </div>
              )}

              {investmentActivityEvents.length > 0 && (
                <div className="audit-timeline">
                  {investmentActivityEvents.slice(0, 12).map((event) => (
                    <div className="audit-item" key={event.id}>
                      <strong>{formatDateTime(event.time)}</strong>{" "}
                      {getActivityIcon(event.status)} {event.title}
                      <br />
                      <span>
                        {event.module} — {event.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Investment AI Answer Preview</h2>

              <div className="explain-box">
                <strong>Question:</strong> What should the investment team focus
                on today?
                <br />
                <br />
                <strong>VENTIQ AI:</strong>{" "}
                {investmentMetrics.riskCount > 0
                  ? `Review ${investmentMetrics.riskCount} portfolio risk / watchlist item(s), starting with companies where latest updates or valuation movement indicate attention.`
                  : investmentMetrics.repaymentCount > 0
                  ? `Monitor ${investmentMetrics.repaymentCount} repayment schedule item(s) and prepare notices where required.`
                  : investmentMetrics.pdfReview > 0
                  ? `Review ${investmentMetrics.pdfReview} PDF evidence item(s) before relying on the data for portfolio reporting.`
                  : investmentMetrics.exitPipelineCount > 0
                  ? `Review ${investmentMetrics.exitPipelineCount} exit pipeline item(s) and update expected exit value assumptions.`
                  : "Portfolio data looks stable. Continue monitoring valuation movement, exits, covenants and portfolio updates."}
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Investment Loop</h2>

              <div className="queue-grid">
                <div className="queue-item">Portfolio Data Imported</div>
                <div className="queue-item">Valuation Reviewed</div>
                <div className="queue-item">Risk Signals Identified</div>
                <div className="queue-item">Repayments Tracked</div>
                <div className="queue-item">Covenants Checked</div>
                <div className="queue-item">Exit Pipeline Updated</div>
                <div className="queue-item">PDF Evidence Reviewed</div>
                <div className="queue-item">Compliance Evidence Linked</div>
                <div className="queue-item">Finance Workspace Updated</div>
                <div className="queue-item">Managing Partner View Updated</div>
              </div>

              <div className="explain-box">
                This is the Investment Team view of the same connected VENTIQ
                operating layer. Portfolio records, repayment schedules,
                covenants, expected exits, valuation evidence and risk updates
                now flow into one investment workspace.
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}