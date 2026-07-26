"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type InvestorRecord = {
  id: string;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  tax_id: string | null;
  fund_name?: string | null;
};

type PdfResult = {
  id: string;
  batchId: string;
  pdfDocumentId: string;
  fileName: string;
  fileSize: number;
  documentType: string;
  investorId: string;
  investorCode: string;
  investorName: string;
  email: string;
  periodLabel: string;
  confidenceScore: number;
  status: "Ready" | "Review" | "Unmatched" | "Failed";
  storagePath: string;
  signals: string[];
  textPreview: string;
  published: boolean;
};

type PdfTextItem = {
  str?: string;
};

type ReviewDraft = {
  investorId: string;
  documentType: string;
  periodLabel: string;
  status: "Ready" | "Review" | "Unmatched";
};
type PdfIntelligenceDocumentRow = {
  id: string;
  batch_id: string | null;
  original_file_name: string | null;
  file_size: number | string | null;
  document_type: string | null;
  matched_investor_id: string | null;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  period_label: string | null;
  confidence_score: number | string | null;
  status: string | null;
  storage_path: string | null;
  match_signals: unknown;
  extracted_text_preview: string | null;
};
type DeficiencyStatus = "Available" | "Missing" | "Duplicate" | "Review";

type DeficiencyRow = {
  investorId: string;
  investorCode: string;
  investorName: string;
  documentType: string;
  periodLabel: string;
  status: DeficiencyStatus;
  matchedCount: number;
};

const DOCUMENT_TYPE_OPTIONS = [
  "SOA / Account Statement",
  "Capital Call Notice",
  "Distribution Notice",
  "IRR Statement",
  "Tax Document",
  "Portfolio Report",
  "Fund Report",
  "Other / Review",
];

const REVIEW_STATUS_OPTIONS: ReviewDraft["status"][] = [
  "Ready",
  "Review",
  "Unmatched",
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
function parseMatchSignals(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string" && value.trim()) {
    return [value];
  }

  return [];
}

function normalizePdfStatus(
  status: string | null
): PdfResult["status"] {
  if (
    status === "Ready" ||
    status === "Review" ||
    status === "Unmatched" ||
    status === "Failed"
  ) {
    return status;
  }

  return "Review";
}
function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectDocumentType(fileName: string, pdfText: string) {
  const combined = normalize(`${fileName} ${pdfText}`);
  const signals: string[] = [];

  if (
    combined.includes("capital call") ||
    combined.includes("drawdown notice") ||
    combined.includes("capital contribution notice") ||
    combined.includes("drawdown")
  ) {
    signals.push("Capital call keyword found");
    return { documentType: "Capital Call Notice", signals };
  }

  if (
    combined.includes("distribution notice") ||
    combined.includes("distribution statement") ||
    combined.includes("payout") ||
    combined.includes("amount distributed")
  ) {
    signals.push("Distribution keyword found");
    return { documentType: "Distribution Notice", signals };
  }

  if (
    combined.includes("irr statement") ||
    combined.includes("internal rate of return") ||
    combined.includes("investor irr") ||
    combined.includes("net irr")
  ) {
    signals.push("IRR keyword found");
    return { documentType: "IRR Statement", signals };
  }

  if (
    combined.includes("statement of account") ||
    combined.includes("soa") ||
    combined.includes("account statement") ||
    combined.includes("capital account statement")
  ) {
    signals.push("SOA keyword found");
    return { documentType: "SOA / Account Statement", signals };
  }

  if (
    combined.includes("form 64c") ||
    combined.includes("form 64d") ||
    combined.includes("tax certificate") ||
    combined.includes("tds") ||
    combined.includes("income tax")
  ) {
    signals.push("Tax keyword found");
    return { documentType: "Tax Document", signals };
  }

  if (
    combined.includes("portfolio update") ||
    combined.includes("portfolio report") ||
    combined.includes("valuation report") ||
    combined.includes("portfolio company")
  ) {
    signals.push("Portfolio keyword found");
    return { documentType: "Portfolio Report", signals };
  }

  if (
    combined.includes("quarterly report") ||
    combined.includes("fund report") ||
    combined.includes("fund performance")
  ) {
    signals.push("Fund report keyword found");
    return { documentType: "Fund Report", signals };
  }

  signals.push("No strong document type keyword found");
  return { documentType: "Other / Review", signals };
}

function detectPeriod(fileName: string, pdfText: string) {
  const combined = normalize(`${fileName} ${pdfText}`);
  const signals: string[] = [];

  const quarterMatch = combined.match(
    /(q[1-4])\s*(fy)?\s*([0-9]{2}|[0-9]{4})/i
  );

  if (quarterMatch) {
    const label = quarterMatch[0].toUpperCase().replace(/\s+/g, " ");
    signals.push(`Period detected: ${label}`);
    return { periodLabel: label, signals };
  }

  const fyMatch = combined.match(/fy\s*([0-9]{2}|[0-9]{4})/i);

  if (fyMatch) {
    const label = fyMatch[0].toUpperCase().replace(/\s+/g, " ");
    signals.push(`Financial year detected: ${label}`);
    return { periodLabel: label, signals };
  }

  const quarterEndedMatch = combined.match(
    /(quarter ended|period ended|for the quarter ended)\s+[a-z]+\s+[0-9]{1,2},?\s+[0-9]{4}/i
  );

  if (quarterEndedMatch) {
    signals.push("Quarter ended date detected");
    return { periodLabel: quarterEndedMatch[0], signals };
  }

  const monthYearMatch = combined.match(
    /(march|june|september|december|jan|feb|apr|may|jul|aug|oct|nov)\s+[0-9]{4}/i
  );

  if (monthYearMatch) {
    const label = monthYearMatch[0].replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
    signals.push(`Month/year detected: ${label}`);
    return { periodLabel: label, signals };
  }

  signals.push("No period detected");
  return { periodLabel: "Period not detected", signals };
}

