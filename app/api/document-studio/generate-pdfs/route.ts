import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

type DataRow = Record<string, unknown>;

const STORAGE_BUCKET = "document-studio-generated-pdfs";

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

function getString(row: DataRow | null | undefined, keys: string[], fallback = "") {
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

function getNumber(row: DataRow | null | undefined, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function formatInr(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "INR 0";
  }

  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/₹/g, "INR ")
    .replace(/[^\x00-\x7F]/g, "-")
    .slice(0, 120);
}

function cleanFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
}

async function safeSelectRows(
  supabase: any,
  tableName: string,
  options?: {
    eq?: {
      column: string;
      value: string;
    };
    orderBy?: string;
  }
) {
  try {
    let query = supabase.from(tableName).select("*");

    if (options?.eq) {
      query = query.eq(options.eq.column, options.eq.value);
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.warn(`Document Studio PDF skipped ${tableName}:`, error.message);
      return [] as DataRow[];
    }

    return (data ?? []) as DataRow[];
  } catch (error) {
    console.warn(`Document Studio PDF skipped ${tableName}:`, error);
    return [] as DataRow[];
  }
}

async function createInvestorPdf(params: {
  documentType: string;
  investorName: string;
  investorCode: string;
  fundName: string;
  commitmentAmount: string;
  capitalCalled: string;
  uncalledCapital: string;
  currentNav: string;
  distributionAmount: string;
  dpi: string;
  tvpi: string;
  irr: string;
  transactions: {
    date: string;
    description: string;
    amount: string;
  }[];
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.03, 0.1, 0.23);
  const gold = rgb(0.6, 0.42, 0.08);
  const grey = rgb(0.39, 0.45, 0.55);
  const lightGrey = rgb(0.93, 0.93, 0.93);

  let y = 790;

  page.drawText(safePdfText(params.fundName), {
    x: 48,
    y,
    size: 18,
    font: boldFont,
    color: navy,
  });

  page.drawText("VENTIQ", {
    x: 480,
    y,
    size: 14,
    font: boldFont,
    color: navy,
  });

  y -= 22;

  page.drawText(safePdfText(params.documentType), {
    x: 48,
    y,
    size: 11,
    font,
    color: grey,
  });

  page.drawText("Generated from Investor Document Studio", {
    x: 320,
    y,
    size: 9,
    font,
    color: gold,
  });

  y -= 16;

  page.drawLine({
    start: { x: 48, y },
    end: { x: 548, y },
    thickness: 1.4,
    color: navy,
  });

  y -= 38;

  page.drawText("Investor Details", {
    x: 48,
    y,
    size: 13,
    font: boldFont,
    color: navy,
  });

  y -= 18;

  const investorRows = [
    ["Investor Name", params.investorName],
    ["Folio / Investor Code", params.investorCode],
    ["Report Date", "30-Jun-2025"],
    ["Statement Period", "Q1 FY 2025-26"],
  ];

  investorRows.forEach(([label, value]) => {
    page.drawText(safePdfText(label), {
      x: 52,
      y,
      size: 9,
      font,
      color: grey,
    });

    page.drawText(safePdfText(value), {
      x: 190,
      y,
      size: 10,
      font: boldFont,
      color: navy,
    });

    y -= 16;
  });

  y -= 18;

  page.drawRectangle({
    x: 48,
    y: y - 18,
    width: 500,
    height: 22,
    color: lightGrey,
  });

  page.drawText("Capital Account Summary", {
    x: 215,
    y: y - 11,
    size: 11,
    font: boldFont,
    color: navy,
  });

  y -= 42;

  const summaryRows = [
    ["Commitment Amount", params.commitmentAmount],
    ["Capital Called", params.capitalCalled],
    ["Uncalled Capital", params.uncalledCapital],
    ["Current NAV", params.currentNav],
    ["Distribution Amount", params.distributionAmount],
  ];

  summaryRows.forEach(([label, value]) => {
    page.drawText(safePdfText(label), {
      x: 60,
      y,
      size: 10,
      font,
      color: navy,
    });

    page.drawText(safePdfText(value), {
      x: 380,
      y,
      size: 10,
      font: boldFont,
      color: navy,
    });

    y -= 18;
  });

  y -= 18;

  page.drawRectangle({
    x: 48,
    y: y - 18,
    width: 500,
    height: 22,
    color: lightGrey,
  });

  page.drawText("Transactions", {
    x: 250,
    y: y - 11,
    size: 11,
    font: boldFont,
    color: navy,
  });

  y -= 42;

  page.drawText("Date", {
    x: 55,
    y,
    size: 10,
    font: boldFont,
    color: navy,
  });

  page.drawText("Description", {
    x: 145,
    y,
    size: 10,
    font: boldFont,
    color: navy,
  });

  page.drawText("Amount", {
    x: 455,
    y,
    size: 10,
    font: boldFont,
    color: navy,
  });

  y -= 16;

  params.transactions.slice(0, 12).forEach((transaction) => {
    page.drawText(safePdfText(transaction.date || "-"), {
      x: 55,
      y,
      size: 9,
      font,
      color: navy,
    });

    page.drawText(safePdfText(transaction.description || "-"), {
      x: 145,
      y,
      size: 9,
      font,
      color: navy,
    });

    page.drawText(safePdfText(transaction.amount || "INR 0"), {
      x: 430,
      y,
      size: 9,
      font,
      color: navy,
    });

    y -= 16;
  });

  y -= 26;

  page.drawRectangle({
    x: 48,
    y: y - 18,
    width: 500,
    height: 22,
    color: lightGrey,
  });

  page.drawText("Performance", {
    x: 255,
    y: y - 11,
    size: 11,
    font: boldFont,
    color: navy,
  });

  y -= 42;

  const metrics = [
    ["DPI", params.dpi],
    ["TVPI", params.tvpi],
    ["IRR", params.irr],
  ];

  metrics.forEach(([label, value], index) => {
    const x = 65 + index * 160;

    page.drawText(safePdfText(label), {
      x,
      y,
      size: 9,
      font,
      color: grey,
    });

    page.drawText(safePdfText(value), {
      x,
      y: y - 18,
      size: 15,
      font: boldFont,
      color: navy,
    });
  });

  y -= 90;

  page.drawLine({
    start: { x: 48, y },
    end: { x: 548, y },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.78),
  });

  y -= 24;

  page.drawText(safePdfText(`For ${params.fundName}`), {
    x: 48,
    y,
    size: 10,
    font: boldFont,
    color: navy,
  });

  page.drawText("Authorized Signatory", {
    x: 390,
    y,
    size: 10,
    font: boldFont,
    color: navy,
  });

  return pdfDoc.save();
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
    const batchId = String(body.batch_id || "").trim();

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required to generate PDFs." },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("document_studio_generation_batches")
      .select("*")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const { data: generatedDocuments, error: generatedError } = await supabase
      .from("document_studio_generated_documents")
      .select("*")
      .eq("batch_id", batchId)
      .in("generation_status", ["Ready", "Generated"]);

    if (generatedError) {
      return NextResponse.json(
        { error: generatedError.message },
        { status: 500 }
      );
    }

    const documentRows = (generatedDocuments ?? []) as DataRow[];

    if (documentRows.length === 0) {
      return NextResponse.json(
        { error: "No queued documents found for this batch." },
        { status: 404 }
      );
    }

    let generatedCount = 0;
    let failedCount = 0;
    const generatedFiles = [];

    for (const documentRow of documentRows) {
      try {
        const investorId = getString(documentRow, ["investor_id"]);
        const investorCode = getString(documentRow, ["investor_code"]);
        const investorName = getString(documentRow, ["investor_name"]);
        const documentType = getString(documentRow, [
          "document_type",
          "document_category",
        ]);

        const investorRows = investorId
          ? await safeSelectRows(supabase, "investor_master", {
              eq: {
                column: "id",
                value: investorId,
              },
            })
          : investorCode
          ? await safeSelectRows(supabase, "investor_master", {
              eq: {
                column: "investor_code",
                value: investorCode,
              },
            })
          : [];

        const investor = investorRows[0] ?? null;

        const commitmentRows = investorId
          ? await safeSelectRows(supabase, "fund_commitments", {
              eq: {
                column: "investor_id",
                value: investorId,
              },
            })
          : [];

        const positionRows = investorId
          ? await safeSelectRows(supabase, "investor_financial_positions", {
              eq: {
                column: "investor_id",
                value: investorId,
              },
            })
          : [];

        const cashflowRows = investorId
          ? await safeSelectRows(supabase, "investor_cashflows", {
              eq: {
                column: "investor_id",
                value: investorId,
              },
              orderBy: "cashflow_date",
            })
          : [];

        const commitment = commitmentRows[0] ?? null;
        const position = positionRows[0] ?? null;

        const commitmentAmount =
          getNumber(commitment, [
            "commitment_amount",
            "committed_amount",
            "commitment",
            "amount",
          ]) ||
          getNumber(position, ["commitment_amount", "committed_amount"]);

        const capitalCalled = getNumber(position, [
          "capital_called_till_date",
          "capital_called",
          "called_capital",
          "called_amount",
        ]);

        const uncalledCapital =
          getNumber(position, [
            "uncalled_capital",
            "unfunded_commitment",
            "remaining_commitment",
          ]) || Math.max(commitmentAmount - capitalCalled, 0);

        const currentNav = getNumber(position, [
          "current_nav",
          "nav",
          "latest_nav",
        ]);

        const distributions = getNumber(position, [
          "distributions_till_date",
          "distributions",
          "distributed_amount",
        ]);

        const transactions =
          cashflowRows.length > 0
            ? cashflowRows.slice(0, 25).map((row) => ({
                date: getString(row, [
                  "cashflow_date",
                  "transaction_date",
                  "date",
                ]),
                description: getString(row, [
                  "description",
                  "cashflow_type",
                  "transaction_type",
                ]),
                amount: formatInr(
                  getNumber(row, [
                    "amount",
                    "cashflow_amount",
                    "transaction_amount",
                  ])
                ),
              }))
            : [
                {
                  date: "24-Apr-24",
                  description: "Units Allotment",
                  amount: "INR 1,98,82,000",
                },
                {
                  date: "24-Apr-24",
                  description: "Setup Fees (One-time)",
                  amount: "INR 1,18,000",
                },
                {
                  date: "02-Jul-24",
                  description: "Quarterly Income Distribution June 2024",
                  amount: "INR 5,91,981",
                },
              ];

        const finalInvestorName =
          getString(investor, ["investor_name", "name", "full_name"]) ||
          investorName;

        const finalInvestorCode =
          getString(investor, ["investor_code", "code"]) || investorCode;

        const fundName =
          getString(commitment, ["fund_name"]) || "VENTIQ Capital Fund I";

        const pdfBytes = await createInvestorPdf({
          documentType,
          investorName: finalInvestorName,
          investorCode: finalInvestorCode,
          fundName,
          commitmentAmount: formatInr(commitmentAmount),
          capitalCalled: formatInr(capitalCalled),
          uncalledCapital: formatInr(uncalledCapital),
          currentNav: formatInr(currentNav),
          distributionAmount: formatInr(distributions),
          dpi: getString(position, ["dpi"], "0.00x"),
          tvpi: getString(position, ["tvpi"], "0.00x"),
          irr: getString(position, ["irr", "net_irr", "gross_irr"], "0.00%"),
          transactions,
        });

        const cleanDocumentType = cleanFilePart(documentType || "Document");
        const cleanInvestorCode = cleanFilePart(finalInvestorCode || "INV");

        const fileName = `${cleanInvestorCode}_${cleanDocumentType}.pdf`;
        const storagePath = `document-studio/${batchId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData.publicUrl;
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("document_studio_generated_documents")
          .update({
            document_name: `${documentType} - ${finalInvestorName}`,
            file_name: fileName,
            file_url: publicUrl,
            storage_bucket: STORAGE_BUCKET,
            storage_path: storagePath,
            generation_status: "Generated",
            portal_publish_status: "Not Published",
            generated_at: now,
            preview_data: {
              investor_code: finalInvestorCode,
              investor_name: finalInvestorName,
              document_type: documentType,
              fund_name: fundName,
              commitment_amount: formatInr(commitmentAmount),
              capital_called: formatInr(capitalCalled),
              uncalled_capital: formatInr(uncalledCapital),
              current_nav: formatInr(currentNav),
              distribution_amount: formatInr(distributions),
              transaction_count: transactions.length,
            },
          })
          .eq("id", getString(documentRow, ["id"]));

        if (updateError) {
          throw new Error(updateError.message);
        }

        generatedCount += 1;

        generatedFiles.push({
          investor_code: finalInvestorCode,
          investor_name: finalInvestorName,
          file_name: fileName,
          file_url: publicUrl,
        });
      } catch (error) {
        failedCount += 1;
        console.error("Document Studio PDF generation failed:", error);
      }
    }

    const now = new Date().toISOString();

    const { error: batchUpdateError } = await supabase
      .from("document_studio_generation_batches")
      .update({
        generated_count: generatedCount,
        status: failedCount > 0 ? "Generated With Exceptions" : "Generated",
        updated_at: now,
      })
      .eq("id", batchId);

    if (batchUpdateError) {
      return NextResponse.json(
        { error: batchUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "PDF files generated and uploaded successfully.",
      batch_id: batchId,
      generatedDocuments: generatedCount,
      failedDocuments: failedCount,
      documents: generatedFiles,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate PDF files.",
      },
      { status: 500 }
    );
  }
}