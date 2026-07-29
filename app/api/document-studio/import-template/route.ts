import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const STORAGE_BUCKET = "document-studio-imports";

type SuggestedBlock = {
  id: string;
  kind:
    | "letterhead"
    | "identity"
    | "summary"
    | "transactions"
    | "financial"
    | "performance"
    | "chart"
    | "notes"
    | "signature";
  title: string;
  subtitle?: string;
  repeatSource?: string;
};

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

function cleanFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
}

function detectFields(text: string) {
  const matches = Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g));
  const fieldCodes = matches.map((match) => match[1]);
  return Array.from(new Set(fieldCodes));
}

function detectDocumentType(text: string, fileName: string) {
  const value = `${text} ${fileName}`.toLowerCase();

  if (value.includes("64c")) return "Form 64C";
  if (value.includes("64d")) return "Form 64D";
  if (value.includes("capital call") || value.includes("drawdown")) {
    return "Capital Call Notice";
  }
  if (value.includes("distribution")) return "Distribution Notice";
  if (value.includes("unit allotment")) return "Unit Allotment Letter";
  if (value.includes("unit statement")) return "Unit Statement";
  if (value.includes("advance tax")) return "Advance Tax Data Points";
  if (value.includes("annual income")) return "Annual Income Report";
  if (
    value.includes("statement of account") ||
    value.includes("account statement") ||
    value.includes("soa")
  ) {
    return "Statement of Account (SOA)";
  }

  return "Statement of Account (SOA)";
}

function detectSections(text: string) {
  const value = text.toLowerCase();
  const sections: string[] = [];

  if (
    value.includes("fund name") ||
    value.includes("registered aif") ||
    value.includes("letterhead")
  ) {
    sections.push("Letterhead");
  }

  if (
    value.includes("investor name") ||
    value.includes("folio") ||
    value.includes("investor code") ||
    value.includes("pan")
  ) {
    sections.push("Investor identity");
  }

  if (
    value.includes("commitment") ||
    value.includes("capital called") ||
    value.includes("uncalled capital") ||
    value.includes("current nav")
  ) {
    sections.push("Capital account summary");
  }

  if (
    value.includes("transaction") ||
    value.includes("cashflow") ||
    value.includes("cash flow") ||
    value.includes("date") && value.includes("amount")
  ) {
    sections.push("Transactions table");
  }

  if (
    value.includes("income") ||
    value.includes("expenses") ||
    value.includes("net income") ||
    value.includes("management fee")
  ) {
    sections.push("Financial statement");
  }

  if (
    value.includes("dpi") ||
    value.includes("tvpi") ||
    value.includes("irr") ||
    value.includes("moic")
  ) {
    sections.push("Performance metrics");
  }

  if (
    value.includes("authorised signatory") ||
    value.includes("authorized signatory") ||
    value.includes("signature")
  ) {
    sections.push("Signature block");
  }

  return Array.from(new Set(sections));
}

function buildSuggestedBlocks(sections: string[]): SuggestedBlock[] {
  const blocks: SuggestedBlock[] = [];

  if (sections.includes("Letterhead")) {
    blocks.push({
      id: "import-letterhead",
      kind: "letterhead",
      title: "Imported letterhead",
      subtitle: "Detected from uploaded Word/PDF",
    });
  }

  if (sections.includes("Investor identity")) {
    blocks.push({
      id: "import-identity",
      kind: "identity",
      title: "Imported investor identity",
      subtitle: "Auto-mapped investor name, folio and fund fields",
    });
  }

  if (sections.includes("Capital account summary")) {
    blocks.push({
      id: "import-summary",
      kind: "summary",
      title: "Imported capital summary",
      subtitle: "Auto-mapped commitment, capital called, NAV and uncalled capital",
    });
  }

  if (sections.includes("Transactions table")) {
    blocks.push({
      id: "import-transactions",
      kind: "transactions",
      title: "Imported transaction table",
      subtitle: "Suggested source: Transactions / investor_cashflows",
      repeatSource: "transactions",
    });
  }

  if (sections.includes("Financial statement")) {
    blocks.push({
      id: "import-financial",
      kind: "financial",
      title: "Imported financial statement",
      subtitle: "Suggested source: P&L line items",
      repeatSource: "pnl",
    });
  }

  if (sections.includes("Performance metrics")) {
    blocks.push({
      id: "import-performance",
      kind: "performance",
      title: "Imported performance metrics",
      subtitle: "DPI, TVPI, IRR and distribution metrics detected",
    });
  }

  if (sections.includes("Signature block")) {
    blocks.push({
      id: "import-signature",
      kind: "signature",
      title: "Imported signature block",
      subtitle: "Authorized signatory section detected",
    });
  }

  if (blocks.length === 0) {
    blocks.push(
      {
        id: "import-letterhead",
        kind: "letterhead",
        title: "Imported letterhead",
        subtitle: "Default block created from uploaded template",
      },
      {
        id: "import-identity",
        kind: "identity",
        title: "Imported investor identity",
        subtitle: "Review required",
      },
      {
        id: "import-summary",
        kind: "summary",
        title: "Imported summary block",
        subtitle: "Review required",
      },
      {
        id: "import-signature",
        kind: "signature",
        title: "Imported signature block",
        subtitle: "Review required",
      }
    );
  }

  return blocks;
}

