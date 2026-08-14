"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { useActiveFund } from "../../../lib/useActiveFund";

type GovernedFundOption = {
  fund_name: string;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
};

type InvestorRecord = {
  id: string;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  tax_id: string | null;
};

type EvidenceManifest = {
  version: string;
  totalPages: number;
  parsedPages: number;
  totalCharacters: number;
  extractionMode:
    | "embedded_text"
    | "mixed_text_visual_review"
    | "ocr_required"
    | "ocr_completed"
    | "page_limit_review"
    | "pending";
  ocrRequiredPages: number[];
  pageLimitReached: boolean;
  pageEvidence: Array<{
    pageNumber: number;
    characterCount: number;
    textAvailable: boolean;
  }>;
  quarter: string;
  financialYear: string;
};

type OcrManifest = {
  version: string;
  provider: string;
  model: string;
  completedAt: string;
  sidecarBucket: string;
  sidecarPath: string;
  totalCharacters: number;
  pages: Array<{
    pageNumber: number;
    characterCount: number;
    legibility: "clear" | "partial" | "unreadable";
    notes: string[];
  }>;
};

type PdfDocument = {
  id: string;
  batchId: string;
  fileName: string;
  fileSize: number;
  documentType: string;
  investorId: string;
  investorCode: string;
  investorName: string;
  email: string;
  fundName: string;
  periodLabel: string;
  quarter: string;
  financialYear: string;
  confidenceScore: number;
  status: "Ready" | "Review" | "Unmatched" | "Failed";
  storageBucket: string;
  storagePath: string;
  signals: string[];
  textPreview: string;
  ocr: OcrManifest | null;
  evidence: EvidenceManifest;
  extractionPending: boolean;
  published: boolean;
  updatedAt: string;
};

