import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
  type GovernedFundActor,
  type GovernedFundOption,
} from "../../../../lib/server/governedFundAccess";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_PAGES = 250;
const MAX_DOCUMENTS_PER_PROCESS_REQUEST = 6;
const LOW_TEXT_PAGE_THRESHOLD = 24;
const EVIDENCE_PREFIX = "A7.7_EVIDENCE_JSON:";
const MANAGE_ROLES = new Set(["fund_admin", "maker"]);

type DataRow = Record<string, unknown>;

type InvestorRecord = {
  id: string;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  tax_id: string | null;
};

type EvidencePage = {
  pageNumber: number;
  characterCount: number;
  textAvailable: boolean;
};

type EvidenceManifest = {
  version: "A7.7-2";
  totalPages: number;
  parsedPages: number;
  totalCharacters: number;
  extractionMode:
    | "embedded_text"
    | "mixed_text_visual_review"
    | "ocr_required"
    | "page_limit_review"
    | "pending";
  ocrRequiredPages: number[];
  pageLimitReached: boolean;
  pageEvidence: EvidencePage[];
  quarter: string;
  financialYear: string;
};

type ExtractionResult = {
  text: string;
  textPreview: string;
  manifest: EvidenceManifest;
  extractionSignals: string[];
};

type ClassificationResult = {
  documentType: string;
  signals: string[];
};

type PeriodResult = {
  periodLabel: string;
  quarter: string;
  financialYear: string;
  signals: string[];
};

type InvestorMatch = {
  investor: InvestorRecord | null;
  investorScore: number;
  signals: string[];
};

type PdfDocumentRow = {
  id: string;
  batch_id: string | null;
  original_file_name: string | null;
  file_size: number | string | null;
  document_type: string | null;
  matched_investor_id: string | null;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  fund_name: string | null;
  period_label: string | null;
  confidence_score: number | string | null;
  status: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  match_signals: unknown;
  extracted_text_preview: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanStorageName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "document.pdf";
}

function parseSignals(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function getEvidenceManifest(signals: string[]): EvidenceManifest | null {
  const encoded = signals.find((signal) => signal.startsWith(EVIDENCE_PREFIX));
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(encoded.slice(EVIDENCE_PREFIX.length)) as EvidenceManifest;
    if (parsed?.version !== "A7.7-2") return null;
    return parsed;
  } catch {
    return null;
  }
}

function withoutEvidenceSignal(signals: string[]) {
  return signals.filter((signal) => !signal.startsWith(EVIDENCE_PREFIX));
}

function getDocumentCategory(documentType: string) {
  if (documentType.includes("SOA") || documentType.includes("Account")) return "SOA";
  if (documentType.includes("Capital Call")) return "Capital Call Notice";
  if (documentType.includes("Distribution")) return "Distribution Notice";
  if (documentType.includes("IRR")) return "IRR Statement";
  if (documentType.includes("Tax")) return "Tax Document";
  if (documentType.includes("Portfolio")) return "Portfolio Report";
  if (documentType.includes("Fund")) return "Fund Report";
  return "Other";
}

