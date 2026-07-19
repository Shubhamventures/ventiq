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
  fileName: string;
  fileSize: number;
  documentType: string;
  investorCode: string;
  investorName: string;
  email: string;
  periodLabel: string;
  confidenceScore: number;
  status: "Ready" | "Review" | "Unmatched" | "Failed";
  storagePath: string;
  signals: string[];
  textPreview: string;
};

type PdfTextItem = {
  str?: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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

  async function handlePdfUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setProcessing(true);
    setMessage("Processing PDF dump...");

    const selectedFiles = Array.from(fileList).filter(
      (file) => file.type === "application/pdf" || file.name.endsWith(".pdf")
    );

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

        await supabase.from("pdf_intelligence_documents").insert({
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
        });

        processedResults.push({
          id: `${file.name}-${file.lastModified}`,
          fileName: file.name,
          fileSize: file.size,
          documentType: typeResult.documentType,
          investorCode: matchedInvestor?.investor_code ?? "-",
          investorName: matchedInvestor?.investor_name ?? "Not matched",
          email: matchedInvestor?.email ?? "-",
          periodLabel: periodResult.periodLabel,
          confidenceScore,
          status,
          storagePath,
          signals,
          textPreview,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "PDF processing failed";

        processedResults.push({
          id: `${file.name}-${file.lastModified}`,
          fileName: file.name,
          fileSize: file.size,
          documentType: "Failed",
          investorCode: "-",
          investorName: "Not processed",
          email: "-",
          periodLabel: "-",
          confidenceScore: 0,
          status: "Failed",
          storagePath: "-",
          signals: [errorMessage],
          textPreview: "",
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
    setMessage(`${processedResults.length} PDF file(s) processed.`);
    setProcessing(false);
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
          <h2>Upload Investor PDF Dump</h2>

          <div className="explain-box">
            No fixed format is required for PDFs. Upload SOAs, IRR statements,
            distribution notices, capital call notices, tax documents and fund
            reports. VENTIQ will inspect both the filename and the internal PDF
            text.
          </div>

          <input
            accept=".pdf"
            disabled={processing || loadingInvestors}
            multiple
            onChange={(event) => handlePdfUpload(event.target.files)}
            type="file"
          />

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
          <h2>Sorting Results</h2>

          {results.length === 0 && (
            <div className="logic-note">
              Upload PDFs above to see classification, investor matching and
              confidence scoring.
            </div>
          )}

          {results.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Investor</th>
                    <th>Period</th>
                    <th>Confidence</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        <strong>{result.fileName}</strong>
                        <br />
                        {formatFileSize(result.fileSize)}
                      </td>
                      <td>{result.documentType}</td>
                      <td>
                        {result.investorName}
                        <br />
                        {result.investorCode}
                      </td>
                      <td>{result.periodLabel}</td>
                      <td>{result.confidenceScore}%</td>
                      <td>{result.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="preview-card">
            <h2>Review Queue & Signals</h2>

            <div className="queue-grid">
              {results.slice(0, 8).map((result) => (
                <div className="queue-item" key={`${result.id}-signals`}>
                  <strong>{result.fileName}</strong>
                  <br />
                  Status: {result.status}
                  <br />
                  Storage: {result.storagePath}
                  <br />
                  <br />
                  {result.signals.map((signal) => (
                    <span key={signal}>
                      {signal}
                      <br />
                    </span>
                  ))}
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
              Automatically create investor folders and document-type
              subfolders from these classified records.
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