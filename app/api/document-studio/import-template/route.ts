import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BlockKind =
  | "letterhead"
  | "identity"
  | "summary"
  | "transactions"
  | "financial"
  | "performance"
  | "chart"
  | "notes"
  | "signature";

type RepeatSource =
  | "transactions"
  | "pnl"
  | "cashflows"
  | "capitalAccount"
  | "taxBreakup"
  | "distributionDetails"
  | "unitMovements"
  | "portfolioPerformance"
  | "genericTable";

type TemplateBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  content?: string;
  repeatSource?: RepeatSource;
};

type AnalysisResult = {
  detectedDocumentType: string;
  importConfidence: number;
  detectedFields: string[];
  detectedSections: string[];
  suggestedBlocks: TemplateBlock[];
  unmappedItems: string[];
};

const importBucketName = "document-studio-imports";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function cleanFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toSnakeCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value || "");
}

async function extractPdfText(buffer: Buffer) {
  const pdfParseModule = (await import("pdf-parse")) as unknown as {
    PDFParse: new (options: { data: Buffer }) => {
      getText: () => Promise<{ text?: string; total?: number; numpages?: number }>;
      destroy?: () => Promise<void> | void;
    };
  };

  const parser = new pdfParseModule.PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    return {
      text: normalizeText(result.text || ""),
      pages: Number(result.total || result.numpages || 0),
    };
  } finally {
    await parser.destroy?.();
  }
}

function extractExplicitMergeFields(text: string) {
  const fields: string[] = [];
  const patterns = [
    /\{([^}]+)\}/g,
    /<<([^>]+)>>/g,
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const rawField = match[1];
      if (rawField) fields.push(toSnakeCase(rawField));
    }
  });

  return uniqueValues(fields);
}

function detectKeywordFields(text: string) {
  const lowerText = text.toLowerCase();
  const fields: string[] = [];

  const rules: { field: string; keywords: string[] }[] = [
    {
      field: "investor_name",
      keywords: ["investor name", "name of investor", "dear investor", "dear"],
    },
    {
      field: "investor_code",
      keywords: ["investor code", "folio", "folio no", "folio number", "client code"],
    },
    {
      field: "investor_type",
      keywords: ["investor type", "category of investor", "resident individual", "hni"],
    },
    {
      field: "fund_name",
      keywords: ["fund name", "alternative investment fund", "aif", "scheme"],
    },
    {
      field: "statement_period",
      keywords: ["statement period", "period", "quarter", "financial year", "fy"],
    },
    {
      field: "report_date",
      keywords: ["report date", "as on", "as of", "date of report"],
    },
    {
      field: "commitment_amount",
      keywords: ["commitment amount", "capital commitment", "committed capital"],
    },
    {
      field: "capital_called",
      keywords: ["capital called", "drawdown amount", "called amount", "capital call"],
    },
    {
      field: "uncalled_capital",
      keywords: ["uncalled capital", "unfunded commitment", "remaining commitment"],
    },
    {
      field: "current_nav",
      keywords: ["current nav", "net asset value", "nav"],
    },
    {
      field: "distribution_amount",
      keywords: ["distribution amount", "gross distribution", "net distribution"],
    },
    {
      field: "tds",
      keywords: ["tds", "tax withheld", "withholding tax"],
    },
    {
      field: "gross_income",
      keywords: ["gross income", "income head", "nature of income"],
    },
    {
      field: "net_income",
      keywords: ["net income", "net amount"],
    },
    {
      field: "dpi",
      keywords: ["dpi"],
    },
    {
      field: "tvpi",
      keywords: ["tvpi"],
    },
    {
      field: "irr",
      keywords: ["irr", "xirr"],
    },
  ];

  rules.forEach((rule) => {
    if (rule.keywords.some((keyword) => lowerText.includes(keyword))) {
      fields.push(rule.field);
    }
  });

  return uniqueValues(fields);
}

function detectSections(text: string) {
  const lowerText = text.toLowerCase();

  const rules: { label: string; keywords: string[] }[] = [
    {
      label: "Letterhead",
      keywords: ["registered aif", "gift city", "investment manager", "trustee", "fund"],
    },
    {
      label: "Investor Identity",
      keywords: ["investor name", "folio", "investor code", "pan", "email"],
    },
    {
      label: "Capital Account",
      keywords: ["capital account", "commitment", "capital contribution", "closing capital"],
    },
    {
      label: "Transaction Table",
      keywords: ["transaction", "cashflow", "capital call", "drawdown", "units"],
    },
    {
      label: "Distribution Details",
      keywords: ["distribution", "gross distribution", "tax withheld", "net distribution"],
    },
    {
      label: "Tax Breakup",
      keywords: ["form 64c", "form 64d", "income head", "tds", "tax"],
    },
    {
      label: "Unit Movement",
      keywords: ["unit allotment", "units allotted", "opening units", "closing units"],
    },
    {
      label: "Performance Metrics",
      keywords: ["irr", "dpi", "tvpi", "moic", "performance"],
    },
    {
      label: "Notes",
      keywords: ["note", "disclaimer", "important", "tax advisor"],
    },
    {
      label: "Signature",
      keywords: ["authorized signatory", "for and on behalf", "signed", "manager"],
    },
  ];

  return rules
    .filter((rule) => rule.keywords.some((keyword) => lowerText.includes(keyword)))
    .map((rule) => rule.label);
}

