"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useActiveFund } from "@/lib/useActiveFund";

type DataStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";
type ApprovalStatus = "Draft" | "Submitted" | "Changes Requested" | "Approved";
type WorkflowRole = "Maker" | "Checker";
type ActivationStatus =
  | "Setup Not Started"
  | "Data Upload in Progress"
  | "Validation Required"
  | "Under Review"
  | "Changes Requested"
  | "Ready for Activation"
  | "Active";

type LayerMetric = {
  label: string;
  value: string;
};

type LayerCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  sourceTable: string;
  status: DataStatus;
  countLabel: string;
  countValue: string;
  batchId: string;
  batchName: string;
  updatedAt: string;
  owner: string;
  mandatory: boolean;
  issues: string[];
  metrics: LayerMetric[];
  approvalStatus: ApprovalStatus;
  makerName: string;
  checkerName: string;
  submittedAt: string;
  reviewedAt: string;
  reviewComment: string;
};

type ApprovalRow = {
  layer_key?: string | null;
  source_batch_id?: string | null;
  status?: string | null;
  maker_name?: string | null;
  checker_name?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_comment?: string | null;
};

type ActivationRow = {
  status?: string | null;
  readiness_score?: number | null;
  activated_at?: string | null;
  activated_by?: string | null;
};


type DataRow = Record<string, unknown>;

type LatestBatchRows = {
  batchId: string;
  rows: DataRow[];
};

const DEFAULT_FUND_NAME = "VENTIQ Growth Fund II";
const MAKER_NAME = "Migration Maker";
const CHECKER_NAME = "Migration Checker";

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function formatDateTime(value: string) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}


