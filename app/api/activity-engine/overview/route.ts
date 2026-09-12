import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../../lib/server/governedFundAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
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

function normalizeFundName(value: string | null) {
  return String(value || "").trim().slice(0, 240);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const fundName = normalizeFundName(
      request.nextUrl.searchParams.get("fundName")
    );

    if (!fundName) {
      return json({ error: "fundName is required." }, 400);
    }

    const governedFunds = await listGovernedFunds(actor);
    const fundAccess = governedFunds.find(
      (fund) =>
        fund.fund_name.trim().toLowerCase() === fundName.toLowerCase()
    );

    if (!fundAccess || !fundAccess.can_view) {
      return json(
        { error: "You do not have governed view access to this fund." },
        403
      );
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return json(
        { error: "Please sign in before loading the Activity Engine." },
        401
      );
    }

    const db = createUserScopedClient(accessToken);
    const [
      capitalCallResult,
      documentResult,
      dataRoomDocumentResult,
      engagementResult,
      questionResult,
      migrationActivationResult,
    ] = await Promise.all([
        db
                  .from("capital_calls")
                  .select(
                    "id, call_name, call_date, due_date, call_amount, status, created_at, funds!inner(name)"
                  )
                  .eq("funds.name", fundName)
                  .order("created_at", { ascending: false })
                  .limit(10),
        db
                  .from("investor_documents")
                  .select(
                    "id, investor_id, document_type, document_name, investor_name, investor_email, fund_name, amount, status, email_status, portal_status, storage_url, generated_at"
                  )
                  .eq("fund_name", fundName)
                  .order("generated_at", { ascending: false })
                  .limit(40),
        db
                  .from("data_room_documents")
                  .select("id,file_name,file_size,file_type,detected_type,suggested_folder,access_level,status,ddq_impact,imported_at,uploaded_by,created_at,updated_at,fund_name,source_batch_id,investor_code,investor_name,document_name,storage_bucket,storage_path,storage_url,mime_type,document_status,metadata,created_by_email")
                  .eq("fund_name", fundName)
                  .order("imported_at", { ascending: false })
                  .limit(40),
        db
                  .from("data_room_engagement_events")
                  .select("id,investor_name,document_id,document_name,action,note,event_time,created_at,fund_name,source_batch_id,investor_code,investor_email,metadata,recorded_by,recorded_by_email")
                  .eq("fund_name", fundName)
                  .order("event_time", { ascending: false })
                  .limit(40),
        db
                  .from("data_room_questions")
                  .select("id,investor_name,document_id,document_name,category,question,status,answer,asked_at,answered_at,created_at,updated_at,fund_name,source_batch_id,investor_code,investor_email,assigned_to,metadata,created_by,created_by_email")
                  .eq("fund_name", fundName)
                  .order("asked_at", { ascending: false })
                  .limit(40),
        db
                  .from("migration_activation_events")
                  .select("id,event_type,layer_id,layer_title,event_title,event_description,actor_name,created_at,fund_name,layer_key,actor_role,description,metadata,actor_user_id")
                  .order("created_at", { ascending: false })
                  .limit(40),
    ]);

    const firstError = capitalCallResult.error || documentResult.error || dataRoomDocumentResult.error || engagementResult.error || questionResult.error || migrationActivationResult.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    return json({
      capitalCallResult: capitalCallResult.data ?? [],
      documentResult: documentResult.data ?? [],
      dataRoomDocumentResult: dataRoomDocumentResult.data ?? [],
      engagementResult: engagementResult.data ?? [],
      questionResult: questionResult.data ?? [],
      migrationActivationResult: migrationActivationResult.data ?? [],
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load governed Activity Engine data.",
      },
      500
    );
  }
}