function detectDocumentType(text: string, fileName: string) {
  const combined = `${fileName} ${text}`.toLowerCase();

  if (combined.includes("form 64c") || combined.includes("64c")) {
    return "Form 64C";
  }

  if (combined.includes("form 64d") || combined.includes("64d")) {
    return "Form 64D";
  }

  if (
    combined.includes("drawdown reminder") ||
    combined.includes("payment reminder") ||
    combined.includes("reminder for the pending drawdown")
  ) {
    return "Drawdown Reminder";
  }

  if (
    combined.includes("capital call") ||
    combined.includes("drawdown notice") ||
    combined.includes("drawdown communication")
  ) {
    return "Capital Call Notice";
  }

  if (
    combined.includes("distribution notice") ||
    combined.includes("gross distribution") ||
    combined.includes("net distribution")
  ) {
    return "Distribution Notice";
  }

  if (
    combined.includes("unit allotment") ||
    combined.includes("units allotted") ||
    combined.includes("allotment letter")
  ) {
    return "Unit Allotment Letter";
  }

  if (
    combined.includes("unit statement") ||
    combined.includes("opening units") ||
    combined.includes("closing units")
  ) {
    return "Unit Statement";
  }

  if (
    combined.includes("advance tax") ||
    combined.includes("tax data points") ||
    combined.includes("tax estimation")
  ) {
    return "Advance Tax Data Points";
  }

  if (
    combined.includes("annual income") ||
    combined.includes("annual report") ||
    combined.includes("year-end")
  ) {
    return "Annual Income Report";
  }

  if (
    combined.includes("statement of account") ||
    combined.includes("soa") ||
    combined.includes("investor statement")
  ) {
    return "Statement of Account (SOA)";
  }

  return "Statement of Account (SOA)";
}

function block(
  index: number,
  kind: BlockKind,
  title: string,
  subtitle: string,
  content?: string,
  repeatSource?: RepeatSource
): TemplateBlock {
  return {
    id: `import-${kind}-${Date.now()}-${index}`,
    kind,
    title,
    subtitle,
    content,
    repeatSource,
  };
}

