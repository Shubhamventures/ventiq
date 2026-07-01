"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";

type CircularRecord = {
  id: string;
  slug: string;
  authority: string;
  circular_number: string;
  title: string;
  saved_as: string;
  topic: string;
  impact: ImpactLevel;
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
type SourceMonitor = {
  id: string;
  authority: string;
  source_name: string;
  source_url: string;
  source_type: string;
  tracking_scope: string | null;
  tracked_keywords: string[];
  excluded_keywords: string[];
  impact_areas: string[];
  refresh_frequency: string;
  status: string;
  last_checked_at: string | null;
  last_found_count: number;
  last_error: string | null;
  notes: string | null;
};
type NewCircularForm = {
  authority: string;
  circular_number: string;
  title: string;
  saved_as: string;
  topic: string;
  impact: ImpactLevel;
  effective_date: string;
  summary: string;
  what_changed: string;
  affected_workflows: string;
  impacted_funds: string;
  recommended_actions: string;
  checklist: string;
  related_circulars: string;
  aliases: string;
  owner: string;
  internal_note: string;
  linked_sop: string;
  source_url: string;
};

const emptyCircularForm: NewCircularForm = {
  authority: "SEBI",
  circular_number: "",
  title: "",
  saved_as: "",
  topic: "",
  impact: "MEDIUM",
  effective_date: "",
  summary: "",
  what_changed: "",
  affected_workflows: "",
  impacted_funds: "",
  recommended_actions: "",
  checklist: "",
  related_circulars: "",
  aliases: "",
  owner: "",
  internal_note: "",
  linked_sop: "",
  source_url: "",
};

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [];
}

function normalizeImpact(value: string): ImpactLevel {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }

  return "MEDIUM";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not checked yet";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isConnectorRequiredError(value: string | null) {
  if (!value) return false;

  const lowerValue = value.toLowerCase();

  return (
    lowerValue.includes("connector required") ||
    lowerValue.includes("blocked by source") ||
    lowerValue.includes("block server fetch")
  );
}

function getScanStatusKind(monitor: SourceMonitor) {
  if (isConnectorRequiredError(monitor.last_error)) {
    return "warning";
  }

  if (monitor.last_error) {
    return "error";
  }

  if (monitor.last_checked_at) {
    return "success";
  }

  return "neutral";
}

function getScanStatusLabel(monitor: SourceMonitor) {
  if (isConnectorRequiredError(monitor.last_error)) {
    return "Connector required";
  }

  if (monitor.last_error) {
    return "Last scan failed";
  }

  if (monitor.last_checked_at) {
    return `Last scan success • ${monitor.last_found_count} new`;
  }

  return "Not scanned yet";
}
function includesSearch(
  value: string | string[] | null | undefined,
  searchTerm: string
) {
  const source = Array.isArray(value) ? value.join(" ") : String(value ?? "");

  return source.toLowerCase().includes(searchTerm.toLowerCase());
}

function buildSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function textToArray(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function arrayToText(value: string[] | undefined) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.join("\n");
}

function buildSafeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function KnowledgeHub() {
  const [circulars, setCirculars] = useState<CircularRecord[]>([]);
  const [sourceMonitors, setSourceMonitors] = useState<SourceMonitor[]>([]);
const [expandedMonitorId, setExpandedMonitorId] = useState("");
const [refreshingMonitorId, setRefreshingMonitorId] = useState("");
const [refreshingAllSources, setRefreshingAllSources] = useState(false);
const [monitorMessage, setMonitorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAuthority, setSelectedAuthority] = useState("All");
  const [selectedCircularId, setSelectedCircularId] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState(
    "What changed in this circular?"
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCircular, setNewCircular] =
    useState<NewCircularForm>(emptyCircularForm);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [aiFillingCircular, setAiFillingCircular] = useState(false);
  const [savingCircular, setSavingCircular] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const authorities = ["All", "SEBI", "IFSCA", "Income Tax", "RBI", "MCA"];

  useEffect(() => {
  loadRegulatoryCirculars();
  loadRegulatorySourceMonitors();
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
        impact: normalizeImpact(record.impact),
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

    if (!selectedCircularId && preferredCircular) {
      setSelectedCircularId(preferredCircular.id);
    }

    setLoading(false);
  }
  async function loadRegulatorySourceMonitors() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { data, error } = await supabase
    .from("regulatory_source_monitors")
    .select(
      "id, authority, source_name, source_url, source_type, tracking_scope, tracked_keywords, excluded_keywords, impact_areas, refresh_frequency, status, last_checked_at, last_found_count, last_error, notes"
    )
    .eq("status", "active")
    .order("authority", { ascending: true });

  if (error) {
    setMonitorMessage(`Could not load source monitors: ${error.message}`);
    return;
  }

  const monitorData =
    data?.map((record) => ({
      id: record.id,
      authority: record.authority,
      source_name: record.source_name,
      source_url: record.source_url,
      source_type: record.source_type,
      tracking_scope: record.tracking_scope,
      tracked_keywords: asStringArray(record.tracked_keywords),
      excluded_keywords: asStringArray(record.excluded_keywords),
      impact_areas: asStringArray(record.impact_areas),
      refresh_frequency: record.refresh_frequency,
      status: record.status,
      last_checked_at: record.last_checked_at,
      last_found_count: record.last_found_count ?? 0,
      last_error: record.last_error,
      notes: record.notes,
    })) ?? [];

  setSourceMonitors(monitorData);
}

  function updateCircularForm<FieldName extends keyof NewCircularForm>(
    fieldName: FieldName,
    value: NewCircularForm[FieldName]
  ) {
    setNewCircular((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }
  async function handleRefreshAllSourceMonitors() {
  setRefreshingAllSources(true);
  setMonitorMessage("Scanning all regulatory sources...");

  let totalNewMatches = 0;
  let totalRelevantMatches = 0;
  let failedSources = 0;

  for (const monitor of sourceMonitors) {
    setRefreshingMonitorId(monitor.id);
    setMonitorMessage(`Scanning ${monitor.source_name}...`);

    try {
      const response = await fetch("/api/knowledge-hub/scan-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monitorId: monitor.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Source scan failed.");
      }

      totalNewMatches += Number(result.newMatches ?? 0);
      totalRelevantMatches += Number(result.totalMatches ?? 0);
    } catch {
      failedSources += 1;
    }
  }

  await loadRegulatorySourceMonitors();

  setRefreshingMonitorId("");
  setRefreshingAllSources(false);

  setMonitorMessage(
    `All source scans completed. ${totalNewMatches} new matches found. ${totalRelevantMatches} relevant links detected. ${failedSources} sources failed.`
  );
}
 async function handleRefreshSourceMonitor(monitor: SourceMonitor) {
  setRefreshingMonitorId(monitor.id);
  setMonitorMessage(`Scanning ${monitor.source_name}...`);

  try {
    const response = await fetch("/api/knowledge-hub/scan-source", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        monitorId: monitor.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Source scan failed.");
    }

    await loadRegulatorySourceMonitors();

    setMonitorMessage(
      `${monitor.source_name} scan completed. ${result.newMatches} new matches found. ${result.totalMatches} relevant links detected.`
    );
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Unknown scanning error.";

    await loadRegulatorySourceMonitors();

    setMonitorMessage(`${monitor.source_name} scan failed: ${errorText}`);
  }

  setRefreshingMonitorId("");
}
async function handleAiFillFromPdf() {
  if (!selectedPdfFile) {
    alert("Please upload a PDF first.");
    setActionMessage("Please upload a PDF first.");
    return;
  }

  if (selectedPdfFile.type !== "application/pdf") {
    alert("Please upload only PDF files.");
    setActionMessage("Please upload only PDF files.");
    return;
  }

  setAiFillingCircular(true);
  setActionMessage("VENTIQ AI is reading the PDF and filling the circular form...");

  try {
    const formData = new FormData();
    formData.append("file", selectedPdfFile);

    const response = await fetch("/api/knowledge-hub/ai-fill", {
      method: "POST",
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error ?? "AI Fill failed.");
    }

    const result = responseData.result;

    setNewCircular((currentForm) => ({
      ...currentForm,
      authority: result.authority || currentForm.authority,
      circular_number:
        result.circular_number || currentForm.circular_number,
      title: result.title || currentForm.title,
      saved_as: result.saved_as || currentForm.saved_as,
      topic: result.topic || currentForm.topic,
      impact: result.impact || currentForm.impact,
      effective_date: result.effective_date || currentForm.effective_date,
      summary: result.summary || currentForm.summary,
      what_changed: result.what_changed || currentForm.what_changed,
      affected_workflows:
        arrayToText(result.affected_workflows) ||
        currentForm.affected_workflows,
      impacted_funds:
        arrayToText(result.impacted_funds) || currentForm.impacted_funds,
      recommended_actions:
        arrayToText(result.recommended_actions) ||
        currentForm.recommended_actions,
      checklist: arrayToText(result.checklist) || currentForm.checklist,
      related_circulars:
        arrayToText(result.related_circulars) ||
        currentForm.related_circulars,
      aliases: arrayToText(result.aliases) || currentForm.aliases,
      owner: result.owner || currentForm.owner,
      internal_note: result.internal_note || currentForm.internal_note,
      linked_sop: result.linked_sop || currentForm.linked_sop,
    }));

    alert("AI Fill completed. Please review the form before saving.");
    setActionMessage("AI Fill completed. Please review the form before saving.");
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Unknown AI Fill error.";

    alert(`AI Fill failed: ${errorText}`);
    setActionMessage(`AI Fill failed: ${errorText}`);
  }

  setAiFillingCircular(false);
}
  async function uploadCircularPdf(slug: string) {
    if (!supabase || !selectedPdfFile) {
      return null;
    }

    if (selectedPdfFile.type !== "application/pdf") {
      throw new Error("Please upload only PDF files.");
    }

    const safeFileName = buildSafeFileName(selectedPdfFile.name);
    const storagePath = `${slug}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("regulatory-circulars")
      .upload(storagePath, selectedPdfFile, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("regulatory-circulars")
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  }

  async function handleCreateCircular() {
  if (!supabase) {
    alert("Supabase is not configured.");
    setActionMessage("Supabase is not configured.");
    return;
  }

  const savedAs = newCircular.saved_as.trim();
  const title = newCircular.title.trim();
  const topic = newCircular.topic.trim();

  if (!savedAs) {
    alert("Please enter Saved As.");
    setActionMessage("Please enter Saved As.");
    return;
  }

  if (!title) {
    alert("Please enter circular title.");
    setActionMessage("Please enter circular title.");
    return;
  }

  if (!topic) {
    alert("Please enter topic.");
    setActionMessage("Please enter topic.");
    return;
  }

  const slug = buildSlug(savedAs);

  if (!slug) {
    alert("Saved As should contain at least one valid word.");
    setActionMessage("Saved As should contain at least one valid word.");
    return;
  }

  setSavingCircular(true);
  setActionMessage("Saving circular...");

  try {
    const uploadedDocumentUrl = await uploadCircularPdf(slug);

    const payload = {
      slug,
      authority: newCircular.authority,
      circular_number:
        newCircular.circular_number.trim() || "Internal Regulatory Note",
      title,
      saved_as: savedAs,
      topic,
      impact: newCircular.impact,
      effective_date: newCircular.effective_date || null,
      summary: newCircular.summary || null,
      what_changed: newCircular.what_changed || null,
      affected_workflows: textToArray(newCircular.affected_workflows),
      impacted_funds: textToArray(newCircular.impacted_funds),
      recommended_actions: textToArray(newCircular.recommended_actions),
      checklist: textToArray(newCircular.checklist),
      related_circulars: textToArray(newCircular.related_circulars),
      aliases: textToArray(newCircular.aliases),
      owner: newCircular.owner || null,
      internal_note: newCircular.internal_note || null,
      linked_sop: newCircular.linked_sop || null,
      source_url: newCircular.source_url || null,
      document_url: uploadedDocumentUrl,
      status: "active",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("regulatory_circulars")
      .upsert(payload, {
        onConflict: "slug",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    await loadRegulatoryCirculars();

    if (data?.id) {
      setSelectedCircularId(data.id);
    }

    setSearchTerm("");
    setSelectedAuthority("All");
    setNewCircular(emptyCircularForm);
    setSelectedPdfFile(null);
    setShowCreateForm(false);

    alert("Regulatory circular saved successfully.");
    setActionMessage("Regulatory circular saved successfully.");
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Unknown error";

    alert(`Could not save circular: ${errorText}`);
    setActionMessage(`Could not save circular: ${errorText}`);
  }

  setSavingCircular(false);
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
        selectedCircular.recommended_actions[0] ??
        "generate a compliance checklist";

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
            <p>VENTIQ is reading regulatory circulars from Supabase.</p>
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
                  Natural Language Search • AI Summary • Regulatory Impact •
                  Fund Workflows • SOP Generation • Supabase Knowledge Base
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Add New Regulatory Record</h2>

              <div className="action-row">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? "Hide Form" : "Add Circular"}
                </button>
              </div>

              {actionMessage && (
                <div className="logic-note">{actionMessage}</div>
              )}

              {showCreateForm && (
                <div className="form-card">
                  <label>Authority</label>
                  <select
                    value={newCircular.authority}
                    onChange={(event) =>
                      updateCircularForm("authority", event.target.value)
                    }
                  >
                    <option>SEBI</option>
                    <option>IFSCA</option>
                    <option>Income Tax</option>
                    <option>RBI</option>
                    <option>MCA</option>
                  </select>

                  <label>Official Circular Number / Reference</label>
                  <input
                    value={newCircular.circular_number}
                    onChange={(event) =>
                      updateCircularForm("circular_number", event.target.value)
                    }
                    placeholder="Example: SEBI Circular - Valuation Update"
                  />

                  <label>Title</label>
                  <input
                    value={newCircular.title}
                    onChange={(event) =>
                      updateCircularForm("title", event.target.value)
                    }
                    placeholder="Example: AIF Valuation and Reporting Update"
                  />

                  <label>Saved As</label>
                  <input
                    value={newCircular.saved_as}
                    onChange={(event) =>
                      updateCircularForm("saved_as", event.target.value)
                    }
                    placeholder="Example: Valuation Rules"
                  />

                  <label>Topic</label>
                  <input
                    value={newCircular.topic}
                    onChange={(event) =>
                      updateCircularForm("topic", event.target.value)
                    }
                    placeholder="Example: Valuation"
                  />

                  <label>Impact</label>
                  <select
                    value={newCircular.impact}
                    onChange={(event) =>
                      updateCircularForm(
                        "impact",
                        event.target.value as ImpactLevel
                      )
                    }
                  >
                    <option>HIGH</option>
                    <option>MEDIUM</option>
                    <option>LOW</option>
                  </select>

                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={newCircular.effective_date}
                    onChange={(event) =>
                      updateCircularForm("effective_date", event.target.value)
                    }
                  />

                  <label>Source URL</label>
                  <input
                    value={newCircular.source_url}
                    onChange={(event) =>
                      updateCircularForm("source_url", event.target.value)
                    }
                    placeholder="Paste official source URL if available"
                  />

                  <label>Upload Circular PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setSelectedPdfFile(event.target.files?.[0] ?? null)
                    }
                  />

                  {selectedPdfFile && (
                    <div className="logic-note">
                      Selected PDF: {selectedPdfFile.name}
                    </div>
                  )}
                  <div className="action-row">
  <button
    type="button"
    onClick={() => {
      void handleAiFillFromPdf();
    }}
    disabled={!selectedPdfFile || aiFillingCircular}
  >
    {aiFillingCircular ? "AI Reading PDF..." : "AI Fill from PDF"}
  </button>
</div>

                  <label>Summary</label>
                  <textarea
                    value={newCircular.summary}
                    onChange={(event) =>
                      updateCircularForm("summary", event.target.value)
                    }
                    placeholder="Short summary of the circular"
                    rows={3}
                  />

                  <label>What Changed?</label>
                  <textarea
                    value={newCircular.what_changed}
                    onChange={(event) =>
                      updateCircularForm("what_changed", event.target.value)
                    }
                    placeholder="Explain what changed and why it matters"
                    rows={4}
                  />

                  <label>Affected Workflows</label>
                  <textarea
                    value={newCircular.affected_workflows}
                    onChange={(event) =>
                      updateCircularForm(
                        "affected_workflows",
                        event.target.value
                      )
                    }
                    placeholder="Valuation, NAV, Investor Reporting"
                    rows={3}
                  />

                  <label>Impacted Funds</label>
                  <textarea
                    value={newCircular.impacted_funds}
                    onChange={(event) =>
                      updateCircularForm("impacted_funds", event.target.value)
                    }
                    placeholder="Category II AIF, GIFT City Funds"
                    rows={3}
                  />

                  <label>Recommended Actions</label>
                  <textarea
                    value={newCircular.recommended_actions}
                    onChange={(event) =>
                      updateCircularForm(
                        "recommended_actions",
                        event.target.value
                      )
                    }
                    placeholder="Generate checklist, Notify auditors, Update SOP"
                    rows={3}
                  />

                  <label>Compliance Checklist</label>
                  <textarea
                    value={newCircular.checklist}
                    onChange={(event) =>
                      updateCircularForm("checklist", event.target.value)
                    }
                    placeholder="Review policy, Update tracker, Inform team"
                    rows={3}
                  />

                  <label>Aliases / Internal Names</label>
                  <textarea
                    value={newCircular.aliases}
                    onChange={(event) =>
                      updateCircularForm("aliases", event.target.value)
                    }
                    placeholder="NAV Circular, Valuation Rules, QCR Rules"
                    rows={3}
                  />

                  <label>Related Circulars</label>
                  <textarea
                    value={newCircular.related_circulars}
                    onChange={(event) =>
                      updateCircularForm(
                        "related_circulars",
                        event.target.value
                      )
                    }
                    placeholder="AIF Valuation Update, Investor Reporting Rules"
                    rows={3}
                  />

                  <label>Owner</label>
                  <input
                    value={newCircular.owner}
                    onChange={(event) =>
                      updateCircularForm("owner", event.target.value)
                    }
                    placeholder="Example: Finance Head"
                  />

                  <label>Internal Note</label>
                  <textarea
                    value={newCircular.internal_note}
                    onChange={(event) =>
                      updateCircularForm("internal_note", event.target.value)
                    }
                    placeholder="Internal firm note"
                    rows={3}
                  />

                  <label>Linked SOP</label>
                  <input
                    value={newCircular.linked_sop}
                    onChange={(event) =>
                      updateCircularForm("linked_sop", event.target.value)
                    }
                    placeholder="Example: Quarterly Valuation SOP v4"
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      onClick={() => {
  void handleCreateCircular();
}}
                      disabled={savingCircular}
                    >
                      {savingCircular ? "Saving..." : "Save Circular"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewCircular(emptyCircularForm);
                        setSelectedPdfFile(null);
                        setShowCreateForm(false);
                        setActionMessage("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

           <div className="preview-card">
  <div className="source-monitor-header">
    <div>
      <h2>Regulatory Source Monitor</h2>
      <p>
        Track official regulatory websites for AIFs, private capital, fund
        taxation, FEMA, FCRA, GIFT City and MCA changes.
      </p>
    </div>

    <button
      type="button"
      className="monitor-btn monitor-btn-primary"
      onClick={() => {
        void handleRefreshAllSourceMonitors();
      }}
      disabled={refreshingAllSources || sourceMonitors.length === 0}
    >
      {refreshingAllSources ? "Refreshing All..." : "Refresh All"}
    </button>
  </div>

  {monitorMessage && <div className="logic-note">{monitorMessage}</div>}

  {sourceMonitors.length === 0 && (
    <div className="explain-box">
      No source monitors found. Please check regulatory_source_monitors in
      Supabase.
    </div>
  )}

  <div className="source-monitor-grid">
    {sourceMonitors.map((monitor) => {
      const isExpanded = expandedMonitorId === monitor.id;

      return (
        <div
          key={monitor.id}
          className={
            isExpanded
              ? "source-monitor-card expanded"
              : "source-monitor-card"
          }
        >
          <div className="source-monitor-top">
            <span className="source-monitor-badge">{monitor.authority}</span>
            <span>{monitor.source_type}</span>
          </div>

          <h3>{monitor.source_name}</h3>

          <p className="source-monitor-description">
            {monitor.tracking_scope ?? "No tracking scope added."}
          </p>

          <div className="source-monitor-meta">
  <span>Frequency: {monitor.refresh_frequency}</span>
  <span>Last checked: {formatDateTime(monitor.last_checked_at)}</span>
  <span>Keywords: {monitor.tracked_keywords.length}</span>
  <span>Impact areas: {monitor.impact_areas.length}</span>

  <span className={`scan-status-pill ${getScanStatusKind(monitor)}`}>
  {getScanStatusLabel(monitor)}
</span>
</div>

          <div className="source-monitor-actions">
            <button
              type="button"
              className="monitor-btn monitor-btn-secondary"
              onClick={() => setExpandedMonitorId(isExpanded ? "" : monitor.id)}
            >
              {isExpanded ? "Hide Details" : "View Details"}
            </button>

            <a
              className="monitor-btn monitor-btn-ghost"
              href={monitor.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Open Source
            </a>

            <button
              type="button"
              className="monitor-btn monitor-btn-primary"
              onClick={() => {
                void handleRefreshSourceMonitor(monitor);
              }}
              disabled={refreshingMonitorId === monitor.id}
            >
            {refreshingMonitorId === monitor.id ? "Scanning..." : "Refresh"}
            </button>
          </div>

          {isExpanded && (
            <div className="source-monitor-details">
              <strong>Tracked Keywords</strong>

              <div className="alias-grid">
                {monitor.tracked_keywords.map((keyword) => (
                  <span key={keyword} className="alias-pill">
                    {keyword}
                  </span>
                ))}
              </div>

              <strong>Impact Areas</strong>

              <div className="alias-grid">
                {monitor.impact_areas.map((impactArea) => (
                  <span key={impactArea} className="alias-pill">
                    {impactArea}
                  </span>
                ))}
              </div>

              {monitor.excluded_keywords.length > 0 && (
                <>
                  <strong>Excluded Keywords</strong>

                  <div className="alias-grid">
                    {monitor.excluded_keywords.map((keyword) => (
                      <span key={keyword} className="alias-pill">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Last Found</span>
                  <strong>{monitor.last_found_count}</strong>
                </div>

                <div className="journal-row">
                  <span>Last Error</span>
                  <strong>{monitor.last_error ?? "-"}</strong>
                </div>

                <div className="journal-row">
                  <span>Notes</span>
                  <strong>{monitor.notes ?? "-"}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    })}
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

                  <div className="journal-row">
                    <span>Source Link</span>
                    <strong>
                      {selectedCircular.source_url ? (
                        <a
                          href={selectedCircular.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Source
                        </a>
                      ) : (
                        "-"
                      )}
                    </strong>
                  </div>

                  <div className="journal-row">
                    <span>PDF Document</span>
                    <strong>
                      {selectedCircular.document_url ? (
                        <a
                          href={selectedCircular.document_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open PDF
                        </a>
                      ) : (
                        "Not uploaded"
                      )}
                    </strong>
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
                    AI Fill from uploaded PDF and live regulatory website
                    monitoring.
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