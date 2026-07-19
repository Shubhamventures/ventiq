"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ImportBatch = {
  id: string;
  batch_name: string;
  fund_name: string;
  total_records: number;
  total_commitment: number;
  status: string;
  created_at: string;
};

type CommitmentRow = {
  id: string;
  batch_id: string;
  investor_id: string;
  fund_name: string;
  class_name: string;
  commitment_amount: number;
  unfunded_commitment: number;
  commitment_status: string;
};

type InvestorRow = {
  id: string;
  investor_code: string;
  investor_name: string;
  email: string;
  investor_type: string;
  kyc_status: string;
  bank_status: string;
};

type JoinedCommitment = CommitmentRow & {
  investor?: InvestorRow;
};

type AllocationRow = JoinedCommitment & {
  callAmount: number;
  exceptionNotes: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCr(value: number) {
  return `INR ${(value / 10000000).toFixed(2)} Cr`;
}

function getNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

export default function CapitalCallAllocationPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [commitments, setCommitments] = useState<JoinedCommitment[]>([]);
  const [callMethod, setCallMethod] = useState<"percentage" | "amount">(
    "percentage"
  );
  const [callPercentage, setCallPercentage] = useState(10);
  const [targetCallAmount, setTargetCallAmount] = useState(100000000);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState("");

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadCommitments(selectedBatchId);
    }
  }, [selectedBatchId]);

  async function loadBatches() {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabaseClient
      .from("investor_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    const loadedBatches = (data || []) as ImportBatch[];

    setBatches(loadedBatches);

    if (loadedBatches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(loadedBatches[0].id);
    }

    setIsLoading(false);
  }

  async function loadCommitments(batchId: string) {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    setIsLoading(true);
    setMessage("Loading imported commitments...");

    const { data: commitmentData, error: commitmentError } = await supabaseClient
      .from("fund_commitments")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (commitmentError) {
      setMessage(commitmentError.message);
      setIsLoading(false);
      return;
    }

    const commitmentRows = (commitmentData || []) as CommitmentRow[];
    const investorIds = commitmentRows
      .map((row) => row.investor_id)
      .filter(Boolean);

    const { data: investorData, error: investorError } = await supabaseClient
      .from("investor_master")
      .select("*")
      .in("id", investorIds);

    if (investorError) {
      setMessage(investorError.message);
      setIsLoading(false);
      return;
    }

    const investorRows = (investorData || []) as InvestorRow[];
    const investorById = new Map<string, InvestorRow>();

    investorRows.forEach((investor) => {
      investorById.set(investor.id, investor);
    });

    const joinedRows = commitmentRows.map((commitment) => ({
      ...commitment,
      investor: investorById.get(commitment.investor_id),
    }));

    setCommitments(joinedRows);
    setSavedBatchId("");
    setMessage(`${joinedRows.length} commitments loaded for allocation.`);
    setIsLoading(false);
  }

  const selectedBatch = useMemo(() => {
    return batches.find((batch) => batch.id === selectedBatchId);
  }, [batches, selectedBatchId]);

  const allocationRows = useMemo<AllocationRow[]>(() => {
    const totalUnfunded = commitments.reduce(
      (sum, commitment) => sum + getNumber(commitment.unfunded_commitment),
      0
    );

    return commitments.map((commitment) => {
      const unfundedCommitment = getNumber(commitment.unfunded_commitment);

      let callAmount = 0;

      if (callMethod === "percentage") {
        callAmount = unfundedCommitment * (callPercentage / 100);
      } else if (totalUnfunded > 0) {
        callAmount = targetCallAmount * (unfundedCommitment / totalUnfunded);
      }

      callAmount = Math.min(callAmount, unfundedCommitment);

      const exceptions: string[] = [];

      if (commitment.investor?.kyc_status !== "Completed") {
        exceptions.push("KYC pending");
      }

      if (commitment.investor?.bank_status !== "Verified") {
        exceptions.push("Bank not verified");
      }

      if (unfundedCommitment <= 0) {
        exceptions.push("No unfunded commitment");
      }

      return {
        ...commitment,
        callAmount,
        exceptionNotes: exceptions.join(", "),
      };
    });
  }, [commitments, callMethod, callPercentage, targetCallAmount]);

  const allocationStats = useMemo(() => {
    const totalCommitment = commitments.reduce(
      (sum, commitment) => sum + getNumber(commitment.commitment_amount),
      0
    );

    const totalUnfunded = commitments.reduce(
      (sum, commitment) => sum + getNumber(commitment.unfunded_commitment),
      0
    );

    const totalCallAmount = allocationRows.reduce(
      (sum, row) => sum + row.callAmount,
      0
    );

    const exceptionCount = allocationRows.filter(
      (row) => row.exceptionNotes.length > 0
    ).length;

    const classAAmount = allocationRows
      .filter((row) => row.class_name === "Class A")
      .reduce((sum, row) => sum + row.callAmount, 0);

    const classBAmount = allocationRows
      .filter((row) => row.class_name === "Class B")
      .reduce((sum, row) => sum + row.callAmount, 0);

    return {
      investorCount: allocationRows.length,
      totalCommitment,
      totalUnfunded,
      totalCallAmount,
      exceptionCount,
      classAAmount,
      classBAmount,
    };
  }, [commitments, allocationRows]);

  async function handleSaveDraft() {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    if (!selectedBatch) {
      setMessage("Select an imported investor batch first.");
      return;
    }

    if (allocationRows.length === 0) {
      setMessage("No allocation rows available to save.");
      return;
    }

    setIsSaving(true);
    setMessage("Saving capital call allocation draft...");

    try {
      const { data: draftBatch, error: draftBatchError } = await supabaseClient
        .from("capital_call_allocation_batches")
        .insert({
          import_batch_id: selectedBatch.id,
          call_name: `Capital Call Draft - ${new Date().toLocaleDateString(
            "en-IN"
          )}`,
          fund_name: selectedBatch.fund_name,
          call_method: callMethod,
          call_percentage: callMethod === "percentage" ? callPercentage : 0,
          target_call_amount:
            callMethod === "amount" ? targetCallAmount : allocationStats.totalCallAmount,
          calculated_call_amount: allocationStats.totalCallAmount,
          investor_count: allocationStats.investorCount,
          exception_count: allocationStats.exceptionCount,
          status: "draft",
        })
        .select("id")
        .single();

      if (draftBatchError || !draftBatch) {
        throw draftBatchError || new Error("Unable to create allocation draft.");
      }

      const allocationBatchId = String(draftBatch.id);

      const rowsToInsert = allocationRows.map((row) => ({
        allocation_batch_id: allocationBatchId,
        investor_id: row.investor_id,
        commitment_id: row.id,
        investor_code: row.investor?.investor_code || "",
        investor_name: row.investor?.investor_name || "",
        email: row.investor?.email || "",
        class_name: row.class_name,
        commitment_amount: row.commitment_amount,
        unfunded_commitment: row.unfunded_commitment,
        call_amount: row.callAmount,
        kyc_status: row.investor?.kyc_status || "",
        bank_status: row.investor?.bank_status || "",
        exception_notes: row.exceptionNotes,
        status: row.exceptionNotes ? "exception" : "ready",
      }));

      const chunks = chunkRows(rowsToInsert, 250);

      for (const chunk of chunks) {
        const { error: rowError } = await supabaseClient
          .from("capital_call_allocation_rows")
          .insert(chunk);

        if (rowError) {
          throw rowError;
        }
      }

      setSavedBatchId(allocationBatchId);
      setMessage(
        "Capital call allocation draft saved. Investor-wise allocation rows are now stored."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to save draft.";
      setMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="allocation-page">
      <style>{`
        .allocation-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 34rem),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 30rem),
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
          align-items: center;
          gap: 20px;
          margin-bottom: 44px;
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
          grid-template-columns: 1.1fr 0.9fr;
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
          font-size: 25px;
          margin-bottom: 6px;
        }

        .control-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-top: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #9eb2d4;
          font-size: 13px;
          font-weight: 800;
        }

        select,
        input {
          width: 100%;
          border: 1px solid rgba(147, 197, 253, 0.2);
          background: rgba(7, 12, 24, 0.85);
          color: #f8fbff;
          border-radius: 16px;
          min-height: 46px;
          padding: 0 14px;
          font-size: 15px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
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

        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }

        .list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .list-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.62);
          border-radius: 18px;
          padding: 15px;
        }

        .list-row span {
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
          min-width: 1000px;
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

        .ready {
          color: #86efac;
          font-weight: 900;
        }

        .exception {
          color: #fbbf24;
          font-weight: 900;
        }

        @media (max-width: 980px) {
          .allocation-page {
            padding: 20px;
          }

          .hero,
          .stat-grid,
          .control-grid,
          .split-grid {
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
            <span>Capital Call Allocation Engine</span>
          </div>

          <div className="nav-links">
            <a href="/investor-import">Investor Import</a>
            <a href="/finance-head-ai">Finance Workspace</a>
            <a href="/">Home</a>
          </div>
        </nav>

        <section className="hero">
          <div>
            <p className="eyebrow">Investor-wise allocation engine</p>
            <h1>Turn 600 commitments into a capital call draft.</h1>
            <p>
              Select an imported investor batch, calculate call amounts using a
              percentage or target amount, review exceptions, and save
              investor-wise allocation rows for the finance workflow.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Commercial proof</p>
            <h2>Investor Import to Capital Call</h2>
            <p>
              This connects the first commercial data layer to a real operating
              workflow: commitments become capital call allocations, exceptions
              become finance review items, and drafts become approval-ready.
            </p>
          </div>
        </section>

        <section className="stat-grid">
          <div className="stat">
            <span>Investors loaded</span>
            <strong>{allocationStats.investorCount}</strong>
            <small>From selected batch</small>
          </div>

          <div className="stat">
            <span>Total commitment</span>
            <strong>{formatCr(allocationStats.totalCommitment)}</strong>
            <small>Imported commitments</small>
          </div>

          <div className="stat">
            <span>Calculated call</span>
            <strong>{formatCr(allocationStats.totalCallAmount)}</strong>
            <small>Investor-wise total</small>
          </div>

          <div className="stat">
            <span>Exceptions</span>
            <strong>{allocationStats.exceptionCount}</strong>
            <small>KYC, bank or unfunded issues</small>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Allocation controls</p>
          <h2>Create capital call allocation</h2>
          <p>
            Load the imported batch, choose the call method and save a draft
            allocation batch after reviewing the output.
          </p>

          <div className="control-grid">
            <label>
              Imported batch
              <select
                value={selectedBatchId}
                onChange={(event) => setSelectedBatchId(event.target.value)}
              >
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_name} - {batch.fund_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Call method
              <select
                value={callMethod}
                onChange={(event) =>
                  setCallMethod(event.target.value as "percentage" | "amount")
                }
              >
                <option value="percentage">Percentage of unfunded commitment</option>
                <option value="amount">Target total call amount</option>
              </select>
            </label>

            {callMethod === "percentage" ? (
              <label>
                Call percentage
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={callPercentage}
                  onChange={(event) =>
                    setCallPercentage(getNumber(event.target.value))
                  }
                />
              </label>
            ) : (
              <label>
                Target call amount
                <input
                  type="number"
                  min="0"
                  value={targetCallAmount}
                  onChange={(event) =>
                    setTargetCallAmount(getNumber(event.target.value))
                  }
                />
              </label>
            )}
          </div>

          <div className="button-row">
            <button
              className="secondary"
              disabled={isLoading || !selectedBatchId}
              onClick={() => loadCommitments(selectedBatchId)}
            >
              {isLoading ? "Loading..." : "Reload Commitments"}
            </button>

            <button
              className="primary"
              disabled={isSaving || allocationRows.length === 0}
              onClick={handleSaveDraft}
            >
              {isSaving ? "Saving..." : "Save Allocation Draft"}
            </button>
          </div>

          {message && <div className="message">{message}</div>}

          {savedBatchId && (
            <div className="message">
              Allocation draft created: <strong>{savedBatchId}</strong>
            </div>
          )}
        </section>

        <section className="split-grid">
          <div className="card">
            <p className="eyebrow">Allocation summary</p>
            <h2>Class-wise call split</h2>

            <div className="list">
              <div className="list-row">
                <span>Class A call amount</span>
                <strong>{formatAmount(allocationStats.classAAmount)}</strong>
              </div>

              <div className="list-row">
                <span>Class B call amount</span>
                <strong>{formatAmount(allocationStats.classBAmount)}</strong>
              </div>

              <div className="list-row">
                <span>Total unfunded commitment</span>
                <strong>{formatAmount(allocationStats.totalUnfunded)}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Finance impact</p>
            <h2>What Finance Head sees next</h2>

            <div className="list">
              <div className="list-row">
                <span>Ready allocations</span>
                <strong>
                  {allocationStats.investorCount - allocationStats.exceptionCount}
                </strong>
              </div>

              <div className="list-row">
                <span>Exception review queue</span>
                <strong>{allocationStats.exceptionCount}</strong>
              </div>

              <div className="list-row">
                <span>Next workflow</span>
                <strong>Notice generation</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 24 }}>
          <p className="eyebrow">Allocation preview</p>
          <h2>First 20 investor-wise allocations</h2>
          <p>
            This preview uses the imported commitment records. Saving the draft
            stores all investor-wise allocation rows in Supabase.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Email</th>
                  <th>Class</th>
                  <th>Commitment</th>
                  <th>Unfunded</th>
                  <th>Call amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {allocationRows.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.investor?.investor_code} -{" "}
                      {row.investor?.investor_name}
                    </td>
                    <td>{row.investor?.email}</td>
                    <td>{row.class_name}</td>
                    <td>{formatAmount(getNumber(row.commitment_amount))}</td>
                    <td>{formatAmount(getNumber(row.unfunded_commitment))}</td>
                    <td>{formatAmount(row.callAmount)}</td>
                    <td className={row.exceptionNotes ? "exception" : "ready"}>
                      {row.exceptionNotes || "Ready"}
                    </td>
                  </tr>
                ))}

                {allocationRows.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      No commitments loaded yet. Import investors first, then
                      select the latest batch here.
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