function buildSuggestedBlocks(documentType: string, text: string) {
  const blocks: TemplateBlock[] = [];
  const lowerText = text.toLowerCase();

  blocks.push(
    block(
      blocks.length,
      "letterhead",
      "Letterhead",
      "Detected fund heading, address and report context",
      "Registered AIF | GIFT City"
    )
  );

  if (documentType !== "Form 64D") {
    blocks.push(
      block(
        blocks.length,
        "identity",
        "Investor identity block",
        "Investor name, code, type, period and report date"
      )
    );
  }

  if (documentType === "Capital Call Notice") {
    blocks.push(
      block(
        blocks.length,
        "notes",
        "Capital call notice text",
        "Purpose, amount due and due date wording",
        "Dear {investor_name}, this is to notify you of a capital call for {fund_name}. Please remit the called amount as per the fund records on or before the due date mentioned in this notice."
      )
    );

    blocks.push(
      block(
        blocks.length,
        "summary",
        "Capital call summary",
        "Commitment, called capital and uncalled capital",
        undefined,
        "capitalAccount"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "transactions",
        "Drawdown schedule",
        "Capital call and payment movement",
        undefined,
        "transactions"
      )
    );
  } else if (documentType === "Distribution Notice") {
    blocks.push(
      block(
        blocks.length,
        "notes",
        "Distribution notice text",
        "Distribution communication wording",
        "Dear {investor_name}, we are pleased to inform you that a distribution has been approved for {fund_name}. The distribution details are provided below."
      )
    );

    blocks.push(
      block(
        blocks.length,
        "financial",
        "Distribution breakup",
        "Gross distribution, tax withheld and net distribution",
        undefined,
        "distributionDetails"
      )
    );
  } else if (documentType === "Unit Allotment Letter") {
    blocks.push(
      block(
        blocks.length,
        "notes",
        "Unit allotment confirmation",
        "Allotment confirmation wording",
        "This is to confirm that units have been allotted to {investor_name} in {fund_name} based on the capital contribution received."
      )
    );

    blocks.push(
      block(
        blocks.length,
        "financial",
        "Unit allotment schedule",
        "Units added, opening units and closing units",
        undefined,
        "unitMovements"
      )
    );
  } else if (documentType === "Unit Statement") {
    blocks.push(
      block(
        blocks.length,
        "summary",
        "Unit holding summary",
        "Investor holding and NAV summary",
        undefined,
        "capitalAccount"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "financial",
        "Unit movement schedule",
        "Opening units, units added, redeemed and closing units",
        undefined,
        "unitMovements"
      )
    );
  } else if (documentType === "Form 64C") {
    blocks.push(
      block(
        blocks.length,
        "financial",
        "Form 64C income breakup",
        "Nature of income, gross income, TDS and net income",
        undefined,
        "taxBreakup"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "notes",
        "Form 64C note",
        "Tax reporting note",
        "This statement provides income and tax information as per the records of {fund_name}. Investors should refer to the final signed Form 64C for statutory purposes."
      )
    );
  } else if (documentType === "Form 64D") {
    blocks.push(
      block(
        blocks.length,
        "financial",
        "Form 64D income breakup",
        "Income head, gross income, TDS and net income",
        undefined,
        "taxBreakup"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "notes",
        "Form 64D note",
        "Fund-level reporting note",
        "This document captures fund-level income and tax data points for reporting and review purposes."
      )
    );
  } else if (documentType === "Advance Tax Data Points") {
    blocks.push(
      block(
        blocks.length,
        "financial",
        "Advance tax data points",
        "Income head, gross income, TDS and net income",
        undefined,
        "taxBreakup"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "notes",
        "Tax note",
        "Investor tax note",
        "The above data points are provided for tax estimation purposes based on fund records as on {report_date}. Investors should consult their tax advisors before relying on this information."
      )
    );
  } else if (documentType === "Annual Income Report") {
    blocks.push(
      block(
        blocks.length,
        "summary",
        "Annual capital account summary",
        "Opening capital, contribution, income allocation, distribution and closing capital",
        undefined,
        "capitalAccount"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "financial",
        "Annual income statement",
        "Annual income, expenses, tax and payout",
        undefined,
        "pnl"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "transactions",
        "Annual transaction statement",
        "Full year capital calls, distributions and unit movements",
        undefined,
        "transactions"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "performance",
        "Investor performance",
        "DPI, TVPI, IRR and distribution metrics"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "chart",
        "Performance chart",
        "NAV, return and distribution movement"
      )
    );
  } else {
    blocks.push(
      block(
        blocks.length,
        "summary",
        "Capital account summary",
        "Commitment, capital called, uncalled capital and NAV",
        undefined,
        "capitalAccount"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "transactions",
        "Investor transaction statement",
        "Capital calls, distributions, units and NAV movements",
        undefined,
        "transactions"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "financial",
        "Statement of income and distribution",
        "Income, expenses, net income and payout",
        undefined,
        "pnl"
      )
    );

    blocks.push(
      block(
        blocks.length,
        "performance",
        "Investor performance",
        "DPI, TVPI, IRR and distribution metrics"
      )
    );
  }

  if (
    lowerText.includes("note") ||
    lowerText.includes("disclaimer") ||
    lowerText.includes("tax advisor") ||
    !blocks.some((item) => item.kind === "notes")
  ) {
    blocks.push(
      block(
        blocks.length,
        "notes",
        "Notes",
        "Detected note, disclaimer or management commentary",
        "This document is generated based on the books and records of the Fund as on {report_date}."
      )
    );
  }

  blocks.push(
    block(
      blocks.length,
      "signature",
      "Signature block",
      "Authorized signatory and generation date",
      "Authorized Signatory"
    )
  );

  return blocks;
}

function calculateConfidence(params: {
  text: string;
  detectedDocumentType: string;
  detectedFields: string[];
  detectedSections: string[];
  extension: string;
}) {
  let score = 35;

  if (params.text.length > 300) score += 15;
  if (params.text.length > 1200) score += 10;

  score += Math.min(params.detectedFields.length * 2, 16);
  score += Math.min(params.detectedSections.length * 3, 18);

  if (params.detectedDocumentType) score += 12;

  if (params.extension === "docx") score += 5;
  if (params.extension === "pdf" && params.text.length > 500) score += 4;

  if (params.text.length < 100) score -= 25;

  return Math.max(35, Math.min(96, score));
}

