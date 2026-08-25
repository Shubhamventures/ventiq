"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

type DataRow = Record<string, unknown>;

type PerformanceCalculationResponse = {
  run?: DataRow | null;
  reconciliations?: DataRow[];
  error?: string;
};

type ComplianceWorkflowActor = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
};

type ComplianceWorkflowCapabilities = {
  canView: boolean;
  canAct: boolean;
};

type ComplianceWorkflowResponse = {
  actor?: ComplianceWorkflowActor | null;
  capabilities?: ComplianceWorkflowCapabilities;
  auditLogs?: DataRow[];
  updatedItem?: DataRow | null;
  message?: string;
  changed?: boolean;
  error?: string;
};

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

  return "⚪";
}

function isOpenComplianceStatus(row: DataRow) {
  const status = getString(
    row,
    ["filing_status", "migration_status", "status"],
    ""
  ).toLowerCase();

  if (!status) return true;

  return ![
    "filed",
    "completed",
    "closed",
    "approved",
    "resolved",
    "not applicable",
  ].includes(status);
}

export default function ComplianceAIPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: isFundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");
  const { session } = useVentiqAuth();

  const [fundOptions, setFundOptions] = useState<string[]>([]);
  const [activationStatus, setActivationStatus] = useState("Setup Not Started");
  const [activationDetails, setActivationDetails] = useState<DataRow | null>(null);

  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestFundBatch, setLatestFundBatch] = useState<DataRow | null>(null);

  const [complianceItems, setComplianceItems] = useState<DataRow[]>([]);
  const [fundMasterRows, setFundMasterRows] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [regulatoryMatches, setRegulatoryMatches] = useState<DataRow[]>([]);
  const [regulatoryCirculars, setRegulatoryCirculars] = useState<DataRow[]>([]);
  const [latestCalculationRun, setLatestCalculationRun] =
    useState<DataRow | null>(null);
  const [calculationReconciliations, setCalculationReconciliations] = useState<
    DataRow[]
  >([]);
  const [calculationLoadMessage, setCalculationLoadMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // A8-2B: governed Compliance Operating Workspace action state.
  const [workflowActor, setWorkflowActor] =
    useState<ComplianceWorkflowActor | null>(null);
  const [workflowCapabilities, setWorkflowCapabilities] =
    useState<ComplianceWorkflowCapabilities>({ canView: false, canAct: false });
  const [workflowAuditLogs, setWorkflowAuditLogs] = useState<DataRow[]>([]);
  const [selectedComplianceId, setSelectedComplianceId] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState("");

  async function loadComplianceWorkflow(sourceBatch: string, accessToken: string) {
    try {
      const response = await fetch(
        `/api/compliance/workflow?fundName=${encodeURIComponent(
          activeFundName
        )}&sourceBatchId=${encodeURIComponent(sourceBatch)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        ComplianceWorkflowResponse;

      if (!response.ok) {
        setWorkflowActor(null);
        setWorkflowCapabilities({ canView: false, canAct: false });
        setWorkflowAuditLogs([]);
        setWorkflowMessage(
          payload.error || "Compliance actions are temporarily unavailable."
        );
        return;
      }

      setWorkflowActor(payload.actor ?? null);
      setWorkflowCapabilities(
        payload.capabilities ?? { canView: true, canAct: false }
      );
      setWorkflowAuditLogs(payload.auditLogs ?? []);
    } catch (error) {
      setWorkflowActor(null);
      setWorkflowCapabilities({ canView: false, canAct: false });
      setWorkflowAuditLogs([]);
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Compliance actions are temporarily unavailable."
      );
    }
  }

  async function submitComplianceAction(
    action: "start_review" | "assign_owner" | "request_evidence" | "add_review_note"
  ) {
    const selectedItem = complianceItems.find(
      (row) => getId(row) === selectedComplianceId
    );

    if (!selectedItem) {
      setWorkflowMessage("Select a compliance item before taking action.");
      return;
    }

    if (!workflowCapabilities.canAct) {
      setWorkflowMessage(
        "Read-only access: Compliance Team or Fund Admin edit access is required."
      );
      return;
    }

    const sourceBatchIds = latestCalculationRun?.source_batch_ids;
    const sourceBatch = Array.isArray(sourceBatchIds)
      ? String(sourceBatchIds[0] ?? "")
      : "";
    const accessToken = session?.access_token ?? "";

    if (!sourceBatch || !accessToken) {
      setWorkflowMessage(
        "Verified source-batch context and an authenticated session are required."
      );
      return;
    }

    if (action === "assign_owner" && !ownerDraft.trim()) {
      setWorkflowMessage("Enter an owner before assigning this compliance item.");
      return;
    }

    if (action === "add_review_note" && !reviewNote.trim()) {
      setWorkflowMessage("Enter a review note before saving it.");
      return;
    }

    setWorkflowSaving(true);
    setWorkflowMessage("");

    try {
      const response = await fetch("/api/compliance/workflow", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          fundName: activeFundName,
          sourceBatchId: sourceBatch,
          complianceItemId: getId(selectedItem),
          owner: ownerDraft.trim(),
          note: reviewNote.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        ComplianceWorkflowResponse;

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to update the compliance workflow."
        );
      }

      setWorkflowMessage(
        payload.message || "Compliance workflow action recorded."
      );

      if (action === "assign_owner") {
        setOwnerDraft("");
      }

      if (action === "request_evidence" || action === "add_review_note") {
        setReviewNote("");
      }

      await loadComplianceWorkspace();
    } catch (error) {
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the compliance workflow."
      );
    } finally {
      setWorkflowSaving(false);
    }
  }

  async function loadComplianceWorkspace() {
    if (!isFundContextReady) return;

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The Compliance workspace is unavailable because Supabase is not configured."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = session?.access_token ?? "";

      if (!accessToken) {
        throw new Error(
          "Sign in to load the verified compliance source batch."
        );
      }

      const calculationResponse = await fetch(
        `/api/metrics/calculate?fundName=${encodeURIComponent(activeFundName)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      const calculationResult =
        (await calculationResponse.json()) as PerformanceCalculationResponse;

      if (!calculationResponse.ok) {
        throw new Error(
          calculationResult.error ||
            "Unable to load the verified compliance source batch."
        );
      }

      const calculationRun = calculationResult.run ?? null;
      const sourceBatchIds = calculationRun?.source_batch_ids;
      const sourceBatch = Array.isArray(sourceBatchIds)
        ? String(sourceBatchIds[0] ?? "")
        : "";

      if (!sourceBatch) {
        throw new Error(
          "No completed canonical calculation batch is available for this fund."
        );
      }

      setLatestCalculationRun(calculationRun);
      setCalculationReconciliations(
        calculationResult.reconciliations ?? []
      );
      setCalculationLoadMessage("");

      const [
        fundOptionsResult,
        activationResult,
        complianceItemsResult,
        migrationPdfFilesResult,
        fundRowResult,
        regulatoryMatchesResult,
        regulatoryCircularsResult,
      ] = await Promise.all([
        supabase.from("fund_master").select("fund_name").order("fund_name"),

        supabase
          .from("fund_activation_status")
          .select("*")
          .eq("fund_name", activeFundName)
          .maybeSingle(),

        supabase
          .from("compliance_items")
          .select("*")
          .eq("fund_name", activeFundName)
          .eq("source_batch_id", sourceBatch)
          .order("due_date", { ascending: true }),

        supabase
          .from("migration_file_uploads")
          .select(
            "id, batch_id, fund_name, category, original_file_name, storage_path, upload_status, processing_status"
          )
          .eq("batch_id", sourceBatch)
          .eq("fund_name", activeFundName)
          .eq("category", "pdf")
          .order("created_at", { ascending: false }),

        supabase
          .from("fund_master")
          .select("*")
          .eq("fund_name", activeFundName)
          .eq("source_batch_id", sourceBatch)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("regulatory_source_matches")
          .select("*")
          .eq("status", "needs_review"),

        supabase
          .from("regulatory_circulars")
          .select("*")
          .eq("status", "active"),
      ]);

      const firstError =
        fundOptionsResult.error ||
        complianceItemsResult.error ||
        migrationPdfFilesResult.error ||
        fundRowResult.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

      const availableFundNames = Array.from(
        new Set(
          ((fundOptionsResult.data ?? []) as DataRow[])
            .map((row) => getString(row, ["fund_name"], ""))
            .filter(Boolean)
        )
      );

      if (!availableFundNames.includes(activeFundName)) {
        availableFundNames.unshift(activeFundName);
      }

      setFundOptions(availableFundNames);

      const activation = activationResult.error
        ? null
        : ((activationResult.data as DataRow | null) ?? null);

      setActivationDetails(activation);
      setActivationStatus(
        getString(activation ?? undefined, ["status"], "Setup Not Started")
      );

      const complianceRows = (complianceItemsResult.data ?? []) as DataRow[];
      const migrationPdfFiles = (migrationPdfFilesResult.data ?? []) as DataRow[];
      const pdfStoragePaths = Array.from(
        new Set(
          migrationPdfFiles
            .map((row) => getString(row, ["storage_path"], ""))
            .filter(Boolean)
        )
      );

      let pdfRows: DataRow[] = [];
      let investorDocumentRows: DataRow[] = [];

      if (pdfStoragePaths.length > 0) {
        const [pdfDocumentsResult, investorDocumentsResult] = await Promise.all([
          supabase
            .from("pdf_intelligence_documents")
            .select("*")
            .eq("fund_name", activeFundName)
            .in("storage_path", pdfStoragePaths)
            .order("created_at", { ascending: false }),

          supabase
            .from("investor_documents")
            .select("*")
            .eq("fund_name", activeFundName)
            .in("storage_path", pdfStoragePaths)
            .order("created_at", { ascending: false }),
        ]);

        if (pdfDocumentsResult.error) {
          throw new Error(pdfDocumentsResult.error.message);
        }

        pdfRows = (pdfDocumentsResult.data ?? []) as DataRow[];
        investorDocumentRows = investorDocumentsResult.error
          ? []
          : ((investorDocumentsResult.data ?? []) as DataRow[]);
      }

      const fundRow = (fundRowResult.data as DataRow | null) ?? null;
      const regulatoryMatchRows = regulatoryMatchesResult.error
        ? []
        : ((regulatoryMatchesResult.data ?? []) as DataRow[]);
      const regulatoryCircularRows = regulatoryCircularsResult.error
        ? []
        : ((regulatoryCircularsResult.data ?? []) as DataRow[]);

      setComplianceItems(complianceRows);
      setFundMasterRows(fundRow ? [fundRow] : []);
      setInvestorDocuments(investorDocumentRows);
      setRegulatoryMatches(
        regulatoryMatchRows.filter(
          (row) => getString(row, ["fund_name"], "") === activeFundName
        )
      );
      setRegulatoryCirculars(
        regulatoryCircularRows.filter(
          (row) => getString(row, ["fund_name"], "") === activeFundName
        )
      );

      const evidenceAvailableCount = complianceRows.filter((row) =>
        Boolean(row["evidence_available"])
      ).length;
      const pendingReviewCount = complianceRows.filter(
        isOpenComplianceStatus
      ).length;
      const highRiskCount = complianceRows.filter(
        (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
      ).length;
      const readyCount = complianceRows.filter(
        (row) => !isOpenComplianceStatus(row)
      ).length;

      setLatestComplianceBatch(
        complianceRows.length > 0
          ? {
              id: `active-fund-${activeFundName}-compliance`,
              created_at: getString(
                complianceRows[complianceRows.length - 1],
                ["created_at", "due_date"],
                ""
              ),
              total_items: complianceRows.length,
              evidence_available_count: evidenceAvailableCount,
              pending_review_count: pendingReviewCount,
              high_risk_count: highRiskCount,
              ready_count: readyCount,
            }
          : null
      );

      const processedPdfStoragePaths = new Set(
        pdfRows
          .map((row) => getString(row, ["storage_path"], ""))
          .filter(Boolean)
      );
      const unprocessedPdfCount = migrationPdfFiles.filter((row) => {
        const storagePath = getString(row, ["storage_path"], "");
        return Boolean(storagePath) && !processedPdfStoragePaths.has(storagePath);
      }).length;
      const pdfReviewCount = pdfRows.filter((row) => {
        const status = getString(row, ["status"], "").toLowerCase();
        return status.includes("review") || status.includes("unmatched");
      }).length;
      const pdfUnmatchedCount = pdfRows.filter((row) =>
        getString(row, ["status"], "").toLowerCase().includes("unmatched")
      ).length;
      const batchPdfTotal = migrationPdfFiles.length;
      const totalPdfReview = pdfReviewCount + unprocessedPdfCount;

      setLatestPdfBatch(
        batchPdfTotal > 0
          ? {
              id: `active-fund-${activeFundName}-${sourceBatch}-pdf`,
              created_at: getString(
                migrationPdfFiles[0],
                ["created_at"],
                getString(pdfRows[0], ["created_at"], "")
              ),
              total_files: batchPdfTotal,
              ready_files: Math.max(batchPdfTotal - totalPdfReview, 0),
              review_files: Math.max(
                totalPdfReview - pdfUnmatchedCount,
                0
              ),
              unmatched_files: pdfUnmatchedCount,
            }
          : null
      );

      setLatestFundBatch(
        fundRow
          ? {
              ...fundRow,
              id: getString(fundRow, ["id"], `active-fund-${activeFundName}`),
              total_funds: 1,
            }
          : null
      );

      // A8-2B: workflow capability/audit retrieval is server governed and
      // intentionally separate from the existing browser read model.
      await loadComplianceWorkflow(sourceBatch, accessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load Compliance workspace.";
      setCalculationLoadMessage(message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFundContextReady) {
      void loadComplianceWorkspace();
    }
  }, [activeFundName, isFundContextReady, session?.access_token]);

  const isFundActive = activationStatus === "Active";

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

    const rowEvidenceAvailable = complianceItems.filter((row) =>
      Boolean(row["evidence_available"])
    ).length;

    const rowPendingReview = complianceItems.filter(
      isOpenComplianceStatus
    ).length;

    const rowHighRisk = complianceItems.filter(
      (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
    ).length;

    const rowReady = complianceItems.filter(
      (row) => !isOpenComplianceStatus(row)
    ).length;

    const totalItems = batchTotalItems || complianceItems.length;
    const evidenceAvailable = batchEvidenceAvailable || rowEvidenceAvailable;
    const pendingReview = batchPendingReview || rowPendingReview;
    const highRiskItems = batchHighRisk || rowHighRisk;
    const readyItems = batchReady || rowReady;

    const missingEvidence = Math.max(totalItems - evidenceAvailable, 0);

    const pdfTotal = getNumber(latestPdfBatch ?? undefined, ["total_files"]);
    const pdfReady = getNumber(latestPdfBatch ?? undefined, ["ready_files"]);
    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

    const fundCount = getNumber(latestFundBatch ?? undefined, ["total_funds"]);
    const fundMasterCount = fundMasterRows.length;

    const sebiItems = complianceItems.filter((row) => {
      const authority = getString(row, ["authority"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();

      return authority.includes("sebi") || itemType.includes("sebi");
    }).length;

    const taxItems = complianceItems.filter((row) => {
      const authority = getString(row, ["authority"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const documentName = getString(row, ["document_name"], "").toLowerCase();

      return (
        authority.includes("tax") ||
        itemType.includes("tax") ||
        documentName.includes("64c") ||
        documentName.includes("64d")
      );
    }).length;

    const auditItems = complianceItems.filter((row) => {
      const category = getString(row, ["category"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();

      return category.includes("audit") || itemType.includes("audit");
    }).length;

    const valuationItems = complianceItems.filter((row) => {
      const category = getString(row, ["category"], "").toLowerCase();
      const itemType = getString(row, ["item_type"], "").toLowerCase();
      const documentName = getString(row, ["document_name"], "").toLowerCase();

      return (
        category.includes("valuation") ||
        itemType.includes("valuation") ||
        documentName.includes("valuation")
      );
    }).length;

    const dueSoonItems = complianceItems.filter((row) => {
      const days = getDaysUntil(row["due_date"]);

      return days !== null && days >= 0 && days <= 15;
    }).length;

    const overdueItems = complianceItems.filter((row) => {
      const days = getDaysUntil(row["due_date"]);
      const status = getString(row, ["filing_status"], "").toLowerCase();

      return (days !== null && days < 0) || status === "overdue";
    }).length;

    const storedInvestorDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url", "storage_path"], ""))
    ).length;

    const evidenceReadinessScore =
      totalItems > 0
        ? Math.round((evidenceAvailable / totalItems) * 100)
        : 0;

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
      fundCount: fundCount || fundMasterCount,
      sebiItems,
      taxItems,
      auditItems,
      valuationItems,
      dueSoonItems,
      overdueItems,
      storedInvestorDocuments,
      pendingRegulatoryMatches: regulatoryMatches.length,
      activeRegulatoryCirculars: regulatoryCirculars.length,
      evidenceReadinessScore,
    };
  }, [
    latestComplianceBatch,
    latestPdfBatch,
    latestFundBatch,
    complianceItems,
    fundMasterRows,
    investorDocuments,
    regulatoryMatches,
    regulatoryCirculars,
  ]);

  const calculationSummary = useMemo(() => {
    const sourceBatchIds = latestCalculationRun?.source_batch_ids;
    const sourceBatch = Array.isArray(sourceBatchIds)
      ? String(sourceBatchIds[0] ?? "")
      : "";
    const passedControls = calculationReconciliations.filter(
      (row) =>
        getString(row, ["status", "reconciliation_status"], "").toLowerCase() ===
        "pass"
    ).length;

    return {
      version: getString(
        latestCalculationRun ?? undefined,
        ["calculation_version"],
        "-"
      ),
      asOfDate: getString(
        latestCalculationRun ?? undefined,
        ["as_of_date"],
        ""
      ),
      sourceBatch,
      passedControls,
      totalControls: calculationReconciliations.length,
    };
  }, [latestCalculationRun, calculationReconciliations]);

  const priorityItems = useMemo(() => {
    return complianceItems
      .filter((row) => {
        const status = getString(row, ["filing_status"], "").toLowerCase();
        const risk = getString(row, ["risk_level"], "").toLowerCase();
        const evidenceAvailable = Boolean(row["evidence_available"]);
        const days = getDaysUntil(row["due_date"]);

        return (
          status === "pending" ||
          status === "review" ||
          status === "overdue" ||
          risk === "high" ||
          !evidenceAvailable ||
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
    return complianceItems
      .filter((row) => !Boolean(row["evidence_available"]))
      .slice(0, 8);
  }, [complianceItems]);

  const actionableComplianceItems = useMemo(() => {
    return complianceItems.filter(isOpenComplianceStatus).sort((a, b) => {
      const aRisk = getString(a, ["risk_level"], "").toLowerCase() === "high" ? 0 : 1;
      const bRisk = getString(b, ["risk_level"], "").toLowerCase() === "high" ? 0 : 1;

      if (aRisk !== bRisk) return aRisk - bRisk;

      const aDue = Date.parse(getString(a, ["due_date"], ""));
      const bDue = Date.parse(getString(b, ["due_date"], ""));
      return (Number.isFinite(aDue) ? aDue : Number.MAX_SAFE_INTEGER) -
        (Number.isFinite(bDue) ? bDue : Number.MAX_SAFE_INTEGER);
    });
  }, [complianceItems]);

  const selectedComplianceItem = useMemo(
    () =>
      complianceItems.find((row) => getId(row) === selectedComplianceId) ??
      null,
    [complianceItems, selectedComplianceId]
  );

  useEffect(() => {
    if (
      selectedComplianceId &&
      complianceItems.some((row) => getId(row) === selectedComplianceId)
    ) {
      return;
    }

    setSelectedComplianceId(getId(actionableComplianceItems[0]));
  }, [actionableComplianceItems, complianceItems, selectedComplianceId]);

  useEffect(() => {
    setSelectedComplianceId("");
    setOwnerDraft("");
    setReviewNote("");
    setWorkflowMessage("");
  }, [activeFundName]);

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
      const documentName = getString(
        row,
        ["document_name"],
        "Compliance item"
      );
      const filingStatus = getString(row, ["filing_status"], "Review");
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

    workflowAuditLogs.slice(0, 12).forEach((row) => {
      events.push({
        id: `governed-compliance-${getId(row)}`,
        time: getString(row, ["created_at"], ""),
        module: "Compliance Operating Workspace",
        title: getString(row, ["event_title"], "Compliance action recorded"),
        description: getString(
          row,
          ["event_description"],
          "Governed compliance workflow action recorded."
        ),
        status: getString(row, ["event_type", "event_status"], "audit"),
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [
    latestComplianceBatch,
    latestPdfBatch,
    complianceItems,
    regulatoryMatches,
    workflowAuditLogs,
  ]);

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
        value: `${complianceMetrics.evidenceReadinessScore}% evidence coverage`,
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
            <h1>Compliance Operating Workspace</h1>
            <p>
              Live compliance control tower where verified obligations become
              governed owner actions, evidence requests and auditable reviews.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card compliance-fund-context">
          <div>
            <p className="eyebrow">Active Fund Context</p>
            <h2>{activeFundName}</h2>
            <p>
              Activation status: <strong>{activationStatus}</strong>
              {getString(activationDetails ?? undefined, ["activated_by"], "")
                ? ` · Activated by ${getString(
                    activationDetails ?? undefined,
                    ["activated_by"],
                    ""
                  )}`
                : ""}
            </p>
          </div>

          <div className="compliance-fund-switcher">
            <label htmlFor="compliance-active-fund">Switch active fund</label>
            <div className="compliance-fund-switcher-row">
              <select
                id="compliance-active-fund"
                onChange={(event) => setActiveFundName(event.target.value)}
                value={activeFundName}
              >
                {fundOptions.map((fundName) => (
                  <option key={fundName} value={fundName}>
                    {fundName}
                  </option>
                ))}
              </select>
              <a className="monitor-btn monitor-btn-secondary" href="/migration/activation">
                Open Fund Activation
              </a>
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {activeFundName} · {activationStatus} · Connected compliance workspace
          reading only this fund&apos;s compliance, PDF, fund, investor document
          and regulatory evidence records
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

        {!loading && !errorMessage && !isFundActive && (
          <div className="preview-card compliance-activation-lock">
            <p className="eyebrow">Activation Required</p>
            <h2>{activeFundName} is not active across VENTIQ</h2>
            <div className="explain-box">
              The Compliance Workspace is locked because this fund has not
              completed controlled data validation, maker-checker approval and
              activation. Compliance records remain available inside migration
              review, but operational dashboards cannot rely on them yet.
            </div>
            <div className="action-row">
              <a className="monitor-btn monitor-btn-primary" href="/migration/activation">
                Complete Fund Activation
              </a>
              <a className="monitor-btn monitor-btn-secondary" href="/migration/data-intake">
                Open Data Intake
              </a>
            </div>
          </div>
        )}

        {!loading && !errorMessage && isFundActive && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Verified Compliance Layer</p>
                  <h2>Canonical controls for {activeFundName}</h2>
                </div>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/performance-calculations"
                >
                  Open Calculation Engine
                </a>
              </div>

              <div className="logic-note">
                Verified Calculation Engine v{calculationSummary.version} · as of {formatDate(
                  calculationSummary.asOfDate
                )} · {calculationSummary.passedControls}/{calculationSummary.totalControls} reconciliation controls passed · source batch: {calculationSummary.sourceBatch || "-"}.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{complianceMetrics.totalItems}</h3>
                  <p>Canonical compliance records</p>
                </div>
                <div className="impact-card">
                  <h3>{complianceMetrics.pendingReview}</h3>
                  <p>Open compliance items</p>
                </div>
                <div className="impact-card">
                  <h3>{complianceMetrics.evidenceAvailable}</h3>
                  <p>Evidence available</p>
                </div>
                <div className="impact-card">
                  <h3>{complianceMetrics.highRiskItems}</h3>
                  <p>High-risk items</p>
                </div>
              </div>

              <div className="explain-box">
                Compliance metrics and PDF evidence counts on this page are restricted to the latest completed canonical intake batch. Global, legacy and prior-batch records are excluded from the active-fund control totals.
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
                <p>Batch PDF evidence files</p>
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
                <h3>{complianceMetrics.evidenceReadinessScore}%</h3>
                <p>Evidence coverage</p>
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
                  <span>Missing evidence</span>
                  <strong>{complianceMetrics.missingEvidence}</strong>
                </div>

                <div className="journal-row">
                  <span>Overdue items</span>
                  <strong>{complianceMetrics.overdueItems}</strong>
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

            <div className="preview-card compliance-action-workspace">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">A8-2 · Governed Operating Layer</p>
                  <h2>Compliance Action Queue</h2>
                </div>
                <span className="status-pill">
                  {workflowActor
                    ? `${workflowActor.fullName} · ${workflowActor.role}`
                    : "Workflow access loading"}
                </span>
              </div>

              <div className="logic-note">
                Actions below update only the latest verified source-batch compliance
                item through the server. Every mutation writes to the enterprise audit
                log. Filed / Approved / Closed records cannot be changed here.
              </div>

              {workflowMessage && (
                <div className="explain-box compliance-workflow-message">
                  {workflowMessage}
                </div>
              )}

              {actionableComplianceItems.length === 0 ? (
                <div className="explain-box">
                  No open compliance items are available for operational action.
                </div>
              ) : (
                <div className="compliance-operating-grid">
                  <div className="compliance-action-list">
                    {actionableComplianceItems.slice(0, 12).map((row) => {
                      const rowId = getId(row);
                      const selected = rowId === selectedComplianceId;

                      return (
                        <button
                          className={`compliance-action-item${
                            selected ? " compliance-action-item-selected" : ""
                          }`}
                          key={`action-${rowId}`}
                          onClick={() => {
                            setSelectedComplianceId(rowId);
                            setOwnerDraft(getString(row, ["owner"], ""));
                            setReviewNote("");
                            setWorkflowMessage("");
                          }}
                          type="button"
                        >
                          <span>
                            {getRiskEmoji(
                              getString(row, ["risk_level"], "Medium")
                            )}{" "}
                            <strong>
                              {getString(
                                row,
                                ["document_name"],
                                "Compliance item"
                              )}
                            </strong>
                          </span>
                          <small>
                            {getString(row, ["authority"], "Authority")} ·{" "}
                            {getDueLabel(row["due_date"])}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  <div className="compliance-action-panel">
                    {selectedComplianceItem ? (
                      <>
                        <div>
                          <p className="eyebrow">Selected obligation</p>
                          <h3>
                            {getString(
                              selectedComplianceItem,
                              ["document_name"],
                              "Compliance item"
                            )}
                          </h3>
                          <p>
                            {getString(
                              selectedComplianceItem,
                              ["authority"],
                              "Authority not provided"
                            )}{" "}
                            · {getString(
                              selectedComplianceItem,
                              ["category"],
                              "Category not provided"
                            )}
                          </p>
                        </div>

                        <div className="compliance-action-facts">
                          <span>
                            Status: {getString(
                              selectedComplianceItem,
                              ["filing_status"],
                              "Review"
                            )}
                          </span>
                          <span>
                            Risk: {getString(
                              selectedComplianceItem,
                              ["risk_level"],
                              "Medium"
                            )}
                          </span>
                          <span>{getDueLabel(selectedComplianceItem["due_date"])}</span>
                          <span>
                            Evidence: {Boolean(
                              selectedComplianceItem["evidence_available"]
                            )
                              ? "Available"
                              : "Missing"}
                          </span>
                        </div>

                        <div className="action-row">
                          <button
                            className="monitor-btn monitor-btn-primary"
                            disabled={workflowSaving || !workflowCapabilities.canAct}
                            onClick={() => void submitComplianceAction("start_review")}
                            type="button"
                          >
                            Start Review
                          </button>
                          <button
                            className="monitor-btn monitor-btn-secondary"
                            disabled={workflowSaving || !workflowCapabilities.canAct}
                            onClick={() =>
                              void submitComplianceAction("request_evidence")
                            }
                            type="button"
                          >
                            Request Evidence
                          </button>
                        </div>

                        <div className="compliance-form-grid">
                          <label>
                            <span>Owner</span>
                            <input
                              onChange={(event) => setOwnerDraft(event.target.value)}
                              placeholder={getString(
                                selectedComplianceItem,
                                ["owner"],
                                "Assign owner"
                              )}
                              value={ownerDraft}
                            />
                          </label>
                          <button
                            className="monitor-btn monitor-btn-secondary"
                            disabled={workflowSaving || !workflowCapabilities.canAct}
                            onClick={() => void submitComplianceAction("assign_owner")}
                            type="button"
                          >
                            Assign Owner
                          </button>
                        </div>

                        <label className="compliance-review-note">
                          <span>Review / evidence note</span>
                          <textarea
                            onChange={(event) => setReviewNote(event.target.value)}
                            placeholder="Record the review conclusion, evidence requested, or follow-up required."
                            rows={4}
                            value={reviewNote}
                          />
                        </label>

                        <div className="action-row">
                          <button
                            className="monitor-btn monitor-btn-secondary"
                            disabled={workflowSaving || !workflowCapabilities.canAct}
                            onClick={() =>
                              void submitComplianceAction("add_review_note")
                            }
                            type="button"
                          >
                            {workflowSaving ? "Recording..." : "Add Governed Note"}
                          </button>
                          <a
                            className="monitor-btn monitor-btn-secondary"
                            href="/admin/audit-workflow"
                          >
                            Open Approval Queue
                          </a>
                        </div>

                        {!workflowCapabilities.canAct && (
                          <div className="explain-box">
                            Read-only mode. Compliance Team or Fund Admin edit access
                            is required for operational actions.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="explain-box">Select an obligation to act.</div>
                    )}
                  </div>
                </div>
              )}
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
                      ["filing_status"],
                      "Review"
                    );

                    return (
                      <div className="queue-item" key={getId(row)}>
                        {getRiskEmoji(riskLevel)}{" "}
                        <strong>
                          {getString(row, ["document_name"], "Compliance item")}
                        </strong>
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
                          {getString(row, ["document_name"], "Compliance item")}
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
                      🔴{" "}
                      <strong>
                        {getString(row, ["document_name"], "Compliance item")}
                      </strong>
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
              <h2>Governed Compliance Activity Feed</h2>

              {complianceActivityEvents.length === 0 && (
                <div className="explain-box">
                  No compliance activity found yet. Operational actions, PDF
                  evidence processing and regulatory reviews will appear here.
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
                <div className="queue-item">Owner Accountability Actioned</div>
                <div className="queue-item">Evidence / Review Actions Audited</div>
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

      <style jsx>{`
        .compliance-fund-context {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 0.8fr);
          gap: 28px;
          align-items: center;
        }

        .compliance-fund-context h2 {
          margin: 2px 0 8px;
        }

        .compliance-fund-context p {
          margin-bottom: 0;
        }

        .compliance-fund-switcher {
          display: grid;
          gap: 8px;
        }

        .compliance-fund-switcher label {
          font-size: 0.82rem;
          font-weight: 800;
        }

        .compliance-fund-switcher-row {
          display: flex;
          gap: 12px;
          align-items: stretch;
        }

        .compliance-fund-switcher select {
          min-width: 0;
          flex: 1;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          padding: 0 16px;
          background: rgba(15, 23, 42, 0.72);
          color: inherit;
          font: inherit;
        }

        .compliance-activation-lock {
          border-color: rgba(59, 130, 246, 0.45);
        }

        .compliance-action-workspace {
          display: grid;
          gap: 18px;
        }

        .compliance-workflow-message {
          margin: 0;
        }

        .compliance-operating-grid {
          display: grid;
          grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.25fr);
          gap: 18px;
          align-items: start;
        }

        .compliance-action-list {
          display: grid;
          gap: 10px;
          max-height: 540px;
          overflow: auto;
          padding-right: 4px;
        }

        .compliance-action-item {
          width: 100%;
          display: grid;
          gap: 6px;
          text-align: left;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(15, 23, 42, 0.45);
          color: inherit;
          font: inherit;
          cursor: pointer;
        }

        .compliance-action-item:hover,
        .compliance-action-item-selected {
          border-color: rgba(59, 130, 246, 0.65);
          background: rgba(30, 64, 175, 0.16);
        }

        .compliance-action-item small {
          color: rgba(226, 232, 240, 0.72);
          line-height: 1.45;
        }

        .compliance-action-panel {
          display: grid;
          gap: 16px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 16px;
          padding: 18px;
          background: rgba(15, 23, 42, 0.36);
        }

        .compliance-action-panel h3 {
          margin: 2px 0 6px;
        }

        .compliance-action-panel p {
          margin: 0;
        }

        .compliance-action-facts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .compliance-action-facts span {
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.78rem;
        }

        .compliance-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: end;
        }

        .compliance-form-grid label,
        .compliance-review-note {
          display: grid;
          gap: 7px;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .compliance-form-grid input,
        .compliance-review-note textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          padding: 11px 12px;
          background: rgba(15, 23, 42, 0.72);
          color: inherit;
          font: inherit;
          box-sizing: border-box;
        }

        .compliance-review-note textarea {
          resize: vertical;
          min-height: 96px;
        }

        @media (max-width: 860px) {
          .compliance-fund-context {
            grid-template-columns: 1fr;
          }

          .compliance-fund-switcher-row {
            flex-direction: column;
          }

          .compliance-fund-switcher select {
            min-height: 48px;
          }

          .compliance-operating-grid {
            grid-template-columns: 1fr;
          }

          .compliance-action-list {
            max-height: 360px;
          }

          .compliance-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}