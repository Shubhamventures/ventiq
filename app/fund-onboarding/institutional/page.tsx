"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";

type DataRow = Record<string, any>;

type BatchSnapshot = {
  batch: DataRow;
  rows: DataRow[];
  invitations: DataRow[];
  invitationRows: DataRow[];
};

type ParsedStageRow = {
  sourceRowNumber: number;
  fundName: string;
  investorCode: string;
  legalInvestorName: string;
  contactName: string;
  contactEmail: string;
  relationshipType: string;
};

const DEFAULT_HEADER = [
  "fund_name",
  "investor_code",
  "legal_investor_name",
  "contact_name",
  "contact_email",
  "relationship_type",
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function getCell(cells: string[], header: string[], names: string[]) {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index >= 0) return (cells[index] || "").trim();
  }
  return "";
}

function parseExcelPaste(text: string, fallbackFundName: string): ParsedStageRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());

  if (lines.length === 0) throw new Error("Paste at least one onboarding row from Excel.");

  const firstCells = lines[0].split("\t").map((cell) => cell.trim());
  const normalizedFirst = firstCells.map(normalizeHeader);
  const hasHeader =
    normalizedFirst.includes("investor_code") ||
    normalizedFirst.includes("contact_email") ||
    normalizedFirst.includes("legal_investor_name") ||
    normalizedFirst.includes("investor_name");

  const header = hasHeader ? normalizedFirst : DEFAULT_HEADER;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const firstSourceRow = hasHeader ? 2 : 1;

  const rows = dataLines.map((line, index) => {
    const cells = line.split("\t");
    const fundName =
      getCell(cells, header, ["fund_name", "fund"]) || fallbackFundName;
    const investorCode = getCell(cells, header, ["investor_code", "investor_id", "lp_code"]);
    const legalInvestorName = getCell(cells, header, [
      "legal_investor_name",
      "investor_name",
      "lp_name",
      "name",
    ]);
    const contactName = getCell(cells, header, ["contact_name", "representative_name"]);
    const contactEmail = getCell(cells, header, ["contact_email", "email", "email_id"]);
    const relationshipType =
      getCell(cells, header, ["relationship_type", "relationship"]) || "Investor";

    if (!fundName || !investorCode || !legalInvestorName || !contactEmail) {
      throw new Error(
        `Row ${firstSourceRow + index} is missing fund name, investor code, legal investor name, or contact email.`
      );
    }

    return {
      sourceRowNumber: firstSourceRow + index,
      fundName,
      investorCode,
      legalInvestorName,
      contactName,
      contactEmail,
      relationshipType,
    };
  });

  if (rows.length === 0) throw new Error("No onboarding data rows were found.");
  return rows;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function statusClass(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export default function InstitutionalOnboardingPage() {
  const { activeFundName, availableFundAccess, fundContextReady, session } = useVentiqAuth();
  const [batchName, setBatchName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [sourceKind, setSourceKind] = useState("Excel");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recentBatches, setRecentBatches] = useState<DataRow[]>([]);
  const [snapshot, setSnapshot] = useState<BatchSnapshot | null>(null);

  const accessToken = session?.access_token?.trim() || "";
  const editableFunds = useMemo(
    () => availableFundAccess.filter((fund) => fund.can_edit && fund.fund_name.trim()),
    [availableFundAccess]
  );

  const fallbackFundName = useMemo(() => {
    const active = editableFunds.find(
      (fund) => fund.fund_name.trim().toLowerCase() === activeFundName.trim().toLowerCase()
    );
    return active?.fund_name.trim() || editableFunds[0]?.fund_name.trim() || "";
  }, [activeFundName, editableFunds]);

  async function apiRequest(body?: Record<string, unknown>, batchId?: string) {
    if (!accessToken) throw new Error("Please sign in before using institutional onboarding.");

    const url = batchId
      ? `/api/fund-onboarding/institutional?batchId=${encodeURIComponent(batchId)}`
      : "/api/fund-onboarding/institutional";
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const result = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) throw new Error(result.error || "Institutional onboarding request failed.");
    return result;
  }

  async function refreshRecentBatches() {
    const result = await apiRequest();
    setRecentBatches(Array.isArray(result.batches) ? result.batches : []);
  }

  useEffect(() => {
    if (!fundContextReady || !accessToken) return;
    void refreshRecentBatches().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load onboarding batches.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundContextReady, accessToken]);

  async function createStageValidate() {
    setMessage("");
    setSnapshot(null);

    if (!batchName.trim()) {
      setMessage("Batch name is required.");
      return;
    }

    if (!fallbackFundName && editableFunds.length === 0) {
      setMessage("You need governed edit access to at least one fund before staging investors.");
      return;
    }

    let rows: ParsedStageRow[];
    try {
      rows = parseExcelPaste(pasteText, fallbackFundName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to parse pasted rows.");
      return;
    }

    setBusy(true);
    try {
      const sourceHash = await sha256Hex(pasteText);
      const created = await apiRequest({
        action: "create_batch",
        batchName: batchName.trim(),
        sourceKind,
        sourceFileName: sourceKind === "Excel" ? `${batchName.trim()}.clipboard.tsv` : null,
        sourceFileSha256: sourceHash,
      });

      const batchId = String(created.batch?.id || "");
      if (!batchId) throw new Error("The server did not return the new onboarding batch ID.");

      await apiRequest({ action: "stage_rows", batchId, rows });
      const validated = await apiRequest({ action: "validate_batch", batchId });

      setSnapshot({
        batch: validated.batch || {},
        rows: validated.rows || [],
        invitations: validated.invitations || [],
        invitationRows: validated.invitationRows || [],
      });
      setMessage(
        "Validation complete. This batch is staged only: no invitation was sent, no auth user was created, and no entitlement was activated."
      );
      await refreshRecentBatches();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Institutional onboarding validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openBatch(batchId: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest(undefined, batchId);
      setSnapshot({
        batch: result.batch || {},
        rows: result.rows || [],
        invitations: result.invitations || [],
        invitationRows: result.invitationRows || [],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open onboarding batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="institutional-page">
      <style>{`
        .institutional-page {
          min-height: 100vh;
          background: radial-gradient(circle at top left, rgba(37,99,235,.20), transparent 34rem), #07101f;
          color: #f8fbff;
          padding: 26px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell { max-width: 1320px; margin: 0 auto; }
        .hero, .panel {
          border: 1px solid rgba(147,197,253,.16);
          background: rgba(15,23,42,.78);
          border-radius: 22px;
          box-shadow: 0 18px 60px rgba(0,0,0,.18);
        }
        .hero { padding: 24px; margin-bottom: 18px; }
        .panel { padding: 22px; margin-bottom: 18px; }
        .top, .panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .eyebrow { margin:0 0 10px; color:#f5c85b; text-transform:uppercase; letter-spacing:.14em; font-size:11px; font-weight:900; }
        h1, h2 { margin:0; letter-spacing:-.035em; }
        h1 { font-size: clamp(30px,4vw,44px); }
        h2 { font-size:24px; }
        p { color:#aebfd4; line-height:1.55; }
        .actions { display:flex; gap:10px; flex-wrap:wrap; }
        .button { border:0; border-radius:999px; padding:11px 16px; font:inherit; font-weight:900; cursor:pointer; text-decoration:none; }
        .primary { background:#f5c85b; color:#07101f; }
        .secondary { background:rgba(15,23,42,.8); color:#dbeafe; border:1px solid rgba(147,197,253,.24); }
        .button:disabled { opacity:.55; cursor:not-allowed; }
        .guardrail { margin-top:16px; border:1px solid rgba(34,197,94,.25); background:rgba(22,163,74,.10); border-radius:16px; padding:13px 15px; color:#bbf7d0; font-weight:800; }
        .grid { display:grid; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); gap:18px; }
        .field { display:grid; gap:7px; margin-top:13px; }
        label { color:#c7d7f4; font-size:12px; font-weight:900; }
        input, select, textarea { width:100%; box-sizing:border-box; border:1px solid rgba(147,197,253,.18); background:rgba(2,6,23,.38); color:white; border-radius:13px; padding:11px 12px; font:inherit; outline:none; }
        textarea { min-height:260px; resize:vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
        .hint { color:#7f96b6; font-size:11px; line-height:1.5; }
        .message { margin-top:14px; color:#fde68a; font-weight:850; line-height:1.5; }
        .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:16px; }
        .stat { border:1px solid rgba(147,197,253,.13); background:rgba(2,6,23,.28); border-radius:15px; padding:13px; }
        .stat span { display:block; color:#8ea4c3; font-size:11px; }
        .stat strong { display:block; margin-top:4px; font-size:22px; }
        .table-wrap { overflow-x:auto; border:1px solid rgba(147,197,253,.13); border-radius:16px; margin-top:16px; }
        table { width:100%; border-collapse:collapse; min-width:1120px; }
        th, td { padding:11px; border-bottom:1px solid rgba(147,197,253,.10); text-align:left; vertical-align:top; }
        th { color:#8ea4c3; text-transform:uppercase; font-size:10px; letter-spacing:.07em; }
        td { color:#eaf2ff; font-size:12px; }
        .pill { display:inline-flex; border-radius:999px; padding:6px 8px; background:rgba(59,130,246,.18); color:#bfdbfe; font-weight:850; white-space:nowrap; }
        .pill-valid, .pill-ready, .pill-validated, .pill-existing-user { background:rgba(22,163,74,.18); color:#bbf7d0; }
        .pill-review-required, .pill-review, .pill-new-user { background:rgba(245,158,11,.18); color:#fde68a; }
        .pill-invalid, .pill-conflict, .pill-excluded { background:rgba(239,68,68,.18); color:#fecaca; }
        .recent { display:grid; gap:9px; margin-top:14px; }
        .recent-row { display:flex; justify-content:space-between; gap:14px; align-items:center; padding:12px; border:1px solid rgba(147,197,253,.12); border-radius:14px; }
        .funds { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
        .fund-chip { border:1px solid rgba(147,197,253,.16); border-radius:999px; padding:6px 9px; color:#c7d7f4; font-size:11px; }
        @media (max-width: 980px) { .grid { grid-template-columns:1fr; } .stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .top,.panel-head { flex-direction:column; } }
      `}</style>

      <section className="shell">
        <div className="hero">
          <div className="top">
            <div>
              <p className="eyebrow">T2 Institutional Onboarding</p>
              <h1>Stage and validate investor access before approval.</h1>
              <p>
                Create a governed onboarding batch, resolve funds, investor master records,
                human identity and entitlement deltas, then prepare one draft invitation
                identity per human email.
              </p>
            </div>
            <div className="actions">
              <Link className="button secondary" href="/fund-onboarding">Back to Fund Setup</Link>
              <Link className="button secondary" href="/admin/audit-workflow">Approval Workflow</Link>
            </div>
          </div>
          <div className="guardrail">
            Staging only. This page does not send email, create auth users, create fund/investor entitlements, or approve/activate access.
          </div>
          <div className="funds">
            {editableFunds.map((fund) => (
              <span className="fund-chip" key={fund.fund_name}>{fund.fund_name}</span>
            ))}
            {editableFunds.length === 0 && <span className="fund-chip">No editable governed funds</span>}
          </div>
        </div>

        <div className="grid">
          <div className="panel">
            <h2>Create validation batch</h2>
            <p>Paste rows copied directly from Excel. Tab-separated columns preserve a controlled, reviewable source footprint.</p>

            <div className="field">
              <label>Batch name</label>
              <input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="September institutional investor onboarding" />
            </div>

            <div className="field">
              <label>Source kind</label>
              <select value={sourceKind} onChange={(event) => setSourceKind(event.target.value)}>
                <option>Excel</option>
                <option>CSV</option>
                <option>Migration</option>
                <option>Manual</option>
                <option>API</option>
              </select>
            </div>

            <div className="field">
              <label>Excel rows (tab-separated)</label>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={"fund_name\tinvestor_code\tlegal_investor_name\tcontact_name\tcontact_email\trelationship_type\nVENTIQ Fund I\tLP001\tExample Family Office\tA. Shah\ta@example.com\tAuthorised Representative"}
              />
              <div className="hint">
                Header is optional. Supported aliases include investor_name / lp_name and email / email_id. If fund_name is blank, the governed active/editable fund is used.
              </div>
            </div>

            <div className="actions" style={{ marginTop: 16 }}>
              <button className="button primary" disabled={busy || !fundContextReady} onClick={createStageValidate} type="button">
                {busy ? "Validating..." : "Create + Stage + Validate"}
              </button>
            </div>
            {message && <div className="message">{message}</div>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent institutional batches</h2>
                <p>Organisation-scoped canonical T2 batches. Open any batch to inspect its staged evidence.</p>
              </div>
              <button className="button secondary" disabled={busy} onClick={() => void refreshRecentBatches()} type="button">Refresh</button>
            </div>

            <div className="recent">
              {recentBatches.map((batch) => (
                <div className="recent-row" key={String(batch.id)}>
                  <div>
                    <strong>{String(batch.batch_name || "Unnamed batch")}</strong>
                    <div className="hint">
                      {String(batch.status || "Draft")} · {Number(batch.total_rows || 0)} row(s) · {String(batch.source_kind || "")}
                    </div>
                  </div>
                  <button className="button secondary" disabled={busy} onClick={() => void openBatch(String(batch.id))} type="button">Open</button>
                </div>
              ))}
              {recentBatches.length === 0 && <div className="hint">No institutional onboarding batches yet.</div>}
            </div>
          </div>
        </div>

        {snapshot && (
          <>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Validated Batch</p>
                  <h2>{String(snapshot.batch.batch_name || "Institutional onboarding batch")}</h2>
                  <p>
                    Status: <span className={`pill pill-${statusClass(snapshot.batch.status)}`}>{String(snapshot.batch.status || "")}</span>
                  </p>
                </div>
              </div>

              <div className="stats">
                <div className="stat"><span>Total rows</span><strong>{Number(snapshot.batch.total_rows || 0)}</strong></div>
                <div className="stat"><span>Valid</span><strong>{Number(snapshot.batch.valid_rows || 0)}</strong></div>
                <div className="stat"><span>Review / invalid</span><strong>{Number(snapshot.batch.review_rows || 0)}</strong></div>
                <div className="stat"><span>Duplicates</span><strong>{Number(snapshot.batch.duplicate_rows || 0)}</strong></div>
                <div className="stat"><span>Existing-user rows</span><strong>{Number(snapshot.batch.existing_user_rows || 0)}</strong></div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Source</th><th>Fund</th><th>Investor</th><th>Human</th><th>Relationship</th><th>Identity</th><th>Validation</th><th>Action</th><th>Warnings / errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.rows.map((row) => (
                      <tr key={String(row.id)}>
                        <td>{Number(row.source_row_number || 0)}</td>
                        <td>{String(row.fund_name || "")}</td>
                        <td><strong>{String(row.investor_code || "")}</strong><br />{String(row.legal_investor_name || "")}</td>
                        <td>{String(row.contact_name || "—")}<br />{String(row.contact_email || "")}</td>
                        <td>{String(row.relationship_type || "")}</td>
                        <td><span className={`pill pill-${statusClass(row.identity_resolution)}`}>{String(row.identity_resolution || "")}</span></td>
                        <td><span className={`pill pill-${statusClass(row.validation_status)}`}>{String(row.validation_status || "")}</span></td>
                        <td>{String(row.action_plan || "")}</td>
                        <td>{[...(row.validation_errors || []), ...(row.validation_warnings || [])].join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>Draft invitation identities</h2>
                  <p>One human email may link to many ready entitlement rows. These are Draft records only; nothing has been dispatched.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table style={{ minWidth: 760 }}>
                  <thead><tr><th>Email</th><th>Name</th><th>Identity</th><th>Status</th><th>Linked rows</th></tr></thead>
                  <tbody>
                    {snapshot.invitations.map((invitation) => (
                      <tr key={String(invitation.id)}>
                        <td>{String(invitation.invitee_email || "")}</td>
                        <td>{String(invitation.invitee_name || "—")}</td>
                        <td>{invitation.auth_user_id ? "Existing User" : "New User"}</td>
                        <td>{String(invitation.invitation_status || "Draft")}</td>
                        <td>{snapshot.invitationRows.filter((link) => String(link.invitation_id) === String(invitation.id)).length}</td>
                      </tr>
                    ))}
                    {snapshot.invitations.length === 0 && <tr><td colSpan={5}>No invitation is required for the currently valid rows.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
