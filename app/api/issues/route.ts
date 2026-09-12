import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../lib/server/governedFundAccess";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;
type IssueSeverity = "Blocking" | "Review";

type IssueItem = {
  id: string;
  source: "Data Intake" | "Calculation";
  severity: IssueSeverity;
  code: string;
  title: string;
  message: string;
  repairHref: string;
  context: Record<string, string | number | null>;
};

function normalizeText(value: unknown, maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildValidationIssue(row: DataRow, batchId: string): IssueItem {
  const id = normalizeText(row.id, 100);
  const severity = normalizeText(row.severity, 80);
  const issueCode =
    normalizeText(row.issue_code, 160) || "MIGRATION_VALIDATION_ISSUE";
  const sourceFileName =
    normalizeText(row.source_file_name, 240) || "Migration source";
  const sourceSheetName = normalizeText(row.source_sheet_name, 240);
  const sourceRowNumber = numberValue(row.source_row_number);
  const fieldName = normalizeText(row.field_name, 160);
  const message =
    normalizeText(row.message, 1200) || "Migration validation requires review.";

  return {
    id: `intake:${id || issueCode}:${sourceRowNumber}`,
    source: "Data Intake",
    severity: severity.toLowerCase() === "error" ? "Blocking" : "Review",
    code: issueCode,
    title: `${severity || "Review"} · ${issueCode}`,
    message,
    repairHref: `/migration/data-intake?batchId=${encodeURIComponent(
      batchId
    )}&issueId=${encodeURIComponent(id)}`,
    context: {
      batchId,
      datasetKey: normalizeText(row.dataset_key, 160),
      sourceFileName,
      sourceSheetName: sourceSheetName || null,
      sourceRowNumber: sourceRowNumber || null,
      fieldName: fieldName || null,
    },
  };
}

function buildReconciliationIssue(
  row: DataRow,
  runId: string
): IssueItem | null {
  const status = normalizeText(row.reconciliation_status, 80);
  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus === "pass" ||
    normalizedStatus === "not applicable" ||
    !normalizedStatus
  ) {
    return null;
  }

  const metricName =
    normalizeText(row.metric_name, 200) || "Calculation control";
  const reconciliationType = normalizeText(row.reconciliation_type, 160);
  const differenceAmount = numberValue(row.difference_amount);
  const differencePercentage = numberValue(row.difference_percentage);

  return {
    id: `calculation:${runId}:${reconciliationType}:${metricName}`,
    source: "Calculation",
    severity: normalizedStatus === "fail" ? "Blocking" : "Review",
    code: `RECONCILIATION_${status.toUpperCase().replaceAll(" ", "_")}`,
    title: `${metricName} · ${status}`,
    message:
      status === "Fail"
        ? "The canonical calculation does not reconcile within the configured tolerance."
        : "The canonical calculation is outside the normal tolerance and requires review.",
    repairHref: `/migration/performance-calculations?runId=${encodeURIComponent(
      runId
    )}&metric=${encodeURIComponent(metricName)}`,
    context: {
      calculationRunId: runId,
      reconciliationType: reconciliationType || null,
      metricName,
      sourceValue:
        row.source_value === null || row.source_value === undefined
          ? null
          : numberValue(row.source_value),
      calculatedValue:
        row.calculated_value === null || row.calculated_value === undefined
          ? null
          : numberValue(row.calculated_value),
      differenceAmount,
      differencePercentage,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );

    if (!fundName) {
      return NextResponse.json(
        { error: "fundName is required." },
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

    const batchResult = await supabaseAdmin
      .from("migration_intake_batches")
      .select(
        "id, batch_name, fund_name, intake_mode, status, processing_status, total_rows, validation_error_count, validation_warning_count, created_at, updated_at"
      )
      .ilike("fund_name", fundName)
      .eq("intake_mode", "Canonical")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batchResult.error) {
      throw new Error(
        `migration_intake_batches: ${batchResult.error.message}`
      );
    }

    const batch = (batchResult.data as DataRow | null) ?? null;
    const batchId = normalizeText(batch?.id, 100);

    let validationRows: DataRow[] = [];

    if (batchId) {
      const validationResult = await supabaseAdmin
        .from("migration_validation_issues")
        .select(
          "id, batch_id, file_upload_id, fund_name, dataset_key, source_file_name, source_sheet_name, source_row_number, severity, issue_code, field_name, message, resolution_status"
        )
        .eq("batch_id", batchId)
        .ilike("fund_name", fundName)
        .eq("resolution_status", "Open")
        .order("severity", { ascending: true })
        .order("source_file_name", { ascending: true })
        .limit(500);

      if (validationResult.error) {
        throw new Error(
          `migration_validation_issues: ${validationResult.error.message}`
        );
      }

      validationRows = (validationResult.data ?? []) as DataRow[];
    }

    const calculationRunResult = await supabaseAdmin
      .from("metric_calculation_runs")
      .select(
        "id, fund_name, as_of_date, calculation_status, completed_at, created_at"
      )
      .eq("fund_name", fundName)
      .eq("calculation_status", "Completed")
      .order("as_of_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (calculationRunResult.error) {
      throw new Error(
        `metric_calculation_runs: ${calculationRunResult.error.message}`
      );
    }

    const calculationRun =
      (calculationRunResult.data as DataRow | null) ?? null;
    const calculationRunId = normalizeText(calculationRun?.id, 100);

    let reconciliationRows: DataRow[] = [];

    if (calculationRunId) {
      const reconciliationResult = await supabaseAdmin
        .from("metric_reconciliation_results")
        .select(
          "calculation_run_id, fund_name, as_of_date, reconciliation_type, metric_name, source_value, calculated_value, difference_amount, difference_percentage, reconciliation_status, source_reference, calculation_reference"
        )
        .eq("calculation_run_id", calculationRunId)
        .order("reconciliation_type", { ascending: true })
        .order("metric_name", { ascending: true });

      if (reconciliationResult.error) {
        throw new Error(
          `metric_reconciliation_results: ${reconciliationResult.error.message}`
        );
      }

      reconciliationRows =
        (reconciliationResult.data ?? []) as DataRow[];
    }

    const issues: IssueItem[] = [
      ...validationRows.map((row) => buildValidationIssue(row, batchId)),
      ...reconciliationRows
        .map((row) => buildReconciliationIssue(row, calculationRunId))
        .filter((issue): issue is IssueItem => Boolean(issue)),
    ];

    return NextResponse.json({
      ok: true,
      fund: {
        fund_name: fundName,
        role: fundAccess.role,
        can_view: fundAccess.can_view,
        can_edit: fundAccess.can_edit,
        can_approve: fundAccess.can_approve,
      },
      latestBatch: batch
        ? {
            id: batchId,
            batch_name: normalizeText(batch.batch_name, 240),
            status: normalizeText(batch.status, 80),
            processing_status: normalizeText(batch.processing_status, 80),
            total_rows: numberValue(batch.total_rows),
            validation_error_count: numberValue(
              batch.validation_error_count
            ),
            validation_warning_count: numberValue(
              batch.validation_warning_count
            ),
            updated_at: normalizeText(batch.updated_at, 80),
          }
        : null,
      latestCalculation: calculationRun
        ? {
            id: calculationRunId,
            as_of_date: normalizeText(calculationRun.as_of_date, 80),
            calculation_status: normalizeText(
              calculationRun.calculation_status,
              80
            ),
            completed_at: normalizeText(calculationRun.completed_at, 80),
          }
        : null,
      issues,
      summary: {
        total: issues.length,
        blocking: issues.filter(
          (issue) => issue.severity === "Blocking"
        ).length,
        review: issues.filter(
          (issue) => issue.severity === "Review"
        ).length,
        validation: validationRows.length,
        reconciliation: issues.filter(
          (issue) => issue.source === "Calculation"
        ).length,
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
            : "Unable to load the VENTIQ Issue Center.",
      },
      { status: 500 }
    );
  }
}