function calculateConfidence(params: {
  fileExtension: string;
  detectedFields: string[];
  detectedSections: string[];
  suggestedBlocks: SuggestedBlock[];
}) {
  let score = 35;

  if (params.fileExtension === "docx") {
    score += 20;
  }

  if (params.fileExtension === "pdf") {
    score += 8;
  }

  score += Math.min(20, params.detectedFields.length * 2);
  score += Math.min(25, params.detectedSections.length * 4);
  score += Math.min(12, params.suggestedBlocks.length * 2);

  return Math.min(92, score);
}

function getUnmappedItems(detectedFields: string[]) {
  const knownFields = new Set([
    "investor_name",
    "investor_code",
    "investor_type",
    "fund_name",
    "fund_address",
    "statement_period",
    "report_date",
    "commitment_amount",
    "capital_called",
    "uncalled_capital",
    "current_nav",
    "distribution_amount",
    "dpi",
    "tvpi",
    "irr",
    "generated_on",
  ]);

  return detectedFields.filter((field) => !knownFields.has(field));
}

async function extractTextFromDocx(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Template file is required." },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["docx", "pdf"];

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "Only .docx and .pdf files are supported in this version." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storagePath = `imports/${Date.now()}_${cleanFilePart(fileName)}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    let extractedText = "";

    if (fileExtension === "docx") {
      extractedText = await extractTextFromDocx(buffer);
    }

    if (fileExtension === "pdf") {
      extractedText =
        "PDF template uploaded. Deep PDF layout extraction will be handled in the next version.";
    }

    const detectedFields = detectFields(extractedText);
    const detectedDocumentType = detectDocumentType(extractedText, fileName);
    const detectedSections = detectSections(extractedText);
    const suggestedBlocks = buildSuggestedBlocks(detectedSections);
    const unmappedItems = getUnmappedItems(detectedFields);

    const importConfidence = calculateConfidence({
      fileExtension,
      detectedFields,
      detectedSections,
      suggestedBlocks,
    });

    const { data: importRecord, error: insertError } = await supabase
      .from("document_studio_imports")
      .insert({
        file_name: fileName,
        file_type: fileExtension,
        file_size: file.size,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        detected_document_type: detectedDocumentType,
        import_confidence: importConfidence,
        detected_fields: detectedFields,
        detected_sections: detectedSections,
        suggested_blocks: suggestedBlocks,
        unmapped_items: unmappedItems,
        import_status: "Imported",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message:
        fileExtension === "docx"
          ? "Word template imported and converted into smart VENTIQ blocks."
          : "PDF template uploaded. Initial classification is complete.",
      importRecord,
      detectedDocumentType,
      importConfidence,
      detectedFields,
      detectedSections,
      suggestedBlocks,
      unmappedItems,
      storage: {
        bucket: STORAGE_BUCKET,
        path: storagePath,
      },
    });
  } catch (error) {
    console.error("Document Studio import failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import template.",
      },
      { status: 500 }
    );
  }
}