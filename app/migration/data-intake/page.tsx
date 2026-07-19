"use client";

import { useMemo, useState } from "react";

type IntakeCategory =
  | "pdf"
  | "investor"
  | "portfolio"
  | "fund"
  | "compliance";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  category: IntakeCategory;
  detectedType: string;
  status: "Ready" | "Review";
  note: string;
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

function getUploadNote(category: IntakeCategory, detectedType: string) {
  if (category === "pdf") {
    if (detectedType === "Other / Review") {
      return "Needs manual review before publishing.";
    }

    return "Ready for classification and investor matching.";
  }

  if (category === "investor") {
    return "Will power Investor Portal, capital calls, distributions and IR metrics.";
  }

  if (category === "portfolio") {
    return "Will power Portfolio Intelligence, MP dashboard and exit analysis.";
  }

  if (category === "fund") {
    return "Will power fund setup, fee engine, carry, waterfall and compliance calendar.";
  }

  return "Will power compliance evidence, audit trail and exception tracking.";
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

function getCategoryLabel(category: IntakeCategory) {
  if (category === "pdf") return "All PDFs";
  if (category === "investor") return "Investor Data";
  if (category === "portfolio") return "Portfolio Data";
  if (category === "fund") return "Fund Data";
  return "Compliance & Other Data";
}

export default function DataIntakeCommandCenterPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [message, setMessage] = useState("");

  function handleFilesSelected(
    category: IntakeCategory,
    fileList: FileList | null
  ) {
    if (!fileList || fileList.length === 0) return;

    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      const detectedType =
        category === "pdf"
          ? detectPdfType(file.name)
          : getCategoryLabel(category);

      return {
        id: `${category}-${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        category,
        detectedType,
        status: detectedType === "Other / Review" ? "Review" : "Ready",
        note: getUploadNote(category, detectedType),
      };
    });

    setUploadedFiles((current) => [...newFiles, ...current]);
    setMessage(`${newFiles.length} file(s) added to intake preview.`);
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

    const reviewFiles = uploadedFiles.filter((file) => file.status === "Review");

    const readyFiles = uploadedFiles.filter((file) => file.status === "Ready");

    const expectedQuarterlySoa = 2400;
    const detectedSoa = Math.min(
      pdfFiles.filter((file) => file.detectedType === "SOA / Account Statement")
        .length,
      expectedQuarterlySoa
    );

    const missingSoa = Math.max(expectedQuarterlySoa - detectedSoa, 0);

    return {
      totalFiles: uploadedFiles.length,
      pdfFiles: pdfFiles.length,
      investorFiles: investorFiles.length,
      portfolioFiles: portfolioFiles.length,
      fundFiles: fundFiles.length,
      complianceFiles: complianceFiles.length,
      reviewFiles: reviewFiles.length,
      readyFiles: readyFiles.length,
      missingSoa,
    };
  }, [uploadedFiles]);

  const pdfTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    uploadedFiles
      .filter((file) => file.category === "pdf")
      .forEach((file) => {
        counts.set(file.detectedType, (counts.get(file.detectedType) || 0) + 1);
      });

    return Array.from(counts.entries());
  }, [uploadedFiles]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Migration Portal</p>
            <h1>Data Intake Command Center</h1>
            <p>
              Upload historical PDFs without any format, and upload Excel data
              using VENTIQ templates for investor, portfolio, fund and
              compliance records.
            </p>
          </div>

          <a className="back-link" href="/migration">
            Back to Migration
          </a>
        </div>

        <div className="sample-data-ribbon">
          Upload once · Sort documents · Detect gaps · Activate dashboards
        </div>

        <div className="preview-card">
          <h2>How VENTIQ accepts fund data</h2>

          <div className="explain-box">
            PDFs do not need any fixed format. The fund can upload a complete
            historical dump and VENTIQ will classify and sort it. Excel data
            should follow VENTIQ templates because it powers calculations,
            dashboards, IRR, DPI, TVPI, capital calls, compliance and portfolio
            reporting.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{metrics.totalFiles}</h3>
            <p>Total files staged</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.pdfFiles}</h3>
            <p>PDFs uploaded</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.readyFiles}</h3>
            <p>Ready to process</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.reviewFiles}</h3>
            <p>Review queue</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Upload Data</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Upload All PDFs</strong>
              <br />
              No template required. Upload SOAs, capital calls, distributions,
              IRR statements, tax files, portfolio reports and fund documents.
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
              <br />
              <br />
              <a className="secondary-action" href="/migration/pdf-intelligence">
                Open PDF Intelligence Engine
              </a>
            </div>

            <div className="queue-item">
              <strong>Upload Investor Data</strong>
              <br />
              Use template for investor master, commitments, drawdowns,
              distributions, setup cost, KYC, bank and cashflows.
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
              <strong>Upload Portfolio Data</strong>
              <br />
              Use template for investment cost, instrument type, exits,
              repayments, valuation, covenants and portfolio updates.
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
              <strong>Upload Fund Data</strong>
              <br />
              Use template for fund type, closes, corpus, fee structure, carry,
              hurdle, waterfall, sponsor and trustee details.
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
              <strong>Upload Compliance & Other Data</strong>
              <br />
              Upload regulatory filings, audit evidence, tax workings, trustee
              records, approvals and unmatched files.
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
          </div>

          {message && <div className="logic-note">{message}</div>}
        </div>
<div className="preview-card">
  <h2>PDF Intelligence Rules</h2>

  <div className="explain-box">
    VENTIQ should not rely only on the PDF file name. The PDF Intelligence
    Engine will read the file name, extract text inside the PDF, search for
    investor identity, detect document type, detect period, assign confidence
    and then sort the file into the correct folder.
  </div>
  <div className="migration-actions">
  <a className="primary-action" href="/migration/pdf-intelligence">
    Launch PDF Intelligence Engine
  </a>
</div>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>1</h3>
      <p>Read filename</p>
    </div>

    <div className="impact-card">
      <h3>2</h3>
      <p>Search PDF text</p>
    </div>

    <div className="impact-card">
      <h3>3</h3>
      <p>Match investor</p>
    </div>

    <div className="impact-card">
      <h3>4</h3>
      <p>Detect period</p>
    </div>
  </div>

  <div className="queue-grid">
    <div className="queue-item">
      <strong>Document type detection</strong>
      <br />
      VENTIQ searches for SOA, Statement of Account, IRR Statement, Capital Call
      Notice, Drawdown Notice, Distribution Notice, Tax Certificate, Form 64C,
      Form 64D and similar keywords.
    </div>

    <div className="queue-item">
      <strong>Investor matching</strong>
      <br />
      VENTIQ searches investor code, investor name, email, PAN / tax ID, folio
      number, class name and commitment reference inside the PDF.
    </div>

    <div className="queue-item">
      <strong>Period detection</strong>
      <br />
      VENTIQ detects Q1, Q2, Q3, Q4, FY, quarter ended dates, March / June /
      September / December periods and document dates.
    </div>

    <div className="queue-item">
      <strong>Confidence scoring</strong>
      <br />
      High-confidence files are auto-sorted. Medium-confidence files move to
      review. Low-confidence files remain unmatched until approved manually.
    </div>
  </div>
</div>

<div className="preview-card">
  <h2>Investor-wise Folder Sorting</h2>

  <div className="explain-box">
    After classification, VENTIQ should create investor-wise folders and place
    each document into the correct category and period. This is what makes the
    Investor Portal clean and audit-ready.
  </div>

  <div className="queue-grid">
    <div className="queue-item">
      <strong>INV-0001 — Aarav Shah</strong>
      <br />
      SOA / Q1 FY26
      <br />
      SOA / Q2 FY26
      <br />
      Capital Call Notice / March 2026
      <br />
      Distribution Notice / June 2026
    </div>

    <div className="queue-item">
      <strong>INV-0002 — Vivaan Jain</strong>
      <br />
      SOA / Q1 FY26
      <br />
      IRR Statement / FY26
      <br />
      Distribution Notice / June 2026
      <br />
      Tax Document / FY26
    </div>

    <div className="queue-item">
      <strong>Unmatched / Review Queue</strong>
      <br />
      PDF has document type but no investor match
      <br />
      Investor name found but period missing
      <br />
      Duplicate document detected
      <br />
      Low confidence match
    </div>

    <div className="queue-item">
      <strong>Deficiency Output</strong>
      <br />
      Missing Q4 SOA
      <br />
      Missing IRR Statement
      <br />
      Missing tax certificate
      <br />
      Missing distribution notice
    </div>
  </div>
</div>

<div className="preview-card">
  <h2>PDF Confidence Score Model</h2>

  <div className="explain-box">
    Every PDF should receive a confidence score before publishing. This protects
    the fund from wrongly showing documents to the wrong investor.
  </div>

  <div className="queue-grid">
    <div className="queue-item">
      <strong>Filename match</strong>
      <br />
      +20 points if filename includes SOA, IRR, capital call, distribution,
      investor code or period.
    </div>

    <div className="queue-item">
      <strong>PDF text match</strong>
      <br />
      +30 points if PDF text contains document keywords such as Statement of
      Account, Capital Call Notice or Distribution Notice.
    </div>

    <div className="queue-item">
      <strong>Investor match</strong>
      <br />
      +30 points if investor code, investor name, email or tax ID is found
      inside the PDF.
    </div>

    <div className="queue-item">
      <strong>Period match</strong>
      <br />
      +20 points if quarter, FY, month, year or document date is detected.
    </div>
  </div>

  <div className="impact-grid">
    <div className="impact-card">
      <h3>85%+</h3>
      <p>Auto-sort</p>
    </div>

    <div className="impact-card">
      <h3>60–84%</h3>
      <p>Review queue</p>
    </div>

    <div className="impact-card">
      <h3>&lt;60%</h3>
      <p>Unmatched</p>
    </div>

    <div className="impact-card">
      <h3>100%</h3>
      <p>Publish-ready</p>
    </div>
  </div>
</div>
        <div className="preview-card">
          <h2>PDF Sorting Preview</h2>

          <div className="explain-box">
        VENTIQ will classify the PDF dump using filename signals first. In the full
commercial version, it will also extract PDF text, search investor names,
investor codes, fund names, periods and document keywords, then create
investor-wise folders with confidence scoring and deficiency tracking.
          </div>

          {pdfTypeCounts.length === 0 && (
            <div className="logic-note">
              Upload PDF files above to preview document sorting.
            </div>
          )}

          {pdfTypeCounts.length > 0 && (
            <div className="queue-grid">
              {pdfTypeCounts.map(([type, count]) => (
                <div className="queue-item" key={type}>
                  <strong>{type}</strong>
                  <br />
                  {count} file(s)
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="preview-card">
          <h2>Deficiency & Coverage Tracker</h2>

          <div className="explain-box">
            After upload, VENTIQ should not only sort data. It should also tell
            the fund what is missing, duplicated, unmatched or low confidence.
            This creates a proper onboarding audit trail.
          </div>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>{metrics.missingSoa}</h3>
              <p>Expected SOAs still missing</p>
            </div>

            <div className="impact-card">
              <h3>{metrics.reviewFiles}</h3>
              <p>Files needing manual review</p>
            </div>

            <div className="impact-card">
              <h3>{metrics.investorFiles ? "Ready" : "Missing"}</h3>
              <p>Investor Excel</p>
            </div>

            <div className="impact-card">
              <h3>{metrics.portfolioFiles ? "Ready" : "Missing"}</h3>
              <p>Portfolio Excel</p>
            </div>
          </div>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Example deficiency</strong>
              <br />
              3 investors may be missing Q4 SOA records.
            </div>

            <div className="queue-item">
              <strong>Example deficiency</strong>
              <br />
              7 PDFs could not be matched confidently to an investor.
            </div>

            <div className="queue-item">
              <strong>Example deficiency</strong>
              <br />
              Portfolio repayment schedule missing for 2 debt investments.
            </div>

            <div className="queue-item">
              <strong>Example deficiency</strong>
              <br />
              Fund carry and hurdle structure not uploaded yet.
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Where this data flows</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Investor Data</strong>
              <br />
              Investor Portal, Finance Head, Capital Calls, Distributions,
              Investor Relations and MP Dashboard.
            </div>

            <div className="queue-item">
              <strong>Portfolio Data</strong>
              <br />
              Portfolio Intelligence, Investment Team, Repayment Notices, Exit
              Analysis and MP Dashboard.
            </div>

            <div className="queue-item">
              <strong>Fund Data</strong>
              <br />
              Fund setup, fee engine, carry, waterfall, compliance calendar and
              MP Dashboard.
            </div>

            <div className="queue-item">
              <strong>PDFs & Evidence</strong>
              <br />
              Document Engine, Investor Portal, Data Room, Compliance Evidence
              and audit trail.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}