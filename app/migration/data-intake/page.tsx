"use client";

import { useMemo, useState } from "react";

type IntakeCategory = "pdf" | "investor" | "portfolio" | "fund" | "compliance";

type UploadStatus = "Staged" | "Uploading" | "Uploaded" | "Failed" | "Review";

type UploadedFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  category: IntakeCategory;
  detectedType: string;
  status: UploadStatus;
  note: string;
  error?: string;
};

type TemplateType = "investor" | "portfolio" | "fund" | "compliance";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectPdfType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("capital") || normalized.includes("drawdown")) {
    return "Capital Call Notice";
  }

  if (normalized.includes("distribution") || normalized.includes("payout")) {
    return "Distribution Notice";
  }

  if (normalized.includes("irr")) {
    return "IRR Statement";
  }

  if (
    normalized.includes("soa") ||
    normalized.includes("statement") ||
    normalized.includes("account")
  ) {
    return "SOA / Account Statement";
  }

  if (
    normalized.includes("tax") ||
    normalized.includes("64c") ||
    normalized.includes("64d") ||
    normalized.includes("tds")
  ) {
    return "Tax Document";
  }

  if (
    normalized.includes("portfolio") ||
    normalized.includes("valuation") ||
    normalized.includes("company")
  ) {
    return "Portfolio Report";
  }

  if (
    normalized.includes("fund") ||
    normalized.includes("report") ||
    normalized.includes("quarterly")
  ) {
    return "Fund Report";
  }

  return "Other / Review";
}

function getCategoryLabel(category: IntakeCategory) {
  if (category === "pdf") return "PDF Dump";
  if (category === "investor") return "Investor Data";
  if (category === "portfolio") return "Portfolio / Investment Data";
  if (category === "fund") return "Fund Data";
  return "Compliance & Evidence";
}

function getUploadNote(category: IntakeCategory, detectedType: string) {
  if (category === "pdf") {
    if (detectedType === "Other / Review") {
      return "Uploaded to intake. Needs PDF Intelligence review.";
    }

    return "Uploaded to intake. Ready for PDF Intelligence matching.";
  }

  if (category === "investor") {
    return "Uploaded to intake. Should be processed before PDF matching.";
  }

  if (category === "portfolio") {
    return "Uploaded to intake. Will power investment, portfolio and MP dashboards.";
  }

  if (category === "fund") {
    return "Uploaded to intake. Will power fund setup, fees, waterfall and compliance.";
  }

  return "Uploaded to intake. Will power compliance evidence and audit trail.";
}

function getTemplateRows(template: TemplateType) {
  if (template === "investor") {
    return [
      [
        "investor_code",
        "investor_name",
        "email",
        "investor_type",
        "country",
        "kyc_status",
        "bank_status",
        "fund_name",
        "class_name",
        "commitment_amount",
        "capital_called_till_date",
        "uncalled_capital",
        "distributions_till_date",
        "setup_fee",
        "management_fee",
        "cashflow_date",
        "cashflow_type",
        "cashflow_amount",
      ],
      [
        "INV-0001",
        "Aarav Shah",
        "aarav@example.com",
        "Individual",
        "India",
        "Completed",
        "Verified",
        "VENTIQ Growth Fund II",
        "Class A",
        "5000000",
        "2100000",
        "2900000",
        "400000",
        "50000",
        "100000",
        "2026-03-31",
        "Distribution",
        "400000",
      ],
    ];
  }

  if (template === "portfolio") {
    return [
      [
        "portfolio_company",
        "investment_date",
        "instrument_type",
        "investment_cost",
        "current_value",
        "realised_value",
        "exit_date",
        "expected_exit_value",
        "repayment_due_date",
        "interest_rate",
        "security_or_charge",
        "covenants",
        "risk_status",
        "latest_update",
      ],
      [
        "ABC Fintech Pvt Ltd",
        "2024-04-15",
        "Equity",
        "25000000",
        "42000000",
        "0",
        "",
        "80000000",
        "",
        "",
        "",
        "",
        "Watch",
        "Revenue growing, follow-on evaluation pending",
      ],
    ];
  }

  if (template === "fund") {
    return [
      [
        "fund_name",
        "fund_type",
        "category",
        "jurisdiction",
        "first_close_date",
        "second_close_date",
        "final_close_date",
        "target_corpus",
        "committed_capital",
        "green_shoe",
        "management_fee_rate",
        "setup_cost_rate",
        "carry_rate",
        "hurdle_rate",
        "waterfall_type",
        "sponsor_commitment",
        "trustee_name",
        "investment_manager",
      ],
      [
        "VENTIQ Growth Fund II",
        "Close-ended",
        "Category II AIF",
        "India",
        "2024-01-31",
        "2024-09-30",
        "2025-03-31",
        "1000000000",
        "981500000",
        "250000000",
        "2",
        "1",
        "20",
        "10",
        "European",
        "50000000",
        "ABC Trusteeship Services",
        "VENTIQ Capital Advisors",
      ],
    ];
  }

  return [
    [
      "item_type",
      "document_name",
      "fund_name",
      "period",
      "authority",
      "due_date",
      "filing_status",
      "evidence_available",
      "owner",
      "remarks",
    ],
    [
      "SEBI Filing",
      "Quarterly Compliance Report",
      "VENTIQ Growth Fund II",
      "Q4 FY26",
      "SEBI",
      "2026-04-30",
      "Pending",
      "Yes",
      "Compliance Officer",
      "Supporting workings available",
    ],
  ];
}

