"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

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

export default function PortfolioIntelligencePage() {
  const [funds, setFunds] = useState<DataRow[]>([]);
  const [companies, setCompanies] = useState<DataRow[]>([]);
  const [investments, setInvestments] = useState<DataRow[]>([]);
  const [repayments, setRepayments] = useState<DataRow[]>([]);
  const [companyMetrics, setCompanyMetrics] = useState<DataRow[]>([]);
  const [newsAlerts, setNewsAlerts] = useState<DataRow[]>([]);
  const [fundMetrics, setFundMetrics] = useState<DataRow[]>([]);
  const [selectedInvestmentType, setSelectedInvestmentType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPortfolioIntelligence();
  }, []);

  async function loadPortfolioIntelligence() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured. Please check .env.local.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const [
      fundsResult,
      companiesResult,
      investmentsResult,
      repaymentsResult,
      companyMetricsResult,
      newsAlertsResult,
      fundMetricsResult,
    ] = await Promise.all([
      supabase.from("funds").select("*"),
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
      companiesResult.error ||
      investmentsResult.error ||
      repaymentsResult.error ||
      companyMetricsResult.error ||
      newsAlertsResult.error ||
      fundMetricsResult.error;

    if (firstError) {
      setErrorMessage(firstError.message);
      setLoading(false);
      return;
    }

    setFunds((fundsResult.data ?? []) as DataRow[]);
    setCompanies((companiesResult.data ?? []) as DataRow[]);
    setInvestments((investmentsResult.data ?? []) as DataRow[]);
    setRepayments((repaymentsResult.data ?? []) as DataRow[]);
    setCompanyMetrics((companyMetricsResult.data ?? []) as DataRow[]);
    setNewsAlerts((newsAlertsResult.data ?? []) as DataRow[]);
    setFundMetrics((fundMetricsResult.data ?? []) as DataRow[]);

    setLoading(false);
  }

  const fundMap = useMemo(() => {
    return new Map(funds.map((fund) => [getId(fund), fund]));
  }, [funds]);

  const companyMap = useMemo(() => {
    return new Map(companies.map((company) => [getId(company), company]));
  }, [companies]);

  const investmentMap = useMemo(() => {
    return new Map(investments.map((investment) => [getId(investment), investment]));
  }, [investments]);

  const filteredInvestments = useMemo(() => {
    if (selectedInvestmentType === "all") return investments;

    return investments.filter(
      (investment) =>
        getString(investment, ["investment_type"], "").toLowerCase() ===
        selectedInvestmentType
    );
  }, [investments, selectedInvestmentType]);

  const dashboardMetrics = useMemo(() => {
    const totalInvested = investments.reduce(
      (sum, investment) =>
        sum + getNumber(investment, ["original_investment_amount"]),
      0
    );

    const currentFairValue = investments.reduce(
      (sum, investment) => sum + getNumber(investment, ["current_fair_value"]),
      0
    );

    const realizedValue = investments.reduce(
      (sum, investment) => sum + getNumber(investment, ["realized_value"]),
      0
    );

    const unrealizedValue = investments.reduce(
      (sum, investment) => sum + getNumber(investment, ["unrealized_value"]),
      0
    );

    const projectedGrossIrrValues = investments
      .map((investment) => getNumber(investment, ["projected_gross_irr"]))
      .filter((value) => value > 0);

    const averageProjectedGrossIrr =
      projectedGrossIrrValues.length > 0
        ? projectedGrossIrrValues.reduce((sum, value) => sum + value, 0) /
          projectedGrossIrrValues.length
        : 0;

    const upcomingRepayments = repayments.filter(
      (repayment) => getString(repayment, ["payment_status"], "") === "upcoming"
    );

    const overdueRepayments = repayments.filter(
      (repayment) => getString(repayment, ["payment_status"], "") === "overdue"
    );

    const openAlerts = newsAlerts.filter(
      (alert) => getString(alert, ["status"], "") === "open"
    );

    const debtDeals = investments.filter(
      (investment) => getString(investment, ["investment_type"], "") === "debt"
    ).length;

    const equityDeals = investments.filter((investment) =>
      ["private_equity", "venture_capital", "equity"].includes(
        getString(investment, ["investment_type"], "")
      )
    ).length;

    return {
      totalInvested,
      currentFairValue,
      realizedValue,
      unrealizedValue,
      averageProjectedGrossIrr,
      upcomingRepayments: upcomingRepayments.length,
      overdueRepayments: overdueRepayments.length,
      openAlerts: openAlerts.length,
      debtDeals,
      equityDeals,
    };
  }, [investments, repayments, newsAlerts]);

  const latestFundMetric = fundMetrics[0];

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Portfolio Intelligence</p>
            <h1>Portfolio & Deal Intelligence</h1>
            <p>
              Deal-level operating system for debt repayments, PE / VC portfolio
              metrics, IRR, MOIC, exit outlook, news alerts and investor
              presentation data.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Loading Portfolio Intelligence...</h2>
            <p>VENTIQ is reading portfolio and deal data from Supabase.</p>
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
              <h2>Portfolio Intelligence Summary</h2>

              <div className="explain-box">
                VENTIQ is tracking {companies.length} portfolio companies,{" "}
                {investments.length} fund investments,{" "}
                {dashboardMetrics.upcomingRepayments} upcoming repayment events
                and {dashboardMetrics.openAlerts} open portfolio alerts.
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.totalInvested)}</h3>
                <p>Total investment cost</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(dashboardMetrics.currentFairValue)}</h3>
                <p>Current fair value</p>
              </div>

              <div className="impact-card">
                <h3>{formatPercent(dashboardMetrics.averageProjectedGrossIrr)}</h3>
                <p>Avg projected gross IRR</p>
              </div>

              <div className="impact-card">
                <h3>{dashboardMetrics.openAlerts}</h3>
                <p>Open news / portfolio alerts</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Fund Performance Metrics</h2>

              {!latestFundMetric && (
                <div className="explain-box">
                  No fund performance metrics found yet.
                </div>
              )}

              {latestFundMetric && (
                <div className="impact-grid">
                  <div className="impact-card">
                    <h3>{formatPercent(getNumber(latestFundMetric, ["gross_irr"]))}</h3>
                    <p>Gross IRR</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatPercent(getNumber(latestFundMetric, ["net_irr"]))}</h3>
                    <p>Net IRR</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatMultiple(getNumber(latestFundMetric, ["dpi"]))}</h3>
                    <p>DPI</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatMultiple(getNumber(latestFundMetric, ["tvpi"]))}</h3>
                    <p>TVPI</p>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-card">
              <div className="source-monitor-header">
                <div>
                  <h2>Deal Book</h2>
                  <p>
                    Combined investment book for debt, PE and VC investments.
                  </p>
                </div>

                <select
                  value={selectedInvestmentType}
                  onChange={(event) =>
                    setSelectedInvestmentType(event.target.value)
                  }
                >
                  <option value="all">All Deals</option>
                  <option value="debt">Debt Deals</option>
                  <option value="private_equity">Private Equity Deals</option>
                </select>
              </div>

              {filteredInvestments.length === 0 && (
                <div className="explain-box">No investments found.</div>
              )}

              {filteredInvestments.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Fund</th>
                        <th>Deal Type</th>
                        <th>Investment Cost</th>
                        <th>Current Value</th>
                        <th>Projected IRR</th>
                        <th>Projected MOIC</th>
                        <th>Risk</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInvestments.map((investment) => {
                        const company = companyMap.get(
                          getString(investment, ["portfolio_company_id"], "")
                        );
                        const fund = fundMap.get(
                          getString(investment, ["fund_id"], "")
                        );

                        return (
                          <tr key={getId(investment)}>
                            <td>
                              <strong>
                                {getString(company, ["company_name"], "Unknown")}
                              </strong>
                              <p>{getString(company, ["sector"], "-")}</p>
                            </td>
                            <td>{getString(fund, ["fund_name", "name"], "-")}</td>
                            <td>
                              {statusLabel(
                                getString(investment, ["investment_type"], "")
                              )}
                              <p>
                                {getString(investment, ["security_type"], "-")}
                              </p>
                            </td>
                            <td>
                              {formatCurrencyCr(
                                getNumber(investment, [
                                  "original_investment_amount",
                                ])
                              )}
                            </td>
                            <td>
                              {formatCurrencyCr(
                                getNumber(investment, ["current_fair_value"])
                              )}
                            </td>
                            <td>
                              {formatPercent(
                                getNumber(investment, ["projected_gross_irr"])
                              )}
                            </td>
                            <td>
                              {formatMultiple(
                                getNumber(investment, ["projected_moic"])
                              )}
                            </td>
                            <td>{statusLabel(getString(investment, ["risk_rating"], ""))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Debt Repayment Schedule</h2>

              {repayments.length === 0 && (
                <div className="explain-box">
                  No repayment schedules found yet.
                </div>
              )}

              {repayments.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Due Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Total Due</th>
                        <th>Payment Status</th>
                        <th>Notice Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {repayments.map((repayment) => {
                        const investment = investmentMap.get(
                          getString(repayment, ["investment_id"], "")
                        );
                        const company = companyMap.get(
                          getString(repayment, ["portfolio_company_id"], "")
                        );

                        return (
                          <tr key={getId(repayment)}>
                            <td>
                              <strong>
                                {getString(company, ["company_name"], "Unknown")}
                              </strong>
                              <p>{getString(investment, ["investment_name"], "-")}</p>
                            </td>
                            <td>{formatDate(repayment["due_date"])}</td>
                            <td>
                              {formatCurrencyCr(
                                getNumber(repayment, ["principal_due"])
                              )}
                            </td>
                            <td>
                              {formatCurrencyCr(
                                getNumber(repayment, ["interest_due"])
                              )}
                            </td>
                            <td>
                              {formatCurrencyCr(
                                getNumber(repayment, ["total_due"])
                              )}
                            </td>
                            <td>
                              {statusLabel(
                                getString(repayment, ["payment_status"], "")
                              )}
                            </td>
                            <td>
                              {statusLabel(
                                getString(repayment, ["notice_status"], "")
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="action-row">
                <button type="button">Generate Repayment Notice</button>
                <button type="button">Send Reminder</button>
              </div>
            </div>

            <div className="preview-card">
              <h2>PE / VC Portfolio Metrics</h2>

              {companyMetrics.length === 0 && (
                <div className="explain-box">
                  No portfolio company metrics found yet.
                </div>
              )}

              {companyMetrics.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Metric Date</th>
                        <th>Revenue Growth</th>
                        <th>Runway</th>
                        <th>NAV Value</th>
                        <th>MOIC</th>
                        <th>Gross IRR</th>
                        <th>Next Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {companyMetrics.map((metric) => {
                        const company = companyMap.get(
                          getString(metric, ["portfolio_company_id"], "")
                        );

                        return (
                          <tr key={getId(metric)}>
                            <td>
                              <strong>
                                {getString(company, ["company_name"], "Unknown")}
                              </strong>
                              <p>
                                {statusLabel(
                                  getString(metric, ["performance_status"], "")
                                )}
                              </p>
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
                              {formatCurrencyCr(getNumber(metric, ["nav_value"]))}
                            </td>
                            <td>{formatMultiple(getNumber(metric, ["moic"]))}</td>
                            <td>
                              {formatPercent(getNumber(metric, ["gross_irr"]))}
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

            <div className="preview-card">
  <h2>Portfolio News & Alerts</h2>

  {newsAlerts.length === 0 && (
    <div className="explain-box">No portfolio alerts found yet.</div>
  )}

  {newsAlerts.length > 0 && (
    <div className="portfolio-alert-grid">
      {newsAlerts.map((alert) => {
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
              <span className="small-pill">
                {statusLabel(getString(alert, ["alert_type"], ""))}
              </span>

              <span className="small-pill">
                {statusLabel(getString(alert, ["status"], ""))}
              </span>

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
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
          </>
        )}
      </section>
    </main>
  );
}