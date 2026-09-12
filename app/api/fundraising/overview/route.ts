import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

type SelectRowsOptions = {
  orderBy?: string;
  ascending?: boolean;
};

const ALLOWED_ROLES = new Set([
  "fund_admin",
  "investor_relations",
]);

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

function jsonResponse(body: DataRow, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
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
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError(
        "Please sign in before opening the Investor Relations workspace.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );

    if (!fundName) {
      return jsonError("Fund name is required.", 400, "FUND_NAME_REQUIRED");
    }

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);
    const user = userResult?.user;

    if (userError || !user) {
      return jsonError(
        "Your session is no longer valid.",
        401,
        "INVALID_SESSION"
      );
    }

    const [profileResult, membershipResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_user_profiles")
        .select("user_id,default_role,active_organisation_id,status")
        .eq("user_id", user.id)
        .maybeSingle(),

      supabaseAdmin
        .from("ventiq_organisation_members")
        .select("id,organisation_id,user_id,role,status,is_primary")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .order("is_primary", { ascending: false }),
    ]);

    if (profileResult.error) {
      throw new Error(
        `Unable to load VENTIQ profile: ${profileResult.error.message}`
      );
    }

    if (membershipResult.error) {
      throw new Error(
        `Unable to load organisation membership: ${membershipResult.error.message}`
      );
    }

    const profile =
      (profileResult.data as unknown as DataRow | null) ?? null;
    const memberships =
      (membershipResult.data ?? []) as unknown as DataRow[];

    if (
      !profile ||
      normalizeText(profile.status, 40).toLowerCase() !== "active"
    ) {
      return jsonError(
        "Your VENTIQ profile is not active.",
        403,
        "PROFILE_NOT_ACTIVE"
      );
    }

    const profileRole = normalizeText(
      profile.default_role,
      80
    ).toLowerCase();
    const primaryMembership =
      memberships.find((row) => Boolean(row.is_primary)) ??
      memberships[0] ??
      null;
    const membershipRole = normalizeText(
      primaryMembership?.role,
      80
    ).toLowerCase();

    // Match AuthProvider activeRole precedence exactly.
    const activeRole = profileRole || membershipRole;

    if (!ALLOWED_ROLES.has(activeRole)) {
      return jsonError(
        "The requested Investor Relations workspace was not found.",
        404,
        "INVESTOR_RELATIONS_WORKSPACE_NOT_FOUND"
      );
    }

    if (activeRole !== "fund_admin") {
      const profileOrganisationId = normalizeText(
        profile.active_organisation_id,
        80
      );
      const membershipOrganisationId = normalizeText(
        primaryMembership?.organisation_id,
        80
      );
      const activeOrganisationId =
        profileOrganisationId || membershipOrganisationId;

      let fundAccessQuery = supabaseAdmin
        .from("ventiq_user_fund_access")
        .select("organisation_id,can_view,status")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .ilike("fund_name", fundName);

      if (activeOrganisationId) {
        fundAccessQuery = fundAccessQuery.eq(
          "organisation_id",
          activeOrganisationId
        );
      }

      const { data: rawFundAccess, error: fundAccessError } =
        await fundAccessQuery.limit(1).maybeSingle();

      if (fundAccessError) {
        throw new Error(
          `Unable to verify governed fund access: ${fundAccessError.message}`
        );
      }

      const fundAccess =
        (rawFundAccess as unknown as DataRow | null) ?? null;

      if (!fundAccess || !Boolean(fundAccess.can_view)) {
        return jsonError(
          "The requested Investor Relations workspace was not found.",
          404,
          "INVESTOR_RELATIONS_WORKSPACE_NOT_FOUND"
        );
      }

      const fundAccessOrganisationId = normalizeText(
        fundAccess.organisation_id,
        80
      );

      if (
        activeOrganisationId &&
        fundAccessOrganisationId &&
        activeOrganisationId !== fundAccessOrganisationId
      ) {
        return jsonError(
          "The requested Investor Relations workspace was not found.",
          404,
          "INVESTOR_RELATIONS_WORKSPACE_NOT_FOUND"
        );
      }
    }

    const userDb = createUserScopedClient(accessToken);

    async function selectRows(
      tableName: string,
      selectColumns: string,
      options?: SelectRowsOptions
    ): Promise<DataRow[]> {
      try {
        let query = userDb.from(tableName).select(selectColumns);

        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? false,
          });
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            `VENTIQ Investor Relations overview skipped ${tableName}:`,
            error.message
          );
          return [];
        }

        return (data ?? []) as unknown as DataRow[];
      } catch (error) {
        console.warn(
          `VENTIQ Investor Relations overview skipped ${tableName}:`,
          error
        );
        return [];
      }
    }

    async function loadActivationRecord(): Promise<DataRow | null> {
      try {
        const { data, error } = await userDb
          .from("fund_activation_status")
          .select("status, activated_at, activated_by, readiness_score")
          .eq("fund_name", fundName)
          .maybeSingle();

        if (error) {
          console.warn(
            "VENTIQ Investor Relations overview could not read fund activation:",
            error.message
          );
          return null;
        }

        return (data as unknown as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          "VENTIQ Investor Relations overview could not read fund activation:",
          error
        );
        return null;
      }
    }

    const [
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
      selectRows("investor_master", "batch_id,created_at,email,fund_name,id,investor_name,investor_type,source_batch_id,updated_at", {
        orderBy: "investor_code",
        ascending: true,
      }),
      selectRows("fund_commitments", "batch_id,commitment_amount,created_at,fund_name,source_batch_id,updated_at"),
      selectRows("investor_cashflows", "fund_name,source_batch_id", {
        orderBy: "cashflow_date",
        ascending: false,
      }),
      selectRows("investor_documents", "document_name,document_type,fund_name,generated_at,id,investor_name,migration_batch_id,portal_status,storage_path,storage_url", {
        orderBy: "generated_at",
        ascending: false,
      }),
      selectRows("compliance_items", "batch_id,created_at,evidence_available,filing_status,fund_name,migration_status,risk_level,source_batch_id,updated_at", {
        orderBy: "due_date",
        ascending: true,
      }),
      selectRows("migration_file_uploads", "batch_id,category,created_at,dataset_key,fund_name,original_file_name,processing_status,updated_at,upload_status", {
        orderBy: "created_at",
        ascending: false,
      }),
      selectRows("data_room_documents", "created_at,detected_type,file_name,fund_name,id,imported_at,source_batch_id", {
        orderBy: "imported_at",
        ascending: false,
      }),
      selectRows("data_room_engagement_events", "action,created_at,document_name,event_time,fund_name,id,investor_name,source_batch_id", {
        orderBy: "event_time",
        ascending: false,
      }),
      selectRows("data_room_questions", "answered_at,asked_at,category,created_at,fund_name,id,investor_name,source_batch_id,status", {
        orderBy: "asked_at",
        ascending: false,
      }),
      loadActivationRecord(),
    ]);

    return jsonResponse({
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
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Investor Relations workspace.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Investor Relations workspace is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Investor Relations overview load failed:", error);

    return jsonError(
      message,
      500,
      "INVESTOR_RELATIONS_OVERVIEW_LOAD_FAILED"
    );
  }
}
