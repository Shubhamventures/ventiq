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

type FinancialCandidateField = {
  key: string;
  label: string;
  valueType: "money" | "date" | "text";
  rawValue: string;
  normalizedValue: number | string | null;
  currency: string;
  sourcePage: number;
  sourceExcerpt: string;
  extractionMethod: string;
  confidence: number;
};

type FinancialCandidateTransaction = {
  transactionDate: string;
  transactionNature: "capital_call" | "distribution" | "other";
  reference: string;
  amount: number;
  currency: string;
  cashflowDirection:
    | "investor_contribution"
    | "paid_to_investor"
    | "unknown";
  sourcePage: number;
  sourceExcerpt: string;
  extractionMethod: string;
  confidence: number;
};

type FinancialCandidateCheck = {
  key: string;
  label: string;
  status: "MATCHED" | "CONFLICT" | "NOT_TESTED";
  summaryValue: number | null;
  reconstructedValue: number | null;
  difference: number | null;
};

type FinancialCandidateManifest = {
  version: string;
  extractionStatus: "candidate";
  generatedAt: string;
  sidecarBucket: string;
  sidecarPath: string;
  fieldCount: number;
  transactionCount: number;
  fields: FinancialCandidateField[];
  transactionPreview: FinancialCandidateTransaction[];
  checks: FinancialCandidateCheck[];
  canonicalWrite: false;
};

type ReconciliationStatus =
  | "MATCHED"
  | "CONFLICT"
  | "PDF-ONLY"
  | "EXCEL-ONLY";

type StructuredEvidenceRef = {
  table: "fund_commitments" | "investor_position_snapshots";
  recordId: string;
  field: string;
  updatedAt: string;
  reportingDate: string;
  approvalStatus: string;
};

type FinancialReconciliationRow = {
  key: string;
  label: string;
  valueType: "money";
  currency: string;
  pdfValue: number | null;
  pdfSourcePage: number | null;
  pdfSourceExcerpt: string;
  structuredValue: number | null;
  structuredSource: StructuredEvidenceRef | null;
  status: ReconciliationStatus;
  difference: number | null;
  resolutionStatus: "unresolved";
  canonicalValue: null;
};

type FinancialReconciliationManifest = {
  version: string;
  generatedAt: string;
  reconciliationStatus: "candidate";
  sidecarBucket: string;
  sidecarPath: string;
  rowCount: number;
  matchedCount: number;
  conflictCount: number;
  pdfOnlyCount: number;
  excelOnlyCount: number;
  rows: FinancialReconciliationRow[];
  canonicalWrite: false;
};


type ResolutionChoice =
  | "use_structured"
  | "use_pdf"
  | "corrected"
  | "unresolved";

type ResolutionDecision = {
  key: string;
  label: string;
  reconciliationStatus: ReconciliationStatus;
  choice: ResolutionChoice;
  proposedValue: number | null;
  note: string;
  structuredValue: number | null;
  pdfValue: number | null;
  decidedByUserId: string;
  decidedByRole: string;
  decidedAt: string;
};

type ResolutionDraftManifest = {
  version: string;
  generatedAt: string;
  status: "draft_pending_checker";
  sidecarBucket: string;
  sidecarPath: string;
  decisionCount: number;
  resolvedDecisionCount: number;
  unresolvedDecisionCount: number;
  decisions: ResolutionDecision[];
  canonicalWrite: false;
};

type ResolutionDraftInput = {
  choice: ResolutionChoice;
  correctedValue: string;
  note: string;
};

type CanonicalCandidateManifest = {
  version: string;
  createdAt: string;
  snapshotId: string;
  baseSnapshotId: string;
  snapshotVersion: number;
  reportingDate: string;
  reportingPeriod: string;
  status: "pending_approval";
  approvalRequestId: string;
  approvalStatus: string;
  approvalStep: string;
  submittedAt: string;
  sourceResolutionSidecarPath: string;
  createdByUserId: string;
  createdByRole: string;
  canonicalWrite: "pending_final_approval";
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
  financialCandidates: FinancialCandidateManifest | null;
  reconciliation: FinancialReconciliationManifest | null;
  resolutionDraft: ResolutionDraftManifest | null;
  canonicalCandidate: CanonicalCandidateManifest | null;
  evidence: EvidenceManifest;
  extractionPending: boolean;
  published: boolean;
  financialApprovalRequired: boolean;
  publishEligible: boolean;
  publishBlockReason: string;
  approvedSnapshotId: string;
  publicationApprovalRequestId: string;
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
    financialCandidateDocuments: number;
    reconciledDocuments: number;
    reconciliationConflicts: number;
    inconsistencyRows: number;
    resolutionDraftDocuments: number;
    unresolvedResolutionRows: number;
    canonicalCandidateDocuments: number;
    approvalSubmittedDocuments: number;
    publicationBlocked: number;
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

function formatCandidateValue(field: FinancialCandidateField) {
  if (field.valueType === "money" && typeof field.normalizedValue === "number") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: field.currency || "INR",
      maximumFractionDigits: 2,
    }).format(field.normalizedValue);
  }

  return field.normalizedValue ?? field.rawValue;
}

