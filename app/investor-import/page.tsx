"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

type InsertedInvestor = {
  id: string;
  investor_code: string;
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
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [message, setMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [batchId, setBatchId] = useState("");

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
    setInvestors(generateInvestors(600));
    setBatchId("");
    setMessage("600 investor records generated for VENTIQ Growth Fund II.");
  }

  async function handleImport() {
    if (investors.length === 0) {
      setMessage("Generate investor records first.");
      return;
    }

        const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    setIsImporting(true);
    setMessage("Importing investor master and commitment records...");

    try {
      const { data: batch, error: batchError } = await supabaseClient
        .from("investor_import_batches")
        .insert({
          batch_name: `600 investor import - ${new Date().toLocaleDateString(
            "en-IN"
          )}`,
          fund_name: "VENTIQ Growth Fund II",
          source: "sample_600",
          total_records: investors.length,
          total_commitment: stats.totalCommitment,
          status: "importing",
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        throw batchError || new Error("Batch creation failed.");
      }

      const newBatchId = String(batch.id);

      const investorRows = investors.map((investor) => ({
        batch_id: newBatchId,
        investor_code: investor.investorCode,
        investor_name: investor.investorName,
        email: investor.email,
        investor_type: investor.investorType,
        country: investor.country,
        tax_id: investor.investorCode,
        kyc_status: investor.kycStatus,
        bank_status: investor.bankStatus,
        onboarding_status: "Active",
      }));

      const { data: insertedInvestors, error: investorError } = await supabaseClient
        .from("investor_master")
        .insert(investorRows)
        .select("id, investor_code");

      if (investorError || !insertedInvestors) {
        throw investorError || new Error("Investor import failed.");
      }

      const investorIdByCode = new Map<string, string>();

      (insertedInvestors as InsertedInvestor[]).forEach((investor) => {
        investorIdByCode.set(investor.investor_code, investor.id);
      });

      const commitmentRows = investors.map((investor) => ({
        batch_id: newBatchId,
        investor_id: investorIdByCode.get(investor.investorCode),
        fund_name: "VENTIQ Growth Fund II",
        class_name: investor.className,
        commitment_amount: investor.commitmentAmount,
        unfunded_commitment: investor.commitmentAmount,
        commitment_status: "Active",
      }));

      const { error: commitmentError } = await supabaseClient 
        .from("fund_commitments")
        .insert(commitmentRows);

      if (commitmentError) {
        throw commitmentError;
      }

      await supabaseClient
        .from("investor_import_batches")
        .update({
          status: "imported",
          updated_at: new Date().toISOString(),
        })
        .eq("id", newBatchId);

      setBatchId(newBatchId);
      setMessage(
        "Import completed. 600 investors and 600 commitment records are now stored."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Import failed.";
      setMessage(errorMessage);
    } finally {
      setIsImporting(false);
    }
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
            <span>Investor Import Engine</span>
          </div>

          <div className="nav-links">
            <a href="/migration">Migration</a>
            <a href="/capital-call">Capital Call</a>
            <a href="/">Home</a>
          </div>
        </nav>

        <section className="hero">
          <div>
            <p className="eyebrow">Commercial data foundation</p>
            <h1>Import investors. Create commitments. Power capital calls.</h1>
            <p>
              This engine converts investor master data and commitment records
              into the structured fund data layer required for capital calls,
              finance dashboards, investor portals and performance reporting.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">First commercial milestone</p>
            <h2>600-investor fund simulation</h2>
            <p>
              Generate 600 investor records, store them in Supabase, create
              commitment records and prepare the next capital call allocation
              engine.
            </p>
          </div>
        </section>

        <section className="stat-grid">
          <div className="stat">
            <span>Investor records</span>
            <strong>{stats.totalInvestors}</strong>
            <small>Generated for import</small>
          </div>

          <div className="stat">
            <span>Total commitment</span>
            <strong>{formatCr(stats.totalCommitment)}</strong>
            <small>Across selected fund</small>
          </div>

          <div className="stat">
            <span>KYC completed</span>
            <strong>{stats.kycCompleted}</strong>
            <small>Ready records</small>
          </div>

          <div className="stat">
            <span>Bank verified</span>
            <strong>{stats.bankVerified}</strong>
            <small>Payment-ready investors</small>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Import control</p>
          <h2>Create the investor dataset</h2>
          <p>
            Generate a 600-investor sample dataset, then import investor master
            and commitment records into Supabase.
          </p>

          <div className="button-row">
            <button className="primary" onClick={handleGenerate}>
              Generate 600 Investors
            </button>

            <button
              className="secondary"
              disabled={isImporting || investors.length === 0}
              onClick={handleImport}
            >
              {isImporting ? "Importing..." : "Import to Supabase"}
            </button>
          </div>

          {message && <div className="message">{message}</div>}

          {batchId && (
            <div className="message">
              Import batch created: <strong>{batchId}</strong>
            </div>
          )}
        </section>

        <section className="grid-two">
          <div className="card">
            <p className="eyebrow">Readiness summary</p>
            <h2>Data quality view</h2>
            <p>
              Investor master, commitment, KYC and bank readiness must be
              visible before capital calls can run commercially.
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
                <strong>VENTIQ Growth Fund II</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Commercial flow</p>
            <h2>What this unlocks next</h2>

            <div className="check-list">
              <div className="check-row">
                <span>Step 1</span>
                <strong>Investor master imported</strong>
              </div>

              <div className="check-row">
                <span>Step 2</span>
                <strong>Commitments created</strong>
              </div>

              <div className="check-row">
                <span>Step 3</span>
                <strong>Capital call allocation ready</strong>
              </div>

              <div className="check-row">
                <span>Step 4</span>
                <strong>Finance dashboard impact</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 24 }}>
          <p className="eyebrow">Investor preview</p>
          <h2>Sample investor master records</h2>
          <p>
            Showing the first 12 rows from the generated dataset. Full import
            creates 600 investor records and 600 commitment records.
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
                      No investor records generated yet. Click Generate 600
                      Investors to begin.
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