function detectDocumentType(fileName: string, pdfText: string): ClassificationResult {
  const fileNameText = normalizeSearchText(fileName);
  const fullText = normalizeSearchText(pdfText);
  const headerText = fullText.slice(0, 2200);

  type Candidate = {
    documentType: string;
    score: number;
    signals: string[];
  };

  const candidates: Candidate[] = [];

  function addCandidate(
    documentType: string,
    filePatterns: Array<string | RegExp>,
    headerPatterns: Array<string | RegExp>,
    bodyPatterns: Array<string | RegExp>
  ) {
    let score = 0;
    const signals: string[] = [];

    const matches = (value: string, pattern: string | RegExp) =>
      typeof pattern === "string" ? value.includes(pattern) : pattern.test(value);

    if (filePatterns.some((pattern) => matches(fileNameText, pattern))) {
      score += 12;
      signals.push(`${documentType}: filename signal`);
    }

    if (headerPatterns.some((pattern) => matches(headerText, pattern))) {
      score += 10;
      signals.push(`${documentType}: title/header signal`);
    }

    if (bodyPatterns.some((pattern) => matches(fullText, pattern))) {
      score += 2;
      signals.push(`${documentType}: body-content signal`);
    }

    if (score > 0) {
      candidates.push({ documentType, score, signals });
    }
  }

  // Document identity must outweigh transactional words that appear inside
  // statements. For example, an SOA naturally contains many "Capital Call"
  // rows but remains an SOA.
  addCandidate(
    "SOA / Account Statement",
    [
      /\bsoa\b/,
      "statement-of-account",
      "statement_of_account",
      "statement of account",
      "capital-account-statement",
      "capital_account_statement",
    ],
    [
      "statement of account",
      "capital account statement",
      "investor account statement",
      "statement of capital account",
      /\bsoa\b/,
    ],
    [
      "statement of account",
      "capital account statement",
      "investor account statement",
      "statement of capital account",
      /\bsoa\b/,
    ]
  );

  addCandidate(
    "Capital Call Notice",
    [
      "capital-call",
      "capital_call",
      "capital call",
      "drawdown-notice",
      "drawdown_notice",
      "drawdown notice",
    ],
    [
      "capital call notice",
      "drawdown notice",
      "capital contribution notice",
      "notice of drawdown",
      "drawdown communication",
    ],
    [
      "capital call",
      "drawdown notice",
      "capital contribution notice",
      "drawdown communication",
      "notice of drawdown",
    ]
  );

  addCandidate(
    "Distribution Notice",
    [
      "distribution-notice",
      "distribution_notice",
      "distribution notice",
      "distribution-statement",
      "distribution_statement",
    ],
    [
      "distribution notice",
      "distribution statement",
      "gross distribution",
      "net distribution",
    ],
    [
      "distribution notice",
      "distribution statement",
      "gross distribution",
      "net distribution",
      "amount distributed",
    ]
  );

  addCandidate(
    "Tax Document",
    ["tax", "64c", "64d", "tds"],
    [
      "form 64c",
      "form 64d",
      "tax certificate",
      "tax statement",
      "withholding tax",
      /\btds\b/,
    ],
    [
      "form 64c",
      "form 64d",
      "tax certificate",
      "tax statement",
      "withholding tax",
      /\btds\b/,
    ]
  );

  addCandidate(
    "IRR Statement",
    ["irr", "performance-statement", "performance_statement"],
    ["irr statement", "internal rate of return", "performance statement"],
    ["irr statement", "internal rate of return"]
  );

  addCandidate(
    "Portfolio Report",
    ["portfolio-report", "portfolio_report", "valuation-report", "valuation_report"],
    ["portfolio report", "portfolio valuation", "valuation report"],
    ["portfolio report", "portfolio valuation", "valuation report"]
  );

  addCandidate(
    "Fund Report",
    [
      "quarterly-report",
      "quarterly_report",
      "annual-report",
      "annual_report",
      "fund-report",
      "fund_report",
    ],
    [
      "quarterly fund report",
      "annual fund report",
      "quarterly investor report",
      "fund performance report",
    ],
    [
      "quarterly fund report",
      "annual fund report",
      "quarterly investor report",
      "fund performance report",
    ]
  );

  if (candidates.length === 0) {
    return {
      documentType: "Other Investor Document",
      signals: ["No strong document-type signal detected"],
    };
  }

  candidates.sort((left, right) => right.score - left.score);
  const winner = candidates[0];

  const runnerUp = candidates[1];
  const signals = [...winner.signals, `Document classification score: ${winner.score}`];

  if (runnerUp && runnerUp.score > 0) {
    signals.push(
      `Next-best classification: ${runnerUp.documentType} (${runnerUp.score})`
    );
  }

  return {
    documentType: winner.documentType,
    signals,
  };
}

const monthNumbers: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function fyFromMonthYear(month: number, year: number) {
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `FY ${startYear}-${String(endYear).slice(-2)}`;
}

function quarterFromMonth(month: number) {
  if (month >= 4 && month <= 6) return "Q1";
  if (month >= 7 && month <= 9) return "Q2";
  if (month >= 10 && month <= 12) return "Q3";
  return "Q4";
}

function normalizeExplicitFinancialYear(raw: string) {
  const compact = raw.toUpperCase().replace(/\s+/g, " ").trim();
  const range = compact.match(/FY\s*(20\d{2})\s*[-/]\s*(?:20)?(\d{2,4})/i);
  if (range) {
    const start = Number(range[1]);
    const endRaw = range[2];
    const end = endRaw.length === 4 ? Number(endRaw) : Number(`20${endRaw}`);
    if (end === start + 1) {
      return `FY ${start}-${String(end).slice(-2)}`;
    }
  }

  const four = compact.match(/FY\s*(20\d{2})/i);
  if (four) {
    const start = Number(four[1]);
    return `FY ${start}-${String(start + 1).slice(-2)}`;
  }

  const two = compact.match(/FY\s*(\d{2})\b/i);
  if (two) {
    return `FY${two[1]}`;
  }

  return compact;
}

