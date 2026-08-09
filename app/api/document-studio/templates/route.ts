import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  requireDocumentStudioFundAccess,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fund_name"),
      240
    );
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      fundName,
      "view"
    );

    const { data, error } = await supabaseAdmin
      .from("document_studio_templates")
      .select("*")
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

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
    const body = await request.json();
    const baseActor = await authenticateDocumentStudioUser(request);
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      body.fund_name,
      "edit"
    );

    const templateName = normalizeText(body.template_name, 240);
    const documentType = normalizeText(body.document_type, 160);

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
      const { data, error } = await supabaseAdmin
        .from("document_studio_templates")
        .update(payload)
        .eq("id", body.id)
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .select("*")
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json(
          { error: "Template not found for the selected fund." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Template updated successfully.",
        template: data,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("document_studio_templates")
      .insert({
        ...payload,
        organisation_id: actor.organisationId,
        fund_name: actor.fundName,
        created_by: actor.userId,
      })
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
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

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