type PdfBatch = {
  id: string;
  batch_name?: string | null;
  total_files?: number | null;
  ready_files?: number | null;
  review_files?: number | null;
  unmatched_files?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceResult = {
  error?: string;
  fundName?: string;
  access?: GovernedFundOption;
  batch?: PdfBatch | null;
  investors?: InvestorRecord[];
  documents?: PdfDocument[];
  summary?: {
    total: number;
    ready: number;
    review: number;
    unmatched: number;
    extractionPending: number;
    ocrRequired: number;
    ocrCompleted: number;
    published: number;
  };
};

type ReviewDraft = {
  investorId: string;
  documentType: string;
  periodLabel: string;
  status: "Ready" | "Review" | "Unmatched";
};

const DOCUMENT_TYPES = [
  "SOA / Account Statement",
  "Capital Call Notice",
  "Distribution Notice",
  "IRR Statement",
  "Tax Document",
  "Portfolio Report",
  "Fund Report",
  "Other / Review",
];

const REVIEW_STATUSES: ReviewDraft["status"][] = [
  "Ready",
  "Review",
  "Unmatched",
];

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

function extractionLabel(document: PdfDocument) {
  if (document.extractionPending) return "Pending server extraction";

  if (document.evidence.extractionMode === "embedded_text") {
    return "Embedded text";
  }

  if (document.evidence.extractionMode === "mixed_text_visual_review") {
    return "Mixed / visual review";
  }

  if (document.evidence.extractionMode === "ocr_completed") {
    return "OCR completed · review required";
  }

  if (document.evidence.extractionMode === "page_limit_review") {
    return "Page-limit review";
  }

  return "OCR required";
}

function statusTone(status: PdfDocument["status"]) {
  if (status === "Ready") return "Ready";
  if (status === "Review") return "Review";
  return status;
}

function documentTypeMatches(actual: string, expected: string) {
  if (actual === expected) return true;
  if (expected.includes("SOA") && actual.includes("SOA")) return true;
  if (expected.includes("Capital Call") && actual.includes("Capital Call")) return true;
  if (expected.includes("Distribution") && actual.includes("Distribution")) return true;
  if (expected.includes("IRR") && actual.includes("IRR")) return true;
  if (expected.includes("Tax") && actual.includes("Tax")) return true;
  if (expected.includes("Portfolio") && actual.includes("Portfolio")) return true;
  if (expected.includes("Fund") && actual.includes("Fund")) return true;
  return false;
}

export default function PdfIntelligencePage() {
  const { session } = useVentiqAuth();
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund("");

  const accessToken = session?.access_token ?? "";

  const [authorisedFunds, setAuthorisedFunds] = useState<GovernedFundOption[]>([]);
  const [fundAccessReady, setFundAccessReady] = useState(false);
  const [fundAccessMessage, setFundAccessMessage] = useState("");

  const [batch, setBatch] = useState<PdfBatch | null>(null);
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingReviewId, setSavingReviewId] = useState("");

  const [deficiencyPeriod, setDeficiencyPeriod] = useState("");
  const [deficiencyType, setDeficiencyType] = useState("SOA / Account Statement");

  const activeFundAccess = useMemo(() => {
    const normalized = activeFundName.trim().toLowerCase();
    return (
      authorisedFunds.find(
        (fund) => fund.fund_name.trim().toLowerCase() === normalized
      ) ?? null
    );
  }, [activeFundName, authorisedFunds]);

  const canManage =
    Boolean(activeFundAccess?.can_edit) &&
    (activeFundAccess?.role === "fund_admin" ||
      activeFundAccess?.role === "maker");

  const canApprove = Boolean(activeFundAccess?.can_approve);

  const summary = useMemo(() => {
    return {
      total: documents.length,
      ready: documents.filter((document) => document.status === "Ready").length,
      review: documents.filter((document) => document.status === "Review").length,
      unmatched: documents.filter(
        (document) =>
          document.status === "Unmatched" || document.status === "Failed"
      ).length,
      extractionPending: documents.filter((document) => document.extractionPending)
        .length,
      ocrRequired: documents.filter(
        (document) => document.evidence.extractionMode === "ocr_required"
      ).length,
      ocrCompleted: documents.filter(
        (document) => document.evidence.extractionMode === "ocr_completed"
      ).length,
      published: documents.filter((document) => document.published).length,
    };
  }, [documents]);

  const reviewQueue = useMemo(
    () =>
      documents.filter(
        (document) =>
          !document.published &&
          (document.status !== "Ready" ||
            document.extractionPending ||
            !document.investorId ||
            document.documentType === "Other / Review" ||
            document.periodLabel === "Period not detected")
      ),
    [documents]
  );

  const publishableDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.status === "Ready" &&
          document.investorId &&
          document.storagePath &&
          !document.published
      ),
    [documents]
  );

  const deficiencyRows = useMemo(() => {
    const expectedPeriod = deficiencyPeriod.trim().toLowerCase();

    return investors.map((investor) => {
      const matching = documents.filter((document) => {
        if (document.investorId !== investor.id) return false;
        if (!documentTypeMatches(document.documentType, deficiencyType)) return false;
        if (!expectedPeriod) return true;

        const periodText = `${document.periodLabel} ${document.quarter} ${document.financialYear}`
          .toLowerCase()
          .trim();

        return periodText.includes(expectedPeriod);
      });

      let status = "Missing";
      if (matching.length > 1) status = "Duplicate";
      else if (matching.length === 1 && matching[0].status === "Ready") {
        status = "Available";
      } else if (matching.length === 1) {
        status = "Review";
      }

      return {
        investor,
        status,
        matchedCount: matching.length,
      };
    });
  }, [deficiencyPeriod, deficiencyType, documents, investors]);

  const deficiencyMetrics = useMemo(() => {
    return {
      expected: deficiencyRows.length,
      available: deficiencyRows.filter((row) => row.status === "Available").length,
      missing: deficiencyRows.filter((row) => row.status === "Missing").length,
      exceptions: deficiencyRows.filter(
        (row) => row.status === "Review" || row.status === "Duplicate"
      ).length,
    };
  }, [deficiencyRows]);

  async function apiRequest(
    body: Record<string, unknown>,
    options?: { quiet?: boolean }
  ) {
    if (!accessToken) {
      throw new Error("Sign in before using PDF Intelligence.");
    }

    const response = await fetch("/api/migration/pdf-intelligence", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "PDF Intelligence action failed.");
    }

    if (!options?.quiet && result.message) {
      setMessage(result.message);
    }

    return result;
  }

  async function loadWorkspace(fundName = activeFundName) {
    if (!accessToken || !fundName.trim()) return;

    setLoadingWorkspace(true);

    try {
      const response = await fetch(
        `/api/migration/pdf-intelligence?fundName=${encodeURIComponent(fundName)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = (await response.json()) as WorkspaceResult;

      if (!response.ok) {
        throw new Error(result.error || "Unable to load PDF Intelligence.");
      }

      setBatch(result.batch ?? null);
      setInvestors(result.investors ?? []);
      setDocuments(result.documents ?? []);
      setReviewDrafts({});
    } catch (error) {
      setBatch(null);
      setInvestors([]);
      setDocuments([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load PDF Intelligence workspace."
      );
    } finally {
      setLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    if (!fundContextReady) return;

    if (!accessToken) {
      setAuthorisedFunds([]);
      setFundAccessMessage("Sign in to load governed fund access.");
      setFundAccessReady(true);
      return;
    }

    let cancelled = false;

    async function loadGovernedFunds() {
      setFundAccessReady(false);
      setFundAccessMessage("");

      try {
        const response = await fetch("/api/fund-context", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load governed VENTIQ fund context."
          );
        }

        if (cancelled) return;

        const funds = (result.funds ?? []) as GovernedFundOption[];
        setAuthorisedFunds(funds);

        if (funds.length === 0) {
          setFundAccessMessage(
            "No active fund access is available for this VENTIQ account."
          );
          setFundAccessReady(true);
          return;
        }

        const normalizedActive = activeFundName.trim().toLowerCase();
        const allowed = funds.some(
          (fund) => fund.fund_name.trim().toLowerCase() === normalizedActive
        );

        if (!allowed) {
          const nextFund = funds[0].fund_name;
          setActiveFundName(nextFund);
          setFundAccessMessage(
            `PDF Intelligence moved to your first authorised fund: ${nextFund}.`
          );
        }

        setFundAccessReady(true);
      } catch (error) {
        if (cancelled) return;

        setAuthorisedFunds([]);
        setFundAccessMessage(
          error instanceof Error
            ? error.message
            : "Unable to load governed fund access."
        );
        setFundAccessReady(true);
      }
    }

    void loadGovernedFunds();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    activeFundName,
    fundContextReady,
    setActiveFundName,
  ]);

  useEffect(() => {
    if (
      !fundContextReady ||
      !fundAccessReady ||
      !activeFundAccess ||
      !accessToken ||
      !activeFundName.trim()
    ) {
      return;
    }

    void loadWorkspace(activeFundName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    activeFundAccess,
    activeFundName,
    fundAccessReady,
    fundContextReady,
  ]);

  function getReviewDraft(document: PdfDocument): ReviewDraft {
    return (
      reviewDrafts[document.id] ?? {
        investorId: document.investorId,
        documentType: document.documentType,
        periodLabel:
          document.periodLabel === "Period not detected"
            ? ""
            : document.periodLabel,
        status:
          document.status === "Ready" || document.status === "Review"
            ? document.status
            : "Review",
      }
    );
  }

  function updateReviewDraft(
    documentId: string,
    partial: Partial<ReviewDraft>
  ) {
    setReviewDrafts((current) => {
      const existing = current[documentId] ?? {
        investorId: "",
        documentType: "Other / Review",
        periodLabel: "",
        status: "Review" as const,
      };

      return {
        ...current,
        [documentId]: {
          ...existing,
          ...partial,
        },
      };
    });
  }

  async function reprocessLatestBatch() {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can run PDF extraction."
      );
      return;
    }

    const confirmed = window.confirm(
      `Run server-side PDF extraction for the latest PDF batch of ${activeFundName}?\n\nThis reclassifies the existing PDF Intelligence records but does not write financial values into Canonical Fund Memory.`
    );

    if (!confirmed) return;

    setProcessing(true);

    try {
      const targetIds =
        summary.extractionPending > 0
          ? documents
              .filter((document) => document.extractionPending)
              .map((document) => document.id)
          : documents
              .filter(
                (document) =>
                  document.evidence.extractionMode !== "ocr_completed"
              )
              .map((document) => document.id);

      if (targetIds.length === 0) {
        setMessage("No PDFs are available in the latest batch.");
        return;
      }

      const chunkSize = 4;
      let processedCount = 0;
      let failedCount = 0;
      const failureMessages: string[] = [];

      for (let index = 0; index < targetIds.length; index += chunkSize) {
        const documentIds = targetIds.slice(index, index + chunkSize);

        setMessage(
          `Processing PDF evidence ${Math.min(
            index + documentIds.length,
            targetIds.length
          )}/${targetIds.length}...`
        );

        const result = await apiRequest(
          {
            action: "reprocess_latest",
            fundName: activeFundName,
            documentIds,
          },
          { quiet: true }
        );

        processedCount += Number(result.processedCount || 0);
        failedCount += Number(result.failedCount || 0);

        if (Array.isArray(result.failures)) {
          for (const failure of result.failures) {
            const fileName =
              typeof failure?.fileName === "string"
                ? failure.fileName
                : "PDF";
            const failureText =
              typeof failure?.error === "string"
                ? failure.error
                : "Unknown extraction error";
            failureMessages.push(`${fileName}: ${failureText}`);
          }
        }
      }

      await loadWorkspace(activeFundName);

      if (failureMessages.length > 0) {
        setMessage(
          `A7.7-2 server extraction finished. ${processedCount} PDF(s) processed; ${failedCount} failed. ${failureMessages
            .slice(0, 2)
            .join(" | ")}`
        );
      } else {
        setMessage(
          `A7.7-2 server extraction finished. ${processedCount} PDF(s) processed; ${failedCount} failed.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to process PDF Intelligence batch."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runOcrForScannedPages() {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can run OCR."
      );
      return;
    }

    const targetIds = documents
      .filter(
        (document) =>
          !document.published &&
          document.evidence.extractionMode === "ocr_required" &&
          document.evidence.ocrRequiredPages.length > 0
      )
      .map((document) => document.id);

    if (targetIds.length === 0) {
      setMessage("No OCR-required PDF pages are available in the latest batch.");
      return;
    }

    const confirmed = window.confirm(
      `Run OCR for ${targetIds.length} scanned PDF(s) in ${activeFundName}?\n\nOnly pages already flagged as OCR-required are rendered and sent to the configured OCR provider. OCR results remain in Review and are not written into Canonical Fund Memory.`
    );

    if (!confirmed) return;

    setOcrProcessing(true);

    try {
      let processedCount = 0;
      let failedCount = 0;
      const failureMessages: string[] = [];

      // One document at a time keeps image payloads, cost and error scope bounded.
      for (let index = 0; index < targetIds.length; index += 1) {
        const documentId = targetIds[index];

        setMessage(
          `Running governed OCR ${index + 1}/${targetIds.length}...`
        );

        const result = await apiRequest(
          {
            action: "run_ocr",
            fundName: activeFundName,
            documentIds: [documentId],
          },
          { quiet: true }
        );

        processedCount += Number(result.processedCount || 0);
        failedCount += Number(result.failedCount || 0);

        if (Array.isArray(result.failures)) {
          for (const failure of result.failures) {
            const fileName =
              typeof failure?.fileName === "string"
                ? failure.fileName
                : "PDF";
            const failureText =
              typeof failure?.error === "string"
                ? failure.error
                : "Unknown OCR error";
            failureMessages.push(`${fileName}: ${failureText}`);
          }
        }
      }

      await loadWorkspace(activeFundName);

      if (failureMessages.length > 0) {
        setMessage(
          `A7.7-2K OCR finished. ${processedCount} PDF(s) processed; ${failedCount} failed. ${failureMessages
            .slice(0, 2)
            .join(" | ")}`
        );
      } else {
        setMessage(
          `A7.7-2K OCR finished. ${processedCount} PDF(s) processed. Results remain in Review until human confirmation.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to run governed PDF OCR."
      );
    } finally {
      setOcrProcessing(false);
    }
  }

  async function saveReview(document: PdfDocument) {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can correct PDF classifications."
      );
      return;
    }

    const draft = getReviewDraft(document);

    if (!draft.investorId || !draft.documentType || !draft.periodLabel.trim()) {
      setMessage(
        "Select an investor, document type and reporting period before saving."
      );
      return;
    }

    setSavingReviewId(document.id);

    try {
      await apiRequest({
        action: "review",
        fundName: activeFundName,
        documentId: document.id,
        investorId: draft.investorId,
        documentType: draft.documentType,
        periodLabel: draft.periodLabel,
        status: draft.status,
      });

      await loadWorkspace(activeFundName);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save PDF review."
      );
    } finally {
      setSavingReviewId("");
    }
  }

  async function publishReady() {
    if (!canApprove) {
      setMessage(
        "Checker / approval access is required to publish governed PDFs into Investor Portal."
      );
      return;
    }

    if (publishableDocuments.length === 0) {
      setMessage("No unpublished Ready PDFs are available.");
      return;
    }

    const confirmed = window.confirm(
      `Publish ${publishableDocuments.length} Ready PDF(s) to Investor Portal?\n\nFiles remain private in Supabase Storage. No permanent signed URL is stored.`
    );

    if (!confirmed) return;

    setPublishing(true);

    try {
      await apiRequest({
        action: "publish",
        fundName: activeFundName,
        documentIds: publishableDocuments.map((document) => document.id),
      });
      await loadWorkspace(activeFundName);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish Ready PDFs."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ PDF Intelligence · A7.7-2K</p>
            <h1>Historical PDF Evidence Processing</h1>
            <p>
              Process the active fund&apos;s migration PDFs on the server, preserve
              page-level extraction evidence, classify investor documents and route
              uncertain or scanned records into controlled review, with page-specific OCR for scans.
            </p>
          </div>

          <Link className="back-link" href="/migration/data-intake">
            Back to Data Intake
          </Link>
        </div>

        <div className="sample-data-ribbon">
          Governed active fund · Private PDF storage · Server-side extraction ·
          Page-specific OCR · Investor / quarter / nature classification
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Governed Fund Context</p>
              <h2>{activeFundName || "Select a fund"}</h2>
            </div>

            <span className="status-pill">
              {activeFundAccess?.role || "Loading access"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(240px, 1fr) minmax(240px, 2fr)",
              gap: 16,
              alignItems: "end",
            }}
          >
            <label>
              Active fund
              <select
                disabled={!fundAccessReady || authorisedFunds.length === 0}
                onChange={(event) => setActiveFundName(event.target.value)}
                value={activeFundName}
              >
                {authorisedFunds.map((fund) => (
                  <option key={fund.fund_name} value={fund.fund_name}>
                    {fund.fund_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="explain-box" style={{ margin: 0 }}>
              PDF Intelligence now reads only the selected governed fund. A Fund
              Admin / Maker can process and correct records. Investor Portal
              publishing requires approval access.
            </div>
          </div>

          {fundAccessMessage && (
            <div className="logic-note">{fundAccessMessage}</div>
          )}
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{summary.total}</h3>
            <p>PDFs in latest batch</p>
          </div>
          <div className="impact-card">
            <h3>{summary.ready}</h3>
            <p>Ready</p>
          </div>
          <div className="impact-card">
            <h3>{summary.review + summary.unmatched}</h3>
            <p>Review / unmatched</p>
          </div>
          <div className="impact-card">
            <h3>{summary.extractionPending}</h3>
            <p>Pending extraction</p>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{summary.ocrRequired}</h3>
            <p>OCR required</p>
          </div>
          <div className="impact-card">
            <h3>{summary.ocrCompleted}</h3>
            <p>OCR completed / review</p>
          </div>
          <div className="impact-card">
            <h3>{summary.published}</h3>
            <p>Portal published</p>
          </div>
          <div className="impact-card">
            <h3>{investors.length}</h3>
            <p>Fund investors available</p>
          </div>
          <div className="impact-card">
            <h3>{batch?.total_files ?? 0}</h3>
            <p>Batch file count</p>
          </div>
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">A7.7-2 Processing Foundation</p>
              <h2>Turn uploaded PDFs into governed evidence</h2>
            </div>

            <span className="status-pill">
              {batch?.batch_name || "No PDF batch"}
            </span>
          </div>

          <div className="explain-box">
            Upload historical PDFs through Data Intake first, then process the
            migration batch. This workspace downloads those private files on the
            server, reads the complete document up to the controlled page safety
            limit, records page evidence, detects scanned / low-text documents,
            and can render only OCR-required pages for governed OCR. OCR evidence
            is retained privately and stays in Review. Financial values are not
            written into Canonical Fund Memory in A7.7-2K.
          </div>

          <div className="action-row">
            <Link
              className="monitor-btn monitor-btn-secondary"
              href="/migration/data-intake"
            >
              Open Data Intake
            </Link>

            <button
              className="monitor-btn monitor-btn-primary"
              disabled={
                !batch ||
                !canManage ||
                processing ||
                ocrProcessing ||
                loadingWorkspace
              }
              onClick={reprocessLatestBatch}
              type="button"
            >
              {processing
                ? "Processing PDF Evidence..."
                : summary.extractionPending > 0
                  ? "Process Latest PDF Batch"
                  : "Reprocess Latest PDF Batch"}
            </button>

            <button
              className="monitor-btn monitor-btn-primary"
              disabled={
                !batch ||
                !canManage ||
                processing ||
                ocrProcessing ||
                loadingWorkspace ||
                summary.ocrRequired === 0
              }
              onClick={runOcrForScannedPages}
              type="button"
            >
              {ocrProcessing
                ? "Running OCR..."
                : `Run OCR (${summary.ocrRequired})`}
            </button>

            <Link
              className="monitor-btn monitor-btn-secondary"
              href="/migration/activation"
            >
              Open Activation
            </Link>
          </div>

          {loadingWorkspace && (
            <div className="logic-note">Loading governed PDF Intelligence...</div>
          )}

          {message && <div className="logic-note">{message}</div>}

          {!loadingWorkspace && !batch && (
            <div className="logic-note">
              No PDF Intelligence batch exists for {activeFundName}. Stage PDFs in
              Data Intake and run Process Migration Data first.
            </div>
          )}
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Investor · Quarter · Nature</p>
              <h2>Classified historical PDF register</h2>
            </div>

            <span className="status-pill">{documents.length} document(s)</span>
          </div>

          <div className="explain-box">
            This register is the document-side foundation for Investor Portal and
            Data Room organisation. Investor identity, reporting period and
            document nature stay attached to the private source PDF.
          </div>

          {documents.length === 0 ? (
            <div className="logic-note">
              No PDF records available in the latest batch.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Nature</th>
                    <th>Investor</th>
                    <th>Quarter / FY</th>
                    <th>Pages</th>
                    <th>Extraction</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <strong>{document.fileName}</strong>
                        <br />
                        <small>{formatFileSize(document.fileSize)}</small>
                      </td>
                      <td>{document.documentType}</td>
                      <td>
                        {document.investorName}
                        <br />
                        <small>{document.investorCode}</small>
                      </td>
                      <td>
                        {document.quarter || "-"}
                        <br />
                        <small>
                          {document.financialYear || document.periodLabel}
                        </small>
                      </td>
                      <td>
                        {document.evidence.parsedPages || "-"}
                        {document.evidence.totalPages > 0 &&
                          document.evidence.totalPages !==
                            document.evidence.parsedPages && (
                            <>
                              <br />
                              <small>
                                of {document.evidence.totalPages}
                              </small>
                            </>
                          )}
                      </td>
                      <td>
                        {extractionLabel(document)}
                        {document.evidence.ocrRequiredPages.length > 0 && (
                          <>
                            <br />
                            <small>
                              Page(s):{" "}
                              {document.evidence.ocrRequiredPages
                                .slice(0, 8)
                                .join(", ")}
                              {document.evidence.ocrRequiredPages.length > 8
                                ? "..."
                                : ""}
                            </small>
                          </>
                        )}
                        {document.ocr && (
                          <>
                            <br />
                            <small>
                              OCR page(s):{" "}
                              {document.ocr.pages
                                .map((page) => page.pageNumber)
                                .join(", ")}
                              {" · "}
                              {document.ocr.model}
                            </small>
                          </>
                        )}
                      </td>
                      <td>{document.confidenceScore}%</td>
                      <td>{statusTone(document.status)}</td>
                      <td>{document.published ? "Published" : "Not published"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Review & Correction Queue</p>
              <h2>Resolve classification exceptions</h2>
            </div>

            <span className="status-pill">{reviewQueue.length} to review</span>
          </div>

          <div className="explain-box">
            Low-confidence, unmatched, scanned and period-missing PDFs stay out of
            auto-ready status. Correct the investor, nature and period here. OCR
            candidate pages can be processed with governed OCR. OCR-completed
            documents still remain in Review until a human confirms the evidence.
          </div>

          {reviewQueue.length === 0 ? (
            <div className="logic-note">
              No classification exceptions remain in this batch.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              }}
            >
              {reviewQueue.slice(0, 24).map((document) => {
                const draft = getReviewDraft(document);

                return (
                  <div className="queue-item" key={`${document.id}-review`}>
                    <strong>{document.fileName}</strong>
                    <br />
                    <small>
                      {extractionLabel(document)} · {document.confidenceScore}%
                      confidence
                    </small>

                    {document.evidence.ocrRequiredPages.length > 0 && (
                      <div className="logic-note">
                        OCR / visual review candidate page(s):{" "}
                        {document.evidence.ocrRequiredPages.join(", ")}
                      </div>
                    )}


                    {document.ocr && (
                      <div className="logic-note">
                        <strong>
                          OCR completed · human confirmation required
                        </strong>
                        <br />
                        Page(s):{" "}
                        {document.ocr.pages
                          .map((page) => page.pageNumber)
                          .join(", ")}
                        {" · "}
                        Model: {document.ocr.model}
                        {" · "}
                        Private sidecar retained
                        {document.textPreview && (
                          <details style={{ marginTop: 10 }}>
                            <summary>Review extracted OCR text</summary>
                            <pre
                              style={{
                                marginTop: 10,
                                maxHeight: 280,
                                overflow: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {document.textPreview}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <label>
                        Investor
                        <select
                          disabled={!canManage}
                          onChange={(event) =>
                            updateReviewDraft(document.id, {
                              investorId: event.target.value,
                            })
                          }
                          value={draft.investorId}
                        >
                          <option value="">Select investor</option>
                          {investors.map((investor) => (
                            <option key={investor.id} value={investor.id}>
                              {investor.investor_code || "-"} —{" "}
                              {investor.investor_name || "Unnamed investor"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Document nature
                        <select
                          disabled={!canManage}
                          onChange={(event) =>
                            updateReviewDraft(document.id, {
                              documentType: event.target.value,
                            })
                          }
                          value={draft.documentType}
                        >
                          {DOCUMENT_TYPES.map((documentType) => (
                            <option key={documentType} value={documentType}>
                              {documentType}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Reporting period
                        <input
                          disabled={!canManage}
                          onChange={(event) =>
                            updateReviewDraft(document.id, {
                              periodLabel: event.target.value,
                            })
                          }
                          placeholder="Example: Q2 FY 2025-26"
                          value={draft.periodLabel}
                        />
                      </label>

                      <label>
                        Review status
                        <select
                          disabled={!canManage}
                          onChange={(event) =>
                            updateReviewDraft(document.id, {
                              status: event.target.value as ReviewDraft["status"],
                            })
                          }
                          value={draft.status}
                        >
                          {REVIEW_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        className="monitor-btn monitor-btn-secondary"
                        disabled={
                          !canManage || savingReviewId === document.id
                        }
                        onClick={() => saveReview(document)}
                        type="button"
                      >
                        {savingReviewId === document.id
                          ? "Saving..."
                          : "Save Review Correction"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Deficiency & Coverage</p>
              <h2>Check investor-wise document coverage</h2>
            </div>

            <span className="status-pill">
              {deficiencyMetrics.available}/{deficiencyMetrics.expected} available
            </span>
          </div>

          <div className="explain-box">
            Use period and nature to identify which investors have supporting PDFs
            and which remain missing, duplicated or under review.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              Period filter
              <input
                onChange={(event) => setDeficiencyPeriod(event.target.value)}
                placeholder="Blank = any period; e.g. Q2 FY 2025-26"
                value={deficiencyPeriod}
              />
            </label>

            <label>
              Document nature
              <select
                onChange={(event) => setDeficiencyType(event.target.value)}
                value={deficiencyType}
              >
                {DOCUMENT_TYPES.filter(
                  (documentType) => documentType !== "Other / Review"
                ).map((documentType) => (
                  <option key={documentType} value={documentType}>
                    {documentType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>{deficiencyMetrics.expected}</h3>
              <p>Expected investor records</p>
            </div>
            <div className="impact-card">
              <h3>{deficiencyMetrics.available}</h3>
              <p>Available</p>
            </div>
            <div className="impact-card">
              <h3>{deficiencyMetrics.missing}</h3>
              <p>Missing</p>
            </div>
            <div className="impact-card">
              <h3>{deficiencyMetrics.exceptions}</h3>
              <p>Review / duplicate</p>
            </div>
          </div>

          {deficiencyRows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Expected nature</th>
                    <th>Period</th>
                    <th>Matched files</th>
                    <th>Coverage status</th>
                  </tr>
                </thead>
                <tbody>
                  {deficiencyRows
                    .filter((row) => row.status !== "Available")
                    .slice(0, 40)
                    .map((row) => (
                      <tr key={`${row.investor.id}-${deficiencyType}`}>
                        <td>
                          {row.investor.investor_name || "Unknown investor"}
                          <br />
                          <small>{row.investor.investor_code || "-"}</small>
                        </td>
                        <td>{deficiencyType}</td>
                        <td>{deficiencyPeriod || "Any period"}</td>
                        <td>{row.matchedCount}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Governed Portal Publishing</p>
              <h2>Publish approved classified PDFs</h2>
            </div>

            <span className="status-pill">
              {publishableDocuments.length} Ready / unpublished
            </span>
          </div>

          <div className="explain-box">
            A7.7-2 removes permanent signed URLs from this flow. Published records
            retain only private storage references and continue through the secured
            Investor Portal document-access API. Publishing requires governed
            approval access.
          </div>

          <div className="action-row">
            <button
              className="monitor-btn monitor-btn-primary"
              disabled={
                !canApprove ||
                publishing ||
                publishableDocuments.length === 0
              }
              onClick={publishReady}
              type="button"
            >
              {publishing
                ? "Publishing..."
                : `Publish ${publishableDocuments.length} Ready PDF(s)`}
            </button>

            <Link
              className="monitor-btn monitor-btn-secondary"
              href="/investor-portal"
            >
              Open Investor Portal
            </Link>

            <Link
              className="monitor-btn monitor-btn-secondary"
              href="/data-room"
            >
              Open Data Room
            </Link>
          </div>

          {!canApprove && (
            <div className="logic-note">
              Your current fund role can review PDF evidence but cannot publish it
              to Investor Portal.
            </div>
          )}
        </div>

        <div className="preview-card">
          <p className="eyebrow">Next · A7.7-3</p>
          <h2>Structured financial extraction</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>SOA transaction intelligence</strong>
              <br />
              Extract investor cashflow rows with source page provenance so
              investor-level XIRR can be reconstructed after reconciliation.
            </div>

            <div className="queue-item">
              <strong>Capital call intelligence</strong>
              <br />
              Extract commitment, call amount, cumulative drawdown, due date and
              call reference to reconstruct remaining uncalled commitment.
            </div>

            <div className="queue-item">
              <strong>Distribution intelligence</strong>
              <br />
              Extract gross / net distribution, tax and payment date as candidate
              investor cashflows.
            </div>

            <div className="queue-item">
              <strong>Excel ↔ PDF reconciliation</strong>
              <br />
              Candidate values will then be compared field-by-field as MATCHED,
              CONFLICT, PDF-ONLY or EXCEL-ONLY before canonical confirmation.
            </div>
          </div>
        </div>

        {batch && (
          <div className="logic-note">
            Latest batch: {batch.batch_name || batch.id} · Last updated{" "}
            {formatTimestamp(batch.updated_at || batch.created_at || "")}
          </div>
        )}
      </section>
    </main>
  );
}
