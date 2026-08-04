"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";

type DataRow = Record<string, unknown>;
type DeckChartItem = {
  label: string;
  value: number;
  displayValue: string;
};

type DeckChart = {
  title: string;
  unit: string;
  items: DeckChartItem[];
};

type DeckSlideOption = {
  includeHighlights: boolean;
  includeNarrative: boolean;
  includeChart: boolean;
};
type ConnectedActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};
type DeckMetricKey =
  | "fundOverview"
  | "fundPerformance"
  | "portfolioPerformance"
  | "deployment"
  | "capitalCalls"
  | "distributions"
  | "investorDocuments"
  | "regulatoryUpdates"
  | "repaymentSchedule"
  | "portfolioNews"
  | "lpNarrative"
  | "exitPipeline"
  | "riskSummary";

const deckMetricOptions: { key: DeckMetricKey; label: string }[] = [
  { key: "fundOverview", label: "Fund overview" },
  { key: "fundPerformance", label: "Gross IRR / Net IRR / DPI / TVPI" },
  { key: "portfolioPerformance", label: "Portfolio company performance" },
  { key: "deployment", label: "Deployment and dry powder" },
  { key: "capitalCalls", label: "Capital calls" },
  { key: "distributions", label: "Distributions" },
  { key: "investorDocuments", label: "Investor document status" },
  { key: "regulatoryUpdates", label: "Regulatory updates" },
  { key: "repaymentSchedule", label: "Debt repayment schedule" },
  { key: "portfolioNews", label: "Portfolio news alerts" },
  { key: "lpNarrative", label: "LP narrative" },
  { key: "exitPipeline", label: "Exit pipeline" },
  { key: "riskSummary", label: "Portfolio risk summary" },
];

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

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${value.toFixed(1)}%`;
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

  if (value.includes("approved")) return "🟢";
  if (value.includes("generated")) return "🔵";
  if (value.includes("available")) return "🟢";
  if (value.includes("stored")) return "🟣";
  if (value.includes("queued")) return "🟡";
  if (value.includes("sent")) return "🟢";
  if (value.includes("data room")) return "🗂️";
  if (value.includes("imported")) return "📥";
  if (value.includes("viewed")) return "👁️";
  if (value.includes("downloaded")) return "⬇️";
  if (value.includes("ddq")) return "❓";
  if (value.includes("answered")) return "🟢";
  if (value.includes("open")) return "🟡";
  if (value.includes("readiness")) return "📊";

  return "⚪";
}

function statusLabel(value: string) {
  if (!value) return "Active";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function rowStatus(row: DataRow) {
  return getString(row, ["status"], "").toLowerCase();
}

function isApproved(row: DataRow) {
  return rowStatus(row) === "approved";
}

function isDraft(row: DataRow) {
  const status = rowStatus(row);

  return status === "draft" || status === "pending" || status === "";
}


function getFundName(row: DataRow) {
  return getString(
    row,
    ["fund_name", "scheme_name", "fund", "fund_title"],
    ""
  ).trim();
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function getReference(row: DataRow, keys: string[]) {
  return getString(row, keys, "").trim();
}

function rowMatchesFund(
  row: DataRow,
  fundName: string,
  fundIds: Set<string>,
  includeGlobalRows = false
) {
  const normalizedFundName = normalizeValue(fundName);
  const rowFundName = normalizeValue(getFundName(row));

  if (rowFundName) {
    return rowFundName === normalizedFundName;
  }

  const rowFundId = getReference(row, ["fund_id", "scheme_id"]);
  if (rowFundId) return fundIds.has(rowFundId);

  return includeGlobalRows;
}

function filterRowsForFund(
  rows: DataRow[],
  fundName: string,
  fundIds: Set<string>,
  includeGlobalRows = false
) {
  return rows.filter((row) =>
    rowMatchesFund(row, fundName, fundIds, includeGlobalRows)
  );
}

function uniqueFundNames(rowGroups: DataRow[][]) {
  return Array.from(
    new Set(
      rowGroups
        .flat()
        .map(getFundName)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function latestTimestamp(rows: DataRow[]) {
  return (
    rows
      .map((row) =>
        getString(
          row,
          ["updated_at", "created_at", "published_at", "generated_at"],
          ""
        )
      )
      .filter(Boolean)
      .sort()
      .at(-1) ?? ""
  );
}

function latestRowFromRows(rows: DataRow[]) {
  if (rows.length === 0) return null;

  return [...rows].sort((left, right) => {
    const leftTime = new Date(
      getString(
        left,
        ["updated_at", "created_at", "published_at", "generated_at"],
        "1970-01-01"
      )
    ).getTime();
    const rightTime = new Date(
      getString(
        right,
        ["updated_at", "created_at", "published_at", "generated_at"],
        "1970-01-01"
      )
    ).getTime();

    return rightTime - leftTime;
  })[0];
}

function batchIdentity(rows: DataRow[], fallback: string) {
  const latestRow = latestRowFromRows(rows);
  return getString(latestRow ?? undefined, ["batch_id", "id"], fallback);
}

function sumRows(rows: DataRow[], keys: string[]) {
  return rows.reduce((sum, row) => sum + getNumber(row, keys), 0);
}

function averageRows(rows: DataRow[], keys: string[]) {
  const values = rows
    .map((row) => getNumber(row, keys))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function ManagingPartnerAIPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");
  const [availableFunds, setAvailableFunds] = useState<string[]>([
    "VENTIQ Growth Fund II",
  ]);
  const [fundActivationStatus, setFundActivationStatus] = useState("Checking");
  const [fundActivatedAt, setFundActivatedAt] = useState("");
  const [fundActivatedBy, setFundActivatedBy] = useState("");
  const [funds, setFunds] = useState<DataRow[]>([]);
  const [commitments, setCommitments] = useState<DataRow[]>([]);
  const [investors, setInvestors] = useState<DataRow[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<DataRow[]>([]);
  const [distributions, setDistributions] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [regulatoryMatches, setRegulatoryMatches] = useState<DataRow[]>([]);
  const [regulatoryCirculars, setRegulatoryCirculars] = useState<DataRow[]>([]);

  const [portfolioCompanies, setPortfolioCompanies] = useState<DataRow[]>([]);
  const [fundInvestments, setFundInvestments] = useState<DataRow[]>([]);
  const [debtRepayments, setDebtRepayments] = useState<DataRow[]>([]);
  const [portfolioCompanyMetrics, setPortfolioCompanyMetrics] = useState<
    DataRow[]
  >([]);
  const [portfolioNewsAlerts, setPortfolioNewsAlerts] = useState<DataRow[]>([]);
  const [fundPerformanceMetrics, setFundPerformanceMetrics] = useState<
    DataRow[]
  >([]);
  const [dataRoomDocuments, setDataRoomDocuments] = useState<DataRow[]>([]);
  const [dataRoomEngagementEvents, setDataRoomEngagementEvents] = useState<
    DataRow[]
  >([]);
  const [dataRoomQuestions, setDataRoomQuestions] = useState<DataRow[]>([]);
    const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestPortfolioBatch, setLatestPortfolioBatch] =
    useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [migratedInvestorMaster, setMigratedInvestorMaster] = useState<
  DataRow[]
>([]);
const [migratedFundCommitments, setMigratedFundCommitments] = useState<
  DataRow[]
>([]);
const [migratedFinancialPositions, setMigratedFinancialPositions] = useState<
  DataRow[]
>([]);
const [migratedFundMaster, setMigratedFundMaster] = useState<DataRow[]>([]);
const [migratedPortfolioInvestments, setMigratedPortfolioInvestments] =
  useState<DataRow[]>([]);
const [migratedComplianceItems, setMigratedComplianceItems] = useState<
  DataRow[]
>([]);
const [migratedPdfDocuments, setMigratedPdfDocuments] = useState<DataRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedDeckFundId, setSelectedDeckFundId] = useState("all");
  const [deckMessage, setDeckMessage] = useState("");
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [editedDeckNarratives, setEditedDeckNarratives] = useState<
  Record<string, string>
>({});
const [deckSlideOptions, setDeckSlideOptions] = useState<
  Record<string, DeckSlideOption>
>({});
const [selectedDeckTheme, setSelectedDeckTheme] = useState("ventiq_blue");
const [selectedDeckLayout, setSelectedDeckLayout] = useState("balanced");
const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState(true);
  const [selectedDeckMetrics, setSelectedDeckMetrics] = useState<
    Record<DeckMetricKey, boolean>
  >({
    fundOverview: true,
    fundPerformance: true,
    portfolioPerformance: true,
    deployment: true,
    capitalCalls: true,
    distributions: true,
    investorDocuments: true,
    regulatoryUpdates: true,
    repaymentSchedule: true,
    portfolioNews: true,
    lpNarrative: true,
    exitPipeline: false,
    riskSummary: true,
  });

  useEffect(() => {
    if (!fundContextReady || !activeFundName) return;
    void loadManagingPartnerDashboard();
  }, [activeFundName, fundContextReady, setActiveFundName]);

  async function loadManagingPartnerDashboard() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The sample Managing Partner workspace is temporarily unavailable. Please request a walkthrough."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setFundActivationStatus("Checking");
    setFundActivatedAt("");
    setFundActivatedBy("");

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
            `VENTIQ Managing Partner dashboard skipped ${tableName}:`,
            error.message
          );
          return [] as DataRow[];
        }

        return (data ?? []) as DataRow[];
      } catch (error) {
        console.warn(
          `VENTIQ Managing Partner dashboard skipped ${tableName}:`,
          error
        );
        return [] as DataRow[];
      }
    }

    async function loadActivationRecord() {
      try {
        const { data, error } = await db
          .from("fund_activation_status")
          .select("status, activated_at, activated_by, readiness_score")
          .eq("fund_name", activeFundName)
          .maybeSingle();

        if (error) {
          console.warn(
            "VENTIQ Managing Partner dashboard could not read fund activation:",
            error.message
          );
          return null;
        }

        return (data as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          "VENTIQ Managing Partner dashboard could not read fund activation:",
          error
        );
        return null;
      }
    }

    try {
      const [
        fundsData,
        commitmentsData,
        investorsData,
        capitalCallsData,
        distributionsData,
        documentsData,
        matchesData,
        circularsData,
        portfolioCompaniesData,
        fundInvestmentsData,
        debtRepaymentsData,
        portfolioCompanyMetricsData,
        portfolioNewsAlertsData,
        fundPerformanceMetricsData,
        dataRoomDocumentsData,
        dataRoomEngagementData,
        dataRoomQuestionsData,
        migratedInvestorMasterData,
        migratedFundCommitmentsData,
        migratedFinancialPositionsData,
        migratedFundMasterData,
        migratedPortfolioInvestmentsData,
        migratedComplianceItemsData,
        migratedPdfDocumentsData,
        activationRecord,
      ] = await Promise.all([
        selectRows("funds"),
        selectRows("commitments"),
        selectRows("investors"),
        selectRows("capital_calls"),
        selectRows("distributions"),
        selectRows("investor_documents", {
          orderBy: "published_at",
          ascending: false,
        }),
        selectRows("regulatory_source_matches", {
          eq: { column: "status", value: "needs_review" },
        }),
        selectRows("regulatory_circulars", {
          eq: { column: "status", value: "active" },
        }),
        selectRows("portfolio_companies"),
        selectRows("fund_investments"),
        selectRows("debt_repayment_schedules", {
          orderBy: "due_date",
          ascending: true,
        }),
        selectRows("portfolio_company_metrics", {
          orderBy: "metric_date",
          ascending: false,
        }),
        selectRows("portfolio_news_alerts", {
          orderBy: "alert_date",
          ascending: false,
        }),
        selectRows("fund_performance_metrics", {
          orderBy: "reporting_date",
          ascending: false,
        }),
        selectRows("data_room_documents", {
          orderBy: "imported_at",
          ascending: false,
        }),
        selectRows("data_room_engagement_events", {
          orderBy: "event_time",
          ascending: false,
        }),
        selectRows("data_room_questions", {
          orderBy: "asked_at",
          ascending: false,
        }),
        selectRows("investor_master", {
          orderBy: "investor_code",
          ascending: true,
        }),
        selectRows("fund_commitments"),
        selectRows("investor_financial_positions"),
        selectRows("fund_master"),
        selectRows("portfolio_investments"),
        selectRows("compliance_items"),
        selectRows("pdf_intelligence_documents"),
        loadActivationRecord(),
      ]);

      const fundOptions = uniqueFundNames([
        migratedFundMasterData,
        migratedInvestorMasterData,
        migratedFundCommitmentsData,
        migratedFinancialPositionsData,
        migratedPortfolioInvestmentsData,
        migratedComplianceItemsData,
        migratedPdfDocumentsData,
        fundsData,
        commitmentsData,
        capitalCallsData,
        distributionsData,
        documentsData,
        fundInvestmentsData,
        fundPerformanceMetricsData,
        dataRoomDocumentsData,
      ]);

      const nextFundOptions = fundOptions.length
        ? fundOptions
        : [activeFundName];
      setAvailableFunds(nextFundOptions);

      if (!nextFundOptions.includes(activeFundName)) {
        setActiveFundName(nextFundOptions[0]);
        return;
      }

      const selectedFundRows = [
        ...fundsData,
        ...migratedFundMasterData,
      ].filter(
        (row) => normalizeValue(getFundName(row)) === normalizeValue(activeFundName)
      );
      const selectedFundIds = new Set(
        selectedFundRows.map(getId).filter(Boolean)
      );

      const scopedFunds = filterRowsForFund(
        fundsData,
        activeFundName,
        selectedFundIds
      );
      const scopedMigratedFundMaster = filterRowsForFund(
        migratedFundMasterData,
        activeFundName,
        selectedFundIds
      );
      const scopedCommitments = filterRowsForFund(
        commitmentsData,
        activeFundName,
        selectedFundIds
      );
      const scopedMigratedCommitments = filterRowsForFund(
        migratedFundCommitmentsData,
        activeFundName,
        selectedFundIds
      );
      const selectedInvestorIds = new Set(
        [...scopedCommitments, ...scopedMigratedCommitments]
          .map((row) =>
            getReference(row, ["investor_id", "limited_partner_id", "lp_id"])
          )
          .filter(Boolean)
      );
      const scopedInvestors = investorsData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedInvestorIds.has(getId(row));
      });
      const scopedInvestorMaster = filterRowsForFund(
        migratedInvestorMasterData,
        activeFundName,
        selectedFundIds
      );
      const scopedFinancialPositions = filterRowsForFund(
        migratedFinancialPositionsData,
        activeFundName,
        selectedFundIds
      );
      const scopedCapitalCalls = filterRowsForFund(
        capitalCallsData,
        activeFundName,
        selectedFundIds
      );
      const scopedDistributions = filterRowsForFund(
        distributionsData,
        activeFundName,
        selectedFundIds
      );
      const scopedDocuments = filterRowsForFund(
        documentsData,
        activeFundName,
        selectedFundIds
      );
      const scopedPdfDocuments = filterRowsForFund(
        migratedPdfDocumentsData,
        activeFundName,
        selectedFundIds
      );
      const scopedFundInvestments = filterRowsForFund(
        fundInvestmentsData,
        activeFundName,
        selectedFundIds
      );
      const selectedInvestmentIds = new Set(
        scopedFundInvestments.map(getId).filter(Boolean)
      );
      const selectedCompanyIds = new Set(
        scopedFundInvestments
          .map((row) =>
            getReference(row, [
              "portfolio_company_id",
              "company_id",
              "investee_company_id",
            ])
          )
          .filter(Boolean)
      );
      const scopedPortfolioCompanies = portfolioCompaniesData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedCompanyIds.has(getId(row));
      });
      const scopedDebtRepayments = debtRepaymentsData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        const investmentId = getReference(row, [
          "fund_investment_id",
          "investment_id",
        ]);
        const companyId = getReference(row, [
          "portfolio_company_id",
          "company_id",
        ]);
        return (
          selectedInvestmentIds.has(investmentId) ||
          selectedCompanyIds.has(companyId)
        );
      });
      const scopedPortfolioMetrics = portfolioCompanyMetricsData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedCompanyIds.has(
          getReference(row, ["portfolio_company_id", "company_id"])
        );
      });
      const scopedPortfolioNews = portfolioNewsAlertsData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedCompanyIds.has(
          getReference(row, ["portfolio_company_id", "company_id"])
        );
      });
      const scopedPerformanceMetrics = filterRowsForFund(
        fundPerformanceMetricsData,
        activeFundName,
        selectedFundIds
      );
      const scopedMigratedPortfolio = filterRowsForFund(
        migratedPortfolioInvestmentsData,
        activeFundName,
        selectedFundIds
      );
      const scopedCompliance = filterRowsForFund(
        migratedComplianceItemsData,
        activeFundName,
        selectedFundIds
      );
      const scopedDataRoomDocuments = filterRowsForFund(
        dataRoomDocumentsData,
        activeFundName,
        selectedFundIds
      );
      const selectedDataRoomDocumentIds = new Set(
        scopedDataRoomDocuments.map(getId).filter(Boolean)
      );
      const scopedDataRoomEngagement = dataRoomEngagementData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedDataRoomDocumentIds.has(
          getReference(row, ["document_id", "data_room_document_id"])
        );
      });
      const scopedDataRoomQuestions = dataRoomQuestionsData.filter((row) => {
        if (rowMatchesFund(row, activeFundName, selectedFundIds)) return true;
        return selectedDataRoomDocumentIds.has(
          getReference(row, ["document_id", "data_room_document_id"])
        );
      });

      setFunds(scopedFunds);
      setCommitments(scopedCommitments);
      setInvestors(scopedInvestors);
      setCapitalCalls(scopedCapitalCalls);
      setDistributions(scopedDistributions);
      setInvestorDocuments(scopedDocuments);
      setRegulatoryMatches(
        filterRowsForFund(matchesData, activeFundName, selectedFundIds, true)
      );
      setRegulatoryCirculars(
        filterRowsForFund(circularsData, activeFundName, selectedFundIds, true)
      );
      setPortfolioCompanies(scopedPortfolioCompanies);
      setFundInvestments(scopedFundInvestments);
      setDebtRepayments(scopedDebtRepayments);
      setPortfolioCompanyMetrics(scopedPortfolioMetrics);
      setPortfolioNewsAlerts(scopedPortfolioNews);
      setFundPerformanceMetrics(scopedPerformanceMetrics);
      setDataRoomDocuments(scopedDataRoomDocuments);
      setDataRoomEngagementEvents(scopedDataRoomEngagement);
      setDataRoomQuestions(scopedDataRoomQuestions);
      setMigratedInvestorMaster(scopedInvestorMaster);
      setMigratedFundCommitments(scopedMigratedCommitments);
      setMigratedFinancialPositions(scopedFinancialPositions);
      setMigratedFundMaster(scopedMigratedFundMaster);
      setMigratedPortfolioInvestments(scopedMigratedPortfolio);
      setMigratedComplianceItems(scopedCompliance);
      setMigratedPdfDocuments(scopedPdfDocuments);

      const investorSourceRows = [
        ...scopedInvestorMaster,
        ...scopedMigratedCommitments,
        ...scopedFinancialPositions,
      ];
      const investorSummary = investorSourceRows.length
        ? {
            id: batchIdentity(
              investorSourceRows,
              `${activeFundName}-investor-data`
            ),
            fund_name: activeFundName,
            batch_name: `${activeFundName} investor dataset`,
            total_records: scopedInvestorMaster.length || scopedInvestors.length,
            total_commitment:
              sumRows(scopedMigratedCommitments, [
                "commitment_amount",
                "committed_amount",
                "commitment",
              ]) ||
              sumRows(scopedCommitments, [
                "commitment_amount",
                "committed_amount",
                "commitment",
                "amount",
              ]),
            status: "activated",
            created_at: latestTimestamp(investorSourceRows),
          }
        : null;

      const pdfReadyFiles = scopedPdfDocuments.filter((row) => {
        const status = getString(row, ["status"], "").toLowerCase();
        return ["ready", "approved", "published", "available"].includes(status);
      }).length;
      const pdfUnmatchedFiles = scopedPdfDocuments.filter(
        (row) => getString(row, ["status"], "").toLowerCase() === "unmatched"
      ).length;
      const pdfReviewFiles = Math.max(
        scopedPdfDocuments.length - pdfReadyFiles - pdfUnmatchedFiles,
        0
      );
      const pdfSummary = scopedPdfDocuments.length
        ? {
            id: batchIdentity(scopedPdfDocuments, `${activeFundName}-pdf-data`),
            fund_name: activeFundName,
            batch_name: `${activeFundName} PDF intelligence dataset`,
            total_files: scopedPdfDocuments.length,
            ready_files: pdfReadyFiles,
            review_files: pdfReviewFiles,
            unmatched_files: pdfUnmatchedFiles,
            status: "activated",
            created_at: latestTimestamp(scopedPdfDocuments),
          }
        : null;

      const totalInvestmentCost = sumRows(scopedMigratedPortfolio, [
        "investment_cost",
        "original_investment_amount",
      ]);
      const currentPortfolioValue = sumRows(scopedMigratedPortfolio, [
        "current_value",
        "current_portfolio_value",
        "current_fair_value",
      ]);
      const realisedValue = sumRows(scopedMigratedPortfolio, [
        "realised_value",
        "realized_value",
      ]);
      const expectedExitValue = sumRows(scopedMigratedPortfolio, [
        "expected_exit_value",
      ]);
      const portfolioSummary = scopedMigratedPortfolio.length
        ? {
            id: batchIdentity(
              scopedMigratedPortfolio,
              `${activeFundName}-portfolio-data`
            ),
            fund_name: activeFundName,
            batch_name: `${activeFundName} portfolio dataset`,
            total_records: scopedMigratedPortfolio.length,
            total_investment_cost: totalInvestmentCost,
            current_portfolio_value: currentPortfolioValue,
            realised_value: realisedValue,
            expected_exit_value: expectedExitValue,
            portfolio_moic:
              totalInvestmentCost > 0
                ? (currentPortfolioValue + realisedValue) / totalInvestmentCost
                : averageRows(scopedMigratedPortfolio, ["moic"]),
            at_risk_count: scopedMigratedPortfolio.filter((row) => {
              const risk = getString(row, ["risk_status"], "").toLowerCase();
              return risk.includes("risk") || risk.includes("watch");
            }).length,
            repayment_count: scopedMigratedPortfolio.filter((row) =>
              Boolean(getString(row, ["repayment_due_date"], ""))
            ).length,
            status: "activated",
            created_at: latestTimestamp(scopedMigratedPortfolio),
          }
        : null;

      const fundSummary = scopedMigratedFundMaster.length
        ? {
            id: batchIdentity(
              scopedMigratedFundMaster,
              `${activeFundName}-fund-data`
            ),
            fund_name: activeFundName,
            batch_name: `${activeFundName} fund master dataset`,
            total_funds: scopedMigratedFundMaster.length,
            total_committed_capital: sumRows(scopedMigratedFundMaster, [
              "committed_capital",
              "total_committed_capital",
              "commitment_amount",
            ]),
            average_carry: averageRows(scopedMigratedFundMaster, [
              "carry_rate",
              "carry",
            ]),
            status: "activated",
            created_at: latestTimestamp(scopedMigratedFundMaster),
          }
        : null;

      const complianceSummary = scopedCompliance.length
        ? {
            id: batchIdentity(
              scopedCompliance,
              `${activeFundName}-compliance-data`
            ),
            fund_name: activeFundName,
            batch_name: `${activeFundName} compliance dataset`,
            total_items: scopedCompliance.length,
            pending_review_count: scopedCompliance.filter((row) => {
              const status = getString(
                row,
                ["filing_status", "migration_status"],
                ""
              ).toLowerCase();
              return ["pending", "review", "overdue", "draft"].includes(status);
            }).length,
            high_risk_count: scopedCompliance.filter(
              (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
            ).length,
            status: "activated",
            created_at: latestTimestamp(scopedCompliance),
          }
        : null;

      setLatestInvestorBatch(investorSummary);
      setLatestPdfBatch(pdfSummary);
      setLatestPortfolioBatch(portfolioSummary);
      setLatestFundBatch(fundSummary);
      setLatestComplianceBatch(complianceSummary);

      const activationStatus = getString(
        activationRecord ?? undefined,
        ["status"],
        "Setup Not Started"
      );
      setFundActivationStatus(activationStatus);
      setFundActivatedAt(
        getString(activationRecord ?? undefined, ["activated_at"], "")
      );
      setFundActivatedBy(
        getString(activationRecord ?? undefined, ["activated_by"], "")
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Managing Partner workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  const fundMap = useMemo(() => {
    return new Map(funds.map((fund) => [getId(fund), fund]));
  }, [funds]);

  const companyMap = useMemo(() => {
    return new Map(portfolioCompanies.map((company) => [getId(company), company]));
  }, [portfolioCompanies]);

    const dashboardMetrics = useMemo(() => {
    const migrationInvestorCount = getNumber(latestInvestorBatch ?? undefined, [
      "total_records",
    ]);
    const migrationInvestorCommitment = getNumber(
      latestInvestorBatch ?? undefined,
      ["total_commitment"]
    );

    const migrationPdfCount = getNumber(latestPdfBatch ?? undefined, [
      "total_files",
    ]);
    const migrationPdfReviewCount =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

    const migrationPortfolioCount = getNumber(
      latestPortfolioBatch ?? undefined,
      ["total_records"]
    );
    const migrationPortfolioCost = getNumber(
      latestPortfolioBatch ?? undefined,
      ["total_investment_cost"]
    );
    const migrationPortfolioValue = getNumber(
      latestPortfolioBatch ?? undefined,
      ["current_portfolio_value"]
    );
    const migrationRealizedValue = getNumber(
      latestPortfolioBatch ?? undefined,
      ["realised_value", "realized_value"]
    );
    const migrationExpectedExitValue = getNumber(
      latestPortfolioBatch ?? undefined,
      ["expected_exit_value"]
    );
    const migrationPortfolioMoic = getNumber(
      latestPortfolioBatch ?? undefined,
      ["portfolio_moic"]
    );
    const migrationAtRiskCount = getNumber(latestPortfolioBatch ?? undefined, [
      "at_risk_count",
    ]);
    const migrationRepaymentCount = getNumber(
      latestPortfolioBatch ?? undefined,
      ["repayment_count"]
    );

    const migrationFundCount = getNumber(latestFundBatch ?? undefined, [
      "total_funds",
    ]);
    const migrationFundCommitted = getNumber(latestFundBatch ?? undefined, [
      "total_committed_capital",
    ]);
    const migrationAverageCarry = getNumber(latestFundBatch ?? undefined, [
      "average_carry",
    ]);

    const migrationComplianceItems = getNumber(
      latestComplianceBatch ?? undefined,
      ["total_items"]
    );
    const migrationComplianceReview = getNumber(
      latestComplianceBatch ?? undefined,
      ["pending_review_count"]
    );
    const migrationComplianceHighRisk = getNumber(
      latestComplianceBatch ?? undefined,
      ["high_risk_count"]
    );

    const migratedPortfolioCompanyNames = new Set(
      migratedPortfolioInvestments
        .map((row) => getString(row, ["portfolio_company"], ""))
        .filter(Boolean)
    );

    const migratedInvestmentCost = migratedPortfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["investment_cost"]),
      0
    );

    const migratedCurrentValue = migratedPortfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["current_value"]),
      0
    );

    const migratedRealizedValue = migratedPortfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["realised_value", "realized_value"]),
      0
    );

    const migratedExpectedExitValue = migratedPortfolioInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["expected_exit_value"]),
      0
    );

    const migratedAtRiskRows = migratedPortfolioInvestments.filter(
      (row) => getString(row, ["risk_status"], "") === "At Risk"
    ).length;

    const migratedRepaymentRows = migratedPortfolioInvestments.filter((row) =>
      Boolean(getString(row, ["repayment_due_date"], ""))
    ).length;

    const migratedComplianceReviewRows = migratedComplianceItems.filter((row) => {
      const status = getString(row, ["filing_status"], "").toLowerCase();

      return status === "pending" || status === "review" || status === "overdue";
    }).length;

    const migratedComplianceHighRiskRows = migratedComplianceItems.filter(
      (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
    ).length;

    const legacyTotalCommitted = commitments.reduce(
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

    const totalCommitted =
      migrationInvestorCommitment ||
      migrationFundCommitted ||
      legacyTotalCommitted;

    const approvedCapitalCalls = capitalCalls.filter(isApproved);
    const draftCapitalCalls = capitalCalls.filter(isDraft);

    const totalCalled = approvedCapitalCalls.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "capital_call_amount",
          "call_amount",
          "total_amount",
          "amount",
        ]),
      0
    );

    const approvedDistributions = distributions.filter(isApproved);
    const draftDistributions = distributions.filter(isDraft);

    const totalDistributed = approvedDistributions.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "distribution_amount",
          "total_distribution_amount",
          "amount",
        ]),
      0
    );

    const uncalledCapital = Math.max(totalCommitted - totalCalled, 0);

    const deploymentRate =
      totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0;

    const legacyStoredDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url", "storage_path"], ""))
    ).length;

    const storedDocuments = Math.max(
      legacyStoredDocuments,
      migrationPdfCount
    );

    const queuedEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "queued"
    ).length;

    const sentEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "sent"
    ).length;

    const highImpactCirculars = Math.max(
      regulatoryCirculars.filter(
        (row) => getString(row, ["impact"], "").toUpperCase() === "HIGH"
      ).length,
      migrationComplianceHighRisk,
      migratedComplianceHighRiskRows
    );

    const legacyInvestmentCost = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["original_investment_amount"]),
      0
    );

    const totalInvestmentCost =
      migrationPortfolioCost || migratedInvestmentCost || legacyInvestmentCost;

    const legacyCurrentFairValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["current_fair_value"]),
      0
    );

    const currentFairValue =
      migrationPortfolioValue || migratedCurrentValue || legacyCurrentFairValue;

    const legacyRealizedValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["realized_value"]),
      0
    );

    const realizedValue =
      migrationRealizedValue || migratedRealizedValue || legacyRealizedValue;

    const legacyUnrealizedValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["unrealized_value"]),
      0
    );

    const unrealizedValue =
      currentFairValue > 0 && totalInvestmentCost > 0
        ? currentFairValue - totalInvestmentCost
        : legacyUnrealizedValue;

    const latestFundMetric = fundPerformanceMetrics[0];

    const grossIrr = getNumber(latestFundMetric, ["gross_irr"]);
    const netIrr = getNumber(latestFundMetric, ["net_irr"]);
    const dpi = getNumber(latestFundMetric, ["dpi"]);
    const tvpi = getNumber(latestFundMetric, ["tvpi"]);
    const moic =
      migrationPortfolioMoic || getNumber(latestFundMetric, ["moic"]);
    const currentNav =
      getNumber(latestFundMetric, ["current_nav"]) ||
      currentFairValue ||
      migrationFundCommitted;

    const legacyUpcomingRepayments = debtRepayments.filter(
      (row) => getString(row, ["payment_status"], "") === "upcoming"
    ).length;

    const upcomingRepayments =
      migrationRepaymentCount || migratedRepaymentRows || legacyUpcomingRepayments;

    const overdueRepayments = debtRepayments.filter(
      (row) => getString(row, ["payment_status"], "") === "overdue"
    ).length;

    const openPortfolioAlerts = portfolioNewsAlerts.filter(
      (row) => getString(row, ["status"], "") === "open"
    ).length;

    const legacyHighRiskMetrics = portfolioCompanyMetrics.filter((row) => {
      const risk = getString(row, ["risk_rating"], "").toLowerCase();
      const performance = getString(
        row,
        ["performance_status"],
        ""
      ).toLowerCase();

      return risk === "high" || performance === "below_plan";
    }).length;

    const highRiskMetrics =
      migrationAtRiskCount || migratedAtRiskRows || legacyHighRiskMetrics;

    return {
      totalCommitted,
      totalCalled,
      totalDistributed,
      uncalledCapital,
      deploymentRate,
      activeFunds: migrationFundCount || funds.length,
      investors: migrationInvestorCount || investors.length,
      pendingCapitalCalls: draftCapitalCalls.length,
      pendingDistributions: draftDistributions.length,
      pendingRegulatoryReviews: Math.max(
        regulatoryMatches.length,
        migrationComplianceReview,
        migratedComplianceReviewRows
      ),
      generatedDocuments: Math.max(investorDocuments.length, migrationPdfCount),
      storedDocuments,
      queuedEmails,
      sentEmails,
      highImpactCirculars,

      totalInvestmentCost,
      currentFairValue,
      realizedValue,
      unrealizedValue,
      grossIrr,
      netIrr,
      dpi,
      tvpi,
      moic,
      currentNav,
      portfolioCompanies:
        migratedPortfolioCompanyNames.size ||
        migrationPortfolioCount ||
        portfolioCompanies.length,
      fundInvestments: migrationPortfolioCount || fundInvestments.length,
      upcomingRepayments,
      overdueRepayments,
      openPortfolioAlerts,
      highRiskMetrics,
      expectedExitValue:
        migrationExpectedExitValue || migratedExpectedExitValue,
      migrationPdfReviewCount,
      migrationAverageCarry,
      migrationComplianceItems,
    };
  }, [
    commitments,
    capitalCalls,
    distributions,
    funds,
    investors,
    investorDocuments,
    regulatoryMatches,
    regulatoryCirculars,
    fundInvestments,
    fundPerformanceMetrics,
    debtRepayments,
    portfolioNewsAlerts,
    portfolioCompanyMetrics,
    portfolioCompanies,
    latestInvestorBatch,
    latestPdfBatch,
    latestPortfolioBatch,
    latestFundBatch,
    latestComplianceBatch,
    migratedPortfolioInvestments,
    migratedComplianceItems,
  ]);
  const connectedActivityEvents = useMemo(() => {
    const events: ConnectedActivityEvent[] = [];

    capitalCalls.forEach((call) => {
      const status = getString(call, ["status"], "draft");
      const callAmount = getNumber(call, [
        "call_amount",
        "capital_call_amount",
        "total_amount",
        "amount",
      ]);

      events.push({
        id: `capital-call-${getId(call)}`,
        time: getString(call, ["created_at", "call_date"], ""),
        module: "Capital Call",
        title:
          status === "approved"
            ? "Capital call approved"
            : "Capital call draft created",
        description: `${getString(
          call,
          ["call_name", "name"],
          "Capital Call"
        )} • ${formatCurrencyCr(callAmount)}`,
        status,
      });
    });

    investorDocuments.forEach((documentRecord) => {
      const documentId = getId(documentRecord);
      const documentType = getString(
        documentRecord,
        ["document_type"],
        "Investor Document"
      );
      const documentName = getString(
        documentRecord,
        ["document_name"],
        "Investor Document"
      );
      const investorName = getString(
        documentRecord,
        ["investor_name"],
        "Investor"
      );
      const amount = getNumber(documentRecord, ["amount"]);
      const generatedAt = getString(documentRecord, ["generated_at"], "");

      events.push({
        id: `document-generated-${documentId}`,
        time: generatedAt,
        module: "Document Engine",
        title: `${documentType} generated`,
        description: `${documentName} for ${investorName} • ${formatCurrencyCr(
          amount
        )}`,
        status: getString(documentRecord, ["status"], "generated"),
      });

      if (getString(documentRecord, ["portal_status"], "") === "available") {
        events.push({
          id: `portal-${documentId}`,
          time: generatedAt,
          module: "Investor Portal",
          title: "Investor portal updated",
          description: `${documentType} made available to ${investorName}`,
          status: "available",
        });
      }

      if (getString(documentRecord, ["storage_url"], "")) {
        events.push({
          id: `vault-${documentId}`,
          time: generatedAt,
          module: "Document Vault",
          title: "PDF stored in portal vault",
          description: `${documentName} is stored and ready for investor access`,
          status: "stored",
        });
      }

      const emailStatus = getString(documentRecord, ["email_status"], "");

      if (emailStatus === "queued" || emailStatus === "sent") {
        events.push({
          id: `email-${documentId}`,
          time: generatedAt,
          module: "Email Dispatch",
          title:
            emailStatus === "sent"
              ? "Investor email marked sent"
              : "Investor email queued",
          description: `${documentName} email ${emailStatus} for ${getString(
            documentRecord,
            ["investor_email"],
            "investor"
          )}`,
          status: emailStatus,
        });
      }
    });

    dataRoomDocuments.forEach((documentRecord) => {
      const fileName = getString(documentRecord, ["file_name"], "Data room file");
      const detectedType = getString(
        documentRecord,
        ["detected_type"],
        "Investor Document"
      );
      const suggestedFolder = getString(
        documentRecord,
        ["suggested_folder"],
        "General Investor Documents"
      );

      events.push({
        id: `data-room-document-${getId(documentRecord)}`,
        time: getString(documentRecord, ["imported_at", "created_at"], ""),
        module: "Investor Data Room",
        title: "Data room document imported",
        description: `${fileName} classified as ${detectedType} and mapped to ${suggestedFolder}`,
        status: "data room imported",
      });
    });

    dataRoomEngagementEvents.forEach((engagement) => {
      const action = getString(engagement, ["action"], "Viewed");
      const investorName = getString(
        engagement,
        ["investor_name"],
        "Prospective LP"
      );
      const documentName = getString(
        engagement,
        ["document_name"],
        "data room document"
      );

      events.push({
        id: `data-room-engagement-${getId(engagement)}`,
        time: getString(engagement, ["event_time", "created_at"], ""),
        module: "LP Engagement",
        title:
          action === "Downloaded"
            ? "LP downloaded data room document"
            : action === "Asked Question"
            ? "LP asked data room question"
            : "LP viewed data room document",
        description: `${investorName} ${action.toLowerCase()} ${documentName}`,
        status: `data room ${action.toLowerCase()}`,
      });
    });

    dataRoomQuestions.forEach((question) => {
      const status = getString(question, ["status"], "Open");
      const investorName = getString(
        question,
        ["investor_name"],
        "Prospective LP"
      );
      const category = getString(question, ["category"], "DDQ");
      const documentName = getString(
        question,
        ["document_name"],
        "General Data Room Question"
      );

      events.push({
        id: `data-room-question-${getId(question)}`,
        time:
          status === "Answered"
            ? getString(question, ["answered_at", "asked_at", "created_at"], "")
            : getString(question, ["asked_at", "created_at"], ""),
        module: "DDQ Hub",
        title: status === "Answered" ? "DDQ question answered" : "DDQ question raised",
        description: `${category} — ${documentName} for ${investorName}`,
        status: status === "Answered" ? "ddq answered" : "ddq question open",
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [
    capitalCalls,
    investorDocuments,
    dataRoomDocuments,
    dataRoomEngagementEvents,
    dataRoomQuestions,
  ]);
  const dataRoomExecutiveMetrics = useMemo(() => {
    const portalReadyDocuments = investorDocuments.filter(
      (row) =>
        getString(row, ["portal_status"], "").toLowerCase() === "available"
    ).length;

    const storedDataRoomFiles = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url"], ""))
    ).length;

    const investorReportingDocuments = investorDocuments.filter((row) => {
      const documentType = getString(row, ["document_type", "type"], "")
        .toLowerCase();
      const documentName = getString(row, ["document_name", "name"], "")
        .toLowerCase();

      return (
        documentType.includes("notice") ||
        documentType.includes("report") ||
        documentType.includes("soa") ||
        documentType.includes("certificate") ||
        documentName.includes("notice") ||
        documentName.includes("report") ||
        documentName.includes("soa") ||
        documentName.includes("certificate")
      );
    }).length;

    const importedDataRoomDocuments = dataRoomDocuments.length;
    const lpEngagementEvents = dataRoomEngagementEvents.length;

    const openDDQQuestions = dataRoomQuestions.filter(
      (question) => getString(question, ["status"], "Open") !== "Answered"
    ).length;

    const answeredDDQQuestions = dataRoomQuestions.filter(
      (question) => getString(question, ["status"], "Open") === "Answered"
    ).length;

    const importedFolderSet = new Set(
      dataRoomDocuments.map((documentRecord) =>
        getString(documentRecord, ["suggested_folder"], "")
      )
    );

    const readinessScore = Math.min(
      95,
      Math.max(
        0,
        55 +
          Math.min(20, importedDataRoomDocuments * 4) +
          Math.min(10, lpEngagementEvents * 2) +
          Math.min(12, answeredDDQQuestions * 3) -
          Math.min(10, openDDQQuestions * 2) +
          (importedFolderSet.has("Fund Overview") ? 5 : 0) +
          (importedFolderSet.has("Legal & Compliance") ? 5 : 0) +
          (importedFolderSet.has("Track Record & Performance") ? 5 : 0) +
          (importedFolderSet.has("Investor Reporting Samples") ? 5 : 0)
      )
    );

    const diligenceStatus =
      openDDQQuestions > 0
        ? "Action needed"
        : readinessScore >= 80
        ? "Ready"
        : "Needs review";

    const recommendedAction =
      openDDQQuestions > 0
        ? `Answer ${openDDQQuestions} open DDQ question${
            openDDQQuestions === 1 ? "" : "s"
          }`
        : importedDataRoomDocuments === 0
        ? "Import data room documents"
        : lpEngagementEvents === 0
        ? "Track LP engagement"
        : "Continue monitoring LP diligence";

    return {
      readinessScore,
      portalReadyDocuments,
      storedDataRoomFiles,
      investorReportingDocuments,
      importedDataRoomDocuments,
      openDDQQuestions,
      answeredDDQQuestions,
      lpEngagementEvents,
      investorRecords: investors.length,
      diligenceStatus,
      recommendedAction,
    };
  }, [
    investorDocuments,
    investors,
    dataRoomDocuments,
    dataRoomEngagementEvents,
    dataRoomQuestions,
  ]);
  const fundRows = useMemo(() => {
    return funds.map((fund) => {
      const fundId = getId(fund);

      const fundCommitments = commitments.filter(
        (row) => getString(row, ["fund_id"], "") === fundId
      );

      const fundCapitalCalls = capitalCalls.filter(
        (row) => getString(row, ["fund_id"], "") === fundId
      );

      const fundDistributions = distributions.filter(
        (row) => getString(row, ["fund_id"], "") === fundId
      );

      const fundMetric = fundPerformanceMetrics.find(
        (row) => getString(row, ["fund_id"], "") === fundId
      );

      const fundInvestmentRows = fundInvestments.filter(
        (row) => getString(row, ["fund_id"], "") === fundId
      );

      const committed = fundCommitments.reduce(
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

      const called = fundCapitalCalls
        .filter(isApproved)
        .reduce(
          (sum, row) =>
            sum +
            getNumber(row, [
              "capital_call_amount",
              "call_amount",
              "total_amount",
              "amount",
            ]),
          0
        );

      const distributed = fundDistributions
        .filter(isApproved)
        .reduce(
          (sum, row) =>
            sum +
            getNumber(row, [
              "distribution_amount",
              "total_distribution_amount",
              "amount",
            ]),
          0
        );

      const deploymentRate = committed > 0 ? (called / committed) * 100 : 0;

      return {
        id: fundId,
        name: getString(fund, ["fund_name", "name", "title"], "Unnamed Fund"),
        startDate: formatDate(fund["fund_start_date"] ?? fund["start_date"]),
        committed,
        called,
        distributed,
        dryPowder: Math.max(committed - called, 0),
        deploymentRate,
        investors: fundCommitments.length,
        grossIrr: getNumber(fundMetric, ["gross_irr"]),
        netIrr: getNumber(fundMetric, ["net_irr"]),
        dpi: getNumber(fundMetric, ["dpi"]),
        tvpi: getNumber(fundMetric, ["tvpi"]),
        currentNav: getNumber(fundMetric, ["current_nav"]),
        investments: fundInvestmentRows.length,
      };
    });
  }, [
    funds,
    commitments,
    capitalCalls,
    distributions,
    fundPerformanceMetrics,
    fundInvestments,
  ]);

  const upcomingRepaymentRows = useMemo(() => {
    return debtRepayments
      .filter((row) => getString(row, ["payment_status"], "") === "upcoming")
      .slice(0, 5);
  }, [debtRepayments]);

  const portfolioAlertRows = useMemo(() => {
    return portfolioNewsAlerts
      .filter((row) => getString(row, ["status"], "") === "open")
      .slice(0, 6);
  }, [portfolioNewsAlerts]);

  const portfolioRiskRows = useMemo(() => {
    return portfolioCompanyMetrics
      .filter((row) => {
        const risk = getString(row, ["risk_rating"], "").toLowerCase();
        const performance = getString(row, ["performance_status"], "").toLowerCase();

        return risk === "high" || performance === "below_plan" || performance === "watchlist";
      })
      .slice(0, 5);
  }, [portfolioCompanyMetrics]);

  const selectedDeckFund =
    selectedDeckFundId === "all"
      ? null
      : fundRows.find((fund) => fund.id === selectedDeckFundId);

  const selectedMetricCount = Object.values(selectedDeckMetrics).filter(Boolean)
    .length;
const deckScopeName = selectedDeckFund?.name ?? "All Funds";

const deckPreviewSections: {
  title: string;
  subtitle: string;
  highlights: string[];
  narrative: string;
}[] = [];

if (selectedDeckMetrics.fundOverview) {
  deckPreviewSections.push({
    title: "Fund Overview",
    subtitle: deckScopeName,
    highlights: [
      `${dashboardMetrics.activeFunds} active funds`,
      `${dashboardMetrics.portfolioCompanies} portfolio companies`,
      `${dashboardMetrics.fundInvestments} tracked investments`,
      `${formatCurrencyCr(dashboardMetrics.currentNav)} current NAV`,
    ],
    narrative:
      "VENTIQ will introduce the selected fund scope, current platform coverage, fund base, portfolio base and latest NAV position.",
  });
}

if (selectedDeckMetrics.fundPerformance) {
  deckPreviewSections.push({
    title: "Fund Performance",
    subtitle: "IRR / DPI / TVPI / MOIC",
    highlights: [
      `${formatPercent(dashboardMetrics.grossIrr)} Gross IRR`,
      `${formatPercent(dashboardMetrics.netIrr)} Net IRR`,
      `${formatMultiple(dashboardMetrics.dpi)} DPI`,
      `${formatMultiple(dashboardMetrics.tvpi)} TVPI`,
    ],
    narrative:
      "VENTIQ will summarize fund performance using key LP-facing metrics including gross IRR, net IRR, DPI, TVPI and MOIC.",
  });
}

if (selectedDeckMetrics.portfolioPerformance) {
  deckPreviewSections.push({
    title: "Portfolio Performance",
    subtitle: "Company-level intelligence",
    highlights: [
      `${formatCurrencyCr(dashboardMetrics.totalInvestmentCost)} investment cost`,
      `${formatCurrencyCr(dashboardMetrics.currentFairValue)} current fair value`,
      `${formatCurrencyCr(dashboardMetrics.realizedValue)} realized value`,
      `${formatCurrencyCr(dashboardMetrics.unrealizedValue)} unrealized value`,
    ],
    narrative:
      "VENTIQ will show portfolio-level performance, valuation movement, realized value, unrealized value and investment-side commentary.",
  });
}

if (selectedDeckMetrics.deployment) {
  deckPreviewSections.push({
    title: "Deployment & Dry Powder",
    subtitle: "Capital deployment snapshot",
    highlights: [
      `${formatCurrencyCr(dashboardMetrics.totalCommitted)} committed capital`,
      `${formatCurrencyCr(dashboardMetrics.totalCalled)} called capital`,
      `${formatCurrencyCr(dashboardMetrics.uncalledCapital)} dry powder`,
      `${formatPercent(dashboardMetrics.deploymentRate)} deployment rate`,
    ],
    narrative:
      "VENTIQ will explain capital deployment pace, uncalled capital, available dry powder and whether deployment is on track.",
  });
}

if (selectedDeckMetrics.capitalCalls) {
  deckPreviewSections.push({
    title: "Capital Calls",
    subtitle: "Investor funding workflow",
    highlights: [
      `${dashboardMetrics.pendingCapitalCalls} drafts pending review`,
      `${formatCurrencyCr(dashboardMetrics.totalCalled)} approved called capital`,
      `${dashboardMetrics.investors} investors tracked`,
      "Capital call workflow connected",
    ],
    narrative:
      "VENTIQ will summarize capital call activity, pending approvals and investor funding readiness.",
  });
}

if (selectedDeckMetrics.distributions) {
  deckPreviewSections.push({
    title: "Distributions",
    subtitle: "Money returned to investors",
    highlights: [
      `${formatCurrencyCr(dashboardMetrics.totalDistributed)} approved distributions`,
      `${dashboardMetrics.pendingDistributions} distribution drafts pending`,
      `${formatMultiple(dashboardMetrics.dpi)} DPI`,
      "Distribution waterfall workflow connected",
    ],
    narrative:
      "VENTIQ will present distribution activity, DPI impact and approved money returned to investors.",
  });
}

if (selectedDeckMetrics.investorDocuments) {
  deckPreviewSections.push({
    title: "Investor Document Status",
    subtitle: "Document generation and dispatch",
    highlights: [
      `${dashboardMetrics.generatedDocuments} documents generated`,
      `${dashboardMetrics.storedDocuments} stored PDFs`,
      `${dashboardMetrics.queuedEmails} queued emails`,
      `${dashboardMetrics.sentEmails} sent emails`,
    ],
    narrative:
      "VENTIQ will show investor communication readiness, generated documents, stored PDFs and dispatch status.",
  });
}

if (selectedDeckMetrics.regulatoryUpdates) {
  deckPreviewSections.push({
    title: "Regulatory Updates",
    subtitle: "Knowledge Hub intelligence",
    highlights: [
      `${dashboardMetrics.pendingRegulatoryReviews} pending regulatory reviews`,
      `${dashboardMetrics.highImpactCirculars} high-impact circulars`,
      "Source monitor connected",
      "Review-before-approval workflow enabled",
    ],
    narrative:
      "VENTIQ will highlight regulatory items requiring attention and summarize Knowledge Hub readiness for LP and compliance reporting.",
  });
}

if (selectedDeckMetrics.repaymentSchedule) {
  deckPreviewSections.push({
    title: "Debt Repayment Schedule",
    subtitle: "Upcoming repayment visibility",
    highlights: [
      `${dashboardMetrics.upcomingRepayments} upcoming repayments`,
      `${dashboardMetrics.overdueRepayments} overdue repayments`,
      "Repayment notice workflow planned",
      "Debt deal tracking connected",
    ],
    narrative:
      "VENTIQ will summarize upcoming debt repayments, overdue amounts and repayment notice readiness for finance teams.",
  });
}

if (selectedDeckMetrics.portfolioNews) {
  deckPreviewSections.push({
    title: "Portfolio News & Alerts",
    subtitle: "Company-level updates",
    highlights: [
      `${dashboardMetrics.openPortfolioAlerts} open portfolio alerts`,
      `${dashboardMetrics.highRiskMetrics} high-risk / watchlist items`,
      `${portfolioAlertRows.length} alerts in preview`,
      "News and internal update tracking connected",
    ],
    narrative:
      "VENTIQ will include portfolio company developments, business updates, risks and alerts relevant for LP storytelling.",
  });
}

if (selectedDeckMetrics.lpNarrative) {
  deckPreviewSections.push({
    title: "LP Narrative",
    subtitle: "Investor-facing story",
    highlights: [
      "Fund performance summary",
      "Portfolio progress",
      "Regulatory readiness",
      "Next fund / fundraising narrative",
    ],
    narrative:
      "VENTIQ will generate a structured LP-facing narrative using fund metrics, portfolio developments and operational progress.",
  });
}

if (selectedDeckMetrics.exitPipeline) {
  deckPreviewSections.push({
    title: "Exit Pipeline",
    subtitle: "Expected realization opportunities",
    highlights: [
      "Projected exit timing",
      "Expected exit value",
      "MOIC and IRR impact",
      "Exit readiness commentary",
    ],
    narrative:
      "VENTIQ will summarize exit-ready investments, expected exit timing and potential impact on fund-level returns.",
  });
}

if (selectedDeckMetrics.riskSummary) {
  deckPreviewSections.push({
    title: "Portfolio Risk Summary",
    subtitle: "Companies requiring attention",
    highlights: [
      `${dashboardMetrics.highRiskMetrics} high-risk / watchlist items`,
      `${dashboardMetrics.openPortfolioAlerts} open alerts`,
      `${dashboardMetrics.overdueRepayments} overdue repayments`,
      "Partner attention queue connected",
    ],
    narrative:
      "VENTIQ will highlight companies, repayments and regulatory items that require Managing Partner attention.",
  });
}
  function toggleDeckMetric(metricKey: DeckMetricKey) {
    setSelectedDeckMetrics((current) => ({
      ...current,
      [metricKey]: !current[metricKey],
    }));
  }
  function getEditableNarrative(sectionTitle: string, defaultNarrative: string) {
  return editedDeckNarratives[sectionTitle] ?? defaultNarrative;
}

function updateDeckNarrative(sectionTitle: string, narrative: string) {
  setEditedDeckNarratives((current) => ({
    ...current,
    [sectionTitle]: narrative,
  }));
}

function resetDeckNarrative(sectionTitle: string) {
  setEditedDeckNarratives((current) => {
    const updated = { ...current };
    delete updated[sectionTitle];
    return updated;
  });
}
function getDeckSlideOption(sectionTitle: string): DeckSlideOption {
  return (
    deckSlideOptions[sectionTitle] ?? {
      includeHighlights: true,
      includeNarrative: true,
      includeChart: true,
    }
  );
}

function toggleDeckSlideOption(
  sectionTitle: string,
  optionName: keyof DeckSlideOption
) {
  setDeckSlideOptions((current) => {
    const currentOption =
      current[sectionTitle] ?? {
        includeHighlights: true,
        includeNarrative: true,
        includeChart: true,
      };

    return {
      ...current,
      [sectionTitle]: {
        ...currentOption,
        [optionName]: !currentOption[optionName],
      },
    };
  });
}

function toCrValue(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Number((value / 10000000).toFixed(1));
}

function getSectionChart(sectionTitle: string): DeckChart | null {
  if (sectionTitle === "Fund Overview") {
    return {
      title: "Fund and portfolio coverage",
      unit: "Count",
      items: [
        {
          label: "Funds",
          value: dashboardMetrics.activeFunds,
          displayValue: String(dashboardMetrics.activeFunds),
        },
        {
          label: "Companies",
          value: dashboardMetrics.portfolioCompanies,
          displayValue: String(dashboardMetrics.portfolioCompanies),
        },
        {
          label: "Investments",
          value: dashboardMetrics.fundInvestments,
          displayValue: String(dashboardMetrics.fundInvestments),
        },
        {
          label: "Investors",
          value: dashboardMetrics.investors,
          displayValue: String(dashboardMetrics.investors),
        },
      ],
    };
  }

  if (sectionTitle === "Fund Performance") {
    return {
      title: "Key return metrics",
      unit: "Metric value",
      items: [
        {
          label: "Gross IRR",
          value: dashboardMetrics.grossIrr,
          displayValue: formatPercent(dashboardMetrics.grossIrr),
        },
        {
          label: "Net IRR",
          value: dashboardMetrics.netIrr,
          displayValue: formatPercent(dashboardMetrics.netIrr),
        },
        {
          label: "DPI",
          value: dashboardMetrics.dpi * 100,
          displayValue: formatMultiple(dashboardMetrics.dpi),
        },
        {
          label: "TVPI",
          value: dashboardMetrics.tvpi * 100,
          displayValue: formatMultiple(dashboardMetrics.tvpi),
        },
      ],
    };
  }

  if (sectionTitle === "Portfolio Performance") {
    return {
      title: "Portfolio value bridge",
      unit: "₹ Cr",
      items: [
        {
          label: "Cost",
          value: toCrValue(dashboardMetrics.totalInvestmentCost),
          displayValue: formatCurrencyCr(dashboardMetrics.totalInvestmentCost),
        },
        {
          label: "Fair value",
          value: toCrValue(dashboardMetrics.currentFairValue),
          displayValue: formatCurrencyCr(dashboardMetrics.currentFairValue),
        },
        {
          label: "Realized",
          value: toCrValue(dashboardMetrics.realizedValue),
          displayValue: formatCurrencyCr(dashboardMetrics.realizedValue),
        },
        {
          label: "Unrealized",
          value: toCrValue(dashboardMetrics.unrealizedValue),
          displayValue: formatCurrencyCr(dashboardMetrics.unrealizedValue),
        },
      ],
    };
  }

  if (sectionTitle === "Deployment & Dry Powder") {
    return {
      title: "Capital deployment",
      unit: "₹ Cr",
      items: [
        {
          label: "Committed",
          value: toCrValue(dashboardMetrics.totalCommitted),
          displayValue: formatCurrencyCr(dashboardMetrics.totalCommitted),
        },
        {
          label: "Called",
          value: toCrValue(dashboardMetrics.totalCalled),
          displayValue: formatCurrencyCr(dashboardMetrics.totalCalled),
        },
        {
          label: "Dry powder",
          value: toCrValue(dashboardMetrics.uncalledCapital),
          displayValue: formatCurrencyCr(dashboardMetrics.uncalledCapital),
        },
      ],
    };
  }

  if (sectionTitle === "Capital Calls") {
    return {
      title: "Capital call status",
      unit: "Count / ₹ Cr",
      items: [
        {
          label: "Pending drafts",
          value: dashboardMetrics.pendingCapitalCalls,
          displayValue: String(dashboardMetrics.pendingCapitalCalls),
        },
        {
          label: "Called capital",
          value: toCrValue(dashboardMetrics.totalCalled),
          displayValue: formatCurrencyCr(dashboardMetrics.totalCalled),
        },
        {
          label: "Investors",
          value: dashboardMetrics.investors,
          displayValue: String(dashboardMetrics.investors),
        },
      ],
    };
  }

  if (sectionTitle === "Distributions") {
    return {
      title: "Distribution status",
      unit: "₹ Cr / Multiple",
      items: [
        {
          label: "Distributed",
          value: toCrValue(dashboardMetrics.totalDistributed),
          displayValue: formatCurrencyCr(dashboardMetrics.totalDistributed),
        },
        {
          label: "Pending drafts",
          value: dashboardMetrics.pendingDistributions,
          displayValue: String(dashboardMetrics.pendingDistributions),
        },
        {
          label: "DPI",
          value: dashboardMetrics.dpi * 100,
          displayValue: formatMultiple(dashboardMetrics.dpi),
        },
      ],
    };
  }

  if (sectionTitle === "Investor Document Status") {
    return {
      title: "Investor communication status",
      unit: "Count",
      items: [
        {
          label: "Generated",
          value: dashboardMetrics.generatedDocuments,
          displayValue: String(dashboardMetrics.generatedDocuments),
        },
        {
          label: "Stored PDFs",
          value: dashboardMetrics.storedDocuments,
          displayValue: String(dashboardMetrics.storedDocuments),
        },
        {
          label: "Queued",
          value: dashboardMetrics.queuedEmails,
          displayValue: String(dashboardMetrics.queuedEmails),
        },
        {
          label: "Sent",
          value: dashboardMetrics.sentEmails,
          displayValue: String(dashboardMetrics.sentEmails),
        },
      ],
    };
  }

  if (sectionTitle === "Regulatory Updates") {
    return {
      title: "Regulatory workload",
      unit: "Count",
      items: [
        {
          label: "Pending reviews",
          value: dashboardMetrics.pendingRegulatoryReviews,
          displayValue: String(dashboardMetrics.pendingRegulatoryReviews),
        },
        {
          label: "High impact",
          value: dashboardMetrics.highImpactCirculars,
          displayValue: String(dashboardMetrics.highImpactCirculars),
        },
      ],
    };
  }

  if (sectionTitle === "Debt Repayment Schedule") {
    return {
      title: "Repayment monitoring",
      unit: "Count",
      items: [
        {
          label: "Upcoming",
          value: dashboardMetrics.upcomingRepayments,
          displayValue: String(dashboardMetrics.upcomingRepayments),
        },
        {
          label: "Overdue",
          value: dashboardMetrics.overdueRepayments,
          displayValue: String(dashboardMetrics.overdueRepayments),
        },
      ],
    };
  }

  if (sectionTitle === "Portfolio News & Alerts") {
    return {
      title: "Portfolio alert status",
      unit: "Count",
      items: [
        {
          label: "Open alerts",
          value: dashboardMetrics.openPortfolioAlerts,
          displayValue: String(dashboardMetrics.openPortfolioAlerts),
        },
        {
          label: "High-risk items",
          value: dashboardMetrics.highRiskMetrics,
          displayValue: String(dashboardMetrics.highRiskMetrics),
        },
        {
          label: "Preview alerts",
          value: portfolioAlertRows.length,
          displayValue: String(portfolioAlertRows.length),
        },
      ],
    };
  }

  if (sectionTitle === "Portfolio Risk Summary") {
    return {
      title: "Risk summary",
      unit: "Count",
      items: [
        {
          label: "High-risk",
          value: dashboardMetrics.highRiskMetrics,
          displayValue: String(dashboardMetrics.highRiskMetrics),
        },
        {
          label: "Open alerts",
          value: dashboardMetrics.openPortfolioAlerts,
          displayValue: String(dashboardMetrics.openPortfolioAlerts),
        },
        {
          label: "Overdue",
          value: dashboardMetrics.overdueRepayments,
          displayValue: String(dashboardMetrics.overdueRepayments),
        },
      ],
    };
  }

  return null;
}

  function handlePreparePowerPoint() {
    const targetFund = selectedDeckFund?.name ?? "All Funds";

   const editedNarrativeCount = Object.keys(editedDeckNarratives).length;

setDeckMessage(
  `Presentation brief prepared for ${targetFund} with ${selectedMetricCount} selected sections and ${editedNarrativeCount} edited slide narratives. Actual PPT generation will be connected in Phase 5.3.`
);
  }
  function handleEditSlideNarrative() {
  const firstNarrativeEditor = document.querySelector<HTMLTextAreaElement>(
    ".lp-deck-narrative-editor textarea"
  );

  if (firstNarrativeEditor) {
    firstNarrativeEditor.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    firstNarrativeEditor.focus();
  }

  setDeckMessage(
    "Slide narratives are editable directly inside each slide preview. Update any narrative box, then click Prepare PowerPoint Brief."
  );
}

async function handleGeneratePowerPoint() {
  if (deckPreviewSections.length === 0) {
    setDeckMessage("Select at least one section before generating PowerPoint.");
    return;
  }

  setDeckMessage("Generating PowerPoint presentation...");

  try {
    const response = await fetch("/api/lp-deck/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  deckScopeName,
  themeKey: selectedDeckTheme,
  layoutKey: selectedDeckLayout,
  includeExecutiveSummary,
  generatedAt: new Date().toISOString(),
  sections: deckPreviewSections.map((section) => {
  const slideOption = getDeckSlideOption(section.title);
  const sectionChart = getSectionChart(section.title);

  return {
    title: section.title,
    subtitle: section.subtitle,
    highlights: slideOption.includeHighlights ? section.highlights : [],
    narrative: slideOption.includeNarrative
      ? getEditableNarrative(section.title, section.narrative)
      : "",
    includeHighlights: slideOption.includeHighlights,
    includeNarrative: slideOption.includeNarrative,
    includeChart: slideOption.includeChart,
    chart: slideOption.includeChart ? sectionChart : null,
  };
}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(
        errorBody?.error || "Could not generate PowerPoint presentation."
      );
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `${deckScopeName
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()}-investor-presentation.pptx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);

    setDeckMessage(
      `PowerPoint generated successfully for ${deckScopeName} with ${deckPreviewSections.length} slides.`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown PowerPoint error.";

    setDeckMessage(`PowerPoint generation failed: ${errorMessage}`);
  }
}

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Managing Partner Command Center</h1>
                      <p>
              Live executive dashboard for fund performance, portfolio
              intelligence, repayment schedules, investor communication, data
              room activity, DDQ movement, regulatory alerts and LP storytelling.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div
          className="preview-card"
          style={{ marginBottom: 18, padding: 22 }}
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Active Fund Context</p>
              <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
              <p style={{ margin: 0 }}>
                Activation status: <strong>{fundActivationStatus}</strong>
                {fundActivatedAt
                  ? ` · Activated ${formatDateTime(fundActivatedAt)}`
                  : ""}
                {fundActivatedBy ? ` by ${fundActivatedBy}` : ""}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6, minWidth: 270 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  Switch active fund
                </span>
                <select
                  aria-label="Select active fund"
                  disabled={!fundContextReady || loading}
                  onChange={(event) => setActiveFundName(event.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    color: "#f8fafc",
                    minHeight: 42,
                    padding: "0 12px",
                  }}
                  value={activeFundName}
                >
                  {availableFunds.map((fundName) => (
                    <option key={fundName} value={fundName}>
                      {fundName}
                    </option>
                  ))}
                </select>
              </label>

              <a
                className="monitor-btn monitor-btn-secondary"
                href="/migration/activation"
              >
                Open Fund Activation
              </a>
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {activeFundName} · {fundActivationStatus} · Executive workspace reading
          only this fund&apos;s activated migrated and workflow records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Managing Partner Workspace...</h2>
            <p>
              VENTIQ is preparing the sample fund performance, portfolio,
              compliance and workflow intelligence view.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus !== "Active" && (
            <div className="preview-card">
              <p className="eyebrow">Activation Required</p>
              <h2>{activeFundName} is not active across VENTIQ</h2>
              <div className="explain-box">
                The Managing Partner Command Center is locked because this fund
                has not completed the controlled activation process. Complete
                data readiness, maker-checker approval and fund activation before
                executive metrics, portfolio intelligence and LP narratives use
                the migrated operating data.
              </div>
              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/activation"
                >
                  Complete Fund Activation
                </a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/data-intake"
                >
                  Open Data Intake
                </a>
              </div>
            </div>
          )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus === "Active" && (
          <>
            <div className="preview-card">
  <div className="section-heading-row">
    <div>
      <p className="eyebrow">Migration Data Connected</p>
      <h2>Live migrated data is now powering this dashboard</h2>
    </div>

    <button
      className="monitor-btn monitor-btn-secondary"
      onClick={loadManagingPartnerDashboard}
      type="button"
    >
      Refresh Dashboard Data
    </button>
  </div>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>{migratedInvestorMaster.length}</h3>
      <p>Investor master records</p>
    </div>

    <div className="impact-card">
      <h3>{migratedFundCommitments.length}</h3>
      <p>Commitment records</p>
    </div>

    <div className="impact-card">
      <h3>{migratedPortfolioInvestments.length}</h3>
      <p>Portfolio records</p>
    </div>

    <div className="impact-card">
      <h3>{investorDocuments.length}</h3>
      <p>Published investor PDFs</p>
    </div>
  </div>

  <div className="explain-box">
    This page reads only the activated records for {activeFundName} from
    investor_master, fund_commitments, investor_financial_positions,
    portfolio_investments, compliance_items and investor_documents. The same
    fund context is shared with Migration Activation and the Finance Head Workspace.
  </div>
</div>
            <div className="preview-card">
              <h2>Managing Partner Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {dashboardMetrics.activeFunds} active funds,{" "}
                {dashboardMetrics.portfolioCompanies} portfolio companies,{" "}
                {dashboardMetrics.fundInvestments} investments,{" "}
                {formatCurrencyCr(dashboardMetrics.currentNav)} current NAV,{" "}
                             {dashboardMetrics.upcomingRepayments} upcoming repayments,{" "}
                {dashboardMetrics.openPortfolioAlerts} open portfolio alerts and{" "}
                {dataRoomExecutiveMetrics.openDDQQuestions} open DDQ questions.
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/portfolio-intelligence">
                  Open Portfolio Intelligence
                </a>
                <a className="monitor-btn monitor-btn-secondary" href="/knowledge-hub">
                  Review Regulatory Alerts
                </a>
                <a className="monitor-btn monitor-btn-secondary" href="/document-engine">
                  Review Investor Documents
                </a>
                                <a className="monitor-btn monitor-btn-secondary" href="/data-room">
                  Review Data Room
                </a>
                <a className="monitor-btn monitor-btn-secondary" href="/repayment-notice">
  Generate Repayment Notice
</a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  View Migration Readiness
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/stakeholder-launch"
                >
                  Launch Stakeholder Dashboards
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatPercent(dashboardMetrics.grossIrr)}</h3>
                <p>Gross IRR</p>
              </div>

              <div className="impact-card">
                <h3>{formatPercent(dashboardMetrics.netIrr)}</h3>
                <p>Net IRR</p>
              </div>

              <div className="impact-card">
                <h3>{formatMultiple(dashboardMetrics.dpi)}</h3>
                <p>DPI</p>
              </div>

              <div className="impact-card">
                <h3>{formatMultiple(dashboardMetrics.tvpi)}</h3>
                <p>TVPI</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.currentNav)}</h3>
                <p>Current NAV</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.totalInvestmentCost)}</h3>
                <p>Total investment cost</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.realizedValue)}</h3>
                <p>Realized value</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.unrealizedValue)}</h3>
                <p>Unrealized value</p>
              </div>
            </div>
            <div className="preview-card">
              <div className="source-monitor-header">
                <div>
                  <h2>Today&apos;s Connected Fund Activity</h2>
                  <p>
                    Live activity from Capital Call, Document Engine, Investor
                    Portal, Document Vault, Email Dispatch, Data Room, LP
                    Engagement and DDQ Hub.
                  </p>
                </div>

                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/activity-engine"
                >
                  Open Activity Engine
                </a>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{connectedActivityEvents.length}</h3>
                  <p>Workflow evidence points</p>
                </div>

                <div className="impact-card">
                  <h3>{dashboardMetrics.generatedDocuments}</h3>
                  <p>Documents generated</p>
                </div>

                <div className="impact-card">
                  <h3>{dashboardMetrics.storedDocuments}</h3>
                  <p>Stored PDFs</p>
                </div>

                <div className="impact-card">
                  <h3>{dataRoomExecutiveMetrics.lpEngagementEvents}</h3>
                  <p>Data room engagement</p>
                </div>
              </div>

              {connectedActivityEvents.length === 0 && (
                <div className="explain-box">
                  No connected fund activity found yet. Approve a capital call,
                  generate notices in Document Engine and publish them to the
                  Investor Portal to create the first activity trail.
                </div>
              )}

              {connectedActivityEvents.length > 0 && (
                <div className="audit-timeline">
                  {connectedActivityEvents.slice(0, 8).map((event) => (
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

              <div className="explain-box">
                This gives the Managing Partner a live operating view of the
                connected VENTIQ loop: Finance approval, document generation,
                investor portal visibility, storage status, email dispatch,
                data room activity, DDQ movement and audit evidence.
              </div>
            </div>
            <div className="preview-card">
              <h2>LP Diligence & Data Room Intelligence</h2>

              <div className="explain-box">
                VENTIQ now brings Data Room, DDQ and LP diligence movement into
                the Managing Partner view. This helps the MP understand whether
                fundraising conversations, investor follow-ups and diligence
                readiness are moving forward.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{dataRoomExecutiveMetrics.readinessScore}%</h3>
                  <p>Data room readiness</p>
                </div>

                <div className="impact-card">
                  <h3>{dataRoomExecutiveMetrics.openDDQQuestions}</h3>
                  <p>Open DDQ questions</p>
                </div>

                <div className="impact-card">
                  <h3>{dataRoomExecutiveMetrics.lpEngagementEvents}</h3>
                  <p>LP engagement events</p>
                </div>

                <div className="impact-card">
                  <h3>{dataRoomExecutiveMetrics.diligenceStatus}</h3>
                  <p>Diligence status</p>
                </div>
              </div>

              <div className="queue-grid">
                <div className="queue-item">
                  🗂️ <strong>Investor Data Room</strong>
                  <br />
                  {dataRoomExecutiveMetrics.importedDataRoomDocuments} imported files,{" "}
                  {dataRoomExecutiveMetrics.portalReadyDocuments} portal-ready
                  investor documents
                </div>

                <div className="queue-item">
                  ❓ <strong>DDQ Hub</strong>
                  <br />
                  {dataRoomExecutiveMetrics.openDDQQuestions} open questions,{" "}
                  {dataRoomExecutiveMetrics.answeredDDQQuestions} answered
                  responses
                </div>

                <div className="queue-item">
                  👁️ <strong>LP Engagement</strong>
                  <br />
                  {dataRoomExecutiveMetrics.lpEngagementEvents} tracked views,
                  downloads and diligence actions
                </div>

                <div className="queue-item">
                  📄 <strong>Investor Reporting</strong>
                  <br />
                  {dataRoomExecutiveMetrics.investorReportingDocuments}
                  investor-facing reporting records available
                </div>
              </div>

              <div className="explain-box">
                <strong>Executive action:</strong>{" "}
                {dataRoomExecutiveMetrics.recommendedAction}
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/data-room">
                  Open Data Room
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/fundraising-ai"
                >
                  Open IR Workspace
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/activity-engine"
                >
                  View Activity Trail
                </a>
              </div>
            </div>
                       <div className="preview-card">
              <h2>Executive Attention Queue</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  🟡 <strong>Capital Calls</strong>
                  <br />
                  {dashboardMetrics.pendingCapitalCalls} drafts pending review
                </div>

                <div className="queue-item">
                  🟡 <strong>Distributions</strong>
                  <br />
                  {dashboardMetrics.pendingDistributions} drafts pending review
                </div>

                <div className="queue-item">
                  🔵 <strong>Debt Repayments</strong>
                  <br />
                  {dashboardMetrics.upcomingRepayments} upcoming,{" "}
                  {dashboardMetrics.overdueRepayments} overdue
                </div>

                <div className="queue-item">
                  🔴 <strong>Portfolio Alerts</strong>
                  <br />
                  {dashboardMetrics.openPortfolioAlerts} open alerts,{" "}
                  {dashboardMetrics.highRiskMetrics} high-risk / watchlist items
                </div>

                <div className="queue-item">
                  🔵 <strong>Investor Documents</strong>
                  <br />
                  {dashboardMetrics.generatedDocuments} generated documents,{" "}
                  {dashboardMetrics.storedDocuments} stored PDFs
                </div>
                                <div className="queue-item">
                  🗂️ <strong>LP Diligence</strong>
                  <br />
                  {dataRoomExecutiveMetrics.openDDQQuestions} DDQ questions open,{" "}
                  {dataRoomExecutiveMetrics.readinessScore}% data room readiness
                </div>

                <div className="queue-item">
                  🔴 <strong>Regulatory Review</strong>
                  <br />
                  {dashboardMetrics.pendingRegulatoryReviews} source matches need
                  review, {dashboardMetrics.highImpactCirculars} high-impact
                  circulars active
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Fund Performance Snapshot</h2>

              {fundRows.length === 0 && (
                <div className="explain-box">
                  No funds found yet. Add funds and commitments to unlock the
                  full Managing Partner dashboard.
                </div>
              )}

              {fundRows.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Fund</th>
                        <th>Start Date</th>
                        <th>Committed</th>
                        <th>Dry Powder</th>
                        <th>Current NAV</th>
                        <th>Gross IRR</th>
                        <th>Net IRR</th>
                        <th>DPI</th>
                        <th>TVPI</th>
                        <th>Deals</th>
                      </tr>
                    </thead>

                    <tbody>
                      {fundRows.map((fund) => (
                        <tr key={fund.id || fund.name}>
                          <td>
                            <strong>{fund.name}</strong>
                          </td>
                          <td>{fund.startDate}</td>
                          <td>{formatCurrencyCr(fund.committed)}</td>
                          <td>{formatCurrencyCr(fund.dryPowder)}</td>
                          <td>{formatCurrencyCr(fund.currentNav)}</td>
                          <td>{formatPercent(fund.grossIrr)}</td>
                          <td>{formatPercent(fund.netIrr)}</td>
                          <td>{formatMultiple(fund.dpi)}</td>
                          <td>{formatMultiple(fund.tvpi)}</td>
                          <td>{fund.investments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          <div className="knowledge-grid">
  <div className="preview-card">
    <h2>Upcoming Debt Repayments</h2>

    {upcomingRepaymentRows.length === 0 && (
      <div className="explain-box">No upcoming repayment schedules found.</div>
    )}

    {upcomingRepaymentRows.length > 0 && (
      <div className="journal-preview">
        {upcomingRepaymentRows.map((repayment) => {
          const company = companyMap.get(
            getString(repayment, ["portfolio_company_id"], "")
          );

          return (
            <div className="journal-row" key={getId(repayment)}>
              <span>
                {getString(company, ["company_name"], "Unknown")} •{" "}
                {formatDate(repayment["due_date"])}
              </span>
              <strong>
                {formatCurrencyCr(getNumber(repayment, ["total_due"]))} due
              </strong>
            </div>
          );
        })}
      </div>
    )}

    <div className="action-row">
      <a
        className="monitor-btn monitor-btn-secondary"
        href="/portfolio-intelligence"
      >
        View Repayment Schedule
      </a>
    </div>
  </div>

  <div className="preview-card">
    <h2>Portfolio News & Alerts</h2>

    {portfolioAlertRows.length === 0 && (
      <div className="explain-box">No open portfolio alerts found.</div>
    )}

    {portfolioAlertRows.length > 0 && (
      <div className="portfolio-alert-grid">
        {portfolioAlertRows.map((alert) => {
          const company = companyMap.get(
            getString(alert, ["portfolio_company_id"], "")
          );
          const sourceUrl = getString(alert, ["source_url"], "");

          return (
            <div className="portfolio-alert-card" key={getId(alert)}>
              <div className="portfolio-alert-top">
                <span className="portfolio-alert-badge">
                  {statusLabel(getString(alert, ["impact_level"], ""))}
                </span>

                <span className="portfolio-alert-date">
                  {formatDate(alert["alert_date"])}
                </span>
              </div>

              <h3>{getString(alert, ["title"], "-")}</h3>

              <p className="portfolio-alert-company">
                {getString(company, ["company_name"], "Unknown Company")}
              </p>

              <p className="portfolio-alert-summary">
                {getString(alert, ["summary"], "No summary available.")}
              </p>

              <div className="portfolio-alert-actions">
                {sourceUrl && sourceUrl !== "-" && (
                  <a
                    className="monitor-btn monitor-btn-ghost"
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Source
                  </a>
                )}

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/portfolio-intelligence"
                >
                  View Portfolio
                </a>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
</div>
            <div className="preview-card">
              <h2>Portfolio Companies Needing Attention</h2>

              {portfolioRiskRows.length === 0 && (
                <div className="explain-box">
                  No high-risk or watchlist company metrics found.
                </div>
              )}

              {portfolioRiskRows.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Metric Date</th>
                        <th>Revenue Growth</th>
                        <th>Runway</th>
                        <th>Gross IRR</th>
                        <th>Risk</th>
                        <th>Next Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {portfolioRiskRows.map((metric) => {
                        const company = companyMap.get(
                          getString(metric, ["portfolio_company_id"], "")
                        );

                        return (
                          <tr key={getId(metric)}>
                            <td>
                              <strong>
                                {getString(company, ["company_name"], "Unknown")}
                              </strong>
                            </td>
                            <td>{formatDate(metric["metric_date"])}</td>
                            <td>
                              {formatPercent(
                                getNumber(metric, ["revenue_growth_percentage"])
                              )}
                            </td>
                            <td>
                              {getNumber(metric, ["runway_months"]).toFixed(1)}{" "}
                              months
                            </td>
                            <td>
                              {formatPercent(getNumber(metric, ["gross_irr"]))}
                            </td>
                            <td>
                              {statusLabel(getString(metric, ["risk_rating"], ""))}
                            </td>
                            <td>{getString(metric, ["next_action"], "-")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>AI Recommended Decisions</h2>

                <div className="queue-grid">
                  <div className="queue-item">
                    ✓ Review upcoming repayments and generate notices
                  </div>
                  <div className="queue-item">
                    ✓ Prepare LP update using latest IRR / DPI / TVPI metrics
                  </div>
                  <div className="queue-item">
                    ✓ Review open portfolio alerts before partner meeting
                  </div>
                  <div className="queue-item">
                    ✓ Check regulatory review queue before investor reporting
                  </div>
                  <div className="queue-item">
                    ✓ Use portfolio intelligence data for Fund IV narrative
                  </div>
                  <div className="queue-item">
                    ✓ Review real data room readiness and open DDQ questions
                  </div>
                  <div className="queue-item">
                    ✓ Track exit readiness for high-MOIC investments
                  </div>
                </div>
              </div>

              <div className="ai-side-panel">
                <h2>Ask Partner AI</h2>

                <div className="chat-message">
                  Ask: “Which company needs attention this week?”
                </div>

                <div className="chat-message">
                  Ask: “What repayment notices should be sent?”
                </div>

                <div className="chat-message">
                  Ask: “Prepare LP update narrative from latest fund metrics.”
                </div>

                <div className="chat-message">
                  Ask: “Which investments are exit-ready?”
                </div>
              </div>
            </div>

           <div className="preview-card">
  <div className="source-monitor-header">
    <div>
      <h2>Executive Presentation Builder</h2>
      <p>
        Create LP update decks using live fund performance, portfolio,
        repayment, regulatory and investor communication data.
      </p>
    </div>

    <button
      type="button"
      className={
        showDeckBuilder
          ? "monitor-btn monitor-btn-secondary"
          : "monitor-btn monitor-btn-primary"
      }
      onClick={() => setShowDeckBuilder((current) => !current)}
    >
      {showDeckBuilder ? "Close Builder" : "Create LP Presentation"}
    </button>
  </div>

  {!showDeckBuilder && (
    <>
      <div className="explain-box">
        The Managing Partner can generate an LP presentation whenever required.
        Select fund scope, choose metrics, preview slides, edit narrative and
        generate a PowerPoint deck in the next phase.
      </div>

      <div className="impact-grid">
        <div className="impact-card">
          <h3>{deckScopeName}</h3>
          <p>Current deck scope</p>
        </div>

        <div className="impact-card">
          <h3>{selectedMetricCount}</h3>
          <p>Default sections selected</p>
        </div>

        <div className="impact-card">
          <h3>{formatPercent(dashboardMetrics.grossIrr)}</h3>
          <p>Gross IRR available</p>
        </div>

        <div className="impact-card">
          <h3>{dashboardMetrics.openPortfolioAlerts}</h3>
          <p>Portfolio alerts available</p>
        </div>
      </div>

      <div className="action-row">
        <button
          type="button"
          onClick={() => setShowDeckBuilder(true)}
        >
          Create LP Presentation
        </button>

        <button type="button">
          Preview Last Deck
        </button>
      </div>
    </>
  )}

  {showDeckBuilder && (
    <>
      <div className="form-card">
        <label>Select fund scope</label>
        <select
          value={selectedDeckFundId}
          onChange={(event) => setSelectedDeckFundId(event.target.value)}
        >
          <option value="all">All Funds</option>
          {fundRows.map((fund) => (
            <option key={fund.id || fund.name} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </select>
<label>Deck theme</label>
<select
  value={selectedDeckTheme}
  onChange={(event) => setSelectedDeckTheme(event.target.value)}
>
  <option value="ventiq_blue">VENTIQ Blue</option>
  <option value="premium_black">Premium Black</option>
  <option value="institutional_white">Institutional White</option>
  <option value="emerald_growth">Emerald Growth</option>
  <option value="burgundy_pe">Burgundy PE</option>
</select>

<label>Slide layout style</label>
<select
  value={selectedDeckLayout}
  onChange={(event) => setSelectedDeckLayout(event.target.value)}
>
  <option value="balanced">Balanced</option>
  <option value="chart_heavy">Chart Heavy</option>
  <option value="narrative_heavy">Narrative Heavy</option>
  <option value="metric_dashboard">Metric Dashboard</option>
</select>
<label className="lp-builder-checkbox">
  <input
    type="checkbox"
    checked={includeExecutiveSummary}
    onChange={(event) => setIncludeExecutiveSummary(event.target.checked)}
  />
  Include Executive Summary slide
</label>
        <div className="logic-note">
          Current deck scope: {selectedDeckFund?.name ?? "All Funds"} •{" "}
          {selectedMetricCount} sections selected
        </div>
      </div>

      <div className="queue-grid">
        {deckMetricOptions.map((metric) => (
          <button
            key={metric.key}
            type="button"
            className="queue-item"
            onClick={() => toggleDeckMetric(metric.key)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              border: selectedDeckMetrics[metric.key]
                ? "1px solid rgba(96, 165, 250, 0.65)"
                : "1px solid rgba(148, 163, 184, 0.22)",
              background: selectedDeckMetrics[metric.key]
                ? "rgba(37, 99, 235, 0.18)"
                : "rgba(15, 23, 42, 0.45)",
              color: "#e5e7eb",
            }}
          >
            {selectedDeckMetrics[metric.key] ? "✓ " : "+ "}
            {metric.label}
          </button>
        ))}
      </div>

      {deckMessage && <div className="logic-note">{deckMessage}</div>}

      <div className="lp-deck-preview">
        <div className="lp-deck-preview-header">
          <div>
            <p className="eyebrow">LP Deck Preview</p>
            <h3>{deckScopeName} Investor Presentation</h3>
            <p>
              Preview the sections VENTIQ will include before generating the
              actual PowerPoint file.
            </p>
          </div>

          <div className="lp-deck-count">
            <strong>{deckPreviewSections.length}</strong>
            <span>Sections</span>
          </div>
        </div>

        {deckPreviewSections.length === 0 && (
          <div className="explain-box">
            Select at least one metric to preview the LP deck structure.
          </div>
        )}

        {deckPreviewSections.length > 0 && (
          <div className="lp-deck-section-grid">
            {deckPreviewSections.map((section, index) => {
  const slideOption = getDeckSlideOption(section.title);
  const sectionChart = getSectionChart(section.title);

  return (
    <div className="lp-deck-section-card" key={section.title}>
      <div className="lp-deck-slide-number">Slide {index + 1}</div>

      <h4>{section.title}</h4>
      <p className="lp-deck-subtitle">{section.subtitle}</p>

      <div className="lp-slide-option-grid">
        <label>
          <input
            type="checkbox"
            checked={slideOption.includeHighlights}
            onChange={() =>
              toggleDeckSlideOption(section.title, "includeHighlights")
            }
          />
          Highlights
        </label>

        <label>
          <input
            type="checkbox"
            checked={slideOption.includeChart}
            disabled={!sectionChart}
            onChange={() =>
              toggleDeckSlideOption(section.title, "includeChart")
            }
          />
          Chart
        </label>

        <label>
          <input
            type="checkbox"
            checked={slideOption.includeNarrative}
            onChange={() =>
              toggleDeckSlideOption(section.title, "includeNarrative")
            }
          />
          Narrative
        </label>
      </div>

      {slideOption.includeHighlights && (
        <div className="lp-deck-highlights">
          {section.highlights.map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </div>
      )}

      {slideOption.includeChart && sectionChart && (
        <div className="lp-chart-preview-mini">
          <strong>{sectionChart.title}</strong>
          <p>{sectionChart.unit}</p>

          <div className="lp-chart-preview-bars">
            {sectionChart.items.map((item) => {
              const maxValue = Math.max(
                ...sectionChart.items.map((chartItem) => chartItem.value),
                1
              );

              return (
                <div className="lp-chart-preview-row" key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max((item.value / maxValue) * 100, 4)}%`,
                      }}
                    />
                  </div>
                  <strong>{item.displayValue}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {slideOption.includeNarrative && (
        <div className="lp-deck-narrative-editor">
          <label>Editable slide narrative</label>

          <textarea
            value={getEditableNarrative(section.title, section.narrative)}
            onChange={(event) =>
              updateDeckNarrative(section.title, event.target.value)
            }
            rows={5}
          />

          <div className="lp-deck-editor-actions">
            <button
              type="button"
              className="monitor-btn monitor-btn-secondary"
              onClick={() => resetDeckNarrative(section.title)}
            >
              Reset Narrative
            </button>
          </div>
        </div>
      )}
    </div>
  );
})}
          </div>
        )}
      </div>

      <div className="action-row">
  <button type="button" onClick={handlePreparePowerPoint}>
    Prepare PowerPoint Brief
  </button>

  <button type="button" onClick={handleEditSlideNarrative}>
    Edit Slide Narrative
  </button>

  <button type="button" onClick={handleGeneratePowerPoint}>
    Generate PowerPoint
  </button>
</div>

    </>
  )}
</div>
            <div className="preview-card">
              <h2>Exit Offer Impact Simulator</h2>

              <div className="explain-box">
                Future module: enter a potential exit offer and VENTIQ will
                update fund-level IRR, DPI, TVPI, carry, distributable proceeds
                and LP impact using Portfolio Intelligence data.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{formatMultiple(dashboardMetrics.moic)}</h3>
                  <p>Current fund MOIC</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCurrencyCr(dashboardMetrics.currentFairValue)}</h3>
                  <p>Current fair value</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCurrencyCr(dashboardMetrics.realizedValue)}</h3>
                  <p>Realized value</p>
                </div>

                <div className="impact-card">
                  <h3>{formatCurrencyCr(dashboardMetrics.unrealizedValue)}</h3>
                  <p>Unrealized value</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}