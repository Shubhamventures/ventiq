import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../../lib/server/governedFundAccess";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LayerKey = "investor" | "pdf" | "portfolio" | "fund" | "compliance";

type DataRow = Record<string, unknown>;

type LayerSnapshot = {
  key: LayerKey;
  title: string;
  source_table: string;
  source_batch_id: string;
  batch_name: string;
  data_ready: boolean;
  approval_status: string;
  approved: boolean;
  operational: boolean;
  count: number;
  primary_metric: string;
  secondary_metric: string;
  warning_count: number;
  blockers: string[];
};

const layerTitles: Record<LayerKey, string> = {
  investor: "Investor Data",
  pdf: "PDF Intelligence",
  portfolio: "Portfolio Data",
  fund: "Fund Data",
  compliance: "Compliance Data",
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeFundName(value: unknown) {
  return normalizeText(value, 240);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCr(value: number) {
  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function latestByFund(table: string, fundName: string) {
  const result = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("fund_name", fundName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`${table}: ${result.error.message}`);
  }

  return (result.data as DataRow | null) ?? null;
}

async function byId(table: string, id: string, fundName: string) {
  if (!id) return null;

  if (table === "fund_data_migration_batches") {
    const anchorResult = await supabaseAdmin
      .from("fund_master")
      .select("batch_id")
      .eq("fund_name", fundName)
      .eq("batch_id", id)
      .limit(1)
      .maybeSingle();

    if (anchorResult.error) {
      throw new Error(`fund_master: ${anchorResult.error.message}`);
    }

    if (!anchorResult.data) return null;

    const fundBatchResult = await supabaseAdmin
      .from("fund_data_migration_batches")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fundBatchResult.error) {
      throw new Error(
        `fund_data_migration_batches: ${fundBatchResult.error.message}`
      );
    }

    return (fundBatchResult.data as DataRow | null) ?? null;
  }

  const result = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", id)
    .eq("fund_name", fundName)
    .maybeSingle();

  if (result.error) {
    throw new Error(`${table}: ${result.error.message}`);
  }

  return (result.data as DataRow | null) ?? null;
}

async function latestFundBatchForFund(fundName: string) {
  const anchorResult = await supabaseAdmin
    .from("fund_master")
    .select("batch_id, created_at")
    .eq("fund_name", fundName)
    .not("batch_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anchorResult.error) {
    throw new Error(`fund_master: ${anchorResult.error.message}`);
  }

  const batchId = normalizeText(anchorResult.data?.batch_id, 80);
  return batchId ? byId("fund_data_migration_batches", batchId, fundName) : null;
}

function candidateLayerFromRow(
  key: LayerKey,
  row: DataRow | null,
  approvalStatus: string,
  fundIsActive: boolean,
  calculationReady: boolean
): LayerSnapshot {
  const sourceBatchId = normalizeText(row?.id, 80);
  const batchName =
    normalizeText(row?.batch_name, 240) ||
    (sourceBatchId ? `Selected ${layerTitles[key]} batch` : "No batch loaded");

  let dataReady = false;
  let count = 0;
  let primaryMetric = "No governed data";
  let secondaryMetric = "Not ready";
  let warningCount = 0;
  const blockers: string[] = [];

  if (key === "investor") {
    const totalRecords = numberValue(row?.total_records);
    const totalCommitment = numberValue(row?.total_commitment);
    const sourceStatus = normalizeText(row?.status, 80) || "Unknown";

    count = totalRecords;
    dataReady =
      totalRecords > 0 &&
      totalCommitment > 0 &&
      (sourceStatus === "imported" || sourceStatus === "published");

    primaryMetric = `${formatCr(totalCommitment)} commitment`;
    secondaryMetric = `${totalRecords} investors`;

    if (totalRecords <= 0) blockers.push("INVESTOR_RECORDS_MISSING");
    if (totalCommitment <= 0) blockers.push("INVESTOR_COMMITMENT_MISSING");
    if (sourceStatus !== "imported" && sourceStatus !== "published") {
      blockers.push("INVESTOR_BATCH_NOT_FINAL");
    }
  }

  if (key === "pdf") {
    const totalFiles = numberValue(row?.total_files);
    const readyFiles = numberValue(row?.ready_files);
    const reviewFiles = numberValue(row?.review_files);
    const unmatchedFiles = numberValue(row?.unmatched_files);

    count = totalFiles;
    warningCount = reviewFiles + unmatchedFiles;
    dataReady =
      totalFiles > 0 &&
      warningCount === 0 &&
      readyFiles >= totalFiles;

    primaryMetric = `${totalFiles} PDFs processed`;
    secondaryMetric = `${warningCount} review items`;

    if (totalFiles <= 0) blockers.push("PDF_FILES_MISSING");
    if (reviewFiles > 0) blockers.push("PDF_REVIEW_REQUIRED");
    if (unmatchedFiles > 0) blockers.push("PDF_UNMATCHED");
    if (totalFiles > 0 && readyFiles < totalFiles) {
      blockers.push("PDF_CLASSIFICATION_INCOMPLETE");
    }
  }

  if (key === "portfolio") {
    const totalRecords = numberValue(row?.total_records);
    const currentValue = numberValue(row?.current_portfolio_value);
    const atRiskCount = numberValue(row?.at_risk_count);
    const moic = numberValue(row?.portfolio_moic);

    count = totalRecords;
    warningCount = 0;
    dataReady = totalRecords > 0 && currentValue > 0;

    primaryMetric = `${formatCr(currentValue)} value`;
    secondaryMetric = `${moic.toFixed(2)}x MOIC`;

    if (totalRecords <= 0) blockers.push("PORTFOLIO_RECORDS_MISSING");
    if (currentValue <= 0) blockers.push("PORTFOLIO_VALUE_MISSING");

    // At-risk investments are monitoring signals, not migration completeness blockers.
    if (atRiskCount > 0) {
      secondaryMetric += ` · ${atRiskCount} at-risk`;
    }
  }

  if (key === "fund") {
    const totalFunds = numberValue(row?.total_funds);
    const committedCapital = numberValue(row?.total_committed_capital);
    const averageCarry = numberValue(row?.average_carry);

    count = totalFunds;
    dataReady = totalFunds > 0 && committedCapital > 0;

    primaryMetric = `${formatCr(committedCapital)} committed`;
    secondaryMetric = `${averageCarry.toFixed(0)}% carry`;

    if (totalFunds <= 0) blockers.push("FUND_RECORD_MISSING");
    if (committedCapital <= 0) blockers.push("FUND_COMMITMENT_MISSING");
  }

  if (key === "compliance") {
    const totalItems = numberValue(row?.total_items);
    const pendingReview = numberValue(row?.pending_review_count);
    const highRisk = numberValue(row?.high_risk_count);
    const evidenceAvailable = numberValue(row?.evidence_available_count);

    count = totalItems;
    warningCount = pendingReview + highRisk + Math.max(0, totalItems - evidenceAvailable);
    dataReady =
      totalItems > 0 &&
      pendingReview === 0 &&
      highRisk === 0 &&
      evidenceAvailable >= totalItems;

    primaryMetric = `${evidenceAvailable}/${totalItems} evidence`;
    secondaryMetric = `${highRisk} high-risk items`;

    if (totalItems <= 0) blockers.push("COMPLIANCE_ITEMS_MISSING");
    if (pendingReview > 0) blockers.push("COMPLIANCE_REVIEW_REQUIRED");
    if (highRisk > 0) blockers.push("COMPLIANCE_HIGH_RISK_OPEN");
    if (evidenceAvailable < totalItems) blockers.push("COMPLIANCE_EVIDENCE_MISSING");
  }

  const approved = approvalStatus === "Approved";

  if (!sourceBatchId) blockers.push("SOURCE_BATCH_MISSING");
  if (!approved) blockers.push("CHECKER_APPROVAL_REQUIRED");
  if (!fundIsActive) {
    blockers.push("FUND_ACTIVATION_REQUIRED");
  } else if (!calculationReady) {
    blockers.push("CALCULATION_RECONCILIATION_REQUIRED");
  }

  return {
    key,
    title: layerTitles[key],
    source_table:
      key === "investor"
        ? "investor_import_batches"
        : key === "pdf"
          ? "pdf_intelligence_batches"
          : key === "portfolio"
            ? "portfolio_data_migration_batches"
            : key === "fund"
              ? "fund_data_migration_batches"
              : "compliance_data_migration_batches",
    source_batch_id: sourceBatchId,
    batch_name: batchName,
    data_ready: dataReady,
    approval_status: approvalStatus || "Draft",
    approved,
    operational: Boolean(
      sourceBatchId && dataReady && approved && fundIsActive && calculationReady
    ),
    count,
    primary_metric: primaryMetric,
    secondary_metric: secondaryMetric,
    warning_count: warningCount,
    blockers: Array.from(new Set(blockers)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);

    const fundName = normalizeFundName(
      request.nextUrl.searchParams.get("fund_name")
    );

    if (!fundName) {
      return NextResponse.json(
        { error: "fund_name is required." },
        { status: 400 }
      );
    }

    const governedFunds = await listGovernedFunds(actor);
    const fundAccess = governedFunds.find(
      (fund) =>
        fund.fund_name.trim().toLowerCase() === fundName.trim().toLowerCase()
    );

    if (!fundAccess || !fundAccess.can_view) {
      return NextResponse.json(
        { error: "You do not have governed view access to this fund." },
        { status: 403 }
      );
    }

    const activationResult = await supabaseAdmin
      .from("fund_activation_status")
      .select(
        "status, readiness_score, activated_at, activated_by, approved_batch_map"
      )
      .eq("fund_name", fundName)
      .maybeSingle();

    if (activationResult.error) {
      throw new Error(
        `fund_activation_status: ${activationResult.error.message}`
      );
    }

    const activation = (activationResult.data as DataRow | null) ?? null;
    const fundIsActive = normalizeText(activation?.status, 80) === "Active";
    const approvedBatchMap = objectValue(activation?.approved_batch_map);
    const calculationRunId = normalizeText(
      approvedBatchMap.calculation_run,
      80
    );

    let calculationRun: DataRow | null = null;
    let reconciliationRows: DataRow[] = [];

    if (calculationRunId) {
      const calculationRunResult = await supabaseAdmin
        .from("metric_calculation_runs")
        .select(
          "id, fund_name, as_of_date, calculation_status, completed_at, source_batch_ids"
        )
        .eq("id", calculationRunId)
        .eq("fund_name", fundName)
        .eq("calculation_status", "Completed")
        .maybeSingle();

      if (calculationRunResult.error) {
        throw new Error(
          `metric_calculation_runs: ${calculationRunResult.error.message}`
        );
      }

      calculationRun =
        (calculationRunResult.data as DataRow | null) ?? null;

      if (calculationRun) {
        const reconciliationResult = await supabaseAdmin
          .from("metric_reconciliation_results")
          .select("reconciliation_status")
          .eq("calculation_run_id", calculationRunId);

        if (reconciliationResult.error) {
          throw new Error(
            `metric_reconciliation_results: ${reconciliationResult.error.message}`
          );
        }

        reconciliationRows = (reconciliationResult.data ?? []) as DataRow[];
      }
    }

    const passedReconciliationCount = reconciliationRows.filter(
      (row) =>
        normalizeText(row.reconciliation_status, 80).toLowerCase() === "pass"
    ).length;
    const calculationReady =
      Boolean(calculationRun) &&
      reconciliationRows.length > 0 &&
      passedReconciliationCount === reconciliationRows.length;

    const frozenBatchIds: Record<LayerKey, string> = {
      investor: normalizeText(approvedBatchMap.investor, 80),
      pdf: normalizeText(approvedBatchMap.pdf, 80),
      portfolio: normalizeText(approvedBatchMap.portfolio, 80),
      fund: normalizeText(approvedBatchMap.fund, 80),
      compliance: normalizeText(approvedBatchMap.compliance, 80),
    };

    const [
      latestInvestor,
      latestPdf,
      latestPortfolio,
      latestFund,
      latestCompliance,
    ] = await Promise.all([
      latestByFund("investor_import_batches", fundName),
      latestByFund("pdf_intelligence_batches", fundName),
      latestByFund("portfolio_data_migration_batches", fundName),
      latestFundBatchForFund(fundName),
      latestByFund("compliance_data_migration_batches", fundName),
    ]);

    const selectedRows: Record<LayerKey, DataRow | null> = {
      investor:
        fundIsActive && frozenBatchIds.investor
          ? await byId(
              "investor_import_batches",
              frozenBatchIds.investor,
              fundName
            )
          : latestInvestor,
      pdf:
        fundIsActive && frozenBatchIds.pdf
          ? await byId(
              "pdf_intelligence_batches",
              frozenBatchIds.pdf,
              fundName
            )
          : latestPdf,
      portfolio:
        fundIsActive && frozenBatchIds.portfolio
          ? await byId(
              "portfolio_data_migration_batches",
              frozenBatchIds.portfolio,
              fundName
            )
          : latestPortfolio,
      fund:
        fundIsActive && frozenBatchIds.fund
          ? await byId(
              "fund_data_migration_batches",
              frozenBatchIds.fund,
              fundName
            )
          : latestFund,
      compliance:
        fundIsActive && frozenBatchIds.compliance
          ? await byId(
              "compliance_data_migration_batches",
              frozenBatchIds.compliance,
              fundName
            )
          : latestCompliance,
    };

    const approvalsResult = await supabaseAdmin
      .from("migration_data_approvals")
      .select("layer_key, source_batch_id, status, reviewed_at, checker_name")
      .eq("fund_name", fundName);

    if (approvalsResult.error) {
      throw new Error(
        `migration_data_approvals: ${approvalsResult.error.message}`
      );
    }

    const approvalRows = (approvalsResult.data ?? []) as DataRow[];

    function approvalStatusFor(key: LayerKey, row: DataRow | null) {
      const batchId = normalizeText(row?.id, 80);
      if (!batchId) return "Draft";

      const matches = approvalRows.filter(
        (approval) =>
          normalizeText(approval.layer_key, 80) === key &&
          normalizeText(approval.source_batch_id, 80) === batchId
      );

      if (
        matches.some(
          (approval) => normalizeText(approval.status, 80) === "Approved"
        )
      ) {
        return "Approved";
      }

      if (
        matches.some(
          (approval) => normalizeText(approval.status, 80) === "Submitted"
        )
      ) {
        return "Submitted";
      }

      if (
        matches.some(
          (approval) =>
            normalizeText(approval.status, 80) === "Changes Requested"
        )
      ) {
        return "Changes Requested";
      }

      return "Draft";
    }

    const layers = ([
      "investor",
      "pdf",
      "portfolio",
      "fund",
      "compliance",
    ] as LayerKey[]).map((key) =>
      candidateLayerFromRow(
        key,
        selectedRows[key],
        approvalStatusFor(key, selectedRows[key]),
        fundIsActive,
        calculationReady
      )
    );

    const operationalLayerCount = layers.filter(
      (layer) => layer.operational
    ).length;

    return NextResponse.json({
      ok: true,
      fund: {
        fund_name: fundName,
        role: fundAccess.role,
        can_view: fundAccess.can_view,
        can_edit: fundAccess.can_edit,
        can_approve: fundAccess.can_approve,
      },
      activation: {
        status: normalizeText(activation?.status, 80) || "Setup Not Started",
        readiness_score: numberValue(activation?.readiness_score),
        activated_at: normalizeText(activation?.activated_at, 80),
        activated_by: normalizeText(activation?.activated_by, 240),
        is_active: fundIsActive,
        using_frozen_batch_map: fundIsActive,
        calculation_run_id: calculationRunId,
        calculation_ready: calculationReady,
        calculation_as_of_date: normalizeText(calculationRun?.as_of_date, 80),
        reconciliation_controls: reconciliationRows.length,
        reconciliation_passed: passedReconciliationCount,
      },
      layers,
      summary: {
        operational_layers: operationalLayerCount,
        total_layers: layers.length,
        calculation_ready: calculationReady,
        launch_gate_open:
          fundIsActive &&
          calculationReady &&
          operationalLayerCount === layers.length,
      },
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load stakeholder launch readiness.",
      },
      { status: 500 }
    );
  }
}
