import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  requireDocumentStudioFundAccess,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";

type DataRow = Record<string, unknown>;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function getString(row: DataRow | null | undefined, keys: string[], fallback = "") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumber(row: DataRow | null | undefined, keys: string[]) {
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

function formatInr(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "₹0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

async function safeSelectRows(
  supabase: any,
  tableName: string,
  options?: {
    eq?: {
      column: string;
      value: string;
    };
    fundName?: string;
  }
) {
  try {
    let query = supabase.from(tableName).select("*");

    if (options?.eq) {
      query = query.eq(options.eq.column, options.eq.value);
    }

    if (options?.fundName) {
      query = query.eq("fund_name", options.fundName);
    }

    const { data, error } = await query;

    if (error) {
      console.warn(`Document Studio preview skipped ${tableName}:`, error.message);
      return [] as DataRow[];
    }

    return (data ?? []) as DataRow[];
  } catch (error) {
    console.warn(`Document Studio preview skipped ${tableName}:`, error);
    return [] as DataRow[];
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const baseActor = await authenticateDocumentStudioUser(request);
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      body.fund_name,
      "view"
    );

    const investorCode = String(body.investor_code || "").trim();
    const investorId = String(body.investor_id || "").trim();

    let investorRows: DataRow[] = [];

    if (investorId) {
      investorRows = await safeSelectRows(supabase, "investor_master", {
        eq: {
          column: "id",
          value: investorId,
        },
        fundName: actor.fundName,
      });
    }

    if (investorRows.length === 0 && investorCode) {
      investorRows = await safeSelectRows(supabase, "investor_master", {
        eq: {
          column: "investor_code",
          value: investorCode,
        },
        fundName: actor.fundName,
      });
    }

    if (investorRows.length === 0) {
      investorRows = await safeSelectRows(supabase, "investor_master", {
        fundName: actor.fundName,
      });
    }

    investorRows = investorRows.filter(
      (row) => getString(row, ["fund_name"]) === actor.fundName
    );

    const investor = investorRows[0] ?? null;

    if (!investor) {
      return NextResponse.json(
        { error: "No investor record found for preview." },
        { status: 404 }
      );
    }

    const resolvedInvestorId = getString(investor, ["id"]);
    const resolvedInvestorCode = getString(investor, ["investor_code", "code"]);
    const resolvedInvestorName = getString(investor, [
      "investor_name",
      "name",
      "full_name",
    ]);

    const commitmentRows = resolvedInvestorId
      ? await safeSelectRows(supabase, "fund_commitments", {
          eq: {
            column: "investor_id",
            value: resolvedInvestorId,
          },
        })
      : [];

    const positionRows = resolvedInvestorId
      ? await safeSelectRows(supabase, "investor_financial_positions", {
          eq: {
            column: "investor_id",
            value: resolvedInvestorId,
          },
        })
      : [];

    const cashflowRows = resolvedInvestorId
      ? await safeSelectRows(supabase, "investor_cashflows", {
          eq: {
            column: "investor_id",
            value: resolvedInvestorId,
          },
        })
      : [];

    const documentRows = resolvedInvestorCode
      ? await safeSelectRows(supabase, "investor_documents", {
          eq: {
            column: "investor_code",
            value: resolvedInvestorCode,
          },
        })
      : [];

    const commitment = commitmentRows[0] ?? null;
    const position = positionRows[0] ?? null;

    const commitmentAmount =
      getNumber(commitment, [
        "commitment_amount",
        "committed_amount",
        "commitment",
        "amount",
      ]) ||
      getNumber(position, ["commitment_amount", "committed_amount"]);

    const capitalCalled = getNumber(position, [
      "capital_called_till_date",
      "capital_called",
      "called_capital",
      "called_amount",
    ]);

    const uncalledCapital =
      getNumber(position, [
        "uncalled_capital",
        "unfunded_commitment",
        "remaining_commitment",
      ]) || Math.max(commitmentAmount - capitalCalled, 0);

    const currentNav = getNumber(position, ["current_nav", "nav", "latest_nav"]);

    const distributions = getNumber(position, [
      "distributions_till_date",
      "distributions",
      "distributed_amount",
    ]);

    const mergedFields = {
      investor_id: resolvedInvestorId,
      investor_code: resolvedInvestorCode,
      investor_name: resolvedInvestorName,
      email: getString(investor, ["email", "investor_email"]),
      investor_type: getString(investor, ["investor_type", "type"], "Investor"),

      fund_name: getString(commitment, ["fund_name"], actor.fundName),
      statement_period: body.statement_period || "Q1 FY 2025-26",
      report_date: body.report_date || "30-Jun-2025",
      generated_on: new Date().toLocaleDateString("en-IN"),

      commitment_amount: formatInr(commitmentAmount),
      capital_called: formatInr(capitalCalled),
      uncalled_capital: formatInr(uncalledCapital),
      current_nav: formatInr(currentNav),
      distribution_amount: formatInr(distributions),

      dpi: getString(position, ["dpi"], "0.00x"),
      tvpi: getString(position, ["tvpi"], "0.00x"),
      irr: getString(position, ["irr", "net_irr", "gross_irr"], "0.00%"),

      cashflow_count: cashflowRows.length,
      document_count: documentRows.length,
    };

    const transactions = cashflowRows.slice(0, 25).map((row) => ({
      date: getString(row, ["cashflow_date", "transaction_date", "date"]),
      description: getString(row, [
        "description",
        "cashflow_type",
        "transaction_type",
      ]),
      amount: formatInr(
        getNumber(row, ["amount", "cashflow_amount", "transaction_amount"])
      ),
      type: getString(row, ["cashflow_type", "transaction_type", "type"]),
    }));

    return NextResponse.json({
      message: "Preview merge data generated successfully.",
      investor: {
        id: resolvedInvestorId,
        investor_code: resolvedInvestorCode,
        investor_name: resolvedInvestorName,
      },
      mergedFields,
      tables: {
        transactions,
      },
      sourceCounts: {
        commitmentRows: commitmentRows.length,
        positionRows: positionRows.length,
        cashflowRows: cashflowRows.length,
        documentRows: documentRows.length,
      },
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate preview merge data.",
      },
      { status: 500 }
    );
  }
}