function formatCandidateAmount(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function resolutionKey(documentId: string, fieldKey: string) {
  return `${documentId}::${fieldKey}`;
}

function resolutionChoiceLabel(choice: ResolutionChoice) {
  if (choice === "use_structured") return "Use Structured";
  if (choice === "use_pdf") return "Use PDF";
  if (choice === "corrected") return "Enter Corrected Value";
  return "Keep Unresolved";
}

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
  const [financialExtracting, setFinancialExtracting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [savingResolutionId, setSavingResolutionId] = useState("");
  const [preparingCanonicalId, setPreparingCanonicalId] = useState("");
  const [canonicalActionMessage, setCanonicalActionMessage] = useState("");
  const [canonicalActionError, setCanonicalActionError] = useState(false);
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, ResolutionDraftInput>
  >({});
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
      financialCandidateDocuments: documents.filter(
        (document) => Boolean(document.financialCandidates)
      ).length,
      reconciledDocuments: documents.filter(
        (document) => Boolean(document.reconciliation)
      ).length,
      reconciliationConflicts: documents.reduce(
        (sum, document) =>
          sum + Number(document.reconciliation?.conflictCount || 0),
        0
      ),
      inconsistencyRows: documents.reduce(
        (sum, document) =>
          sum +
          Number(document.reconciliation?.conflictCount || 0) +
          Number(document.reconciliation?.pdfOnlyCount || 0) +
          Number(document.reconciliation?.excelOnlyCount || 0),
        0
      ),
      resolutionDraftDocuments: documents.filter(
        (document) => Boolean(document.resolutionDraft)
      ).length,
      unresolvedResolutionRows: documents.reduce(
        (sum, document) =>
          sum +
          Number(document.resolutionDraft?.unresolvedDecisionCount || 0),
        0
      ),
      canonicalCandidateDocuments: documents.filter(
        (document) => Boolean(document.canonicalCandidate?.snapshotId)
      ).length,
      approvalSubmittedDocuments: documents.filter(
        (document) => Boolean(document.canonicalCandidate?.approvalRequestId)
      ).length,
      publicationBlocked: documents.filter(
        (document) =>
          document.status === "Ready" &&
          !document.published &&
          !document.publishEligible
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
          !document.published &&
          document.publishEligible
      ),
    [documents]
  );

  const publicationBlockedDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.status === "Ready" &&
          !document.published &&
          !document.publishEligible
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

    const responseText = await response.text();
    let result: Record<string, any> = {};

    if (responseText.trim()) {
      try {
        result = JSON.parse(responseText) as Record<string, any>;
      } catch {
        throw new Error(
          `PDF Intelligence returned a non-JSON response (HTTP ${response.status}).`
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
          `PDF Intelligence action failed (HTTP ${response.status}).`
      );
    }

    if (!responseText.trim()) {
      throw new Error(
        `PDF Intelligence returned an empty success response (HTTP ${response.status}).`
      );
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

  async function extractStructuredFinancialCandidates() {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can extract financial candidates."
      );
      return;
    }

    const targetIds = documents
      .filter((document) => {
        const supported =
          document.documentType.includes("SOA") ||
          document.documentType.includes("Account Statement") ||
          document.documentType.includes("Capital Call") ||
          document.documentType.includes("Distribution");

        const textReady =
          document.evidence.extractionMode === "embedded_text" ||
          document.evidence.extractionMode === "mixed_text_visual_review" ||
          document.evidence.extractionMode === "ocr_completed";

        return (
          supported &&
          textReady &&
          Boolean(document.investorId) &&
          !document.financialCandidates
        );
      })
      .map((document) => document.id);

    if (targetIds.length === 0) {
      setMessage(
        "No text-ready investor financial PDFs are available for structured extraction in the latest batch."
      );
      return;
    }

    const confirmed = window.confirm(
      `Extract structured financial candidates from ${targetIds.length} PDF(s) in ${activeFundName}?\n\nVENTIQ will create candidate fields and transaction rows with page provenance. No value will be written into Canonical Fund Memory.`
    );

    if (!confirmed) return;

    setFinancialExtracting(true);

    try {
      let processedCount = 0;
      let failedCount = 0;
      const failureMessages: string[] = [];

      for (let index = 0; index < targetIds.length; index += 4) {
        const documentIds = targetIds.slice(index, index + 4);

        setMessage(
          `Extracting structured financial candidates ${Math.min(
            index + documentIds.length,
            targetIds.length
          )}/${targetIds.length}...`
        );

        const result = await apiRequest(
          {
            action: "extract_financial_candidates",
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
                : "Unknown structured extraction error";
            failureMessages.push(`${fileName}: ${failureText}`);
          }
        }
      }

      await loadWorkspace(activeFundName);

      if (failureMessages.length > 0) {
        setMessage(
          `A7.7-3 financial extraction finished. ${processedCount} PDF(s) processed; ${failedCount} failed. ${failureMessages
            .slice(0, 2)
            .join(" | ")}`
        );
      } else {
        setMessage(
          `A7.7-3 financial extraction finished. ${processedCount} PDF(s) processed. Candidate evidence only; no canonical write occurred.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to extract structured financial candidates."
      );
    } finally {
      setFinancialExtracting(false);
    }
  }

  async function runFieldReconciliation() {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can run reconciliation."
      );
      return;
    }

    const targetIds = documents
      .filter(
        (document) =>
          Boolean(document.financialCandidates) &&
          Boolean(document.investorId)
      )
      .map((document) => document.id);

    if (targetIds.length === 0) {
      setMessage(
        "No structured PDF financial candidates are available for reconciliation."
      );
      return;
    }

    const confirmed = window.confirm(
      `Run field-level Structured / Excel ↔ PDF reconciliation for ${targetIds.length} PDF(s) in ${activeFundName}?\n\nVENTIQ will compare candidate PDF values with existing structured evidence and classify each field as MATCHED, CONFLICT, PDF-ONLY or EXCEL-ONLY. No canonical value will be changed.`
    );

    if (!confirmed) return;

    setReconciling(true);

    try {
      let processedCount = 0;
      let failedCount = 0;
      const failureMessages: string[] = [];

      for (let index = 0; index < targetIds.length; index += 6) {
        const documentIds = targetIds.slice(index, index + 6);

        setMessage(
          `Reconciling PDF financial candidates ${Math.min(
            index + documentIds.length,
            targetIds.length
          )}/${targetIds.length}...`
        );

        const result = await apiRequest(
          {
            action: "reconcile_financial_candidates",
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
                : "Unknown reconciliation error";
            failureMessages.push(`${fileName}: ${failureText}`);
          }
        }
      }

      await loadWorkspace(activeFundName);

      if (failureMessages.length > 0) {
        setMessage(
          `A7.7-4A reconciliation finished. ${processedCount} PDF(s) processed; ${failedCount} failed. ${failureMessages
            .slice(0, 2)
            .join(" | ")}`
        );
      } else {
        setMessage(
          `A7.7-4A reconciliation finished. ${processedCount} PDF(s) processed. No canonical value was changed.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to run PDF financial reconciliation."
      );
    } finally {
      setReconciling(false);
    }
  }

  function getResolutionInput(
    document: PdfDocument,
    row: FinancialReconciliationRow
  ): ResolutionDraftInput {
    const key = resolutionKey(document.id, row.key);
    const local = resolutionDrafts[key];
    if (local) return local;

    const saved = document.resolutionDraft?.decisions.find(
      (decision) => decision.key === row.key
    );

    return {
      choice: saved?.choice || "unresolved",
      correctedValue:
        saved?.choice === "corrected" && saved.proposedValue !== null
          ? String(saved.proposedValue)
          : "",
      note: saved?.note || "",
    };
  }

  function updateResolutionInput(
    documentId: string,
    fieldKey: string,
    patch: Partial<ResolutionDraftInput>
  ) {
    const key = resolutionKey(documentId, fieldKey);

    setResolutionDrafts((current) => ({
      ...current,
      [key]: {
        choice: current[key]?.choice || "unresolved",
        correctedValue: current[key]?.correctedValue || "",
        note: current[key]?.note || "",
        ...patch,
      },
    }));
  }

  async function saveResolutionDraft(document: PdfDocument) {
    if (!canManage) {
      setMessage(
        "Read-only access: only an authorised Fund Admin or Maker can save inconsistency resolutions."
      );
      return;
    }

    const reviewRows =
      document.reconciliation?.rows.filter(
        (row) => row.status !== "MATCHED"
      ) || [];

    if (reviewRows.length === 0) {
      setMessage("This PDF has no inconsistency rows requiring resolution.");
      return;
    }

    const decisions = reviewRows.map((row) => {
      const draft = getResolutionInput(document, row);

      return {
        key: row.key,
        choice: draft.choice,
        correctedValue:
          draft.choice === "corrected"
            ? Number(draft.correctedValue)
            : null,
        note: draft.note.trim(),
      };
    });

    const invalid = reviewRows.find((row) => {
      const draft = getResolutionInput(document, row);

      if (draft.choice === "use_structured" && row.structuredValue === null) {
        return true;
      }

      if (draft.choice === "use_pdf" && row.pdfValue === null) {
        return true;
      }

      if (
        draft.choice === "corrected" &&
        (!draft.correctedValue.trim() ||
          !Number.isFinite(Number(draft.correctedValue)))
      ) {
        return true;
      }

      if (draft.choice !== "unresolved" && !draft.note.trim()) {
        return true;
      }

      return false;
    });

    if (invalid) {
      setMessage(
        `${invalid.label}: choose an available source (or enter a corrected numeric value) and add a resolution note.`
      );
      return;
    }

    setSavingResolutionId(document.id);

    try {
      await apiRequest({
        action: "save_resolution_draft",
        fundName: activeFundName,
        documentId: document.id,
        decisions,
      });

      await loadWorkspace(activeFundName);

      setResolutionDrafts((current) => {
        const next = { ...current };
        for (const row of reviewRows) {
          delete next[resolutionKey(document.id, row.key)];
        }
        return next;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save inconsistency resolution draft."
      );
    } finally {
      setSavingResolutionId("");
    }
  }

  async function approvalWorkflowRequest(
    body: Record<string, unknown>
  ) {
    if (!accessToken) {
      throw new Error("Sign in before using the approval workflow.");
    }

    const response = await fetch("/api/admin/approval-workflow", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let result: Record<string, any> = {};

    if (responseText.trim()) {
      try {
        result = JSON.parse(responseText) as Record<string, any>;
      } catch {
        throw new Error(
          `VENTIQ approval workflow returned a non-JSON response (HTTP ${response.status}).`
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
          `VENTIQ approval workflow action failed (HTTP ${response.status}).`
      );
    }

    if (!responseText.trim()) {
      throw new Error(
        `VENTIQ approval workflow returned an empty success response (HTTP ${response.status}).`
      );
    }

    return result;
  }

  async function prepareAndSubmitCanonicalCandidate(
    document: PdfDocument
  ) {
    if (!canManage) {
      setMessage(
        "Only an authorised Fund Admin or Maker can prepare the canonical candidate."
      );
      return;
    }

    const resolution = document.resolutionDraft;
    if (!resolution) {
      setMessage("Save the Fund Inconsistency Review draft first.");
      return;
    }

    if (resolution.unresolvedDecisionCount > 0) {
      setMessage(
        `Resolve all inconsistency rows before canonical submission. ${resolution.unresolvedDecisionCount} row(s) remain unresolved.`
      );
      return;
    }

    setPreparingCanonicalId(document.id);
    setCanonicalActionMessage("");
    setCanonicalActionError(false);

    try {
      let candidate = document.canonicalCandidate;

      if (!candidate?.snapshotId) {
        const prepared = await apiRequest(
          {
            action: "prepare_canonical_candidate",
            fundName: activeFundName,
            documentId: document.id,
          },
          { quiet: true }
        );

        candidate = prepared.canonicalCandidate as CanonicalCandidateManifest;
      }

      if (!candidate?.snapshotId) {
        throw new Error("Canonical candidate snapshot was not created.");
      }

      if (!candidate.approvalRequestId) {
        const approvalResult = await approvalWorkflowRequest({
          action: "create_request",
          sourceModule: "Document Studio",
          linkedRecordId: candidate.snapshotId,
          linkedRecordType: "Fund Memory Snapshot",
          actionType: "Fund Memory Approval",
          actionTitle: `PDF reconciliation canonical confirmation · ${
            document.investorCode || document.investorName
          } · ${document.periodLabel}`,
          actionDescription:
            `Approve immutable Fund Memory snapshot ${candidate.snapshotId} prepared from PDF Intelligence reconciliation and human resolution evidence. Original structured and PDF sources remain preserved.`,
          businessImpact:
            "Final approval will make the new reconciled Fund Memory snapshot live and supersede the prior approved snapshot for the same investor/reporting date.",
          priority: "High",
        });

        const approval = approvalResult.approval || {};

        await apiRequest(
          {
            action: "attach_approval_request",
            fundName: activeFundName,
            documentId: document.id,
            approvalRequestId: approval.id,
            approvalStatus: approval.approval_status || "Pending Review",
            approvalStep: approval.current_step || "Checker Review",
          },
          { quiet: true }
        );
      }

      await loadWorkspace(activeFundName);
      const successMessage =
        "A7.7-6A canonical candidate submitted to the existing VENTIQ approval queue. The maker cannot approve their own request.";
      setCanonicalActionMessage(successMessage);
      setCanonicalActionError(false);
      setMessage(successMessage);
    } catch (error) {
      const failureMessage =
        error instanceof Error
          ? error.message
          : "Unable to prepare and submit the canonical Fund Memory candidate.";
      setCanonicalActionMessage(failureMessage);
      setCanonicalActionError(true);
      setMessage(failureMessage);
    } finally {
      setPreparingCanonicalId("");
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
      setMessage(
        publicationBlockedDocuments.length > 0
          ? `${publicationBlockedDocuments.length} Ready financial PDF(s) are blocked until canonical Fund Memory approval is complete.`
          : "No unpublished Ready PDFs are available."
      );
      return;
    }

    const confirmed = window.confirm(
      `Publish ${publishableDocuments.length} governed PDF(s) to Investor Portal?\n\nFinancial PDFs are included only after final canonical Fund Memory approval. Files remain private in Supabase Storage and no permanent signed URL is stored.`
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
            <h3>{summary.financialCandidateDocuments}</h3>
            <p>Financial candidate PDFs</p>
          </div>
          <div className="impact-card">
            <h3>{summary.reconciledDocuments}</h3>
            <p>Reconciled PDFs</p>
          </div>
          <div className="impact-card">
            <h3>{summary.reconciliationConflicts}</h3>
            <p>Field conflicts</p>
          </div>
          <div className="impact-card">
            <h3>{summary.inconsistencyRows}</h3>
            <p>Inconsistency rows</p>
          </div>
          <div className="impact-card">
            <h3>{summary.resolutionDraftDocuments}</h3>
            <p>Resolution drafts</p>
          </div>
          <div className="impact-card">
            <h3>{summary.canonicalCandidateDocuments}</h3>
            <p>Canonical candidates</p>
          </div>
          <div className="impact-card">
            <h3>{summary.approvalSubmittedDocuments}</h3>
            <p>Approval submitted</p>
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
                financialExtracting ||
                reconciling ||
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
                financialExtracting ||
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

            <button
              className="monitor-btn monitor-btn-primary"
              disabled={
                !batch ||
                !canManage ||
                processing ||
                ocrProcessing ||
                financialExtracting ||
                loadingWorkspace
              }
              onClick={extractStructuredFinancialCandidates}
              type="button"
            >
              {financialExtracting
                ? "Extracting candidates..."
                : "Extract Financial Candidates"}
            </button>

            <button
              className="monitor-btn monitor-btn-primary"
              disabled={
                !batch ||
                !canManage ||
                processing ||
                ocrProcessing ||
                financialExtracting ||
                reconciling ||
                loadingWorkspace ||
                summary.financialCandidateDocuments === 0
              }
              onClick={runFieldReconciliation}
              type="button"
            >
              {reconciling ? "Reconciling..." : "Run Reconciliation"}
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
              <p className="eyebrow">A7.7-3 · Candidate Financial Evidence</p>
              <h2>Review structured values before reconciliation</h2>
            </div>

            <span className="status-pill">
              {summary.financialCandidateDocuments} candidate PDF(s)
            </span>
          </div>

          <div className="explain-box">
            These values are deterministic candidates extracted from the private
            PDF text layer. Every field and transaction retains a source page.
            The full candidate set is retained in private storage. Nothing here
            writes into Canonical Fund Memory.
          </div>

          {documents.filter((document) => document.financialCandidates).length ===
          0 ? (
            <div className="logic-note">
              No structured financial candidates exist in the latest batch yet.
              Use a text-ready SOA, Capital Call Notice or Distribution Notice and
              click Extract Financial Candidates.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {documents
                .filter((document) => document.financialCandidates)
                .map((document) => {
                  const candidates = document.financialCandidates!;

                  return (
                    <div className="queue-item" key={`${document.id}-financial`}>
                      <div className="section-heading-row">
                        <div>
                          <strong>{document.fileName}</strong>
                          <br />
                          <small>
                            {document.investorCode} · {document.periodLabel} ·{" "}
                            {document.documentType}
                          </small>
                        </div>

                        <span className="status-pill">
                          Candidate only · no canonical write
                        </span>
                      </div>

                      <div className="dashboard-grid">
                        <div className="dashboard-card">
                          <strong>{candidates.fieldCount}</strong>
                          <p>Candidate fields</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>{candidates.transactionCount}</strong>
                          <p>Candidate transactions</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>
                            {
                              candidates.checks.filter(
                                (check) => check.status === "MATCHED"
                              ).length
                            }
                          </strong>
                          <p>Within-PDF checks matched</p>
                        </div>
                      </div>

                      {candidates.fields.length > 0 && (
                        <div className="table-wrap" style={{ marginTop: 14 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Candidate field</th>
                                <th>Normalized value</th>
                                <th>Source page</th>
                                <th>Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {candidates.fields.map((field) => (
                                <tr key={`${document.id}-${field.key}`}>
                                  <td>
                                    <strong>{field.label}</strong>
                                    <br />
                                    <small>{field.key}</small>
                                  </td>
                                  <td>{String(formatCandidateValue(field))}</td>
                                  <td>Page {field.sourcePage}</td>
                                  <td>{field.confidence}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {candidates.transactionPreview.length > 0 && (
                        <div className="table-wrap" style={{ marginTop: 14 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Nature</th>
                                <th>Reference</th>
                                <th>Amount</th>
                                <th>Direction</th>
                                <th>Source page</th>
                              </tr>
                            </thead>
                            <tbody>
                              {candidates.transactionPreview.map(
                                (transaction, index) => (
                                  <tr
                                    key={`${document.id}-${transaction.reference}-${index}`}
                                  >
                                    <td>{transaction.transactionDate}</td>
                                    <td>{transaction.transactionNature}</td>
                                    <td>{transaction.reference}</td>
                                    <td>
                                      {formatCandidateAmount(
                                        transaction.amount,
                                        transaction.currency
                                      )}
                                    </td>
                                    <td>{transaction.cashflowDirection}</td>
                                    <td>Page {transaction.sourcePage}</td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        {candidates.checks.map((check) => (
                          <div
                            className="logic-note"
                            key={`${document.id}-${check.key}`}
                          >
                            <strong>{check.status}</strong> · {check.label}
                            {check.difference !== null && (
                              <>
                                {" · Difference "}
                                {formatCandidateAmount(check.difference)}
                              </>
                            )}
                          </div>
                        ))}
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
              <p className="eyebrow">A7.7-4A · Structured / Excel ↔ PDF</p>
              <h2>Field-level reconciliation</h2>
            </div>

            <span className="status-pill">
              {summary.reconciliationConflicts} conflict(s)
            </span>
          </div>

          <div className="explain-box">
            VENTIQ compares PDF candidate evidence with the existing structured
            Fund Memory inputs for the same investor. Commitment, called,
            uncalled and distributions come from fund_commitments. Current NAV
            is compared only when a reporting-date investor snapshot exists.
            Every source record remains visible and no canonical value is
            changed in A7.7-4A.
          </div>

          {documents.filter((document) => document.reconciliation).length ===
          0 ? (
            <div className="logic-note">
              No field-level reconciliation has been run for the latest batch.
              Extract PDF financial candidates first, then click Run
              Reconciliation.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {documents
                .filter((document) => document.reconciliation)
                .map((document) => {
                  const reconciliation = document.reconciliation!;

                  return (
                    <div
                      className="queue-item"
                      key={`${document.id}-reconciliation`}
                    >
                      <div className="section-heading-row">
                        <div>
                          <strong>{document.fileName}</strong>
                          <br />
                          <small>
                            {document.investorCode} · {document.periodLabel}
                          </small>
                        </div>

                        <span className="status-pill">
                          Candidate reconciliation · no canonical write
                        </span>
                      </div>

                      <div className="dashboard-grid">
                        <div className="dashboard-card">
                          <strong>{reconciliation.matchedCount}</strong>
                          <p>MATCHED</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>{reconciliation.conflictCount}</strong>
                          <p>CONFLICT</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>{reconciliation.pdfOnlyCount}</strong>
                          <p>PDF-ONLY</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>{reconciliation.excelOnlyCount}</strong>
                          <p>EXCEL-ONLY</p>
                        </div>
                      </div>

                      <div
                        className="table-wrap"
                        style={{ marginTop: 14, overflowX: "auto" }}
                      >
                        <table style={{ minWidth: 1120 }}>
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Structured / Excel evidence</th>
                              <th>PDF evidence</th>
                              <th>Difference</th>
                              <th>Status</th>
                              <th>Provenance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconciliation.rows.map((row) => (
                              <tr key={`${document.id}-${row.key}`}>
                                <td>
                                  <strong>{row.label}</strong>
                                  <br />
                                  <small>{row.key}</small>
                                </td>
                                <td>
                                  {row.structuredValue === null
                                    ? "—"
                                    : formatCandidateAmount(
                                        row.structuredValue,
                                        row.currency
                                      )}
                                </td>
                                <td>
                                  {row.pdfValue === null
                                    ? "—"
                                    : formatCandidateAmount(
                                        row.pdfValue,
                                        row.currency
                                      )}
                                </td>
                                <td>
                                  {row.difference === null
                                    ? "—"
                                    : formatCandidateAmount(
                                        row.difference,
                                        row.currency
                                      )}
                                </td>
                                <td>
                                  <strong>{row.status}</strong>
                                </td>
                                <td>
                                  {row.structuredSource ? (
                                    <>
                                      {row.structuredSource.table}.
                                      {row.structuredSource.field}
                                      <br />
                                      <small>
                                        {row.structuredSource.recordId}
                                      </small>
                                    </>
                                  ) : (
                                    "No structured source"
                                  )}
                                  <br />
                                  <small>
                                    {row.pdfSourcePage
                                      ? `PDF page ${row.pdfSourcePage}`
                                      : "No PDF source"}
                                  </small>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
              <p className="eyebrow">A7.7-5A · Fund Inconsistency Review</p>
              <h2>Choose a draft resolution without changing canonical data</h2>
            </div>

            <span className="status-pill">
              {summary.inconsistencyRows} inconsistency row(s)
            </span>
          </div>

          <div className="explain-box">
            Only CONFLICT, PDF-ONLY and EXCEL-ONLY rows require a human
            decision. A Fund Admin / Maker can propose Use Structured, Use PDF,
            Enter Corrected Value or Keep Unresolved. The proposal is retained
            as a private draft for checker review. Original evidence is never
            overwritten and Canonical Fund Memory is not updated here.
          </div>

          {documents.filter(
            (document) =>
              document.reconciliation &&
              document.reconciliation.rows.some(
                (row) => row.status !== "MATCHED"
              )
          ).length === 0 ? (
            <div className="logic-note">
              No inconsistencies require human resolution in the latest batch.
              The current reconciled evidence is fully matched.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {documents
                .filter(
                  (document) =>
                    document.reconciliation &&
                    document.reconciliation.rows.some(
                      (row) => row.status !== "MATCHED"
                    )
                )
                .map((document) => {
                  const reviewRows = document.reconciliation!.rows.filter(
                    (row) => row.status !== "MATCHED"
                  );

                  return (
                    <div
                      className="queue-item"
                      key={`${document.id}-resolution`}
                    >
                      <div className="section-heading-row">
                        <div>
                          <strong>{document.fileName}</strong>
                          <br />
                          <small>
                            {document.investorCode} · {document.periodLabel}
                          </small>
                        </div>

                        <span className="status-pill">
                          {document.resolutionDraft
                            ? "Draft pending checker"
                            : "Resolution required"}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 14,
                          marginTop: 14,
                        }}
                      >
                        {reviewRows.map((row) => {
                          const draft = getResolutionInput(document, row);

                          return (
                            <div
                              className="logic-note"
                              key={`${document.id}-${row.key}-resolution`}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "minmax(180px, 1.25fr) minmax(150px, 1fr) minmax(150px, 1fr)",
                                  gap: 14,
                                  alignItems: "start",
                                }}
                              >
                                <div>
                                  <strong>
                                    {row.status} · {row.label}
                                  </strong>
                                  <br />
                                  <small>
                                    Difference:{" "}
                                    {row.difference === null
                                      ? "—"
                                      : formatCandidateAmount(
                                          row.difference,
                                          row.currency
                                        )}
                                  </small>
                                </div>

                                <div>
                                  <small>Structured / Excel</small>
                                  <br />
                                  <strong>
                                    {row.structuredValue === null
                                      ? "Not available"
                                      : formatCandidateAmount(
                                          row.structuredValue,
                                          row.currency
                                        )}
                                  </strong>
                                </div>

                                <div>
                                  <small>PDF evidence</small>
                                  <br />
                                  <strong>
                                    {row.pdfValue === null
                                      ? "Not available"
                                      : formatCandidateAmount(
                                          row.pdfValue,
                                          row.currency
                                        )}
                                  </strong>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "minmax(210px, 0.7fr) minmax(210px, 0.7fr) minmax(260px, 1.6fr)",
                                  gap: 12,
                                  marginTop: 12,
                                }}
                              >
                                <select
                                  className="portal-select"
                                  value={draft.choice}
                                  onChange={(event) =>
                                    updateResolutionInput(
                                      document.id,
                                      row.key,
                                      {
                                        choice: event.target
                                          .value as ResolutionChoice,
                                      }
                                    )
                                  }
                                >
                                  <option value="unresolved">
                                    Keep Unresolved
                                  </option>
                                  <option
                                    disabled={row.structuredValue === null}
                                    value="use_structured"
                                  >
                                    Use Structured
                                  </option>
                                  <option
                                    disabled={row.pdfValue === null}
                                    value="use_pdf"
                                  >
                                    Use PDF
                                  </option>
                                  <option value="corrected">
                                    Enter Corrected Value
                                  </option>
                                </select>

                                <input
                                  className="portal-input"
                                  disabled={draft.choice !== "corrected"}
                                  inputMode="decimal"
                                  onChange={(event) =>
                                    updateResolutionInput(
                                      document.id,
                                      row.key,
                                      {
                                        correctedValue:
                                          event.target.value,
                                      }
                                    )
                                  }
                                  placeholder="Corrected value"
                                  value={draft.correctedValue}
                                />

                                <input
                                  className="portal-input"
                                  onChange={(event) =>
                                    updateResolutionInput(
                                      document.id,
                                      row.key,
                                      { note: event.target.value }
                                    )
                                  }
                                  placeholder={
                                    draft.choice === "unresolved"
                                      ? "Optional note while unresolved"
                                      : "Required resolution rationale"
                                  }
                                  value={draft.note}
                                />
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <small>
                                  Proposed decision:{" "}
                                  <strong>
                                    {resolutionChoiceLabel(draft.choice)}
                                  </strong>
                                  {" · "}
                                  Canonical write: disabled
                                </small>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <button
                          className="monitor-btn monitor-btn-primary"
                          disabled={
                            savingResolutionId === document.id ||
                            !canManage
                          }
                          onClick={() => saveResolutionDraft(document)}
                          type="button"
                        >
                          {savingResolutionId === document.id
                            ? "Saving Draft..."
                            : "Save Resolution Draft"}
                        </button>
                      </div>

                      {document.resolutionDraft && (
                        <div className="logic-note" style={{ marginTop: 14 }}>
                          <strong>Draft pending checker</strong>
                          {" · "}
                          {document.resolutionDraft.resolvedDecisionCount} resolved
                          {" · "}
                          {document.resolutionDraft.unresolvedDecisionCount} unresolved
                          {" · "}
                          No canonical write
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">A7.7-6A · Maker-Checker Canonical Confirmation</p>
              <h2>Promote only a fully resolved package into the existing approval queue</h2>
            </div>

            <span className="status-pill">
              {summary.approvalSubmittedDocuments} submitted
            </span>
          </div>

          <div className="explain-box">
            A fully resolved reconciliation package creates a new immutable Fund
            Memory snapshot in pending_approval status. If a prior interrupted
            submission already created the same pending snapshot, VENTIQ reuses
            that orphan candidate rather than creating another version. The prior approved
            snapshot remains live. VENTIQ then submits the new snapshot through
            the existing Maker → Checker Review → Final Approval workflow. The
            original maker cannot approve their own request.
          </div>

          {documents.filter((document) => document.resolutionDraft).length ===
          0 ? (
            <div className="logic-note">
              No resolution package is available for canonical confirmation.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {documents
                .filter((document) => document.resolutionDraft)
                .map((document) => {
                  const resolution = document.resolutionDraft!;
                  const candidate = document.canonicalCandidate;
                  const blocked = resolution.unresolvedDecisionCount > 0;

                  return (
                    <div
                      className="queue-item"
                      key={`${document.id}-canonical`}
                    >
                      <div className="section-heading-row">
                        <div>
                          <strong>{document.fileName}</strong>
                          <br />
                          <small>
                            {document.investorCode} · {document.periodLabel}
                          </small>
                        </div>

                        <span className="status-pill">
                          {candidate?.approvalRequestId
                            ? candidate.approvalStatus || "Pending Review"
                            : candidate?.snapshotId
                              ? "Candidate prepared"
                              : blocked
                                ? "Blocked · unresolved rows"
                                : "Ready for submission"}
                        </span>
                      </div>

                      <div className="dashboard-grid">
                        <div className="dashboard-card">
                          <strong>
                            {resolution.resolvedDecisionCount}
                          </strong>
                          <p>Resolved decisions</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>
                            {resolution.unresolvedDecisionCount}
                          </strong>
                          <p>Unresolved decisions</p>
                        </div>
                        <div className="dashboard-card">
                          <strong>
                            {candidate?.snapshotVersion || "—"}
                          </strong>
                          <p>Candidate snapshot version</p>
                        </div>
                      </div>

                      {blocked && (
                        <div className="logic-note" style={{ marginTop: 14 }}>
                          <strong>Canonical submission blocked.</strong>
                          {" "}
                          Resolve all inconsistency rows and save the draft again
                          before preparing a Fund Memory candidate.
                        </div>
                      )}

                      {candidate?.snapshotId && (
                        <div className="logic-note" style={{ marginTop: 14 }}>
                          <strong>Immutable candidate snapshot</strong>
                          <br />
                          ID: {candidate.snapshotId}
                          <br />
                          Base snapshot preserved: {candidate.baseSnapshotId}
                          <br />
                          Reporting date: {candidate.reportingDate}
                          <br />
                          Status: {candidate.status}
                          <br />
                          Canonical write: pending final approval
                        </div>
                      )}

                      {candidate?.approvalRequestId && (
                        <div className="logic-note" style={{ marginTop: 14 }}>
                          <strong>Existing VENTIQ approval workflow</strong>
                          <br />
                          Approval request: {candidate.approvalRequestId}
                          <br />
                          Submitted status: {candidate.approvalStatus}
                          <br />
                          Submitted step: {candidate.approvalStep}
                          <br />
                          Maker self-approval is blocked by the approval API.
                        </div>
                      )}

                      {canonicalActionMessage && (
                        <div
                          className="logic-note"
                          style={{ marginTop: 14 }}
                        >
                          <strong>
                            {canonicalActionError
                              ? "Canonical submission error"
                              : "Canonical submission"}
                          </strong>
                          <br />
                          {canonicalActionMessage}
                        </div>
                      )}

                      <div className="action-row" style={{ marginTop: 14 }}>
                        <button
                          className="monitor-btn monitor-btn-primary"
                          disabled={
                            blocked ||
                            !canManage ||
                            preparingCanonicalId === document.id ||
                            Boolean(candidate?.approvalRequestId)
                          }
                          onClick={() =>
                            prepareAndSubmitCanonicalCandidate(document)
                          }
                          type="button"
                        >
                          {preparingCanonicalId === document.id
                            ? "Preparing & Submitting..."
                            : candidate?.approvalRequestId
                              ? "Submitted to Approval Queue"
                              : "Prepare & Submit Canonical Candidate"}
                        </button>

                        <Link
                          className="monitor-btn monitor-btn-secondary"
                          href="/admin/audit-workflow"
                        >
                          Open Approval Queue
                        </Link>
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
              <h2>Publish only canonically cleared investor PDFs</h2>
            </div>

            <span className="status-pill">
              {publishableDocuments.length} publishable ·{" "}
              {publicationBlockedDocuments.length} blocked
            </span>
          </div>

          <div className="explain-box">
            Financial PDFs such as SOA, Capital Call, Distribution and IRR
            statements cannot enter Investor Portal until their linked Fund Memory
            snapshot is matched, ready, finally approved and still live. Other
            governed PDFs retain the existing approval-access rule. All files remain
            private in Supabase Storage with no permanent signed URL.
          </div>

          {publicationBlockedDocuments.length > 0 && (
            <div className="explain-box">
              <strong>Financial publication gate active.</strong>
              {publicationBlockedDocuments.slice(0, 5).map((document) => (
                <div key={`${document.id}-publish-block`}>
                  {document.fileName}:{" "}
                  {document.publishBlockReason ||
                    "Canonical Fund Memory approval is incomplete."}
                </div>
              ))}
            </div>
          )}

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
                : `Publish ${publishableDocuments.length} governed PDF(s)`}
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
          <p className="eyebrow">Next · A7.7-7</p>
          <h2>Investor Portal & Data Room organisation from approved evidence</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Approved document organisation</strong>
              <br />
              Organise approved historical PDFs by fund, investor, period and
              document nature without duplicating the source file.
            </div>

            <div className="queue-item">
              <strong>Investor entitlement</strong>
              <br />
              Publish only approved investor-specific documents through the
              existing governed Investor Portal access layer.
            </div>

            <div className="queue-item">
              <strong>Data Room lineage</strong>
              <br />
              Keep source PDF, extracted evidence, reconciliation and approval
              lineage connected to the Data Room record.
            </div>

            <div className="queue-item">
              <strong>Migration completion controls</strong>
              <br />
              Surface missing, review and approved historical evidence before
              stakeholder launch readiness is declared complete.
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
