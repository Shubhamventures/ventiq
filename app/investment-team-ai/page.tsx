"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

type DataRow = Record<string, unknown>;

type PerformanceCalculationResponse = {
  run?: DataRow | null;
  fundMetric?: DataRow | null;
  portfolioMetrics?: DataRow[];
  investorMetrics?: DataRow[];
  reconciliations?: DataRow[];
  portfolioValuations?: DataRow[];
  error?: string;
};

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

function formatCurrencyInr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${value.toFixed(1)}%`;
}

function getStoredRatePercent(row: DataRow | undefined, keys: string[]) {
  const value = getNumber(row, keys);

  if (!Number.isFinite(value)) return 0;

  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatMultiple(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";

  return `${value.toFixed(2)}x`;
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

  return "⚪";
}

function getRiskEmoji(value: string) {
  const risk = value.toLowerCase();

  if (risk.includes("healthy") || risk.includes("low")) return "🟢";
  if (risk.includes("watch") || risk.includes("medium")) return "🟡";
  if (risk.includes("risk") || risk.includes("high")) return "🔴";

  return "⚪";
}

export default function InvestmentTeamAIPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: isFundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");
  const { session } = useVentiqAuth();

  const [fundOptions, setFundOptions] = useState<string[]>([]);
  const [activationStatus, setActivationStatus] = useState("Setup Not Started");
  const [activationDetails, setActivationDetails] = useState<DataRow | null>(null);

  const [latestPortfolioBatch, setLatestPortfolioBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);

  const [portfolioInvestments, setPortfolioInvestments] = useState<DataRow[]>([]);
  const [debtRepaymentSchedules, setDebtRepaymentSchedules] = useState<DataRow[]>([]);
  const [complianceItems, setComplianceItems] = useState<DataRow[]>([]);

  const [latestCalculationRun, setLatestCalculationRun] =
    useState<DataRow | null>(null);
  const [calculatedFundMetric, setCalculatedFundMetric] =
    useState<DataRow | null>(null);
  const [calculatedPortfolioMetrics, setCalculatedPortfolioMetrics] = useState<
    DataRow[]
  >([]);
  const [calculationReconciliations, setCalculationReconciliations] = useState<
    DataRow[]
  >([]);
  const [calculationLoadMessage, setCalculationLoadMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInvestmentTeamWorkspace() {
    if (!isFundContextReady) return;

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The Investment Team workspace is unavailable because Supabase is not configured."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    async function loadLatestPerformanceCalculation(): Promise<PerformanceCalculationResponse | null> {
      const accessToken = session?.access_token ?? "";

      if (!accessToken) {
        return null;
      }

      try {
        const response = await fetch(
          `/api/metrics/calculate?fundName=${encodeURIComponent(activeFundName)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );
        const result = (await response.json()) as PerformanceCalculationResponse;

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load verified portfolio calculations."
          );
        }

        setCalculationLoadMessage("");
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load verified portfolio calculations.";

        console.warn(
          "VENTIQ Investment Team workspace could not load calculated metrics:",
          message
        );
        setCalculationLoadMessage(message);
        return null;
      }
    }

    try {
      const performanceCalculationData =
        await loadLatestPerformanceCalculation();
      const calculationRun = performanceCalculationData?.run ?? null;
      const calculationSourceBatchIds = calculationRun?.source_batch_ids;
      const calculationSourceBatch = Array.isArray(
        calculationSourceBatchIds
      )
        ? String(calculationSourceBatchIds[0] ?? "")
        : "";

      const db = supabase as any;

      function createFundBatchQuery(
        tableName: string,
        orderBy: string,
        ascending: boolean
      ) {
        let query = db
          .from(tableName)
          .select("*")
          .eq("fund_name", activeFundName);

        if (calculationSourceBatch) {
          query = query.eq("source_batch_id", calculationSourceBatch);
        }

        return query.order(orderBy, { ascending });
      }

      let fundRowQuery = db
        .from("fund_master")
        .select("*")
        .eq("fund_name", activeFundName);

      if (calculationSourceBatch) {
        fundRowQuery = fundRowQuery.eq(
          "source_batch_id",
          calculationSourceBatch
        );
      }

      const [
        fundOptionsResult,
        activationResult,
        portfolioRowsResult,
        valuationRowsResult,
        repaymentRowsResult,
        pdfRowsResult,
        fundRowResult,
        complianceRowsResult,
      ] = await Promise.all([
        db.from("fund_master").select("fund_name").order("fund_name"),

        db
          .from("fund_activation_status")
          .select("*")
          .eq("fund_name", activeFundName)
          .maybeSingle(),

        createFundBatchQuery(
          "portfolio_investments",
          "created_at",
          true
        ),

        createFundBatchQuery(
          "portfolio_valuations",
          "valuation_date",
          false
        ),

        createFundBatchQuery(
          "debt_repayment_schedules",
          "due_date",
          true
        ),

        db
          .from("pdf_intelligence_documents")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("created_at", { ascending: false }),

        fundRowQuery
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        createFundBatchQuery(
          "compliance_items",
          "created_at",
          true
        ),
      ]);

      const firstError =
        fundOptionsResult.error ||
        portfolioRowsResult.error ||
        valuationRowsResult.error ||
        repaymentRowsResult.error ||
        pdfRowsResult.error ||
        fundRowResult.error ||
        complianceRowsResult.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

      const availableFundNames = Array.from(
        new Set(
          ((fundOptionsResult.data ?? []) as DataRow[])
            .map((row) => getString(row, ["fund_name"], ""))
            .filter(Boolean)
        )
      );

      if (!availableFundNames.includes(activeFundName)) {
        availableFundNames.unshift(activeFundName);
      }

      setFundOptions(availableFundNames);

      const activation = activationResult.error
        ? null
        : ((activationResult.data as DataRow | null) ?? null);

      setActivationDetails(activation);
      setActivationStatus(
        getString(activation ?? undefined, ["status"], "Setup Not Started")
      );

      const rawPortfolioRows = (portfolioRowsResult.data ?? []) as DataRow[];
      const authenticatedValuationRows =
        performanceCalculationData?.portfolioValuations ?? [];
      const directValuationRows = (valuationRowsResult.data ?? []) as DataRow[];
      const valuationRows =
        authenticatedValuationRows.length > 0
          ? authenticatedValuationRows
          : directValuationRows;
      const rawRepaymentRows = (repaymentRowsResult.data ?? []) as DataRow[];
      const pdfRows = (pdfRowsResult.data ?? []) as DataRow[];
      const complianceRows = (complianceRowsResult.data ?? []) as DataRow[];
      const fundRow = (fundRowResult.data as DataRow | null) ?? null;
      const calculationPortfolioRows =
        performanceCalculationData?.portfolioMetrics ?? [];

      const latestValuationByPortfolio = new Map<string, DataRow>();

      valuationRows.forEach((row) => {
        const portfolioCode = getString(row, ["portfolio_code"], "");

        if (portfolioCode && !latestValuationByPortfolio.has(portfolioCode)) {
          latestValuationByPortfolio.set(portfolioCode, row);
        }
      });

      const calculationByPortfolio = new Map<string, DataRow>();

      calculationPortfolioRows.forEach((row) => {
        const portfolioCode = getString(row, ["portfolio_code"], "");

        if (portfolioCode) {
          calculationByPortfolio.set(portfolioCode, row);
        }
      });

      const portfolioRows = rawPortfolioRows.map((row) => {
        const portfolioCode = getString(row, ["portfolio_code"], "");
        const valuation = latestValuationByPortfolio.get(portfolioCode);
        const calculation = calculationByPortfolio.get(portfolioCode);

        return {
          ...row,
          current_value: valuation
            ? getNumber(valuation, ["fair_value"])
            : calculation
              ? getNumber(calculation, ["terminal_fair_value"])
              : getNumber(row, ["current_value"]),
          realised_value: valuation
            ? getNumber(valuation, [
                "realised_value_to_date",
                "realized_value_to_date",
              ])
            : calculation
              ? getNumber(calculation, ["realised_proceeds"])
              : getNumber(row, ["realised_value", "realized_value"]),
          expected_exit_value: valuation
            ? getNumber(valuation, ["expected_exit_value"])
            : getNumber(row, ["expected_exit_value"]),
          expected_exit_date: valuation
            ? getString(valuation, ["expected_exit_date"], "")
            : getString(row, ["expected_exit_date"], ""),
          valuation_date: valuation
            ? getString(valuation, ["valuation_date"], "")
            : getString(row, ["valuation_date"], ""),
          gross_moic: calculation
            ? getNumber(calculation, ["gross_moic"])
            : getNumber(row, ["gross_moic", "moic"]),
          gross_irr: calculation
            ? getNumber(calculation, ["gross_irr"])
            : getNumber(row, ["gross_irr"]),
        } as DataRow;
      });

      const portfolioByCode = new Map<string, DataRow>();

      portfolioRows.forEach((row) => {
        const portfolioCode = getString(row, ["portfolio_code"], "");

        if (portfolioCode) {
          portfolioByCode.set(portfolioCode, row);
        }
      });

      const repaymentRows = rawRepaymentRows.map((row) => {
        const portfolioCode = getString(row, ["portfolio_code"], "");
        const portfolio = portfolioByCode.get(portfolioCode);

        return {
          ...row,
          repayment_due_date: getString(row, ["due_date"], ""),
          security_or_charge: getString(
            portfolio,
            ["security_or_charge"],
            "Security not provided"
          ),
          interest_rate: getNumber(portfolio, [
            "interest_rate",
            "coupon_or_interest_rate",
          ]),
          risk_status: getString(portfolio, ["risk_status"], "Review"),
        } as DataRow;
      });

      setPortfolioInvestments(portfolioRows);
      setDebtRepaymentSchedules(repaymentRows);
      setComplianceItems(complianceRows);
      setLatestCalculationRun(performanceCalculationData?.run ?? null);
      setCalculatedFundMetric(performanceCalculationData?.fundMetric ?? null);
      setCalculatedPortfolioMetrics(calculationPortfolioRows);
      setCalculationReconciliations(
        performanceCalculationData?.reconciliations ?? []
      );

      const portfolioInvestmentCost = portfolioRows.reduce(
        (sum, row) => sum + getNumber(row, ["investment_cost"]),
        0
      );
      const portfolioCurrentValue = portfolioRows.reduce(
        (sum, row) => sum + getNumber(row, ["current_value"]),
        0
      );
      const portfolioRealisedValue = portfolioRows.reduce(
        (sum, row) => sum + getNumber(row, ["realised_value", "realized_value"]),
        0
      );
      const portfolioExpectedExitValue = portfolioRows.reduce(
        (sum, row) => sum + getNumber(row, ["expected_exit_value"]),
        0
      );
      const atRiskCount = portfolioRows.filter((row) => {
        const risk = getString(row, ["risk_status"], "").toLowerCase();
        return risk.includes("risk") || risk.includes("watch");
      }).length;
      const repaymentCount = repaymentRows.length;

      setLatestPortfolioBatch(
        portfolioRows.length > 0
          ? {
              id: `active-fund-${activeFundName}-portfolio`,
              created_at: getString(
                portfolioRows[portfolioRows.length - 1],
                ["created_at", "investment_date"],
                ""
              ),
              total_records: portfolioRows.length,
              total_investment_cost: portfolioInvestmentCost,
              current_portfolio_value: portfolioCurrentValue,
              realised_value: portfolioRealisedValue,
              expected_exit_value: portfolioExpectedExitValue,
              portfolio_moic:
                portfolioInvestmentCost > 0
                  ? (portfolioCurrentValue + portfolioRealisedValue) /
                    portfolioInvestmentCost
                  : 0,
              at_risk_count: atRiskCount,
              repayment_count: repaymentCount,
            }
          : null
      );

      const pdfReviewCount = pdfRows.filter((row) => {
        const status = getString(row, ["status"], "").toLowerCase();
        return status.includes("review") || status.includes("unmatched");
      }).length;

      setLatestPdfBatch(
        pdfRows.length > 0
          ? {
              id: `active-fund-${activeFundName}-pdf`,
              created_at: getString(pdfRows[0], ["created_at"], ""),
              total_files: pdfRows.length,
              ready_files: pdfRows.length - pdfReviewCount,
              review_files: pdfReviewCount,
              unmatched_files: pdfRows.filter((row) =>
                getString(row, ["status"], "").toLowerCase().includes("unmatched")
              ).length,
            }
          : null
      );

      setLatestFundBatch(
        fundRow
          ? {
              ...fundRow,
              id: getString(fundRow, ["id"], `active-fund-${activeFundName}`),
              total_funds: 1,
              total_committed_capital: getNumber(fundRow, [
                "committed_capital",
                "target_corpus",
              ]),
            }
          : null
      );

      const complianceHighRisk = complianceRows.filter(
        (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
      ).length;
      const compliancePending = complianceRows.filter((row) => {
        const status = getString(row, ["filing_status"], "").toLowerCase();
        return ["pending", "review", "overdue", "draft"].includes(status);
      }).length;

      setLatestComplianceBatch(
        complianceRows.length > 0
          ? {
              id: `active-fund-${activeFundName}-compliance`,
              created_at: getString(
                complianceRows[complianceRows.length - 1],
                ["created_at", "due_date"],
                ""
              ),
              total_items: complianceRows.length,
              high_risk_count: complianceHighRisk,
              pending_review_count: compliancePending,
            }
          : null
      );
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
    if (isFundContextReady) {
      void loadInvestmentTeamWorkspace();
    }
  }, [activeFundName, isFundContextReady, session?.access_token]);

  const isFundActive = activationStatus === "Active";

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
      (sum, row) => sum + getNumber(row, ["investment_cost"]),
      0
    );

    const rowCurrentValue = portfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["current_value"]),
      0
    );

    const rowRealisedValue = portfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["realised_value", "realized_value"]),
      0
    );

    const rowExpectedExitValue = portfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["expected_exit_value"]),
      0
    );

    const calculatedInvestmentCost = getNumber(
      calculatedFundMetric ?? undefined,
      ["portfolio_investment_cost"]
    );
    const calculatedCurrentValue = getNumber(
      calculatedFundMetric ?? undefined,
      ["portfolio_terminal_fair_value"]
    );
    const calculatedRealisedValue = getNumber(
      calculatedFundMetric ?? undefined,
      ["portfolio_realised_proceeds"]
    );
    const calculatedMoic = getNumber(calculatedFundMetric ?? undefined, [
      "gross_moic",
    ]);
    const calculatedGrossIrr = getStoredRatePercent(
      calculatedFundMetric ?? undefined,
      ["gross_irr"]
    );

    const investmentCost =
      calculatedInvestmentCost || batchInvestmentCost || rowInvestmentCost;
    const currentValue =
      calculatedCurrentValue || batchCurrentValue || rowCurrentValue;
    const realisedValue =
      calculatedRealisedValue || batchRealisedValue || rowRealisedValue;
    const expectedExitValue = batchExpectedExitValue || rowExpectedExitValue;

    const moic =
      calculatedMoic ||
      batchMoic ||
      (investmentCost > 0
        ? (currentValue + realisedValue) / investmentCost
        : 0);

    const atRiskRows = portfolioInvestments.filter((row) => {
      const risk = getString(row, ["risk_status"], "").toLowerCase();

      return risk.includes("risk") || risk.includes("watch");
    });

    const repaymentRows = debtRepaymentSchedules;

    const exitRows = portfolioInvestments.filter((row) =>
      Boolean(getString(row, ["expected_exit_date"], ""))
    );

    const covenantRows = portfolioInvestments.filter((row) => {
      return (
        Boolean(getString(row, ["covenants"], "")) ||
        Boolean(getString(row, ["security_or_charge"], ""))
      );
    });

    const pdfTotal = getNumber(latestPdfBatch ?? undefined, ["total_files"]);

    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

    const complianceHighRisk = getNumber(latestComplianceBatch ?? undefined, [
      "high_risk_count",
    ]);

    const compliancePending = getNumber(latestComplianceBatch ?? undefined, [
      "pending_review_count",
    ]);

    const fundCommittedCapital = getNumber(latestFundBatch ?? undefined, [
      "total_committed_capital",
    ]);

    const activeFunds = getNumber(latestFundBatch ?? undefined, ["total_funds"]);

    const riskCount = Math.max(batchAtRiskCount, atRiskRows.length);
    const repaymentCount = Math.max(batchRepaymentCount, repaymentRows.length);

    const activeCompanies =
      calculatedPortfolioMetrics.length || totalRecords || portfolioInvestments.length;

    const calculationPassCount = calculationReconciliations.filter(
      (row) => getString(row, ["reconciliation_status"], "").toLowerCase() === "pass"
    ).length;
    const calculationControlCount = calculationReconciliations.length;
    const sourceBatchIds = latestCalculationRun?.source_batch_ids;
    const calculationSourceBatch = Array.isArray(sourceBatchIds)
      ? String(sourceBatchIds[0] ?? "")
      : "";

    const investmentReadinessScore = Math.min(
      95,
      Math.max(
        0,
        45 +
          Math.min(20, activeCompanies * 5) +
          Math.min(15, exitRows.length * 4) +
          Math.min(10, repaymentCount * 3) +
          Math.min(10, covenantRows.length * 2) -
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
      grossIrr: calculatedGrossIrr,
      riskCount,
      repaymentCount,
      exitPipelineCount: exitRows.length,
      covenantCount: covenantRows.length,
      pdfTotal,
      pdfReview,
      complianceHighRisk,
      compliancePending,
      fundCommittedCapital,
      activeFunds,
      investmentReadinessScore,
      calculationVersion: getString(
        latestCalculationRun ?? undefined,
        ["calculation_version"],
        ""
      ),
      calculationAsOfDate: getString(
        latestCalculationRun ?? undefined,
        ["as_of_date"],
        ""
      ),
      calculationPassCount,
      calculationControlCount,
      calculationSourceBatch,
      calculationPortfolioCount: calculatedPortfolioMetrics.length,
    };
  }, [
    latestPortfolioBatch,
    latestPdfBatch,
    latestFundBatch,
    latestComplianceBatch,
    portfolioInvestments,
    debtRepaymentSchedules,
    latestCalculationRun,
    calculatedFundMetric,
    calculatedPortfolioMetrics,
    calculationReconciliations,
  ]);

  const atRiskInvestments = useMemo(() => {
    return portfolioInvestments
      .filter((row) => {
        const risk = getString(row, ["risk_status"], "").toLowerCase();

        return risk.includes("risk") || risk.includes("watch");
      })
      .slice(0, 6);
  }, [portfolioInvestments]);

  const repaymentScheduleRows = useMemo(() => {
    return [...debtRepaymentSchedules]
      .sort((a, b) => {
        const aTime = new Date(
          getString(a, ["due_date", "repayment_due_date"], "")
        ).getTime();
        const bTime = new Date(
          getString(b, ["due_date", "repayment_due_date"], "")
        ).getTime();

        return aTime - bTime;
      })
      .slice(0, 6);
  }, [debtRepaymentSchedules]);

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

    if (latestCalculationRun) {
      events.push({
        id: `calculation-${getId(latestCalculationRun)}`,
        time: getString(
          latestCalculationRun,
          ["completed_at", "created_at"],
          ""
        ),
        module: "Performance Calculation",
        title: "Verified deal metrics restored",
        description: `Calculation Engine v${getString(
          latestCalculationRun,
          ["calculation_version"],
          "-"
        )} calculated ${calculatedPortfolioMetrics.length} portfolio record(s).`,
        status: "valuation calculated",
      });
    }

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
        )} • ${formatCurrencyCr(getNumber(row, ["current_value"]))} current value.`,
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
    latestCalculationRun,
    calculatedPortfolioMetrics,
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

        <div className="preview-card investment-fund-context">
          <div>
            <p className="eyebrow">Active Fund Context</p>
            <h2>{activeFundName}</h2>
            <p>
              Activation status: <strong>{activationStatus}</strong>
              {getString(activationDetails ?? undefined, ["activated_by"], "")
                ? ` · Activated by ${getString(
                    activationDetails ?? undefined,
                    ["activated_by"],
                    ""
                  )}`
                : ""}
            </p>
          </div>

          <div className="investment-fund-switcher">
            <label htmlFor="investment-active-fund">Switch active fund</label>
            <div className="investment-fund-switcher-row">
              <select
                id="investment-active-fund"
                onChange={(event) => setActiveFundName(event.target.value)}
                value={activeFundName}
              >
                {fundOptions.map((fundName) => (
                  <option key={fundName} value={fundName}>
                    {fundName}
                  </option>
                ))}
              </select>
              <a className="monitor-btn monitor-btn-secondary" href="/migration/activation">
                Open Fund Activation
              </a>
            </div>
          </div>
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

        {!loading && !errorMessage && !isFundActive && (
          <div className="preview-card investment-activation-lock">
            <p className="eyebrow">Activation Required</p>
            <h2>{activeFundName} is not active across VENTIQ</h2>
            <div className="explain-box">
              The Investment Team Workspace is locked because this fund has not
              completed data validation, maker-checker approval and controlled
              activation. Portfolio records remain visible only inside migration
              review until the fund is activated.
            </div>
            <div className="action-row">
              <a className="monitor-btn monitor-btn-primary" href="/migration/activation">
                Complete Fund Activation
              </a>
              <a className="monitor-btn monitor-btn-secondary" href="/migration/data-intake">
                Open Data Intake
              </a>
            </div>
          </div>
        )}

        {!loading && !errorMessage && isFundActive && (
          <>
            <div className="preview-card">
              <h2>Investment Team Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {investmentMetrics.activeCompanies} portfolio
                investment record(s), including verified Calculation Engine
                outputs where available, with {formatCurrencyCr(
                  investmentMetrics.currentValue
                )} terminal fair value, {investmentMetrics.repaymentCount} repayment
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

            {investmentMetrics.calculationVersion ? (
              <div className="explain-box investment-calculation-status">
                Verified Calculation Engine v{investmentMetrics.calculationVersion} ·
                as of {formatDate(investmentMetrics.calculationAsOfDate)} · {" "}
                {investmentMetrics.calculationPassCount}/
                {investmentMetrics.calculationControlCount} reconciliation controls passed · {" "}
                {investmentMetrics.calculationPortfolioCount} deal-level calculations.
              </div>
            ) : calculationLoadMessage ? (
              <div className="explain-box">
                Verified deal metrics could not be restored: {calculationLoadMessage}
              </div>
            ) : null}

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
                <p>Gross MOIC</p>
              </div>

              <div className="impact-card">
                <h3>{formatPercent(investmentMetrics.grossIrr)}</h3>
                <p>Gross IRR</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCurrencyCr(investmentMetrics.expectedExitValue)}</h3>
                <p>Expected exit value</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.riskCount}</h3>
                <p>Risk / watchlist items</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.repaymentCount}</h3>
                <p>Repayment schedules</p>
              </div>

              <div className="impact-card">
                <h3>{investmentMetrics.investmentReadinessScore}%</h3>
                <p>Investment readiness</p>
              </div>
            </div>

            <div className="preview-card">
              <div className="investment-calculation-heading">
                <div>
                  <p className="eyebrow">Verified performance layer</p>
                  <h2>Deal-Level IRR & MOIC</h2>
                </div>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/performance-calculations"
                >
                  Open Calculation Engine
                </a>
              </div>

              {calculatedPortfolioMetrics.length === 0 && (
                <div className="explain-box">
                  No completed deal-level calculation is available for this fund yet.
                </div>
              )}

              {calculatedPortfolioMetrics.length > 0 && (
                <div className="investment-calculation-table-wrap">
                  <table className="investment-calculation-table">
                    <thead>
                      <tr>
                        <th>Portfolio</th>
                        <th>Instrument</th>
                        <th>Invested</th>
                        <th>Realised</th>
                        <th>Fair value</th>
                        <th>MOIC</th>
                        <th>IRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedPortfolioMetrics.slice(0, 12).map((row) => (
                        <tr key={`calculated-${getString(row, ["portfolio_code"], getId(row))}`}>
                          <td>
                            <strong>
                              {getString(row, ["portfolio_company"], "Portfolio company")}
                            </strong>
                            <span>
                              {getString(row, ["portfolio_code"], "-")}
                            </span>
                          </td>
                          <td>{getString(row, ["instrument_type"], "-")}</td>
                          <td>{formatCurrencyCr(getNumber(row, ["invested_capital"]))}</td>
                          <td>{formatCurrencyCr(getNumber(row, ["realised_proceeds"]))}</td>
                          <td>{formatCurrencyCr(getNumber(row, ["terminal_fair_value"]))}</td>
                          <td>{formatMultiple(getNumber(row, ["gross_moic"]))}</td>
                          <td>
                            {formatPercent(
                              getStoredRatePercent(row, ["gross_irr"])
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {investmentMetrics.calculationSourceBatch && (
                <div className="investment-calculation-footnote">
                  Source batch: {investmentMetrics.calculationSourceBatch}
                </div>
              )}
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
                        {formatCurrencyCr(getNumber(row, ["investment_cost"]))}
                        {" · "}
                        Current:{" "}
                        {formatCurrencyCr(getNumber(row, ["current_value"]))}
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
                    No batch-scoped debt repayment schedules found for this fund.
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
                          Due: {formatDate(
                            row["due_date"] ?? row["repayment_due_date"]
                          )} ·{" "}
                          {getString(
                            row,
                            ["repayment_type"],
                            "Repayment"
                          )}
                          <br />
                          {getString(
                            row,
                            ["security_or_charge"],
                            "Security not provided"
                          )}
                        </span>
                        <strong>
                          {formatCurrencyInr(
                            getNumber(row, ["total_due"])
                          )}
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

      <style jsx>{`
        .investment-fund-context {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 0.8fr);
          gap: 28px;
          align-items: center;
        }

        .investment-fund-context h2 {
          margin: 2px 0 8px;
        }

        .investment-fund-context p {
          margin-bottom: 0;
        }

        .investment-fund-switcher {
          display: grid;
          gap: 8px;
        }

        .investment-fund-switcher label {
          font-size: 0.82rem;
          font-weight: 800;
        }

        .investment-fund-switcher-row {
          display: flex;
          gap: 12px;
          align-items: stretch;
        }

        .investment-fund-switcher select {
          min-width: 0;
          flex: 1;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          padding: 0 16px;
          background: rgba(15, 23, 42, 0.72);
          color: inherit;
          font: inherit;
        }

        .investment-activation-lock {
          border-color: rgba(59, 130, 246, 0.45);
        }

        .investment-calculation-status {
          border-color: rgba(59, 130, 246, 0.5);
        }

        .investment-calculation-heading {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          margin-bottom: 18px;
        }

        .investment-calculation-heading h2 {
          margin: 2px 0 0;
        }

        .investment-calculation-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 18px;
        }

        .investment-calculation-table {
          width: 100%;
          min-width: 980px;
          border-collapse: collapse;
        }

        .investment-calculation-table th,
        .investment-calculation-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          vertical-align: top;
        }

        .investment-calculation-table th {
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(191, 219, 254, 0.9);
          background: rgba(37, 99, 235, 0.12);
        }

        .investment-calculation-table td {
          font-size: 0.9rem;
        }

        .investment-calculation-table td span {
          display: block;
          margin-top: 4px;
          color: rgba(191, 219, 254, 0.72);
          font-size: 0.78rem;
        }

        .investment-calculation-table tr:last-child td {
          border-bottom: 0;
        }

        .investment-calculation-footnote {
          margin-top: 14px;
          color: rgba(191, 219, 254, 0.76);
          font-size: 0.78rem;
          overflow-wrap: anywhere;
        }

        @media (max-width: 860px) {
          .investment-fund-context {
            grid-template-columns: 1fr;
          }

          .investment-fund-switcher-row {
            flex-direction: column;
          }

          .investment-fund-switcher select {
            min-height: 48px;
          }

          .investment-calculation-heading {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}