"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type DataRoomFolder = {
  name: string;
  description: string;
  expectedDocuments: string[];
};

type DDQItem = {
  question: string;
  category: string;
  status: "Ready" | "Needs Review" | "Missing";
  source: string;
};

type DataRoomAccessLevel =
  | "All LPs"
  | "Restricted LP Access"
  | "Internal Only"
  | "Prospective LPs Only";

type UploadedFilePreview = {
  id: string;
  name: string;
  size: number;
  detectedType: string;
  suggestedDestination: string;
  accessLevel: DataRoomAccessLevel;
  status: "Ready to map" | "Imported";
};

type ImportedDataRoomDocument = UploadedFilePreview & {
  importedAt: string;
  ddqImpact: string;
};
type InvestorEngagementEvent = {
  id: string;
  investorName: string;
  documentName: string;
  action: "Viewed" | "Downloaded" | "Asked Question";
  time: string;
  note: string;
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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectDocumentType(fileName: string) {
  const value = fileName.toLowerCase();

  if (value.includes("ppm") || value.includes("private placement")) {
    return "PPM / Fund Offering Document";
  }

  if (value.includes("ddq")) return "DDQ Response";
  if (value.includes("track") || value.includes("irr")) return "Track Record";
  if (value.includes("capital call")) return "Capital Call Notice";
  if (value.includes("distribution")) return "Distribution Notice";
  if (value.includes("soa")) return "Statement of Account";
  if (value.includes("tax") || value.includes("64c") || value.includes("64d")) {
    return "Tax / Regulatory Document";
  }

  if (value.includes("deck") || value.includes("presentation")) {
    return "Fundraising Deck";
  }

  if (value.includes("compliance") || value.includes("sebi") || value.includes("gift")) {
    return "Compliance Document";
  }

  return "Investor Document";
}

function suggestDestination(documentType: string) {
  if (documentType.includes("DDQ")) return "DDQ & Q&A";
  if (documentType.includes("Track")) return "Track Record & Performance";
  if (documentType.includes("Capital Call")) return "Investor Reporting Samples";
  if (documentType.includes("Distribution")) return "Investor Reporting Samples";
  if (documentType.includes("Statement")) return "Investor Reporting Samples";
  if (documentType.includes("Tax")) return "Tax & Regulatory";
  if (documentType.includes("Compliance")) return "Legal & Compliance";
  if (documentType.includes("Deck")) return "Fund Overview";
  if (documentType.includes("PPM")) return "Legal & Compliance";

  return "General Investor Documents";
}
function getDDQImpact(documentType: string, destination: string) {
  if (destination === "DDQ & Q&A") {
    return "Can support DDQ response drafting";
  }

  if (destination === "Track Record & Performance") {
    return "Can support performance DDQ questions";
  }

  if (destination === "Legal & Compliance") {
    return "Can support legal and compliance diligence";
  }

  if (destination === "Investor Reporting Samples") {
    return "Can support operations and reporting DDQ questions";
  }

  if (destination === "Tax & Regulatory") {
    return "Can support tax and regulatory DDQ questions";
  }

  if (documentType.includes("Investor Document")) {
    return "Available for investor reference";
  }

  return "Ready for data room review";
}
const dataRoomFolders: DataRoomFolder[] = [
  {
    name: "Fund Overview",
    description: "Fund deck, strategy, sponsor profile and fund summary.",
    expectedDocuments: ["Fund Deck", "Strategy Note", "Sponsor Profile"],
  },
  {
    name: "Legal & Compliance",
    description: "PPM, trust deed, contribution documents and regulatory setup.",
    expectedDocuments: ["PPM", "Trust Deed", "SEBI / GIFT Registration"],
  },
  {
    name: "Track Record & Performance",
    description: "IRR, DPI, TVPI, MOIC and historical fund performance.",
    expectedDocuments: ["Track Record", "Performance Summary", "Valuation Policy"],
  },
  {
    name: "Portfolio Summary",
    description: "Portfolio company overview, sector exposure and key updates.",
    expectedDocuments: ["Portfolio Summary", "Company Updates", "Risk Summary"],
  },
  {
    name: "Investor Reporting Samples",
    description: "Sample capital call, distribution notice, SOA and reports.",
    expectedDocuments: ["Capital Call Notice", "Distribution Notice", "SOA"],
  },
  {
    name: "Tax & Regulatory",
    description: "Tax notes, 64C / 64D, compliance filings and circulars.",
    expectedDocuments: ["64C", "64D", "Tax Note"],
  },
  {
    name: "DDQ & Q&A",
    description: "LP due diligence questionnaire and investor questions.",
    expectedDocuments: ["DDQ", "Q&A Tracker", "Operational DD"],
  },
  {
    name: "Subscription Documents",
    description: "Investor onboarding, subscription and KYC documents.",
    expectedDocuments: ["Subscription Pack", "KYC Checklist", "Onboarding Guide"],
  },
];

const ddqItems: DDQItem[] = [
  {
    category: "Fund Strategy",
    question: "What is the fund strategy and target portfolio construction?",
    status: "Ready",
    source: "Fund Overview",
  },
  {
    category: "Performance",
    question: "Provide Gross IRR, Net IRR, DPI, TVPI and MOIC track record.",
    status: "Needs Review",
    source: "Track Record & Performance",
  },
  {
    category: "Operations",
    question: "Describe capital call, distribution and investor reporting process.",
    status: "Ready",
    source: "Investor Reporting Samples",
  },
  {
    category: "Compliance",
    question: "Provide regulatory registration, compliance policy and tax reporting process.",
    status: "Needs Review",
    source: "Legal & Compliance",
  },
  {
    category: "Portfolio",
    question: "Share portfolio company summary and risk monitoring process.",
    status: "Missing",
    source: "Portfolio Summary",
  },
];

function getDDQStatusIcon(status: DDQItem["status"]) {
  if (status === "Ready") return "🟢";
  if (status === "Needs Review") return "🟡";
  return "🔴";
}

export default function DataRoomPage() {
  const [investors, setInvestors] = useState<DataRow[]>([]);
  const [funds, setFunds] = useState<DataRow[]>([]);
  const [documents, setDocuments] = useState<DataRow[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilePreview[]>([]);
    const [importedDocuments, setImportedDocuments] = useState<
    ImportedDataRoomDocument[]
  >([]);
  const [selectedAccessView, setSelectedAccessView] = useState("All LPs");
    const [selectedEngagementInvestor, setSelectedEngagementInvestor] =
    useState("Prospective LP");
  const [engagementEvents, setEngagementEvents] = useState<
    InvestorEngagementEvent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDataRoom() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage(
          "The sample Investor Data Room is temporarily unavailable. Please request a walkthrough."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const [investorsResult, fundsResult, documentsResult] = await Promise.all([
        supabase
          .from("investors")
          .select("*")
          .order("name", { ascending: true }),
        supabase.from("funds").select("*"),
        supabase
          .from("investor_documents")
          .select("*")
          .order("generated_at", { ascending: false }),
      ]);

      const firstError =
        investorsResult.error || fundsResult.error || documentsResult.error;

      if (firstError) {
        setErrorMessage(firstError.message);
        setLoading(false);
        return;
      }

      setInvestors((investorsResult.data ?? []) as DataRow[]);
      setFunds((fundsResult.data ?? []) as DataRow[]);
      setDocuments((documentsResult.data ?? []) as DataRow[]);
      setLoading(false);
    }

    loadDataRoom();
  }, []);

  const dataRoomMetrics = useMemo(() => {
    const storedDocuments = documents.filter((row) =>
      Boolean(getString(row, ["storage_url"], ""))
    );

    const portalAvailableDocuments = documents.filter(
      (row) => getString(row, ["portal_status"], "") === "available"
    );

    const capitalCallDocuments = documents.filter(
      (row) => getString(row, ["document_type"], "") === "Capital Call Notice"
    );

    const distributionDocuments = documents.filter(
      (row) => getString(row, ["document_type"], "") === "Distribution Notice"
    );

    const totalDocumentAmount = documents.reduce(
      (sum, row) => sum + getNumber(row, ["amount"]),
      0
    );

    const readyDDQItems = ddqItems.filter((item) => item.status === "Ready");
    const needsReviewDDQItems = ddqItems.filter(
      (item) => item.status === "Needs Review"
    );
    const missingDDQItems = ddqItems.filter((item) => item.status === "Missing");

    const readinessScore = Math.round(
      ((readyDDQItems.length + needsReviewDDQItems.length * 0.5) /
        ddqItems.length) *
        100
    );

    return {
      investors: investors.length,
      funds: funds.length,
      documents: documents.length,
      storedDocuments: storedDocuments.length,
      portalAvailableDocuments: portalAvailableDocuments.length,
      capitalCallDocuments: capitalCallDocuments.length,
      distributionDocuments: distributionDocuments.length,
      totalDocumentAmount,
      readyDDQItems: readyDDQItems.length,
      needsReviewDDQItems: needsReviewDDQItems.length,
      missingDDQItems: missingDDQItems.length,
            readinessScore,
      importedDocuments: importedDocuments.length,
      totalDataRoomDocuments: documents.length + importedDocuments.length,
    };
    }, [documents, investors.length, funds.length, importedDocuments.length]);

  const recentDocuments = documents.slice(0, 8);

  function handleLegacyFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const previews = Array.from(files).map((file) => {
      const detectedType = detectDocumentType(file.name);

            return {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        detectedType,
        suggestedDestination: suggestDestination(detectedType),
        accessLevel: "Internal Only" as DataRoomAccessLevel,
        status: "Ready to map" as const,
      };
    });

    setUploadedFiles(previews);
  }
    function updateUploadedFileAccessLevel(
    fileId: string,
    accessLevel: DataRoomAccessLevel
  ) {
    setUploadedFiles((current) =>
      current.map((file) =>
        file.id === fileId
          ? {
              ...file,
              accessLevel,
            }
          : file
      )
    );
  }

  function handleApproveImport(fileId: string) {
    const fileToImport = uploadedFiles.find((file) => file.id === fileId);

    if (!fileToImport || fileToImport.status === "Imported") return;

    const importedDocument: ImportedDataRoomDocument = {
      ...fileToImport,
      status: "Imported",
      importedAt: new Date().toISOString(),
      ddqImpact: getDDQImpact(
        fileToImport.detectedType,
        fileToImport.suggestedDestination
      ),
    };

    setImportedDocuments((current) => {
      const alreadyImported = current.some((file) => file.id === fileId);

      if (alreadyImported) return current;

      return [importedDocument, ...current];
    });

        setUploadedFiles((current) =>
      current.filter((file) => file.id !== fileId)
    );
  }

  function handleApproveAllImports() {
    const readyFiles = uploadedFiles.filter(
      (file) => file.status !== "Imported"
    );

    if (readyFiles.length === 0) return;

    const importedBatch: ImportedDataRoomDocument[] = readyFiles.map((file) => ({
      ...file,
      status: "Imported",
      importedAt: new Date().toISOString(),
      ddqImpact: getDDQImpact(file.detectedType, file.suggestedDestination),
    }));

    setImportedDocuments((current) => {
      const existingIds = new Set(current.map((file) => file.id));
      const newFiles = importedBatch.filter((file) => !existingIds.has(file.id));

      return [...newFiles, ...current];
    });

       setUploadedFiles([]);
  }
    function handleRecordEngagement(
    file: ImportedDataRoomDocument,
    action: InvestorEngagementEvent["action"]
  ) {
    const investorName =
      selectedEngagementInvestor ||
      getString(investors[0], ["name"], "Prospective LP");

    const note =
      action === "Viewed"
        ? "Investor opened the document in the data room."
        : action === "Downloaded"
        ? "Investor downloaded the document for offline review."
        : "Investor raised a DDQ follow-up question on this document.";

    const event: InvestorEngagementEvent = {
      id: `${file.id}-${action}-${Date.now()}`,
      investorName,
      documentName: file.name,
      action,
      time: new Date().toISOString(),
      note,
    };

    setEngagementEvents((current) => [event, ...current]);
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Relations</p>
            <h1>Investor Data Room & DDQ Hub</h1>
            <p>
              Secure LP diligence, document sharing, DDQ readiness, legacy data
              upload and investor access tracking in one connected workspace.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Connected data room preview · Reading investors, funds and investor documents
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investor Data Room...</h2>
            <p>
              VENTIQ is reading investors, fund records and investor document
              history.
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
              <h2>Data Room Overview</h2>

              <div className="explain-box">
                VENTIQ allows a fund manager to launch an investor portal or
                investor data room without adopting the full operating system on
                day one. Existing investor documents, historical notices, DDQs,
                fund reports and data room files can be uploaded, classified and
                made available to selected LPs.
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/investor-portal">
                  Open Investor Portal
                </a>

                <a className="monitor-btn monitor-btn-secondary" href="/document-engine">
                  Open Document Engine
                </a>

                <a className="monitor-btn monitor-btn-secondary" href="/activity-engine">
                  View Activity Trail
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{dataRoomMetrics.readinessScore}%</h3>
                <p>DDQ readiness score</p>
              </div>

              <div className="impact-card">
                <h3>{dataRoomMetrics.investors}</h3>
                <p>LP / investor records</p>
              </div>

                            <div className="impact-card">
                <h3>{dataRoomMetrics.totalDataRoomDocuments}</h3>
                <p>Total data room documents</p>
              </div>

              <div className="impact-card">
                <h3>{dataRoomMetrics.storedDocuments}</h3>
                <p>Stored PDFs</p>
              </div>
            </div>

                        <div className="impact-grid">
              <div className="impact-card">
                <h3>{dataRoomMetrics.importedDocuments}</h3>
                <p>Imported legacy files</p>
              </div>

              <div className="impact-card">
                <h3>{dataRoomMetrics.capitalCallDocuments}</h3>
                <p>Capital call notices</p>
              </div>

              <div className="impact-card">
                <h3>{dataRoomMetrics.distributionDocuments}</h3>
                <p>Distribution notices</p>
              </div>

              <div className="impact-card">
                <h3>{formatCurrencyCr(dataRoomMetrics.totalDocumentAmount)}</h3>
                <p>Document-linked amount</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Legacy Data Upload & Migration Preview</h2>

              <div className="explain-box">
                This is the entry point for firms that only want Investor Portal
                or Data Room first. They can upload historical investor masters,
                capital call notices, distribution notices, SOAs, tax documents,
                DDQs and fund reports. VENTIQ will classify the files and suggest
                where each document should live.
              </div>

              <div className="form-card">
                <label>Upload legacy files for classification preview</label>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    handleLegacyFilesSelected(event.target.files)
                  }
                />

                <div className="logic-note">
                  This preview classifies files locally for now. In the next
                  phase, approved files will be stored, mapped to investors and
                  published to Investor Portal or Data Room.
                </div>
              </div>

                            {uploadedFiles.length === 0 && importedDocuments.length === 0 && (
                <div className="explain-box">
                  No files selected yet. Upload sample PDFs, Excels or DDQ files
                  to preview how VENTIQ would classify legacy data.
                </div>
              )}

              {uploadedFiles.length === 0 && importedDocuments.length > 0 && (
                <div className="explain-box">
                  All selected files have been imported. Upload more files to
                  classify and add additional records to the data room.
                </div>
              )}

                           {uploadedFiles.length > 0 && (
                <>
                  <div className="action-row">
                    <button type="button" onClick={handleApproveAllImports}>
                      Approve All Imports
                    </button>
                  </div>

                  <div className="review-table-wrap">
                    <table className="review-table">
                      <thead>
                        <tr>
                          <th>File</th>
                          <th>Size</th>
                          <th>Detected Type</th>
                          <th>Suggested Destination</th>
                          <th>Access Level</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {uploadedFiles.map((file) => (
                          <tr key={file.id}>
                            <td>
                              <strong>{file.name}</strong>
                            </td>
                            <td>{formatFileSize(file.size)}</td>
                            <td>{file.detectedType}</td>
                            <td>{file.suggestedDestination}</td>
                            <td>
                              <select
                                value={file.accessLevel}
                                disabled={file.status === "Imported"}
                                onChange={(event) =>
                                  updateUploadedFileAccessLevel(
                                    file.id,
                                    event.target.value as DataRoomAccessLevel
                                  )
                                }
                              >
                                <option>All LPs</option>
                                <option>Restricted LP Access</option>
                                <option>Internal Only</option>
                                <option>Prospective LPs Only</option>
                              </select>
                            </td>
                            <td>
                              <span className="small-pill">{file.status}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                disabled={file.status === "Imported"}
                                onClick={() => handleApproveImport(file.id)}
                              >
                                {file.status === "Imported"
                                  ? "Imported"
                                  : "Approve Import"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importedDocuments.length > 0 && (
                <>
                  <div className="logic-note">
                    {importedDocuments.length} legacy file
                    {importedDocuments.length === 1 ? "" : "s"} imported into
                    the Investor Data Room workflow.
                  </div>
                                    <div className="form-card">
                    <label>Simulate investor engagement as</label>
                    <select
                      value={selectedEngagementInvestor}
                      onChange={(event) =>
                        setSelectedEngagementInvestor(event.target.value)
                      }
                    >
                      <option>Prospective LP</option>
                      {investors.map((investor) => (
                        <option
                          key={getString(investor, ["id"], getString(investor, ["name"]))}
                          value={getString(investor, ["name"])}
                        >
                          {getString(investor, ["name"])}
                        </option>
                      ))}
                    </select>

                    <div className="logic-note">
                      Use this to preview how VENTIQ will track LP views,
                      downloads and DDQ questions once the data room is shared.
                    </div>
                  </div>

                                    <div className="queue-grid">
                    {importedDocuments.map((file) => (
                      <div className="queue-item" key={`imported-${file.id}`}>
                        <strong>{file.name}</strong>
                        <br />
                        <span>{file.detectedType}</span>
                        <br />
                        <br />
                        Folder: {file.suggestedDestination}
                        <br />
                        Access: {file.accessLevel}
                        <br />
                        DDQ Impact: {file.ddqImpact}
                        <br />
                        Imported: {formatDate(file.importedAt)}
                                                <br />
                        <br />
                        <div className="action-row">
                          <button
                            type="button"
                            onClick={() => handleRecordEngagement(file, "Viewed")}
                          >
                            Record View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleRecordEngagement(file, "Downloaded")
                            }
                          >
                            Record Download
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleRecordEngagement(file, "Asked Question")
                            }
                          >
                            Add DDQ Question
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="audit-timeline">
                    {importedDocuments.slice(0, 6).map((file) => (
                      <div className="audit-item" key={`activity-${file.id}`}>
                        <strong>{formatDate(file.importedAt)}</strong> 🟢 Legacy
                        file imported
                        <br />
                        <span>
                          {file.name} classified as {file.detectedType}, mapped
                          to {file.suggestedDestination} with {file.accessLevel}{" "}
access.
                        </span>
                      </div>
                    ))}
                  </div>
                                    {engagementEvents.length > 0 && (
                    <>
                      <div className="logic-note">
                        Investor engagement trail
                      </div>

                      <div className="audit-timeline">
                        {engagementEvents.slice(0, 10).map((event) => (
                          <div className="audit-item" key={event.id}>
                            <strong>{formatDate(event.time)}</strong>{" "}
                            {event.action === "Viewed"
                              ? "👁️"
                              : event.action === "Downloaded"
                              ? "⬇️"
                              : "❓"}{" "}
                            {event.investorName} {event.action.toLowerCase()}
                            <br />
                            <span>{event.documentName}</span>
                            <br />
                            <span>{event.note}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="preview-card">
              <h2>Data Room Folders</h2>

              <p className="eyebrow">
                Suggested LP diligence room structure
              </p>

              <div className="queue-grid">
                {dataRoomFolders.map((folder) => (
                  <div className="queue-item" key={folder.name}>
                    <strong>{folder.name}</strong>
                    <br />
                    {folder.description}
                    <br />
                    <br />
                    Expected: {folder.expectedDocuments.join(", ")}
                  </div>
                ))}
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>DDQ Readiness Tracker</h2>

                <div className="audit-timeline">
                  {ddqItems.map((item) => (
                    <div className="audit-item" key={item.question}>
                      <strong>
                        {getDDQStatusIcon(item.status)} {item.category}
                      </strong>{" "}
                      — {item.status}
                      <br />
                      <span>{item.question}</span>
                      <br />
                      <span>Source: {item.source}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ai-side-panel">
                <h2>Ask Data Room AI</h2>

                <div className="chat-message">
                  Ask: “Which documents are missing for LP diligence?”
                </div>

                <div className="chat-message">
                  Ask: “Prepare DDQ response for fund operations.”
                </div>

                <div className="chat-message">
                  Ask: “Which investors accessed the data room?”
                </div>

                <div className="chat-message">
                  Ask: “Classify these uploaded historical documents.”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>LP Access List</h2>

              <div className="form-card">
                <label>Access View</label>
                <select
                  value={selectedAccessView}
                  onChange={(event) => setSelectedAccessView(event.target.value)}
                >
                  <option>All LPs</option>
                  <option>Prospective LPs</option>
                  <option>Existing Investors</option>
                  <option>Restricted Access</option>
                </select>

                <div className="logic-note">
                  Later, VENTIQ will support investor-specific permissions,
                  download restrictions, expiry dates and watermarking.
                </div>
              </div>

              {investors.length === 0 && (
                <div className="explain-box">
                  No investor records found yet.
                </div>
              )}

              {investors.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Type</th>
                        <th>Email</th>
                        <th>Country</th>
                        <th>KYC</th>
                        <th>Access</th>
                      </tr>
                    </thead>

                    <tbody>
                      {investors.slice(0, 10).map((investor) => (
                        <tr key={getString(investor, ["id"], getString(investor, ["name"]))}>
                          <td>
                            <strong>{getString(investor, ["name"])}</strong>
                          </td>
                          <td>{getString(investor, ["investor_type"])}</td>
                          <td>{getString(investor, ["email"])}</td>
                          <td>{getString(investor, ["country"])}</td>
                          <td>{getString(investor, ["kyc_status"])}</td>
                          <td>
                            <span className="small-pill">Data room ready</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Recent Investor Documents</h2>

              {recentDocuments.length === 0 && (
                <div className="explain-box">
                  No investor documents found yet. Generate documents from
                  Document Engine or upload historical records through Migration
                  Preview.
                </div>
              )}

              {recentDocuments.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Type</th>
                        <th>Investor</th>
                        <th>Fund</th>
                        <th>Amount</th>
                        <th>Portal</th>
                        <th>Stored</th>
                        <th>Generated</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentDocuments.map((documentRecord) => (
                        <tr
                          key={getString(
                            documentRecord,
                            ["id"],
                            getString(documentRecord, ["document_name"])
                          )}
                        >
                          <td>
                            <strong>
                              {getString(documentRecord, ["document_name"])}
                            </strong>
                          </td>
                          <td>{getString(documentRecord, ["document_type"])}</td>
                          <td>{getString(documentRecord, ["investor_name"])}</td>
                          <td>{getString(documentRecord, ["fund_name"])}</td>
                          <td>
                            {formatCurrencyCr(
                              getNumber(documentRecord, ["amount"])
                            )}
                          </td>
                          <td>{getString(documentRecord, ["portal_status"])}</td>
                          <td>
                            {getString(documentRecord, ["storage_url"], "")
                              ? "Stored"
                              : "Not stored"}
                          </td>
                          <td>{formatDate(documentRecord["generated_at"])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

                                      <div className="preview-card">
              <h2>Investor Engagement Tracker</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  🟢 Data Room Opened
                  <br />
                  Investor access workspace ready
                </div>

                <div className="queue-item">
                  🔵 Documents Reviewed
                  <br />
                  {dataRoomMetrics.portalAvailableDocuments} portal-ready records
                </div>

                <div className="queue-item">
                  🟡 DDQ Follow-up
                  <br />
                  {dataRoomMetrics.needsReviewDDQItems} sections need review
                </div>

                <div className="queue-item">
                  🔴 Missing Items
                  <br />
                  {dataRoomMetrics.missingDDQItems} DDQ item missing
                </div>
              </div>

              {engagementEvents.length === 0 && (
                <div className="explain-box">
                  No investor engagement recorded yet. Import a document, then
                  record a view, download or DDQ question to create the first
                  LP engagement trail.
                </div>
              )}

              {engagementEvents.length > 0 && (
                <div className="audit-timeline">
                  {engagementEvents.slice(0, 10).map((event) => (
                    <div className="audit-item" key={event.id}>
                      <strong>{formatDate(event.time)}</strong>{" "}
                      {event.action === "Viewed"
                        ? "👁️"
                        : event.action === "Downloaded"
                        ? "⬇️"
                        : "❓"}{" "}
                      {event.investorName} {event.action.toLowerCase()}
                      <br />
                      <span>{event.documentName}</span>
                      <br />
                      <span>{event.note}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="explain-box">
                In the next phase, this section will track investor views,
                downloads, questions asked, document access expiry and DDQ
                completion status.
              </div>
            </div>

            <div className="preview-card">
              <h2>AI Readiness Review</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>DDQ readiness score</span>
                  <strong>{dataRoomMetrics.readinessScore}%</strong>
                </div>

                <div className="journal-row">
                  <span>Ready DDQ sections</span>
                  <strong>{dataRoomMetrics.readyDDQItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Needs review</span>
                  <strong>{dataRoomMetrics.needsReviewDDQItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Missing sections</span>
                  <strong>{dataRoomMetrics.missingDDQItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Recommended action</span>
                  <strong>
                    {dataRoomMetrics.missingDDQItems > 0
                      ? "Upload missing portfolio and DDQ documents"
                      : "Review DDQ answers before sharing"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Modular Adoption Path</h2>

              <div className="queue-grid">
                <div className="queue-item">
                  1. Upload historical data
                  <br />
                  Investor master, notices, reports and DDQs
                </div>

                <div className="queue-item">
                  2. VENTIQ classifies documents
                  <br />
                  Fund, investor, type, period and destination
                </div>

                <div className="queue-item">
                  3. Launch Investor Portal
                  <br />
                  LPs get access without full OS adoption
                </div>

                <div className="queue-item">
                  4. Open Data Room
                  <br />
                  Prospective LPs review documents and ask questions
                </div>

                <div className="queue-item">
                  5. Track investor activity
                  <br />
                  Views, downloads, Q&A and diligence progress
                </div>

                <div className="queue-item">
                  6. Expand to full VENTIQ OS
                  <br />
                  Capital calls, documents, workflows and dashboards
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}