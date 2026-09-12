"use client";

import { useMemo, useState } from "react";
import { useActiveFund } from "@/lib/useActiveFund";

type InvestorRow = {
  investorCode: string;
  investorName: string;
  email: string;
  investorType: string;
  country: string;
  kycStatus: string;
  bankStatus: string;
  className: string;
  commitmentAmount: number;
};


const investorTypes = [
  "Individual",
  "HNI",
  "Family Office",
  "Corporate",
  "Trust",
  "Institution",
];

const firstNames = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Reyansh",
  "Anaya",
  "Diya",
  "Myra",
  "Saanvi",
];

const lastNames = [
  "Shah",
  "Mehta",
  "Jain",
  "Gupta",
  "Patel",
  "Rao",
  "Kapoor",
  "Bansal",
  "Desai",
  "Nair",
];

const commitmentSlabs = [
  2500000,
  5000000,
  7500000,
  10000000,
  15000000,
  25000000,
  50000000,
];

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCr(value: number) {
  return `INR ${(value / 10000000).toFixed(1)} Cr`;
}

function generateInvestors(total: number): InvestorRow[] {
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index * 2) % lastNames.length];

    return {
      investorCode: `INV-${String(number).padStart(4, "0")}`,
      investorName: `${firstName} ${lastName} ${number}`,
      email: `investor${number}@ventiqdemo.com`,
      investorType: investorTypes[index % investorTypes.length],
      country: index % 8 === 0 ? "Singapore" : "India",
      kycStatus: index % 9 === 0 ? "Pending" : "Completed",
      bankStatus: index % 11 === 0 ? "Pending" : "Verified",
      className: index % 5 === 0 ? "Class B" : "Class A",
      commitmentAmount: commitmentSlabs[index % commitmentSlabs.length],
    };
  });
}

