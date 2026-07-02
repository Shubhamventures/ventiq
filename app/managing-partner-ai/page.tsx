"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

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

  function toggleDeckMetric(metricKey: DeckMetricKey) {
    setSelectedDeckMetrics((current) => ({
      ...current,
      [metricKey]: !current[metricKey],
    }));
  }

  function handlePreparePowerPoint() {
    const targetFund = selectedDeckFund?.name ?? "All Funds";

    setDeckMessage(
      `Presentation brief prepared for ${targetFund} with ${selectedMetricCount} selected sections, including fund performance, portfolio metrics, repayment schedule and portfolio alerts. Actual PPT generation will be connected in Phase 5.3.`
    );
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
                  <div className="explain-box">
                    No upcoming repayment schedules found.
                  </div>
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
                            {formatCurrencyCr(
                              getNumber(repayment, ["total_due"])
                            )}{" "}
                            due
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
                  <div className="explain-box">
                    No open portfolio alerts found.
                  </div>
                )}

                {portfolioAlertRows.length > 0 && (
                  <div className="queue-grid">
                    {portfolioAlertRows.map((alert) => {
                      const company = companyMap.get(
                        getString(alert, ["portfolio_company_id"], "")
                      );

                      return (
                        <div className="queue-item" key={getId(alert)}>
                          <strong>{getString(alert, ["title"], "-")}</strong>
                          <br />
                          {getString(company, ["company_name"], "Unknown")}
                          <br />
                          Impact:{" "}
                          {statusLabel(getString(alert, ["impact_level"], ""))}
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
              <h2>Executive Presentation Builder</h2>

              <div className="explain-box">
                Select funds and metrics for an LP update deck. VENTIQ will use
                fund performance, portfolio metrics, repayment schedules,
                regulatory alerts and investor communication data.
              </div>

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

              <div className="action-row">
                <button type="button" onClick={handlePreparePowerPoint}>
                  Prepare PowerPoint Brief
                </button>

                <button type="button">Preview LP Narrative</button>
              </div>
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