// Minimal operational subset of the governed PDF GET response. Never copy
// extraction, OCR, financial rows, signals or private sidecars into issue context.
export type PdfIssueDocument = {
  id: string;
  published?: boolean;
  publishEligible?: boolean;
  financialApprovalRequired?: boolean;
  publishBlockReason?: string;
  fileName?: string;
  documentType?: string;
  investorId?: string;
  investorName?: string;
  investorCode?: string;
  periodLabel?: string;
  status?: string;
  reconciliation?: {
    conflictCount?: number;
    pdfOnlyCount?: number;
    excelOnlyCount?: number;
  } | null;
  resolutionDraft?: { unresolvedDecisionCount?: number } | null;
  canonicalCandidate?: {
    approvalRequestId?: string;
    approvalStatus?: string;
    approvalStep?: string;
  } | null;
};

export type PdfIssueApiResponse = {
  documents?: PdfIssueDocument[];
  error?: string;
};

type PdfIssueCode =
  | "PDF_RECONCILIATION_RESOLUTION_REQUIRED"
  | "PDF_CLASSIFICATION_REVIEW_REQUIRED"
  | "PDF_APPROVAL_PENDING"
  | "PDF_PUBLICATION_GATE_BLOCKED";

export type PdfProjectedIssue = {
  id: string;
  source: "PDF Intelligence";
  severity: "Blocking" | "Review";
  code: PdfIssueCode;
  title: string;
  message: string;
  repairHref: "/migration/pdf-intelligence";
  context: Record<string, string | number | null>;
};

export function projectPdfIssues(
  documents: readonly PdfIssueDocument[]
): PdfProjectedIssue[] {
  const issues: PdfProjectedIssue[] = [];
  for (const document of documents) {
    if (document.published === true) continue;

    const reconciliation = document.reconciliation;
    const resolution = document.resolutionDraft;
    const candidate = document.canonicalCandidate;
    const hasDisagreement =
      (reconciliation?.conflictCount ?? 0) > 0 ||
      (reconciliation?.pdfOnlyCount ?? 0) > 0 ||
      (reconciliation?.excelOnlyCount ?? 0) > 0;
    let code: PdfIssueCode;
    let severity: PdfProjectedIssue["severity"];
    let title: string;
    let message: string;

    if (
      (hasDisagreement && !resolution) ||
      (resolution?.unresolvedDecisionCount ?? 0) > 0
    ) {
      code = "PDF_RECONCILIATION_RESOLUTION_REQUIRED";
      severity = "Blocking";
      title = "PDF reconciliation resolution required";
      message = "The value disagreement must be resolved in PDF Intelligence before canonical progression.";
    } else if (
      document.status === "Review" ||
      document.status === "Unmatched" ||
      document.documentType === "Other / Review" ||
      !document.investorId?.trim() ||
      !document.periodLabel?.trim() ||
      document.periodLabel === "Period not detected"
    ) {
      code = "PDF_CLASSIFICATION_REVIEW_REQUIRED";
      severity = "Review";
      title = "PDF classification or identity review required";
      message = "Review the document classification, investor identity and reporting period in PDF Intelligence. Missing identity or period must be corrected in that workflow.";
    } else if (
      // The live server gate is authoritative; candidate approval metadata
      // records submission-time state and may be stale.
      /^Linked Fund Memory approval workflow has not reached final Approved\s*\/\s*Completed status\.?$/i.test(
        document.publishBlockReason?.trim().replace(/\s+/g, " ") ?? ""
      )
    ) {
      code = "PDF_APPROVAL_PENDING";
      severity = "Review";
      title = "PDF canonical approval pending";
      message = "Final approval is pending. The existing maker-checker workflow remains authoritative; review its status in PDF Intelligence.";
    } else if (
      document.financialApprovalRequired === true &&
      document.publishEligible === false
    ) {
      code = "PDF_PUBLICATION_GATE_BLOCKED";
      severity = "Blocking";
      title = "PDF publication gate blocked";
      message = "Publication remains blocked. Review the governed publication gate in PDF Intelligence.";
      if (document.publishBlockReason?.trim()) {
        message += ` ${document.publishBlockReason}`;
      }
    } else {
      continue;
    }

    issues.push({
      id: `pdf:${document.id}:${code}`,
      source: "PDF Intelligence",
      severity,
      code,
      title,
      message,
      repairHref: "/migration/pdf-intelligence",
      context: {
        fileName: document.fileName ?? null,
        documentType: document.documentType ?? null,
        investorName: document.investorName ?? null,
        investorCode: document.investorCode ?? null,
        periodLabel: document.periodLabel ?? null,
        conflictCount: reconciliation?.conflictCount ?? null,
        pdfOnlyCount: reconciliation?.pdfOnlyCount ?? null,
        excelOnlyCount: reconciliation?.excelOnlyCount ?? null,
        unresolvedDecisionCount: resolution?.unresolvedDecisionCount ?? null,
        approvalStatus: candidate?.approvalStatus ?? null,
        approvalStep: candidate?.approvalStep ?? null,
        publishBlockReason: document.publishBlockReason ?? null,
      },
    });
  }
  return issues;
}
