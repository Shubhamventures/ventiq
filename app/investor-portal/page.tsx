"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type Investor = {
  id: string;
  name: string;
  investor_code: string | null;
  investor_type: string | null;
  email: string | null;
  country: string | null;
  kyc_status: string | null;
  bank_status: string | null;
  source: "migration" | "legacy";
};

type Commitment = {
  id: string;
  investor_id: string;
  fund_name: string;
  class_name: string | null;
  commitment_amount: number | null;
  called_amount: number | null;
  unfunded_amount: number | null;
  status: string | null;
};

type InvestorDocument = {
  id: string;
  document_type: string | null;
  document_name: string | null;
  document_category: string | null;
  investor_name: string | null;
  investor_email?: string | null;
  email?: string | null;
  fund_name: string | null;
  amount: number | null;
  status: string | null;
  email_status?: string | null;
  portal_status?: string | null;
  storage_path?: string | null;
  storage_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  source?: string | null;
  migration_status?: string | null;
  uploaded_at?: string | null;
  published_at?: string | null;
  generated_at?: string | null;
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

function getCommitmentFundName(commitment: Commitment) {
  return commitment.fund_name || "Unknown Fund";
}

function getDocumentIcon(type: string | null | undefined) {
  const normalizedType = (type || "").toLowerCase();

  if (normalizedType.includes("capital")) return "💰";
  if (normalizedType.includes("distribution")) return "📤";
  if (normalizedType.includes("irr")) return "📊";
  if (normalizedType.includes("tax")) return "🧾";
  if (normalizedType.includes("soa") || normalizedType.includes("statement")) {
    return "📄";
  }

  return "📑";
}
function getDocumentTitle(documentRecord: InvestorDocument) {
  return (
    documentRecord.document_name ||
    documentRecord.file_name ||
    "Investor document"
  );
}

function getDocumentType(documentRecord: InvestorDocument) {
  return (
    documentRecord.document_type ||
    documentRecord.document_category ||
    "Investor Document"
  );
}

function getDocumentDate(documentRecord: InvestorDocument) {
  return (
    documentRecord.published_at ||
    documentRecord.generated_at ||
    documentRecord.uploaded_at ||
    null
  );
}

function getDocumentUrl(documentRecord: InvestorDocument) {
  return documentRecord.storage_url || documentRecord.file_url || "";
}

export default function InvestorPortalPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState("All documents");
  const [loading, setLoading] = useState(true);
  const [loadingInvestorData, setLoadingInvestorData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
   async function loadInvestors() {
  if (!isSupabaseConfigured || !supabase) {
    setErrorMessage(
      "The sample Investor Portal is temporarily unavailable. Please request a walkthrough."
    );
    setLoading(false);
    return;
  }

  setLoading(true);
  setErrorMessage("");

  const { data, error } = await supabase
    .from("investor_master")
    .select(
      "id, investor_code, investor_name, investor_type, email, kyc_status, bank_status"
    )
    .order("investor_code", { ascending: true });

  if (error) {
    setErrorMessage(error.message);
    setLoading(false);
    return;
  }

  const investorData =
    data?.map((investor) => ({
      id: investor.id,
      investor_code: investor.investor_code ?? null,
      name: investor.investor_name ?? "Unknown Investor",
      investor_type: investor.investor_type ?? null,
      email: investor.email ?? null,
      country: "India",
      kyc_status: investor.kyc_status ?? null,
      bank_status: investor.bank_status ?? null,
      source: "migration" as const,
    })) ?? [];

  setInvestors(investorData);

  const investorIdFromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("investorId")
      : "";

  const investorFromUrl = investorIdFromUrl
    ? investorData.find((investor) => investor.id === investorIdFromUrl)
    : null;

  const recommendedInvestor = investorFromUrl ?? investorData[0];

  if (recommendedInvestor) {
    setSelectedInvestorId(recommendedInvestor.id);
  } else {
    setSelectedInvestorId("");
  }

  setLoading(false);
}

    loadInvestors();
  }, []);

  useEffect(() => {
       async function loadInvestorPortalData() {
      if (!selectedInvestorId || !supabase) return;

      setLoadingInvestorData(true);
      setErrorMessage("");

      const { data: commitmentData, error: commitmentError } = await supabase
        .from("fund_commitments")
        .select(
          "id, investor_id, fund_name, class_name, commitment_amount, unfunded_commitment, commitment_status"
        )
        .eq("investor_id", selectedInvestorId)
        .order("commitment_amount", { ascending: false });

      if (commitmentError) {
        setErrorMessage(commitmentError.message);
        setCommitments([]);
        setDocuments([]);
        setLoadingInvestorData(false);
        return;
      }

      const normalizedCommitments =
        commitmentData?.map((commitment) => {
          const commitmentAmount = Number(commitment.commitment_amount || 0);
          const unfundedAmount = Number(commitment.unfunded_commitment || 0);

          return {
            id: commitment.id,
            investor_id: commitment.investor_id,
            fund_name: commitment.fund_name,
            class_name: commitment.class_name,
            commitment_amount: commitmentAmount,
            called_amount: Math.max(commitmentAmount - unfundedAmount, 0),
            unfunded_amount: unfundedAmount,
            status: commitment.commitment_status,
          };
        }) ?? [];

      const { data: documentData, error: documentError } = await supabase
        .from("investor_documents")
        .select("*")
        .eq("investor_id", selectedInvestorId)
        .order("published_at", { ascending: false });

      if (documentError) {
        setErrorMessage(documentError.message);
        setDocuments([]);
      } else {
        setDocuments((documentData as InvestorDocument[]) ?? []);
      }

      setCommitments(normalizedCommitments);
      setLoadingInvestorData(false);
    }
    loadInvestorPortalData();
  }, [selectedInvestorId]);

  const selectedInvestor = investors.find(
    (investor) => investor.id === selectedInvestorId
  );

  const totalCommitment = commitments.reduce(
    (sum, commitment) => sum + toCr(commitment.commitment_amount),
    0
  );

  const totalCalled = commitments.reduce(
    (sum, commitment) => sum + toCr(commitment.called_amount),
    0
  );

  const totalRemaining = commitments.reduce(
    (sum, commitment) => sum + toCr(commitment.unfunded_amount),
    0
  );

  const totalDistributed = documents
    .filter(
      (documentRecord) =>
        documentRecord.document_type === "Distribution Notice"
    )
    .reduce((sum, documentRecord) => sum + toCr(documentRecord.amount), 0);

  const capitalCallDocuments = documents.filter(
    (documentRecord) => documentRecord.document_type === "Capital Call Notice"
  );

  const distributionDocuments = documents.filter(
    (documentRecord) => documentRecord.document_type === "Distribution Notice"
  );

  const storedDocuments = documents.filter(
    (documentRecord) => documentRecord.storage_url
  );

  const filteredDocuments = useMemo(() => {
  if (documentTypeFilter === "All documents") return documents;

  return documents.filter(
    (documentRecord) => getDocumentType(documentRecord) === documentTypeFilter
  );
}, [documentTypeFilter, documents]);

