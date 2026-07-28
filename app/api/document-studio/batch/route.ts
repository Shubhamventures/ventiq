import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function getString(row: DataRow | undefined, keys: string[], fallback = "") {
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

    const templateId = String(body.template_id || "").trim();
    const documentType = String(
      body.document_type || "Statement of Account (SOA)"
    ).trim();

    const { data: investors, error: investorError } = await supabase
      .from("investor_master")
      .select("*")
      .order("investor_code", { ascending: true });

    if (investorError) {
      return NextResponse.json(
        { error: investorError.message },
        { status: 500 }
      );
    }

    const investorRows = ((investors ?? []) as DataRow[]).slice(0, 500);

    const { data: batch, error: batchError } = await supabase
      .from("document_studio_generation_batches")
      .insert({
        template_id: templateId || null,
        batch_name: `${documentType} Batch - ${new Date().toLocaleDateString(
          "en-IN"
        )}`,
        document_type: documentType,
        total_investors: investorRows.length,
        ready_count: investorRows.length,
        review_count: 0,
        generated_count: 0,
        published_count: 0,
        status: "Prepared",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    const generatedRows = investorRows.map((investor) => {
      const investorName = getString(investor, [
        "investor_name",
        "name",
        "full_name",
      ]);

      const investorCode = getString(investor, ["investor_code", "code"]);

      return {
        batch_id: batch.id,
        template_id: templateId || null,
        investor_id: getString(investor, ["id"]) || null,
        investor_code: investorCode,
        investor_name: investorName,
        email: getString(investor, ["email", "investor_email"]),
        document_type: documentType,
        document_name: `${documentType} - ${investorName}`,
        file_name: `${investorCode || "INV"}_${documentType.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}.pdf`,
        preview_data: {
          investor_code: investorCode,
          investor_name: investorName,
          document_type: documentType,
          status: "Ready for generation",
        },
        generation_status: "Ready",
        portal_publish_status: "Not Published",
      };
    });

    if (generatedRows.length > 0) {
      const { error: documentError } = await supabase
        .from("document_studio_generated_documents")
        .insert(generatedRows);

      if (documentError) {
        return NextResponse.json(
          { error: documentError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      message: "Batch generation queue prepared successfully.",
      batch,
      queuedDocuments: generatedRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare batch generation.",
      },
      { status: 500 }
    );
  }
}