function textValue(row: DataRow, key: string, fallback = "") {
  const value = row[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function numberValue(row: DataRow, key: string) {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(row: DataRow, key: string) {
  const value = row[key];
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["yes", "true", "available", "complete", "ready", "filed"].includes(normalized);
}

function latestBatchRows(rows: DataRow[]): LatestBatchRows {
  if (rows.length === 0) return { batchId: "", rows: [] };

  const grouped = new Map<string, DataRow[]>();
  rows.forEach((row) => {
    const batchId = textValue(row, "batch_id", "unbatched");
    grouped.set(batchId, [...(grouped.get(batchId) ?? []), row]);
  });

  let selectedBatchId = "";
  let selectedRows: DataRow[] = [];
  let selectedTime = -1;

  grouped.forEach((batchRows, batchId) => {
    const batchTime = batchRows.reduce((latest, row) => {
      const timestamp = textValue(row, "updated_at") || textValue(row, "created_at");
      const parsed = timestamp ? new Date(timestamp).getTime() : 0;
      return Math.max(latest, Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    if (batchTime > selectedTime || (batchTime === selectedTime && batchRows.length > selectedRows.length)) {
      selectedBatchId = batchId === "unbatched" ? "" : batchId;
      selectedRows = batchRows;
      selectedTime = batchTime;
    }
  });

  return { batchId: selectedBatchId, rows: selectedRows };
}

function uniqueCount(rows: DataRow[], key: string) {
  const values = new Set(rows.map((row) => textValue(row, key)).filter(Boolean));
  return values.size || rows.length;
}

function latestTimestamp(rows: DataRow[]) {
  return rows
    .map((row) => textValue(row, "updated_at") || textValue(row, "created_at"))
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function getDataStatusClass(status: DataStatus) {
  if (status === "Ready") return "healthy";
  if (status === "Partial") return "watch";
  if (status === "Needs Review") return "at-risk";
  return "neutral";
}

function getApprovalStatusClass(status: ApprovalStatus) {
  if (status === "Approved") return "healthy";
  if (status === "Submitted") return "watch";
  if (status === "Changes Requested") return "at-risk";
  return "neutral";
}

function getActivationStatusClass(status: ActivationStatus) {
  if (status === "Active" || status === "Ready for Activation") return "healthy";
  if (status === "Under Review" || status === "Data Upload in Progress") return "watch";
  if (status === "Validation Required" || status === "Changes Requested") {
    return "at-risk";
  }
  return "neutral";
}

function isMissingTableError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst205")
  );
}

function defaultLayer(input: {
  id: string;
  title: string;
  description: string;
  route: string;
  sourceTable: string;
  countLabel: string;
  owner: string;
  metrics: LayerMetric[];
}): LayerCard {
  return {
    ...input,
    status: "Not Started",
    countValue: "0",
    batchId: "",
    batchName: "No batch loaded",
    updatedAt: "",
    mandatory: true,
    issues: ["No migration batch has been loaded."],
    approvalStatus: "Draft",
    makerName: "Unassigned",
    checkerName: "Unassigned",
    submittedAt: "",
    reviewedAt: "",
    reviewComment: "",
  };
}

const defaultLayers: LayerCard[] = [
  defaultLayer({
    id: "investor",
    title: "Investor Data",
    description:
      "Investor master, commitments, KYC, bank status and investor financial records.",
    route: "/investor-import",
    sourceTable: "investor_import_batches",
    countLabel: "Investors",
    owner: "Investor Relations",
    metrics: [
      { label: "Commitment", value: "₹0.00 Cr" },
      { label: "Source status", value: "Not started" },
    ],
  }),
  defaultLayer({
    id: "pdf",
    title: "PDF Intelligence",
    description:
      "PDF extraction, investor matching, document classification and deficiency tracking.",
    route: "/migration/pdf-intelligence",
    sourceTable: "pdf_intelligence_batches",
    countLabel: "PDFs",
    owner: "Investor Relations",
    metrics: [
      { label: "Ready", value: "0" },
      { label: "Review / unmatched", value: "0" },
    ],
  }),
  defaultLayer({
    id: "portfolio",
    title: "Portfolio Data",
    description:
      "Portfolio companies, valuations, repayment schedules, risk and exit visibility.",
    route: "/migration/portfolio-data",
    sourceTable: "portfolio_data_migration_batches",
    countLabel: "Investments",
    owner: "Investment Team",
    metrics: [
      { label: "Current value", value: "₹0.00 Cr" },
      { label: "MOIC", value: "0.00x" },
    ],
  }),
  defaultLayer({
    id: "fund",
    title: "Fund Data",
    description:
      "Fund structure, close dates, corpus, fees, carry, hurdle, waterfall and parties.",
    route: "/migration/fund-data",
    sourceTable: "fund_data_migration_batches",
    countLabel: "Funds",
    owner: "Finance Team",
    metrics: [
      { label: "Committed", value: "₹0.00 Cr" },
      { label: "Carry", value: "0%" },
    ],
  }),
  defaultLayer({
    id: "compliance",
    title: "Compliance Data",
    description:
      "Regulatory filings, tax evidence, audit trail, valuation support and exceptions.",
    route: "/migration/compliance-data",
    sourceTable: "compliance_data_migration_batches",
    countLabel: "Items",
    owner: "Compliance Team",
    metrics: [
      { label: "Evidence", value: "0" },
      { label: "High risk", value: "0" },
    ],
  }),
];

function deriveActivationStatus(layers: LayerCard[]): ActivationStatus {
  const loadedCount = layers.filter((layer) => layer.batchId).length;
  const hasChangesRequested = layers.some(
    (layer) => layer.approvalStatus === "Changes Requested"
  );
  const hasValidationIssue = layers.some(
    (layer) => layer.status === "Needs Review" || layer.status === "Partial"
  );
  const submittedCount = layers.filter(
    (layer) => layer.approvalStatus === "Submitted"
  ).length;
  const allApproved = layers.every(
    (layer) =>
      !layer.mandatory ||
      (layer.status === "Ready" && layer.approvalStatus === "Approved")
  );

  if (allApproved) return "Ready for Activation";
  if (hasChangesRequested) return "Changes Requested";
  if (submittedCount > 0) return "Under Review";
  if (hasValidationIssue) return "Validation Required";
  if (loadedCount > 0) return "Data Upload in Progress";
  return "Setup Not Started";
}

export default function DataActivationDashboardPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund(DEFAULT_FUND_NAME);
  const [fundOptions, setFundOptions] = useState<string[]>([DEFAULT_FUND_NAME]);
  const [layers, setLayers] = useState<LayerCard[]>(defaultLayers);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">(
    "success"
  );
  const [workflowRole, setWorkflowRole] = useState<WorkflowRole>("Maker");
  const [workflowConfigured, setWorkflowConfigured] = useState(true);
  const [persistedActivation, setPersistedActivation] = useState<ActivationRow | null>(
    null
  );

  const setNotice = useCallback(
    (text: string, tone: "success" | "warning" | "error" = "success") => {
      setMessage(text);
      setMessageTone(tone);
    },
    []
  );

  const loadFundOptions = useCallback(async () => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    const { data, error } = await client
      .from("fund_master")
      .select("fund_name")
      .not("fund_name", "is", null);

    if (error) return;

    const names = Array.from(
      new Set(
        ((data ?? []) as DataRow[])
          .map((row) => textValue(row, "fund_name"))
          .filter(Boolean)
      )
    ).sort((first, second) => first.localeCompare(second));

    const nextOptions = names.length > 0 ? names : [DEFAULT_FUND_NAME];
    setFundOptions(nextOptions);

    if (!nextOptions.includes(activeFundName)) {
      setActiveFundName(nextOptions[0]);
    }
  }, [activeFundName, setActiveFundName]);

  const loadActivationSnapshot = useCallback(async () => {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setNotice("Supabase is not configured. Add the project credentials in .env.local.", "error");
      return;
    }

    if (!fundContextReady || !activeFundName) return;

    setLoading(true);
    setNotice(`Loading ${activeFundName} readiness, approvals and activation status...`, "warning");

    try {
      let workflowAvailable = true;

      const nextLayers = defaultLayers.map((layer) => ({
        ...layer,
        issues: [...layer.issues],
        metrics: layer.metrics.map((metric) => ({ ...metric })),
      }));

      const [
        investorRowsResult,
        commitmentRowsResult,
        pdfRowsResult,
        portfolioRowsResult,
        fundRowsResult,
        complianceRowsResult,
      ] = await Promise.all([
        client.from("investor_master").select("*").eq("fund_name", activeFundName),
        client.from("fund_commitments").select("*").eq("fund_name", activeFundName),
        client.from("pdf_intelligence_documents").select("*").eq("fund_name", activeFundName),
        client.from("portfolio_investments").select("*").eq("fund_name", activeFundName),
        client.from("fund_master").select("*").eq("fund_name", activeFundName),
        client.from("compliance_items").select("*").eq("fund_name", activeFundName),
      ]);

      const sourceErrors = [
        investorRowsResult.error,
        commitmentRowsResult.error,
        pdfRowsResult.error,
        portfolioRowsResult.error,
        fundRowsResult.error,
        complianceRowsResult.error,
      ].filter(Boolean);

      if (sourceErrors.length > 0) throw sourceErrors[0];

      const allInvestorRows = (investorRowsResult.data ?? []) as DataRow[];
      const allCommitmentRows = (commitmentRowsResult.data ?? []) as DataRow[];
      const allPdfRows = (pdfRowsResult.data ?? []) as DataRow[];
      const allPortfolioRows = (portfolioRowsResult.data ?? []) as DataRow[];
      const allFundRows = (fundRowsResult.data ?? []) as DataRow[];
      const allComplianceRows = (complianceRowsResult.data ?? []) as DataRow[];

      const investorBatch = latestBatchRows(
        allCommitmentRows.length > 0 ? allCommitmentRows : allInvestorRows
      );
      const investorRows = investorBatch.batchId
        ? allInvestorRows.filter((row) => textValue(row, "batch_id") === investorBatch.batchId)
        : allInvestorRows;
      const commitmentRows = investorBatch.batchId
        ? allCommitmentRows.filter((row) => textValue(row, "batch_id") === investorBatch.batchId)
        : allCommitmentRows;

      const pdfBatch = latestBatchRows(allPdfRows);
      const portfolioBatch = latestBatchRows(allPortfolioRows);
      const fundBatch = latestBatchRows(allFundRows);
      const complianceBatch = latestBatchRows(allComplianceRows);

      const batchNameRequests = await Promise.all([
        investorBatch.batchId
          ? client.from("investor_import_batches").select("batch_name").eq("id", investorBatch.batchId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        pdfBatch.batchId
          ? client.from("pdf_intelligence_batches").select("batch_name").eq("id", pdfBatch.batchId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        portfolioBatch.batchId
          ? client.from("portfolio_data_migration_batches").select("batch_name").eq("id", portfolioBatch.batchId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fundBatch.batchId
          ? client.from("fund_data_migration_batches").select("batch_name").eq("id", fundBatch.batchId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        complianceBatch.batchId
          ? client.from("compliance_data_migration_batches").select("batch_name").eq("id", complianceBatch.batchId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const batchName = (index: number, fallback: string) => {
        const data = batchNameRequests[index].data as DataRow | null;
        return data ? textValue(data, "batch_name", fallback) : fallback;
      };

      const investorCount = uniqueCount(investorRows, "investor_code");
      const totalCommitment = commitmentRows.reduce(
        (total, row) => total + numberValue(row, "commitment_amount"),
        0
      );
      const investorIssues: string[] = [];
      if (investorCount === 0) investorIssues.push("No investor records are available for this fund.");
      if (totalCommitment <= 0) investorIssues.push("Fund commitment data is missing or zero.");

      nextLayers[0] = {
        ...nextLayers[0],
        status:
          investorCount === 0
            ? "Not Started"
            : investorIssues.length > 0
              ? "Partial"
              : "Ready",
        countValue: String(investorCount),
        batchId: investorBatch.batchId,
        batchName: batchName(0, "Latest fund-scoped investor batch"),
        updatedAt: latestTimestamp([...investorRows, ...commitmentRows]),
        issues: investorIssues,
        metrics: [
          { label: "Commitment", value: formatCr(totalCommitment) },
          { label: "Commitment rows", value: String(commitmentRows.length) },
        ],
      };

      const pdfRows = pdfBatch.rows;
      const readyPdfCount = pdfRows.filter(
        (row) => textValue(row, "status").toLowerCase() === "ready"
      ).length;
      const reviewPdfCount = pdfRows.filter((row) => {
        const status = textValue(row, "status").toLowerCase();
        return status === "review" || status === "needs review";
      }).length;
      const unmatchedPdfCount = pdfRows.filter((row) => {
        const status = textValue(row, "status").toLowerCase();
        return status === "unmatched" || status === "failed";
      }).length;
      const pdfIssues: string[] = [];
      if (pdfRows.length === 0) pdfIssues.push("No PDF intelligence records are available for this fund.");
      if (reviewPdfCount > 0) pdfIssues.push(`${reviewPdfCount} PDF file(s) require review.`);
      if (unmatchedPdfCount > 0) pdfIssues.push(`${unmatchedPdfCount} PDF file(s) are unmatched or failed.`);

      nextLayers[1] = {
        ...nextLayers[1],
        status:
          pdfRows.length === 0
            ? "Not Started"
            : reviewPdfCount > 0 || unmatchedPdfCount > 0
              ? "Needs Review"
              : "Ready",
        countValue: String(pdfRows.length),
        batchId: pdfBatch.batchId,
        batchName: batchName(1, "Latest fund-scoped PDF batch"),
        updatedAt: latestTimestamp(pdfRows),
        issues: pdfIssues,
        metrics: [
          { label: "Ready", value: String(readyPdfCount) },
          { label: "Review / unmatched", value: String(reviewPdfCount + unmatchedPdfCount) },
        ],
      };

      const portfolioRows = portfolioBatch.rows;
      const investmentCost = portfolioRows.reduce(
        (total, row) => total + numberValue(row, "investment_cost"),
        0
      );
      const currentValue = portfolioRows.reduce(
        (total, row) => total + numberValue(row, "current_value"),
        0
      );
      const missingPortfolioValueCount = portfolioRows.filter(
        (row) =>
          !textValue(row, "portfolio_company") ||
          numberValue(row, "investment_cost") <= 0 ||
          numberValue(row, "current_value") < 0
      ).length;
      const atRiskCount = portfolioRows.filter((row) => {
        const status = textValue(row, "risk_status").toLowerCase();
        return status.includes("risk") || status.includes("watch") || status.includes("breach");
      }).length;
      const portfolioIssues: string[] = [];
      if (portfolioRows.length === 0) portfolioIssues.push("No portfolio records are available for this fund.");
      if (missingPortfolioValueCount > 0) {
        portfolioIssues.push(`${missingPortfolioValueCount} portfolio record(s) have incomplete core values.`);
      }

      nextLayers[2] = {
        ...nextLayers[2],
        status:
          portfolioRows.length === 0
            ? "Not Started"
            : portfolioIssues.length > 0
              ? "Partial"
              : "Ready",
        countValue: String(portfolioRows.length),
        batchId: portfolioBatch.batchId,
        batchName: batchName(2, "Latest fund-scoped portfolio batch"),
        updatedAt: latestTimestamp(portfolioRows),
        issues: portfolioIssues,
        metrics: [
          { label: "Current value", value: formatCr(currentValue) },
          {
            label: "MOIC / risk",
            value: `${investmentCost > 0 ? (currentValue / investmentCost).toFixed(2) : "0.00"}x · ${atRiskCount} watch`,
          },
        ],
      };

      const fundRows = fundBatch.rows;
      const committedCapital = fundRows.reduce(
        (total, row) => total + numberValue(row, "committed_capital"),
        0
      );
      const averageCarry =
        fundRows.length === 0
          ? 0
          : fundRows.reduce((total, row) => total + numberValue(row, "carry_rate"), 0) /
            fundRows.length;
      const fundIssues: string[] = [];
      if (fundRows.length === 0) fundIssues.push("No fund master record is available for this fund.");
      if (committedCapital <= 0) fundIssues.push("Committed capital is missing or zero.");
      if (averageCarry < 0 || averageCarry > 100) {
        fundIssues.push("Carry is outside the expected 0% to 100% range.");
      }

      nextLayers[3] = {
        ...nextLayers[3],
        status:
          fundRows.length === 0
            ? "Not Started"
            : fundIssues.length > 0
              ? "Partial"
              : "Ready",
        countValue: String(fundRows.length),
        batchId: fundBatch.batchId,
        batchName: batchName(3, "Latest fund-scoped fund batch"),
        updatedAt: latestTimestamp(fundRows),
        issues: fundIssues,
        metrics: [
          { label: "Committed", value: formatCr(committedCapital) },
          { label: "Carry", value: `${averageCarry.toFixed(0)}%` },
        ],
      };

      const complianceRows = complianceBatch.rows;
      const evidenceCount = complianceRows.filter((row) => booleanValue(row, "evidence_available")).length;
      const highRiskCount = complianceRows.filter(
        (row) => textValue(row, "risk_level").toLowerCase() === "high"
      ).length;
      const missingEvidenceCount = Math.max(complianceRows.length - evidenceCount, 0);
      const missingCoreComplianceCount = complianceRows.filter(
        (row) => !textValue(row, "item_type") || !textValue(row, "due_date")
      ).length;
      const complianceIssues: string[] = [];
      if (complianceRows.length === 0) complianceIssues.push("No compliance records are available for this fund.");
      if (missingEvidenceCount > 0) {
        complianceIssues.push(`${missingEvidenceCount} compliance item(s) do not have evidence.`);
      }
      if (missingCoreComplianceCount > 0) {
        complianceIssues.push(`${missingCoreComplianceCount} compliance item(s) are missing type or due date.`);
      }

      nextLayers[4] = {
        ...nextLayers[4],
        status:
          complianceRows.length === 0
            ? "Not Started"
            : complianceIssues.length > 0
              ? "Partial"
              : "Ready",
        countValue: String(complianceRows.length),
        batchId: complianceBatch.batchId,
        batchName: batchName(4, "Latest fund-scoped compliance batch"),
        updatedAt: latestTimestamp(complianceRows),
        issues: complianceIssues,
        metrics: [
          { label: "Evidence", value: `${evidenceCount}/${complianceRows.length}` },
          { label: "High risk", value: String(highRiskCount) },
        ],
      };

      const approvalResult = await client
        .from("migration_data_approvals")
        .select("*")
        .eq("fund_name", activeFundName);

      if (approvalResult.error) {
        if (isMissingTableError(approvalResult.error.message)) {
          workflowAvailable = false;
          setWorkflowConfigured(false);
        } else {
          throw approvalResult.error;
        }
      } else {
        setWorkflowConfigured(true);
        const approvalRows = (approvalResult.data ?? []) as ApprovalRow[];

        for (const layer of nextLayers) {
          const matchingApproval = approvalRows.find(
            (approval) =>
              approval.layer_key === layer.id &&
              String(approval.source_batch_id ?? "") === layer.batchId
          );

          if (!matchingApproval) continue;

          layer.approvalStatus = (matchingApproval.status as ApprovalStatus) ?? "Draft";
          layer.makerName = matchingApproval.maker_name ?? "Unassigned";
          layer.checkerName = matchingApproval.checker_name ?? "Unassigned";
          layer.submittedAt = matchingApproval.submitted_at ?? "";
          layer.reviewedAt = matchingApproval.reviewed_at ?? "";
          layer.reviewComment = matchingApproval.review_comment ?? "";
        }
      }

      const activationResult = await client
        .from("fund_activation_status")
        .select("*")
        .eq("fund_name", activeFundName)
        .maybeSingle();

      if (activationResult.error) {
        if (!isMissingTableError(activationResult.error.message)) {
          throw activationResult.error;
        }
        workflowAvailable = false;
        setWorkflowConfigured(false);
        setPersistedActivation(null);
      } else {
        setPersistedActivation((activationResult.data as ActivationRow | null) ?? null);
      }

      setLayers(nextLayers);
      setNotice(
        workflowAvailable
          ? `${activeFundName} data readiness and maker-checker status loaded.`
          : "Migration data loaded. Apply the activation workflow SQL to enable approvals and fund activation.",
        workflowAvailable ? "success" : "warning"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to load readiness.";
      setNotice(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [activeFundName, fundContextReady, setNotice]);

  useEffect(() => {
    if (!fundContextReady) return;
    void loadFundOptions();
  }, [fundContextReady, loadFundOptions]);

  useEffect(() => {
    if (!fundContextReady) return;
    void loadActivationSnapshot();
  }, [fundContextReady, loadActivationSnapshot]);

  const readiness = useMemo(() => {
    const mandatoryLayers = layers.filter((layer) => layer.mandatory);
    const dataReadyCount = mandatoryLayers.filter((layer) => layer.status === "Ready").length;
    const submittedCount = mandatoryLayers.filter(
      (layer) => layer.approvalStatus === "Submitted"
    ).length;
    const approvedCount = mandatoryLayers.filter(
      (layer) => layer.status === "Ready" && layer.approvalStatus === "Approved"
    ).length;
    const issueCount = mandatoryLayers.reduce((total, layer) => total + layer.issues.length, 0);
    const readinessScore =
      mandatoryLayers.length === 0
        ? 0
        : Math.round((approvedCount / mandatoryLayers.length) * 100);
    const derivedStatus = deriveActivationStatus(layers);
    const activationStatus =
      persistedActivation?.status === "Active"
        ? "Active"
        : derivedStatus;
    const canActivate =
      workflowConfigured &&
      activationStatus !== "Active" &&
      mandatoryLayers.every(
        (layer) => layer.status === "Ready" && layer.approvalStatus === "Approved"
      );

    return {
      mandatoryCount: mandatoryLayers.length,
      dataReadyCount,
      submittedCount,
      approvedCount,
      issueCount,
      readinessScore,
      activationStatus: activationStatus as ActivationStatus,
      canActivate,
    };
  }, [layers, persistedActivation, workflowConfigured]);

  async function writeEvent(input: {
    eventType: string;
    layerKey?: string;
    actorName: string;
    actorRole: WorkflowRole | "System";
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!supabase || !workflowConfigured) return;

    const { error } = await supabase.from("migration_activation_events").insert({
      fund_name: activeFundName,
      event_type: input.eventType,
      layer_key: input.layerKey ?? null,
      actor_name: input.actorName,
      actor_role: input.actorRole,
      description: input.description,
      metadata: input.metadata ?? {},
    });

    if (error && !isMissingTableError(error.message)) throw error;
  }

  async function updateApproval(layer: LayerCard, nextStatus: ApprovalStatus) {
    if (!supabase || !workflowConfigured) {
      setNotice("Apply the activation workflow SQL before using maker-checker actions.", "warning");
      return;
    }

    if (!layer.batchId) {
      setNotice(`Load a ${layer.title} batch before starting approval.`, "warning");
      return;
    }

    if (nextStatus === "Submitted" && layer.status !== "Ready") {
      setNotice(`Resolve the validation issues in ${layer.title} before submitting it.`, "warning");
      return;
    }

    if ((nextStatus === "Approved" || nextStatus === "Changes Requested") && workflowRole !== "Checker") {
      setNotice("Switch to Checker view to review submitted data.", "warning");
      return;
    }

    const loadingId = `${nextStatus}-${layer.id}`;
    setActionLoadingId(loadingId);

    try {
      const now = new Date().toISOString();
      const reviewComment =
        nextStatus === "Changes Requested"
          ? layer.issues[0] ?? "Checker requested corrections before activation."
          : nextStatus === "Approved"
            ? "Validated and approved for fund activation."
            : null;

      const payload = {
        fund_name: activeFundName,
        layer_key: layer.id,
        layer_name: layer.title,
        source_table: layer.sourceTable,
        source_batch_id: layer.batchId,
        source_batch_name: layer.batchName,
        status: nextStatus,
        owner_name: layer.owner,
        maker_name: nextStatus === "Submitted" ? MAKER_NAME : layer.makerName,
        checker_name:
          nextStatus === "Approved" || nextStatus === "Changes Requested"
            ? CHECKER_NAME
            : null,
        submitted_at: nextStatus === "Submitted" ? now : layer.submittedAt || null,
        reviewed_at:
          nextStatus === "Approved" || nextStatus === "Changes Requested" ? now : null,
        review_comment: reviewComment,
        validation_issues: layer.issues,
        updated_at: now,
      };

      const { error } = await supabase
        .from("migration_data_approvals")
        .upsert(payload, {
          onConflict: "fund_name,layer_key,source_batch_id",
        });

      if (error) throw error;

      await writeEvent({
        eventType:
          nextStatus === "Submitted"
            ? "DATASET_SUBMITTED"
            : nextStatus === "Approved"
              ? "DATASET_APPROVED"
              : "CHANGES_REQUESTED",
        layerKey: layer.id,
        actorName: workflowRole === "Maker" ? MAKER_NAME : CHECKER_NAME,
        actorRole: workflowRole,
        description: `${layer.title} moved to ${nextStatus}.`,
        metadata: {
          batchId: layer.batchId,
          batchName: layer.batchName,
          reviewComment,
        },
      });

      setNotice(`${layer.title} moved to ${nextStatus}.`, "success");
      await loadActivationSnapshot();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Approval update failed.";
      setNotice(errorMessage, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function activateFund() {
    if (!supabase || !workflowConfigured) {
      setNotice("Apply the activation workflow SQL before activating the fund.", "warning");
      return;
    }

    if (!readiness.canActivate) {
      setNotice("All mandatory data layers must be validated and checker-approved first.", "warning");
      return;
    }

    setActionLoadingId("activate-fund");

    try {
      const now = new Date().toISOString();
      const approvedBatchMap = Object.fromEntries(
        layers.map((layer) => [layer.id, layer.batchId])
      );

      const { error } = await supabase.from("fund_activation_status").upsert(
        {
          fund_name: activeFundName,
          status: "Active",
          readiness_score: 100,
          activated_at: now,
          activated_by: CHECKER_NAME,
          approved_batch_map: approvedBatchMap,
          updated_at: now,
        },
        { onConflict: "fund_name" }
      );

      if (error) throw error;

      await writeEvent({
        eventType: "FUND_ACTIVATED",
        actorName: CHECKER_NAME,
        actorRole: "Checker",
        description: `${activeFundName} was activated across VENTIQ.`,
        metadata: { approvedBatchMap, readinessScore: 100 },
      });

      setNotice("Fund activated. Approved data can now power VENTIQ dashboards and workflows.", "success");
      await loadActivationSnapshot();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fund activation failed.";
      setNotice(errorMessage, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <main className="activation-page">
      <section className="activation-shell">
        <div className="activation-topbar">
          <a className="activation-brand" href="/">
            VENTIQ
          </a>
          <label className="activation-fund-context">
            <span>Activation fund</span>
            <select
              aria-label="Select active fund"
              disabled={loading || fundOptions.length === 0}
              onChange={(event) => setActiveFundName(event.target.value)}
              style={{
                background: "rgba(7, 13, 26, 0.9)",
                border: "1px solid rgba(147, 197, 253, 0.22)",
                borderRadius: 10,
                color: "#ffffff",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 800,
                maxWidth: 320,
                padding: "8px 10px",
              }}
              value={activeFundName}
            >
              {fundOptions.map((fundName) => (
                <option key={fundName} value={fundName}>
                  {fundName}
                </option>
              ))}
            </select>
          </label>
          <div className="activation-role-switch" aria-label="Workflow role">
            {(["Maker", "Checker"] as WorkflowRole[]).map((role) => (
              <button
                className={workflowRole === role ? "active" : ""}
                key={role}
                onClick={() => setWorkflowRole(role)}
                type="button"
              >
                {role} View
              </button>
            ))}
          </div>
        </div>

        <div className="activation-hero activation-command-hero">
          <div>
            <p className="activation-eyebrow">
              <span>VENTIQ</span> Data Readiness + Fund Activation
            </p>
            <h1>Activation Control Centre</h1>
            <p>
              Validate migrated fund data, complete maker-checker approvals and activate only
              controlled datasets across stakeholder dashboards, workflows and investor access.
            </p>

            <div className="activation-actions">
              <button
                className="activation-primary-button"
                disabled={loading}
                onClick={() => void loadActivationSnapshot()}
                type="button"
              >
                {loading ? "Refreshing..." : "Refresh Readiness"}
              </button>
              <a className="activation-secondary-button" href="/migration/data-intake">
                Data Intake
              </a>
              <a className="activation-secondary-button" href="/migration/stakeholder-launch">
                Stakeholder Launch
              </a>
              <a className="activation-secondary-button" href="/admin/audit-workflow">
                Audit Workflow
              </a>
            </div>
          </div>

          <div className="activation-score-card activation-gate-card">
            <div className="activation-gate-heading">
              <span>Activation readiness</span>
              <span
                className={`activation-status-pill ${getActivationStatusClass(
                  readiness.activationStatus
                )}`}
              >
                {readiness.activationStatus}
              </span>
            </div>
            <strong>{readiness.readinessScore}%</strong>
            <div className="activation-progress-track" aria-label="Activation readiness score">
              <span style={{ width: `${readiness.readinessScore}%` }} />
            </div>
            <p>
              {readiness.approvedCount} of {readiness.mandatoryCount} mandatory layers are
              checker-approved and activation-ready.
            </p>
            <button
              className="activation-final-button"
              disabled={!readiness.canActivate || actionLoadingId === "activate-fund"}
              onClick={() => void activateFund()}
              type="button"
            >
              {readiness.activationStatus === "Active"
                ? "Fund Active"
                : actionLoadingId === "activate-fund"
                  ? "Activating..."
                  : "Activate Fund Across VENTIQ"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`activation-note ${messageTone}`} role="status">
            {message}
          </div>
        )}

        {!workflowConfigured && (
          <div className="activation-setup-warning">
            <div>
              <strong>Approval controls need database setup</strong>
              <p>
                The five migration sources are readable, but maker-checker and activation tables
                have not been created yet. Run the provided SQL migration once in Supabase.
              </p>
            </div>
            <span>SQL required</span>
          </div>
        )}

        <div className="activation-kpi-grid activation-command-kpis">
          <div className="activation-kpi-card">
            <span>01</span>
            <p>Data-ready layers</p>
            <h3>{readiness.dataReadyCount}/{readiness.mandatoryCount}</h3>
          </div>
          <div className="activation-kpi-card">
            <span>02</span>
            <p>Awaiting checker</p>
            <h3>{readiness.submittedCount}</h3>
          </div>
          <div className="activation-kpi-card">
            <span>03</span>
            <p>Checker-approved</p>
            <h3>{readiness.approvedCount}</h3>
          </div>
          <div className="activation-kpi-card">
            <span>04</span>
            <p>Open validation issues</p>
            <h3>{readiness.issueCount}</h3>
          </div>
        </div>

        <div className="activation-section-heading">
          <div>
            <p className="activation-eyebrow">Mandatory activation checks</p>
            <h2>Five controlled data layers</h2>
          </div>
          <p>
            Source readiness and checker approval are separate controls. A technically complete
            batch is not operational until it is reviewed and approved.
          </p>
        </div>

        <div className="activation-layer-grid activation-control-grid">
          {layers.map((layer) => {
            const submitLoading = actionLoadingId === `Submitted-${layer.id}`;
            const approveLoading = actionLoadingId === `Approved-${layer.id}`;
            const changesLoading = actionLoadingId === `Changes Requested-${layer.id}`;
            const canSubmit =
              workflowRole === "Maker" &&
              workflowConfigured &&
              layer.status === "Ready" &&
              (layer.approvalStatus === "Draft" ||
                layer.approvalStatus === "Changes Requested");
            const canReview =
              workflowRole === "Checker" &&
              workflowConfigured &&
              layer.status === "Ready" &&
              layer.approvalStatus === "Submitted";

            return (
              <article className="activation-layer-card activation-control-card" key={layer.id}>
                <div className="activation-layer-top">
                  <div>
                    <span className="activation-layer-id">{layer.id}</span>
                    <h2>{layer.title}</h2>
                  </div>
                  <div className="activation-card-statuses">
                    <span
                      className={`activation-status-pill ${getDataStatusClass(layer.status)}`}
                    >
                      Data: {layer.status}
                    </span>
                    <span
                      className={`activation-status-pill ${getApprovalStatusClass(
                        layer.approvalStatus
                      )}`}
                    >
                      Approval: {layer.approvalStatus}
                    </span>
                  </div>
                </div>

                <p className="activation-layer-description">{layer.description}</p>

                <div className="activation-source-line">
                  <div>
                    <small>Latest source batch</small>
                    <strong>{layer.batchName}</strong>
                  </div>
                  <div>
                    <small>Last updated</small>
                    <strong>{formatDateTime(layer.updatedAt)}</strong>
                  </div>
                  <div>
                    <small>Responsible owner</small>
                    <strong>{layer.owner}</strong>
                  </div>
                </div>

                <div className="activation-count-row">
                  <div>
                    <small>{layer.countLabel}</small>
                    <strong>{layer.countValue}</strong>
                  </div>
                  <div>
                    <small>Source table</small>
                    <strong>{layer.sourceTable}</strong>
                  </div>
                </div>

                <div className="activation-metric-row">
                  {layer.metrics.map((metric) => (
                    <div key={`${layer.id}-${metric.label}`}>
                      <small>{metric.label}</small>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="activation-validation-box">
                  <div>
                    <strong>Validation findings</strong>
                    <span>{layer.issues.length === 0 ? "No blocking issue" : `${layer.issues.length} open`}</span>
                  </div>
                  {layer.issues.length === 0 ? (
                    <p className="activation-clear-message">✓ Mandatory source checks passed.</p>
                  ) : (
                    <ul>
                      {layer.issues.slice(0, 3).map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="activation-approval-trail">
                  <div>
                    <small>Maker</small>
                    <strong>{layer.makerName}</strong>
                    <span>{formatDateTime(layer.submittedAt)}</span>
                  </div>
                  <div>
                    <small>Checker</small>
                    <strong>{layer.checkerName}</strong>
                    <span>{formatDateTime(layer.reviewedAt)}</span>
                  </div>
                </div>

                {layer.reviewComment && (
                  <div className="activation-review-comment">
                    <small>Review comment</small>
                    <p>{layer.reviewComment}</p>
                  </div>
                )}

                <div className="activation-card-actions">
                  <a className="activation-card-link" href={layer.route}>
                    Open workspace →
                  </a>

                  {workflowRole === "Maker" ? (
                    <button
                      className="activation-submit-button"
                      disabled={!canSubmit || actionLoadingId.length > 0}
                      onClick={() => void updateApproval(layer, "Submitted")}
                      type="button"
                    >
                      {submitLoading ? "Submitting..." : "Submit for Review"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="activation-request-button"
                        disabled={!canReview || actionLoadingId.length > 0}
                        onClick={() => void updateApproval(layer, "Changes Requested")}
                        type="button"
                      >
                        {changesLoading ? "Updating..." : "Request Changes"}
                      </button>
                      <button
                        className="activation-approve-button"
                        disabled={!canReview || actionLoadingId.length > 0}
                        onClick={() => void updateApproval(layer, "Approved")}
                        type="button"
                      >
                        {approveLoading ? "Approving..." : "Approve Dataset"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="activation-panel activation-impact-panel">
          <div className="activation-section-heading activation-impact-heading">
            <div>
              <p className="activation-eyebrow">Activation impact map</p>
              <h2>What approved data unlocks</h2>
            </div>
            <p>
              Activation freezes the approved batch references as the operational source for the
              next connected VENTIQ workflows.
            </p>
          </div>

          <div className="activation-flow-grid activation-impact-grid">
            <div>
              <span>01</span>
              <strong>Stakeholder Dashboards</strong>
              <p>Managing Partner, Finance, Investment, Compliance and IR views use approved data.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Capital Calls & Distributions</strong>
              <p>Investor and fund records become controlled source data for operating workflows.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Investor Portal</strong>
              <p>Only approved investor, financial and document outputs become publishable.</p>
            </div>
            <div>
              <span>04</span>
              <strong>Activity & Audit Trail</strong>
              <p>Submission, review, approval and activation events remain linked to the fund.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}