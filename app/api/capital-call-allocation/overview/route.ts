import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../../lib/server/governedFundAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

type CommitmentRow = DataRow & {
  id: string;
  investor_id: string;
};

type InvestorRow = DataRow & {
  id: string;
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function createUserScopedClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

async function loadJoinedCommitments(
  userDb: ReturnType<typeof createUserScopedClient>,
  fundName: string,
  batchId: string
) {
  if (!batchId) {
    return [] as Array<CommitmentRow & { investor?: InvestorRow }>;
  }

  const { data: commitmentData, error: commitmentError } = await userDb
    .from("fund_commitments")
    .select(
      "id,batch_id,investor_id,fund_name,class_name,commitment_amount,unfunded_commitment,commitment_status,created_at,updated_at,investor_code,investor_name,email,capital_called_till_date,uncalled_capital,distributions_till_date,setup_fee,management_fee,status,commitment_code,commitment_date,currency,source_batch_id,source_file_name,source_row_number,migration_status"
    )
    .eq("batch_id", batchId)
    .eq("fund_name", fundName)
    .order("created_at", { ascending: true });

  if (commitmentError) {
    throw new Error(commitmentError.message);
  }

  const commitmentRows = (commitmentData || []) as unknown as CommitmentRow[];
  const investorIds = commitmentRows
    .map((row) => normalizeText(row.investor_id, 80))
    .filter(Boolean);

  let investorRows: InvestorRow[] = [];

  if (investorIds.length > 0) {
    const { data: investorData, error: investorError } = await userDb
      .from("investor_master")
      .select(
        "id,batch_id,investor_code,investor_name,email,investor_type,country,tax_id,kyc_status,bank_status,onboarding_status,created_at,updated_at,fund_name,source_batch_id,source_file_name,source_row_number"
      )
      .in("id", investorIds);

    if (investorError) {
      throw new Error(investorError.message);
    }

    investorRows = (investorData || []) as unknown as InvestorRow[];
  }

  const investorById = new Map<string, InvestorRow>();

  investorRows.forEach((investor) => {
    investorById.set(String(investor.id), investor);
  });

  return commitmentRows.map((commitment) => ({
    ...commitment,
    investor: investorById.get(String(commitment.investor_id)),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const accessToken = getBearerToken(request);
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const requestedBatchId = normalizeText(
      request.nextUrl.searchParams.get("batchId"),
      120
    );

    if (!fundName) {
      return noStoreJson({ error: "Fund name is required." }, 400);
    }

    if (!accessToken) {
      return noStoreJson({ error: "Authentication is required." }, 401);
    }

    const governedFunds = await listGovernedFunds(actor);
    const fundAccess = governedFunds.find(
      (fund) =>
        fund.fund_name.trim().toLowerCase() === fundName.trim().toLowerCase()
    );

    if (!fundAccess || !fundAccess.can_view) {
      return noStoreJson(
        { error: "You do not have governed view access to this fund." },
        403
      );
    }

    const userDb = createUserScopedClient(accessToken);

    if (requestedBatchId) {
      const commitments = await loadJoinedCommitments(
        userDb,
        fundName,
        requestedBatchId
      );

      return noStoreJson({
        selectedBatchId: requestedBatchId,
        commitments,
      });
    }

    const { data: batchData, error: batchError } = await userDb
      .from("investor_import_batches")
      .select(
        "id,batch_name,fund_name,source,total_records,total_commitment,status,created_at,updated_at"
      )
      .eq("fund_name", fundName)
      .order("created_at", { ascending: false });

    if (batchError) {
      throw new Error(batchError.message);
    }

    const batches = (batchData || []) as unknown as DataRow[];
    const selectedBatchId = normalizeText(batches[0]?.id, 120);
    const commitments = await loadJoinedCommitments(
      userDb,
      fundName,
      selectedBatchId
    );

    return noStoreJson({
      batches,
      selectedBatchId,
      commitments,
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load capital call allocation data.",
      },
      500
    );
  }
}