function calculateNameMatchScore(investorName: string, combinedText: string) {
  const normalizedName = normalize(investorName);

  if (!normalizedName) return 0;

  if (combinedText.includes(normalizedName)) {
    return 30;
  }

  const tokens = normalizedName
    .split(" ")
    .filter((token) => token.length > 2);

  if (tokens.length === 0) return 0;

  const matchedTokens = tokens.filter((token) => combinedText.includes(token));

  if (matchedTokens.length >= Math.ceil(tokens.length * 0.7)) {
    return 22;
  }

  if (matchedTokens.length >= Math.ceil(tokens.length * 0.5)) {
    return 14;
  }

  return 0;
}

function matchInvestor(
  investors: InvestorRecord[],
  fileName: string,
  pdfText: string
): {
  investor: InvestorRecord | null;
  investorScore: number;
  signals: string[];
} {
  const combinedText = normalize(`${fileName} ${pdfText}`);

  let bestInvestor: InvestorRecord | null = null;
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const investor of investors) {
    const signals: string[] = [];
    let score = 0;

    const investorCode = investor.investor_code
      ? normalize(investor.investor_code)
      : "";

    const investorName = investor.investor_name
      ? normalize(investor.investor_name)
      : "";

    const email = investor.email ? normalize(investor.email) : "";
    const taxId = investor.tax_id ? normalize(investor.tax_id) : "";

    if (investorCode && combinedText.includes(investorCode)) {
      score += 35;
      signals.push(`Investor code matched: ${investor.investor_code}`);
    }

    if (email && combinedText.includes(email)) {
      score += 25;
      signals.push(`Email matched: ${investor.email}`);
    }

    if (taxId && combinedText.includes(taxId)) {
      score += 25;
      signals.push("Tax ID matched");
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

  return {
    investor: bestInvestor,
    investorScore: Math.min(bestScore, 60),
    signals: bestSignals.length ? bestSignals : ["No investor match found"],
  };
}

function calculateConfidence(params: {
  documentType: string;
  investorScore: number;
  periodLabel: string;
}) {
  let score = 0;

  if (params.documentType !== "Other / Review") {
    score += 25;
  }

  score += params.investorScore;

  if (params.periodLabel !== "Period not detected") {
    score += 15;
  }

  return Math.min(score, 100);
}

function getStatus(confidenceScore: number, documentType: string) {
  if (documentType === "Other / Review" && confidenceScore < 60) {
    return "Unmatched" as const;
  }

  if (confidenceScore >= 85) {
    return "Ready" as const;
  }

  if (confidenceScore >= 60) {
    return "Review" as const;
  }

  return "Unmatched" as const;
}

function getDocumentCategory(documentType: string) {
  if (documentType.includes("SOA") || documentType.includes("Account")) {
    return "SOA";
  }

  if (documentType.includes("Capital Call")) {
    return "Capital Call Notice";
  }

  if (documentType.includes("Distribution")) {
    return "Distribution Notice";
  }

  if (documentType.includes("IRR")) {
    return "IRR Statement";
  }

  if (documentType.includes("Tax")) {
    return "Tax Document";
  }

  if (documentType.includes("Portfolio")) {
    return "Portfolio Report";
  }

  if (documentType.includes("Fund")) {
    return "Fund Report";
  }

  return "Other";
}
function documentTypeMatches(actualDocumentType: string, expectedDocumentType: string) {
  return (
    actualDocumentType === expectedDocumentType ||
    getDocumentCategory(actualDocumentType) ===
      getDocumentCategory(expectedDocumentType)
  );
}

function periodMatches(actualPeriod: string, expectedPeriod: string) {
  if (!expectedPeriod.trim()) return true;

  if (!actualPeriod || actualPeriod === "Period not detected") {
    return false;
  }

  const actual = normalize(actualPeriod);
  const expected = normalize(expectedPeriod);

  return actual.includes(expected) || expected.includes(actual);
}

async function extractPdfText(file: File) {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  const maxPages = Math.min(pdf.numPages, 8);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => {
        const textItem = item as PdfTextItem;
        return textItem.str ?? "";
      })
      .join(" ");

    pageTexts.push(pageText);
  }

  return pageTexts.join(" ").replace(/\s+/g, " ").trim();
}

export default function PdfIntelligencePage() {
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [results, setResults] = useState<PdfResult[]>([]);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>(
    {}
  );
  const [loadingLatestBatch, setLoadingLatestBatch] = useState(false);
const [activeBatchName, setActiveBatchName] = useState("");
const [resetFounderKey, setResetFounderKey] = useState("");
const [resetConfirmation, setResetConfirmation] = useState("");
const [resetMessage, setResetMessage] = useState("");
const [resettingData, setResettingData] = useState(false);
const [showResetPanel, setShowResetPanel] = useState(false);
const [deficiencyPeriod, setDeficiencyPeriod] = useState("Q4 FY26");
const [deficiencyDocumentTypes, setDeficiencyDocumentTypes] = useState<
  string[]
>(["SOA / Account Statement"]);

  useEffect(() => {
    async function loadInvestors() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured.");
        setLoadingInvestors(false);
        return;
      }

      const { data, error } = await supabase
        .from("investor_master")
        .select("id, investor_code, investor_name, email, tax_id")
        .order("investor_code", { ascending: true });

      if (error) {
        setMessage(error.message);
        setLoadingInvestors(false);
        return;
      }

      setInvestors((data as InvestorRecord[]) ?? []);
      setLoadingInvestors(false);
    }

    loadInvestors();
  }, []);
  useEffect(() => {
  loadLatestPdfIntelligenceBatch();
}, []);

  const metrics = useMemo(() => {
    return {
      total: results.length,
      ready: results.filter((result) => result.status === "Ready").length,
      review: results.filter((result) => result.status === "Review").length,
      unmatched: results.filter((result) => result.status === "Unmatched")
        .length,
      failed: results.filter((result) => result.status === "Failed").length,
    };
  }, [results]);

  const reviewQueue = useMemo(() => {
    return results.filter(
      (result) =>
        !result.published &&
        result.status !== "Failed" &&
        (result.status !== "Ready" ||
          !result.investorId ||
          result.documentType === "Other / Review" ||
          result.periodLabel === "Period not detected")
    );
  }, [results]);
  const deficiencyRows = useMemo<DeficiencyRow[]>(() => {
  if (investors.length === 0 || deficiencyDocumentTypes.length === 0) {
    return [];
  }

  return investors.flatMap((investor) =>
    deficiencyDocumentTypes.map((documentType) => {
      const matchingDocuments = results.filter(
        (result) =>
          result.investorId === investor.id &&
          result.status !== "Failed" &&
          documentTypeMatches(result.documentType, documentType) &&
          periodMatches(result.periodLabel, deficiencyPeriod)
      );

      let status: DeficiencyStatus = "Missing";

      if (matchingDocuments.length > 1) {
        status = "Duplicate";
      } else if (
        matchingDocuments.length === 1 &&
        matchingDocuments[0].status === "Ready"
      ) {
        status = "Available";
      } else if (matchingDocuments.length === 1) {
        status = "Review";
      }

      return {
        investorId: investor.id,
        investorCode: investor.investor_code ?? "-",
        investorName: investor.investor_name ?? "Unknown Investor",
        documentType,
        periodLabel: deficiencyPeriod,
        status,
        matchedCount: matchingDocuments.length,
      };
    })
  );
}, [deficiencyDocumentTypes, deficiencyPeriod, investors, results]);

