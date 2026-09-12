import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const INVESTOR_PROJECTION =
  "id,batch_id,investor_code,investor_name,email,investor_type,country,tax_id,kyc_status,bank_status,onboarding_status,created_at,updated_at,fund_name,source_batch_id,source_file_name,source_row_number";

type JsonRecord = Record<string, unknown>;

type DocumentOverviewResponse = {
  sourceBatch?: JsonRecord | null;
  documents?: JsonRecord[];
  error?: string;
};

type WorkflowOverviewResponse = {
  sourceBatch?: JsonRecord | null;
  engagementEvents?: JsonRecord[];
  questions?: JsonRecord[];
  error?: string;
};

function normalizeText(value: unknown, maxLength = 500): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function getUserRlsClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "The Investor Data Room is unavailable because Supabase is not configured."
    );
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

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}`);
  }
}

function forwardedHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const appAccessCookie = request.cookies.get("ventiq_app_access")?.value || "";

  if (authorization) {
    headers.set("Authorization", authorization);
  }


  if (appAccessCookie) {
    headers.set("Cookie", `ventiq_app_access=${appAccessCookie}`);
  }
  return headers;
}

function internalUrl(
  request: NextRequest,
  pathname: string,
  fundName: string,
  sourceBatchId = "",
  limit = "500"
): URL {
  const url = new URL(pathname, request.nextUrl.origin);

  url.searchParams.set("fundName", fundName);
  url.searchParams.set("limit", limit);

  if (sourceBatchId) {
    url.searchParams.set("sourceBatchId", sourceBatchId);
  }

  return url;
}

function errorPayload(
  payload: JsonRecord,
  fallback: string
): { error: string } {
  return {
    error: normalizeText(payload.error, 1000) || fallback,
  };
}

export async function GET(request: NextRequest) {
  const fundName = normalizeText(
    request.nextUrl.searchParams.get("fundName"),
    240
  );
  const limit =
    normalizeText(request.nextUrl.searchParams.get("limit"), 10) || "500";
  const accessToken = getBearerToken(request);

  if (!fundName) {
    return NextResponse.json(
      { error: "Fund name is required." },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    // First use the existing certified documents endpoint as the
    // fund/module authorization gate. It remains unchanged.
    const documentsResponse = await fetch(
      internalUrl(
        request,
        "/api/data-room/documents",
        fundName,
        "",
        limit
      ),
      {
        method: "GET",
        headers: forwardedHeaders(request),
        cache: "no-store",
      }
    );

    const documentsResult =
      await readJson<DocumentOverviewResponse>(documentsResponse);

    if (!documentsResponse.ok) {
      return NextResponse.json(
        errorPayload(
          documentsResult as JsonRecord,
          "Unable to load data room documents."
        ),
        { status: documentsResponse.status }
      );
    }

    const sourceBatch = documentsResult.sourceBatch ?? null;
    const sourceBatchId = normalizeText(sourceBatch?.id, 80);
    const documents = documentsResult.documents ?? [];

    // These are the two reads being moved out of the browser. They use
    // the caller's bearer token + anon key so existing RLS semantics are
    // preserved rather than replaced with service-role reads.
    const supabase = getUserRlsClient(accessToken);

    const activationPromise = supabase
      .from("fund_activation_status")
      .select("status, readiness_score")
      .eq("fund_name", fundName)
      .maybeSingle();

    const investorsPromise = sourceBatchId
      ? supabase
          .from("investor_master")
          .select(INVESTOR_PROJECTION)
          .eq("fund_name", fundName)
          .eq("source_batch_id", sourceBatchId)
          .order("investor_code", { ascending: true })
      : Promise.resolve({ data: [], error: null });

    const workflowPromise = sourceBatchId
      ? fetch(
          internalUrl(
            request,
            "/api/data-room/workflow",
            fundName,
            sourceBatchId,
            limit
          ),
          {
            method: "GET",
            headers: forwardedHeaders(request),
            cache: "no-store",
          }
        )
      : Promise.resolve(null);

    const [activationResult, investorsResult, workflowResponse] =
      await Promise.all([
        activationPromise,
        investorsPromise,
        workflowPromise,
      ]);

    let workflowResult: WorkflowOverviewResponse = {
      sourceBatch,
      engagementEvents: [],
      questions: [],
    };

    if (workflowResponse) {
      workflowResult =
        await readJson<WorkflowOverviewResponse>(workflowResponse);

      if (!workflowResponse.ok) {
        return NextResponse.json(
          errorPayload(
            workflowResult as JsonRecord,
            "Unable to load LP engagement and DDQ records."
          ),
          { status: workflowResponse.status }
        );
      }
    }

    const activation = activationResult.error
      ? {
          status: "Unavailable",
          readinessScore: 0,
        }
      : {
          status:
            normalizeText(
              (activationResult.data as JsonRecord | null)?.status,
              80
            ) || "Setup Not Started",
          readinessScore: Number(
            (activationResult.data as JsonRecord | null)?.readiness_score || 0
          ),
        };

    return NextResponse.json({
      activation,
      sourceBatch,
      documents,
      investors: investorsResult.error
        ? []
        : ((investorsResult.data ?? []) as JsonRecord[]),
      engagementEvents: workflowResult.engagementEvents ?? [],
      questions: workflowResult.questions ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the Investor Data Room overview.",
      },
      { status: 500 }
    );
  }
}