function analyzeTemplateText(text: string, fileName: string, extension: string): AnalysisResult {
  const detectedDocumentType = detectDocumentType(text, fileName);
  const explicitFields = extractExplicitMergeFields(text);
  const keywordFields = detectKeywordFields(text);
  const detectedFields = uniqueValues([...explicitFields, ...keywordFields]);
  const detectedSections = uniqueValues(detectSections(text));
  const suggestedBlocks = buildSuggestedBlocks(detectedDocumentType, text);

  const unmappedItems: string[] = [];

  if (text.length < 100) {
    unmappedItems.push(
      "Very limited text was extracted. If this is a scanned PDF, OCR will be required in a later version."
    );
  }

  if (explicitFields.length === 0) {
    unmappedItems.push(
      "No explicit merge fields like {investor_name} or <<investor_name>> were found. VENTIQ inferred fields using keywords."
    );
  }

  if (!detectedSections.includes("Signature")) {
    unmappedItems.push("Signature section was not clearly detected. Review the signature block after import.");
  }

  if (!detectedSections.includes("Investor Identity") && detectedDocumentType !== "Form 64D") {
    unmappedItems.push("Investor identity section was not clearly detected. Review investor fields after import.");
  }

  const importConfidence = calculateConfidence({
    text,
    detectedDocumentType,
    detectedFields,
    detectedSections,
    extension,
  });

  return {
    detectedDocumentType,
    importConfidence,
    detectedFields,
    detectedSections,
    suggestedBlocks,
    unmappedItems,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a Word or PDF template file." },
        { status: 400 }
      );
    }

    const extension = getFileExtension(file.name);
    const allowedExtensions = ["docx", "pdf"];

    if (!allowedExtensions.includes(extension)) {
      return NextResponse.json(
        { error: "Only .docx and .pdf template files are supported right now." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    let pdfPageCount = 0;

    if (extension === "docx") {
      extractedText = await extractDocxText(buffer);
    }

    if (extension === "pdf") {
      const pdfResult = await extractPdfText(buffer);
      extractedText = pdfResult.text;
      pdfPageCount = pdfResult.pages;
    }

    const analysis = analyzeTemplateText(extractedText, file.name, extension);

    const supabaseAdmin = getSupabaseAdmin();

    let storage:
      | {
          bucket?: string;
          path?: string;
          uploadStatus?: string;
          uploadError?: string;
        }
      | undefined;

    let importRecord:
      | {
          id?: string;
          file_name?: string;
          file_type?: string;
          import_confidence?: number;
          detected_document_type?: string;
        }
      | undefined;

    if (supabaseAdmin) {
      const storagePath = `imports/${Date.now()}-${cleanFileName(file.name)}`;

      const uploadResult = await supabaseAdmin.storage
        .from(importBucketName)
        .upload(storagePath, buffer, {
          contentType:
            file.type ||
            (extension === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          upsert: false,
        });

      if (uploadResult.error) {
        storage = {
          bucket: importBucketName,
          path: storagePath,
          uploadStatus: "Upload failed",
          uploadError: uploadResult.error.message,
        };

        analysis.unmappedItems.push(
          `Original file was analyzed but not stored in Supabase Storage: ${uploadResult.error.message}`
        );
      } else {
        storage = {
          bucket: importBucketName,
          path: storagePath,
          uploadStatus: "Uploaded",
        };
      }

      const insertResult = await supabaseAdmin
        .from("document_studio_imports")
        .insert({
          file_name: file.name,
          file_type: extension,
          file_size: file.size,
          storage_bucket: storage?.bucket || importBucketName,
          storage_path: storage?.path || storagePath,
          detected_document_type: analysis.detectedDocumentType,
          import_confidence: analysis.importConfidence,
          detected_fields: analysis.detectedFields,
          detected_sections: analysis.detectedSections,
          suggested_blocks: analysis.suggestedBlocks,
          unmapped_items: analysis.unmappedItems,
          import_status: "Imported",
        })
        .select(
          "id, file_name, file_type, import_confidence, detected_document_type"
        )
        .maybeSingle();

      if (insertResult.error) {
        analysis.unmappedItems.push(
          `Import intelligence generated, but import record was not saved: ${insertResult.error.message}`
        );
      } else if (insertResult.data) {
        importRecord = insertResult.data;
      }
    } else {
      analysis.unmappedItems.push(
        "Supabase service role key is not configured. Template was analyzed but not stored."
      );
    }

    return NextResponse.json({
      message:
        extension === "pdf"
          ? `PDF template analyzed. ${pdfPageCount || "Some"} page(s) read. Review imported blocks before saving.`
          : "Word template analyzed. Review imported blocks before saving.",
      detectedDocumentType: analysis.detectedDocumentType,
      importConfidence: analysis.importConfidence,
      detectedFields: analysis.detectedFields,
      detectedSections: analysis.detectedSections,
      suggestedBlocks: analysis.suggestedBlocks,
      unmappedItems: analysis.unmappedItems,
      storage,
      importRecord,
      extraction: {
        fileName: file.name,
        fileType: extension,
        extractedCharacters: extractedText.length,
        pdfPageCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import and analyze template.",
      },
      { status: 500 }
    );
  }
}