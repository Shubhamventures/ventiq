"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

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

export default function ManagingPartnerAIPage() {
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
    loadManagingPartnerDashboard();
  }, []);

  async function loadManagingPartnerDashboard() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured. Please check .env.local.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const [
      fundsResult,
      commitmentsResult,
      investorsResult,
      capitalCallsResult,
      distributionsResult,
      documentsResult,
      matchesResult,
      circularsResult,
      portfolioCompaniesResult,
      fundInvestmentsResult,
      debtRepaymentsResult,
      portfolioCompanyMetricsResult,
      portfolioNewsAlertsResult,
      fundPerformanceMetricsResult,
    ] = await Promise.all([
      supabase.from("funds").select("*"),
      supabase.from("commitments").select("*"),
      supabase.from("investors").select("*"),
      supabase.from("capital_calls").select("*"),
      supabase.from("distributions").select("*"),
      supabase.from("investor_documents").select("*"),
      supabase
        .from("regulatory_source_matches")
        .select("*")
        .eq("status", "needs_review"),
      supabase.from("regulatory_circulars").select("*").eq("status", "active"),

      supabase.from("portfolio_companies").select("*"),
      supabase.from("fund_investments").select("*"),
      supabase.from("debt_repayment_schedules").select("*").order("due_date"),
      supabase
        .from("portfolio_company_metrics")
        .select("*")
        .order("metric_date", { ascending: false }),
      supabase
        .from("portfolio_news_alerts")
        .select("*")
        .order("alert_date", { ascending: false }),
      supabase
        .from("fund_performance_metrics")
        .select("*")
        .order("reporting_date", { ascending: false }),
    ]);

    const firstError =
      fundsResult.error ||
      commitmentsResult.error ||
      investorsResult.error ||
      capitalCallsResult.error ||
      distributionsResult.error ||
      documentsResult.error ||
      matchesResult.error ||
      circularsResult.error ||
      portfolioCompaniesResult.error ||
      fundInvestmentsResult.error ||
      debtRepaymentsResult.error ||
      portfolioCompanyMetricsResult.error ||
      portfolioNewsAlertsResult.error ||
      fundPerformanceMetricsResult.error;

    if (firstError) {
      setErrorMessage(firstError.message);
      setLoading(false);
      return;
    }

    setFunds((fundsResult.data ?? []) as DataRow[]);
    setCommitments((commitmentsResult.data ?? []) as DataRow[]);
    setInvestors((investorsResult.data ?? []) as DataRow[]);
    setCapitalCalls((capitalCallsResult.data ?? []) as DataRow[]);
    setDistributions((distributionsResult.data ?? []) as DataRow[]);
    setInvestorDocuments((documentsResult.data ?? []) as DataRow[]);
    setRegulatoryMatches((matchesResult.data ?? []) as DataRow[]);
    setRegulatoryCirculars((circularsResult.data ?? []) as DataRow[]);

    setPortfolioCompanies((portfolioCompaniesResult.data ?? []) as DataRow[]);
    setFundInvestments((fundInvestmentsResult.data ?? []) as DataRow[]);
    setDebtRepayments((debtRepaymentsResult.data ?? []) as DataRow[]);
    setPortfolioCompanyMetrics(
      (portfolioCompanyMetricsResult.data ?? []) as DataRow[]
    );
    setPortfolioNewsAlerts((portfolioNewsAlertsResult.data ?? []) as DataRow[]);
    setFundPerformanceMetrics(
      (fundPerformanceMetricsResult.data ?? []) as DataRow[]
    );

    setLoading(false);
  }

  const fundMap = useMemo(() => {
    return new Map(funds.map((fund) => [getId(fund), fund]));
  }, [funds]);

  const companyMap = useMemo(() => {
    return new Map(portfolioCompanies.map((company) => [getId(company), company]));
  }, [portfolioCompanies]);

  const dashboardMetrics = useMemo(() => {
    const totalCommitted = commitments.reduce(
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

    const storedDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url"], ""))
    ).length;

    const queuedEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "queued"
    ).length;

    const sentEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "sent"
    ).length;

    const highImpactCirculars = regulatoryCirculars.filter(
      (row) => getString(row, ["impact"], "").toUpperCase() === "HIGH"
    ).length;

    const totalInvestmentCost = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["original_investment_amount"]),
      0
    );

    const currentFairValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["current_fair_value"]),
      0
    );

    const realizedValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["realized_value"]),
      0
    );

    const unrealizedValue = fundInvestments.reduce(
      (sum, row) => sum + getNumber(row, ["unrealized_value"]),
      0
    );

    const latestFundMetric = fundPerformanceMetrics[0];

    const grossIrr = getNumber(latestFundMetric, ["gross_irr"]);
    const netIrr = getNumber(latestFundMetric, ["net_irr"]);
    const dpi = getNumber(latestFundMetric, ["dpi"]);
    const tvpi = getNumber(latestFundMetric, ["tvpi"]);
    const moic = getNumber(latestFundMetric, ["moic"]);
    const currentNav = getNumber(latestFundMetric, ["current_nav"]);

    const upcomingRepayments = debtRepayments.filter(
      (row) => getString(row, ["payment_status"], "") === "upcoming"
    ).length;

    const overdueRepayments = debtRepayments.filter(
      (row) => getString(row, ["payment_status"], "") === "overdue"
    ).length;

    const openPortfolioAlerts = portfolioNewsAlerts.filter(
      (row) => getString(row, ["status"], "") === "open"
    ).length;

    const highRiskMetrics = portfolioCompanyMetrics.filter((row) => {
      const risk = getString(row, ["risk_rating"], "").toLowerCase();
      const performance = getString(row, ["performance_status"], "").toLowerCase();

      return risk === "high" || performance === "below_plan";
    }).length;

    return {
      totalCommitted,
      totalCalled,
      totalDistributed,
      uncalledCapital,
      deploymentRate,
      activeFunds: funds.length,
      investors: investors.length,
      pendingCapitalCalls: draftCapitalCalls.length,
      pendingDistributions: draftDistributions.length,
      pendingRegulatoryReviews: regulatoryMatches.length,
      generatedDocuments: investorDocuments.length,
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
      portfolioCompanies: portfolioCompanies.length,
      fundInvestments: fundInvestments.length,
      upcomingRepayments,
      overdueRepayments,
      openPortfolioAlerts,
      highRiskMetrics,
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
              intelligence, repayment schedules, investor communication,
              regulatory alerts and LP storytelling.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Loading Managing Partner Dashboard...</h2>
            <p>VENTIQ is reading fund, portfolio and deal data from Supabase.</p>
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
              <h2>Good Morning, Managing Partner</h2>

              <div className="explain-box">
                VENTIQ reviewed {dashboardMetrics.activeFunds} active funds,{" "}
                {dashboardMetrics.portfolioCompanies} portfolio companies,{" "}
                {dashboardMetrics.fundInvestments} investments,{" "}
                {formatCurrencyCr(dashboardMetrics.currentNav)} current NAV,{" "}
                {dashboardMetrics.upcomingRepayments} upcoming repayments and{" "}
                {dashboardMetrics.openPortfolioAlerts} open portfolio alerts.
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