"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Investor = {
  id: string;
  batch_id: string;
  investor_code: string;
  investor_name: string;
  email: string;
  investor_type?: string;
  kyc_status?: string;
  bank_status?: string;
};

type ImportBatch = {
  id: string;
  batch_name: string;
  fund_name: string;
  total_records: number;
  total_commitment: number;
  status: string;
  created_at: string;
};

type MigrationDocument = {
  id: string;
  fileName: string;
  category: string;
  matchedInvestorCode: string;
  matchedInvestorName: string;
  confidence: number;
  status: "Ready" | "Review";
  reason: string;
};

const documentCategories = [
  "SOA",
  "Capital Call Notice",
  "Distribution Notice",
  "IRR Statement",
  "Tax Document",
  "Portfolio Update",
  "Fund Report",
  "Other Document",
];

function classifyDocument(fileName: string) {
  const name = fileName.toLowerCase();

  if (
    name.includes("irr") ||
    name.includes("xirr") ||
    name.includes("performance")
  ) {
    return "IRR Statement";
  }

  if (
    name.includes("capital") ||
    name.includes("call") ||
    name.includes("drawdown")
  ) {
    return "Capital Call Notice";
  }

  if (
    name.includes("distribution") ||
    name.includes("payout") ||
    name.includes("redemption")
  ) {
    return "Distribution Notice";
  }

  if (
    name.includes("tax") ||
    name.includes("64c") ||
    name.includes("64d") ||
    name.includes("form")
  ) {
    return "Tax Document";
  }

  if (
    name.includes("portfolio") ||
    name.includes("company") ||
    name.includes("investment")
  ) {
    return "Portfolio Update";
  }

  if (
    name.includes("report") ||
    name.includes("quarterly") ||
    name.includes("annual")
  ) {
    return "Fund Report";
  }

  if (
    name.includes("soa") ||
    name.includes("statement") ||
    name.includes("account")
  ) {
    return "SOA";
  }

  return "Other Document";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchInvestor(fileName: string, investors: Investor[]) {
  const normalizedFile = normalize(fileName);

  const codeMatch = investors.find((investor) =>
    normalizedFile.includes(normalize(investor.investor_code))
  );

  if (codeMatch) {
    return {
      investor: codeMatch,
      confidence: 96,
      reason: "Matched using investor code in filename",
    };
  }

  const emailMatch = investors.find((investor) => {
    const emailName = investor.email.split("@")[0];
    return normalizedFile.includes(normalize(emailName));
  });

  if (emailMatch) {
    return {
      investor: emailMatch,
      confidence: 88,
      reason: "Matched using email reference in filename",
    };
  }

  const nameMatch = investors.find((investor) => {
    const cleanName = normalize(investor.investor_name);
    return cleanName.length > 6 && normalizedFile.includes(cleanName.slice(0, 8));
  });

  if (nameMatch) {
    return {
      investor: nameMatch,
      confidence: 74,
      reason: "Matched using investor name similarity",
    };
  }

  return {
    investor: null,
    confidence: 0,
    reason: "No investor match found",
  };
}

function buildDocumentsFromFileNames(fileNames: string[], investors: Investor[]) {
  return fileNames.map((fileName, index) => {
    const match = matchInvestor(fileName, investors);
    const category = classifyDocument(fileName);
    const status =
      match.investor && category !== "Other Document" ? "Ready" : "Review";

    return {
      id: `${fileName}-${index}`,
      fileName,
      category,
      matchedInvestorCode: match.investor?.investor_code || "",
      matchedInvestorName: match.investor?.investor_name || "",
      confidence: match.confidence,
      status,
      reason:
        status === "Ready"
          ? match.reason
          : category === "Other Document"
          ? "Document type needs review"
          : match.reason,
    } satisfies MigrationDocument;
  });
}

function generateDemoDocumentDump(investors: Investor[]) {
  const selectedInvestors = investors.slice(0, 150);
  const fileNames: string[] = [];

  selectedInvestors.forEach((investor) => {
    fileNames.push(`${investor.investor_code}_SOA_FY2025.pdf`);
    fileNames.push(`${investor.investor_code}_Capital_Call_Notice_Q1.pdf`);
    fileNames.push(`${investor.investor_code}_Distribution_Notice_Mar2025.pdf`);
    fileNames.push(`${investor.investor_code}_IRR_Statement_FY2025.pdf`);
  });

  fileNames.push("Unmatched_SOA_Final_OldFolder.pdf");
  fileNames.push("UnknownInvestor_Distribution_2024.pdf");
  fileNames.push("Portfolio_Update_without_investor_code.pdf");
  fileNames.push("Random_Scan_File_001.pdf");

  return fileNames;
}

function getCategoryCounts(documents: MigrationDocument[]) {
  return documentCategories.map((category) => ({
    category,
    count: documents.filter((document) => document.category === category)
      .length,
  }));
}

export default function InvestorPortalMigrationPage() {
  const [latestBatch, setLatestBatch] = useState<ImportBatch | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [documents, setDocuments] = useState<MigrationDocument[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [published, setPublished] = useState(false);

  async function loadLatestInvestorBatch() {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setMessage("Supabase is not configured. Please check .env.local.");
      return;
    }

    setIsLoading(true);
    setMessage("Loading latest investor import batch...");

    const { data: batches, error: batchError } = await supabaseClient
      .from("investor_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (batchError) {
      setMessage(batchError.message);
      setIsLoading(false);
      return;
    }

    const batch = (batches || [])[0] as ImportBatch | undefined;

    if (!batch) {
      setMessage("No investor import batch found. Run Investor Import Engine first.");
      setIsLoading(false);
      return;
    }

    const { data: investorRows, error: investorError } = await supabaseClient
      .from("investor_master")
      .select("*")
      .eq("batch_id", batch.id)
      .order("investor_code", { ascending: true });

    if (investorError) {
      setMessage(investorError.message);
      setIsLoading(false);
      return;
    }

    setLatestBatch(batch);
    setInvestors((investorRows || []) as Investor[]);
    setDocuments([]);
    setPublished(false);
    setMessage(`${(investorRows || []).length} investors loaded from latest import batch.`);
    setIsLoading(false);
  }

  function handleGenerateDemoDump() {
    if (investors.length === 0) {
      setMessage("Load latest investor batch first.");
      return;
    }

    const fileNames = generateDemoDocumentDump(investors);
    const mappedDocuments = buildDocumentsFromFileNames(fileNames, investors);

    setDocuments(mappedDocuments);
    setPublished(false);
    setMessage(
      `${mappedDocuments.length} historical investor documents classified and matched.`
    );
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    if (investors.length === 0) {
      setMessage("Load latest investor batch before uploading documents.");
      return;
    }

    const files = Array.from(event.target.files || []);
    const fileNames = files.map((file) => file.name);
    const mappedDocuments = buildDocumentsFromFileNames(fileNames, investors);

    setDocuments(mappedDocuments);
    setPublished(false);
    setMessage(`${mappedDocuments.length} uploaded PDF filenames classified.`);
  }

  function handlePublishPreview() {
    if (documents.length === 0) {
      setMessage("Classify documents before publishing.");
      return;
    }

    const reviewCount = documents.filter(
      (document) => document.status === "Review"
    ).length;

    if (reviewCount > 0) {
      setMessage(
        `${reviewCount} documents still need review. Commercial version will require confirmation before publishing.`
      );
      return;
    }

    setPublished(true);
    setMessage(
      "Investor document migration preview is ready for Investor Portal publishing."
    );
  }

  const stats = useMemo(() => {
    const totalDocuments = documents.length;
    const readyDocuments = documents.filter(
      (document) => document.status === "Ready"
    ).length;
    const reviewDocuments = documents.filter(
      (document) => document.status === "Review"
    ).length;
    const matchedDocuments = documents.filter(
      (document) => document.matchedInvestorCode
    ).length;
    const uniqueInvestorsMatched = new Set(
      documents
        .filter((document) => document.matchedInvestorCode)
        .map((document) => document.matchedInvestorCode)
    ).size;

    return {
      totalDocuments,
      readyDocuments,
      reviewDocuments,
      matchedDocuments,
      uniqueInvestorsMatched,
      matchRate:
        totalDocuments > 0
          ? Math.round((matchedDocuments / totalDocuments) * 100)
          : 0,
    };
  }, [documents]);

  const categoryCounts = useMemo(
    () => getCategoryCounts(documents),
    [documents]
  );

  return (
    <main className="ipm-page">
      <style>{`
        .ipm-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 34rem),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 30rem),
            #070d1a;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 32px;
        }

        .ipm-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .ipm-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 44px;
        }

        .ipm-brand strong {
          display: block;
          font-size: 18px;
          letter-spacing: 0.18em;
        }

        .ipm-brand span {
          color: #8ea4c8;
          font-size: 13px;
        }

        .ipm-links {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ipm-links a {
          color: #dbeafe;
          text-decoration: none;
          border: 1px solid rgba(147, 197, 253, 0.28);
          background: rgba(15, 23, 42, 0.72);
          padding: 11px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
        }

        .ipm-hero {
          display: grid;
          grid-template-columns: 1.12fr 0.88fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .ipm-eyebrow {
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 900;
          margin: 0 0 14px;
        }

        .ipm-hero h1 {
          font-size: clamp(42px, 5.5vw, 70px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          margin: 0;
        }

        .ipm-card {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 13, 26, 0.92));
          border-radius: 28px;
          padding: 26px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
        }

        .ipm-card h2 {
          margin: 0 0 12px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .ipm-hero p,
        .ipm-card p {
          color: #bfd0ef;
          line-height: 1.65;
          font-size: 17px;
        }

        .ipm-stat-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin: 24px 0;
        }

        .ipm-stat {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 22px;
          padding: 20px;
        }

        .ipm-stat span {
          display: block;
          color: #8ea4c8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .ipm-stat strong {
          display: block;
          font-size: 26px;
          margin-bottom: 6px;
        }

        .ipm-grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }

        .ipm-button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        .ipm-primary,
        .ipm-secondary,
        .ipm-file-label {
          min-height: 46px;
          border-radius: 999px;
          padding: 0 20px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .ipm-primary {
          border: 0;
          background: #ffffff;
          color: #071022;
        }

        .ipm-secondary,
        .ipm-file-label {
          border: 1px solid rgba(147, 197, 253, 0.28);
          background: rgba(15, 23, 42, 0.72);
          color: #dbeafe;
        }

        .ipm-file-label input {
          display: none;
        }

        .ipm-message {
          margin-top: 18px;
          border: 1px solid rgba(96, 165, 250, 0.35);
          background: rgba(30, 64, 175, 0.2);
          color: #dbeafe;
          border-radius: 18px;
          padding: 16px;
          line-height: 1.6;
        }

        .ipm-list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .ipm-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.62);
          border-radius: 18px;
          padding: 15px;
        }

        .ipm-row span {
          color: #9eb2d4;
        }

        .ipm-table-wrap {
          margin-top: 20px;
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.14);
          border-radius: 22px;
        }

        table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(147, 197, 253, 0.1);
          text-align: left;
          font-size: 14px;
        }

        th {
          color: #93c5fd;
          background: rgba(15, 23, 42, 0.8);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        td {
          color: #dbeafe;
        }

        .ipm-ready {
          color: #86efac;
          font-weight: 900;
        }

        .ipm-review {
          color: #fbbf24;
          font-weight: 900;
        }

        .ipm-published {
          border: 1px solid rgba(134, 239, 172, 0.35);
          background: rgba(22, 163, 74, 0.14);
          color: #bbf7d0;
          border-radius: 18px;
          padding: 16px;
          margin-top: 18px;
          font-weight: 800;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .ipm-page {
            padding: 20px;
          }

          .ipm-hero,
          .ipm-grid-two,
          .ipm-stat-grid {
            grid-template-columns: 1fr;
          }

          .ipm-nav {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="ipm-shell">
        <nav className="ipm-nav">
          <div className="ipm-brand">
            <strong>VENTIQ</strong>
            <span>Investor Portal Migration Workspace</span>
          </div>

          <div className="ipm-links">
            <a href="/migration">Migration</a>
            <a href="/investor-import">Investor Import</a>
            <a href="/investor-portal">Investor Portal</a>
            <a href="/">Home</a>
          </div>
        </nav>

        <section className="ipm-hero">
          <div>
            <p className="ipm-eyebrow">Investor Portal Migration</p>
            <h1>Dump historical investor files. VENTIQ maps them to investors.</h1>
            <p>
              Existing funds can upload since-inception SOAs, capital calls,
              distribution notices, IRR statements, tax files and investor reports.
              VENTIQ classifies documents, matches them to investors and prepares
              them for portal publishing.
            </p>
          </div>

          <div className="ipm-card">
            <p className="ipm-eyebrow">Commercial promise</p>
            <h2>From old folders to investor login.</h2>
            <p>
              The fund should not manually rebuild every investor folder. VENTIQ
              should read the old data room, classify documents, match investor
              records and show only exceptions for review.
            </p>
          </div>
        </section>

        <section className="ipm-stat-grid">
          <div className="ipm-stat">
            <span>Investors loaded</span>
            <strong>{investors.length}</strong>
            <small>From latest batch</small>
          </div>

          <div className="ipm-stat">
            <span>Documents scanned</span>
            <strong>{stats.totalDocuments}</strong>
            <small>PDF dump preview</small>
          </div>

          <div className="ipm-stat">
            <span>Matched documents</span>
            <strong>{stats.matchedDocuments}</strong>
            <small>{stats.matchRate}% match rate</small>
          </div>

          <div className="ipm-stat">
            <span>Ready to publish</span>
            <strong>{stats.readyDocuments}</strong>
            <small>Matched and classified</small>
          </div>

          <div className="ipm-stat">
            <span>Review queue</span>
            <strong>{stats.reviewDocuments}</strong>
            <small>Needs confirmation</small>
          </div>
        </section>

        <section className="ipm-card">
          <p className="ipm-eyebrow">Migration controls</p>
          <h2>Load investors and classify document dump</h2>
          <p>
            Start by loading the latest investor import batch. Then generate a
            demo historical PDF dump or upload your own PDF filenames for
            classification and investor matching.
          </p>

          <div className="ipm-button-row">
            <button
              className="ipm-primary"
              onClick={loadLatestInvestorBatch}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Load Latest Investor Batch"}
            </button>

            <button className="ipm-secondary" onClick={handleGenerateDemoDump}>
              Generate Demo PDF Dump
            </button>

            <label className="ipm-file-label">
              Upload PDF Filenames
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileUpload}
              />
            </label>

            <button className="ipm-secondary" onClick={handlePublishPreview}>
              Publish Preview to Investor Portal
            </button>
          </div>

          {message && <div className="ipm-message">{message}</div>}

          {latestBatch && (
            <div className="ipm-message">
              Latest batch: <strong>{latestBatch.batch_name}</strong> | Fund:{" "}
              <strong>{latestBatch.fund_name}</strong>
            </div>
          )}

          {published && (
            <div className="ipm-published">
              Publishing preview complete. Next version will store these files in
              Supabase Storage and attach them to investor portal accounts.
            </div>
          )}
        </section>

        <section className="ipm-grid-two">
          <div className="ipm-card">
            <p className="ipm-eyebrow">Folder classification</p>
            <h2>Document folders created</h2>

            <div className="ipm-list">
              {categoryCounts.map((item) => (
                <div className="ipm-row" key={item.category}>
                  <span>{item.category}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="ipm-card">
            <p className="ipm-eyebrow">Investor matching logic</p>
            <h2>How VENTIQ matches old files</h2>

            <div className="ipm-list">
              <div className="ipm-row">
                <span>Primary match</span>
                <strong>Investor code</strong>
              </div>

              <div className="ipm-row">
                <span>Secondary match</span>
                <strong>Email or name</strong>
              </div>

              <div className="ipm-row">
                <span>Control layer</span>
                <strong>Exception queue</strong>
              </div>

              <div className="ipm-row">
                <span>Investor coverage</span>
                <strong>{stats.uniqueInvestorsMatched} investors</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="ipm-card" style={{ marginTop: 24 }}>
          <p className="ipm-eyebrow">Migration review</p>
          <h2>First 30 classified investor documents</h2>
          <p>
            This review table is the key commercial control. Auto-matched
            documents can be published. Review items need manual confirmation
            before going into investor accounts.
          </p>

          <div className="ipm-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File name</th>
                  <th>Folder</th>
                  <th>Matched investor</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {documents.slice(0, 30).map((document) => (
                  <tr key={document.id}>
                    <td>{document.fileName}</td>
                    <td>{document.category}</td>
                    <td>
                      {document.matchedInvestorCode
                        ? `${document.matchedInvestorCode} - ${document.matchedInvestorName}`
                        : "Unmatched"}
                    </td>
                    <td>{document.confidence}%</td>
                    <td
                      className={
                        document.status === "Ready" ? "ipm-ready" : "ipm-review"
                      }
                    >
                      {document.status}
                    </td>
                    <td>{document.reason}</td>
                  </tr>
                ))}

                {documents.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      No documents classified yet. Load investors, then generate
                      a demo dump or upload PDF filenames.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}