import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadStatus = "New" | "Contacted" | "Qualified" | "Not fit" | "Closed";

const allowedStatuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Not fit",
  "Closed",
];

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

function isFounderAuthorized(request: NextRequest) {
  const expectedKey = process.env.VENTIQ_FOUNDER_KEY;
  const providedKey = request.headers.get("x-founder-key");

  return Boolean(expectedKey && providedKey && providedKey === expectedKey);
}

export async function GET(request: NextRequest) {
  if (!isFounderAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized founder access." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Founder lead inbox is not configured. Check Supabase service role key.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("walkthrough_requests")
    .select(
      "id, name, email, phone, company, role, firm_type, primary_interest, message, source, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  if (!isFounderAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized founder access." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Founder lead inbox is not configured. Check Supabase service role key.",
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const id = String(body.id || "");
  const status = String(body.status || "") as LeadStatus;

  if (!id) {
    return NextResponse.json({ error: "Lead id is required." }, { status: 400 });
  }

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid lead status." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("walkthrough_requests")
    .update({ status })
    .eq("id", id)
    .select(
      "id, name, email, phone, company, role, firm_type, primary_interest, message, source, status, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}