function detectPeriod(fileName: string, pdfText: string): PeriodResult {
  // Historical filenames commonly use underscores / hyphens around quarter
  // labels (for example Q1_FY27). Normalize those separators for period
  // detection without changing the broader investor/document matching rules.
  const periodFileName = fileName.replace(/[_-]+/g, " ");
  const combined = normalizeSearchText(`${periodFileName} ${pdfText}`);
  const signals: string[] = [];

  const explicitQuarter = combined.match(
    /\b(q[1-4])\s*(?:[-/ ]\s*)?(fy\s*(?:20\d{2}(?:\s*[-/]\s*(?:20)?\d{2,4})?|\d{2}))\b/i
  );

  if (explicitQuarter) {
    const quarter = explicitQuarter[1].toUpperCase();
    const financialYear = normalizeExplicitFinancialYear(explicitQuarter[2]);
    const periodLabel = `${quarter} ${financialYear}`.trim();
    signals.push(`Quarter / financial year detected: ${periodLabel}`);
    return { periodLabel, quarter, financialYear, signals };
  }

  const quarterEnded = combined.match(
    /(?:quarter ended|period ended|for the quarter ended|quarter ending)\s+(?:on\s+)?(\d{1,2}\s+)?(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)[,\s]+(20\d{2})/i
  );

  if (quarterEnded) {
    const month = monthNumbers[quarterEnded[2].toLowerCase()];
    const year = Number(quarterEnded[3]);
    const quarter = quarterFromMonth(month);
    const financialYear = fyFromMonthYear(month, year);
    const periodLabel = `${quarter} ${financialYear}`;
    signals.push(`Quarter-ended date mapped to ${periodLabel}`);
    return { periodLabel, quarter, financialYear, signals };
  }

  const monthYear = combined.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)[,\s]+(20\d{2})\b/i
  );

  if (monthYear) {
    const month = monthNumbers[monthYear[1].toLowerCase()];
    const year = Number(monthYear[2]);
    const quarter = quarterFromMonth(month);
    const financialYear = fyFromMonthYear(month, year);
    const periodLabel = `${quarter} ${financialYear}`;
    signals.push(`Month / year mapped to ${periodLabel}`);
    return { periodLabel, quarter, financialYear, signals };
  }

  const explicitFy = combined.match(
    /\bfy\s*(?:20\d{2}(?:\s*[-/]\s*(?:20)?\d{2,4})?|\d{2})\b/i
  );

  if (explicitFy) {
    const financialYear = normalizeExplicitFinancialYear(explicitFy[0]);
    signals.push(`Financial year detected: ${financialYear}`);
    return {
      periodLabel: financialYear,
      quarter: "",
      financialYear,
      signals,
    };
  }

  signals.push("No reporting period detected");
  return {
    periodLabel: "Period not detected",
    quarter: "",
    financialYear: "",
    signals,
  };
}

function calculateNameMatchScore(investorName: string, combinedText: string) {
  const normalizedName = normalizeSearchText(investorName);
  if (!normalizedName) return 0;

  if (combinedText.includes(normalizedName)) {
    return 30;
  }

  const tokens = normalizedName
    .split(" ")
    .filter((token) => token.length > 2);

  if (tokens.length === 0) return 0;

  const matchedTokens = tokens.filter((token) => combinedText.includes(token));

  if (matchedTokens.length >= Math.ceil(tokens.length * 0.75)) return 22;
  if (matchedTokens.length >= Math.ceil(tokens.length * 0.5)) return 14;
  return 0;
}

function matchInvestor(
  investors: InvestorRecord[],
  fileName: string,
  pdfText: string
): InvestorMatch {
  const combinedText = normalizeSearchText(`${fileName} ${pdfText}`);

  let bestInvestor: InvestorRecord | null = null;
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const investor of investors) {
    let score = 0;
    const signals: string[] = [];

    const investorCode = normalizeSearchText(investor.investor_code || "");
    const investorName = normalizeSearchText(investor.investor_name || "");
    const email = normalizeSearchText(investor.email || "");
    const taxId = normalizeSearchText(investor.tax_id || "");

    if (investorCode && combinedText.includes(investorCode)) {
      score += 40;
      signals.push(`Investor code matched: ${investor.investor_code}`);
    }

    if (email && combinedText.includes(email)) {
      score += 25;
      signals.push(`Investor email matched: ${investor.email}`);
    }

    if (taxId && combinedText.includes(taxId)) {
      score += 25;
      signals.push("Investor tax ID matched");
    }

    const nameScore = investorName
      ? calculateNameMatchScore(investorName, combinedText)
      : 0;

    if (nameScore > 0) {
      score += nameScore;
      signals.push(`Investor name matched: ${investor.investor_name}`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestInvestor = investor;
      bestSignals = signals;
    }
  }

  if (!bestInvestor || bestScore < 14) {
    return {
      investor: null,
      investorScore: 0,
      signals: ["No sufficiently strong fund-scoped investor match found"],
    };
  }

  return {
    investor: bestInvestor,
    investorScore: Math.min(bestScore, 60),
    signals: bestSignals,
  };
}

function calculateConfidence(input: {
  documentType: string;
  investorScore: number;
  periodLabel: string;
  extractionMode: EvidenceManifest["extractionMode"];
}) {
  let score = 0;

  if (input.documentType !== "Other / Review") score += 20;
  score += input.investorScore;
  if (input.periodLabel !== "Period not detected") score += 15;
  if (input.extractionMode === "embedded_text") score += 5;
  if (input.extractionMode === "mixed_text_visual_review") score += 3;

  return Math.min(score, 100);
}

