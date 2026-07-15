"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type CapitalCall = {
  id: string;
  call_name: string | null;
  call_date: string | null;
  due_date: string | null;
  call_amount: number | null;
  status: string | null;
  created_at: string | null;
  funds: { name: string } | { name: string }[] | null;
};

type InvestorDocument = {
  id: string;
  investor_id: string | null;
  document_type: string;
  document_name: string;
  investor_name: string | null;
  investor_email: string | null;
  fund_name: string | null;
  amount: number | null;
  status: string | null;
  email_status: string | null;
  portal_status: string | null;
  storage_url: string | null;
  generated_at: string | null;
};

type ActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
  amount?: number | null;
  investorName?: string | null;
  fundName?: string | null;
};

function toCr(value: number | null | undefined) {
  return Number(value || 0) / 10000000;
}

function formatCr(value: number) {
  return `₹${value.toFixed(2)} Cr`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFundName(value: CapitalCall["funds"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown Fund";
  return value?.name ?? "Unknown Fund";
}

function getStatusIcon(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("approved")) return "🟢";
  if (normalizedStatus.includes("generated")) return "🔵";
  if (normalizedStatus.includes("stored")) return "🟣";
  if (normalizedStatus.includes("portal")) return "🟢";
  if (normalizedStatus.includes("email")) return "🟡";
  if (normalizedStatus.includes("data room")) return "🗂️";
  if (normalizedStatus.includes("imported")) return "📥";
  if (normalizedStatus.includes("viewed")) return "👁️";
  if (normalizedStatus.includes("downloaded")) return "⬇️";
  if (normalizedStatus.includes("ddq")) return "❓";
  if (normalizedStatus.includes("readiness")) return "📊";

  return "⚪";
}


export default function ActivityEnginePage() {
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadActivityEngine() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage(
          "The sample Activity Engine is temporarily unavailable. Please request a walkthrough."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const { data: capitalCallData, error: capitalCallError } = await supabase
        .from("capital_calls")
        .select(
          "id, call_name, call_date, due_date, call_amount, status, created_at, funds(name)"
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (capitalCallError) {
        setErrorMessage(capitalCallError.message);
        setLoading(false);
        return;
      }

      const { data: documentData, error: documentError } = await supabase
        .from("investor_documents")
        .select(
          "id, investor_id, document_type, document_name, investor_name, investor_email, fund_name, amount, status, email_status, portal_status, storage_url, generated_at"
        )
        .order("generated_at", { ascending: false })
        .limit(40);

      if (documentError) {
        setErrorMessage(documentError.message);
        setLoading(false);
        return;
      }

      setCapitalCalls((capitalCallData as unknown as CapitalCall[]) ?? []);
      setDocuments((documentData as InvestorDocument[]) ?? []);
      setLoading(false);
    }

    loadActivityEngine();
  }, []);

  const activityEvents = useMemo(() => {
    const events: ActivityEvent[] = [];

    capitalCalls.forEach((call) => {
      events.push({
        id: `capital-call-${call.id}`,
        time: call.created_at ?? call.call_date ?? "",
        module: "Capital Call",
        title:
          call.status === "approved"
            ? "Capital call approved"
            : "Capital call draft created",
        description: `${call.call_name ?? "Capital Call"} for ${getFundName(
          call.funds
        )}`,
        status: call.status ?? "draft",
        amount: call.call_amount,
        fundName: getFundName(call.funds),
      });
    });

    documents.forEach((documentRecord) => {
      events.push({
        id: `document-generated-${documentRecord.id}`,
        time: documentRecord.generated_at ?? "",
        module: "Document Engine",
        title: `${documentRecord.document_type} generated`,
        description: `${documentRecord.document_name} generated for ${
          documentRecord.investor_name ?? "Investor"
        }`,
        status: documentRecord.status ?? "generated",
        amount: documentRecord.amount,
        investorName: documentRecord.investor_name,
        fundName: documentRecord.fund_name,
      });

      if (documentRecord.portal_status === "available") {
        events.push({
          id: `portal-${documentRecord.id}`,
          time: documentRecord.generated_at ?? "",
          module: "Investor Portal",
          title: "Investor portal updated",
          description: `${documentRecord.document_type} made available to ${
            documentRecord.investor_name ?? "Investor"
          }`,
          status: "portal available",
          amount: documentRecord.amount,
          investorName: documentRecord.investor_name,
          fundName: documentRecord.fund_name,
        });
      }

      if (documentRecord.storage_url) {
        events.push({
          id: `stored-${documentRecord.id}`,
          time: documentRecord.generated_at ?? "",
          module: "Document Vault",
          title: "PDF stored in portal vault",
          description: `${documentRecord.document_name} stored and ready for investor access`,
          status: "stored",
          amount: documentRecord.amount,
          investorName: documentRecord.investor_name,
          fundName: documentRecord.fund_name,
        });
      }

      if (
        documentRecord.email_status === "queued" ||
        documentRecord.email_status === "sent"
      ) {
        events.push({
          id: `email-${documentRecord.id}`,
          time: documentRecord.generated_at ?? "",
          module: "Email Dispatch",
          title:
            documentRecord.email_status === "sent"
              ? "Investor email marked sent"
              : "Investor email queued",
          description: `${documentRecord.document_name} email ${
            documentRecord.email_status === "sent" ? "sent" : "queued"
          } for ${documentRecord.investor_email ?? "investor"}`,
          status: `email ${documentRecord.email_status}`,
          amount: documentRecord.amount,
          investorName: documentRecord.investor_name,
          fundName: documentRecord.fund_name,
        });
      }
    });
    const now = Date.now();

    const dataRoomActivityEvents: ActivityEvent[] = [
      {
        id: "data-room-opened",
        time: new Date(now - 1000 * 60 * 12).toISOString(),
        module: "Investor Data Room",
        title: "Investor data room opened",
        description:
          "Investor Relations opened the Data Room & DDQ Hub to review LP diligence readiness.",
        status: "data room opened",
      },
      {
        id: "data-room-imported-files",
        time: new Date(now - 1000 * 60 * 24).toISOString(),
        module: "Investor Data Room",
        title: "Legacy documents imported",
        description:
          "Historical fund documents were uploaded, classified and mapped to data room folders.",
        status: "imported",
      },
      {
        id: "data-room-lp-viewed",
        time: new Date(now - 1000 * 60 * 37).toISOString(),
        module: "LP Engagement",
        title: "LP viewed data room document",
        description:
          "Prospective LP viewed the fund overview and reporting sample inside the data room.",
        status: "viewed data room document",
      },
      {
        id: "data-room-lp-downloaded",
        time: new Date(now - 1000 * 60 * 52).toISOString(),
        module: "LP Engagement",
        title: "LP downloaded diligence file",
        description:
          "Investor downloaded a data room file for offline review and internal discussion.",
        status: "downloaded data room document",
      },
      {
        id: "data-room-ddq-question",
        time: new Date(now - 1000 * 60 * 68).toISOString(),
        module: "DDQ Hub",
        title: "DDQ question raised",
        description:
          "LP raised a diligence question linked to fund operations and reporting documents.",
        status: "ddq question open",
      },
      {
        id: "data-room-ddq-answered",
        time: new Date(now - 1000 * 60 * 91).toISOString(),
        module: "DDQ Hub",
        title: "DDQ question answered",
        description:
          "Investor Relations marked a DDQ response as answered and ready for LP review.",
        status: "ddq answered",
      },
      {
        id: "data-room-readiness-updated",
        time: new Date(now - 1000 * 60 * 115).toISOString(),
        module: "Data Room Readiness",
        title: "Readiness score updated",
        description:
          "VENTIQ recalculated data room readiness after imports, engagement and DDQ activity.",
        status: "readiness updated",
      },
    ];

    events.push(...dataRoomActivityEvents);
    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();
      return bTime - aTime;
    });
  }, [capitalCalls, documents]);

    const dataRoomEvents = activityEvents.filter(
    (event) =>
      event.module.includes("Data Room") ||
      event.module.includes("DDQ") ||
      event.module.includes("LP Engagement")
  );
  const approvedCapitalCalls = capitalCalls.filter(
    (call) => call.status === "approved"
  );

  const portalAvailableDocuments = documents.filter(
    (documentRecord) => documentRecord.portal_status === "available"
  );

  const storedDocuments = documents.filter(
    (documentRecord) => documentRecord.storage_url
  );

  const emailQueuedOrSentDocuments = documents.filter(
    (documentRecord) =>
      documentRecord.email_status === "queued" ||
      documentRecord.email_status === "sent"
  );

  const totalDocumentAmount = documents.reduce(
    (sum, documentRecord) => sum + toCr(documentRecord.amount),
    0
  );

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Intelligence Layer</p>
            <h1>AI Activity Engine</h1>
                       <p>
              A connected audit and intelligence layer showing how fund actions,
              document generation, portal updates, data room activity, DDQ
              questions and investor communication move across VENTIQ.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

              <div className="sample-data-ribbon">
          Connected activity preview · Reading capital calls, investor documents and data room activity
        </div>
        {loading && (
          <div className="preview-card">
            <h2>Preparing Activity Engine...</h2>
            <p>
              VENTIQ is reading capital calls, generated notices, portal status
              and document vault records.
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
                <h3>{activityEvents.length}</h3>
                <p>Connected activity events</p>
              </div>

              <div className="impact-card">
                <h3>{approvedCapitalCalls.length}</h3>
                <p>Approved capital calls</p>
              </div>

              <div className="impact-card">
                <h3>{portalAvailableDocuments.length}</h3>
                <p>Portal updates</p>
              </div>

              <div className="impact-card">
                <h3>{dataRoomEvents.length}</h3>
                <p>Data room events</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Workflow Summary</h2>

                            <div className="explain-box">
                The Activity Engine is now reading the same fund workflow data
                used by Capital Call, Document Engine, Investor Portal and Data
                Room. This proves the VENTIQ operating layer: one action creates
                downstream evidence across modules.
              </div>

              <div className="queue-grid">
                <div className="queue-item">
                  🟢 Capital Call
                  <br />
                  {approvedCapitalCalls.length} approved workflows
                </div>

                <div className="queue-item">
                  🔵 Document Engine
                  <br />
                  {documents.length} investor documents generated
                </div>

                <div className="queue-item">
                  🟢 Investor Portal
                  <br />
                  {portalAvailableDocuments.length} documents available
                </div>
                <div className="queue-item">
                  🗂️ Investor Data Room
                  <br />
                  {dataRoomEvents.length} diligence events tracked
                </div>
                <div className="queue-item">
                  🟣 Document Vault
                  <br />
                  {storedDocuments.length} PDFs stored
                </div>

                <div className="queue-item">
                  🟡 Email Dispatch
                  <br />
                  {emailQueuedOrSentDocuments.length} queued or sent
                </div>

                <div className="queue-item">
                  ⚙️ Audit Trail
                  <br />
                  {activityEvents.length} evidence points created
                </div>
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Live VENTIQ Activity Feed</h2>

                {activityEvents.length === 0 && (
                  <div className="explain-box">
                    No connected activity found yet. Approve a capital call,
                    generate notices in Document Engine and open Investor Portal
                    to create the first connected trail.
                  </div>
                )}

                {activityEvents.length > 0 && (
                  <div className="audit-timeline">
                    {activityEvents.slice(0, 16).map((event) => (
                      <div key={event.id} className="audit-item">
                        <strong>{formatDateTime(event.time)}</strong>{" "}
                        {getStatusIcon(event.status)} {event.title}
                        <br />
                        <span>{event.description}</span>
                        {event.amount ? (
                          <>
                            <br />
                            <span>Amount: {formatCr(toCr(event.amount))}</span>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-chat-panel">
                <h2>Ask Activity AI</h2>

                <div className="chat-message">
                  Ask: “What changed across the platform today?”
                </div>

                <div className="chat-message">
                  Ask: “Which capital calls generated investor notices?”
                </div>

                <div className="chat-message">
                  Ask: “Which documents are visible in the Investor Portal?”
                </div>

                <div className="chat-message">
                  Ask: “Which investor communications are still pending?”
                </div>
                                <div className="chat-message">
                  Ask: “What happened in the data room today?”
                </div>

                <div className="chat-message">
                  Ask: “Which DDQ questions are still open?”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Workflow Dependency Graph</h2>

                            <div className="queue-grid">
                <div className="queue-item">Capital Call Approved</div>
                <div className="queue-item">Document Batch Received</div>
                <div className="queue-item">Investor Notices Generated</div>
                <div className="queue-item">PDF Stored in Vault</div>
                <div className="queue-item">Investor Portal Updated</div>
                <div className="queue-item">Data Room Opened</div>
                <div className="queue-item">LP Viewed / Downloaded File</div>
                <div className="queue-item">DDQ Question Tracked</div>
                <div className="queue-item">Readiness Score Updated</div>
                <div className="queue-item">Audit Trail Recorded</div>
              </div>

                            <div className="explain-box">
                This is the connected VENTIQ loop: Finance approval flows into
                document generation, document vault, investor portal visibility,
                data room diligence, DDQ tracking, communication status and audit
                evidence without rebuilding the same information in separate
                tools.
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Reasoning Preview</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Observed Workflow</span>
                  <strong>
                                        Capital Call → Document Engine → Investor Portal → Data Room
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Evidence Points</span>
                  <strong>{activityEvents.length}</strong>
                </div>

                <div className="journal-row">
                  <span>Portal-Ready Documents</span>
                  <strong>{portalAvailableDocuments.length}</strong>
                </div>

                <div className="journal-row">
                  <span>Stored PDFs</span>
                  <strong>{storedDocuments.length}</strong>
                </div>
                                <div className="journal-row">
                  <span>Data Room Events</span>
                  <strong>{dataRoomEvents.length}</strong>
                </div>

                <div className="journal-row">
                  <span>Risk</span>
                  <strong>
                    {documents.length > storedDocuments.length
                      ? "Some documents not stored yet"
                      : "Low"}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Recommended Action</span>
                  <strong>
                    {documents.length > storedDocuments.length
                      ? "Store pending PDFs from Document Engine"
                      : "Continue investor dispatch workflow"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Downstream Impact</h2>

              <div className="queue-grid">
                <div className="queue-item">✓ Finance workflow captured</div>
                <div className="queue-item">✓ Approved call evidence recorded</div>
                <div className="queue-item">✓ Investor-wise notices tracked</div>
                <div className="queue-item">✓ Portal visibility tracked</div>
                <div className="queue-item">✓ PDF storage status visible</div>
                <div className="queue-item">✓ Email queue status visible</div>
                              <div className="queue-item">✓ Investor access connected</div>
                <div className="queue-item">✓ Data room diligence tracked</div>
                <div className="queue-item">✓ DDQ activity captured</div>
                <div className="queue-item">✓ Audit trail generated</div>
              </div>
            </div>

            <div className="preview-card">
              <h2>System Health</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  Activity Engine — Connected
                </div>

                <div className="queue-item">
                  Capital Calls — {approvedCapitalCalls.length} approved
                </div>

                <div className="queue-item">
                  Document Engine — {documents.length} records
                </div>

                <div className="queue-item">
                  Investor Portal — {portalAvailableDocuments.length} available
                </div>
                                <div className="queue-item">
                  Investor Data Room — {dataRoomEvents.length} events
                </div>

                <div className="queue-item">
                  Document Vault — {storedDocuments.length} stored PDFs
                </div>

                <div className="queue-item">
                  Email Dispatch — {emailQueuedOrSentDocuments.length} queued/sent
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}