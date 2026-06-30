"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type CircularRecord = {
  id: string;
  slug: string;
  authority: string;
  circular_number: string;
  title: string;
  saved_as: string;
  topic: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effective_date: string | null;
  summary: string | null;
  what_changed: string | null;
  affected_workflows: string[];
  impacted_funds: string[];
  recommended_actions: string[];
  checklist: string[];
  related_circulars: string[];
  aliases: string[];
  owner: string | null;
  internal_note: string | null;
  linked_sop: string | null;
  source_url: string | null;
  document_url: string | null;
  status: string | null;
};

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function includesSearch(value: string | string[] | null | undefined, searchTerm: string) {
  const source = Array.isArray(value) ? value.join(" ") : String(value ?? "");

  return source.toLowerCase().includes(searchTerm.toLowerCase());
}

export default function KnowledgeHub() {
  const [circulars, setCirculars] = useState<CircularRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAuthority, setSelectedAuthority] = useState("All");
  const [selectedCircularId, setSelectedCircularId] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState(
    "What changed in this circular?"
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const authorities = ["All", "SEBI", "IFSCA", "Income Tax", "RBI", "MCA"];

  useEffect(() => {
    loadRegulatoryCirculars();
  }, []);

  async function loadRegulatoryCirculars() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured. Please check .env.local.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("regulatory_circulars")
      .select(
        "id, slug, authority, circular_number, title, saved_as, topic, impact, effective_date, summary, what_changed, affected_workflows, impacted_funds, recommended_actions, checklist, related_circulars, aliases, owner, internal_note, linked_sop, source_url, document_url, status"
      )
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const circularData =
      data?.map((record) => ({
        id: record.id,
        slug: record.slug,
        authority: record.authority,
        circular_number: record.circular_number,
        title: record.title,
        saved_as: record.saved_as,
        topic: record.topic,
        impact: record.impact,
        effective_date: record.effective_date,
        summary: record.summary,
        what_changed: record.what_changed,
        affected_workflows: asStringArray(record.affected_workflows),
        impacted_funds: asStringArray(record.impacted_funds),
        recommended_actions: asStringArray(record.recommended_actions),
        checklist: asStringArray(record.checklist),
        related_circulars: asStringArray(record.related_circulars),
        aliases: asStringArray(record.aliases),
        owner: record.owner,
        internal_note: record.internal_note,
        linked_sop: record.linked_sop,
        source_url: record.source_url,
        document_url: record.document_url,
        status: record.status,
      })) ?? [];

    setCirculars(circularData);

    const preferredCircular =
      circularData.find((record) => record.slug === "valuation-rules") ??
      circularData[0];

    if (preferredCircular) {
      setSelectedCircularId(preferredCircular.id);
    }

    setLoading(false);
  }

  const filteredCirculars = useMemo(() => {
    return circulars.filter((record) => {
      const authorityMatch =
        selectedAuthority === "All" || record.authority === selectedAuthority;

      const searchMatch =
        !searchTerm.trim() ||
        includesSearch(record.title, searchTerm) ||
        includesSearch(record.saved_as, searchTerm) ||
        includesSearch(record.topic, searchTerm) ||
        includesSearch(record.authority, searchTerm) ||
        includesSearch(record.circular_number, searchTerm) ||
        includesSearch(record.aliases, searchTerm) ||
        includesSearch(record.affected_workflows, searchTerm) ||
        includesSearch(record.impacted_funds, searchTerm);

      return authorityMatch && searchMatch;
    });
  }, [circulars, searchTerm, selectedAuthority]);

  const selectedCircular =
    circulars.find((record) => record.id === selectedCircularId) ??
    circulars[0];

  const highImpactCount = circulars.filter(
    (record) => record.impact === "HIGH"
  ).length;

  const affectedWorkflowCount =
    selectedCircular?.affected_workflows.length ?? 0;

  const impactedFundCount = selectedCircular?.impacted_funds.length ?? 0;

  const pendingActionCount =
    selectedCircular?.recommended_actions.length ?? 0;

  function buildAiAnswer(question: string) {
    if (!selectedCircular) {
      return "No circular selected yet.";
    }

    if (question === "What changed in this circular?") {
      return (
        selectedCircular.what_changed ??
        "VENTIQ has not received a detailed change summary for this circular yet."
      );
    }

    if (question === "Which workflows are affected?") {
      return `VENTIQ found ${
        selectedCircular.affected_workflows.length
      } affected workflows: ${selectedCircular.affected_workflows.join(", ")}.`;
    }

    if (question === "Which funds are impacted?") {
      return `VENTIQ found that this update may impact ${selectedCircular.impacted_funds.join(
        ", "
      )}. The final impact should be reviewed fund-wise by finance and compliance teams.`;
    }

    if (question === "What should the team do next?") {
      const firstAction =
        selectedCircular.recommended_actions[0] ?? "generate a compliance checklist";

      return `VENTIQ recommends ${firstAction} as the first action, followed by checklist generation, SOP update and owner assignment.`;
    }

    if (question === "Create an SOP from this circular.") {
      return `VENTIQ can convert this circular into an SOP covering scope, applicability, owner, frequency, checklist, review evidence and audit trail. Linked SOP suggestion: ${
        selectedCircular.linked_sop ?? "New SOP draft"
      }.`;
    }

    return (
      selectedCircular.summary ??
      "VENTIQ reviewed the selected circular and found that a detailed summary is pending."
    );
  }

  const questionOptions = [
    "What changed in this circular?",
    "Which workflows are affected?",
    "Which funds are impacted?",
    "What should the team do next?",
    "Create an SOP from this circular.",
  ];

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Regulatory Intelligence</p>
            <h1>Knowledge Hub AI</h1>
            <p>
              Track SEBI, IFSCA, Income Tax, RBI and MCA updates, understand
              fund impact, and convert circulars into workflows, checklists and
              SOPs.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Loading Knowledge Hub...</h2>
            <p>
              VENTIQ is reading regulatory circulars from Supabase.
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

        {!loading && !errorMessage && circulars.length === 0 && (
          <div className="preview-card">
            <h2>No Circulars Found</h2>

            <div className="explain-box">
              No active circular records found in Supabase. Please add records
              in the regulatory_circulars table.
            </div>
          </div>
        )}

        {!loading && !errorMessage && circulars.length > 0 && selectedCircular && (
          <>
            <div className="preview-card">
              <h2>Ask VENTIQ AI</h2>

              <div className="form-card">
                <label>Search circulars, aliases, workflows or fund impact</label>

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ask anything... valuation, Form 64C, GIFT City, capital call..."
                />

                <div className="logic-note">
                  Natural Language Search • AI Summary • Regulatory Impact • Fund
                  Workflows • SOP Generation • Supabase Knowledge Base
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Authorities</h2>

              <div className="queue-grid">
                {authorities.map((authority) => (
                  <button
                    key={authority}
                    type="button"
                    onClick={() => setSelectedAuthority(authority)}
                    className="queue-item"
                    style={{
                      textAlign: "left",
                      border:
                        selectedAuthority === authority
                          ? "1px solid rgba(96, 165, 250, 0.65)"
                          : "1px solid rgba(148, 163, 184, 0.22)",
                      cursor: "pointer",
                      color: "#e5e7eb",
                      background:
                        selectedAuthority === authority
                          ? "rgba(37, 99, 235, 0.18)"
                          : "rgba(15, 23, 42, 0.45)",
                    }}
                  >
                    {authority}
                  </button>
                ))}
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{circulars.length}</h3>
                <p>Knowledge records</p>
              </div>

              <div className="impact-card">
                <h3>{highImpactCount}</h3>
                <p>High impact updates</p>
              </div>

              <div className="impact-card">
                <h3>{filteredCirculars.length}</h3>
                <p>Search results</p>
              </div>

              <div className="impact-card">
                <h3>Live DB</h3>
                <p>Supabase connected</p>
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Search Results</h2>

                {filteredCirculars.length === 0 && (
                  <div className="explain-box">
                    No circulars found for the selected search.
                  </div>
                )}

                <div className="queue-grid">
                  {filteredCirculars.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        setSelectedCircularId(record.id);
                        setSelectedQuestion("What changed in this circular?");
                      }}
                      className="queue-item"
                      style={{
                        textAlign: "left",
                        border:
                          selectedCircular.id === record.id
                            ? "1px solid rgba(96, 165, 250, 0.65)"
                            : "1px solid rgba(148, 163, 184, 0.22)",
                        cursor: "pointer",
                        color: "#e5e7eb",
                        background:
                          selectedCircular.id === record.id
                            ? "rgba(37, 99, 235, 0.18)"
                            : "rgba(15, 23, 42, 0.45)",
                      }}
                    >
                      <strong>{record.saved_as}</strong>
                      <br />
                      {record.authority} • {record.topic}
                      <br />
                      Impact: {record.impact}
                    </button>
                  ))}
                </div>
              </div>

              <div className="preview-card">
                <h2>Selected Circular</h2>

                <div className="journal-preview">
                  <div className="journal-row">
                    <span>Official Reference</span>
                    <strong>{selectedCircular.circular_number}</strong>
                  </div>

                  <div className="journal-row">
                    <span>Saved As</span>
                    <strong>{selectedCircular.saved_as}</strong>
                  </div>

                  <div className="journal-row">
                    <span>Authority</span>
                    <strong>{selectedCircular.authority}</strong>
                  </div>

                  <div className="journal-row">
                    <span>Topic</span>
                    <strong>{selectedCircular.topic}</strong>
                  </div>

                  <div className="journal-row">
                    <span>Impact</span>
                    <strong>{selectedCircular.impact}</strong>
                  </div>

                  <div className="journal-row">
                    <span>Effective Date</span>
                    <strong>{formatDate(selectedCircular.effective_date)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Aliases & Internal Names</h2>

                <p>
                  VENTIQ allows teams to save circulars using the names they
                  actually remember.
                </p>

                <div className="alias-grid">
                  {selectedCircular.aliases.map((alias) => (
                    <span key={alias} className="alias-pill">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ai-chat-panel">
                <h2>VENTIQ AI Chat</h2>

                {questionOptions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setSelectedQuestion(question)}
                    className="chat-message"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#e5e7eb",
                      background:
                        selectedQuestion === question
                          ? "rgba(37, 99, 235, 0.18)"
                          : "rgba(15, 23, 42, 0.45)",
                      border:
                        selectedQuestion === question
                          ? "1px solid rgba(96, 165, 250, 0.65)"
                          : "1px solid rgba(148, 163, 184, 0.22)",
                    }}
                  >
                    Ask: “{question}”
                  </button>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>VENTIQ AI Explanation</h2>

              <div className="explain-box">
                <strong>Question:</strong> {selectedQuestion}
                <br />
                <br />
                <strong>AI Answer:</strong> {buildAiAnswer(selectedQuestion)}
              </div>
            </div>

            <div className="preview-card">
              <h2>Impact Score</h2>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3 className="impact-score">{selectedCircular.impact}</h3>
                  <p>Regulatory impact</p>
                </div>

                <div className="impact-card">
                  <h3>{affectedWorkflowCount}</h3>
                  <p>Affected workflows</p>
                </div>

                <div className="impact-card">
                  <h3>{impactedFundCount}</h3>
                  <p>Fund types impacted</p>
                </div>

                <div className="impact-card">
                  <h3>{pendingActionCount}</h3>
                  <p>Recommended actions</p>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Recommended Actions</h2>

              <div className="recommended-actions">
                {selectedCircular.recommended_actions.map((action, index) => (
                  <div
                    key={action}
                    className={
                      index === 0
                        ? "recommended-action-card primary"
                        : "recommended-action-card"
                    }
                  >
                    <div>
                      <h3>
                        {index === 0 ? "⭐ " : "📋 "}
                        {action}
                      </h3>

                      <p>
                        VENTIQ recommends this action based on the selected
                        circular, impacted fund workflows and internal ownership.
                      </p>
                    </div>

                    <span className="recommended-action-link">Open →</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Compliance Checklist</h2>

              <div className="queue-grid">
                {selectedCircular.checklist.map((item) => (
                  <div key={item} className="queue-item">
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Affected Workflows</h2>

              <div className="queue-grid">
                {selectedCircular.affected_workflows.map((workflow) => (
                  <div key={workflow} className="queue-item">
                    {workflow}
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Impacted Funds</h2>

              <div className="queue-grid">
                {selectedCircular.impacted_funds.map((fund) => (
                  <div key={fund} className="queue-item">
                    {fund}
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Related Circulars</h2>

              <div className="queue-grid">
                {selectedCircular.related_circulars.map((circular) => (
                  <div key={circular} className="queue-item">
                    {circular}
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Firm Knowledge</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Owner</span>
                  <strong>{selectedCircular.owner ?? "-"}</strong>
                </div>

                <div className="journal-row">
                  <span>Internal Note</span>
                  <strong>{selectedCircular.internal_note ?? "-"}</strong>
                </div>

                <div className="journal-row">
                  <span>Linked SOP</span>
                  <strong>{selectedCircular.linked_sop ?? "-"}</strong>
                </div>

                <div className="journal-row">
                  <span>Next Upgrade</span>
                  <strong>
                    Connect uploaded circular PDFs, source links and LLM-powered
                    interpretation.
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}