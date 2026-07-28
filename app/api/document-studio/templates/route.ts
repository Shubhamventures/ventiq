import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("document_studio_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      templates: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load document templates.",
      },
      { status: 500 }
    );
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

    const templateName = String(body.template_name || "").trim();
    const documentType = String(body.document_type || "").trim();

    if (!templateName) {
      return NextResponse.json(
        { error: "Template name is required." },
        { status: 400 }
      );
    }

    const payload = {
      template_name: templateName,
      document_type: documentType || "Statement of Account (SOA)",
      template_status: body.template_status || "Draft",
      source_type: body.source_type || "Created in VENTIQ",
      import_confidence: Number(body.import_confidence || 0),
      layout_json: body.layout_json || {},
      blocks_json: body.blocks_json || [],
      field_mappings: body.field_mappings || {},
      calculated_fields: body.calculated_fields || [],
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { data, error } = await supabase
        .from("document_studio_templates")
        .update(payload)
        .eq("id", body.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: "Template updated successfully.",
        template: data,
      });
    }

    const { data, error } = await supabase
      .from("document_studio_templates")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Template saved successfully.",
      template: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save document template.",
      },
      { status: 500 }
    );
  }
}