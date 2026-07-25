"use client";

import { useMemo, useState } from "react";

type PortfolioRow = {
  id: string;
  companyName: string;
  fundName: string;
  investmentDate: string;
  instrumentType: string;
  sector: string;
  investmentCost: number;
  currentValue: number;
  realisedValue: number;
  expectedExitValue: number;
  expectedExitDate: string;
  repaymentDueDate: string;
  interestRate: number;
  securityOrCharge: string;
  covenants: string;
  riskStatus: "Healthy" | "Watch" | "At Risk";
  latestUpdate: string;
};

const sampleRows: PortfolioRow[] = [
  {
    id: "P001",
    companyName: "Aarav Fintech Pvt Ltd",
    fundName: "VENTIQ Growth Fund II",
    investmentDate: "2024-04-15",
    instrumentType: "Equity",
    sector: "Fintech",
    investmentCost: 25000000,
    currentValue: 42000000,
    realisedValue: 0,
    expectedExitValue: 80000000,
    expectedExitDate: "2028-03-31",
    repaymentDueDate: "",
    interestRate: 0,
    securityOrCharge: "",
    covenants: "",
    riskStatus: "Healthy",
    latestUpdate: "Revenue growing, follow-on evaluation pending.",
  },
  {
    id: "P002",
    companyName: "Vihan Logistics Pvt Ltd",
    fundName: "VENTIQ Growth Fund II",
    investmentDate: "2024-09-20",
    instrumentType: "Venture Debt",
    sector: "Logistics",
    investmentCost: 40000000,
    currentValue: 41000000,
    realisedValue: 8500000,
    expectedExitValue: 45000000,
    expectedExitDate: "2027-06-30",
    repaymentDueDate: "2026-09-30",
    interestRate: 14,
    securityOrCharge: "First pari-passu charge on receivables",
    covenants: "DSCR to remain above 1.25x",
    riskStatus: "Watch",
    latestUpdate: "Repayment due in next quarter. Covenant monitoring required.",
  },
  {
    id: "P003",
    companyName: "Diya Healthtech Pvt Ltd",
    fundName: "VENTIQ Growth Fund II",
    investmentDate: "2025-01-10",
    instrumentType: "CCPS",
    sector: "Healthcare",
    investmentCost: 30000000,
    currentValue: 27000000,
    realisedValue: 0,
    expectedExitValue: 55000000,
    expectedExitDate: "2029-03-31",
    repaymentDueDate: "",
    interestRate: 0,
    securityOrCharge: "",
    covenants: "",
    riskStatus: "At Risk",
    latestUpdate: "Growth below plan. Valuation review required.",
  },
];

