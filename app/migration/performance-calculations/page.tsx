"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { useActiveFund } from "../../../lib/useActiveFund";

type CalculationRun = {
  id: string;
  fund_name: string;
  as_of_date: string;
  calculation_version: string;
  calculation_status: string;
  nav_allocation_method: string;
  source_batch_ids: string[];
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  calculation_notes: string[];
  initiated_by_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type FundMetric = {
  id: string;
  calculation_run_id: string;
  fund_name: string;
  as_of_date: string;
  currency: string;
  total_commitments: number | string;
  paid_in_capital: number | string;
  total_distributions: number | string;
  uncalled_commitment: number | string;
  latest_gross_nav: number | string;
  latest_net_nav: number | string;
  portfolio_investment_cost: number | string;
  portfolio_realised_proceeds: number | string;
  portfolio_terminal_fair_value: number | string;
  gross_irr: number | string | null;
  net_irr: number | string | null;
  gross_moic: number | string | null;
  dpi: number | string | null;
  rvpi: number | string | null;
  tvpi: number | string | null;
  source_nav_date: string | null;
  source_valuation_date: string | null;
  portfolio_count: number;
  investor_count: number;
  calculation_status: string;
  calculation_note: string | null;
};

type PortfolioMetric = {
  id: string;
  portfolio_code: string;
  portfolio_company: string | null;
  instrument_type: string | null;
  invested_capital: number | string;
  realised_proceeds: number | string;
  terminal_fair_value: number | string;
  total_value: number | string;
  gross_profit: number | string;
  gross_moic: number | string | null;
  gross_irr: number | string | null;
  cashflow_count: number;
  valuation_date: string | null;
  calculation_status: string;
};

type InvestorMetric = {
  id: string;
  investor_code: string;
  investor_name: string | null;
  commitment_amount: number | string;
  paid_in_capital: number | string;
  total_distributions: number | string;
  allocated_nav: number | string;
  dpi: number | string | null;
  rvpi: number | string | null;
  tvpi: number | string | null;
  net_irr: number | string | null;
  calculation_status: string;
};

type ReconciliationResult = {
  id: string;
  reconciliation_type: string;
  metric_name: string;
  source_value: number | string | null;
  calculated_value: number | string | null;
  difference_amount: number | string | null;
  difference_percentage: number | string | null;
  reconciliation_status: string;
  source_reference: string | null;
  calculation_reference: string | null;
};

type MetricsApiResponse = {
  error?: string;
  run?: CalculationRun | null;
  fundMetric?: FundMetric | null;
  portfolioMetrics?: PortfolioMetric[];
  investorMetrics?: InvestorMetric[];
  reconciliations?: ReconciliationResult[];
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.abs(parsed) < 0.005 ? 0 : parsed;
}

function formatMoney(value: unknown, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatPercent(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }

  return `${(toNumber(value) * 100).toFixed(2)}%`;
}

function formatMultiple(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }

  return `${toNumber(value).toFixed(2)}x`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function reconciliationTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "pass") {
    return {
      background: "rgba(22, 163, 74, 0.14)",
      borderColor: "rgba(34, 197, 94, 0.50)",
      color: "#86efac",
    };
  }

  if (normalized === "warning") {
    return {
      background: "rgba(202, 138, 4, 0.14)",
      borderColor: "rgba(234, 179, 8, 0.50)",
      color: "#fde047",
    };
  }

  if (normalized === "fail") {
    return {
      background: "rgba(220, 38, 38, 0.14)",
      borderColor: "rgba(248, 113, 113, 0.50)",
      color: "#fca5a5",
    };
  }

  return {
    background: "rgba(71, 85, 105, 0.20)",
    borderColor: "rgba(148, 163, 184, 0.35)",
    color: "#cbd5e1",
  };
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37, 99, 235, 0.13), transparent 32%), #07101f",
    color: "#f8fafc",
    padding: "40px 28px 80px",
  },

  container: {
    width: "min(1500px, 100%)",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#60a5fa",
    fontWeight: 800,
    letterSpacing: "0.04em",
    marginBottom: 10,
  },

  title: {
    fontSize: "clamp(2rem, 4vw, 3.5rem)",
    lineHeight: 1.05,
    margin: 0,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    color: "#bfd0ea",
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 900,
    marginTop: 16,
  },

  link: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "0 20px",
    color: "#dbeafe",
    textDecoration: "none",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    borderRadius: 14,
    background: "rgba(15, 23, 42, 0.70)",
    fontWeight: 700,
  },

  panel: {
    border: "1px solid rgba(100, 116, 139, 0.38)",
    borderRadius: 24,
    background: "rgba(15, 25, 45, 0.88)",
    padding: 28,
    marginBottom: 24,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.18)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },

  sectionTitle: {
    margin: 0,
    fontSize: 26,
  },

  muted: {
    color: "#9fb2cf",
    lineHeight: 1.55,
  },

  button: {
    minHeight: 52,
    border: 0,
    borderRadius: 14,
    padding: "0 24px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  statusBox: {
    marginTop: 22,
    padding: "18px 20px",
    borderRadius: 16,
    border: "1px solid rgba(59, 130, 246, 0.50)",
    background: "rgba(30, 64, 175, 0.18)",
    color: "#dbeafe",
    lineHeight: 1.55,
  },

  errorBox: {
    marginTop: 22,
    padding: "18px 20px",
    borderRadius: 16,
    border: "1px solid rgba(248, 113, 113, 0.50)",
    background: "rgba(153, 27, 27, 0.20)",
    color: "#fecaca",
    lineHeight: 1.55,
  },

  metricGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginTop: 22,
  },

  metricCard: {
    border: "1px solid rgba(71, 85, 105, 0.42)",
    borderRadius: 18,
    padding: 20,
    background: "rgba(2, 8, 23, 0.62)",
  },

  metricLabel: {
    color: "#9fb2cf",
    fontSize: 14,
    marginBottom: 10,
  },

  metricValue: {
    fontSize: 28,
    fontWeight: 850,
    letterSpacing: "-0.03em",
  },

  metricNote: {
    color: "#8297b6",
    fontSize: 13,
    marginTop: 8,
  },

  tableWrap: {
    overflowX: "auto",
    marginTop: 20,
    border: "1px solid rgba(71, 85, 105, 0.38)",
    borderRadius: 16,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 900,
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    color: "#bfdbfe",
    background: "rgba(30, 64, 175, 0.18)",
    borderBottom:
      "1px solid rgba(71, 85, 105, 0.45)",
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 16px",
    color: "#e2e8f0",
    borderBottom:
      "1px solid rgba(51, 65, 85, 0.38)",
    fontSize: 14,
    verticalAlign: "top",
  },

  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  emptyState: {
    padding: "28px 20px",
    borderRadius: 16,
    border: "1px dashed rgba(100, 116, 139, 0.45)",
    color: "#9fb2cf",
    textAlign: "center",
    marginTop: 20,
  },
};

