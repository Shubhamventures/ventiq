"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { useActiveFund } from "../../../lib/useActiveFund";

type DataStatus = "Ready" | "Partial" | "Not Started" | "Needs Review";
type ApprovalStatus = "Draft" | "Submitted" | "Changes Requested" | "Approved";
type WorkflowRole = "Maker" | "Checker" | "Fund Admin" | "Read Only";
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

type GovernedFundOption = {
  fund_name: string;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
};

const DEFAULT_FUND_NAME = "VENTIQ Growth Fund II";

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
  const { session, profile, activeRole, loading: authLoading } = useVentiqAuth();
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund(DEFAULT_FUND_NAME);

  const [authorisedFunds, setAuthorisedFunds] = useState<GovernedFundOption[]>([]);
  const [fundAccessReady, setFundAccessReady] = useState(false);
  const [fundAccessMessage, setFundAccessMessage] = useState("");
  const [layers, setLayers] = useState<LayerCard[]>(defaultLayers);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">(
    "success"
  );
  const [workflowConfigured, setWorkflowConfigured] = useState(true);

  const activeFundAccess = useMemo(() => {
    const normalizedActiveFund = activeFundName.trim().toLowerCase();

    return (
      authorisedFunds.find(
        (fund) => fund.fund_name.trim().toLowerCase() === normalizedActiveFund
      ) ?? null
    );
  }, [authorisedFunds, activeFundName]);

  const governedRole = activeFundAccess?.role || activeRole || "";

  const canSubmitApprovals =
    Boolean(activeFundAccess?.can_edit) &&
    (governedRole === "maker" || governedRole === "fund_admin");
  const canReviewApprovals =
    Boolean(activeFundAccess?.can_approve) &&
    (governedRole === "checker" || governedRole === "fund_admin");
  const canActivateFund = canReviewApprovals;

  const workflowRole: WorkflowRole =
    governedRole === "maker"
      ? "Maker"
      : governedRole === "checker"
        ? "Checker"
        : governedRole === "fund_admin"
          ? "Fund Admin"
          : "Read Only";

  const actorName =
    profile?.full_name?.trim() ||
    session?.user?.email ||
    "VENTIQ User";
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

  useEffect(() => {
    if (authLoading || !fundContextReady) return;

    const accessToken = session?.access_token?.trim() || "";

    if (!accessToken) {
      setAuthorisedFunds([]);
      setFundAccessMessage("A secure VENTIQ session is required to load governed funds.");
      setFundAccessReady(true);
      return;
    }

    let cancelled = false;

    async function loadGovernedFunds() {
      setFundAccessReady(false);
      setFundAccessMessage("");

      try {
        const response = await fetch("/api/fund-context", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load governed VENTIQ fund context."
          );
        }

        if (cancelled) return;

        const funds = (result.funds ?? []) as GovernedFundOption[];
        setAuthorisedFunds(funds);

        if (funds.length === 0) {
          setFundAccessMessage(
            "No active fund access is available for this VENTIQ account."
          );
          setFundAccessReady(true);
          return;
        }

        const normalizedActiveFund = activeFundName.trim().toLowerCase();
        const currentFundIsAllowed = funds.some(
          (fund) => fund.fund_name.trim().toLowerCase() === normalizedActiveFund
        );

        if (!currentFundIsAllowed) {
          const nextFund = funds[0].fund_name;
          setActiveFundName(nextFund);
          setFundAccessMessage(
            `Activation moved to your first authorised fund: ${nextFund}.`
          );
        }

        setFundAccessReady(true);
      } catch (error) {
        if (cancelled) return;

        setAuthorisedFunds([]);
        setFundAccessMessage(
          error instanceof Error
            ? error.message
            : "Unable to load governed VENTIQ fund context."
        );
        setFundAccessReady(true);
      }
    }

    void loadGovernedFunds();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    fundContextReady,
    session?.access_token,
    activeFundName,
    setActiveFundName,
  ]);

  const loadActivationSnapshot = useCallback(async () => {
    const client = supabase;

    if (!fundContextReady || !fundAccessReady) return;

    if (!activeFundName.trim() || !activeFundAccess) {
      setLayers(defaultLayers);
      setPersistedActivation(null);
      setNotice("Select an authorised fund before loading activation readiness.", "warning");
      return;
    }

    if (!isSupabaseConfigured || !client) {
      setNotice("Supabase is not configured. Add the project credentials in .env.local.", "error");
      return;
    }

    setLoading(true);
    setNotice("Loading migration readiness, approvals and activation status...", "warning");

    try {
      let workflowAvailable = true;

      const nextLayers = defaultLayers.map((layer) => ({
        ...layer,
        issues: [...layer.issues],
        metrics: layer.metrics.map((metric) => ({ ...metric })),
      }));

      const [
        investorResult,
        pdfResult,
        portfolioResult,
        fundAnchorResult,
        complianceResult,
      ] = await Promise.all([
        client
          .from("investor_import_batches")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("pdf_intelligence_batches")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("portfolio_data_migration_batches")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("fund_master")
          .select("batch_id")
          .eq("fund_name", activeFundName)
          .not("batch_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("compliance_data_migration_batches")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const labelledBatchErrors = [
        ["Investor Data", investorResult.error],
        ["PDF Intelligence", pdfResult.error],
        ["Portfolio Data", portfolioResult.error],
        ["Fund Data anchor", fundAnchorResult.error],
        ["Compliance Data", complianceResult.error],
      ] as const;

      const firstBatchError = labelledBatchErrors.find(([, error]) => Boolean(error));
      if (firstBatchError) {
        const [label, error] = firstBatchError;
        throw new Error(
          `${label}: ${error?.message || "Unable to load the governed migration batch."}`
        );
      }

      const fundBatchId = String(fundAnchorResult.data?.batch_id ?? "").trim();
      const fundBatchResult = fundBatchId
        ? await client
            .from("fund_data_migration_batches")
            .select("*")
            .eq("id", fundBatchId)
            .maybeSingle()
        : { data: null, error: null };

      if (fundBatchResult.error) {
        throw new Error(
          `Fund Data: ${fundBatchResult.error.message || "Unable to load the governed fund batch."}`
        );
      }

      const investorBatch = investorResult.data;
      if (investorBatch) {
        const totalRecords = Number(investorBatch.total_records ?? 0);
        const totalCommitment = Number(investorBatch.total_commitment ?? 0);
        const sourceStatus = String(investorBatch.status ?? "imported");
        const issues: string[] = [];

        if (totalRecords === 0) issues.push("Investor batch contains no records.");
        if (totalCommitment <= 0) issues.push("Total commitment is missing or zero.");
        if (sourceStatus !== "imported" && sourceStatus !== "published") {
          issues.push(`Source batch is still marked ${sourceStatus}.`);
        }

        nextLayers[0] = {
          ...nextLayers[0],
          status: issues.length === 0 ? "Ready" : "Partial",
          countValue: String(totalRecords),
          batchId: String(investorBatch.id ?? ""),
          batchName: investorBatch.batch_name ?? "Latest investor batch",
          updatedAt: investorBatch.updated_at ?? investorBatch.created_at ?? "",
          issues,
          metrics: [
            { label: "Commitment", value: formatCr(totalCommitment) },
            { label: "Source status", value: sourceStatus },
          ],
        };
      }

      const pdfBatch = pdfResult.data;
      if (pdfBatch) {
        const totalFiles = Number(pdfBatch.total_files ?? 0);
        const readyFiles = Number(pdfBatch.ready_files ?? 0);
        const reviewFiles = Number(pdfBatch.review_files ?? 0);
        const unmatchedFiles = Number(pdfBatch.unmatched_files ?? 0);
        const issues: string[] = [];

        if (totalFiles === 0) issues.push("PDF batch contains no files.");
        if (reviewFiles > 0) issues.push(`${reviewFiles} PDF file(s) require review.`);
        if (unmatchedFiles > 0) issues.push(`${unmatchedFiles} PDF file(s) are unmatched or failed.`);
        if (readyFiles + reviewFiles + unmatchedFiles < totalFiles) {
          issues.push("Some PDF files do not have a final classification status.");
        }

        nextLayers[1] = {
          ...nextLayers[1],
          status:
            totalFiles === 0
              ? "Not Started"
              : reviewFiles > 0 || unmatchedFiles > 0
                ? "Needs Review"
                : "Ready",
          countValue: String(totalFiles),
          batchId: String(pdfBatch.id ?? ""),
          batchName: pdfBatch.batch_name ?? "Latest PDF batch",
          updatedAt: pdfBatch.updated_at ?? pdfBatch.created_at ?? "",
          issues,
          metrics: [
            { label: "Ready", value: String(readyFiles) },
            { label: "Review / unmatched", value: String(reviewFiles + unmatchedFiles) },
          ],
        };
      }

      const portfolioBatch = portfolioResult.data;
      if (portfolioBatch) {
        const totalRecords = Number(portfolioBatch.total_records ?? 0);
        const atRiskCount = Number(portfolioBatch.at_risk_count ?? 0);
        const currentValue = Number(portfolioBatch.current_portfolio_value ?? 0);
        const issues: string[] = [];

        if (totalRecords === 0) issues.push("Portfolio batch contains no investments.");
        if (currentValue <= 0) issues.push("Current portfolio value is missing or zero.");

        // Portfolio risk is an investment-monitoring signal, not a migration-data
        // completeness failure. A valid at-risk/watchlist position must not block
        // fund activation when the portfolio dataset itself is complete.
        nextLayers[2] = {
          ...nextLayers[2],
          status:
            totalRecords === 0
              ? "Not Started"
              : currentValue <= 0
                ? "Partial"
                : "Ready",
          countValue: String(totalRecords),
          batchId: String(portfolioBatch.id ?? ""),
          batchName: portfolioBatch.batch_name ?? "Latest portfolio batch",
          updatedAt: portfolioBatch.updated_at ?? portfolioBatch.created_at ?? "",
          issues,
          metrics: [
            { label: "Current value", value: formatCr(currentValue) },
            {
              label: "MOIC",
              value: `${Number(portfolioBatch.portfolio_moic ?? 0).toFixed(2)}x`,
            },
            { label: "At-risk investments", value: String(atRiskCount) },
          ],
        };
      }

      const fundBatch = fundBatchResult.data;
      if (fundBatch) {
        const totalFunds = Number(fundBatch.total_funds ?? 0);
        const committedCapital = Number(fundBatch.total_committed_capital ?? 0);
        const averageCarry = Number(fundBatch.average_carry ?? 0);
        const issues: string[] = [];

        if (totalFunds === 0) issues.push("Fund batch contains no fund records.");
        if (committedCapital <= 0) issues.push("Committed capital is missing or zero.");
        if (averageCarry < 0 || averageCarry > 100) {
          issues.push("Average carry is outside the expected 0% to 100% range.");
        }

        nextLayers[3] = {
          ...nextLayers[3],
          status: issues.length === 0 ? "Ready" : totalFunds === 0 ? "Not Started" : "Partial",
          countValue: String(totalFunds),
          batchId: String(fundBatch.id ?? ""),
          batchName: fundBatch.batch_name ?? "Latest fund batch",
          updatedAt: fundBatch.updated_at ?? fundBatch.created_at ?? "",
          issues,
          metrics: [
            { label: "Committed", value: formatCr(committedCapital) },
            { label: "Carry", value: `${averageCarry.toFixed(0)}%` },
          ],
        };
      }

      const complianceBatch = complianceResult.data;
      if (complianceBatch) {
        const totalItems = Number(complianceBatch.total_items ?? 0);
        const pendingReview = Number(complianceBatch.pending_review_count ?? 0);
        const highRisk = Number(complianceBatch.high_risk_count ?? 0);
        const evidenceAvailable = Number(complianceBatch.evidence_available_count ?? 0);
        const issues: string[] = [];

        if (totalItems === 0) issues.push("Compliance batch contains no items.");
        if (pendingReview > 0) issues.push(`${pendingReview} compliance item(s) require review.`);
        if (highRisk > 0) issues.push(`${highRisk} high-risk compliance item(s) remain open.`);
        if (evidenceAvailable < totalItems) {
          issues.push(`${totalItems - evidenceAvailable} item(s) do not have evidence attached.`);
        }

        nextLayers[4] = {
          ...nextLayers[4],
          status:
            totalItems === 0
              ? "Not Started"
              : highRisk > 0
                ? "Needs Review"
                : pendingReview > 0 || evidenceAvailable < totalItems
                  ? "Partial"
                  : "Ready",
          countValue: String(totalItems),
          batchId: String(complianceBatch.id ?? ""),
          batchName: complianceBatch.batch_name ?? "Latest compliance batch",
          updatedAt: complianceBatch.updated_at ?? complianceBatch.created_at ?? "",
          issues,
          metrics: [
            { label: "Evidence", value: `${evidenceAvailable}/${totalItems}` },
            { label: "High risk", value: String(highRisk) },
          ],
        };
      }

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
          ? "Data readiness and maker-checker status loaded."
          : "Migration data loaded. Apply the activation workflow SQL to enable approvals and fund activation.",
        workflowAvailable ? "success" : "warning"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error &&
              typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : "Unable to load readiness.";
      setNotice(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [
    activeFundAccess,
    activeFundName,
    fundAccessReady,
    fundContextReady,
    setNotice,
  ]);

  useEffect(() => {
    if (!fundAccessReady || !activeFundAccess) return;
    void loadActivationSnapshot();
  }, [fundAccessReady, activeFundAccess, loadActivationSnapshot]);

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

    if (nextStatus === "Submitted" && !canSubmitApprovals) {
      setNotice("Your authenticated role cannot submit migration data for review.", "warning");
      return;
    }

    if (
      (nextStatus === "Approved" || nextStatus === "Changes Requested") &&
      !canReviewApprovals
    ) {
      setNotice("Checker approval permission is required for this action.", "warning");
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

      if (nextStatus === "Submitted") {
        const payload = {
          fund_name: activeFundName,
          layer_key: layer.id,
          layer_name: layer.title,
          source_table: layer.sourceTable,
          source_batch_id: layer.batchId,
          source_batch_name: layer.batchName,
          status: nextStatus,
          owner_name: layer.owner,
          maker_name: actorName,
          checker_name: null,
          submitted_at: now,
          reviewed_at: null,
          review_comment: null,
          validation_issues: layer.issues,
          updated_at: now,
        };

        const { data, error } = await supabase
          .from("migration_data_approvals")
          .upsert(payload, {
            onConflict: "fund_name,layer_key,source_batch_id",
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("The maker submission was not persisted.");
        }
      } else {
        const checkerPayload = {
          status: nextStatus,
          checker_name: actorName,
          reviewed_at: now,
          review_comment: reviewComment,
          validation_issues: layer.issues,
          updated_at: now,
        };

        const { data, error } = await supabase
          .from("migration_data_approvals")
          .update(checkerPayload)
          .eq("fund_name", activeFundName)
          .eq("layer_key", layer.id)
          .eq("source_batch_id", layer.batchId)
          .eq("status", "Submitted")
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error(
            "The checker transition was not applied. Refresh the page and confirm the layer is still Submitted."
          );
        }
      }

      await writeEvent({
        eventType:
          nextStatus === "Submitted"
            ? "DATASET_SUBMITTED"
            : nextStatus === "Approved"
              ? "DATASET_APPROVED"
              : "CHANGES_REQUESTED",
        layerKey: layer.id,
        actorName,
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

    if (!canActivateFund) {
      setNotice("Checker or Fund Admin permission is required to activate the fund.", "warning");
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
          activated_by: actorName,
          approved_batch_map: approvedBatchMap,
          updated_at: now,
        },
        { onConflict: "fund_name" }
      );

      if (error) throw error;

      await writeEvent({
        eventType: "FUND_ACTIVATED",
        actorName,
        actorRole: workflowRole,
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
          <div className="activation-fund-context">
            <span>Activation fund</span>
            <select
              aria-label="Select authorised activation fund"
              disabled={!fundAccessReady || authorisedFunds.length === 0 || loading}
              onChange={(event) => setActiveFundName(event.target.value)}
              value={activeFundAccess ? activeFundName : ""}
            >
              {!activeFundAccess && (
                <option value="">Select authorised fund</option>
              )}
              {authorisedFunds.map((fund) => (
                <option key={fund.fund_name} value={fund.fund_name}>
                  {fund.fund_name}
                </option>
              ))}
            </select>
          </div>
          <div className="activation-role-switch" aria-label="Authenticated workflow role">
            <button className="active" disabled type="button">
              {authLoading ? "Loading Role..." : `${workflowRole} · Authenticated`}
            </button>
          </div>
        </div>

        {fundAccessMessage && (
          <div className="activation-note warning" role="status">
            {fundAccessMessage}
          </div>
        )}

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
                disabled={
                  loading || authLoading || !fundAccessReady || !activeFundAccess
                }
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
              disabled={
                !readiness.canActivate ||
                !canActivateFund ||
                actionLoadingId === "activate-fund"
              }
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
              canSubmitApprovals &&
              workflowConfigured &&
              layer.status === "Ready" &&
              (layer.approvalStatus === "Draft" ||
                layer.approvalStatus === "Changes Requested");
            const canReview =
              canReviewApprovals &&
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

                  {canSubmitApprovals && (
                    <button
                      className="activation-submit-button"
                      disabled={!canSubmit || actionLoadingId.length > 0}
                      onClick={() => void updateApproval(layer, "Submitted")}
                      type="button"
                    >
                      {submitLoading ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}

                  {canReviewApprovals && (
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

                  {!canSubmitApprovals && !canReviewApprovals && (
                    <span className="activation-status-pill neutral">Read only</span>
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