const documentTypeOptions = useMemo(() => {
  return [
    "All documents",
    ...Array.from(
      new Set(documents.map((documentRecord) => getDocumentType(documentRecord)))
    ),
  ];
}, [documents]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Experience</p>
            <h1>AI Investor Portal</h1>
                        <p>
              One intelligent view for LP commitments, capital calls,
              distributions, performance, documents, data room access and
              AI-powered investor queries.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investor Portal Preview...</h2>
            <p>VENTIQ is reading investor, commitment and document records.</p>
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
                      <div className="sample-data-ribbon">
              Sample investor portal preview · Illustrative data
            </div>
            <div className="preview-card">
              <h2>Investor Access</h2>

              <div className="form-card">
                <p className="eyebrow">
                  Select investor to view portal records
                </p>

                <label>Investor</label>
                <select
                  value={selectedInvestorId}
                  onChange={(event) => {
                    setSelectedInvestorId(event.target.value);
                    setDocumentTypeFilter("All documents");
                  }}
                >
                  {investors.map((investor) => (
                    <option key={investor.id} value={investor.id}>
  {investor.investor_code ? `${investor.investor_code} - ` : ""}
  {investor.name}
</option>
                  ))}
                </select>

                <div className="logic-note">
                 This portal now reads migrated investor master, commitment and
investor document records created through the Migration Portal.
Historical SOAs, capital call notices, distribution notices and IRR
statements appear here investor-wise after publishing.
                </div>
              </div>
            </div>

                       <div className="preview-card">
              <h2>Welcome back, {selectedInvestor?.name ?? "Investor"}</h2>

              <div className="explain-box">
                VENTIQ has reviewed your fund commitments, capital call notices,
                distribution notices, data room access and stored reporting
                documents. Your latest investor documents are available in the
                portal library below.
              </div>
            </div>

            <div className="preview-card">
              <h2>Investor Data Room Access</h2>

              <div className="explain-box">
                Data room documents, DDQ responses and diligence updates can
                flow into the investor experience once they are approved for LP
                access. This connects fundraising diligence with the LP-facing
                portal.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{documents.length}</h3>
                  <p>Portal-linked documents</p>
                </div>

                <div className="impact-card">
                  <h3>{storedDocuments.length}</h3>
                  <p>Download-ready files</p>
                </div>

                <div className="impact-card">
                  <h3>DDQ</h3>
                  <p>Question trail available</p>
                </div>

                <div className="impact-card">
                  <h3>Ready</h3>
                  <p>LP diligence workspace</p>
                </div>
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/data-room">
                  Open Investor Data Room
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/fundraising-ai"
                >
                  Open IR Workspace
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{formatCr(totalCommitment)}</h3>
                <p>Total commitment</p>
              </div>

              <div className="impact-card">
                <h3>{formatCr(totalCalled)}</h3>
                <p>Capital called</p>
              </div>

              <div className="impact-card">
                <h3>{formatCr(totalDistributed)}</h3>
                <p>Distributed</p>
              </div>

              <div className="impact-card">
                <h3>{formatCr(totalRemaining)}</h3>
                <p>Remaining commitment</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{documents.length}</h3>
                <p>Total documents</p>
              </div>

              <div className="impact-card">
                <h3>{storedDocuments.length}</h3>
                <p>Stored PDFs</p>
              </div>

              <div className="impact-card">
                <h3>{capitalCallDocuments.length}</h3>
                <p>Capital call notices</p>
              </div>

              <div className="impact-card">
                <h3>{distributionDocuments.length}</h3>
                <p>Distribution notices</p>
              </div>
            </div>

            {loadingInvestorData && (
              <div className="preview-card">
                <h2>Preparing investor documents and fund data...</h2>
                <p>VENTIQ is refreshing this investor&apos;s portal records.</p>
              </div>
            )}

            {!loadingInvestorData && (
              <>
                <div className="preview-card">
                  <h2>Investor Profile</h2>

                  <div className="journal-preview">
                    <div className="journal-row">
                      <span>Investor Name</span>
                      <strong>{selectedInvestor?.name ?? "-"}</strong>
                    </div>
                    <div className="journal-row">
  <span>Investor Code</span>
  <strong>{selectedInvestor?.investor_code ?? "-"}</strong>
</div>

                    <div className="journal-row">
                      <span>Email</span>
                      <strong>{selectedInvestor?.email ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Investor Type</span>
                      <strong>{selectedInvestor?.investor_type ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Country</span>
                      <strong>{selectedInvestor?.country ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>KYC Status</span>
                      <strong>{selectedInvestor?.kyc_status ?? "-"}</strong>
                    </div>
                    <div className="journal-row">
  <span>Bank Status</span>
  <strong>{selectedInvestor?.bank_status ?? "-"}</strong>
</div>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>My Investments</h2>

                  {commitments.length === 0 && (
                    <div className="explain-box">
                      No commitments found for this investor.
                    </div>
                  )}

                  {commitments.length > 0 && (
                    <div className="queue-grid">
                      {commitments.map((commitment) => {
                      

                        return (
                          <div key={commitment.id} className="queue-item">
                            <strong>{getCommitmentFundName(commitment)}</strong>
                            <br />
                            Commitment:{" "}
                            {formatCr(toCr(commitment.commitment_amount))}
                            <br />
                            Called: {formatCr(toCr(commitment.called_amount))}
                            <br />
                            Remaining:{" "}
                            {formatCr(toCr(commitment.unfunded_amount))}
                            <br />
                            Status: {commitment.status ?? "active"}
                            <br />
Class: {commitment.class_name ?? "-"}
                            <br />
                            🟢 Portal active
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="preview-card">
                  <h2>Investor Document Library</h2>

                                   <p className="eyebrow">
                    Capital call notices, distribution notices, data room files,
                    DDQ outputs and stored PDF documents available to this
                    investor
                  </p>

                  <div className="form-card">
                    <label>Document Type</label>
                    <select
                      value={documentTypeFilter}
                      onChange={(event) =>
                        setDocumentTypeFilter(event.target.value)
                      }
                    >
                      {documentTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {documents.length === 0 && (
                    <div className="explain-box">
                      No investor documents found yet. Generate and store PDFs
                      from the Document Engine first.
                    </div>
                  )}

                  {documents.length > 0 && filteredDocuments.length === 0 && (
                    <div className="explain-box">
                      No documents found for the selected filter.
                    </div>
                  )}

                  {filteredDocuments.length > 0 && (
                    <div
                      style={{
                        overflowX: "auto",
                        overflowY: "auto",
                        maxHeight: "560px",
                        border: "1px solid rgba(148, 163, 184, 0.22)",
                        borderRadius: "18px",
                        marginTop: "18px",
                      }}
                    >
                      <table
                        className="investor-table"
                        style={{
                          minWidth: "1150px",
                          width: "100%",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Document</th>
                            <th>Type</th>
                            <th>Fund</th>
                            <th>Amount</th>
                            <th>Portal</th>
                            <th>Email</th>
                            <th>Stored PDF</th>
                            <th>Generated</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredDocuments.map((documentRecord) => (
                            <tr key={documentRecord.id}>
                              <td style={{ maxWidth: "260px" }}>
                                <strong>
                                  {getDocumentIcon(getDocumentType(documentRecord))}{" "}
{getDocumentTitle(documentRecord)}
                                </strong>
                              </td>

                              <td>{getDocumentType(documentRecord)}</td>

                              <td>{documentRecord.fund_name ?? "-"}</td>

                              <td>
  {documentRecord.amount
    ? formatCr(toCr(documentRecord.amount))
    : "-"}
</td>

                              <td>
                                <span className="small-pill">
                                  {documentRecord.portal_status ??
  documentRecord.migration_status ??
  documentRecord.status ??
  "Published"}
                                </span>
                              </td>

                              <td>
                                <span className="small-pill">
                                  {documentRecord.email_status ?? "not sent"}
                                </span>
                              </td>

                              <td>
                                <span className="small-pill">
                                  {getDocumentUrl(documentRecord) ? "Stored" : "Metadata only"}
                                </span>
                              </td>

                              <td>{formatDate(getDocumentDate(documentRecord))}</td>

                              <td>
                                {getDocumentUrl(documentRecord) ? (
                                  <a
                                    href={getDocumentUrl(documentRecord)}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border:
                                        "1px solid rgba(74, 222, 128, 0.45)",
                                      background: "rgba(22, 101, 52, 0.18)",
                                      color: "#bbf7d0",
                                      borderRadius: "999px",
                                      padding: "8px 16px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      textDecoration: "none",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Open PDF
                                  </a>
                                ) : (
                                  <span className="small-pill">
                                    Record only
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="preview-card">
                  <h2>Pending Actions</h2>

                  <div className="queue-grid">
                    <div className="queue-item">
                      🔵 Capital Call Notices
                      <br />
                      {capitalCallDocuments.length} available
                    </div>

                    <div className="queue-item">
                      🟢 Distribution Notices
                      <br />
                      {distributionDocuments.length} available
                    </div>

                    <div className="queue-item">
                      📄 Stored PDFs
                      <br />
                      {storedDocuments.length} ready for download
                    </div>

                                       <a className="queue-item" href="/data-room">
                      🟡 Data Room Requests
                      <br />
                      Review DDQ questions and LP diligence access
                    </a>
                  </div>
                </div>

                <div className="knowledge-grid">
                  <div className="preview-card">
                    <h2>Recent Activity</h2>

                    <div className="audit-timeline">
                      {documents.slice(0, 5).map((documentRecord) => (
                        <div key={documentRecord.id} className="audit-item">
                          <strong>
  {formatDate(getDocumentDate(documentRecord))}
</strong>{" "}
{getDocumentType(documentRecord)} published
                        </div>
                      ))}

                      {documents.length === 0 && (
                        <div className="audit-item">
                          <strong>Today</strong> No document activity yet
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ai-side-panel">
                    <h2>Ask VENTIQ AI</h2>

                    <div className="chat-message">
                      Ask: “Show my latest capital call notice.”
                    </div>

                    <div className="chat-message">
                      Ask: “Download my latest distribution notice.”
                    </div>

                    <div className="chat-message">
                      Ask: “How much commitment remains?”
                    </div>

                    <div className="chat-message">
                      Ask: “Show documents for Growth Fund II.”
                    </div>
                                        <div className="chat-message">
                      Ask: “Show my data room documents and DDQ updates.”
                    </div>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>AI Investor Answer Preview</h2>

                  <div className="explain-box">
                    <strong>Question:</strong> Show my latest document.
                    <br />
                    <br />
                    <strong>VENTIQ AI:</strong>{" "}
                    {documents[0]
                      ? `Your latest document is ${getDocumentTitle(documents[0])}. ${
                          getDocumentUrl(documents[0])
                            ? "The PDF is available for download in your document library."
                            : "The document record is available, but the PDF has not yet been stored."
                        }`
                      : "No investor documents are available yet."}
                  </div>
                </div>

                                <div className="preview-card">
                  <h2>Quick Actions</h2>

                  <div className="queue-grid">
                    <div className="queue-item">📄 Download SOA</div>
                    <div className="queue-item">📑 Tax Certificate</div>
                    <div className="queue-item">💰 Capital Call Notice</div>
                    <div className="queue-item">📊 Performance Report</div>

                    <a className="queue-item" href="/data-room">
                      🗂️ Open Data Room
                    </a>

                    <a className="queue-item" href="/fundraising-ai">
                      ❓ View DDQ Updates
                    </a>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}