export default function InvestorImportPage() {
  const { activeFundName, isReady: activeFundReady } = useActiveFund(
    "VENTIQ Growth Fund II"
  );
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [message, setMessage] = useState("");

  const stats = useMemo(() => {
    const totalCommitment = investors.reduce(
      (sum, investor) => sum + investor.commitmentAmount,
      0
    );

    const kycCompleted = investors.filter(
      (investor) => investor.kycStatus === "Completed"
    ).length;

    const bankVerified = investors.filter(
      (investor) => investor.bankStatus === "Verified"
    ).length;

    return {
      totalInvestors: investors.length,
      totalCommitment,
      kycCompleted,
      bankVerified,
      kycPending: investors.length - kycCompleted,
      bankPending: investors.length - bankVerified,
    };
  }, [investors]);

  function handleGenerate() {
    if (!activeFundReady || !activeFundName) {
      setMessage("Authenticated fund access is still loading.");
      return;
    }

    setInvestors(generateInvestors(600));
    setMessage(`600 synthetic investor records generated in memory for ${activeFundName}. Nothing was written to governed tables.`);
  }


  return (
    <main className="investor-import-page">
      <style>{`
        .investor-import-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 34rem),
            #070d1a;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 32px;
        }

        .shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          margin-bottom: 48px;
        }

        .brand strong {
          display: block;
          font-size: 18px;
          letter-spacing: 0.18em;
        }

        .brand span {
          color: #8ea4c8;
          font-size: 13px;
        }

        .nav-links {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .nav-links a {
          color: #dbeafe;
          text-decoration: none;
          border: 1px solid rgba(147, 197, 253, 0.28);
          background: rgba(15, 23, 42, 0.72);
          padding: 11px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 900;
          margin: 0 0 14px;
        }

        h1 {
          font-size: clamp(42px, 5.5vw, 70px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          margin: 0;
        }

        h2 {
          margin: 0 0 12px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        p {
          color: #bfd0ef;
          line-height: 1.6;
        }

        .card {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 13, 26, 0.92));
          border-radius: 28px;
          padding: 26px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 24px 0;
        }

        .stat {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 22px;
          padding: 20px;
        }

        .stat span {
          display: block;
          color: #8ea4c8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .stat strong {
          display: block;
          font-size: 28px;
          margin-bottom: 6px;
        }

        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        button {
          min-height: 46px;
          border-radius: 999px;
          padding: 0 20px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .primary {
          border: 0;
          background: #ffffff;
          color: #071022;
        }

        .secondary {
          border: 1px solid rgba(147, 197, 253, 0.28);
          background: rgba(15, 23, 42, 0.72);
          color: #dbeafe;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .message {
          margin-top: 18px;
          border: 1px solid rgba(96, 165, 250, 0.35);
          background: rgba(30, 64, 175, 0.2);
          color: #dbeafe;
          border-radius: 18px;
          padding: 16px;
          line-height: 1.6;
        }

        .grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }

        .check-list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .check-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.62);
          border-radius: 18px;
          padding: 15px;
        }

        .check-row span {
          color: #9eb2d4;
        }

        .table-wrap {
          margin-top: 20px;
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 22px;
        }

        table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(147, 197, 253, 0.1);
          text-align: left;
          font-size: 14px;
        }

        th {
          color: #93c5fd;
          background: rgba(15, 23, 42, 0.8);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        td {
          color: #dbeafe;
        }

        .good {
          color: #86efac;
          font-weight: 900;
        }

        .pending {
          color: #fbbf24;
          font-weight: 900;
        }

        @media (max-width: 980px) {
          .investor-import-page {
            padding: 20px;
          }

          .hero,
          .grid-two,
          .stat-grid {
            grid-template-columns: 1fr;
          }

          .nav {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="shell">
        <nav className="nav">
          <div className="brand">
            <strong>VENTIQ</strong>
            <span>Investor Import Simulation</span>
          </div>

          <div className="nav-links">
            <a href="/migration">Migration</a>
            <a href="/capital-call">Capital Call</a>
            <a href="/">Home</a>
          </div>
        </nav>

        <section className="hero">
          <div>
            <p className="eyebrow">Controlled synthetic simulation</p>
            <h1>Import investors. Create commitments. Power capital calls.</h1>
            <p>
              This page generates synthetic investor records in memory for UI
              and scale testing only. Governed investor imports must use the
              canonical Migration Data Intake workflow.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Simulation only</p>
            <h2>600-investor fund simulation</h2>
            <p>
              Generate 600 clearly synthetic investor records for local
              interface testing. This page cannot persist them into investor
              master, commitment or readiness tables.
            </p>
          </div>
        </section>

        <section className="stat-grid">
          <div className="stat">
            <span>Investor records</span>
            <strong>{stats.totalInvestors}</strong>
            <small>Synthetic in-memory records</small>
          </div>

          <div className="stat">
            <span>Total commitment</span>
            <strong>{formatCr(stats.totalCommitment)}</strong>
            <small>Synthetic simulation total</small>
          </div>

          <div className="stat">
            <span>KYC completed</span>
            <strong>{stats.kycCompleted}</strong>
            <small>Synthetic KYC status</small>
          </div>

          <div className="stat">
            <span>Bank verified</span>
            <strong>{stats.bankVerified}</strong>
            <small>Synthetic bank status</small>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Simulation control</p>
          <h2>Create a non-persistent synthetic dataset</h2>
          <p>
            Generate a 600-investor synthetic dataset for interface testing.
            Production data must enter through governed Migration Data Intake.
          </p>

          <div className="button-row">
            <button className="primary" onClick={handleGenerate}>
              Generate 600 Synthetic Investors
            </button>

            <a className="secondary" href="/migration/data-intake">
              Open Governed Data Intake
            </a>
          </div>

          {message && <div className="message">{message}</div>}
        </section>

        <section className="grid-two">
          <div className="card">
            <p className="eyebrow">Synthetic quality summary</p>
            <h2>Data quality view</h2>
            <p>
              These counts describe only the in-memory synthetic dataset.
              They do not indicate governed production readiness.
            </p>

            <div className="check-list">
              <div className="check-row">
                <span>KYC exceptions</span>
                <strong>{stats.kycPending}</strong>
              </div>

              <div className="check-row">
                <span>Bank exceptions</span>
                <strong>{stats.bankPending}</strong>
              </div>

              <div className="check-row">
                <span>Fund</span>
                <strong>{activeFundName}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Production path</p>
            <h2>Use governed intake for real records</h2>

            <div className="check-list">
              <div className="check-row">
                <span>Step 1</span>
                <strong>Upload governed investor master data</strong>
              </div>

              <div className="check-row">
                <span>Step 2</span>
                <strong>Validate canonical commitments</strong>
              </div>

              <div className="check-row">
                <span>Step 3</span>
                <strong>Resolve readiness exceptions</strong>
              </div>

              <div className="check-row">
                <span>Step 4</span>
                <strong>Activate through maker-checker controls</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 24 }}>
          <p className="eyebrow">Investor preview</p>
          <h2>Synthetic investor preview</h2>
          <p>
            Showing the first 12 rows from the generated in-memory dataset.
            These rows are not persisted and are not production fund records.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Investor</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Class</th>
                  <th>Commitment</th>
                  <th>KYC</th>
                  <th>Bank</th>
                </tr>
              </thead>

              <tbody>
                {investors.slice(0, 12).map((investor) => (
                  <tr key={investor.investorCode}>
                    <td>{investor.investorCode}</td>
                    <td>{investor.investorName}</td>
                    <td>{investor.email}</td>
                    <td>{investor.investorType}</td>
                    <td>{investor.className}</td>
                    <td>{formatAmount(investor.commitmentAmount)}</td>
                    <td
                      className={
                        investor.kycStatus === "Completed" ? "good" : "pending"
                      }
                    >
                      {investor.kycStatus}
                    </td>
                    <td
                      className={
                        investor.bankStatus === "Verified" ? "good" : "pending"
                      }
                    >
                      {investor.bankStatus}
                    </td>
                  </tr>
                ))}

                {investors.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      No synthetic investor records generated yet. Click Generate 600
                      Synthetic Investors to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