function downloadTemplate(template: TemplateType) {
  const rows = getTemplateRows(template);
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ventiq-${template}-data-template.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function DataIntakeCommandCenterPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [isProcessingIntake, setIsProcessingIntake] = useState(false);
const [processMessage, setProcessMessage] = useState("");

  function handleFilesSelected(
    category: IntakeCategory,
    fileList: FileList | null
  ) {
    if (!fileList || fileList.length === 0) return;

    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      const detectedType =
        category === "pdf" ? detectPdfType(file.name) : getCategoryLabel(category);

      return {
        id: `${category}-${file.name}-${file.lastModified}-${file.size}`,
        file,
        name: file.name,
        size: file.size,
        category,
        detectedType,
        status: detectedType === "Other / Review" ? "Review" : "Staged",
        note: getUploadNote(category, detectedType),
      };
    });

    setUploadedFiles((current) => [...newFiles, ...current]);
    setMessage(`${newFiles.length} file(s) staged. Click Upload Migration Data to save.`);
  }

  function removeFile(fileId: string) {
    setUploadedFiles((current) => current.filter((file) => file.id !== fileId));
  }

  async function uploadMigrationData() {
    const filesToUpload = uploadedFiles.filter(
      (file) => file.status !== "Uploaded"
    );

    if (filesToUpload.length === 0) {
      setMessage("All selected files are already uploaded.");
      return;
    }

    setIsUploading(true);
    setMessage("Uploading migration files. Please wait...");

    setUploadedFiles((current) =>
      current.map((file) =>
        file.status === "Uploaded" ? file : { ...file, status: "Uploading" }
      )
    );

    const formData = new FormData();
    formData.append("batchName", `VENTIQ Full Migration Intake ${new Date().toLocaleString("en-IN")}`);

    filesToUpload.forEach((file) => {
      formData.append("files", file.file);
      formData.append("categories", file.category);
      formData.append("detectedTypes", file.detectedType);
      formData.append("clientIds", file.id);
      formData.append("notes", file.note);
    });

    try {
      const response = await fetch("/api/migration/intake-upload", {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();

let result = {} as {
  batchId?: string;
  error?: string;
  message?: string;
  uploadedFiles?: Array<{
    clientId: string;
    fileName: string;
    category: string;
    status: string;
    storagePath?: string;
    error?: string;
  }>;
  uploadedCount?: number;
  totalFiles?: number;
  summary?: {
    investorRows: number;
    pdfRows: number;
    portfolioRows: number;
    fundRows: number;
    complianceRows: number;
  };
};
try {
  result = responseText ? JSON.parse(responseText) : {};
} catch {
  throw new Error(
    responseText || `Process API failed with status ${response.status}`
  );
}

if (!response.ok) {
  throw new Error(result.error || "Unable to process migration intake.");
}

      setBatchId(result.batchId || "");

      setUploadedFiles((current) =>
        current.map((file) => {
          const uploadedResult = result.uploadedFiles?.find(
            (item: { clientId: string }) => item.clientId === file.id
          );

          if (!uploadedResult) {
            return file;
          }

          if (uploadedResult.status === "Uploaded") {
            return {
              ...file,
              status: "Uploaded",
              error: "",
            };
          }

          return {
            ...file,
            status: "Failed",
            error: uploadedResult.error || "Upload failed.",
          };
        })
      );

      setMessage(
        `${result.uploadedCount} of ${result.totalFiles} file(s) uploaded successfully.`
      );
    } catch (error) {
      setUploadedFiles((current) =>
        current.map((file) =>
          file.status === "Uploading"
            ? {
                ...file,
                status: "Failed",
                error:
                  error instanceof Error ? error.message : "Upload failed.",
              }
            : file
        )
      );

      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }
  async function processMigrationData() {
  if (!batchId) {
    setProcessMessage("Please upload migration data before processing.");
    return;
  }

  setIsProcessingIntake(true);
  setProcessMessage("Processing uploaded intake files into VENTIQ data tables...");

  try {
    const response = await fetch("/api/migration/process-intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batchId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to process migration intake.");
    }

    setProcessMessage(
      `Processing completed. Investors: ${result.summary.investorRows}, PDFs: ${result.summary.pdfRows}, Portfolio records: ${result.summary.portfolioRows}, Fund records: ${result.summary.fundRows}, Compliance records: ${result.summary.complianceRows}.`
    );
  } catch (error) {
    setProcessMessage(
      error instanceof Error ? error.message : "Unable to process migration intake."
    );
  } finally {
    setIsProcessingIntake(false);
  }
}

  const metrics = useMemo(() => {
    const pdfFiles = uploadedFiles.filter((file) => file.category === "pdf");
    const investorFiles = uploadedFiles.filter(
      (file) => file.category === "investor"
    );
    const portfolioFiles = uploadedFiles.filter(
      (file) => file.category === "portfolio"
    );
    const fundFiles = uploadedFiles.filter((file) => file.category === "fund");
    const complianceFiles = uploadedFiles.filter(
      (file) => file.category === "compliance"
    );
    const uploadedCount = uploadedFiles.filter(
      (file) => file.status === "Uploaded"
    ).length;
    const reviewFiles = uploadedFiles.filter((file) => file.status === "Review");
    const failedFiles = uploadedFiles.filter((file) => file.status === "Failed");

    return {
      totalFiles: uploadedFiles.length,
      pdfFiles: pdfFiles.length,
      investorFiles: investorFiles.length,
      portfolioFiles: portfolioFiles.length,
      fundFiles: fundFiles.length,
      complianceFiles: complianceFiles.length,
      uploadedCount,
      reviewFiles: reviewFiles.length,
      failedFiles: failedFiles.length,
      isInvestorReady: investorFiles.length > 0,
      isPortfolioReady: portfolioFiles.length > 0,
      isFundReady: fundFiles.length > 0,
      isComplianceReady: complianceFiles.length > 0,
      isPdfReady: pdfFiles.length > 0,
    };
  }, [uploadedFiles]);

  const pendingUploadCount = uploadedFiles.filter(
    (file) => file.status !== "Uploaded"
  ).length;

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Migration Portal</p>
            <h1>Data Intake Command Center</h1>
            <p>
              Stage all historical investor, portfolio, fund, compliance and PDF
              files first. Then upload the complete migration dump in one action.
            </p>
          </div>

          <a className="back-link" href="/migration">
            Back to Migration
          </a>
        </div>

        <div className="sample-data-ribbon">
          Stage files · Upload migration data · Confirm uploaded · Continue to processing
        </div>

        <div className="preview-card">
          <h2>Migration Upload Flow</h2>

          <div className="explain-box">
            Upload investor data before PDF Intelligence. The PDF engine needs a
            clean investor master to match documents correctly. Use this page to
            upload the raw client dump first, then continue to processing pages.
          </div>

         <div className="action-row">
  <button
    className="monitor-btn monitor-btn-primary"
    disabled={isUploading || uploadedFiles.length === 0}
    onClick={uploadMigrationData}
    type="button"
  >
    {isUploading
      ? "Uploading Migration Data..."
      : pendingUploadCount === 0 && uploadedFiles.length > 0
      ? "All Files Uploaded"
      : "Upload Migration Data"}
  </button>

  <button
    className="monitor-btn monitor-btn-primary"
    disabled={!batchId || isProcessingIntake}
    onClick={processMigrationData}
    type="button"
  >
    {isProcessingIntake ? "Processing..." : "Process Migration Data"}
  </button>

  <a className="monitor-btn monitor-btn-secondary" href="/migration/pdf-intelligence">
    Open PDF Intelligence
  </a>

  <a className="monitor-btn monitor-btn-secondary" href="/migration/activation">
    Open Activation Dashboard
  </a>
</div>

          {message && <div className="logic-note">{message}</div>}
          {processMessage && <div className="logic-note">{processMessage}</div>}

          {batchId && (
            <div className="explain-box">
              ✅ Migration batch created: <strong>{batchId}</strong>
            </div>
          )}
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{metrics.totalFiles}</h3>
            <p>Total files staged</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.uploadedCount}</h3>
            <p>Uploaded files</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.pdfFiles}</h3>
            <p>PDFs staged</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.failedFiles}</h3>
            <p>Failed uploads</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Upload Migration Files</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <span className="small-pill">
                {metrics.isInvestorReady ? "Selected" : "Required First"}
              </span>
              <br />
              <strong>Investor Data Excel</strong>
              <br />
              Investor master, commitments, KYC, bank details, drawdowns,
              distributions and cashflows.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadTemplate("investor")}
                type="button"
              >
                Download Investor Template
              </button>
              <br />
              <br />
              <input
                accept=".csv,.xlsx,.xls"
                onChange={(event) =>
                  handleFilesSelected("investor", event.target.files)
                }
                type="file"
              />
            </div>

            <div className="queue-item">
              <span className="small-pill">
                {metrics.isPortfolioReady ? "Selected" : "Pending"}
              </span>
              <br />
              <strong>Investment / Portfolio Data Excel</strong>
              <br />
              500 investments, cost, current value, IRR, MOIC, exits, covenants,
              repayments and latest updates.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadTemplate("portfolio")}
                type="button"
              >
                Download Portfolio Template
              </button>
              <br />
              <br />
              <input
                accept=".csv,.xlsx,.xls"
                onChange={(event) =>
                  handleFilesSelected("portfolio", event.target.files)
                }
                type="file"
              />
            </div>

            <div className="queue-item">
              <span className="small-pill">
                {metrics.isFundReady ? "Selected" : "Pending"}
              </span>
              <br />
              <strong>Fund Data Excel</strong>
              <br />
              Fund structure, closes, corpus, management fee, setup cost, carry,
              hurdle, waterfall and sponsor commitment.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadTemplate("fund")}
                type="button"
              >
                Download Fund Template
              </button>
              <br />
              <br />
              <input
                accept=".csv,.xlsx,.xls"
                onChange={(event) =>
                  handleFilesSelected("fund", event.target.files)
                }
                type="file"
              />
            </div>

            <div className="queue-item">
              <span className="small-pill">
                {metrics.isComplianceReady ? "Selected" : "Pending"}
              </span>
              <br />
              <strong>Compliance Data / Evidence</strong>
              <br />
              Compliance tracker, filings, audit evidence, tax workings,
              approvals and regulatory documents.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadTemplate("compliance")}
                type="button"
              >
                Download Compliance Template
              </button>
              <br />
              <br />
              <input
                accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                multiple
                onChange={(event) =>
                  handleFilesSelected("compliance", event.target.files)
                }
                type="file"
              />
            </div>

            <div className="queue-item">
              <span className="small-pill">
                {metrics.isPdfReady ? "Selected" : "After Investor Data"}
              </span>
              <br />
              <strong>Investor PDF Dump</strong>
              <br />
              SOAs, capital call notices, distribution notices, tax documents,
              IRR statements, reports and unmatched PDFs.
              <br />
              <br />
              <input
                accept=".pdf"
                multiple
                onChange={(event) =>
                  handleFilesSelected("pdf", event.target.files)
                }
                type="file"
              />
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Upload Status</h2>

          {uploadedFiles.length === 0 ? (
            <div className="explain-box">
              No files selected yet. Select investor, portfolio, fund, compliance
              and PDF files above.
            </div>
          ) : (
            <div className="queue-grid">
              {uploadedFiles.map((file) => (
                <div className="queue-item" key={file.id}>
                  <span className="small-pill">{file.status}</span>
                  <br />
                  <strong>{file.name}</strong>
                  <br />
                  Category: {getCategoryLabel(file.category)}
                  <br />
                  Type: {file.detectedType}
                  <br />
                  Size: {formatFileSize(file.size)}
                  <br />
                  Note: {file.note}
                  {file.error && (
                    <>
                      <br />
                      Error: {file.error}
                    </>
                  )}
                  <br />
                  <br />
                  {file.status !== "Uploaded" && !isUploading && (
                    <button
                      className="secondary-action"
                      onClick={() => removeFile(file.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="preview-card">
          <h2>Recommended Testing Sequence</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>1. Upload Investor Excel first</strong>
              <br />
              This creates the base data needed for investor matching.
            </div>

            <div className="queue-item">
              <strong>2. Upload portfolio, fund and compliance data</strong>
              <br />
              These power MP, investment, finance and compliance dashboards.
            </div>

            <div className="queue-item">
              <strong>3. Upload PDF dump</strong>
              <br />
              Start with 25–50 PDFs first, then test the full batch.
            </div>

            <div className="queue-item">
              <strong>4. Continue to processing</strong>
              <br />
              Use PDF Intelligence, Activation Dashboard and Stakeholder Launch.
            </div>
          </div>

          <div className="action-row">
            <a className="monitor-btn monitor-btn-primary" href="/migration/pdf-intelligence">
              Continue to PDF Intelligence
            </a>

            <a className="monitor-btn monitor-btn-secondary" href="/migration/activation">
              Continue to Activation
            </a>

            <a className="monitor-btn monitor-btn-secondary" href="/migration/stakeholder-launch">
              Launch Dashboards
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}