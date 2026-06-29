"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type ApprovedCapitalCall = {
  id: string;
  fund_id: string | null;
  call_name: string | null;
  call_date: string | null;
  due_date: string | null;
  call_amount: number | null;
  status: string | null;
  funds: { name: string } | { name: string }[] | null;
};

type ApprovedDistribution = {
  id: string;
  fund_id: string | null;
  distribution_name: string | null;
  distribution_date: string | null;
  payment_date: string | null;
  distribution_amount: number | null;
  status: string | null;
  funds: { name: string } | { name: string }[] | null;
};

type CapitalCallInvestorRow = {
  id: string;
  investor_id: string | null;
  commitment_id: string | null;
  allocation_amount: number | null;
  call_amount: number | null;
  allocation_percentage: number | null;
  status: string | null;
  investors:
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }[]
    | null;
};

type DistributionInvestorRow = {
  id: string;
  investor_id: string | null;
  commitment_id: string | null;
  allocation_amount: number | null;
  distribution_amount: number | null;
  allocation_percentage: number | null;
  status: string | null;
  investors:
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }[]
    | null;
};

type InvestorDocument = {
  id: string;
  document_type: string;
  document_name: string;
  investor_name: string | null;
  investor_email: string | null;
  fund_name: string | null;
  amount: number | null;
  status: string | null;
  email_status: string | null;
  portal_status: string | null;
  generated_at: string | null;
};

function toCr(value: number | null | undefined) {
  return Number(value || 0) / 10000000;
}

function formatCr(value: number) {
  return `₹${value.toFixed(2)} Cr`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFundName(value: { name: string } | { name: string }[] | null) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown Fund";
  return value?.name ?? "Unknown Fund";
}

