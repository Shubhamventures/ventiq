"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type FinanceActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};

function getString(row: DataRow | undefined, keys: string[], fallback = "-") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow | undefined, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function getId(row: DataRow | undefined) {
  return getString(row, ["id"], "");
}

function formatCurrencyCr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0 Cr";

  return `₹${(value / 10000000).toFixed(1)} Cr`;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value: string) {
  if (!value) return "Active";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function rowStatus(row: DataRow) {
  return getString(row, ["status"], "").toLowerCase();
}

function isApproved(row: DataRow) {
  return rowStatus(row) === "approved";
}

function isDraft(row: DataRow) {
  const status = rowStatus(row);

  return status === "draft" || status === "pending" || status === "";
}

function getActivityIcon(status: string) {
  const value = status.toLowerCase();

  if (value.includes("approved")) return "🟢";
  if (value.includes("generated")) return "🔵";
  if (value.includes("available")) return "🟢";
  if (value.includes("stored")) return "🟣";
  if (value.includes("queued")) return "🟡";
  if (value.includes("sent")) return "🟢";
  if (value.includes("review")) return "🔴";

  return "⚪";
}

export default function FinanceHeadAIPage() {
  const [capitalCalls, setCapitalCalls] = useState<DataRow[]>([]);
  const [distributions, setDistributions] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [regulatoryMatches, setRegulatoryMatches] = useState<DataRow[]>([]);
  const [regulatoryCirculars, setRegulatoryCirculars] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFinanceHeadWorkspace() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage(
          "The sample Finance Head workspace is temporarily unavailable. Please request a walkthrough."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const [
        capitalCallsResult,
        distributionsResult,
        documentsResult,
        matchesResult,
        circularsResult,
      ] = await Promise.all([
        supabase
          .from("capital_calls")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("distributions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("investor_documents")
          .select("*")
          .order("generated_at", { ascending: false }),
        supabase
          .from("regulatory_source_matches")
          .select("*")
          .eq("status", "needs_review"),
        supabase.from("regulatory_circulars").select("*").eq("status", "active"),
      ]);

      const firstError =
        capitalCallsResult.error ||
        distributionsResult.error ||
        documentsResult.error ||
        matchesResult.error ||
        circularsResult.error;

      if (firstError) {
        setErrorMessage(firstError.message);
        setLoading(false);
        return;
      }

      setCapitalCalls((capitalCallsResult.data ?? []) as DataRow[]);
      setDistributions((distributionsResult.data ?? []) as DataRow[]);
      setInvestorDocuments((documentsResult.data ?? []) as DataRow[]);
      setRegulatoryMatches((matchesResult.data ?? []) as DataRow[]);
      setRegulatoryCirculars((circularsResult.data ?? []) as DataRow[]);
      setLoading(false);
    }

    loadFinanceHeadWorkspace();
  }, []);

  const financeMetrics = useMemo(() => {
    const approvedCapitalCalls = capitalCalls.filter(isApproved);
    const draftCapitalCalls = capitalCalls.filter(isDraft);

    const approvedDistributions = distributions.filter(isApproved);
    const draftDistributions = distributions.filter(isDraft);

    const totalApprovedCapitalCallAmount = approvedCapitalCalls.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "call_amount",
          "capital_call_amount",
          "total_amount",
          "amount",
        ]),
      0
    );

    const totalDraftCapitalCallAmount = draftCapitalCalls.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "call_amount",
          "capital_call_amount",
          "total_amount",
          "amount",
        ]),
      0
    );

    const totalApprovedDistributionAmount = approvedDistributions.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "distribution_amount",
          "total_distribution_amount",
          "amount",
        ]),
      0
    );

    const storedDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url"], ""))
    );

    const portalAvailableDocuments = investorDocuments.filter(
      (row) => getString(row, ["portal_status"], "") === "available"
    );

    const queuedEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "queued"
    );

    const sentEmails = investorDocuments.filter(
      (row) => getString(row, ["email_status"], "") === "sent"
    );

    const generatedDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["document_type"], ""))
    );

    const documentsNotStored = investorDocuments.filter(
      (row) => !getString(row, ["storage_url"], "")
    );

    const highImpactCirculars = regulatoryCirculars.filter(
      (row) => getString(row, ["impact"], "").toUpperCase() === "HIGH"
    );

    return {
      approvedCapitalCalls: approvedCapitalCalls.length,
      draftCapitalCalls: draftCapitalCalls.length,
      approvedDistributions: approvedDistributions.length,
      draftDistributions: draftDistributions.length,
      totalApprovedCapitalCallAmount,
      totalDraftCapitalCallAmount,
      totalApprovedDistributionAmount,
      generatedDocuments: generatedDocuments.length,
      storedDocuments: storedDocuments.length,
      documentsNotStored: documentsNotStored.length,
      portalAvailableDocuments: portalAvailableDocuments.length,
      queuedEmails: queuedEmails.length,
      sentEmails: sentEmails.length,
      pendingRegulatoryReviews: regulatoryMatches.length,
      highImpactCirculars: highImpactCirculars.length,
    };
  }, [
    capitalCalls,
    distributions,
    investorDocuments,
    regulatoryMatches,
    regulatoryCirculars,
  ]);

  const financeActivityEvents = useMemo(() => {
    const events: FinanceActivityEvent[] = [];

    capitalCalls.forEach((call) => {
      const status = getString(call, ["status"], "draft");
      const amount = getNumber(call, [
        "call_amount",
        "capital_call_amount",
        "total_amount",
        "amount",
      ]);

      events.push({
        id: `capital-call-${getId(call)}`,
        time: getString(call, ["created_at", "call_date"], ""),
        module: "Capital Call",
        title:
          status === "approved"
            ? "Capital call approved"
            : "Capital call awaiting finance review",
        description: `${getString(
          call,
          ["call_name", "name"],
          "Capital Call"
        )} • ${formatCurrencyCr(amount)}`,
        status,
      });
    });

    distributions.forEach((distribution) => {
      const status = getString(distribution, ["status"], "draft");
      const amount = getNumber(distribution, [
        "distribution_amount",
        "total_distribution_amount",
        "amount",
      ]);

      events.push({
        id: `distribution-${getId(distribution)}`,
        time: getString(
          distribution,
          ["created_at", "distribution_date", "payment_date"],
          ""
        ),
        module: "Distribution",
        title:
          status === "approved"
            ? "Distribution approved"
            : "Distribution awaiting review",
        description: `${getString(
          distribution,
          ["distribution_name", "name"],
          "Distribution"
        )} • ${formatCurrencyCr(amount)}`,
        status,
      });
    });

    investorDocuments.forEach((documentRecord) => {
      const documentId = getId(documentRecord);
      const documentType = getString(
        documentRecord,
        ["document_type"],
        "Investor Document"
      );
      const documentName = getString(
        documentRecord,
        ["document_name"],
        "Investor Document"
      );
      const investorName = getString(
        documentRecord,
        ["investor_name"],
        "Investor"
      );
      const generatedAt = getString(documentRecord, ["generated_at"], "");

      events.push({
        id: `document-generated-${documentId}`,
        time: generatedAt,
        module: "Document Engine",
        title: `${documentType} generated`,
        description: `${documentName} for ${investorName}`,
        status: getString(documentRecord, ["status"], "generated"),
      });

      if (getString(documentRecord, ["portal_status"], "") === "available") {
        events.push({
          id: `portal-${documentId}`,
          time: generatedAt,
          module: "Investor Portal",
          title: "Investor portal updated",
          description: `${documentType} made available to ${investorName}`,
          status: "available",
        });
      }

      if (getString(documentRecord, ["storage_url"], "")) {
        events.push({
          id: `stored-${documentId}`,
          time: generatedAt,
          module: "Document Vault",
          title: "PDF stored",
          description: `${documentName} stored in the portal vault`,
          status: "stored",
        });
      }

      const emailStatus = getString(documentRecord, ["email_status"], "");

      if (emailStatus === "queued" || emailStatus === "sent") {
        events.push({
          id: `email-${documentId}`,
          time: generatedAt,
          module: "Email Dispatch",
          title:
            emailStatus === "sent"
              ? "Investor email marked sent"
              : "Investor email queued",
          description: `${documentName} email ${emailStatus}`,
          status: emailStatus,
        });
      }
    });

    regulatoryMatches.forEach((match) => {
      events.push({
        id: `regulatory-${getId(match)}`,
        time: getString(match, ["created_at", "matched_at"], ""),
        module: "Knowledge Hub",
        title: "Regulatory item needs review",
        description: getString(
          match,
          ["title", "source_title", "match_reason"],
          "Regulatory source match requires finance/compliance review"
        ),
        status: "needs_review",
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [capitalCalls, distributions, investorDocuments, regulatoryMatches]);

  const pendingFinanceActions = useMemo(() => {
    const actions = [
      {
        title: "Review capital call drafts",
        value: `${financeMetrics.draftCapitalCalls} pending`,
        href: "/capital-call",
        priority: financeMetrics.draftCapitalCalls > 0 ? "High" : "Clear",
      },
      {
        title: "Generate or review investor documents",
        value: `${financeMetrics.generatedDocuments} generated`,
        href: "/document-engine",
        priority:
          financeMetrics.documentsNotStored > 0 ? "Medium" : "On track",
      },
      {
        title: "Store PDFs for investor portal",
        value: `${financeMetrics.documentsNotStored} pending storage`,
        href: "/document-engine",
        priority:
          financeMetrics.documentsNotStored > 0 ? "High" : "Clear",
      },
      {
        title: "Queue investor email dispatch",
        value: `${financeMetrics.queuedEmails} queued / ${financeMetrics.sentEmails} sent`,
        href: "/document-engine",
        priority:
          financeMetrics.generatedDocuments >
          financeMetrics.queuedEmails + financeMetrics.sentEmails
            ? "Medium"
            : "On track",
      },
      {
        title: "Review regulatory source matches",
        value: `${financeMetrics.pendingRegulatoryReviews} needs review`,
        href: "/knowledge-hub",
        priority:
          financeMetrics.pendingRegulatoryReviews > 0 ? "High" : "Clear",
      },
      {
        title: "Monitor downstream audit trail",
        value: `${financeActivityEvents.length} evidence points`,
        href: "/activity-engine",
        priority: "Live",
      },
    ];

    return actions;
  }, [financeMetrics, financeActivityEvents.length]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Finance Head Workspace</h1>
            <p>
              Live fund finance control room for capital calls, distributions,
              document generation, investor portal updates, email dispatch and
              regulatory review.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Connected finance workspace · Reading fund workflow records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Finance Head Workspace...</h2>
            <p>
              VENTIQ is reading capital calls, distributions, investor
              documents, portal status and regulatory review records.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="preview-card">
              <h2>Finance Head Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {capitalCalls.length} capital call workflows,{" "}
                {distributions.length} distribution workflows,{" "}
                {financeMetrics.generatedDocuments} investor documents,{" "}
                {financeMetrics.portalAvailableDocuments} portal-ready records
                and {financeMetrics.pendingRegulatoryReviews} regulatory items
                needing review.
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/capital-call">
                  Open Capital Calls
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/document-engine"
                >
                  Review Documents
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/activity-engine"
                >
                  Open Activity Engine
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/knowledge-hub"
                >
                  Review Regulatory Items
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{financeMetrics.draftCapitalCalls}</h3>
                <p>Capital call drafts</p>
              </div>

              <div className="impact-card">
                <h3>
                  {formatCurrencyCr(financeMetrics.totalApprovedCapitalCallAmount)}
                </h3>
                <p>Approved called capital</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.generatedDocuments}</h3>
                <p>Investor documents</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.pendingRegulatoryReviews}</h3>
                <p>Regulatory reviews</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{financeMetrics.portalAvailableDocuments}</h3>
                <p>Portal-ready records</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.storedDocuments}</h3>
                <p>Stored PDFs</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.queuedEmails}</h3>
                <p>Queued emails</p>
              </div>

              <div className="impact-card">
                <h3>{financeMetrics.sentEmails}</h3>
                <p>Sent emails</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Today&apos;s Finance Control Queue</h2>

              <div className="queue-grid">
                {pendingFinanceActions.map((action) => (
                  <a
                    key={action.title}
                    className="queue-item"
                    href={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <strong>{action.title}</strong>
                    <br />
                    {action.value}
                    <br />
                    Priority: {action.priority}
                  </a>
                ))}
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Live Finance Activity Feed</h2>

                {financeActivityEvents.length === 0 && (
                  <div className="explain-box">
                    No connected finance activity found yet. Approve a capital
                    call, generate notices, store PDFs or queue emails to create
                    the first finance trail.
                  </div>
                )}

                {financeActivityEvents.length > 0 && (
                  <div className="audit-timeline">
                    {financeActivityEvents.slice(0, 12).map((event) => (
                      <div className="audit-item" key={event.id}>
                        <strong>{formatDateTime(event.time)}</strong>{" "}
                        {getActivityIcon(event.status)} {event.title}
                        <br />
                        <span>
                          {event.module} — {event.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-side-panel">
                <h2>Ask Finance AI</h2>

                <div className="chat-message">
                  Ask: “What should I complete first today?”
                </div>

                <div className="chat-message">
                  Ask: “Which investor notices are not stored yet?”
                </div>

                <div className="chat-message">
                  Ask: “Which capital calls are approved but not dispatched?”
                </div>

                <div className="chat-message">
                  Ask: “Show regulatory items needing review.”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Document and Investor Communication Status</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Generated investor documents</span>
                  <strong>{financeMetrics.generatedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Available in investor portal</span>
                  <strong>{financeMetrics.portalAvailableDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Stored PDFs</span>
                  <strong>{financeMetrics.storedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>PDFs pending storage</span>
                  <strong>{financeMetrics.documentsNotStored}</strong>
                </div>

                <div className="journal-row">
                  <span>Email queued</span>
                  <strong>{financeMetrics.queuedEmails}</strong>
                </div>

                <div className="journal-row">
                  <span>Email sent</span>
                  <strong>{financeMetrics.sentEmails}</strong>
                </div>
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/document-engine"
                >
                  Open Document Engine
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/investor-portal"
                >
                  Open Investor Portal
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Capital Call and Distribution Status</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Draft capital calls</span>
                  <strong>{financeMetrics.draftCapitalCalls}</strong>
                </div>

                <div className="journal-row">
                  <span>Approved capital calls</span>
                  <strong>{financeMetrics.approvedCapitalCalls}</strong>
                </div>

                <div className="journal-row">
                  <span>Approved capital call amount</span>
                  <strong>
                    {formatCurrencyCr(
                      financeMetrics.totalApprovedCapitalCallAmount
                    )}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Draft distribution workflows</span>
                  <strong>{financeMetrics.draftDistributions}</strong>
                </div>

                <div className="journal-row">
                  <span>Approved distribution amount</span>
                  <strong>
                    {formatCurrencyCr(
                      financeMetrics.totalApprovedDistributionAmount
                    )}
                  </strong>
                </div>
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/capital-call">
                  Review Capital Calls
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/distribution-waterfall"
                >
                  Review Distributions
                </a>
              </div>
            </div>

            <div className="preview-card">
              <h2>Finance AI Answer Preview</h2>

              <div className="explain-box">
                <strong>Question:</strong> What should I complete first today?
                <br />
                <br />
                <strong>VENTIQ AI:</strong>{" "}
                {financeMetrics.documentsNotStored > 0
                  ? `Store ${financeMetrics.documentsNotStored} pending PDFs from Document Engine so investors can access final notices in the portal.`
                  : financeMetrics.draftCapitalCalls > 0
                  ? `Review ${financeMetrics.draftCapitalCalls} capital call draft workflows before generating investor notices.`
                  : financeMetrics.pendingRegulatoryReviews > 0
                  ? `Review ${financeMetrics.pendingRegulatoryReviews} regulatory source matches in Knowledge Hub.`
                  : "Finance workflows are currently on track. Continue monitoring Activity Engine and investor communication status."}
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Finance Loop</h2>

              <div className="queue-grid">
                <div className="queue-item">Capital Call Drafted</div>
                <div className="queue-item">Finance Review Completed</div>
                <div className="queue-item">Document Engine Generated Notices</div>
                <div className="queue-item">PDF Stored in Vault</div>
                <div className="queue-item">Investor Portal Updated</div>
                <div className="queue-item">Investor Email Queued</div>
                <div className="queue-item">Activity Engine Recorded Evidence</div>
                <div className="queue-item">Managing Partner View Updated</div>
              </div>

              <div className="explain-box">
                This is the Finance Head view of the same connected VENTIQ
                operating loop. The finance team can see what needs review,
                what has been generated, what is visible to investors and what
                remains pending before dispatch.
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}