export default function PerformanceCalculationsPage() {
  const { session } = useVentiqAuth();

  const {
    activeFundName,
    isReady: fundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");

  const [result, setResult] =
    useState<MetricsApiResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] =
    useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const loadLatestMetrics = useCallback(
    async (
      accessToken: string,
      fundName: string
    ) => {
      const response = await fetch(
        `/api/metrics/calculate?fundName=${encodeURIComponent(
          fundName
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      const payload =
        (await response.json()) as MetricsApiResponse;

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to load the latest calculation."
        );
      }

      setResult(payload);

      if (payload.run) {
        setMessage(
          `Latest calculation restored. As-of date: ${formatDate(
            payload.run.as_of_date
          )}.`
        );
      } else {
        setMessage(
          "No completed performance calculation exists yet for this fund."
        );
      }
    },
    []
  );

  useEffect(() => {
  const accessToken = session?.access_token ?? "";
  const fundName = activeFundName.trim();

  if (
    !fundContextReady ||
    !fundName ||
    !accessToken
  ) {
    setIsLoading(false);
    return;
  }

  let cancelled = false;

  async function restoreCalculation() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      await loadLatestMetrics(
        accessToken,
        fundName
      );
    } catch (error) {
      if (!cancelled) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to restore calculation results."
        );
      }
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }
  }

  void restoreCalculation();

  return () => {
    cancelled = true;
  };
}, [
  activeFundName,
  fundContextReady,
  loadLatestMetrics,
  session?.access_token,
]);
  async function runCalculation() {
    const accessToken = session?.access_token;

    if (!accessToken) {
      setErrorMessage(
        "Your login session is not available. Please sign in again."
      );
      return;
    }

    if (!activeFundName.trim()) {
      setErrorMessage(
        "An active fund must be selected before calculation."
      );
      return;
    }

    setIsCalculating(true);
    setErrorMessage("");
    setMessage(
      "Calculating deal, fund and investor performance metrics..."
    );

    try {
      const response = await fetch(
        "/api/metrics/calculate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fundName: activeFundName,
          }),
        }
      );

      const payload = (await response.json()) as {
        error?: string;
        calculationRunId?: string;
        asOfDate?: string;
        calculationStatus?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Performance calculation failed."
        );
      }

      setMessage(
        `Calculation completed successfully for ${formatDate(
          payload.asOfDate
        )}. Loading calculated outputs...`
      );

      await loadLatestMetrics(
        accessToken,
        activeFundName
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Performance calculation failed."
      );
    } finally {
      setIsCalculating(false);
    }
  }

  const fundMetric = result?.fundMetric ?? null;
  const portfolioMetrics =
    result?.portfolioMetrics ?? [];
  const investorMetrics =
    result?.investorMetrics ?? [];
  const reconciliations =
    result?.reconciliations ?? [];

  const reconciliationSummary = useMemo(() => {
    return reconciliations.reduce<
      Record<string, number>
    >((summary, item) => {
      const key =
        item.reconciliation_status ||
        "Not Applicable";

      summary[key] = (summary[key] || 0) + 1;

      return summary;
    }, {});
  }, [reconciliations]);

  const currency = fundMetric?.currency || "INR";

  const buttonStyle: CSSProperties = {
    ...styles.button,
    ...(isCalculating ||
    !session?.access_token ||
    !fundContextReady
      ? styles.disabledButton
      : {}),
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              VENTIQ PERFORMANCE ENGINE
            </div>

            <h1 style={styles.title}>
              Calculation & Reconciliation
            </h1>

            <p style={styles.subtitle}>
              Calculate deal-wise IRR and MOIC,
              fund Gross IRR and Net IRR, DPI,
              RVPI, TVPI and investor-level
              performance from canonical source
              facts.
            </p>

            <p style={styles.muted}>
              Active fund:{" "}
              <strong>{activeFundName}</strong>
            </p>
          </div>

          <Link
            href="/migration/activation"
            style={styles.link}
          >
            Open Activation Dashboard
          </Link>
        </header>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Performance Calculation Control
              </h2>

              <p style={styles.muted}>
                The as-of date is automatically
                taken from the latest eligible NAV
                snapshot.
              </p>
            </div>

            <button
              type="button"
              style={buttonStyle}
              disabled={
                isCalculating ||
                !session?.access_token ||
                !fundContextReady
              }
              onClick={runCalculation}
            >
              {isCalculating
                ? "Calculating..."
                : "Run Performance Calculation"}
            </button>
          </div>

          {isLoading ? (
            <div style={styles.statusBox}>
              Loading the latest calculation...
            </div>
          ) : null}

          {message && !isLoading ? (
            <div style={styles.statusBox}>
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div style={styles.errorBox}>
              {errorMessage}
            </div>
          ) : null}

          {result?.run ? (
            <div style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Calculation status
                </div>
                <div style={styles.metricValue}>
                  {result.run.calculation_status}
                </div>
                <div style={styles.metricNote}>
                  Version{" "}
                  {result.run.calculation_version}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  As-of date
                </div>
                <div style={styles.metricValue}>
                  {formatDate(
                    result.run.as_of_date
                  )}
                </div>
                <div style={styles.metricNote}>
                  Latest completed run
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Portfolio records
                </div>
                <div style={styles.metricValue}>
                  {portfolioMetrics.length}
                </div>
                <div style={styles.metricNote}>
                  Deal-level calculations
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Investor records
                </div>
                <div style={styles.metricValue}>
                  {investorMetrics.length}
                </div>
                <div style={styles.metricNote}>
                  Investor-level calculations
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {fundMetric ? (
          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>
              Fund Performance
            </h2>

            <div style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Gross IRR
                </div>
                <div style={styles.metricValue}>
                  {formatPercent(
                    fundMetric.gross_irr
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Net IRR
                </div>
                <div style={styles.metricValue}>
                  {formatPercent(
                    fundMetric.net_irr
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Gross MOIC
                </div>
                <div style={styles.metricValue}>
                  {formatMultiple(
                    fundMetric.gross_moic
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  DPI
                </div>
                <div style={styles.metricValue}>
                  {formatMultiple(fundMetric.dpi)}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  RVPI
                </div>
                <div style={styles.metricValue}>
                  {formatMultiple(fundMetric.rvpi)}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  TVPI
                </div>
                <div style={styles.metricValue}>
                  {formatMultiple(fundMetric.tvpi)}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Commitments
                </div>
                <div style={styles.metricValue}>
                  {formatMoney(
                    fundMetric.total_commitments,
                    currency
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Paid-in capital
                </div>
                <div style={styles.metricValue}>
                  {formatMoney(
                    fundMetric.paid_in_capital,
                    currency
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Distributions
                </div>
                <div style={styles.metricValue}>
                  {formatMoney(
                    fundMetric.total_distributions,
                    currency
                  )}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>
                  Latest Net NAV
                </div>
                <div style={styles.metricValue}>
                  {formatMoney(
                    fundMetric.latest_net_nav,
                    currency
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Reconciliation Controls
              </h2>

              <p style={styles.muted}>
                Source totals compared with
                VENTIQ-calculated outputs.
              </p>
            </div>

            <div>
              {Object.entries(
                reconciliationSummary
              ).map(([status, count]) => (
                <span
                  key={status}
                  style={{
                    ...styles.badge,
                    ...reconciliationTone(status),
                    marginLeft: 8,
                  }}
                >
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>

          {reconciliations.length === 0 ? (
            <div style={styles.emptyState}>
              Run the calculation to generate
              reconciliation controls.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Control
                    </th>
                    <th style={styles.th}>
                      Metric
                    </th>
                    <th style={styles.th}>
                      Source
                    </th>
                    <th style={styles.th}>
                      Calculated
                    </th>
                    <th style={styles.th}>
                      Difference
                    </th>
                    <th style={styles.th}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {reconciliations.map(
                    (item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          {
                            item.reconciliation_type
                          }
                        </td>
                        <td style={styles.td}>
                          {item.metric_name}
                        </td>
                        <td style={styles.td}>
                          {item.source_value ===
                          null
                            ? "Not available"
                            : formatMoney(
                                item.source_value,
                                currency
                              )}
                        </td>
                        <td style={styles.td}>
                          {item.calculated_value ===
                          null
                            ? "Not available"
                            : formatMoney(
                                item.calculated_value,
                                currency
                              )}
                        </td>
                        <td style={styles.td}>
                          {item.difference_amount ===
                          null
                            ? "Not applicable"
                            : formatMoney(
                                item.difference_amount,
                                currency
                              )}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...reconciliationTone(
                                item.reconciliation_status
                              ),
                            }}
                          >
                            {
                              item.reconciliation_status
                            }
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>
            Portfolio Performance Preview
          </h2>

          {portfolioMetrics.length === 0 ? (
            <div style={styles.emptyState}>
              No portfolio calculations are
              available yet.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Portfolio
                    </th>
                    <th style={styles.th}>
                      Instrument
                    </th>
                    <th style={styles.th}>
                      Invested
                    </th>
                    <th style={styles.th}>
                      Realised
                    </th>
                    <th style={styles.th}>
                      Fair value
                    </th>
                    <th style={styles.th}>
                      MOIC
                    </th>
                    <th style={styles.th}>
                      IRR
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {portfolioMetrics
                    .slice(0, 12)
                    .map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <strong>
                            {item.portfolio_company ||
                              item.portfolio_code}
                          </strong>
                          <div style={styles.muted}>
                            {item.portfolio_code}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {item.instrument_type ||
                            "Not available"}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.invested_capital,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.realised_proceeds,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.terminal_fair_value,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMultiple(
                            item.gross_moic
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatPercent(
                            item.gross_irr
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>
            Investor Performance Preview
          </h2>

          {investorMetrics.length === 0 ? (
            <div style={styles.emptyState}>
              No investor calculations are
              available yet.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Investor
                    </th>
                    <th style={styles.th}>
                      Commitment
                    </th>
                    <th style={styles.th}>
                      Paid-in
                    </th>
                    <th style={styles.th}>
                      Distribution
                    </th>
                    <th style={styles.th}>
                      Allocated NAV
                    </th>
                    <th style={styles.th}>
                      TVPI
                    </th>
                    <th style={styles.th}>
                      Net IRR
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {investorMetrics
                    .slice(0, 12)
                    .map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <strong>
                            {item.investor_name ||
                              item.investor_code}
                          </strong>
                          <div style={styles.muted}>
                            {item.investor_code}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.commitment_amount,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.paid_in_capital,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.total_distributions,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMoney(
                            item.allocated_nav,
                            currency
                          )}
                        </td>

                        <td style={styles.td}>
                          {formatMultiple(item.tvpi)}
                        </td>

                        <td style={styles.td}>
                          {formatPercent(item.net_irr)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}