function getInvestor(
  value:
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }
    | {
        name: string;
        email: string | null;
        investor_type: string | null;
      }[]
    | null
) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function DocumentEnginePage() {
  const [capitalCalls, setCapitalCalls] = useState<ApprovedCapitalCall[]>([]);
  const [distributions, setDistributions] = useState<ApprovedDistribution[]>(
    []
  );
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [selectedCapitalCallId, setSelectedCapitalCallId] = useState("");
  const [selectedDistributionId, setSelectedDistributionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generatingCapitalCallId, setGeneratingCapitalCallId] = useState("");
  const [generatingDistributionId, setGeneratingDistributionId] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const [selectedPreviewDocument, setSelectedPreviewDocument] =
    useState<InvestorDocument | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadDocumentEngine();
  }, []);

  async function loadDocumentEngine() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured. Please check .env.local.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data: callData, error: callError } = await supabase
      .from("capital_calls")
      .select(
        "id, fund_id, call_name, call_date, due_date, call_amount, status, funds(name)"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10);

    if (callError) {
      setErrorMessage(callError.message);
      setLoading(false);
      return;
    }

    const { data: distributionData, error: distributionError } = await supabase
      .from("distributions")
      .select(
        "id, fund_id, distribution_name, distribution_date, payment_date, distribution_amount, status, funds(name)"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10);

    if (distributionError) {
      setErrorMessage(distributionError.message);
      setLoading(false);
      return;
    }

    const { data: documentData, error: documentError } = await supabase
      .from("investor_documents")
      .select(
        "id, document_type, document_name, investor_name, investor_email, fund_name, amount, status, email_status, portal_status, generated_at"
      )
      .order("generated_at", { ascending: false })
      .limit(20);

    if (documentError) {
      setErrorMessage(documentError.message);
      setLoading(false);
      return;
    }

    const approvedCalls =
      (callData as unknown as ApprovedCapitalCall[]) ?? [];
    const approvedDistributions =
      (distributionData as unknown as ApprovedDistribution[]) ?? [];

    setCapitalCalls(approvedCalls);
    setDistributions(approvedDistributions);
    setDocuments((documentData as unknown as InvestorDocument[]) ?? []);

    if (approvedCalls[0]) {
      setSelectedCapitalCallId(approvedCalls[0].id);
    }

    if (approvedDistributions[0]) {
      setSelectedDistributionId(approvedDistributions[0].id);
    }

    setLoading(false);
  }

  async function loadDocumentsOnly() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("investor_documents")
      .select(
        "id, document_type, document_name, investor_name, investor_email, fund_name, amount, status, email_status, portal_status, generated_at"
      )
      .order("generated_at", { ascending: false })
      .limit(20);

    if (!error) {
      setDocuments((data as unknown as InvestorDocument[]) ?? []);
    }
  }

  async function handleDeleteInvestorDocument(documentRecord: InvestorDocument) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const confirmed = window.confirm(
      `Delete this generated document?\n\n${documentRecord.document_name}`
    );

    if (!confirmed) return;

    setDeletingDocumentId(documentRecord.id);
    setMessage("");

    const { error } = await supabase
      .from("investor_documents")
      .delete()
      .eq("id", documentRecord.id);

    if (error) {
      setMessage(`Could not delete document: ${error.message}`);
      setDeletingDocumentId("");
      return;
    }

    if (selectedPreviewDocument?.id === documentRecord.id) {
      setSelectedPreviewDocument(null);
    }

    await loadDocumentsOnly();

    setMessage("Investor document deleted successfully.");
    setDeletingDocumentId("");
  }

  function handlePreviewInvestorDocument(documentRecord: InvestorDocument) {
    setSelectedPreviewDocument(documentRecord);
    setMessage(`Preview opened for "${documentRecord.document_name}".`);

    setTimeout(() => {
      window.document.getElementById("document-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function generateCapitalCallDocuments() {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const selectedCall = capitalCalls.find(
      (call) => call.id === selectedCapitalCallId
    );

    if (!selectedCall) {
      setMessage("Please select an approved capital call.");
      return;
    }

    setGeneratingCapitalCallId(selectedCall.id);
    setMessage("");

    const { data, error } = await supabase
      .from("capital_call_investors")
      .select(
        "id, investor_id, commitment_id, allocation_amount, call_amount, allocation_percentage, status, investors(name, email, investor_type)"
      )
      .eq("capital_call_id", selectedCall.id)
      .eq("status", "approved");

    if (error) {
      setMessage(`Could not read approved LP allocations: ${error.message}`);
      setGeneratingCapitalCallId("");
      return;
    }

    const rows = (data as unknown as CapitalCallInvestorRow[]) ?? [];

    if (rows.length === 0) {
      setMessage("No approved investor rows found for this capital call.");
      setGeneratingCapitalCallId("");
      return;
    }

    const fundName = getFundName(selectedCall.funds);

    const { data: existingDocuments, error: existingError } = await supabase
      .from("investor_documents")
      .select("investor_id")
      .eq("capital_call_id", selectedCall.id)
      .eq("document_type", "Capital Call Notice");

    if (existingError) {
      setMessage(`Could not check existing documents: ${existingError.message}`);
      setGeneratingCapitalCallId("");
      return;
    }

    const existingInvestorIds = new Set(
      ((existingDocuments as { investor_id: string | null }[]) ?? [])
        .map((item) => item.investor_id)
        .filter((id): id is string => Boolean(id))
    );

    const newRows = rows.filter((row) => {
      if (!row.investor_id) return true;
      return !existingInvestorIds.has(row.investor_id);
    });

    if (newRows.length === 0) {
      setMessage(
        `Capital call notices already exist for all approved investors in ${fundName}.`
      );
      setGeneratingCapitalCallId("");
      return;
    }

    const payload = newRows.map((row) => {
      const investor = getInvestor(row.investors);

      return {
        investor_id: row.investor_id,
        fund_id: selectedCall.fund_id,
        capital_call_id: selectedCall.id,
        distribution_id: null,
        document_type: "Capital Call Notice",
        document_name: `${
          selectedCall.call_name ?? "Capital Call"
        } - ${investor?.name ?? "Investor"}`,
        investor_name: investor?.name ?? "Unknown Investor",
        investor_email: investor?.email ?? null,
        fund_name: fundName,
        amount: row.allocation_amount ?? row.call_amount ?? 0,
        status: "generated",
        email_status: "not_sent",
        portal_status: "available",
        generated_by: "VENTIQ Document Engine",
      };
    });

    const { error: insertError } = await supabase
      .from("investor_documents")
      .insert(payload);

    if (insertError) {
      setMessage(`Could not generate documents: ${insertError.message}`);
      setGeneratingCapitalCallId("");
      return;
    }

    await loadDocumentsOnly();

    setMessage(
      `${newRows.length} new capital call notice records generated for ${fundName}. ${
        rows.length - newRows.length
      } duplicate records skipped.`
    );
    setGeneratingCapitalCallId("");
  }

  async function generateDistributionDocuments() {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const selectedDistribution = distributions.find(
      (distribution) => distribution.id === selectedDistributionId
    );

    if (!selectedDistribution) {
      setMessage("Please select an approved distribution.");
      return;
    }

    setGeneratingDistributionId(selectedDistribution.id);
    setMessage("");

    const { data, error } = await supabase
      .from("distribution_investors")
      .select(
        "id, investor_id, commitment_id, allocation_amount, distribution_amount, allocation_percentage, status, investors(name, email, investor_type)"
      )
      .eq("distribution_id", selectedDistribution.id)
      .eq("status", "approved");

    if (error) {
      setMessage(`Could not read approved LP allocations: ${error.message}`);
      setGeneratingDistributionId("");
      return;
    }

    const rows = (data as unknown as DistributionInvestorRow[]) ?? [];

    if (rows.length === 0) {
      setMessage("No approved investor rows found for this distribution.");
      setGeneratingDistributionId("");
      return;
    }

    const fundName = getFundName(selectedDistribution.funds);

    const { data: existingDocuments, error: existingError } = await supabase
      .from("investor_documents")
      .select("investor_id")
      .eq("distribution_id", selectedDistribution.id)
      .eq("document_type", "Distribution Notice");

    if (existingError) {
      setMessage(`Could not check existing documents: ${existingError.message}`);
      setGeneratingDistributionId("");
      return;
    }

    const existingInvestorIds = new Set(
      ((existingDocuments as { investor_id: string | null }[]) ?? [])
        .map((item) => item.investor_id)
        .filter((id): id is string => Boolean(id))
    );

    const newRows = rows.filter((row) => {
      if (!row.investor_id) return true;
      return !existingInvestorIds.has(row.investor_id);
    });

    if (newRows.length === 0) {
      setMessage(
        `Distribution notices already exist for all approved investors in ${fundName}.`
      );
      setGeneratingDistributionId("");
      return;
    }

    const payload = newRows.map((row) => {
      const investor = getInvestor(row.investors);

      return {
        investor_id: row.investor_id,
        fund_id: selectedDistribution.fund_id,
        capital_call_id: null,
        distribution_id: selectedDistribution.id,
        document_type: "Distribution Notice",
        document_name: `${
          selectedDistribution.distribution_name ?? "Distribution"
        } - ${investor?.name ?? "Investor"}`,
        investor_name: investor?.name ?? "Unknown Investor",
        investor_email: investor?.email ?? null,
        fund_name: fundName,
        amount: row.allocation_amount ?? row.distribution_amount ?? 0,
        status: "generated",
        email_status: "not_sent",
        portal_status: "available",
        generated_by: "VENTIQ Document Engine",
      };
    });

    const { error: insertError } = await supabase
      .from("investor_documents")
      .insert(payload);

    if (insertError) {
      setMessage(`Could not generate documents: ${insertError.message}`);
      setGeneratingDistributionId("");
      return;
    }

    await loadDocumentsOnly();

    setMessage(
      `${newRows.length} new distribution notice records generated for ${fundName}. ${
        rows.length - newRows.length
      } duplicate records skipped.`
    );
    setGeneratingDistributionId("");
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Reporting</p>
            <h1>Document Generation Engine</h1>
            <p>
              Generate investor-wise capital call notices, distribution notices
              and reporting documents from approved fund workflows.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Loading Document Engine...</h2>
            <p>
              VENTIQ is reading approved capital calls, distributions and
              investor document records.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">
              <strong>Error:</strong> {errorMessage}
            </div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="impact-grid">
              <div className="impact-card">
                <h3>{capitalCalls.length}</h3>
                <p>Approved capital calls</p>
              </div>

              <div className="impact-card">
                <h3>{distributions.length}</h3>
                <p>Approved distributions</p>
              </div>

              <div className="impact-card">
                <h3>{documents.length}</h3>
                <p>Recent documents</p>
              </div>

              <div className="impact-card">
                <h3>Portal Ready</h3>
                <p>Document status</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Document Workflow</h2>

              <div className="explain-box">
                VENTIQ only generates investor reporting documents from approved
                workflows. Once generated, each investor document is linked to
                the investor, fund, workflow and future portal/email status.
              </div>

              {message && <div className="logic-note">{message}</div>}
            </div>

            <div className="preview-card">
              <h2>Generate Capital Call Notices</h2>

              <p className="eyebrow">
                Create investor-wise notice records from approved capital calls
              </p>

              {capitalCalls.length === 0 && (
                <div className="explain-box">
                  No approved capital calls found yet. Approve a capital call
                  first from the Capital Call module.
                </div>
              )}

              {capitalCalls.length > 0 && (
                <div className="form-card">
                  <label>Approved Capital Call</label>
                  <select
                    value={selectedCapitalCallId}
                    onChange={(event) =>
                      setSelectedCapitalCallId(event.target.value)
                    }
                  >
                    {capitalCalls.map((call) => (
                      <option key={call.id} value={call.id}>
                        {call.call_name ?? "Approved Capital Call"} —{" "}
                        {formatCr(toCr(call.call_amount))}
                      </option>
                    ))}
                  </select>

                  <div className="logic-note">
                    Selected capital call notices will be generated LP-wise and
                    marked as portal available. Email status will remain not
                    sent until the Email Dispatch Engine is connected.
                  </div>

                  <div className="action-row">
                    <button
                      type="button"
                      onClick={generateCapitalCallDocuments}
                      disabled={generatingCapitalCallId !== ""}
                    >
                      {generatingCapitalCallId
                        ? "Generating..."
                        : "Generate Capital Call Notices"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Generate Distribution Notices</h2>

              <p className="eyebrow">
                Create investor-wise notice records from approved distributions
              </p>

              {distributions.length === 0 && (
                <div className="explain-box">
                  No approved distributions found yet. Approve a distribution
                  first from the Distribution Waterfall module.
                </div>
              )}

              {distributions.length > 0 && (
                <div className="form-card">
                  <label>Approved Distribution</label>
                  <select
                    value={selectedDistributionId}
                    onChange={(event) =>
                      setSelectedDistributionId(event.target.value)
                    }
                  >
                    {distributions.map((distribution) => (
                      <option key={distribution.id} value={distribution.id}>
                        {distribution.distribution_name ??
                          "Approved Distribution"}{" "}
                        — {formatCr(toCr(distribution.distribution_amount))}
                      </option>
                    ))}
                  </select>

                  <div className="logic-note">
                    Selected distribution notices will be generated LP-wise and
                    marked as portal available. Email status will remain not
                    sent until the Email Dispatch Engine is connected.
                  </div>

                  <div className="action-row">
                    <button
                      type="button"
                      onClick={generateDistributionDocuments}
                      disabled={generatingDistributionId !== ""}
                    >
                      {generatingDistributionId
                        ? "Generating..."
                        : "Generate Distribution Notices"}
                    </button>
                  </div>
                </div>
              )}
            </div>

           <div className="preview-card">
  <h2>Generated Investor Documents</h2>

  <p className="eyebrow">
    Latest investor document records from Supabase
  </p>

  {documents.length === 0 && (
    <div className="explain-box">
      No investor documents generated yet.
    </div>
  )}

  {documents.length > 0 && (
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: "560px",
        border: "1px solid rgba(148, 163, 184, 0.22)",
        borderRadius: "18px",
      }}
    >
      <table
        className="investor-table"
        style={{
          minWidth: "1250px",
          width: "100%",
        }}
      >
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Investor</th>
            <th>Email</th>
            <th>Fund</th>
            <th>Amount</th>
            <th>Portal</th>
            <th>Email</th>
            <th>Generated</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {documents.map((documentRecord) => (
            <tr key={documentRecord.id}>
              <td style={{ maxWidth: "260px" }}>
                <strong>{documentRecord.document_name}</strong>
              </td>

              <td>{documentRecord.document_type}</td>

              <td>{documentRecord.investor_name ?? "-"}</td>

              <td>{documentRecord.investor_email ?? "-"}</td>

              <td>{documentRecord.fund_name ?? "-"}</td>

              <td>{formatCr(toCr(documentRecord.amount))}</td>

              <td>
                <span className="small-pill">
                  {documentRecord.portal_status ?? "available"}
                </span>
              </td>

              <td>
                <span className="small-pill">
                  {documentRecord.email_status ?? "not_sent"}
                </span>
              </td>

              <td>{formatDate(documentRecord.generated_at)}</td>

              <td>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "nowrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewInvestorDocument(documentRecord)
                    }
                    style={{
                      border: "1px solid rgba(96, 165, 250, 0.45)",
                      background: "rgba(37, 99, 235, 0.16)",
                      color: "#dbeafe",
                      borderRadius: "999px",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Preview
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteInvestorDocument(documentRecord)
                    }
                    disabled={deletingDocumentId === documentRecord.id}
                    style={{
                      border: "1px solid rgba(248, 113, 113, 0.45)",
                      background: "rgba(127, 29, 29, 0.18)",
                      color: "#fecaca",
                      borderRadius: "999px",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor:
                        deletingDocumentId === documentRecord.id
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        deletingDocumentId === documentRecord.id ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deletingDocumentId === documentRecord.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

{selectedPreviewDocument && (
  <div id="document-preview" className="preview-card">
    <h2>Document Preview</h2>

    <p className="eyebrow">
      PDF preview placeholder for Phase 3.3
    </p>

    <div className="impact-grid">
      <div className="impact-card">
        <h3>{selectedPreviewDocument.document_type}</h3>
        <p>Document type</p>
      </div>

      <div className="impact-card">
        <h3>{selectedPreviewDocument.investor_name ?? "-"}</h3>
        <p>Investor</p>
      </div>

      <div className="impact-card">
        <h3>{formatCr(toCr(selectedPreviewDocument.amount))}</h3>
        <p>Document amount</p>
      </div>

      <div className="impact-card">
        <h3>{selectedPreviewDocument.email_status ?? "not_sent"}</h3>
        <p>Email status</p>
      </div>
    </div>

    <div className="journal-preview">
      <div className="journal-row">
        <span>Document Name</span>
        <strong>{selectedPreviewDocument.document_name}</strong>
      </div>

      <div className="journal-row">
        <span>Investor Email</span>
        <strong>{selectedPreviewDocument.investor_email ?? "-"}</strong>
      </div>

      <div className="journal-row">
        <span>Fund</span>
        <strong>{selectedPreviewDocument.fund_name ?? "-"}</strong>
      </div>

      <div className="journal-row">
        <span>Portal Status</span>
        <strong>{selectedPreviewDocument.portal_status ?? "available"}</strong>
      </div>

      <div className="journal-row">
        <span>Generated Date</span>
        <strong>{formatDate(selectedPreviewDocument.generated_at)}</strong>
      </div>
    </div>

    <div className="explain-box">
      In Phase 3.3, this preview will become a proper PDF-style notice template
      with fund name, investor name, amount, date, notice content and download
      option.
    </div>
  </div>
)}

            <div className="preview-card">
              <h2>Next Step After Phase 3.2</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  🟢 Approved workflow selected
                </div>

                <div className="queue-item">
                  🟢 Investor document records generated
                </div>

                <div className="queue-item">
                  🟢 Duplicate prevention added
                </div>

                <div className="queue-item">
                  🟢 Document preview placeholder added
                </div>

                <div className="queue-item">
                  🟡 PDF template pending
                </div>

                <div className="queue-item">
                  🟡 Supabase Storage file link pending
                </div>

                <div className="queue-item">
                  🟡 Investor portal document view pending
                </div>

                <div className="queue-item">
                  🟡 Email dispatch pending
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}