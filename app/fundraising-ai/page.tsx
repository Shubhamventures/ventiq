"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

type DataRow = Record<string, unknown>;

type PerformanceCalculationResponse = {
  run?: DataRow | null;
  fundMetric?: DataRow | null;
  portfolioMetrics?: DataRow[];
  investorMetrics?: DataRow[];
  reconciliations?: DataRow[];
  portfolioValuations?: DataRow[];
  error?: string;
};

type InvestorRelationsEvent = {
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

function formatCurrencyCr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0 Cr";

  return `₹${(value / 10000000).toFixed(1)} Cr`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function getStoredRatePercent(row: DataRow | undefined, keys: string[]) {
  const value = getNumber(row, keys);

  if (!Number.isFinite(value)) return 0;

  // Calculation Engine outputs store IRR as a decimal rate (0.1396 = 13.96%).
  // Legacy sources may already store percentage values (13.96 = 13.96%).
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatMultiple(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${value.toFixed(2)}x`;
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

function getActivityIcon(status: string) {
  const value = status.toLowerCase();

  if (value.includes("open")) return "🟡";
  if (value.includes("answered")) return "🟢";
  if (value.includes("viewed")) return "👁️";
  if (value.includes("downloaded")) return "⬇️";
  if (value.includes("question")) return "❓";
  if (value.includes("ready")) return "🟢";
  if (value.includes("review")) return "🔴";
  if (value.includes("pdf")) return "📄";
  if (value.includes("document")) return "🗂️";
  if (value.includes("investor")) return "👤";
  if (value.includes("compliance")) return "🧾";

  return "⚪";
}

function getEngagementLabel(action: string) {
  const value = action.toLowerCase();

  if (value.includes("download")) return "Downloaded";
  if (value.includes("question")) return "Asked question";
  if (value.includes("view")) return "Viewed";

  return action || "Engaged";
}

const DEFAULT_FUND_NAME = "VENTIQ Growth Fund II";

function getFundName(row: DataRow) {
  return getString(
    row,
    ["fund_name", "scheme_name", "fund", "fund_title"],
    ""
  ).trim();
}

function filterRowsForFund(
  rows: DataRow[],
  fundName: string,
  includeGlobalRows = false
) {
  const normalizedFundName = fundName.trim().toLowerCase();

  return rows.filter((row) => {
    const rowFundName = getFundName(row).toLowerCase();

    if (!rowFundName) return includeGlobalRows;
    return rowFundName === normalizedFundName;
  });
}

function rowBelongsToSourceBatch(row: DataRow, sourceBatch: string) {
  if (!sourceBatch) return false;

  return ["source_batch_id", "migration_batch_id", "batch_id"].some(
    (key) => getString(row, [key], "") === sourceBatch
  );
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

function sumRows(rows: DataRow[], keys: string[]) {
  return rows.reduce((sum, row) => sum + getNumber(row, keys), 0);
}

function latestTimestamp(rows: DataRow[]) {
  return (
    rows
      .map((row) =>
        getString(row, ["updated_at", "created_at", "generated_at"], "")
      )
      .filter(Boolean)
      .sort()
      .at(-1) ?? ""
  );
}

function uniqueFundNames(rowGroups: DataRow[][]) {
  return Array.from(
    new Set(
      rowGroups
        .flat()
        .map(getFundName)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function filterLinkedDataRoomRows(
  rows: DataRow[],
  fundName: string,
  fundDocuments: DataRow[]
) {
  const normalizedFundName = fundName.trim().toLowerCase();
  const documentIds = new Set(fundDocuments.map(getId).filter(Boolean));
  const documentNames = new Set(
    fundDocuments
      .map((row) =>
        getString(row, ["document_name", "file_name", "name"], "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  return rows.filter((row) => {
    const rowFundName = getFundName(row).toLowerCase();
    if (rowFundName) return rowFundName === normalizedFundName;

    const documentId = getString(
      row,
      ["document_id", "data_room_document_id"],
      ""
    );
    const documentName = getString(
      row,
      ["document_name", "file_name"],
      ""
    )
      .trim()
      .toLowerCase();

    if (documentId && documentIds.has(documentId)) return true;
    if (documentName && documentNames.has(documentName)) return true;

    // Older data-room records may not yet carry a fund key. Keep them visible
    // as legacy global engagement until the test-data normalization step.
    return !documentId && !documentName;
  });
}

export default function FundraisingAIPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund(DEFAULT_FUND_NAME);
  const { session } = useVentiqAuth();
  const [availableFunds, setAvailableFunds] = useState<string[]>([
    DEFAULT_FUND_NAME,
  ]);
  const [fundActivationStatus, setFundActivationStatus] = useState("Checking");
  const [fundActivatedAt, setFundActivatedAt] = useState("");
  const [fundActivatedBy, setFundActivatedBy] = useState("");
  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);

  const [investors, setInvestors] = useState<DataRow[]>([]);
  const [commitments, setCommitments] = useState<DataRow[]>([]);
  const [investorDocuments, setInvestorDocuments] = useState<DataRow[]>([]);
  const [complianceItems, setComplianceItems] = useState<DataRow[]>([]);
  const [dataRoomDocuments, setDataRoomDocuments] = useState<DataRow[]>([]);
  const [dataRoomEngagementEvents, setDataRoomEngagementEvents] = useState<
    DataRow[]
  >([]);
  const [dataRoomQuestions, setDataRoomQuestions] = useState<DataRow[]>([]);
  const [investorCashflows, setInvestorCashflows] = useState<DataRow[]>([]);
  const [latestCalculationRun, setLatestCalculationRun] =
    useState<DataRow | null>(null);
  const [calculatedFundMetric, setCalculatedFundMetric] =
    useState<DataRow | null>(null);
  const [calculatedInvestorMetrics, setCalculatedInvestorMetrics] = useState<
    DataRow[]
  >([]);
  const [calculationReconciliations, setCalculationReconciliations] = useState<
    DataRow[]
  >([]);
  const [calculationLoadMessage, setCalculationLoadMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInvestorRelationsWorkspace() {
    if (!fundContextReady) return;

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The Investor Relations workspace is unavailable because Supabase is not configured."
      );
      setFundActivationStatus("Unavailable");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setFundActivationStatus("Checking");
    setFundActivatedAt("");
    setFundActivatedBy("");

    async function loadLatestPerformanceCalculation(): Promise<PerformanceCalculationResponse | null> {
      const accessToken = session?.access_token ?? "";

      if (!accessToken) {
        setCalculationLoadMessage(
          "Sign in to load the verified Calculation Engine outputs."
        );
        return null;
      }

      try {
        const response = await fetch(
          `/api/metrics/calculate?fundName=${encodeURIComponent(activeFundName)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          }
        );
        const result =
          (await response.json()) as PerformanceCalculationResponse;

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load verified investor calculations."
          );
        }

        setCalculationLoadMessage("");
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load verified investor calculations.";

        console.warn(
          "VENTIQ Investor Relations workspace could not load calculated metrics:",
          message
        );
        setCalculationLoadMessage(message);
        return null;
      }
    }

    const calculationData = await loadLatestPerformanceCalculation();
    const calculationRun = calculationData?.run ?? null;
    const sourceBatchIds = calculationRun?.source_batch_ids;
    const sourceBatch = Array.isArray(sourceBatchIds)
      ? String(sourceBatchIds[0] ?? "")
      : "";

    setLatestCalculationRun(calculationRun);
    setCalculatedFundMetric(calculationData?.fundMetric ?? null);
    setCalculatedInvestorMetrics(calculationData?.investorMetrics ?? []);
    setCalculationReconciliations(calculationData?.reconciliations ?? []);

    const db = supabase as any;

    async function selectRows(
      tableName: string,
      options?: {
        orderBy?: string;
        ascending?: boolean;
        eq?: { column: string; value: string };
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
            `VENTIQ Investor Relations dashboard skipped ${tableName}:`,
            error.message
          );
          return [] as DataRow[];
        }

        return (data ?? []) as DataRow[];
      } catch (error) {
        console.warn(
          `VENTIQ Investor Relations dashboard skipped ${tableName}:`,
          error
        );
        return [] as DataRow[];
      }
    }

    async function loadActivationRecord() {
      try {
        const { data, error } = await db
          .from("fund_activation_status")
          .select("status, activated_at, activated_by, readiness_score")
          .eq("fund_name", activeFundName)
          .maybeSingle();

        if (error) {
          console.warn(
            "VENTIQ Investor Relations dashboard could not read fund activation:",
            error.message
          );
          return null;
        }

        return (data as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          "VENTIQ Investor Relations dashboard could not read fund activation:",
          error
        );
        return null;
      }
    }

    try {
      const [
        fundMasterRows,
        investorRows,
        commitmentRows,
        investorCashflowRows,
        investorDocumentRows,
        complianceRows,
        migrationUploadRows,
        dataRoomDocumentRows,
        dataRoomEngagementRows,
        dataRoomQuestionRows,
        activationRecord,
      ] = await Promise.all([
        selectRows("fund_master"),
        selectRows("investor_master", {
          orderBy: "investor_code",
          ascending: true,
        }),
        selectRows("fund_commitments"),
        selectRows("investor_cashflows", {
          orderBy: "cashflow_date",
          ascending: false,
        }),
        selectRows("investor_documents", {
          orderBy: "created_at",
          ascending: false,
        }),
        selectRows("compliance_items", {
          orderBy: "due_date",
          ascending: true,
        }),
        selectRows("migration_file_uploads", {
          orderBy: "created_at",
          ascending: false,
        }),
        selectRows("data_room_documents", {
          orderBy: "imported_at",
          ascending: false,
        }),
        selectRows("data_room_engagement_events", {
          orderBy: "event_time",
          ascending: false,
        }),
        selectRows("data_room_questions", {
          orderBy: "asked_at",
          ascending: false,
        }),
        loadActivationRecord(),
      ]);

      const detectedFunds = uniqueFundNames([
        fundMasterRows,
        investorRows,
        commitmentRows,
        investorDocumentRows,
        complianceRows,
        dataRoomDocumentRows,
      ]);
      const nextFunds = Array.from(
        new Set([DEFAULT_FUND_NAME, activeFundName, ...detectedFunds])
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));

      setAvailableFunds(nextFunds);

      const activation = activationRecord ?? null;
      setFundActivationStatus(
        getString(activation ?? undefined, ["status"], "Setup Not Started")
      );
      setFundActivatedAt(
        getString(activation ?? undefined, ["activated_at"], "")
      );
      setFundActivatedBy(
        getString(activation ?? undefined, ["activated_by"], "")
      );

      const calculationBatchRows = (rows: DataRow[]) =>
        rows.filter((row) => rowBelongsToSourceBatch(row, sourceBatch));

      const scopedInvestors = filterRowsForFund(
        calculationBatchRows(investorRows),
        activeFundName
      );
      const scopedCommitments = filterRowsForFund(
        calculationBatchRows(commitmentRows),
        activeFundName
      );
      const scopedInvestorCashflows = filterRowsForFund(
        calculationBatchRows(investorCashflowRows),
        activeFundName
      );
      const scopedInvestorDocuments = filterRowsForFund(
        calculationBatchRows(investorDocumentRows),
        activeFundName
      );
      const scopedComplianceItems = filterRowsForFund(
        calculationBatchRows(complianceRows),
        activeFundName
      );
      const scopedDataRoomDocuments = filterRowsForFund(
        calculationBatchRows(dataRoomDocumentRows),
        activeFundName
      );
      const scopedEngagementRows = filterRowsForFund(
        calculationBatchRows(dataRoomEngagementRows),
        activeFundName
      );
      const scopedQuestionRows = filterRowsForFund(
        calculationBatchRows(dataRoomQuestionRows),
        activeFundName
      );
      const scopedPdfUploads = migrationUploadRows.filter((row) => {
        const belongsToBatch =
          getString(row, ["batch_id"], "") === sourceBatch;
        const belongsToFund =
          getFundName(row).toLowerCase() === activeFundName.toLowerCase();
        const category = getString(row, ["category", "dataset_key"], "")
          .toLowerCase();
        const fileName = getString(row, ["original_file_name"], "")
          .toLowerCase();
        const isPdf =
          category === "pdf" ||
          category.includes("pdf") ||
          fileName.endsWith(".pdf");

        return belongsToBatch && belongsToFund && isPdf;
      });

      setInvestors(scopedInvestors);
      setCommitments(scopedCommitments);
      setInvestorCashflows(scopedInvestorCashflows);
      setInvestorDocuments(scopedInvestorDocuments);
      setComplianceItems(scopedComplianceItems);
      setDataRoomDocuments(scopedDataRoomDocuments);
      setDataRoomEngagementEvents(scopedEngagementRows);
      setDataRoomQuestions(scopedQuestionRows);

      const investorSummary = scopedInvestors.length
        ? {
            id: `${sourceBatch}-investor-summary`,
            fund_name: activeFundName,
            batch_name: `${activeFundName} canonical investor dataset`,
            total_records: scopedInvestors.length,
            total_commitment: sumRows(scopedCommitments, [
              "commitment_amount",
              "committed_amount",
              "commitment",
            ]),
            status: "activated",
            source_batch_id: sourceBatch,
            created_at: latestTimestamp([
              ...scopedInvestors,
              ...scopedCommitments,
            ]),
          }
        : null;

      const pdfReady = scopedPdfUploads.filter((row) => {
        const status = getString(
          row,
          ["upload_status", "processing_status", "status"],
          ""
        ).toLowerCase();
        return ["ready", "processed", "completed", "uploaded"].includes(
          status
        );
      }).length;
      const pdfReview = scopedPdfUploads.filter((row) => {
        const status = getString(
          row,
          ["upload_status", "processing_status", "status"],
          ""
        ).toLowerCase();
        return status.includes("review") || status.includes("unmatched");
      }).length;
      const pdfSummary = scopedPdfUploads.length
        ? {
            id: `${sourceBatch}-pdf-summary`,
            fund_name: activeFundName,
            batch_name: `${activeFundName} canonical PDF dataset`,
            total_files: scopedPdfUploads.length,
            ready_files: pdfReady,
            review_files: pdfReview,
            unmatched_files: 0,
            source_batch_id: sourceBatch,
            created_at: latestTimestamp(scopedPdfUploads),
          }
        : null;

      const evidenceAvailable = scopedComplianceItems.filter(
        (row) =>
          row["evidence_available"] === true ||
          ["true", "yes", "available", "complete", "completed"].includes(
            getString(row, ["evidence_available", "evidence_status"], "")
              .toLowerCase()
          )
      ).length;
      const complianceSummary = scopedComplianceItems.length
        ? {
            id: `${sourceBatch}-compliance-summary`,
            fund_name: activeFundName,
            batch_name: `${activeFundName} canonical compliance dataset`,
            total_items: scopedComplianceItems.length,
            evidence_available_count: evidenceAvailable,
            pending_review_count: scopedComplianceItems.filter(
              isOpenComplianceStatus
            ).length,
            high_risk_count: scopedComplianceItems.filter(
              (row) =>
                getString(row, ["risk_level"], "").toLowerCase() === "high"
            ).length,
            source_batch_id: sourceBatch,
            created_at: latestTimestamp(scopedComplianceItems),
          }
        : null;

      setLatestInvestorBatch(investorSummary);
      setLatestPdfBatch(pdfSummary);
      setLatestComplianceBatch(complianceSummary);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Investor Relations workspace."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInvestorRelationsWorkspace();
  }, [activeFundName, fundContextReady, session?.access_token]);

  const investorRelationsMetrics = useMemo(() => {
    const importedInvestorCount = getNumber(latestInvestorBatch ?? undefined, [
      "total_records",
    ]);

    const importedCommitment = getNumber(latestInvestorBatch ?? undefined, [
      "total_commitment",
    ]);

    const commitmentFromRows = commitments.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "commitment_amount",
          "committed_amount",
          "commitment",
          "amount",
        ]),
      0
    );

    const investorCount = importedInvestorCount || investors.length;
    const totalCommitment = importedCommitment || commitmentFromRows;

    const pdfTotal = getNumber(latestPdfBatch ?? undefined, ["total_files"]);
    const pdfReady = getNumber(latestPdfBatch ?? undefined, ["ready_files"]);
    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

    const portalAvailableDocuments = investorDocuments.filter(
      (row) => getString(row, ["portal_status"], "").toLowerCase() === "available"
    ).length;

    const storedDocuments = investorDocuments.filter((row) =>
      Boolean(getString(row, ["storage_url", "storage_path"], ""))
    ).length;

    const generatedDocuments = Math.max(investorDocuments.length, pdfTotal);

    const investorReportingDocuments = investorDocuments.filter((row) => {
      const documentType = getString(row, ["document_type", "type"], "")
        .toLowerCase();
      const documentName = getString(row, ["document_name", "name"], "")
        .toLowerCase();

      return (
        documentType.includes("notice") ||
        documentType.includes("report") ||
        documentType.includes("soa") ||
        documentType.includes("statement") ||
        documentType.includes("certificate") ||
        documentName.includes("notice") ||
        documentName.includes("report") ||
        documentName.includes("soa") ||
        documentName.includes("certificate")
      );
    }).length;

    const missingInvestorDocuments = Math.max(
      investorCount - Math.max(portalAvailableDocuments, pdfReady),
      0
    );

    const openQuestions = dataRoomQuestions.filter(
      (row) => getString(row, ["status"], "Open") !== "Answered"
    ).length;

    const answeredQuestions = dataRoomQuestions.filter(
      (row) => getString(row, ["status"], "Open") === "Answered"
    ).length;

    const downloadedEvents = dataRoomEngagementEvents.filter((row) =>
      getString(row, ["action"], "").toLowerCase().includes("download")
    ).length;

    const viewedEvents = dataRoomEngagementEvents.filter((row) =>
      getString(row, ["action"], "").toLowerCase().includes("view")
    ).length;

    const complianceTotal = getNumber(latestComplianceBatch ?? undefined, [
      "total_items",
    ]);

    const complianceEvidence = getNumber(latestComplianceBatch ?? undefined, [
      "evidence_available_count",
    ]);

    const compliancePending = getNumber(latestComplianceBatch ?? undefined, [
      "pending_review_count",
    ]);

    const complianceHighRisk = getNumber(latestComplianceBatch ?? undefined, [
      "high_risk_count",
    ]);

    const rowCompliancePending = complianceItems.filter(
      isOpenComplianceStatus
    ).length;

    const rowComplianceHighRisk = complianceItems.filter(
      (row) => getString(row, ["risk_level"], "").toLowerCase() === "high"
    ).length;

    const investorDataScore =
      investorCount > 0 && commitments.length > 0 ? 40 : investorCount > 0 ? 20 : 0;
    const calculationScore = calculatedInvestorMetrics.length > 0 ? 20 : 0;
    const evidenceCoverage = complianceItems.length
      ? complianceEvidence / complianceItems.length
      : 0;
    const evidenceScore = Math.round(evidenceCoverage * 20);
    const documentScore =
      investorCount > 0
        ? Math.round(
            Math.min(portalAvailableDocuments, investorCount) / investorCount * 20
          )
        : 0;
    const readinessScore = Math.min(
      100,
      investorDataScore + calculationScore + evidenceScore + documentScore
    );

    return {
      investorCount,
      totalCommitment,
      investorCashflows: investorCashflows.length,
      verifiedInvestorCalculations: calculatedInvestorMetrics.length,
      generatedDocuments,
      storedDocuments: Math.max(storedDocuments, pdfReady),
      portalAvailableDocuments,
      investorReportingDocuments: Math.max(investorReportingDocuments, pdfReady),
      missingInvestorDocuments,
      pdfTotal,
      pdfReady,
      pdfReview,
      dataRoomDocuments: dataRoomDocuments.length,
      engagementEvents: dataRoomEngagementEvents.length,
      viewedEvents,
      downloadedEvents,
      openQuestions,
      answeredQuestions,
      complianceTotal: complianceTotal || complianceItems.length,
      complianceEvidence,
      compliancePending: Math.max(compliancePending, rowCompliancePending),
      complianceHighRisk: Math.max(complianceHighRisk, rowComplianceHighRisk),
      readinessScore,
    };
  }, [
    latestInvestorBatch,
    latestPdfBatch,
    latestComplianceBatch,
    investors,
    commitments,
    investorDocuments,
    dataRoomDocuments,
    dataRoomEngagementEvents,
    dataRoomQuestions,
    complianceItems,
    investorCashflows,
    calculatedInvestorMetrics,
  ]);

  const calculationSummary = useMemo(() => {
    const passCount = calculationReconciliations.filter(
      (row) =>
        getString(row, ["reconciliation_status", "status"], "")
          .toLowerCase() === "pass"
    ).length;
    const warningCount = calculationReconciliations.filter(
      (row) =>
        getString(row, ["reconciliation_status", "status"], "")
          .toLowerCase() === "warning"
    ).length;
    const failCount = calculationReconciliations.filter(
      (row) =>
        getString(row, ["reconciliation_status", "status"], "")
          .toLowerCase() === "fail"
    ).length;
    const sourceBatchIds = latestCalculationRun?.source_batch_ids;
    const sourceBatch = Array.isArray(sourceBatchIds)
      ? String(sourceBatchIds[0] ?? "")
      : "";

    return {
      passCount,
      warningCount,
      failCount,
      totalCount: calculationReconciliations.length,
      sourceBatch,
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
    };
  }, [calculationReconciliations, latestCalculationRun]);

  const recentInvestors = useMemo(() => {
    return investors.slice(0, 8);
  }, [investors]);

  const openDDQRows = useMemo(() => {
    return dataRoomQuestions
      .filter((row) => getString(row, ["status"], "Open") !== "Answered")
      .slice(0, 8);
  }, [dataRoomQuestions]);

  const recentEngagementRows = useMemo(() => {
    return dataRoomEngagementEvents.slice(0, 8);
  }, [dataRoomEngagementEvents]);

  const investorRelationsEvents = useMemo(() => {
    const events: InvestorRelationsEvent[] = [];

    if (latestInvestorBatch) {
      events.push({
        id: `investor-batch-${getId(latestInvestorBatch)}`,
        time: getString(latestInvestorBatch, ["created_at"], ""),
        module: "Investor Data Migration",
        title: "Investor master imported",
        description: `${getNumber(
          latestInvestorBatch,
          ["total_records"]
        )} investor record(s) imported with ${formatCurrencyCr(
          getNumber(latestInvestorBatch, ["total_commitment"])
        )} commitment.`,
        status: "investor imported",
      });
    }

    if (latestPdfBatch) {
      const reviewCount =
        getNumber(latestPdfBatch, ["review_files"]) +
        getNumber(latestPdfBatch, ["unmatched_files"]);

      events.push({
        id: `pdf-batch-${getId(latestPdfBatch)}`,
        time: getString(latestPdfBatch, ["created_at"], ""),
        module: "PDF Intelligence",
        title: "Investor PDF batch processed",
        description: `${getNumber(
          latestPdfBatch,
          ["total_files"]
        )} PDF(s) processed, ${reviewCount} requiring review.`,
        status: reviewCount > 0 ? "pdf review" : "pdf ready",
      });
    }

    investorDocuments.slice(0, 6).forEach((row) => {
      const investorName = getString(row, ["investor_name"], "Investor");
      const documentName = getString(row, ["document_name"], "Investor document");
      const documentType = getString(row, ["document_type"], "Document");

      events.push({
        id: `investor-document-${getId(row)}`,
        time: getString(row, ["created_at", "generated_at"], ""),
        module: "Investor Documents",
        title: `${documentType} available`,
        description: `${documentName} mapped for ${investorName}.`,
        status: "document ready",
      });
    });

    dataRoomDocuments.slice(0, 6).forEach((row) => {
      events.push({
        id: `data-room-document-${getId(row)}`,
        time: getString(row, ["imported_at", "created_at"], ""),
        module: "Investor Data Room",
        title: "Data room document imported",
        description: `${getString(
          row,
          ["file_name"],
          "Data room document"
        )} classified as ${getString(
          row,
          ["detected_type"],
          "Investor document"
        )}.`,
        status: "document imported",
      });
    });

    dataRoomEngagementEvents.slice(0, 8).forEach((row) => {
      const investorName = getString(
        row,
        ["investor_name"],
        "Prospective LP"
      );
      const action = getEngagementLabel(getString(row, ["action"], "Viewed"));

      events.push({
        id: `engagement-${getId(row)}`,
        time: getString(row, ["event_time", "created_at"], ""),
        module: "LP Engagement",
        title: `LP ${action.toLowerCase()}`,
        description: `${investorName} ${action.toLowerCase()} ${getString(
          row,
          ["document_name"],
          "a data room document"
        )}.`,
        status: action.toLowerCase(),
      });
    });

    dataRoomQuestions.slice(0, 8).forEach((row) => {
      const status = getString(row, ["status"], "Open");

      events.push({
        id: `ddq-${getId(row)}`,
        time:
          status === "Answered"
            ? getString(row, ["answered_at", "asked_at", "created_at"], "")
            : getString(row, ["asked_at", "created_at"], ""),
        module: "DDQ Hub",
        title: status === "Answered" ? "DDQ question answered" : "DDQ question open",
        description: `${getString(
          row,
          ["category"],
          "DDQ"
        )} question from ${getString(
          row,
          ["investor_name"],
          "Prospective LP"
        )}.`,
        status: status === "Answered" ? "answered" : "question open",
      });
    });

    if (latestComplianceBatch) {
      events.push({
        id: `compliance-batch-${getId(latestComplianceBatch)}`,
        time: getString(latestComplianceBatch, ["created_at"], ""),
        module: "Compliance Evidence",
        title: "Compliance evidence connected",
        description: `${getNumber(
          latestComplianceBatch,
          ["evidence_available_count"]
        )} evidence item(s) available for investor responses.`,
        status: "compliance ready",
      });
    }

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [
    latestInvestorBatch,
    latestPdfBatch,
    latestComplianceBatch,
    investorDocuments,
    dataRoomDocuments,
    dataRoomEngagementEvents,
    dataRoomQuestions,
  ]);

  const investorRelationsActions = useMemo(() => {
    return [
      {
        title: "Review open DDQ questions",
        value: `${investorRelationsMetrics.openQuestions} open / ${investorRelationsMetrics.answeredQuestions} answered`,
        href: "/data-room",
        priority:
          investorRelationsMetrics.openQuestions > 0 ? "High" : "Clear",
      },
      {
        title: "Review PDF matching queue",
        value: `${investorRelationsMetrics.pdfReview} PDF(s) need review`,
        href: "/migration/pdf-intelligence",
        priority:
          investorRelationsMetrics.pdfReview > 0 ? "Medium" : "Clear",
      },
      {
        title: "Complete missing investor documents",
        value: `${investorRelationsMetrics.missingInvestorDocuments} missing document signal(s)`,
        href: "/migration/pdf-intelligence",
        priority:
          investorRelationsMetrics.missingInvestorDocuments > 0
            ? "Medium"
            : "Clear",
      },
      {
        title: "Review compliance evidence for LP responses",
        value: `${investorRelationsMetrics.compliancePending} pending / ${investorRelationsMetrics.complianceHighRisk} high-risk`,
        href: "/migration/compliance-data",
        priority:
          investorRelationsMetrics.complianceHighRisk > 0
            ? "High"
            : investorRelationsMetrics.compliancePending > 0
            ? "Medium"
            : "On track",
      },
      {
        title: "Monitor data room engagement",
        value: `${investorRelationsMetrics.engagementEvents} engagement event(s)`,
        href: "/data-room",
        priority:
          investorRelationsMetrics.engagementEvents > 0
            ? "Live"
            : "Not started",
      },
      {
        title: "Open investor portal",
        value: `${investorRelationsMetrics.portalAvailableDocuments} portal-ready document(s)`,
        href: "/investor-portal",
        priority: "Live",
      },
    ];
  }, [investorRelationsMetrics]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ AI Operating System</p>
            <h1>Investor Relations Workspace</h1>
            <p>
              Live investor relations control room connected to migrated
              investors, commitments, PDF evidence, investor documents, data room
              engagement, DDQs and compliance evidence.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div
          className="preview-card"
          style={{ marginBottom: 18, padding: 22 }}
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Active Fund Context</p>
              <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
              <p style={{ margin: 0 }}>
                Activation status: <strong>{fundActivationStatus}</strong>
                {fundActivatedAt
                  ? ` · Activated ${formatDateTime(fundActivatedAt)}`
                  : ""}
                {fundActivatedBy ? ` by ${fundActivatedBy}` : ""}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6, minWidth: 270 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  Switch active fund
                </span>
                <select
                  aria-label="Select active fund"
                  disabled={!fundContextReady || loading}
                  onChange={(event) => setActiveFundName(event.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    color: "#f8fafc",
                    minHeight: 42,
                    padding: "0 12px",
                  }}
                  value={activeFundName}
                >
                  {availableFunds.map((fundName) => (
                    <option key={fundName} value={fundName}>
                      {fundName}
                    </option>
                  ))}
                </select>
              </label>

              <a
                className="monitor-btn monitor-btn-secondary"
                href="/migration/activation"
              >
                Open Fund Activation
              </a>
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {activeFundName} · {fundActivationStatus} · Connected Investor
          Relations workspace reading this fund&apos;s investor, data-room, DDQ
          and evidence records
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investor Relations Workspace...</h2>
            <p>
              VENTIQ is reading investor master records, commitments, investor
              documents, PDF intelligence, data room activity and DDQ status.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus !== "Active" && (
            <div className="preview-card">
              <p className="eyebrow">Activation Required</p>
              <h2>{activeFundName} is not active across VENTIQ</h2>
              <div className="explain-box">
                The Investor Relations Workspace is locked because this fund has
                not completed the controlled activation process. Validate the
                investor, PDF, fund, portfolio and compliance layers, complete
                maker-checker approval, and activate the fund before IR teams
                publish documents or respond to LP diligence from operational data.
              </div>
              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/migration/activation"
                >
                  Complete Fund Activation
                </a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/data-intake"
                >
                  Open Data Intake
                </a>
              </div>
            </div>
          )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus === "Active" && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Verified Investor Performance Layer</p>
                  <h2>Calculation Engine outputs for {activeFundName}</h2>
                </div>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/performance-calculations"
                >
                  Open Calculation Engine
                </a>
              </div>

              {calculationLoadMessage && (
                <div className="explain-box">{calculationLoadMessage}</div>
              )}

              {!calculationLoadMessage && latestCalculationRun && (
                <>
                  <div className="explain-box">
                    Verified Calculation Engine v{calculationSummary.version} · as
                    of {formatDate(calculationSummary.asOfDate)} · {calculationSummary.passCount}/
                    {calculationSummary.totalCount} reconciliation controls passed · {" "}
                    {calculatedInvestorMetrics.length} investor calculations.
                  </div>

                  <div className="impact-grid">
                    <div className="impact-card">
                      <h3>
                        {formatCurrencyCr(
                          getNumber(calculatedFundMetric ?? undefined, [
                            "total_commitments",
                            "total_commitment",
                          ])
                        )}
                      </h3>
                      <p>Total commitments</p>
                    </div>

                    <div className="impact-card">
                      <h3>
                        {formatCurrencyCr(
                          getNumber(calculatedFundMetric ?? undefined, [
                            "paid_in_capital",
                            "paid_in",
                          ])
                        )}
                      </h3>
                      <p>Paid-in capital</p>
                    </div>

                    <div className="impact-card">
                      <h3>
                        {formatCurrencyCr(
                          getNumber(calculatedFundMetric ?? undefined, [
                            "net_distributions",
                            "total_distributions",
                          ])
                        )}
                      </h3>
                      <p>Net cash distributions</p>
                    </div>

                    <div className="impact-card">
                      <h3>
                        {formatCurrencyCr(
                          getNumber(calculatedFundMetric ?? undefined, [
                            "latest_net_nav",
                            "net_nav",
                          ])
                        )}
                      </h3>
                      <p>Latest Net NAV</p>
                    </div>
                  </div>

                  <div className="impact-grid">
                    <div className="impact-card">
                      <h3>
                        {formatPercent(
                          getStoredRatePercent(calculatedFundMetric ?? undefined, [
                            "net_irr",
                          ])
                        )}
                      </h3>
                      <p>Net IRR</p>
                    </div>

                    <div className="impact-card">
                      <h3>
                        {formatMultiple(
                          getNumber(calculatedFundMetric ?? undefined, ["dpi"])
                        )}
                      </h3>
                      <p>DPI</p>
                    </div>

                    <div className="impact-card">
                      <h3>
                        {formatMultiple(
                          getNumber(calculatedFundMetric ?? undefined, ["tvpi"])
                        )}
                      </h3>
                      <p>TVPI</p>
                    </div>

                    <div className="impact-card">
                      <h3>{calculatedInvestorMetrics.length}</h3>
                      <p>Verified investor calculations</p>
                    </div>
                  </div>

                  <div className="explain-box">
                    Performance distribution basis: {getString(
                      calculatedFundMetric ?? undefined,
                      ["performance_distribution_basis"],
                      "Net Cash"
                    )} · Source batch: {calculationSummary.sourceBatch || "-"}
                  </div>
                </>
              )}
            </div>

            <div className="preview-card">
              <h2>{activeFundName} Investor Relations Workspace</h2>

              <div className="explain-box">
                VENTIQ reviewed {investorRelationsMetrics.investorCount}{" "}
                investor record(s),{" "}
                {formatCurrencyCr(investorRelationsMetrics.totalCommitment)}{" "}
                total commitment,{" "}
                {investorRelationsMetrics.generatedDocuments} investor / PDF
                document(s), {investorRelationsMetrics.openQuestions} open DDQ
                question(s), {investorRelationsMetrics.engagementEvents} data
                room engagement event(s) and{" "}
                {investorRelationsMetrics.compliancePending} compliance evidence
                review signal(s).
              </div>

              <div className="action-row">
                <a className="monitor-btn monitor-btn-primary" href="/data-room">
                  Open Investor Data Room
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/investor-portal"
                >
                  Open Investor Portal
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/pdf-intelligence"
                >
                  Review PDF Intelligence
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/compliance-data"
                >
                  Review Compliance Evidence
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
                <h3>{investorRelationsMetrics.investorCount}</h3>
                <p>Total investors</p>
              </div>

              <div className="impact-card">
                <h3>
                  {formatCurrencyCr(investorRelationsMetrics.totalCommitment)}
                </h3>
                <p>Total commitment</p>
              </div>

              <div className="impact-card">
                <h3>{investorRelationsMetrics.verifiedInvestorCalculations}</h3>
                <p>Verified investor calculations</p>
              </div>

              <div className="impact-card">
                <h3>{investorRelationsMetrics.readinessScore}%</h3>
                <p>IR data readiness</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{investorRelationsMetrics.dataRoomDocuments}</h3>
                <p>Data room documents</p>
              </div>

              <div className="impact-card">
                <h3>{investorRelationsMetrics.engagementEvents}</h3>
                <p>LP engagement events</p>
              </div>

              <div className="impact-card">
                <h3>{investorRelationsMetrics.openQuestions}</h3>
                <p>Open DDQ questions</p>
              </div>

              <div className="impact-card">
                <h3>{investorRelationsMetrics.pdfTotal}</h3>
                <p>Batch PDF evidence files</p>
              </div>
            </div>

            <div className="explain-box" style={{ marginBottom: 18 }}>
              Investor Relations metrics on this page are restricted to the latest
              completed canonical batch. Legacy investor imports, PDF batches, data
              room records and prior pilot records are excluded from active-fund
              control totals.
            </div>

            <div className="preview-card">
              <h2>Investor Communication Readiness</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Investor / batch PDF documents</span>
                  <strong>{investorRelationsMetrics.generatedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Stored documents</span>
                  <strong>{investorRelationsMetrics.storedDocuments}</strong>
                </div>

                <div className="journal-row">
                  <span>Investor reporting files</span>
                  <strong>
                    {investorRelationsMetrics.investorReportingDocuments}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Missing investor document signals</span>
                  <strong>
                    {investorRelationsMetrics.missingInvestorDocuments}
                  </strong>
                </div>

                <div className="journal-row">
                  <span>Compliance evidence available</span>
                  <strong>{investorRelationsMetrics.complianceEvidence}</strong>
                </div>

                <div className="journal-row">
                  <span>Compliance high-risk items</span>
                  <strong>{investorRelationsMetrics.complianceHighRisk}</strong>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Investor Master Snapshot</h2>

              {recentInvestors.length === 0 && (
                <div className="explain-box">
                  No investor master records found yet. Import investor data to
                  activate investor relations visibility.
                </div>
              )}

              {recentInvestors.length > 0 && (
                <div className="queue-grid">
                  {recentInvestors.map((row) => (
                    <div className="queue-item" key={getId(row)}>
                      👤{" "}
                      <strong>
                        {getString(row, ["investor_name", "name"], "Investor")}
                      </strong>
                      <br />
                      {getString(row, ["email", "investor_email"], "No email")}
                      <br />
                      {getString(row, ["investor_type", "type"], "Investor")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="knowledge-grid">
              <div className="preview-card">
                <h2>Open DDQ / Investor Questions</h2>

                {openDDQRows.length === 0 && (
                  <div className="explain-box">
                    No open DDQ questions found. Investor response queue is
                    clear.
                  </div>
                )}

                {openDDQRows.length > 0 && (
                  <div className="journal-preview">
                    {openDDQRows.map((row) => (
                      <div className="journal-row" key={`ddq-${getId(row)}`}>
                        <span>
                          {getString(row, ["category"], "DDQ")}
                          <br />
                          {getString(
                            row,
                            ["investor_name"],
                            "Prospective LP"
                          )}
                        </span>
                        <strong>{getString(row, ["status"], "Open")}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ai-side-panel">
                <h2>Ask Investor Relations AI</h2>

                <div className="chat-message">
                  Ask: “Which investors need follow-up?”
                </div>

                <div className="chat-message">
                  Ask: “Which DDQ questions are still open?”
                </div>

                <div className="chat-message">
                  Ask: “Which PDFs are not ready for investors?”
                </div>

                <div className="chat-message">
                  Ask: “Prepare investor follow-up pack.”
                </div>

                <div className="chat-message">
                  Ask: “Which compliance evidence supports LP responses?”
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>LP Engagement Feed</h2>

              {recentEngagementRows.length === 0 && (
                <div className="explain-box">
                  No data room engagement events found yet. Once LPs view,
                  download or ask questions, this panel will show the investor
                  activity trail.
                </div>
              )}

              {recentEngagementRows.length > 0 && (
                <div className="queue-grid">
                  {recentEngagementRows.map((row) => {
                    const action = getEngagementLabel(
                      getString(row, ["action"], "Viewed")
                    );

                    return (
                      <div className="queue-item" key={`engagement-${getId(row)}`}>
                        {getActivityIcon(action)}{" "}
                        <strong>
                          {getString(
                            row,
                            ["investor_name"],
                            "Prospective LP"
                          )}
                        </strong>
                        <br />
                        {action}:{" "}
                        {getString(
                          row,
                          ["document_name"],
                          "Data room document"
                        )}
                        <br />
                        {formatDateTime(
                          getString(row, ["event_time", "created_at"], "")
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Investor Relations Control Queue</h2>

              <div className="queue-grid">
                {investorRelationsActions.map((action) => (
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
              <h2>Live Investor Relations Activity Feed</h2>

              {investorRelationsEvents.length === 0 && (
                <div className="explain-box">
                  No investor relations activity found yet. Import investors,
                  process PDFs, publish data room documents or record DDQ
                  questions to activate the activity trail.
                </div>
              )}

              {investorRelationsEvents.length > 0 && (
                <div className="audit-timeline">
                  {investorRelationsEvents.slice(0, 12).map((event) => (
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
              <h2>Investor Relations AI Answer Preview</h2>

              <div className="explain-box">
                <strong>Question:</strong> What should IR complete first today?
                <br />
                <br />
                <strong>VENTIQ AI:</strong>{" "}
                {investorRelationsMetrics.openQuestions > 0
                  ? `Answer ${investorRelationsMetrics.openQuestions} open DDQ / investor question(s) before the next LP follow-up.`
                  : investorRelationsMetrics.pdfReview > 0
                  ? `Review ${investorRelationsMetrics.pdfReview} PDF intelligence item(s) before relying on those files for investor communication.`
                  : investorRelationsMetrics.missingInvestorDocuments > 0
                  ? `Complete ${investorRelationsMetrics.missingInvestorDocuments} missing investor document signal(s) so LP portal readiness improves.`
                  : investorRelationsMetrics.complianceHighRisk > 0
                  ? `Resolve ${investorRelationsMetrics.complianceHighRisk} high-risk compliance evidence item(s) before sharing LP response packs.`
                  : "Investor relations workflow looks stable. Continue monitoring LP engagement, portal readiness and DDQ status."}
              </div>
            </div>

            <div className="preview-card">
              <h2>Connected Investor Relations Loop</h2>

              <div className="queue-grid">
                <div className="queue-item">Investor Data Imported</div>
                <div className="queue-item">Commitments Mapped</div>
                <div className="queue-item">PDFs Classified</div>
                <div className="queue-item">Investor Documents Published</div>
                <div className="queue-item">Data Room Activated</div>
                <div className="queue-item">LP Engagement Tracked</div>
                <div className="queue-item">DDQ Questions Answered</div>
                <div className="queue-item">Compliance Evidence Linked</div>
                <div className="queue-item">Investor Portal Updated</div>
                <div className="queue-item">Managing Partner View Updated</div>
              </div>

              <div className="explain-box">
                This is the Investor Relations view of the same connected
                VENTIQ operating layer. Investor records, commitments, PDF
                evidence, portal documents, data room activity, DDQs and
                compliance evidence now flow into one relationship workspace.
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}