function getStatus(input: {
  confidenceScore: number;
  documentType: string;
  investor: InvestorRecord | null;
  periodLabel: string;
  manifest: EvidenceManifest;
}) {
  if (!input.investor) return "Unmatched" as const;

  if (
    input.manifest.extractionMode === "ocr_required" ||
    input.manifest.extractionMode === "page_limit_review"
  ) {
    return "Review" as const;
  }

  if (input.documentType === "Other / Review") {
    return "Review" as const;
  }

  if (input.periodLabel === "Period not detected") {
    return "Review" as const;
  }

  return input.confidenceScore >= 85 ? ("Ready" as const) : ("Review" as const);
}

async function extractPdfEvidence(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });

  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const reportedTotal = Number(info.total || info.pages?.length || 0);
    const totalPages = Math.max(reportedTotal, 1);
    const parsedPages = Math.min(totalPages, MAX_PDF_PAGES);
    const pageLimitReached = totalPages > MAX_PDF_PAGES;

    const pageEvidence: EvidencePage[] = [];
    const pageTexts: string[] = [];
    const lowTextPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= parsedPages; pageNumber += 1) {
      const pageResult = await parser.getText({ partial: [pageNumber] });
      const pageText = String(pageResult.text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const characterCount = pageText.replace(/\s/g, "").length;
      const textAvailable = characterCount >= LOW_TEXT_PAGE_THRESHOLD;

      pageEvidence.push({
        pageNumber,
        characterCount,
        textAvailable,
      });

      if (!textAvailable) {
        lowTextPages.push(pageNumber);
      }

      pageTexts.push(`--- PAGE ${pageNumber} ---\n${pageText}`);
    }

    const text = pageTexts.join("\n\n").trim();
    const totalCharacters = pageEvidence.reduce(
      (sum, page) => sum + page.characterCount,
      0
    );

    const lowTextRatio =
      parsedPages > 0 ? lowTextPages.length / parsedPages : 1;
    const textIsInsufficient =
      totalCharacters < Math.max(120, parsedPages * 18);

    let extractionMode: EvidenceManifest["extractionMode"] = "embedded_text";

    if (pageLimitReached) {
      extractionMode = "page_limit_review";
    } else if (textIsInsufficient || lowTextRatio >= 0.5) {
      extractionMode = "ocr_required";
    } else if (lowTextPages.length > 0) {
      extractionMode = "mixed_text_visual_review";
    }

    const extractionSignals = [
      `A7.7-2 server-side extraction completed`,
      `A7.7-2 total pages: ${totalPages}`,
      `A7.7-2 parsed pages: ${parsedPages}`,
      `A7.7-2 extraction mode: ${extractionMode}`,
      lowTextPages.length > 0
        ? `A7.7-2 OCR / visual-review candidate pages: ${lowTextPages.join(", ")}`
        : "A7.7-2 embedded text available across parsed pages",
    ];

    if (pageLimitReached) {
      extractionSignals.push(
        `A7.7-2 page safety limit reached at ${MAX_PDF_PAGES} pages; remaining pages require a controlled continuation job`
      );
    }

    const manifest: EvidenceManifest = {
      version: "A7.7-2",
      totalPages,
      parsedPages,
      totalCharacters,
      extractionMode,
      ocrRequiredPages: lowTextPages,
      pageLimitReached,
      pageEvidence,
      quarter: "",
      financialYear: "",
    };

    return {
      text,
      textPreview: text.slice(0, 6000),
      manifest,
      extractionSignals,
    };
  } finally {
    await parser.destroy();
  }
}

async function getFundAccess(
  actor: GovernedFundActor,
  fundName: string
): Promise<GovernedFundOption> {
  const governedFunds = await listGovernedFunds(actor);
  const match = governedFunds.find(
    (fund) =>
      fund.fund_name.trim().toLowerCase() === fundName.trim().toLowerCase()
  );

  if (!match || !match.can_view) {
    throw new Error("FUND_VIEW_ACCESS_REQUIRED");
  }

  return match;
}

function requireManageAccess(access: GovernedFundOption) {
  if (!access.can_edit || !MANAGE_ROLES.has(access.role)) {
    throw new Error("FUND_EDIT_ACCESS_REQUIRED");
  }
}

function requireApproveAccess(access: GovernedFundOption) {
  if (!access.can_approve) {
    throw new Error("FUND_APPROVE_ACCESS_REQUIRED");
  }
}

function accessErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "FUND_VIEW_ACCESS_REQUIRED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED" ||
    message === "FUND_APPROVE_ACCESS_REQUIRED"
  ) {
    return noStoreJson(
      {
        error:
          message === "FUND_APPROVE_ACCESS_REQUIRED"
            ? "You do not have checker / approval access for this fund."
            : message === "FUND_EDIT_ACCESS_REQUIRED"
              ? "Only an authorised Fund Admin or Maker can process or correct PDF Intelligence records."
              : "You do not have governed access to this fund.",
      },
      403
    );
  }

  return governedFundAuthErrorResponse(error);
}

async function loadFundInvestors(fundName: string) {
  const { data, error } = await supabaseAdmin
    .from("investor_master")
    .select("id, investor_code, investor_name, email, tax_id")
    .eq("fund_name", fundName)
    .order("investor_code", { ascending: true });

  if (error) {
    throw new Error(`Unable to load fund investors: ${error.message}`);
  }

  return (data ?? []) as InvestorRecord[];
}

async function loadLatestBatch(fundName: string) {
  const { data, error } = await supabaseAdmin
    .from("pdf_intelligence_batches")
    .select(
      "id, batch_name, fund_name, total_files, ready_files, review_files, unmatched_files, status, created_at, updated_at"
    )
    .eq("fund_name", fundName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load PDF Intelligence batch: ${error.message}`);
  }

  return (data as DataRow | null) ?? null;
}

async function loadBatchDocuments(batchId: string, fundName: string) {
  const { data, error } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .select(
      "id, batch_id, original_file_name, file_size, document_type, matched_investor_id, investor_code, investor_name, email, fund_name, period_label, confidence_score, status, storage_bucket, storage_path, match_signals, extracted_text_preview, created_at, updated_at"
    )
    .eq("batch_id", batchId)
    .eq("fund_name", fundName)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load PDF Intelligence documents: ${error.message}`);
  }

  return (data ?? []) as PdfDocumentRow[];
}

async function publishedStoragePaths(fundName: string, storagePaths: string[]) {
  if (storagePaths.length === 0) return new Set<string>();

  const { data, error } = await supabaseAdmin
    .from("investor_documents")
    .select("storage_path")
    .eq("fund_name", fundName)
    .eq("publish_source", "pdf_intelligence_engine")
    .in("storage_path", storagePaths);

  if (error) {
    throw new Error(`Unable to load published PDF state: ${error.message}`);
  }

  return new Set(
    (data ?? [])
      .map((row) => normalizeText(row.storage_path, 1000))
      .filter(Boolean)
  );
}

function apiDocument(
  row: PdfDocumentRow,
  publishedPaths: Set<string>
) {
  const signals = parseSignals(row.match_signals);
  const evidence = getEvidenceManifest(signals);
  const period = detectPeriod("", row.period_label || "");

  return {
    id: row.id,
    batchId: row.batch_id || "",
    fileName: row.original_file_name || "Unknown PDF",
    fileSize: Number(row.file_size || 0),
    documentType: row.document_type || "Other / Review",
    investorId: row.matched_investor_id || "",
    investorCode: row.investor_code || "-",
    investorName: row.investor_name || "Not matched",
    email: row.email || "-",
    fundName: row.fund_name || "",
    periodLabel: row.period_label || "Period not detected",
    quarter: evidence?.quarter || period.quarter,
    financialYear: evidence?.financialYear || period.financialYear,
    confidenceScore: Number(row.confidence_score || 0),
    status:
      row.status === "Ready" ||
      row.status === "Review" ||
      row.status === "Unmatched" ||
      row.status === "Failed"
        ? row.status
        : "Review",
    storageBucket: row.storage_bucket || "",
    storagePath: row.storage_path || "",
    signals: withoutEvidenceSignal(signals),
    textPreview: row.extracted_text_preview || "",
    evidence: evidence ?? {
      version: "A7.7-2",
      totalPages: 0,
      parsedPages: 0,
      totalCharacters: 0,
      extractionMode: "pending",
      ocrRequiredPages: [],
      pageLimitReached: false,
      pageEvidence: [],
      quarter: period.quarter,
      financialYear: period.financialYear,
    },
    extractionPending: !evidence,
    published: publishedPaths.has(row.storage_path || ""),
    updatedAt: row.updated_at || row.created_at || "",
  };
}

