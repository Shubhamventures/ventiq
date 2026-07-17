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

type DataRoomDocument = {
  id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  detected_type: string | null;
  suggested_folder: string | null;
  access_level: string | null;
  status: string | null;
  ddq_impact: string | null;
  imported_at: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DataRoomEngagementEvent = {
  id: string;
  investor_name: string | null;
  document_id: string | null;
  document_name: string | null;
  action: string;
  note: string | null;
  event_time: string | null;
  created_at: string | null;
};

type DataRoomQuestion = {
  id: string;
  investor_name: string | null;
  document_id: string | null;
  document_name: string | null;
  category: string | null;
  question: string;
  status: string | null;
  answer: string | null;
  asked_at: string | null;
  answered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  const value = status.toLowerCase();

  if (value.includes("approved")) return "🟢";
  if (value.includes("generated")) return "🔵";
  if (value.includes("stored")) return "🟣";
  if (value.includes("portal")) return "🟢";
  if (value.includes("email")) return "🟡";
  if (value.includes("data room")) return "🗂️";
  if (value.includes("imported")) return "📥";
  if (value.includes("viewed")) return "👁️";
  if (value.includes("downloaded")) return "⬇️";
  if (value.includes("ddq")) return "❓";
  if (value.includes("answered")) return "🟢";
  if (value.includes("open")) return "🟡";
  if (value.includes("readiness")) return "📊";

  return "⚪";
}

export default function ActivityEnginePage() {
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [dataRoomDocuments, setDataRoomDocuments] = useState<
    DataRoomDocument[]
  >([]);
  const [dataRoomEngagementEvents, setDataRoomEngagementEvents] = useState<
    DataRoomEngagementEvent[]
  >([]);
  const [dataRoomQuestions, setDataRoomQuestions] = useState<
    DataRoomQuestion[]
  >([]);
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

      const [
        capitalCallResult,
        documentResult,
        dataRoomDocumentResult,
        engagementResult,
        questionResult,
      ] = await Promise.all([
        supabase
          .from("capital_calls")
          .select(
            "id, call_name, call_date, due_date, call_amount, status, created_at, funds(name)"
          )
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("investor_documents")
          .select(
            "id, investor_id, document_type, document_name, investor_name, investor_email, fund_name, amount, status, email_status, portal_status, storage_url, generated_at"
          )
          .order("generated_at", { ascending: false })
          .limit(40),
        supabase
          .from("data_room_documents")
          .select("*")
          .order("imported_at", { ascending: false })
          .limit(40),
        supabase
          .from("data_room_engagement_events")
          .select("*")
          .order("event_time", { ascending: false })
          .limit(40),
        supabase
          .from("data_room_questions")
          .select("*")
          .order("asked_at", { ascending: false })
          .limit(40),
      ]);

      const firstError =
        capitalCallResult.error ||
        documentResult.error ||
        dataRoomDocumentResult.error ||
        engagementResult.error ||
        questionResult.error;

      if (firstError) {
        setErrorMessage(firstError.message);
        setLoading(false);
        return;
      }

      setCapitalCalls((capitalCallResult.data as unknown as CapitalCall[]) ?? []);
      setDocuments((documentResult.data as InvestorDocument[]) ?? []);
      setDataRoomDocuments(
        (dataRoomDocumentResult.data as DataRoomDocument[]) ?? []
      );
      setDataRoomEngagementEvents(
        (engagementResult.data as DataRoomEngagementEvent[]) ?? []
      );
      setDataRoomQuestions((questionResult.data as DataRoomQuestion[]) ?? []);
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

    dataRoomDocuments.forEach((documentRecord) => {
      events.push({
        id: `data-room-document-${documentRecord.id}`,
        time: documentRecord.imported_at ?? documentRecord.created_at ?? "",
        module: "Investor Data Room",
        title: "Data room document imported",
        description: `${documentRecord.file_name} classified as ${
          documentRecord.detected_type ?? "Investor Document"
        } and mapped to ${
          documentRecord.suggested_folder ?? "General Investor Documents"
        }`,
        status: "data room imported",
      });
    });

    dataRoomEngagementEvents.forEach((event) => {
      const action = event.action ?? "Viewed";

      events.push({
        id: `data-room-engagement-${event.id}`,
        time: event.event_time ?? event.created_at ?? "",
        module: "LP Engagement",
        title:
          action === "Downloaded"
            ? "LP downloaded data room document"
            : action === "Asked Question"
            ? "LP asked data room question"
            : "LP viewed data room document",
        description: `${event.investor_name ?? "Prospective LP"} ${action.toLowerCase()} ${
          event.document_name ?? "data room document"
        }`,
        status: `data room ${action.toLowerCase()}`,
        investorName: event.investor_name,
      });
    });

    dataRoomQuestions.forEach((question) => {
      events.push({
        id: `data-room-question-${question.id}`,
        time:
          question.status === "Answered" && question.answered_at
            ? question.answered_at
            : question.asked_at ?? question.created_at ?? "",
        module: "DDQ Hub",
        title:
          question.status === "Answered"
            ? "DDQ question answered"
            : "DDQ question raised",
        description: `${question.category ?? "DDQ"} — ${
          question.document_name ?? "General Data Room Question"
        } for ${question.investor_name ?? "Prospective LP"}`,
        status:
          question.status === "Answered"
            ? "ddq answered"
            : "ddq question open",
        investorName: question.investor_name,
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();
      return bTime - aTime;
    });
  }, [
    capitalCalls,
    documents,
    dataRoomDocuments,
    dataRoomEngagementEvents,
    dataRoomQuestions,
  ]);

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

  const dataRoomActivityEvents = activityEvents.filter(
    (event) =>
      event.module.includes("Data Room") ||
      event.module.includes("DDQ") ||
      event.module.includes("LP Engagement")
  );

  const openDDQQuestions = dataRoomQuestions.filter(
    (question) => question.status !== "Answered"
  );

  const answeredDDQQuestions = dataRoomQuestions.filter(
    (question) => question.status === "Answered"
  );

  const dataRoomFolderSet = new Set(
    dataRoomDocuments.map((documentRecord) => documentRecord.suggested_folder)
  );

  const dataRoomReadinessScore = Math.min(
    95,
    55 +
      Math.min(dataRoomDocuments.length * 4, 20) +
      Math.min(dataRoomEngagementEvents.length * 2, 10) +
      Math.min(answeredDDQQuestions.length * 3, 12) -
      Math.min(openDDQQuestions.length * 2, 10) +
      (dataRoomFolderSet.has("Fund Overview") ? 5 : 0) +
      (dataRoomFolderSet.has("Legal & Compliance") ? 5 : 0) +
      (dataRoomFolderSet.has("Track Record & Performance") ? 5 : 0) +
      (dataRoomFolderSet.has("Investor Reporting Samples") ? 5 : 0)
  );

  const recommendedAction =
    openDDQQuestions.length > 0
      ? `Answer ${openDDQQuestions.length} open DDQ question${
          openDDQQuestions.length === 1 ? "" : "s"
        }`
      : documents.length > storedDocuments.length
      ? "Store pending PDFs from Document Engine"
      : dataRoomDocuments.length === 0
      ? "Import data room documents"
      : "Continue monitoring investor engagement";

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Intelligence Layer</p>
            <h1>AI Activity Engine</h1>
            <p>
              A connected audit and intelligence layer showing how fund actions,
              document generation, portal updates, investor communication, data
              room activity and DDQ movement flow across VENTIQ.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Connected activity preview · Reading capital calls, investor documents,
          data room imports, LP engagement and DDQ questions
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Activity Engine...</h2>
            <p>
              VENTIQ is reading capital calls, generated notices, portal status,
              document vault records, data room activity and DDQ questions.
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
                <h3>{dataRoomActivityEvents.length}</h3>
                <p>Data room events</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Workflow Summary</h2>

              <div className="explain-box">
                The Activity Engine is now reading the same fund workflow data
                used by Capital Call, Document Engine, Investor Portal and
                Investor Data Room. This proves the VENTIQ operating layer: one
                action creates downstream evidence across modules.
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
                  🟣 Document Vault
                  <br />
                  {storedDocuments.length} PDFs stored
                </div>

                <div className="queue-item">
                  🗂️ Investor Data Room
                  <br />
                  {dataRoomDocuments.length} imported documents
                </div>

                <div className="queue-item">
                  👁️ LP Engagement
                  <br />
                  {dataRoomEngagementEvents.length} views, downloads or questions
                </div>

                <div className="queue-item">
                  ❓ DDQ Hub
                  <br />
                  {openDDQQuestions.length} open / {answeredDDQQuestions.length} answered
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
                    generate notices, import data room documents or record LP
                    engagement to create the first connected trail.
                  </div>
                )}

                {activityEvents.length > 0 && (
                  <div className="audit-timeline">
                    {activityEvents.slice(0, 20).map((event) => (
                      <div key={event.id} className="audit-item">
                        <strong>{formatDateTime(event.time)}</strong>{" "}
                        {getStatusIcon(event.status)} {event.title}
                        <br />
                        <span>
                          {event.module} — {event.description}
                        </span>
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
                <div className="queue-item">Data Room Document Imported</div>
                <div className="queue-item">LP Viewed / Downloaded File</div>
                <div className="queue-item">DDQ Question Tracked</div>
                <div className="queue-item">DDQ Response Updated</div>
                <div className="queue-item">Audit Trail Recorded</div>
              </div>

              <div className="explain-box">
                This is the connected VENTIQ loop: Finance approval flows into
                document generation, document vault, investor portal visibility,
                data room diligence, LP engagement, DDQ tracking and audit
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
                  <span>Data Room Documents</span>
                  <strong>{dataRoomDocuments.length}</strong>
                </div>

                <div className="journal-row">
                  <span>LP Engagement Events</span>
                  <strong>{dataRoomEngagementEvents.length}</strong>
                </div>

                <div className="journal-row">
                  <span>Open DDQ Questions</span>
                  <strong>{openDDQQuestions.length}</strong>
                </div>

                <div className="journal-row">
                  <span>Data Room Readiness</span>
                  <strong>{dataRoomReadinessScore}%</strong>
                </div>

                <div className="journal-row">
                  <span>Risk</span>
                  <strong>
                    {openDDQQuestions.length > 0
                      ? "DDQ questions pending"
                      : documents.length > storedDocuments.length
                      ? "Some documents not stored yet"
                      : "Low"}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Recommended Action</span>
                  <strong>{recommendedAction}</strong>
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
                <div className="queue-item">✓ Data room diligence tracked</div>
                <div className="queue-item">✓ LP engagement captured</div>
                <div className="queue-item">✓ DDQ activity recorded</div>
              </div>
            </div>

            <div className="preview-card">
              <h2>System Health</h2>

              <div className="queue-grid">
                <div className="queue-item">Activity Engine — Connected</div>

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
                  Document Vault — {storedDocuments.length} stored PDFs
                </div>

                <div className="queue-item">
                  Data Room — {dataRoomDocuments.length} imported documents
                </div>

                <div className="queue-item">
                  LP Engagement — {dataRoomEngagementEvents.length} events
                </div>

                <div className="queue-item">
                  DDQ Hub — {openDDQQuestions.length} open questions
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}