const deficiencyMetrics = useMemo(() => {
  const totalExpected = deficiencyRows.length;
  const available = deficiencyRows.filter(
    (row) => row.status === "Available"
  ).length;
  const missing = deficiencyRows.filter((row) => row.status === "Missing").length;
  const duplicate = deficiencyRows.filter(
    (row) => row.status === "Duplicate"
  ).length;
  const review = deficiencyRows.filter((row) => row.status === "Review").length;

  const coverage = totalExpected
    ? Math.round((available / totalExpected) * 100)
    : 0;

  return {
    totalExpected,
    available,
    missing,
    duplicate,
    review,
    coverage,
  };
}, [deficiencyRows]);

const deficiencyExceptionRows = useMemo(() => {
  return deficiencyRows.filter((row) => row.status !== "Available");
}, [deficiencyRows]);
const investorDeficiencyGroups = useMemo(() => {
  const groups = new Map<
    string,
    {
      investorId: string;
      investorCode: string;
      investorName: string;
      rows: DeficiencyRow[];
      missing: number;
      review: number;
      duplicate: number;
    }
  >();

  deficiencyExceptionRows.forEach((row) => {
    const key = row.investorCode || row.investorId;

    const existingGroup =
      groups.get(key) ??
      {
        investorId: row.investorId,
        investorCode: row.investorCode,
        investorName: row.investorName,
        rows: [],
        missing: 0,
        review: 0,
        duplicate: 0,
      };

    existingGroup.rows.push(row);

    if (row.status === "Missing") existingGroup.missing += 1;
    if (row.status === "Review") existingGroup.review += 1;
    if (row.status === "Duplicate") existingGroup.duplicate += 1;

    groups.set(key, existingGroup);
  });

  return Array.from(groups.values());
}, [deficiencyExceptionRows]);
async function loadLatestPdfIntelligenceBatch() {
  if (!isSupabaseConfigured || !supabase) {
    setMessage("Supabase is not configured.");
    return;
  }

  setLoadingLatestBatch(true);
  setPublishMessage("");

  const { data: batchData, error: batchError } = await supabase
    .from("pdf_intelligence_batches")
    .select("id, batch_name")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (batchError) {
    setMessage(batchError.message);
    setLoadingLatestBatch(false);
    return;
  }

  if (!batchData) {
    setMessage("No PDF intelligence batch found yet.");
    setLoadingLatestBatch(false);
    return;
  }

  const batchId = batchData.id as string;
  const batchName = (batchData.batch_name as string) ?? "Latest PDF batch";

  const { data: documentData, error: documentError } = await supabase
    .from("pdf_intelligence_documents")
    .select(
      "id, batch_id, original_file_name, file_size, document_type, matched_investor_id, investor_code, investor_name, email, period_label, confidence_score, status, storage_path, match_signals, extracted_text_preview"
    )
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  if (documentError) {
    setMessage(documentError.message);
    setLoadingLatestBatch(false);
    return;
  }

  const documentRows =
    (documentData as PdfIntelligenceDocumentRow[] | null) ?? [];

  const storagePaths = documentRows
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));

  let publishedStoragePaths = new Set<string>();

  if (storagePaths.length > 0) {
    const { data: publishedData } = await supabase
      .from("investor_documents")
      .select("storage_path")
      .in("storage_path", storagePaths);

    publishedStoragePaths = new Set(
      ((publishedData as Array<{ storage_path: string | null }> | null) ?? [])
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path))
    );
  }

  const loadedResults: PdfResult[] = documentRows.map((row) => {
    const fileName = row.original_file_name ?? "Unknown PDF";
    const storagePath = row.storage_path ?? "-";
    const signals = parseMatchSignals(row.match_signals);

    return {
      id: `${row.id}-${fileName}`,
      batchId,
      pdfDocumentId: row.id,
      fileName,
      fileSize: Number(row.file_size ?? 0),
      documentType: row.document_type ?? "Other / Review",
      investorId: row.matched_investor_id ?? "",
      investorCode: row.investor_code ?? "-",
      investorName: row.investor_name ?? "Not matched",
      email: row.email ?? "-",
      periodLabel: row.period_label ?? "Period not detected",
      confidenceScore: Number(row.confidence_score ?? 0),
      status: normalizePdfStatus(row.status),
      storagePath,
      signals: signals.length ? signals : ["Loaded from saved PDF intelligence batch"],
      textPreview: row.extracted_text_preview ?? "",
      published: publishedStoragePaths.has(storagePath),
    };
  });

  setResults(loadedResults);
  setReviewDrafts({});
  setActiveBatchName(batchName);
  setMessage(
    `${loadedResults.length} PDF intelligence record(s) loaded from latest batch.`
  );
  setLoadingLatestBatch(false);
}
  async function handlePdfUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setProcessing(true);
    setMessage("Processing PDF dump...");
    setPublishMessage("");

    const selectedFiles = Array.from(fileList).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );

    if (selectedFiles.length === 0) {
      setMessage("No PDF files selected.");
      setProcessing(false);
      return;
    }

    const batchName = `PDF Intelligence Batch - ${new Date().toLocaleString()}`;

    const { data: batchData, error: batchError } = await supabase
      .from("pdf_intelligence_batches")
      .insert({
        batch_name: batchName,
        fund_name: "VENTIQ Growth Fund II",
        total_files: selectedFiles.length,
        status: "processing",
      })
      .select("id")
      .single();

    if (batchError || !batchData) {
      setMessage(batchError?.message ?? "Unable to create PDF batch.");
      setProcessing(false);
      return;
    }

    const batchId = batchData.id as string;
    const processedResults: PdfResult[] = [];

    for (const file of selectedFiles) {
      try {
        const pdfText = await extractPdfText(file);
        const textPreview = pdfText.slice(0, 800);

        const typeResult = detectDocumentType(file.name, pdfText);
        const periodResult = detectPeriod(file.name, pdfText);
        const investorResult = matchInvestor(investors, file.name, pdfText);

        const confidenceScore = calculateConfidence({
          documentType: typeResult.documentType,
          investorScore: investorResult.investorScore,
          periodLabel: periodResult.periodLabel,
        });

        const status = getStatus(confidenceScore, typeResult.documentType);

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${batchId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("investor-pdf-dump")
          .upload(storagePath, file, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const matchedInvestor = investorResult.investor;

        const signals = [
          ...typeResult.signals,
          ...investorResult.signals,
          ...periodResult.signals,
          `Confidence score: ${confidenceScore}`,
        ];

        const { data: insertedDocumentData, error: insertError } =
          await supabase
            .from("pdf_intelligence_documents")
            .insert({
              batch_id: batchId,
              original_file_name: file.name,
              storage_bucket: "investor-pdf-dump",
              storage_path: storagePath,
              file_size: file.size,
              document_type: typeResult.documentType,
              matched_investor_id: matchedInvestor?.id ?? null,
              investor_code: matchedInvestor?.investor_code ?? null,
              investor_name: matchedInvestor?.investor_name ?? null,
              email: matchedInvestor?.email ?? null,
              fund_name: "VENTIQ Growth Fund II",
              period_label: periodResult.periodLabel,
              confidence_score: confidenceScore,
              status,
              match_signals: signals,
              extracted_text_preview: textPreview,
            })
            .select("id")
            .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        processedResults.push({
          id: `${file.name}-${file.lastModified}`,
          batchId,
          pdfDocumentId: (insertedDocumentData?.id as string) ?? "",
          fileName: file.name,
          fileSize: file.size,
          documentType: typeResult.documentType,
          investorId: matchedInvestor?.id ?? "",
          investorCode: matchedInvestor?.investor_code ?? "-",
          investorName: matchedInvestor?.investor_name ?? "Not matched",
          email: matchedInvestor?.email ?? "-",
          periodLabel: periodResult.periodLabel,
          confidenceScore,
          status,
          storagePath,
          signals,
          textPreview,
          published: false,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "PDF processing failed";

        processedResults.push({
          id: `${file.name}-${file.lastModified}`,
          batchId,
          pdfDocumentId: "",
          fileName: file.name,
          fileSize: file.size,
          documentType: "Failed",
          investorId: "",
          investorCode: "-",
          investorName: "Not processed",
          email: "-",
          periodLabel: "-",
          confidenceScore: 0,
          status: "Failed",
          storagePath: "-",
          signals: [errorMessage],
          textPreview: "",
          published: false,
        });
      }
    }

    const readyFiles = processedResults.filter(
      (result) => result.status === "Ready"
    ).length;

    const reviewFiles = processedResults.filter(
      (result) => result.status === "Review"
    ).length;

    const unmatchedFiles = processedResults.filter(
      (result) => result.status === "Unmatched" || result.status === "Failed"
    ).length;

    await supabase
      .from("pdf_intelligence_batches")
      .update({
        ready_files: readyFiles,
        review_files: reviewFiles,
        unmatched_files: unmatchedFiles,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    setResults((current) => [...processedResults, ...current]);
setActiveBatchName(batchName);
setMessage(`${processedResults.length} PDF file(s) processed.`);
setProcessing(false);
  }

  async function publishReadyDocumentsToPortal() {
    if (!isSupabaseConfigured || !supabase) {
      setPublishMessage("Supabase is not configured.");
      return;
    }

    const publishableResults = results.filter(
      (result) =>
        result.status === "Ready" &&
        result.investorId &&
        result.storagePath &&
        result.storagePath !== "-" &&
        !result.published
    );

    if (publishableResults.length === 0) {
      setPublishMessage(
        "No unpublished Ready PDFs available for portal publishing."
      );
      return;
    }

    setPublishing(true);
    setPublishMessage("Publishing Ready PDFs to Investor Portal...");

    const rows: Array<Record<string, unknown>> = [];

    for (const result of publishableResults) {
      const { data: signedUrlData } = await supabase.storage
        .from("investor-pdf-dump")
        .createSignedUrl(result.storagePath, 60 * 60 * 24 * 7);

      rows.push({
        investor_id: result.investorId,
        investor_code: result.investorCode === "-" ? null : result.investorCode,
        investor_name:
          result.investorName === "Not matched" ? null : result.investorName,
        email: result.email === "-" ? null : result.email,
        fund_name: "VENTIQ Growth Fund II",
        document_name: result.fileName,
        document_type: result.documentType,
        document_category: getDocumentCategory(result.documentType),
        file_name: result.fileName,
        file_url: signedUrlData?.signedUrl ?? result.storagePath,
        storage_bucket: "investor-pdf-dump",
        storage_path: result.storagePath,
        source: "pdf_intelligence_engine",
        publish_source: "pdf_intelligence_engine",
        migration_batch_id: result.batchId,
        pdf_intelligence_batch_id: result.batchId,
        migration_status: "Published",
        status: "Published",
        confidence_score: result.confidenceScore,
        period_label: result.periodLabel,
        match_signals: result.signals,
        uploaded_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      });
    }

    const { error } = await supabase.from("investor_documents").insert(rows);

    if (error) {
      setPublishMessage(error.message);
      setPublishing(false);
      return;
    }

    const publishedIds = new Set(publishableResults.map((result) => result.id));

    setResults((current) =>
      current.map((result) =>
        publishedIds.has(result.id) ? { ...result, published: true } : result
      )
    );

    setPublishMessage(
      `${publishableResults.length} Ready PDF(s) published to Investor Portal.`
    );

    setPublishing(false);
  }
  async function resetPriorMigrationData() {
  setResetMessage("");

  if (!resetFounderKey.trim()) {
    setResetMessage("Enter founder key before deleting prior migration data.");
    return;
  }

  if (resetConfirmation !== "RESET VENTIQ DATA") {
    setResetMessage("Type RESET VENTIQ DATA exactly to confirm deletion.");
    return;
  }

  setResettingData(true);
  setResetMessage("Deleting prior migration data. Please wait...");

  try {
    const response = await fetch("/api/migration/reset-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-founder-key": resetFounderKey,
      },
      body: JSON.stringify({
        confirmation: resetConfirmation,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to delete prior migration data.");
    }

    setResults([]);
    setReviewDrafts({});
    setActiveBatchName("");
    setMessage("Prior migration data deleted. You can upload a fresh dataset.");
    setPublishMessage("");
    setResetMessage(
      "Prior migration data deleted successfully. Go back to Data Intake and upload the new full dataset."
    );
    setResetConfirmation("");
  } catch (error) {
    setResetMessage(
      error instanceof Error
        ? error.message
        : "Unable to delete prior migration data."
    );
  } finally {
    setResettingData(false);
  }
}
function toggleDeficiencyDocumentType(documentType: string) {
  setDeficiencyDocumentTypes((current) => {
    if (current.includes(documentType)) {
      const updated = current.filter((type) => type !== documentType);
      return updated.length > 0 ? updated : current;
    }

    return [...current, documentType];
  });
}
  function getReviewDraft(result: PdfResult): ReviewDraft {
    return (
      reviewDrafts[result.id] ?? {
        investorId: result.investorId,
        documentType: result.documentType,
        periodLabel:
          result.periodLabel === "Period not detected" ? "" : result.periodLabel,
        status:
          result.status === "Ready" || result.status === "Review"
            ? result.status
            : "Review",
      }
    );
  }

  function updateReviewDraft(
    resultId: string,
    partialDraft: Partial<ReviewDraft>
  ) {
    setReviewDrafts((current) => {
      const existingDraft = current[resultId] ?? {
        investorId: "",
        documentType: "Other / Review",
        periodLabel: "",
        status: "Review" as const,
      };

      return {
        ...current,
        [resultId]: {
          ...existingDraft,
          ...partialDraft,
        },
      };
    });
  }

  async function saveReviewCorrection(result: PdfResult) {
    if (!isSupabaseConfigured || !supabase) {
      setPublishMessage("Supabase is not configured.");
      return;
    }

    const draft = getReviewDraft(result);
    const selectedInvestor = investors.find(
      (investor) => investor.id === draft.investorId
    );

    if (!selectedInvestor) {
      setPublishMessage("Please select an investor before saving correction.");
      return;
    }

    if (!draft.documentType) {
      setPublishMessage("Please select a document type before saving correction.");
      return;
    }

    if (!draft.periodLabel.trim()) {
      setPublishMessage("Please enter period before saving correction.");
      return;
    }

    const correctedConfidence =
      draft.status === "Ready"
        ? Math.max(result.confidenceScore, 85)
        : result.confidenceScore;

    const correctedSignals = [
      ...result.signals,
      "Manual review correction applied",
      `Corrected investor: ${selectedInvestor.investor_name}`,
      `Corrected document type: ${draft.documentType}`,
      `Corrected period: ${draft.periodLabel}`,
      `Corrected status: ${draft.status}`,
    ];

    if (result.pdfDocumentId) {
      const { error } = await supabase
        .from("pdf_intelligence_documents")
        .update({
          document_type: draft.documentType,
          matched_investor_id: selectedInvestor.id,
          investor_code: selectedInvestor.investor_code,
          investor_name: selectedInvestor.investor_name,
          email: selectedInvestor.email,
          period_label: draft.periodLabel,
          confidence_score: correctedConfidence,
          status: draft.status,
          match_signals: correctedSignals,
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.pdfDocumentId);

      if (error) {
        setPublishMessage(error.message);
        return;
      }
    }

    setResults((current) =>
      current.map((currentResult) =>
        currentResult.id === result.id
          ? {
              ...currentResult,
              documentType: draft.documentType,
              investorId: selectedInvestor.id,
              investorCode: selectedInvestor.investor_code ?? "-",
              investorName: selectedInvestor.investor_name ?? "Not matched",
              email: selectedInvestor.email ?? "-",
              periodLabel: draft.periodLabel,
              confidenceScore: correctedConfidence,
              status: draft.status,
              signals: correctedSignals,
            }
          : currentResult
      )
    );

    setPublishMessage(
      "Correction saved. If status is Ready, this PDF can now be published to Investor Portal."
    );
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ PDF Intelligence</p>
            <h1>PDF Dump Sorting Engine</h1>
            <p>
              Upload actual PDFs. VENTIQ reads the filename, extracts internal
              PDF text, detects document type, matches investors, detects period
              and assigns confidence before publishing.
            </p>
          </div>

          <a className="back-link" href="/migration/data-intake">
            Back to Data Intake
          </a>
        </div>

        <div className="sample-data-ribbon">
          Actual PDF upload · Text extraction · Investor matching · Confidence
          scoring
        </div>
        <div className="preview-card">
  <div className="section-heading-row">
    <div>
      <p className="eyebrow">Founder Control</p>
      <h2>Reset migration data before a fresh upload</h2>
    </div>

    <button
      className="monitor-btn monitor-btn-secondary"
      onClick={() => setShowResetPanel((current) => !current)}
      type="button"
    >
      {showResetPanel ? "Hide Reset Panel" : "Delete Prior Data"}
    </button>
  </div>

  <div className="explain-box">
    Use this only when you want to remove prior uploaded migration data,
    processed investor records, PDF intelligence batches, portfolio data,
    fund data and compliance data before uploading a fresh full dataset.
    Walkthrough leads will not be deleted.
  </div>

  {showResetPanel && (
    <div className="demo-form-grid">
      <label>
        Founder Key
        <input
          placeholder="Enter founder key"
          type="password"
          value={resetFounderKey}
          onChange={(event) => setResetFounderKey(event.target.value)}
        />
      </label>

      <label>
        Confirmation Text
        <input
          placeholder="Type RESET VENTIQ DATA"
          value={resetConfirmation}
          onChange={(event) => setResetConfirmation(event.target.value)}
        />
      </label>

      <div className="action-row">
        <button
          className="monitor-btn monitor-btn-primary"
          disabled={resettingData}
          onClick={resetPriorMigrationData}
          type="button"
        >
          {resettingData ? "Deleting Prior Data..." : "Confirm Delete Prior Data"}
        </button>
      </div>
    </div>
  )}

  {resetMessage && <div className="logic-note">{resetMessage}</div>}
</div>
        <div className="persistence-panel">
  <div>
    <span>Saved batch workspace</span>
    <strong>{activeBatchName || "No saved batch loaded"}</strong>
    <p>
      Reload the latest saved PDF Intelligence batch from Supabase and continue
      review, correction, deficiency tracking and portal publishing after
      refresh.
    </p>
  </div>

  <button
    className="publish-secondary-button"
    disabled={loadingLatestBatch}
    onClick={loadLatestPdfIntelligenceBatch}
    type="button"
  >
    {loadingLatestBatch ? "Loading latest batch..." : "Load Latest Batch"}
  </button>
</div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{investors.length}</h3>
            <p>Investors available for matching</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.total}</h3>
            <p>PDFs processed</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.ready}</h3>
            <p>Auto-sort ready</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.review + metrics.unmatched + metrics.failed}</h3>
            <p>Review / unmatched</p>
          </div>
        </div>

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">PDF Upload Workspace</p>
              <h2>Upload Investor PDF Dump</h2>
            </div>

            <span className="status-pill">No template required</span>
          </div>

          <div className="explain-box">
            Upload SOAs, IRR statements, distribution notices, capital call
            notices, tax documents and fund reports. VENTIQ will inspect both
            the filename and the internal PDF text before sorting.
          </div>

          <label className="upload-dropzone">
            <input
              accept=".pdf"
              disabled={processing || loadingInvestors}
              multiple
              onChange={(event) => handlePdfUpload(event.target.files)}
              type="file"
            />

            <span className="upload-icon">↑</span>
            <strong>Choose PDF dump</strong>
            <small>
              Upload one or many investor PDFs. VENTIQ will extract text,
              classify documents, match investors and calculate confidence.
            </small>
          </label>

          {message && <div className="logic-note">{message}</div>}

          {loadingInvestors && (
            <div className="logic-note">Loading investor master...</div>
          )}

          {processing && (
            <div className="logic-note">
              Processing files. For large PDF dumps, this may take time.
            </div>
          )}
        </div>
<div className="preview-card">
  <div className="section-heading-row">
    <div>
      <p className="eyebrow">Deficiency & Coverage Tracker</p>
      <h2>Find missing investor documents</h2>
    </div>

    <span className="status-pill">{deficiencyMetrics.coverage}% covered</span>
  </div>

  <div className="explain-box">
    VENTIQ compares expected investor documents against uploaded and sorted PDFs.
    This helps the fund team identify missing SOAs, IRR statements, capital call
    notices, distribution notices and tax documents before publishing the portal.
  </div>

  <div className="deficiency-controls">
    <label>
      Period to check
      <input
        placeholder="Example: Q4 FY26"
        value={deficiencyPeriod}
        onChange={(event) => setDeficiencyPeriod(event.target.value)}
      />
    </label>

    <div>
      <span>Documents expected</span>

      <div className="deficiency-toggle-grid">
        {DOCUMENT_TYPE_OPTIONS.filter(
          (documentType) => documentType !== "Other / Review"
        ).map((documentType) => (
          <button
            className={
              deficiencyDocumentTypes.includes(documentType)
                ? "deficiency-toggle active"
                : "deficiency-toggle"
            }
            key={documentType}
            onClick={() => toggleDeficiencyDocumentType(documentType)}
            type="button"
          >
            {documentType}
          </button>
        ))}
      </div>
    </div>
  </div>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>{deficiencyMetrics.totalExpected}</h3>
      <p>Expected records</p>
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
      <h3>{deficiencyMetrics.review + deficiencyMetrics.duplicate}</h3>
      <p>Review / duplicate</p>
    </div>
  </div>

  {deficiencyRows.length === 0 && (
    <div className="logic-note">
      Upload PDFs and select document expectations to generate deficiency
      results.
    </div>
  )}

  {deficiencyRows.length > 0 && deficiencyExceptionRows.length === 0 && (
    <div className="logic-note">
      No deficiencies found for the selected period and document types.
    </div>
  )}

  {investorDeficiencyGroups.length > 0 && (
  <div className="investor-deficiency-grid">
    {investorDeficiencyGroups.slice(0, 30).map((group) => (
      <details
        className="investor-deficiency-card"
        key={`${group.investorCode}-${group.investorId}`}
      >
        <summary>
          <div>
            <strong>{group.investorName}</strong>
            <span>{group.investorCode}</span>
          </div>

          <div className="deficiency-summary-pills">
            {group.missing > 0 && (
              <span className="deficiency-pill danger">
                {group.missing} missing
              </span>
            )}

            {group.review > 0 && (
              <span className="deficiency-pill warning">
                {group.review} review
              </span>
            )}

            {group.duplicate > 0 && (
              <span className="deficiency-pill neutral">
                {group.duplicate} duplicate
              </span>
            )}
          </div>

          <small>Open details</small>
        </summary>

        <div className="deficiency-detail-list">
          {group.rows.map((row) => (
            <div
              className="deficiency-detail-row"
              key={`${row.investorId}-${row.documentType}-${row.periodLabel}-${row.status}`}
            >
              <div>
                <strong>{row.documentType}</strong>
                <span>{row.periodLabel}</span>
              </div>

              <div className="deficiency-row-meta">
                <span
                  className={
                    row.status === "Missing"
                      ? "deficiency-status missing"
                      : row.status === "Review"
                        ? "deficiency-status review"
                        : "deficiency-status duplicate"
                  }
                >
                  {row.status}
                </span>

                <small>{row.matchedCount} matched file(s)</small>
              </div>
            </div>
          ))}
        </div>
      </details>
    ))}
  </div>
)}

 {investorDeficiencyGroups.length > 30 && (
  <div className="logic-note">
    Showing first 30 investor deficiency groups. Full export will be added in
    the next version.
  </div>
)}
</div>
        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Review & Correction Queue</p>
              <h2>Correct low-confidence PDF matches</h2>
            </div>

            <span className="status-pill">
              {reviewQueue.length} item{reviewQueue.length === 1 ? "" : "s"} to
              review
            </span>
          </div>

          <div className="explain-box">
            If VENTIQ cannot confidently identify the investor, document type or
            period, the fund team can manually correct it here. Once corrected
            and marked Ready, the PDF can be published into the Investor Portal.
          </div>

          {reviewQueue.length === 0 && (
            <div className="logic-note">
              No review items yet. Upload PDFs first, or all processed PDFs are
              already ready / published.
            </div>
          )}

          {reviewQueue.length > 0 && (
            <div className="review-editor-grid">
              {reviewQueue.slice(0, 12).map((result) => {
                const draft = getReviewDraft(result);

                return (
                  <div
                    className="review-editor-card"
                    key={`${result.id}-review`}
                  >
                    <div className="review-editor-header">
                      <div>
                        <strong>{result.fileName}</strong>
                        <span>
                          Current: {result.documentType} ·{" "}
                          {result.investorName} · {result.periodLabel}
                        </span>
                      </div>

                      <small>{result.confidenceScore}% confidence</small>
                    </div>

                    <div className="review-editor-fields">
                      <label>
                        Investor
                        <select
                          value={draft.investorId}
                          onChange={(event) =>
                            updateReviewDraft(result.id, {
                              investorId: event.target.value,
                            })
                          }
                        >
                          <option value="">Select investor</option>
                          {investors.map((investor) => (
                            <option key={investor.id} value={investor.id}>
                              {investor.investor_code} —{" "}
                              {investor.investor_name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Document type
                        <select
                          value={draft.documentType}
                          onChange={(event) =>
                            updateReviewDraft(result.id, {
                              documentType: event.target.value,
                            })
                          }
                        >
                          {DOCUMENT_TYPE_OPTIONS.map((documentType) => (
                            <option key={documentType} value={documentType}>
                              {documentType}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Period
                        <input
                          placeholder="Example: Q4 FY26"
                          value={draft.periodLabel}
                          onChange={(event) =>
                            updateReviewDraft(result.id, {
                              periodLabel: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Status
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateReviewDraft(result.id, {
                              status: event.target
                                .value as ReviewDraft["status"],
                            })
                          }
                        >
                          {REVIEW_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="review-editor-footer">
                      <button
                        className="publish-secondary-button"
                        onClick={() => saveReviewCorrection(result)}
                        type="button"
                      >
                        Save Correction
                      </button>

                      <span>
                        Mark as Ready only after investor, document type and
                        period are correct.
                      </span>
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
              <p className="eyebrow">Portal Publishing</p>
              <h2>Publish to Investor Portal</h2>
            </div>

            <span className="status-pill">
              {metrics.ready} ready PDF{metrics.ready === 1 ? "" : "s"}
            </span>
          </div>

          <div className="explain-box">
            Only high-confidence Ready PDFs with investor matches should be
            published. Review and unmatched files should stay in the exception
            queue until corrected by the fund team.
          </div>

          <div className="publish-panel">
            <div className="publish-copy">
              <span className="publish-kicker">Publishing queue</span>
              <strong>Investor Portal document library</strong>
              <p>
                Upload and process PDFs first. Once VENTIQ marks documents as
                Ready, they can be published investor-wise into the Investor
                Portal.
              </p>
            </div>

            <div className="publish-controls">
              <button
                className="publish-primary-button"
                disabled={publishing || metrics.ready === 0}
                onClick={publishReadyDocumentsToPortal}
                type="button"
              >
                {publishing ? "Publishing..." : "Publish Ready PDFs"}
              </button>

              <a className="publish-secondary-button" href="/investor-portal">
                Open Investor Portal
              </a>

              {metrics.ready === 0 && (
                <small>No Ready PDFs yet. Upload and process PDFs first.</small>
              )}
            </div>
          </div>

          {publishMessage && <div className="logic-note">{publishMessage}</div>}
        </div>

       <div className="preview-card">
  <div className="section-heading-row">
    <div>
      <p className="eyebrow">Processed PDF Register</p>
      <h2>Sorting Results</h2>
    </div>

    <span className="status-pill">
      {results.length} processed PDF{results.length === 1 ? "" : "s"}
    </span>
  </div>

  {results.length === 0 && (
    <div className="logic-note">
      Upload PDFs above to see classification, investor matching and confidence
      scoring.
    </div>
  )}

  {results.length > 0 && (
    <div
      style={{
        display: "grid",
        gap: "12px",
      }}
    >
      {results.slice(0, 80).map((result) => (
        <div
          key={result.id}
          style={{
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: "18px",
            background: "rgba(2, 6, 23, 0.48)",
            padding: "14px",
            display: "grid",
            gridTemplateColumns:
              "minmax(260px, 2.2fr) minmax(140px, 1fr) minmax(150px, 1fr) minmax(90px, 0.6fr) minmax(90px, 0.6fr) minmax(100px, 0.7fr)",
            gap: "14px",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <strong
              style={{
                display: "block",
                wordBreak: "break-word",
                lineHeight: "1.35",
              }}
            >
              {result.fileName}
            </strong>

            <span
              style={{
                display: "block",
                marginTop: "5px",
                color: "rgba(219, 234, 254, 0.72)",
                fontSize: "0.82rem",
              }}
            >
              {formatFileSize(result.fileSize)}
            </span>
          </div>

          <div>
            <small>Document Type</small>
            <strong
              style={{
                display: "block",
                marginTop: "4px",
                lineHeight: "1.3",
              }}
            >
              {result.documentType}
            </strong>
          </div>

          <div>
            <small>Investor</small>
            <strong
              style={{
                display: "block",
                marginTop: "4px",
                lineHeight: "1.3",
              }}
            >
              {result.investorName}
            </strong>
            <span>{result.investorCode}</span>
          </div>

          <div>
            <small>Period</small>
            <strong
              style={{
                display: "block",
                marginTop: "4px",
              }}
            >
              {result.periodLabel}
            </strong>
          </div>

          <div>
            <small>Confidence</small>
            <strong
              style={{
                display: "block",
                marginTop: "4px",
              }}
            >
              {result.confidenceScore}%
            </strong>
          </div>

          <div>
            <small>Status</small>
            <span
              className="status-pill"
              style={{
                display: "inline-flex",
                marginTop: "4px",
              }}
            >
              {result.status}
            </span>

            <span
              style={{
                display: "block",
                marginTop: "6px",
                color: "rgba(219, 234, 254, 0.72)",
                fontSize: "0.82rem",
              }}
            >
              {result.published ? "Published" : "Not published"}
            </span>
          </div>
        </div>
      ))}

      {results.length > 80 && (
        <div className="logic-note">
          Showing first 80 PDFs for performance. Total processed PDFs:{" "}
          {results.length}.
        </div>
      )}
    </div>
  )}
</div>
       {results.length > 0 && (
  <div className="preview-card">
    <div className="section-heading-row">
      <div>
        <p className="eyebrow">Classification Output</p>
        <h2>PDF Matching Results & Signals</h2>
      </div>

      <span className="status-pill">
        Showing latest {Math.min(results.length, 12)} of {results.length} PDFs
      </span>
    </div>

    <div className="explain-box">
      This view shows how VENTIQ classified each PDF, matched the investor,
      detected the period and assigned confidence before portal publishing.
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: "18px",
      }}
    >
      {results.slice(0, 12).map((result) => (
        <div
          key={`${result.id}-signals`}
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: "22px",
            background: "rgba(2, 6, 23, 0.62)",
            padding: "18px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "flex-start",
              marginBottom: "14px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  fontSize: "0.95rem",
                  lineHeight: "1.35",
                  wordBreak: "break-word",
                }}
              >
                {result.fileName}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "rgba(219, 234, 254, 0.72)",
                  fontSize: "0.8rem",
                }}
              >
                {formatFileSize(result.fileSize)}
              </span>
            </div>

            <span
              className="status-pill"
              style={{
                whiteSpace: "nowrap",
              }}
            >
              {result.status}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(148, 163, 184, 0.16)",
                borderRadius: "14px",
                padding: "10px",
              }}
            >
              <small>Investor</small>
              <strong
                style={{
                  display: "block",
                  marginTop: "4px",
                  wordBreak: "break-word",
                }}
              >
                {result.investorName}
              </strong>
              <span>{result.investorCode}</span>
            </div>

            <div
              style={{
                border: "1px solid rgba(148, 163, 184, 0.16)",
                borderRadius: "14px",
                padding: "10px",
              }}
            >
              <small>Confidence</small>
              <strong
                style={{
                  display: "block",
                  marginTop: "4px",
                }}
              >
                {result.confidenceScore}%
              </strong>
              <span>{result.published ? "Published" : "Not published"}</span>
            </div>

            <div
              style={{
                border: "1px solid rgba(148, 163, 184, 0.16)",
                borderRadius: "14px",
                padding: "10px",
              }}
            >
              <small>Document Type</small>
              <strong
                style={{
                  display: "block",
                  marginTop: "4px",
                  wordBreak: "break-word",
                }}
              >
                {result.documentType}
              </strong>
            </div>

            <div
              style={{
                border: "1px solid rgba(148, 163, 184, 0.16)",
                borderRadius: "14px",
                padding: "10px",
              }}
            >
              <small>Period</small>
              <strong
                style={{
                  display: "block",
                  marginTop: "4px",
                  wordBreak: "break-word",
                }}
              >
                {result.periodLabel}
              </strong>
            </div>
          </div>

          <details>
            <summary
              style={{
                cursor: "pointer",
                color: "#93c5fd",
                fontWeight: 800,
                marginBottom: "10px",
              }}
            >
              View matching signals
            </summary>

            <div
              style={{
                display: "grid",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              {result.signals.map((signal, signalIndex) => (
                <div
                  key={`${result.id}-signal-${signalIndex}`}
                  style={{
                    border: "1px solid rgba(96, 165, 250, 0.16)",
                    borderRadius: "12px",
                    padding: "9px 10px",
                    color: "rgba(219, 234, 254, 0.86)",
                    fontSize: "0.85rem",
                    lineHeight: "1.45",
                  }}
                >
                  {signal}
                </div>
              ))}
            </div>
          </details>

          <details style={{ marginTop: "12px" }}>
            <summary
              style={{
                cursor: "pointer",
                color: "#93c5fd",
                fontWeight: 800,
              }}
            >
              Storage path
            </summary>

            <div
              style={{
                marginTop: "10px",
                border: "1px solid rgba(148, 163, 184, 0.14)",
                borderRadius: "12px",
                padding: "10px",
                color: "rgba(219, 234, 254, 0.7)",
                fontSize: "0.78rem",
                lineHeight: "1.45",
                wordBreak: "break-all",
              }}
            >
              {result.storagePath}
            </div>
          </details>
        </div>
      ))}
    </div>
  </div>
)}

        <div className="preview-card">
          <h2>Next Commercial Upgrade</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Investor-wise folders</strong>
              <br />
              Automatically create investor folders and document-type subfolders
              from these classified records.
            </div>

            <div className="queue-item">
              <strong>Deficiency report</strong>
              <br />
              Compare expected SOAs, IRR statements and notices against uploaded
              PDFs to show missing investor documents.
            </div>

            <div className="queue-item">
              <strong>Portal publishing</strong>
              <br />
              Publish approved PDFs from Supabase Storage into the Investor
              Portal document library.
            </div>

            <div className="queue-item">
              <strong>Manual approval</strong>
              <br />
              Allow fund team to correct investor match, period or document type
              before publishing.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}