function formatCr(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${(Math.abs(value) / 10000000).toFixed(2)} Cr`;
}

function calculateMoic(row: PortfolioRow) {
  if (!row.investmentCost) return 0;
  return (row.currentValue + row.realisedValue) / row.investmentCost;
}

function calculateUnrealisedGain(row: PortfolioRow) {
  return row.currentValue - row.investmentCost;
}

function getRiskClass(riskStatus: PortfolioRow["riskStatus"]) {
  if (riskStatus === "Healthy") return "healthy";
  if (riskStatus === "Watch") return "watch";
  return "at-risk";
}

function downloadPortfolioTemplate() {
  const headers = [
    "portfolio_company",
    "fund_name",
    "investment_date",
    "instrument_type",
    "sector",
    "investment_cost",
    "current_value",
    "realised_value",
    "expected_exit_value",
    "expected_exit_date",
    "repayment_due_date",
    "interest_rate",
    "security_or_charge",
    "covenants",
    "risk_status",
    "latest_update",
  ];

  const sample = [
    "ABC Fintech Pvt Ltd",
    "VENTIQ Growth Fund II",
    "2024-04-15",
    "Equity",
    "Fintech",
    "25000000",
    "42000000",
    "0",
    "80000000",
    "2028-03-31",
    "",
    "",
    "",
    "",
    "Healthy",
    "Revenue growing, follow-on evaluation pending",
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
  link.download = "ventiq-portfolio-data-template.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function PortfolioDataMigrationPage() {
  const [rows] = useState<PortfolioRow[]>(sampleRows);
  const [message, setMessage] = useState("");

  function handleFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setMessage(
      `${fileList.length} portfolio file staged. CSV/XLSX parsing and Supabase publishing will be connected in the next step.`
    );
  }

  const metrics = useMemo(() => {
    const totalCost = rows.reduce((sum, row) => sum + row.investmentCost, 0);
    const currentValue = rows.reduce((sum, row) => sum + row.currentValue, 0);
    const realisedValue = rows.reduce((sum, row) => sum + row.realisedValue, 0);
    const expectedExitValue = rows.reduce(
      (sum, row) => sum + row.expectedExitValue,
      0
    );

    const atRiskDeals = rows.filter((row) => row.riskStatus === "At Risk");
    const upcomingRepayments = rows.filter((row) => row.repaymentDueDate);

    const portfolioMoic = totalCost
      ? (currentValue + realisedValue) / totalCost
      : 0;

    return {
      totalCost,
      currentValue,
      realisedValue,
      expectedExitValue,
      portfolioMoic,
      atRiskDeals: atRiskDeals.length,
      upcomingRepayments: upcomingRepayments.length,
    };
  }, [rows]);

  return (
    <main className="portfolio-migration-page">
      <section className="portfolio-shell">
        <div className="portfolio-hero">
          <div>
            <p className="portfolio-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Portfolio Data Migration</h1>

            <p className="portfolio-hero-copy">
              Upload portfolio company, investment, valuation, exit, repayment
              and risk data. This becomes the operating layer for Portfolio
              Intelligence, Investment Team and Managing Partner dashboards.
            </p>

            <div className="portfolio-tags">
              <span>Portfolio cost</span>
              <span>Current value</span>
              <span>Exits</span>
              <span>Repayments</span>
              <span>Risk</span>
              <span>MP dashboard</span>
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

        <div className="portfolio-upload-card">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⇧</span>
              <div>
                <p className="portfolio-eyebrow">Portfolio Upload Workspace</p>
                <h2>Upload portfolio data using VENTIQ template</h2>
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
                Use VENTIQ fields for company, cost, instrument, valuation,
                exit, repayment, covenants and risk.
              </p>

              <button
                className="portfolio-primary-button"
                onClick={downloadPortfolioTemplate}
                type="button"
              >
                ↓ Download Portfolio Template
              </button>
            </div>

            <div className="portfolio-step-card">
              <span className="step-number">2</span>
              <h3>Upload completed file</h3>
              <p>
                Upload CSV/XLSX after filling portfolio company and investment
                records.
              </p>

              <label className="portfolio-dropzone">
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => handleFileSelected(event.target.files)}
                  type="file"
                />

                <span>⇧</span>
                <strong>Choose portfolio file</strong>
                <small>CSV/XLSX template upload</small>
              </label>
            </div>
          </div>

          {message && <div className="portfolio-note">{message}</div>}
        </div>

        <div className="portfolio-kpi-grid">
          <div className="portfolio-kpi-card blue">
            <span>₹</span>
            <p>Total investment cost</p>
            <h3>{formatCr(metrics.totalCost)}</h3>
          </div>

          <div className="portfolio-kpi-card green">
            <span>↗</span>
            <p>Current portfolio value</p>
            <h3>{formatCr(metrics.currentValue)}</h3>
          </div>

          <div className="portfolio-kpi-card purple">
            <span>◎</span>
            <p>Portfolio MOIC</p>
            <h3>{metrics.portfolioMoic.toFixed(2)}x</h3>
          </div>

          <div className="portfolio-kpi-card amber">
            <span>◇</span>
            <p>At-risk investments</p>
            <h3>{metrics.atRiskDeals}</h3>
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">▥</span>
              <div>
                <p className="portfolio-eyebrow">
                  Portfolio Migration Preview
                </p>
                <h2>Investment records staged for dashboard activation</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">{rows.length} records</span>
          </div>

          <div className="portfolio-record-list">
            {rows.map((row) => (
              <details className="portfolio-record-card" key={row.id}>
                <summary>
                  <div className={`company-icon ${getRiskClass(row.riskStatus)}`}>
                    {row.companyName.charAt(0)}
                  </div>

                  <div className="company-main">
                    <strong>{row.companyName}</strong>
                    <span>{row.sector}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Instrument</small>
                    <span>{row.instrumentType}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Cost</small>
                    <span>{formatCr(row.investmentCost)}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Current value</small>
                    <span>{formatCr(row.currentValue)}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>MOIC</small>
                    <span>{calculateMoic(row).toFixed(2)}x</span>
                  </div>

                  <span className={`risk-badge ${getRiskClass(row.riskStatus)}`}>
                    {row.riskStatus}
                  </span>

                  <span className="record-chevron">⌄</span>
                </summary>

                <div className="portfolio-record-details">
                  <div>
                    <small>Investment date</small>
                    <strong>{row.investmentDate}</strong>
                  </div>
                  <div>
                    <small>Expected exit date</small>
                    <strong>{row.expectedExitDate || "Not provided"}</strong>
                  </div>
                  <div>
                    <small>Expected exit value</small>
                    <strong>{formatCr(row.expectedExitValue)}</strong>
                  </div>
                  <div>
                    <small>Latest update</small>
                    <strong>{row.latestUpdate}</strong>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">◷</span>
              <div>
                <p className="portfolio-eyebrow">
                  Debt & Repayment Intelligence
                </p>
                <h2>Repayment schedules and covenant tracking</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">
              {metrics.upcomingRepayments} repayment item
              {metrics.upcomingRepayments === 1 ? "" : "s"}
            </span>
          </div>

          <div className="repayment-list">
            {rows
              .filter((row) => row.repaymentDueDate)
              .map((row) => (
                <div className="repayment-card" key={`${row.id}-repayment`}>
                  <div className="company-icon watch">R</div>

                  <div>
                    <small>Company</small>
                    <strong>{row.companyName}</strong>
                  </div>

                  <div>
                    <small>Repayment due</small>
                    <strong className="positive">{row.repaymentDueDate}</strong>
                  </div>

                  <div>
                    <small>Interest rate</small>
                    <strong>{row.interestRate}%</strong>
                  </div>

                  <div>
                    <small>Security</small>
                    <strong>{row.securityOrCharge || "Not provided"}</strong>
                  </div>

                  <div>
                    <small>Covenant</small>
                    <strong>{row.covenants || "Not provided"}</strong>
                  </div>

                  <span className="risk-badge healthy">On Track</span>
                </div>
              ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">↗</span>
              <div>
                <p className="portfolio-eyebrow">Exit & Value Creation</p>
                <h2>Expected exit visibility for Managing Partner</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">
              {formatCr(metrics.expectedExitValue)} expected exit value
            </span>
          </div>

          <div className="exit-card-grid">
            {rows.map((row) => {
              const gain = calculateUnrealisedGain(row);

              return (
                <div
                  className={`exit-card ${getRiskClass(row.riskStatus)}`}
                  key={`${row.id}-exit`}
                >
                  <div className="company-icon-row">
                    <div className={`company-icon ${getRiskClass(row.riskStatus)}`}>
                      {row.companyName.charAt(0)}
                    </div>

                    <strong>{row.companyName}</strong>
                  </div>

                  <dl>
                    <div>
                      <dt>Expected exit date</dt>
                      <dd>{row.expectedExitDate || "Not provided"}</dd>
                    </div>

                    <div>
                      <dt>Expected exit value</dt>
                      <dd>{formatCr(row.expectedExitValue)}</dd>
                    </div>

                    <div>
                      <dt>Unrealised gain/loss</dt>
                      <dd className={gain >= 0 ? "positive" : "negative"}>
                        {formatCr(gain)}
                      </dd>
                    </div>

                    <div>
                      <dt>Latest update</dt>
                      <dd>{row.latestUpdate}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⌘</span>
              <div>
                <h2>Where this portfolio data flows</h2>
              </div>
            </div>
          </div>

          <div className="portfolio-flow-grid">
            <div className="portfolio-flow-card blue">
              <span>◔</span>
              <strong>Portfolio Intelligence</strong>
              <p>
                Company-wise cost, value, risk, updates, repayments and exit
                visibility.
              </p>
            </div>

            <div className="portfolio-flow-card green">
              <span>●</span>
              <strong>Investment Team Workspace</strong>
              <p>
                Deal monitoring, covenants, important dates, follow-on actions
                and risk notes.
              </p>
            </div>

            <div className="portfolio-flow-card purple">
              <span>▥</span>
              <strong>Managing Partner Dashboard</strong>
              <p>
                Portfolio MOIC, expected exits, realised value, unrealised
                value, best / worst investments and concentration.
              </p>
            </div>

            <div className="portfolio-flow-card amber">
              <span>◷</span>
              <strong>Repayment Notice Engine</strong>
              <p>
                Debt repayment schedules can trigger investee company notices
                and finance team follow-ups.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}