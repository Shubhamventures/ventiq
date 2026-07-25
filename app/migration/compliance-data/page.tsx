"use client";

import { useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type ComplianceStatus = "Ready" | "Pending" | "Review" | "Overdue";
type ComplianceRisk = "Low" | "Medium" | "High";

type ComplianceItem = {
  id: string;
  itemType: string;
  documentName: string;
  fundName: string;
  period: string;
  authority: string;
  dueDate: string;
  filingStatus: ComplianceStatus;
  evidenceAvailable: boolean;
  owner: string;
  category: string;
  riskLevel: ComplianceRisk;
  remarks: string;
};

type ComplianceDbRow = {
  id: string;
  compliance_code: string | null;
  item_type: string | null;
  document_name: string | null;
  fund_name: string | null;
  period: string | null;
  authority: string | null;
  due_date: string | null;
  filing_status: string | null;
  evidence_available: boolean | null;
  owner: string | null;
  category: string | null;
  risk_level: string | null;
  remarks: string | null;
};

const sampleComplianceItems: ComplianceItem[] = [
  {
    id: "C001",
    itemType: "SEBI Filing",
    documentName: "Quarterly Compliance Report",
    fundName: "VENTIQ Growth Fund II",
    period: "Q4 FY26",
    authority: "SEBI",
    dueDate: "2026-04-30",
    filingStatus: "Pending",
    evidenceAvailable: true,
    owner: "Compliance Officer",
    category: "Regulatory",
    riskLevel: "Medium",
    remarks: "Supporting workings available. Final filing confirmation pending.",
  },
  {
    id: "C002",
    itemType: "Tax Certificate",
    documentName: "Form 64C Investor Statement",
    fundName: "VENTIQ Growth Fund II",
    period: "FY26",
    authority: "Income Tax",
    dueDate: "2026-06-30",
    filingStatus: "Ready",
    evidenceAvailable: true,
    owner: "Finance Head",
    category: "Tax",
    riskLevel: "Low",
    remarks: "Investor-level allocation data is available for certificate generation.",
  },
  {
    id: "C003",
    itemType: "Tax Filing",
    documentName: "Form 64D Fund Statement",
    fundName: "VENTIQ Growth Fund II",
    period: "FY26",
    authority: "Income Tax",
    dueDate: "2026-06-15",
    filingStatus: "Review",
    evidenceAvailable: true,
    owner: "Finance Head",
    category: "Tax",
    riskLevel: "Medium",
    remarks: "Needs final reconciliation with investor income allocation schedule.",
  },
  {
    id: "C004",
    itemType: "Valuation Evidence",
    documentName: "Quarterly Portfolio Valuation Pack",
    fundName: "VENTIQ Growth Fund II",
    period: "Q4 FY26",
    authority: "Internal / Auditor",
    dueDate: "2026-04-20",
    filingStatus: "Ready",
    evidenceAvailable: true,
    owner: "Investment Team",
    category: "Valuation",
    riskLevel: "Low",
    remarks: "Portfolio company valuation notes and support files are available.",
  },
  {
    id: "C005",
    itemType: "Audit Evidence",
    documentName: "Investor Capital Account Reconciliation",
    fundName: "VENTIQ Growth Fund II",
    period: "FY26",
    authority: "Auditor",
    dueDate: "2026-07-31",
    filingStatus: "Review",
    evidenceAvailable: false,
    owner: "Finance Head",
    category: "Audit",
    riskLevel: "High",
    remarks: "Investor-wise reconciliation file is missing for audit pack completion.",
  },
  {
    id: "C006",
    itemType: "Governance Approval",
    documentName: "Investment Committee Approval Register",
    fundName: "VENTIQ Growth Fund II",
    period: "FY26",
    authority: "Internal",
    dueDate: "2026-03-31",
    filingStatus: "Ready",
    evidenceAvailable: true,
    owner: "Investment Team",
    category: "Governance",
    riskLevel: "Low",
    remarks: "IC approvals mapped to investment records.",
  },
];

function getRiskClass(riskLevel: ComplianceRisk) {
  if (riskLevel === "Low") return "healthy";
  if (riskLevel === "Medium") return "watch";
  return "at-risk";
}

function getStatusClass(status: ComplianceStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Pending" || status === "Review") return "watch";
  return "at-risk";
}

function normalizeComplianceStatus(value: string | null): ComplianceStatus {
  if (
    value === "Ready" ||
    value === "Pending" ||
    value === "Review" ||
    value === "Overdue"
  ) {
    return value;
  }

  return "Review";
}

function normalizeComplianceRisk(value: string | null): ComplianceRisk {
  if (value === "Low" || value === "Medium" || value === "High") {
    return value;
  }

  return "Medium";
}

function toNullableDate(value: string) {
  return value.trim() ? value : null;
}

function downloadComplianceTemplate() {
  const headers = [
    "item_type",
    "document_name",
    "fund_name",
    "period",
    "authority",
    "due_date",
    "filing_status",
    "evidence_available",
    "owner",
    "category",
    "risk_level",
    "remarks",
  ];

  const sample = [
    "SEBI Filing",
    "Quarterly Compliance Report",
    "VENTIQ Growth Fund II",
    "Q4 FY26",
    "SEBI",
    "2026-04-30",
    "Pending",
    "Yes",
    "Compliance Officer",
    "Regulatory",
    "Medium",
    "Supporting workings available",
  ];

  const csv = [headers, sample]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "ventiq-compliance-data-template.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function ComplianceDataMigrationPage() {
  const [items, setItems] = useState<ComplianceItem[]>(sampleComplianceItems);
  const [message, setMessage] = useState("");
  const [activeBatchName, setActiveBatchName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [loadingLatestBatch, setLoadingLatestBatch] = useState(false);

  function handleFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setMessage(
      `${fileList.length} compliance/evidence file(s) staged. CSV/XLSX parsing and evidence storage will be connected in the next step. You can publish current staged records to Supabase now.`
    );
  }

  const metrics = useMemo(() => {
    const evidenceReady = items.filter((item) => item.evidenceAvailable).length;

    const pendingOrReview = items.filter(
      (item) => item.filingStatus === "Pending" || item.filingStatus === "Review"
    ).length;

    const highRisk = items.filter((item) => item.riskLevel === "High").length;

    const readyItems = items.filter(
      (item) => item.filingStatus === "Ready"
    ).length;

    return {
      totalItems: items.length,
      evidenceReady,
      pendingOrReview,
      highRisk,
      readyItems,
    };
  }, [items]);

  async function publishComplianceData() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (items.length === 0) {
      setMessage("No compliance records available to publish.");
      return;
    }

    setPublishing(true);
    setMessage("Publishing compliance records to Supabase...");

    const batchName = `Compliance Data Migration Batch - ${new Date().toLocaleString()}`;

    const { data: batchData, error: batchError } = await supabase
      .from("compliance_data_migration_batches")
      .insert({
        batch_name: batchName,
        fund_name: "VENTIQ Growth Fund II",
        total_items: metrics.totalItems,
        evidence_available_count: metrics.evidenceReady,
        pending_review_count: metrics.pendingOrReview,
        high_risk_count: metrics.highRisk,
        ready_count: metrics.readyItems,
        status: "published",
      })
      .select("id")
      .single();

    if (batchError || !batchData) {
      setMessage(batchError?.message ?? "Unable to create compliance batch.");
      setPublishing(false);
      return;
    }

    const batchId = batchData.id as string;

    const payload = items.map((item) => ({
      batch_id: batchId,
      compliance_code: item.id,
      item_type: item.itemType,
      document_name: item.documentName,
      fund_name: item.fundName,
      period: item.period,
      authority: item.authority,
      due_date: toNullableDate(item.dueDate),
      filing_status: item.filingStatus,
      evidence_available: item.evidenceAvailable,
      owner: item.owner,
      category: item.category,
      risk_level: item.riskLevel,
      remarks: item.remarks,
      migration_status: "Ready",
    }));

    const { error: itemError } = await supabase
      .from("compliance_items")
      .insert(payload);

    if (itemError) {
      setMessage(itemError.message);
      setPublishing(false);
      return;
    }

    setActiveBatchName(batchName);
    setMessage(`${items.length} compliance record(s) published to Supabase.`);
    setPublishing(false);
  }

  async function loadLatestComplianceBatch() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoadingLatestBatch(true);
    setMessage("Loading latest compliance migration batch...");

    const { data: batchData, error: batchError } = await supabase
      .from("compliance_data_migration_batches")
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
      setMessage("No compliance migration batch found yet.");
      setLoadingLatestBatch(false);
      return;
    }

    const batchId = batchData.id as string;
    const batchName =
      (batchData.batch_name as string) ?? "Latest compliance batch";

    const { data: complianceData, error: complianceError } = await supabase
      .from("compliance_items")
      .select(
        "id, compliance_code, item_type, document_name, fund_name, period, authority, due_date, filing_status, evidence_available, owner, category, risk_level, remarks"
      )
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (complianceError) {
      setMessage(complianceError.message);
      setLoadingLatestBatch(false);
      return;
    }

    const dbRows = (complianceData as ComplianceDbRow[] | null) ?? [];

    const loadedItems: ComplianceItem[] = dbRows.map((item) => ({
      id: item.compliance_code ?? item.id,
      itemType: item.item_type ?? "Not provided",
      documentName: item.document_name ?? "Unknown Compliance Document",
      fundName: item.fund_name ?? "VENTIQ Growth Fund II",
      period: item.period ?? "Not provided",
      authority: item.authority ?? "Not provided",
      dueDate: item.due_date ?? "",
      filingStatus: normalizeComplianceStatus(item.filing_status),
      evidenceAvailable: Boolean(item.evidence_available),
      owner: item.owner ?? "Not provided",
      category: item.category ?? "Not provided",
      riskLevel: normalizeComplianceRisk(item.risk_level),
      remarks: item.remarks ?? "No remarks provided.",
    }));

    setItems(loadedItems);
    setActiveBatchName(batchName);
    setMessage(
      `${loadedItems.length} compliance record(s) loaded from latest batch.`
    );
    setLoadingLatestBatch(false);
  }

  return (
    <main className="portfolio-migration-page">
      <section className="portfolio-shell">
        <div className="portfolio-hero">
          <div>
            <p className="portfolio-eyebrow">
              <span>VENTIQ</span> Migration Portal
            </p>

            <h1>Compliance Data Migration</h1>

            <p className="portfolio-hero-copy">
              Upload regulatory filings, tax certificates, audit evidence,
              valuation support, trustee records and approval documents. This
              becomes the operating layer for Compliance, Audit, Finance and
              Managing Partner dashboards.
            </p>

            <div className="portfolio-tags">
              <span>SEBI filings</span>
              <span>Tax evidence</span>
              <span>Audit trail</span>
              <span>Valuation support</span>
              <span>Approvals</span>
              <span>Exceptions</span>
            </div>
          </div>

          <div className="portfolio-hero-visual" aria-hidden="true">
            <div className="database-orb">◎</div>

            <div className="data-lines">
              <span />
              <span />
              <span />
            </div>

            <div className="mini-dashboard-card">
              <i />
              <i />
              <i />
            </div>
          </div>

          <a className="portfolio-back-link" href="/migration/data-intake">
            ← Back to Data Intake
          </a>
        </div>

        <div className="portfolio-persistence-panel">
          <div>
            <span>Saved compliance workspace</span>
            <strong>
              {activeBatchName || "No compliance batch loaded"}
            </strong>
            <p>
              Publish compliance records to Supabase or reload the latest saved
              batch to continue after refresh.
            </p>
          </div>

          <div className="portfolio-persistence-actions">
            <button
              className="portfolio-secondary-button"
              disabled={loadingLatestBatch}
              onClick={loadLatestComplianceBatch}
              type="button"
            >
              {loadingLatestBatch ? "Loading..." : "Load Latest Batch"}
            </button>

            <button
              className="portfolio-primary-button"
              disabled={publishing}
              onClick={publishComplianceData}
              type="button"
            >
              {publishing ? "Publishing..." : "Publish Compliance Data"}
            </button>
          </div>
        </div>

        <div className="portfolio-upload-card">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⇧</span>

              <div>
                <p className="portfolio-eyebrow">
                  Compliance Upload Workspace
                </p>
                <h2>Upload compliance and evidence data</h2>
              </div>
            </div>

            <span className="portfolio-status-pill purple">
              Template + evidence files
            </span>
          </div>

          <div className="portfolio-upload-grid">
            <div className="portfolio-step-card">
              <span className="step-number">1</span>

              <h3>Download template</h3>

              <p>
                Use VENTIQ fields for item type, document name, period,
                authority, due date, filing status, owner, risk and remarks.
              </p>

              <button
                className="portfolio-primary-button"
                onClick={downloadComplianceTemplate}
                type="button"
              >
                ↓ Download Compliance Template
              </button>
            </div>

            <div className="portfolio-step-card">
              <span className="step-number">2</span>

              <h3>Upload completed files</h3>

              <p>
                Upload compliance tracker, tax workings, audit evidence,
                valuation support and approval documents.
              </p>

              <label className="portfolio-dropzone">
                <input
                  accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                  multiple
                  onChange={(event) => handleFileSelected(event.target.files)}
                  type="file"
                />

                <span>⇧</span>
                <strong>Choose compliance files</strong>
                <small>CSV/XLSX/PDF/DOC upload</small>
              </label>
            </div>
          </div>

          {message && <div className="portfolio-note">{message}</div>}
        </div>

        <div className="portfolio-kpi-grid">
          <div className="portfolio-kpi-card blue">
            <span>▥</span>
            <p>Total compliance items</p>
            <h3>{metrics.totalItems}</h3>
          </div>

          <div className="portfolio-kpi-card green">
            <span>✓</span>
            <p>Evidence available</p>
            <h3>{metrics.evidenceReady}</h3>
          </div>

          <div className="portfolio-kpi-card purple">
            <span>◷</span>
            <p>Pending / review</p>
            <h3>{metrics.pendingOrReview}</h3>
          </div>

          <div className="portfolio-kpi-card amber">
            <span>◇</span>
            <p>High-risk exceptions</p>
            <h3>{metrics.highRisk}</h3>
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">▥</span>

              <div>
                <p className="portfolio-eyebrow">
                  Compliance Migration Preview
                </p>
                <h2>Compliance records staged for dashboard activation</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">
              {items.length} records
            </span>
          </div>

          <div className="portfolio-record-list">
            {items.map((item) => (
              <details className="portfolio-record-card" key={item.id}>
                <summary>
                  <div className={`company-icon ${getRiskClass(item.riskLevel)}`}>
                    {item.category.charAt(0)}
                  </div>

                  <div className="company-main">
                    <strong>{item.documentName}</strong>
                    <span>
                      {item.itemType} · {item.period}
                    </span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Authority</small>
                    <span>{item.authority}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Due date</small>
                    <span>{item.dueDate || "Not provided"}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Owner</small>
                    <span>{item.owner}</span>
                  </div>

                  <div className="portfolio-record-field">
                    <small>Evidence</small>
                    <span>{item.evidenceAvailable ? "Available" : "Missing"}</span>
                  </div>

                  <span
                    className={`risk-badge ${getStatusClass(
                      item.filingStatus
                    )}`}
                  >
                    {item.filingStatus}
                  </span>

                  <span className="record-chevron">⌄</span>
                </summary>

                <div className="portfolio-record-details">
                  <div>
                    <small>Fund</small>
                    <strong>{item.fundName}</strong>
                  </div>

                  <div>
                    <small>Category</small>
                    <strong>{item.category}</strong>
                  </div>

                  <div>
                    <small>Risk level</small>
                    <strong>{item.riskLevel}</strong>
                  </div>

                  <div>
                    <small>Remarks</small>
                    <strong>{item.remarks}</strong>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">◷</span>

              <div>
                <p className="portfolio-eyebrow">
                  Exception & Evidence Tracker
                </p>
                <h2>Missing evidence and review items</h2>
              </div>
            </div>

            <span className="portfolio-status-pill">
              {metrics.pendingOrReview} item(s) need attention
            </span>
          </div>

          <div className="exit-card-grid">
            {items
              .filter(
                (item) =>
                  item.filingStatus !== "Ready" || !item.evidenceAvailable
              )
              .map((item) => (
                <div
                  className={`exit-card ${getRiskClass(item.riskLevel)}`}
                  key={`${item.id}-exception`}
                >
                  <div className="company-icon-row">
                    <div className={`company-icon ${getRiskClass(item.riskLevel)}`}>
                      !
                    </div>

                    <strong>{item.documentName}</strong>
                  </div>

                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd>{item.filingStatus}</dd>
                    </div>

                    <div>
                      <dt>Evidence</dt>
                      <dd>{item.evidenceAvailable ? "Available" : "Missing"}</dd>
                    </div>

                    <div>
                      <dt>Owner</dt>
                      <dd>{item.owner}</dd>
                    </div>

                    <div>
                      <dt>Action note</dt>
                      <dd>{item.remarks}</dd>
                    </div>
                  </dl>
                </div>
              ))}
          </div>
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-section-header">
            <div>
              <span className="portfolio-section-icon">⌘</span>

              <div>
                <h2>Where this compliance data flows</h2>
              </div>
            </div>
          </div>

          <div className="portfolio-flow-grid">
            <div className="portfolio-flow-card blue">
              <span>◔</span>
              <strong>Compliance Dashboard</strong>
              <p>
                Filing status, due dates, owners, risks and evidence availability
                become live compliance signals.
              </p>
            </div>

            <div className="portfolio-flow-card green">
              <span>●</span>
              <strong>Finance Head Workspace</strong>
              <p>
                Tax certificates, investor income allocation, audit evidence and
                reconciliation support flow into finance workflows.
              </p>
            </div>

            <div className="portfolio-flow-card purple">
              <span>▥</span>
              <strong>Audit Trail</strong>
              <p>
                Every uploaded evidence file, tracker and approval can be tied to
                fund, period, owner and obligation.
              </p>
            </div>

            <div className="portfolio-flow-card amber">
              <span>◎</span>
              <strong>Managing Partner Dashboard</strong>
              <p>
                High-risk exceptions, overdue filings and missing evidence become
                leadership-level operating signals.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}