async function updateBatchMetrics(batchId: string) {
  const { data, error } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .select("status")
    .eq("batch_id", batchId);

  if (error) {
    throw new Error(`Unable to refresh PDF batch metrics: ${error.message}`);
  }

  const rows = data ?? [];
  const readyFiles = rows.filter((row) => row.status === "Ready").length;
  const reviewFiles = rows.filter((row) => row.status === "Review").length;
  const unmatchedFiles = rows.filter(
    (row) => row.status === "Unmatched" || row.status === "Failed"
  ).length;

  const { error: updateError } = await supabaseAdmin
    .from("pdf_intelligence_batches")
    .update({
      total_files: rows.length,
      ready_files: readyFiles,
      review_files: reviewFiles,
      unmatched_files: unmatchedFiles,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (updateError) {
    throw new Error(`Unable to update PDF batch metrics: ${updateError.message}`);
  }

  return { readyFiles, reviewFiles, unmatchedFiles, totalFiles: rows.length };
}

async function reprocessDocument(
  row: PdfDocumentRow,
  fundName: string,
  investors: InvestorRecord[]
) {
  const storageBucket = normalizeText(row.storage_bucket, 200);
  const storagePath = normalizeText(row.storage_path, 1000);

  if (!storageBucket || !storagePath) {
    throw new Error("PDF_STORAGE_REFERENCE_MISSING");
  }

  const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
    .from(storageBucket)
    .download(storagePath);

  if (downloadError || !fileBlob) {
    throw new Error(
      `Unable to download private PDF: ${downloadError?.message || "No file returned"}`
    );
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const extraction = await extractPdfEvidence(buffer);

  const classificationText = extraction.text.slice(0, 150000);
  const typeResult = detectDocumentType(
    row.original_file_name || "Unknown PDF",
    classificationText
  );
  const periodResult = detectPeriod(
    row.original_file_name || "Unknown PDF",
    classificationText
  );
  const investorResult = matchInvestor(
    investors,
    row.original_file_name || "Unknown PDF",
    classificationText
  );

  extraction.manifest.quarter = periodResult.quarter;
  extraction.manifest.financialYear = periodResult.financialYear;

  const confidenceScore = calculateConfidence({
    documentType: typeResult.documentType,
    investorScore: investorResult.investorScore,
    periodLabel: periodResult.periodLabel,
    extractionMode: extraction.manifest.extractionMode,
  });

  const status = getStatus({
    confidenceScore,
    documentType: typeResult.documentType,
    investor: investorResult.investor,
    periodLabel: periodResult.periodLabel,
    manifest: extraction.manifest,
  });

  const matchedInvestor = investorResult.investor;
  const signals = [
    ...extraction.extractionSignals,
    ...typeResult.signals,
    ...investorResult.signals,
    ...periodResult.signals,
    `Confidence score: ${confidenceScore}`,
    `${EVIDENCE_PREFIX}${JSON.stringify(extraction.manifest)}`,
  ];

  const { error: updateError } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .update({
      document_type: typeResult.documentType,
      matched_investor_id: matchedInvestor?.id || null,
      investor_code: matchedInvestor?.investor_code || null,
      investor_name: matchedInvestor?.investor_name || null,
      email: matchedInvestor?.email || null,
      fund_name: fundName,
      period_label: periodResult.periodLabel,
      confidence_score: confidenceScore,
      status,
      match_signals: signals,
      extracted_text_preview: extraction.textPreview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("fund_name", fundName);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    id: row.id,
    status,
    extractionMode: extraction.manifest.extractionMode,
  };
}

async function handleReprocess(
  actor: GovernedFundActor,
  access: GovernedFundOption,
  fundName: string,
  body: Record<string, unknown>
) {
  requireManageAccess(access);

  const batch = await loadLatestBatch(fundName);

  if (!batch?.id) {
    return noStoreJson(
      {
        error:
          "No PDF Intelligence batch exists for this fund. Upload PDFs through Data Intake and process the intake batch first.",
      },
      404
    );
  }

  const batchId = String(batch.id);
  const [documents, investors] = await Promise.all([
    loadBatchDocuments(batchId, fundName),
    loadFundInvestors(fundName),
  ]);

  if (documents.length === 0) {
    return noStoreJson(
      {
        error:
          "The latest PDF Intelligence batch has no document records to process.",
      },
      404
    );
  }

  const requestedIds = Array.isArray(body.documentIds)
    ? body.documentIds
        .map((value) => normalizeText(value, 100))
        .filter(Boolean)
    : [];

  const targetDocuments =
    requestedIds.length > 0
      ? documents.filter((document) => requestedIds.includes(document.id))
      : documents.filter((document) => !getEvidenceManifest(parseSignals(document.match_signals)));

  if (targetDocuments.length === 0) {
    return noStoreJson({
      message: "No PDF documents require server-side extraction in this request.",
      batchId,
      processedCount: 0,
      failedCount: 0,
      failures: [],
      metrics: await updateBatchMetrics(batchId),
    });
  }

  if (targetDocuments.length > MAX_DOCUMENTS_PER_PROCESS_REQUEST) {
    return noStoreJson(
      {
        error: `Process at most ${MAX_DOCUMENTS_PER_PROCESS_REQUEST} PDFs per request. The workspace automatically batches larger PDF dumps.`,
      },
      400
    );
  }

  const processed: Array<Record<string, unknown>> = [];
  const failed: Array<{ id: string; fileName: string; error: string }> = [];

  for (const document of targetDocuments) {
    try {
      processed.push(await reprocessDocument(document, fundName, investors));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "PDF extraction failed.";

      failed.push({
        id: document.id,
        fileName: document.original_file_name || "Unknown PDF",
        error: errorMessage,
      });

      const existingSignals = parseSignals(document.match_signals);
      await supabaseAdmin
        .from("pdf_intelligence_documents")
        .update({
          status: "Failed",
          match_signals: [
            ...withoutEvidenceSignal(existingSignals),
            `A7.7-2 server-side extraction failed: ${errorMessage}`,
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id)
        .eq("fund_name", fundName);
    }
  }

  const metrics = await updateBatchMetrics(batchId);

  return noStoreJson({
    message: `A7.7-2 processed ${processed.length} PDF(s) for ${fundName}.`,
    batchId,
    processedCount: processed.length,
    failedCount: failed.length,
    failures: failed,
    metrics,
    actor: {
      userId: actor.userId,
      role: access.role,
    },
  });
}

async function handleReview(
  actor: GovernedFundActor,
  access: GovernedFundOption,
  fundName: string,
  body: Record<string, unknown>
) {
  requireManageAccess(access);

  const documentId = normalizeText(body.documentId, 100);
  const investorId = normalizeText(body.investorId, 100);
  const documentType = normalizeText(body.documentType, 120);
  const periodLabel = normalizeText(body.periodLabel, 120);
  const status = normalizeText(body.status, 40);

  if (!documentId || !investorId || !documentType || !periodLabel) {
    return noStoreJson(
      {
        error:
          "documentId, investorId, documentType and periodLabel are required.",
      },
      400
    );
  }

  if (!["Ready", "Review", "Unmatched"].includes(status)) {
    return noStoreJson({ error: "Invalid review status." }, 400);
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .select("id, batch_id, fund_name, match_signals, confidence_score")
    .eq("id", documentId)
    .eq("fund_name", fundName)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!document) {
    return noStoreJson({ error: "PDF Intelligence document not found." }, 404);
  }

  const { data: investor, error: investorError } = await supabaseAdmin
    .from("investor_master")
    .select("id, investor_code, investor_name, email")
    .eq("id", investorId)
    .eq("fund_name", fundName)
    .maybeSingle();

  if (investorError) {
    throw new Error(investorError.message);
  }

  if (!investor) {
    return noStoreJson(
      { error: "Selected investor is not part of the active governed fund." },
      400
    );
  }

  const existingSignals = parseSignals(document.match_signals);
  const correctedConfidence =
    status === "Ready"
      ? Math.max(Number(document.confidence_score || 0), 85)
      : Number(document.confidence_score || 0);

  const reviewSignals = [
    ...existingSignals,
    `Manual PDF review by ${actor.fullName}`,
    `Corrected investor: ${investor.investor_name || investor.investor_code}`,
    `Corrected document type: ${documentType}`,
    `Corrected period: ${periodLabel}`,
    `Corrected status: ${status}`,
    `Reviewed at: ${new Date().toISOString()}`,
  ];

  const { error: updateError } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .update({
      matched_investor_id: investor.id,
      investor_code: investor.investor_code,
      investor_name: investor.investor_name,
      email: investor.email,
      document_type: documentType,
      period_label: periodLabel,
      confidence_score: correctedConfidence,
      status,
      match_signals: reviewSignals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("fund_name", fundName);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (document.batch_id) {
    await updateBatchMetrics(String(document.batch_id));
  }

  return noStoreJson({
    message: "PDF review correction saved.",
    documentId,
    status,
  });
}

async function handlePublish(
  actor: GovernedFundActor,
  access: GovernedFundOption,
  fundName: string,
  body: Record<string, unknown>
) {
  requireApproveAccess(access);

  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.map((value) => normalizeText(value, 100)).filter(Boolean)
    : [];

  if (documentIds.length === 0) {
    return noStoreJson(
      { error: "Select at least one Ready PDF to publish." },
      400
    );
  }

  const { data: documents, error: documentError } = await supabaseAdmin
    .from("pdf_intelligence_documents")
    .select(
      "id, batch_id, original_file_name, document_type, matched_investor_id, investor_code, investor_name, email, fund_name, period_label, confidence_score, status, storage_bucket, storage_path, match_signals"
    )
    .eq("fund_name", fundName)
    .in("id", documentIds);

  if (documentError) {
    throw new Error(documentError.message);
  }

  const readyDocuments = ((documents ?? []) as PdfDocumentRow[]).filter(
    (document) =>
      document.status === "Ready" &&
      Boolean(document.matched_investor_id) &&
      Boolean(document.storage_bucket) &&
      Boolean(document.storage_path)
  );

  if (readyDocuments.length === 0) {
    return noStoreJson(
      {
        error:
          "No selected PDFs are Ready with a governed investor match and private storage reference.",
      },
      400
    );
  }

  const storagePaths = readyDocuments
    .map((document) => document.storage_path || "")
    .filter(Boolean);

  const existingPublished = await publishedStoragePaths(fundName, storagePaths);
  const toPublish = readyDocuments.filter(
    (document) => !existingPublished.has(document.storage_path || "")
  );

  if (toPublish.length === 0) {
    return noStoreJson({
      message: "Selected Ready PDFs are already published to Investor Portal.",
      publishedCount: 0,
      skippedCount: readyDocuments.length,
    });
  }

  const now = new Date().toISOString();

  const rows = toPublish.map((document) => ({
    // investor_id is the legacy public.investors FK. Governed Investor Portal
    // identity uses investor_master_id.
    investor_id: null,
    investor_master_id: document.matched_investor_id,
    investor_code: document.investor_code,
    investor_name: document.investor_name,
    investor_email: document.email,
    email: document.email,
    organisation_id: actor.organisationId,
    fund_name: fundName,
    document_name:
      document.original_file_name ||
      `${document.document_type || "Investor Document"} - ${
        document.investor_name || document.investor_code || "Investor"
      }`,
    document_type: document.document_type || "Other",
    document_category: getDocumentCategory(document.document_type || "Other"),
    file_name:
      document.original_file_name ||
      cleanStorageName(`${document.id}.pdf`),
    file_url: null,
    storage_url: null,
    storage_bucket: document.storage_bucket,
    storage_path: document.storage_path,
    source: "PDF Intelligence",
    publish_source: "pdf_intelligence_engine",
    migration_status: "Published",
    status: "Published",
    portal_status: "available",
    confidence_score: Number(document.confidence_score || 0),
    period_label: document.period_label,
    pdf_intelligence_batch_id: document.batch_id,
    published_by_user_id: actor.userId,
    published_by_email: actor.email,
    published_by_name: actor.fullName,
    match_signals: [
      ...parseSignals(document.match_signals),
      "Published from governed A7.7 PDF Intelligence",
      "Stored in private Supabase Storage; no permanent public URL",
      `Published by authorised ${access.role}: ${actor.fullName}`,
    ],
    uploaded_at: now,
    published_at: now,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("investor_documents")
    .insert(rows);

  if (insertError) {
    throw new Error(`Unable to publish investor PDFs: ${insertError.message}`);
  }

  return noStoreJson({
    message: `${rows.length} PDF(s) published to Investor Portal.`,
    publishedCount: rows.length,
    skippedCount: readyDocuments.length - rows.length,
  });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const fundName = normalizeText(request.nextUrl.searchParams.get("fundName"), 240);

    if (!fundName) {
      return noStoreJson({ error: "fundName is required." }, 400);
    }

    const access = await getFundAccess(actor, fundName);
    const [batch, investors] = await Promise.all([
      loadLatestBatch(fundName),
      loadFundInvestors(fundName),
    ]);

    if (!batch?.id) {
      return noStoreJson({
        fundName,
        access,
        batch: null,
        investors,
        documents: [],
        summary: {
          total: 0,
          ready: 0,
          review: 0,
          unmatched: 0,
          extractionPending: 0,
          ocrRequired: 0,
          published: 0,
        },
      });
    }

    const documents = await loadBatchDocuments(String(batch.id), fundName);
    const storagePaths = documents
      .map((document) => document.storage_path || "")
      .filter(Boolean);
    const publishedPaths = await publishedStoragePaths(fundName, storagePaths);
    const apiDocuments = documents.map((row) => apiDocument(row, publishedPaths));

    return noStoreJson({
      fundName,
      access,
      batch,
      investors,
      documents: apiDocuments,
      summary: {
        total: apiDocuments.length,
        ready: apiDocuments.filter((document) => document.status === "Ready").length,
        review: apiDocuments.filter((document) => document.status === "Review").length,
        unmatched: apiDocuments.filter(
          (document) =>
            document.status === "Unmatched" || document.status === "Failed"
        ).length,
        extractionPending: apiDocuments.filter(
          (document) => document.extractionPending
        ).length,
        ocrRequired: apiDocuments.filter(
          (document) => document.evidence.extractionMode === "ocr_required"
        ).length,
        published: apiDocuments.filter((document) => document.published).length,
      },
    });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load governed PDF Intelligence.",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = normalizeText(body.action, 80);
    const fundName = normalizeText(body.fundName, 240);

    if (!fundName) {
      return noStoreJson({ error: "fundName is required." }, 400);
    }

    const access = await getFundAccess(actor, fundName);

    if (action === "reprocess_latest") {
      return handleReprocess(actor, access, fundName, body);
    }

    if (action === "review") {
      return handleReview(actor, access, fundName, body);
    }

    if (action === "publish") {
      return handlePublish(actor, access, fundName, body);
    }

    return noStoreJson({ error: "Unsupported PDF Intelligence action." }, 400);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process governed PDF Intelligence action.",
      },
      500
    );
  }
}
