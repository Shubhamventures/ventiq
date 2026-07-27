"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

type ComplianceActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};

function getString(row: DataRow | undefined, keys: string[], fallback = "-") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumber(row: DataRow | undefined, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function getId(row: DataRow | undefined) {
  return getString(row, ["id"], "");
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDaysUntil(value: unknown) {
  if (typeof value !== "string" || !value) return null;

  const dueDate = new Date(value);
  const today = new Date();

  if (Number.isNaN(dueDate.getTime())) return null;

  const diff = dueDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDueLabel(value: unknown) {
  const days = getDaysUntil(value);

  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days} day(s)`;
}

function getRiskEmoji(value: string) {
  const risk = value.toLowerCase();

  if (risk.includes("low") || risk.includes("ready")) return "🟢";
  if (risk.includes("medium") || risk.includes("pending")) return "🟡";
  if (risk.includes("high") || risk.includes("overdue")) return "🔴";

  return "⚪";
}

function getActivityIcon(status: string) {
  const value = status.toLowerCase();

  if (value.includes("ready")) return "🟢";
  if (value.includes("pending")) return "🟡";
  if (value.includes("review")) return "🔴";
  if (value.includes("overdue")) return "🔴";
  if (value.includes("evidence")) return "🧾";
  if (value.includes("pdf")) return "📄";
  if (value.includes("filing")) return "📮";
  if (value.includes("tax")) return "💼";
  if (value.includes("audit")) return "🔍";
  if (value.includes("valuation")) return "📊";
  if (value.includes("imported")) return "📥";
  if (value.includes("regulatory")) return "⚖️";

  return "⚪";
}

function hasEvidence(row: DataRow) {
  const directValue = row["evidence_available"];

  if (directValue === true) return true;

  const evidenceStatus = getString(
    row,
    [
      "evidence_available",
      "evidence_status",
      "evidence",
      "document_status",
      "supporting_document_status",
    ],
    ""
  ).toLowerCase();

  return (
    evidenceStatus === "true" ||
    evidenceStatus === "yes" ||
    evidenceStatus === "available" ||
    evidenceStatus === "uploaded" ||
    evidenceStatus === "ready" ||
    evidenceStatus === "stored"
  );
}

function isPendingStatus(row: DataRow) {
  const status = getString(
    row,
    ["filing_status", "migration_status", "status"],
    ""
  ).toLowerCase();

  return (
    status === "pending" ||
    status === "review" ||
    status === "under review" ||
    status === "needs review" ||
    status === "overdue" ||
    status.includes("pending") ||
    status.includes("review")
  );
}

function isReadyStatus(row: DataRow) {
  const status = getString(
    row,
    ["filing_status", "migration_status", "status"],
    ""
  ).toLowerCase();

  return (
    status === "ready" ||
    status === "filed" ||
    status === "completed" ||
    status === "complete" ||
    status === "available" ||
    status === "published"
  );
}

function isHighRisk(row: DataRow) {
  const risk = getString(row, ["risk_level", "risk_status"], "").toLowerCase();

  return (
    risk === "high" ||
    risk.includes("high") ||
    risk.includes("risk") ||
    risk.includes("overdue")
  );
}

function getDocumentTitle(row: DataRow) {
  return getString(
    row,
    ["document_name", "filing_name", "item_name", "title", "file_name"],
    "Compliance item"
  );
}

export default function ComplianceAIPage() {
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);
  const [latestPortfolioBatch, setLatestPortfolioBatch] =
    useState<DataRow | null>(null);
  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);

  const [complianceItems, setComplianceItems] = useState<DataRow[]>([]);
  const [fundMasterRows, setFundMasterRows] = useState<DataRow[]>([]);
  const [portfolioInvestments, setPortfolioInvestments] = useState<DataRow[]>(
    []
  );
  const [investorMasterRows, setInvestorMasterRows] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [pdfIntelligenceDocuments, setPdfIntelligenceDocuments] = useState<
    DataRow[]
  >([]);
  const [regulatoryMatches, setRegulatoryMatches] = useState<DataRow[]>([]);
  const [regulatoryCirculars, setRegulatoryCirculars] = useState<DataRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadComplianceWorkspace() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The sample Compliance workspace is temporarily unavailable. Please request a walkthrough."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const db = supabase as any;

    async function selectRows(
      tableName: string,
      options?: {
        orderBy?: string;
        ascending?: boolean;
        eq?: {
          column: string;
          value: string;
        };
      }
    ) {
      try {
        let query = db.from(tableName).select("*");

        if (options?.eq) {
          query = query.eq(options.eq.column, options.eq.value);
        }

        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? false,
          });
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            `VENTIQ compliance dashboard skipped ${tableName}:`,
            error.message
          );
          return [] as DataRow[];
        }

        return (data ?? []) as DataRow[];
      } catch (error) {
        console.warn(`VENTIQ compliance dashboard skipped ${tableName}:`, error);
        return [] as DataRow[];
      }
    }

    async function latestRow(tableName: string) {
      try {
        const { data, error } = await db
          .from(tableName)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn(
            `VENTIQ compliance dashboard skipped latest ${tableName}:`,
            error.message
          );
          return null;
        }

        return (data as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          `VENTIQ compliance dashboard skipped latest ${tableName}:`,
          error
        );
        return null;
      }
    }

    try {
      const [
        complianceRows,
        fundRows,
        portfolioRows,
        investorRows,
        investorDocumentRows,
        pdfDocumentRows,
        matchesRows,
        circularRows,

        complianceBatch,
        pdfBatch,
        fundBatch,
        portfolioBatch,
        investorBatch,
      ] = await Promise.all([
        selectRows("compliance_items"),
        selectRows("fund_master"),
        selectRows("portfolio_investments"),
        selectRows("investor_master"),
        selectRows("investor_documents"),
        selectRows("pdf_intelligence_documents"),
        selectRows("regulatory_source_matches", {
          eq: {
            column: "status",
            value: "needs_review",
          },
        }),
        selectRows("regulatory_circulars", {
          eq: {
            column: "status",
            value: "active",
          },
        }),

        latestRow("compliance_data_migration_batches"),
        latestRow("pdf_intelligence_batches"),
        latestRow("fund_data_migration_batches"),
        latestRow("portfolio_data_migration_batches"),
        latestRow("investor_import_batches"),
      ]);

      setComplianceItems(complianceRows);
      setFundMasterRows(fundRows);
      setPortfolioInvestments(portfolioRows);
      setInvestorMasterRows(investorRows);
      setInvestorDocuments(investorDocumentRows);
      setPdfIntelligenceDocuments(pdfDocumentRows);
      setRegulatoryMatches(matchesRows);
      setRegulatoryCirculars(circularRows);

      setLatestComplianceBatch(complianceBatch);
      setLatestPdfBatch(pdfBatch);
      setLatestFundBatch(fundBatch);
      setLatestPortfolioBatch(portfolioBatch);
      setLatestInvestorBatch(investorBatch);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Compliance workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplianceWorkspace();
  }, []);

  const complianceMetrics = useMemo(() => {
    const batchTotalItems = getNumber(latestComplianceBatch ?? undefined, [
      "total_items",
    ]);

    const batchEvidenceAvailable = getNumber(
      latestComplianceBatch ?? undefined,
      ["evidence_available_count"]
    );

    const batchPendingReview = getNumber(latestComplianceBatch ?? undefined, [
      "pending_review_count",
    ]);

    const batchHighRisk = getNumber(latestComplianceBatch ?? undefined, [
      "high_risk_count",
    ]);

    const batchReady = getNumber(latestComplianceBatch ?? undefined, [
      "ready_count",
    ]);

    const rowEvidenceAvailable = complianceItems.filter(hasEvidence).length;

    const rowPendingReview = complianceItems.filter(isPendingStatus).length;

    const rowHighRisk = complianceItems.filter(isHighRisk).length;

    const rowReady = complianceItems.filter(isReadyStatus).length;

    const totalItems = batchTotalItems || complianceItems.length;
    const evidenceAvailable = batchEvidenceAvailable || rowEvidenceAvailable;
    const pendingReview = batchPendingReview || rowPendingReview;
    const highRiskItems = batchHighRisk || rowHighRisk;
    const readyItems = batchReady || rowReady;

    const missingEvidence = Math.max(totalItems - evidenceAvailable, 0);

    const pdfReadyRows = pdfIntelligenceDocuments.filter((row) => {
      const status = getString(row, ["status"], "").toLowerCase();

      return status.includes("ready") || status.includes("published");
    }).length;

    const pdfReviewRows = pdfIntelligenceDocuments.filter((row) => {
      const status = getString(row, ["status"], "").toLowerCase();

      return (
        status.includes("review") ||
        status.includes("unmatched") ||
        status.includes("failed")
      );
    }).length;

    const pdfTotal = Math.max(
      getNumber(latestPdfBatch ?? undefined, ["total_files"]),
      pdfIntelligenceDocuments.length,
      investorDocuments.length
    );

    const pdfReady = Math.max(
      getNumber(latestPdfBatch ?? undefined, ["ready_files"]),
      pdfReadyRows
    );

    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]) +
      pdfReviewRows;

    const fundCount =
      getNumber(latestFundBatch ?? undefined, ["total_funds"]) ||
      fundMasterRows.length ||
      new Set(
        complianceItems
          .map((row) => getString(row, ["fund_name"], ""))
          .filter(Boolean)
      ).size;

    const portfolioRecordCount =
      getNumber(latestPortfolioBatch ?? undefined, ["total_records"]) ||
      portfolioInvestments.length;

    const investorRecordCount =
      getNumber(latestInvestorBatch ?? undefined, ["total_records"]) ||
      investorMasterRows.length;

    const sebiItems = complianceItems.filter((row) => {
      const authority = getString(row, ["authority"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const category = getString(row, ["category"], "").toLowerCase();

      return (
        authority.includes("sebi") ||
        itemType.includes("sebi") ||
        category.includes("sebi")
      );
    }).length;

    const taxItems = complianceItems.filter((row) => {
      const authority = getString(row, ["authority"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const documentName = getDocumentTitle(row).toLowerCase();

      return (
        authority.includes("tax") ||
        itemType.includes("tax") ||
        documentName.includes("64c") ||
        documentName.includes("64d") ||
        documentName.includes("tax")
      );
    }).length;

    const auditItems = complianceItems.filter((row) => {
      const category = getString(row, ["category"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const documentName = getDocumentTitle(row).toLowerCase();

      return (
        category.includes("audit") ||
        itemType.includes("audit") ||
        documentName.includes("audit")
      );
    }).length;

    const valuationItems = complianceItems.filter((row) => {
      const category = getString(row, ["category"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const documentName = getDocumentTitle(row).toLowerCase();

      return (
        category.includes("valuation") ||
        itemType.includes("valuation") ||
        documentName.includes("valuation")
      );
    }).length;

    const trusteeItems = complianceItems.filter((row) => {
      const category = getString(row, ["category"], "").toLowerCase();
      const authority = getString(row, ["authority"], "").toLowerCase();
      const documentName = getDocumentTitle(row).toLowerCase();

      return (
        category.includes("trustee") ||
        authority.includes("trustee") ||
        documentName.includes("trustee")
      );
    }).length;

    const dueSoonItems = complianceItems.filter((row) => {
      const days = getDaysUntil(row["due_date"]);

      return days !== null && days >= 0 && days <= 15;
    }).length;

    const overdueItems = complianceItems.filter((row) => {
      const days = getDaysUntil(row["due_date"]);
      const status = getString(
        row,
        ["filing_status", "migration_status", "status"],
        ""
      ).toLowerCase();

      return (
        (days !== null && days < 0) ||
        status === "overdue" ||
        status.includes("overdue")
      );
    }).length;

    const storedInvestorDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url", "storage_path", "file_url"], ""))
    ).length;

    const portfolioLinkedItems = complianceItems.filter((row) => {
      const linkedCompany = getString(
        row,
        ["portfolio_company", "portfolio_company_name", "company_name"],
        ""
      );

      return Boolean(linkedCompany);
    }).length;

    const ownerAssignedItems = complianceItems.filter((row) => {
      const owner = getString(row, ["owner", "responsible_person"], "");

      return Boolean(owner);
    }).length;

    const evidenceReadinessScore = Math.min(
      95,
      Math.max(
        0,
        45 +
          Math.min(25, evidenceAvailable * 5) +
          Math.min(10, readyItems * 3) +
          Math.min(10, pdfReady * 2) +
          Math.min(10, ownerAssignedItems * 2) -
          Math.min(20, missingEvidence * 4) -
          Math.min(15, highRiskItems * 5) -
          Math.min(10, overdueItems * 4)
      )
    );

    return {
      totalItems,
      evidenceAvailable,
      missingEvidence,
      pendingReview,
      highRiskItems,
      readyItems,
      pdfTotal,
      pdfReady,
      pdfReview,
      fundCount,
      portfolioRecordCount,
      investorRecordCount,
      sebiItems,
      taxItems,
      auditItems,
      valuationItems,
      trusteeItems,
      dueSoonItems,
      overdueItems,
      storedInvestorDocuments,
      portfolioLinkedItems,
      ownerAssignedItems,
      pendingRegulatoryMatches: regulatoryMatches.length,
      activeRegulatoryCirculars: regulatoryCirculars.length,
      evidenceReadinessScore,
    };
  }, [
    latestComplianceBatch,
    latestPdfBatch,
    latestFundBatch,
    latestPortfolioBatch,
    latestInvestorBatch,
    complianceItems,
    fundMasterRows,
    portfolioInvestments,
    investorMasterRows,
    investorDocuments,
    pdfIntelligenceDocuments,
    regulatoryMatches,
    regulatoryCirculars,
  ]);

  const priorityItems = useMemo(() => {
    return complianceItems
      .filter((row) => {
        const status = getString(
          row,
          ["filing_status", "migration_status", "status"],
          ""
        ).toLowerCase();

        const risk = getString(row, ["risk_level", "risk_status"], "")
          .toLowerCase();
        const days = getDaysUntil(row["due_date"]);

        return (
          status === "pending" ||
          status === "review" ||
          status === "overdue" ||
          status.includes("pending") ||
          status.includes("review") ||
          risk === "high" ||
          risk.includes("high") ||
          !hasEvidence(row) ||
          (days !== null && days <= 15)
        );
      })
      .slice(0, 8);
  }, [complianceItems]);

  const filingCalendarRows = useMemo(() => {
    return complianceItems
      .filter((row) => Boolean(getString(row, ["due_date"], "")))
      .sort((a, b) => {
        const aTime = new Date(getString(a, ["due_date"], "")).getTime();
        const bTime = new Date(getString(b, ["due_date"], "")).getTime();

        return aTime - bTime;
      })
      .slice(0, 8);
  }, [complianceItems]);

  const missingEvidenceRows = useMemo(() => {
    return complianceItems.filter((row) => !hasEvidence(row)).slice(0, 8);
  }, [complianceItems]);

  const ownerQueueRows = useMemo(() => {
    return complianceItems
      .filter((row) => Boolean(getString(row, ["owner", "responsible_person"], "")))
      .slice(0, 8);
  }, [complianceItems]);

  const fundWiseRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        fundName: string;
        total: number;
        pending: number;
        highRisk: number;
        evidence: number;
      }
    >();

    complianceItems.forEach((row) => {
      const fundName = getString(row, ["fund_name"], "Unmapped fund");

      const existing =
        grouped.get(fundName) ??
        {
          fundName,
          total: 0,
          pending: 0,
          highRisk: 0,
          evidence: 0,
        };

      existing.total += 1;

      if (isPendingStatus(row)) {
        existing.pending += 1;
      }

      if (isHighRisk(row)) {
        existing.highRisk += 1;
      }

      if (hasEvidence(row)) {
        existing.evidence += 1;
      }

      grouped.set(fundName, existing);
    });

    return Array.from(grouped.values()).slice(0, 8);
  }, [complianceItems]);

  const complianceActivityEvents = useMemo(() => {
    const events: ComplianceActivityEvent[] = [];

    if (latestComplianceBatch) {
      events.push({
        id: `compliance-batch-${getId(latestComplianceBatch)}`,
        time: getString(latestComplianceBatch, ["created_at"], ""),
        module: "Compliance Migration",
        title: "Compliance data batch loaded",
        description: `${getNumber(
          latestComplianceBatch,
          ["total_items"]
        )} compliance item(s), ${getNumber(
          latestComplianceBatch,
          ["high_risk_count"]
        )} high-risk item(s).`,
        status: "evidence imported",
      });
    }

    complianceItems.slice(0, 10).forEach((row) => {
      const documentName = getDocumentTitle(row);
      const filingStatus = getString(
        row,
        ["filing_status", "migration_status", "status"],
        "Review"
      );
      const riskLevel = getString(row, ["risk_level"], "Medium");
      const authority = getString(row, ["authority"], "Authority not provided");

      events.push({
        id: `compliance-item-${getId(row)}`,
        time: getString(row, ["created_at", "due_date"], ""),
        module: "Compliance Evidence",
        title: `${documentName} reviewed`,
        description: `${authority} • Status: ${filingStatus} • Risk: ${riskLevel}`,
        status: filingStatus,
      });
    });

    if (latestPdfBatch) {
      const reviewCount =
        getNumber(latestPdfBatch, ["review_files"]) +
        getNumber(latestPdfBatch, ["unmatched_files"]);

      events.push({
        id: `pdf-compliance-${getId(latestPdfBatch)}`,
        time: getString(latestPdfBatch, ["created_at"], ""),
        module: "PDF Evidence",
        title: "PDF intelligence connected to compliance",
        description: `${getNumber(
          latestPdfBatch,
          ["total_files"]
        )} PDF(s) processed, ${reviewCount} requiring review.`,
        status: reviewCount > 0 ? "pdf review" : "pdf ready",
      });
    }

    regulatoryMatches.slice(0, 6).forEach((row) => {
      events.push({
        id: `regulatory-match-${getId(row)}`,
        time: getString(row, ["created_at", "matched_at"], ""),
        module: "Knowledge Hub",
        title: "Regulatory source match needs review",
        description: getString(
          row,
          ["title", "source_title", "match_reason"],
          "Regulatory item requires compliance review"
        ),
        status: "review",
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [latestComplianceBatch, latestPdfBatch, complianceItems, regulatoryMatches]);

  const complianceActions = useMemo(() => {
    return [
      {
        title: "Review high-risk compliance items",
        value: `${complianceMetrics.highRiskItems} high-risk item(s)`,
        href: "/migration/compliance-data",
        priority: complianceMetrics.highRiskItems > 0 ? "High" : "Clear",
      },
      {
        title: "Complete missing evidence",
        value: `${complianceMetrics.missingEvidence} evidence item(s) missing`,
        href: "/migration/compliance-data",
        priority: complianceMetrics.missingEvidence > 0 ? "High" : "Clear",
      },
      {
        title: "Review PDF evidence queue",
        value: `${complianceMetrics.pdfReview} PDF item(s) need review`,
        href: "/migration/pdf-intelligence",
        priority: complianceMetrics.pdfReview > 0 ? "Medium" : "Clear",
      },
      {
        title: "Review regulatory source matches",
        value: `${complianceMetrics.pendingRegulatoryMatches} regulatory match(es)`,
        href: "/knowledge-hub",
        priority:
          complianceMetrics.pendingRegulatoryMatches > 0 ? "Medium" : "Clear",
      },
      {
        title: "Review due-date calendar",
        value: `${complianceMetrics.dueSoonItems} due within 15 days`,
        href: "/migration/compliance-data",
        priority: complianceMetrics.dueSoonItems > 0 ? "Medium" : "On track",
      },
      {
        title: "Open migration readiness",
        value: `${complianceMetrics.evidenceReadinessScore}% evidence readiness`,
        href: "/migration/activation",
        priority: "Live",
      },
    ];
  }, [complianceMetrics]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Compliance Officer Workspace</h1>
            <p>
              Live compliance control tower connected to migrated regulatory,
              tax, audit, valuation, trustee, PDF evidence and fund data.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Connected compliance workspace · Reading migrated compliance, PDF,
          fund, portfolio, investor document and regulatory evidence records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Compliance Workspace...</h2>
            <p>
              VENTIQ is reading compliance obligations, due dates, owners,
              evidence availability, PDF intelligence and regulatory review
              records.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Migration Data Connected</p>
                  <h2>Live compliance data is now powering this dashboard</h2>
                </div>

                <button
                  className="monitor-btn monitor-btn-secondary"
                  onClick={loadComplianceWorkspace}
                  type="button"
                >
                  Refresh Dashboard Data
                </button>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{complianceItems.length}</h3>
                  <p>Compliance records</p>
                </div>

                <div className="impact-card">
                  <h3>{pdfIntelligenceDocuments.length}</h3>
                  <p>PDF intelligence records</p>
                </div>

                <div className="impact-card">
                  <h3>{investorDocuments.length}</h3>
                  <p>Investor document records</p>
                </div>

                <div className="impact-card">
                  <h3>{fundMasterRows.length}</h3>
                  <p>Fund records</p>
                </div>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{portfolioInvestments.length}</h3>
                  <p>Portfolio records</p>
                </div>

                <div className="impact-card">
                  <h3>{investorMasterRows.length}</h3>
                  <p>Investor records</p>
                </div>

                <div className="impact-card">
                  <h3>{complianceMetrics.missingEvidence}</h3>
                  <p>Evidence missing</p>
                </div>

                <div className="impact-card">
                  <h3>{complianceMetrics.evidenceReadinessScore}%</h3>
                  <p>Evidence readiness</p>
                </div>
              </div>

              <div className="explain-box">
                This Compliance dashboard now reads directly from
                compliance_items, compliance_data_migration_batches,
                pdf_intelligence_documents, investor_documents, fund_master,
                portfolio_investments, investor_master and regulatory source
                records.
              </div>
            </div>

            <div className="preview-card">
              <h2>Compliance Workspace Preview</h2>

              <div className="explain-box">
                VENTIQ reviewed {complianceMetrics.totalItems} migrated
                compliance item(s), {complianceMetrics.evidenceAvailable} item(s)
                with evidence available, {complianceMetrics.pendingReview} item(s)
                pending or under review, {complianceMetrics.highRiskItems}{" "}
                high-risk item(s), {complianceMetrics.pdfReview} PDF review
                item(s) and {complianceMetrics.dueSoonItems} item(s) due within
                15 days.
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/compliance-data"
                >
                  Review Compliance Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/pdf-intelligence"
                >
                  Review PDF Evidence
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/knowledge-hub"
                >
                  Review Regulatory Items
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/fund-data"
                >
                  Review Fund Data
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  View Migration Readiness
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{complianceMetrics.totalItems}</h3>
                <p>Total compliance items</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.evidenceAvailable}</h3>
                <p>Evidence available</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.pendingReview}</h3>
                <p>Pending / review</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.highRiskItems}</h3>
                <p>High-risk items</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{complianceMetrics.pdfTotal}</h3>
                <p>PDF evidence files</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.pdfReview}</h3>
                <p>PDF review queue</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.dueSoonItems}</h3>
                <p>Due within 15 days</p>
              </div>

              <div className="impact-card">
                <h3>{complianceMetrics.overdueItems}</h3>
                <p>Overdue items</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Compliance Category Snapshot</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>SEBI / regulatory items</span>
                  <strong>{complianceMetrics.sebiItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Tax items / Form 64C / Form 64D</span>
                  <strong>{complianceMetrics.taxItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Audit evidence items</span>
                  <strong>{complianceMetrics.auditItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Valuation evidence items</span>
                  <strong>{complianceMetrics.valuationItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Trustee / governance items</span>
                  <strong>{complianceMetrics.trusteeItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Portfolio-linked compliance items</span>
                  <strong>{complianceMetrics.portfolioLinkedItems}</strong>
                </div>

                <div className="journal-row">
                  <span>Fund records available</span>
                  <strong>{complianceMetrics.fundCount}</strong>
                </div>

                <div className="journal-row">
                  <span>Stored investor documents</span>
                  <strong>{complianceMetrics.storedInvestorDocuments}</strong>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Compliance Priority Radar</h2>

              {priorityItems.length === 0 && (
                <div className="explain-box">
                  No urgent compliance items found. Publish compliance evidence
                  or update filing statuses to activate this radar.
                </div>
              )}

              {priorityItems.length > 0 && (
                <div className="queue-grid">
                  {priorityItems.map((row) => {
                    const riskLevel = getString(row, ["risk_level"], "Medium");
                    const filingStatus = getString(
                      row,
                      ["filing_status", "migration_status", "status"],
                      "Review"
                    );

                    return (
                      <div className="queue-item" key={getId(row)}>
                        {getRiskEmoji(riskLevel)}{" "}
                        <strong>{getDocumentTitle(row)}</strong>
                        <br />
                        {getString(row, ["authority"], "Authority not provided")} ·{" "}
                        {getString(row, ["category"], "Category not provided")}
                        <br />
                        {getDueLabel(row["due_date"])}
                        <br />
                        Status: {filingStatus} · Risk: {riskLevel}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Filing Calendar</h2>

                {filingCalendarRows.length === 0 && (
                  <div className="explain-box">
                    No due dates found in migrated compliance data.
                  </div>
                )}

                {filingCalendarRows.length > 0 && (
                  <div className="journal-preview">
                    {filingCalendarRows.map((row) => (
                      <div className="journal-row" key={`calendar-${getId(row)}`}>
                        <span>
                          {getDocumentTitle(row)}
                          <br />
                          {getString(row, ["authority"], "Authority")} · Owner:{" "}
                          {getString(row, ["owner"], "Not assigned")}
                        </span>
                        <strong>{getDueLabel(row["due_date"])}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-side-panel">
                <h2>Ask Compliance AI</h2>

                <div className="chat-message">
                  Ask: “Which filings are due this month?”
                </div>

                <div className="chat-message">
                  Ask: “Show missing audit evidence.”
                </div>

                <div className="chat-message">
                  Ask: “Which Form 64C / 64D items need review?”
                </div>

                <div className="chat-message">
                  Ask: “Which high-risk compliance items need owner action?”
                </div>

                <div className="chat-message">
                  Ask: “Which PDF evidence files need review?”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Missing Evidence Tracker</h2>

              {missingEvidenceRows.length === 0 && (
                <div className="explain-box">
                  All migrated compliance records currently have evidence
                  marked as available.
                </div>
              )}

              {missingEvidenceRows.length > 0 && (
                <div className="queue-grid">
                  {missingEvidenceRows.map((row) => (
                    <div className="queue-item" key={`missing-${getId(row)}`}>
                      🔴 <strong>{getDocumentTitle(row)}</strong>
                      <br />
                      Owner: {getString(row, ["owner"], "Not assigned")}
                      <br />
                      Remarks: {getString(row, ["remarks"], "No remarks")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Owner-wise Compliance Queue</h2>

              {ownerQueueRows.length === 0 && (
                <div className="explain-box">
                  No owner assignments found yet in migrated compliance data.
                </div>
              )}

              {ownerQueueRows.length > 0 && (
                <div className="journal-preview">
                  {ownerQueueRows.map((row) => (
                    <div className="journal-row" key={`owner-${getId(row)}`}>
                      <span>
                        {getString(row, ["owner", "responsible_person"], "Owner")}
                        <br />
                        {getDocumentTitle(row)}
                      </span>
                      <strong>
                        {getString(
                          row,
                          ["filing_status", "migration_status", "status"],
                          "Review"
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Fund-wise Compliance Status</h2>

              {fundWiseRows.length === 0 && (
                <div className="explain-box">
                  Fund-wise compliance mapping is not available yet.
                </div>
              )}

              {fundWiseRows.length > 0 && (
                <div className="journal-preview">
                  {fundWiseRows.map((row) => (
                    <div className="journal-row" key={row.fundName}>
                      <span>
                        {row.fundName}
                        <br />
                        Evidence: {row.evidence}/{row.total} · Pending:{" "}
                        {row.pending}
                      </span>
                      <strong>{row.highRisk} high-risk</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Compliance Control Queue</h2>

              <div className="queue-grid">
                {complianceActions.map((action) => (
                  <a
                    key={action.title}
                    className="queue-item"
                    href={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <strong>{action.title}</strong>
                    <br />
                    {action.value}
                    <br />
                    Priority: {action.priority}
                  </a>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Live Compliance Activity Feed</h2>

              {complianceActivityEvents.length === 0 && (
                <div className="explain-box">
                  No compliance activity found yet. Publish compliance data,
                  process PDF evidence or approve regulatory items to activate
                  the compliance activity trail.
                </div>
              )}

              {complianceActivityEvents.length > 0 && (
                <div className="audit-timeline">
                  {complianceActivityEvents.slice(0, 12).map((event) => (
                    <div className="audit-item" key={event.id}>
                      <strong>{formatDateTime(event.time)}</strong>{" "}
                      {getActivityIcon(event.status)} {event.title}
                      <br />
                      <span>
                        {event.module} — {event.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Compliance AI Answer Preview</h2>

              <div className="explain-box">
                <strong>Question:</strong> What can delay compliance closing?
                <br />
                <br />
                <strong>VENTIQ AI:</strong>{" "}
                {complianceMetrics.highRiskItems > 0
                  ? `${complianceMetrics.highRiskItems} high-risk compliance item(s) need immediate review before closing.`
                  : complianceMetrics.missingEvidence > 0
                  ? `${complianceMetrics.missingEvidence} evidence item(s) are missing and should be uploaded before audit or filing sign-off.`
                  : complianceMetrics.pdfReview > 0
                  ? `${complianceMetrics.pdfReview} PDF evidence item(s) require review before relying on them for compliance reporting.`
                  : complianceMetrics.dueSoonItems > 0
                  ? `${complianceMetrics.dueSoonItems} compliance item(s) are due within 15 days. Owners should confirm filing status.`
                  : "Compliance records look stable. Continue monitoring regulatory updates, evidence completeness and upcoming filing dates."}
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Compliance Loop</h2>

              <div className="queue-grid">
                <div className="queue-item">Compliance Data Imported</div>
                <div className="queue-item">Evidence Availability Checked</div>
                <div className="queue-item">PDF Evidence Reviewed</div>
                <div className="queue-item">Due Dates Tracked</div>
                <div className="queue-item">Owner Accountability Assigned</div>
                <div className="queue-item">High-Risk Items Escalated</div>
                <div className="queue-item">Tax / Audit / SEBI Items Mapped</div>
                <div className="queue-item">Finance Workspace Updated</div>
                <div className="queue-item">Managing Partner View Updated</div>
              </div>

              <div className="explain-box">
                This is the Compliance Officer view of the same connected
                VENTIQ operating layer. Regulatory filings, tax items, audit
                evidence, valuation support, PDF records and owner-level review
                actions now flow into one control tower.
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}