import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type TableColumnConfig = {
  id: string;
  header: string;
  fieldKey: string;
  width: number;
  format: "text" | "date" | "currency" | "number" | "percentage";
  align: "left" | "center" | "right";
};

type TableBlockConfig = {
  repeatSource:
    | "transactions"
    | "pnl"
    | "cashflows"
    | "capitalAccount"
    | "taxBreakup"
    | "distributionDetails"
    | "unitMovements"
    | "portfolioPerformance"
    | "genericTable";
  repeatRows: boolean;
  borderPreset: "all" | "outer" | "horizontal" | "none";
  headerStyle: "dark" | "light" | "gold" | "minimal";
  columns: TableColumnConfig[];
};

type ChartConfig = {
  chartType: "bar" | "line" | "waterfall" | "donut";
  series: "current_nav" | "distribution_amount" | "tvpi" | "irr";
  title: string;
};

type TemplateBlock = {
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
  subtitle: string;
  content?: string;
  repeatSource?: TableBlockConfig["repeatSource"];
  tableConfig?: TableBlockConfig;
  chartConfig?: ChartConfig;
};

type GeneratedDocument = {
  id: string;
  template_id?: string | null;
  investor_id?: string | null;
  investor_code?: string | null;
  investor_name?: string | null;
  email?: string | null;
  document_type?: string | null;
  document_name?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  generation_status?: string | null;
  portal_publish_status?: string | null;
  preview_data?: Record<string, unknown> | null;
};

type BatchRecord = {
  id: string;
  template_id?: string | null;
  document_type?: string | null;
  batch_name?: string | null;
};

const bucketName = "document-studio-generated-pdfs";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/₹/g, "INR ")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/×/g, "x")
    .replace(/↻/g, "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAmount(value: unknown) {
  const text = safePdfText(value);

  if (!text) {
    return "-";
  }

  return text.replace(/^INR\s*/, "INR ");
}

function renderTemplateText(template: string, data: Record<string, string>) {
  return safePdfText(
    template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const cleanKey = key.trim();
      return data[cleanKey] ?? `{${cleanKey}}`;
    })
  );
}

function getFieldValue(fieldKey: string, data: Record<string, string>) {
  const fallbackValues: Record<string, string> = {
    transaction_date: "24-Apr-24",
    transaction_description: "Units Allotment",
    transaction_type: "Capital Call",
    transaction_amount: "INR 1,98,82,000",
    units: "1,98,820",
    nav: "INR 100.00",

    particular: "Interest / Fee Income",
    reference: "A",
    amount: "INR 8,38,428",
    formula: "C = A + B",

    cashflow_date: "24-Apr-24",
    cashflow_type: "Capital Call",
    remarks: "Investor cashflow",

    opening_capital: "INR 1,50,00,000",
    capital_contribution: "INR 50,00,000",
    income_allocation: "INR 8,44,514",
    distribution: "INR 5,91,981",
    closing_capital: "INR 1,82,40,000",

    income_head: "Interest income",
    gross_income: "INR 8,44,514",
    tds: "INR 84,451",
    net_income: "INR 7,60,063",

    distribution_date: "02-Jul-24",
    gross_distribution: "INR 5,91,981",
    tax_withheld: "INR 59,198",
    net_distribution: "INR 5,32,783",

    unit_date: "24-Apr-24",
    opening_units: "0",
    units_added: "1,98,820",
    units_redeemed: "0",
    closing_units: "1,98,820",

    company_name: "Portfolio Co A",
    invested_amount: "INR 50,00,000",
    current_value: data.current_nav || "INR 1,82,40,000",
    moic: "1.64x",
    irr: data.irr || "18.7%",

    particulars: "Sample line item",
  };

  return data[fieldKey] ?? fallbackValues[fieldKey] ?? `{${fieldKey}}`;
}

function getDefaultTableConfig(
  repeatSource: TableBlockConfig["repeatSource"]
): TableBlockConfig {
  const fieldMap: Record<TableBlockConfig["repeatSource"], TableColumnConfig[]> = {
    transactions: [
      { id: "date", header: "Date", fieldKey: "transaction_date", width: 18, format: "date", align: "left" },
      { id: "desc", header: "Description", fieldKey: "transaction_description", width: 42, format: "text", align: "left" },
      { id: "type", header: "Type", fieldKey: "transaction_type", width: 20, format: "text", align: "left" },
      { id: "amount", header: "Amount", fieldKey: "transaction_amount", width: 20, format: "currency", align: "right" },
    ],
    pnl: [
      { id: "particular", header: "Particular", fieldKey: "particular", width: 42, format: "text", align: "left" },
      { id: "reference", header: "Reference", fieldKey: "reference", width: 18, format: "text", align: "left" },
      { id: "amount", header: "Amount", fieldKey: "amount", width: 22, format: "currency", align: "right" },
      { id: "formula", header: "Formula", fieldKey: "formula", width: 18, format: "text", align: "left" },
    ],
    cashflows: [
      { id: "date", header: "Cashflow Date", fieldKey: "cashflow_date", width: 25, format: "date", align: "left" },
      { id: "type", header: "Cashflow Type", fieldKey: "cashflow_type", width: 35, format: "text", align: "left" },
      { id: "amount", header: "Amount", fieldKey: "amount", width: 25, format: "currency", align: "right" },
      { id: "remarks", header: "Remarks", fieldKey: "remarks", width: 15, format: "text", align: "left" },
    ],
    capitalAccount: [
      { id: "opening", header: "Opening Capital", fieldKey: "opening_capital", width: 22, format: "currency", align: "right" },
      { id: "contribution", header: "Capital Contribution", fieldKey: "capital_contribution", width: 24, format: "currency", align: "right" },
      { id: "income", header: "Income Allocation", fieldKey: "income_allocation", width: 22, format: "currency", align: "right" },
      { id: "closing", header: "Closing Capital", fieldKey: "closing_capital", width: 22, format: "currency", align: "right" },
    ],
    taxBreakup: [
      { id: "head", header: "Income Head", fieldKey: "income_head", width: 34, format: "text", align: "left" },
      { id: "gross", header: "Gross Income", fieldKey: "gross_income", width: 22, format: "currency", align: "right" },
      { id: "tds", header: "TDS", fieldKey: "tds", width: 22, format: "currency", align: "right" },
      { id: "net", header: "Net Income", fieldKey: "net_income", width: 22, format: "currency", align: "right" },
    ],
    distributionDetails: [
      { id: "date", header: "Distribution Date", fieldKey: "distribution_date", width: 25, format: "date", align: "left" },
      { id: "gross", header: "Gross Distribution", fieldKey: "gross_distribution", width: 25, format: "currency", align: "right" },
      { id: "tax", header: "Tax Withheld", fieldKey: "tax_withheld", width: 25, format: "currency", align: "right" },
      { id: "net", header: "Net Distribution", fieldKey: "net_distribution", width: 25, format: "currency", align: "right" },
    ],
    unitMovements: [
      { id: "date", header: "Date", fieldKey: "unit_date", width: 22, format: "date", align: "left" },
      { id: "opening", header: "Opening Units", fieldKey: "opening_units", width: 26, format: "number", align: "right" },
      { id: "added", header: "Units Added", fieldKey: "units_added", width: 26, format: "number", align: "right" },
      { id: "closing", header: "Closing Units", fieldKey: "closing_units", width: 26, format: "number", align: "right" },
    ],
    portfolioPerformance: [
      { id: "company", header: "Company", fieldKey: "company_name", width: 34, format: "text", align: "left" },
      { id: "invested", header: "Invested Amount", fieldKey: "invested_amount", width: 24, format: "currency", align: "right" },
      { id: "value", header: "Current Value", fieldKey: "current_value", width: 24, format: "currency", align: "right" },
      { id: "moic", header: "MOIC", fieldKey: "moic", width: 18, format: "number", align: "right" },
    ],
    genericTable: [
      { id: "particulars", header: "Particulars", fieldKey: "particulars", width: 70, format: "text", align: "left" },
      { id: "amount", header: "Amount", fieldKey: "amount", width: 30, format: "currency", align: "right" },
    ],
  };

  return {
    repeatSource,
    repeatRows: true,
    borderPreset: "all",
    headerStyle: "gold",
    columns: fieldMap[repeatSource],
  };
}

function getDefaultBlocks(documentType: string): TemplateBlock[] {
  const common: TemplateBlock[] = [
    {
      id: "letterhead",
      kind: "letterhead",
      title: "Letterhead",
      subtitle: "Fund logo and statement details",
      content: "Registered AIF | GIFT City",
    },
    {
      id: "identity",
      kind: "identity",
      title: "Investor identity block",
      subtitle: "Investor name, folio and report details",
    },
  ];

  const signature: TemplateBlock = {
    id: "signature",
    kind: "signature",
    title: "Signature block",
    subtitle: "Authorized signatory and generation date",
    content: "Authorized Signatory",
  };

  if (documentType === "Capital Call Notice") {
    return [
      ...common,
      {
        id: "capital-call-note",
        kind: "notes",
        title: "Capital call notice text",
        subtitle: "Purpose, amount due and due date wording",
        content:
          "Dear {investor_name}, this is to notify you of a capital call for {fund_name}. Please remit the called amount as per the fund records on or before the due date mentioned in this notice.",
      },
      {
        id: "capital-call-summary",
        kind: "summary",
        title: "Capital call summary",
        subtitle: "Commitment, called capital and uncalled capital",
        repeatSource: "capitalAccount",
        tableConfig: getDefaultTableConfig("capitalAccount"),
      },
      signature,
    ];
  }

  if (documentType === "Distribution Notice") {
    return [
      ...common,
      {
        id: "distribution-note",
        kind: "notes",
        title: "Distribution notice text",
        subtitle: "Distribution communication wording",
        content:
          "Dear {investor_name}, we are pleased to inform you that a distribution has been approved for {fund_name}. The distribution details are provided below.",
      },
      {
        id: "distribution-breakup",
        kind: "financial",
        title: "Distribution breakup",
        subtitle: "Gross distribution, tax withheld and net distribution",
        repeatSource: "distributionDetails",
        tableConfig: getDefaultTableConfig("distributionDetails"),
      },
      signature,
    ];
  }

  if (documentType === "Form 64C" || documentType === "Form 64D") {
    return [
      ...common,
      {
        id: "tax-breakup",
        kind: "financial",
        title: `${documentType} income breakup`,
        subtitle: "Income head, gross income, TDS and net income",
        repeatSource: "taxBreakup",
        tableConfig: getDefaultTableConfig("taxBreakup"),
      },
      {
        id: "tax-note",
        kind: "notes",
        title: `${documentType} note`,
        subtitle: "Tax reporting note",
        content:
          "This document captures income and tax information as per the records of {fund_name}. Investors should consult their tax advisors.",
      },
      signature,
    ];
  }

  return [
    ...common,
    {
      id: "summary",
      kind: "summary",
      title: "Capital account summary",
      subtitle: "Commitment, called capital, uncalled capital and NAV",
      repeatSource: "capitalAccount",
      tableConfig: getDefaultTableConfig("capitalAccount"),
    },
    {
      id: "transactions",
      kind: "transactions",
      title: "Investor transaction statement",
      subtitle: "Capital calls, distributions, units and NAV movements",
      repeatSource: "transactions",
      tableConfig: getDefaultTableConfig("transactions"),
    },
    {
      id: "financial",
      kind: "financial",
      title: "Statement of income and distribution",
      subtitle: "Income, expenses, net income and payout",
      repeatSource: "pnl",
      tableConfig: getDefaultTableConfig("pnl"),
    },
    {
      id: "performance",
      kind: "performance",
      title: "Metrics table",
      subtitle: "DPI, TVPI, IRR and distribution metrics",
    },
    {
      id: "notes",
      kind: "notes",
      title: "Notes",
      subtitle: "Narrative note and disclaimer",
      content:
        "This statement is generated based on the books and records of the Fund as on {report_date}.",
    },
    signature,
  ];
}

function normalizeBlocks(value: unknown, documentType: string): TemplateBlock[] {
  if (!Array.isArray(value)) {
    return getDefaultBlocks(documentType);
  }

  const blocks = value
    .map((item) => item as Partial<TemplateBlock>)
    .filter((item) => item.kind)
    .map((item, index): TemplateBlock => {
      const repeatSource =
        item.tableConfig?.repeatSource ||
        item.repeatSource ||
        (item.kind === "summary"
          ? "capitalAccount"
          : item.kind === "financial"
          ? "pnl"
          : item.kind === "transactions"
          ? "transactions"
          : undefined);

      return {
        id: item.id || `block-${index}`,
        kind: item.kind as TemplateBlock["kind"],
        title: item.title || "Document block",
        subtitle: item.subtitle || "",
        content: item.content,
        repeatSource,
        tableConfig: repeatSource
          ? {
              ...getDefaultTableConfig(repeatSource),
              ...item.tableConfig,
              repeatSource,
              columns:
                item.tableConfig?.columns && item.tableConfig.columns.length > 0
                  ? item.tableConfig.columns
                  : getDefaultTableConfig(repeatSource).columns,
            }
          : undefined,
        chartConfig: item.chartConfig,
      };
    });

  return blocks.length > 0 ? blocks : getDefaultBlocks(documentType);
}

function makeData(document: GeneratedDocument, documentType: string) {
  const previewData =
    document.preview_data && typeof document.preview_data === "object"
      ? (document.preview_data as Record<string, unknown>)
      : {};

  const mergedFields =
    previewData.mergedFields && typeof previewData.mergedFields === "object"
      ? (previewData.mergedFields as Record<string, unknown>)
      : {};

  const investorName =
    safePdfText(mergedFields.investor_name || document.investor_name || "Investor");
  const investorCode =
    safePdfText(mergedFields.investor_code || document.investor_code || "INV-0000");

  return {
    investor_name: investorName,
    investor_code: investorCode,
    investor_type: safePdfText(mergedFields.investor_type || "Investor"),
    fund_name: safePdfText(mergedFields.fund_name || "VENTIQ Capital Fund I"),
    fund_address: safePdfText(mergedFields.fund_address || "GIFT City, Gandhinagar"),
    statement_period: safePdfText(mergedFields.statement_period || "Q1 FY 2025-26"),
    report_date: safePdfText(mergedFields.report_date || "30-Jun-2025"),
    commitment_amount: formatAmount(mergedFields.commitment_amount || "INR 2,50,00,000"),
    capital_called: formatAmount(mergedFields.capital_called || "INR 1,50,00,000"),
    uncalled_capital: formatAmount(mergedFields.uncalled_capital || "INR 1,00,00,000"),
    current_nav: formatAmount(mergedFields.current_nav || "INR 1,82,40,000"),
    distribution_amount: formatAmount(mergedFields.distribution_amount || "INR 42,00,000"),
    dpi: safePdfText(mergedFields.dpi || "0.28x"),
    tvpi: safePdfText(mergedFields.tvpi || "1.49x"),
    irr: safePdfText(mergedFields.irr || "18.7%"),
    generated_on: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    document_type: safePdfText(documentType),
  };
}

function drawWrappedText(args: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
}) {
  const {
    page,
    text,
    x,
    y,
    maxWidth,
    size,
    font,
    color = rgb(0.07, 0.1, 0.16),
    lineHeight = size + 4,
  } = args;

  const words = safePdfText(text).split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const candidateWidth = font.widthOfTextAtSize(candidate, size);

    if (candidateWidth <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  let nextY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: nextY,
      size,
      font,
      color,
    });
    nextY -= lineHeight;
  }

  return nextY;
}

async function createPdfForDocument(args: {
  document: GeneratedDocument;
  blocks: TemplateBlock[];
  documentType: string;
}) {
  const { document, blocks, documentType } = args;

  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 42;
  const usableWidth = pageSize[0] - margin * 2;

  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const data = makeData(document, documentType);

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight > margin) {
      return;
    }

    page = pdfDoc.addPage(pageSize);
    y = pageSize[1] - margin;
  }

  function sectionTitle(title: string, subtitle?: string) {
    ensureSpace(52);

    page.drawText(safePdfText(title), {
      x: margin,
      y,
      size: 13,
      font: boldFont,
      color: rgb(0.07, 0.1, 0.16),
    });

    y -= 15;

    if (subtitle) {
      y = drawWrappedText({
        page,
        text: subtitle,
        x: margin,
        y,
        maxWidth: usableWidth,
        size: 8.5,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55),
        lineHeight: 11,
      });
    }

    y -= 8;
  }

  function drawKeyValueGrid(items: { label: string; value: string }[]) {
    const rowHeight = 26;
    const labelWidth = 120;
    const valueWidth = usableWidth - labelWidth;

    ensureSpace(items.length * rowHeight + 10);

    items.forEach((item, index) => {
      const rowY = y - index * rowHeight;

      page.drawRectangle({
        x: margin,
        y: rowY - 16,
        width: usableWidth,
        height: rowHeight,
        borderWidth: 0.5,
        borderColor: rgb(0.84, 0.82, 0.77),
        color: index % 2 === 0 ? rgb(0.99, 0.97, 0.93) : rgb(1, 1, 1),
      });

      page.drawText(safePdfText(item.label), {
        x: margin + 8,
        y: rowY - 6,
        size: 8,
        font: boldFont,
        color: rgb(0.39, 0.45, 0.55),
      });

      page.drawText(safePdfText(item.value), {
        x: margin + labelWidth,
        y: rowY - 6,
        size: 8.5,
        font: regularFont,
        color: rgb(0.07, 0.1, 0.16),
        maxWidth: valueWidth - 10,
      });
    });

    y -= items.length * rowHeight + 18;
  }

  function drawTable(block: TemplateBlock) {
    const repeatSource =
      block.tableConfig?.repeatSource ||
      block.repeatSource ||
      (block.kind === "summary"
        ? "capitalAccount"
        : block.kind === "financial"
        ? "pnl"
        : "transactions");

    const tableConfig =
      block.tableConfig && block.tableConfig.columns?.length
        ? block.tableConfig
        : getDefaultTableConfig(repeatSource);

    const columns = tableConfig.columns;
    const rowCount = tableConfig.repeatRows ? 3 : 1;
    const headerHeight = 24;
    const rowHeight = 24;
    const tableHeight = headerHeight * 2 + rowHeight * rowCount + 22;

    sectionTitle(block.title, block.subtitle);
    ensureSpace(tableHeight);

    const headerColor =
      tableConfig.headerStyle === "dark"
        ? rgb(0.03, 0.1, 0.23)
        : tableConfig.headerStyle === "light" || tableConfig.headerStyle === "minimal"
        ? rgb(0.97, 0.94, 0.88)
        : rgb(0.71, 0.51, 0.08);

    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: usableWidth,
      height: headerHeight,
      color: headerColor,
    });

    page.drawText(safePdfText(block.title || "Table"), {
      x: margin + 8,
      y: y - 15,
      size: 9,
      font: boldFont,
      color:
        tableConfig.headerStyle === "light" || tableConfig.headerStyle === "minimal"
          ? rgb(0.07, 0.1, 0.16)
          : rgb(1, 1, 1),
    });

    y -= headerHeight;

    let columnX = margin;

    columns.forEach((column) => {
      const columnWidth = usableWidth * (column.width / 100);

      page.drawRectangle({
        x: columnX,
        y: y - headerHeight,
        width: columnWidth,
        height: headerHeight,
        borderWidth: tableConfig.borderPreset === "none" ? 0 : 0.5,
        borderColor: rgb(0.84, 0.82, 0.77),
        color: rgb(0.99, 0.97, 0.93),
      });

      page.drawText(safePdfText(column.header), {
        x: columnX + 5,
        y: y - 15,
        size: 7.5,
        font: boldFont,
        color: rgb(0.07, 0.1, 0.16),
        maxWidth: Math.max(20, columnWidth - 10),
      });

      columnX += columnWidth;
    });

    y -= headerHeight;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      let cellX = margin;

      columns.forEach((column) => {
        const columnWidth = usableWidth * (column.width / 100);

        page.drawRectangle({
          x: cellX,
          y: y - rowHeight,
          width: columnWidth,
          height: rowHeight,
          borderWidth: tableConfig.borderPreset === "none" ? 0 : 0.4,
          borderColor: rgb(0.87, 0.85, 0.8),
          color: rowIndex % 2 === 0 ? rgb(1, 1, 1) : rgb(0.99, 0.97, 0.94),
        });

        const value = getFieldValue(column.fieldKey, data);
        const textWidth = regularFont.widthOfTextAtSize(safePdfText(value), 7.5);
        const textX =
          column.align === "right"
            ? cellX + columnWidth - textWidth - 5
            : column.align === "center"
            ? cellX + columnWidth / 2 - textWidth / 2
            : cellX + 5;

        page.drawText(safePdfText(value), {
          x: Math.max(cellX + 5, textX),
          y: y - 15,
          size: 7.5,
          font: regularFont,
          color: rgb(0.07, 0.1, 0.16),
          maxWidth: Math.max(20, columnWidth - 10),
        });

        cellX += columnWidth;
      });

      y -= rowHeight;
    }

    page.drawText(
      safePdfText(
        `${tableConfig.repeatRows ? "Repeats from" : "Static table from"} ${tableConfig.repeatSource} - ${columns.length} mapped columns`
      ),
      {
        x: margin,
        y: y - 12,
        size: 7,
        font: regularFont,
        color: rgb(0.57, 0.43, 0.07),
      }
    );

    y -= 32;
  }

  blocks.forEach((block) => {
    if (block.kind === "letterhead") {
      ensureSpace(62);

      page.drawText(data.fund_name, {
        x: margin,
        y,
        size: 17,
        font: boldFont,
        color: rgb(0.03, 0.1, 0.23),
      });

      page.drawText(safePdfText(block.content || data.fund_address), {
        x: margin,
        y: y - 16,
        size: 9,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55),
      });

      page.drawText("VENTIQ", {
        x: pageSize[0] - margin - 62,
        y,
        size: 12,
        font: boldFont,
        color: rgb(0.03, 0.1, 0.23),
      });

      page.drawLine({
        start: { x: margin, y: y - 30 },
        end: { x: pageSize[0] - margin, y: y - 30 },
        thickness: 1.2,
        color: rgb(0.71, 0.51, 0.08),
      });

      y -= 52;
      return;
    }

    if (block.kind === "identity") {
      sectionTitle(data.document_type);
      drawKeyValueGrid([
        { label: "Investor Name", value: data.investor_name },
        { label: "Investor Code", value: data.investor_code },
        { label: "Investor Type", value: data.investor_type },
        { label: "Statement Period", value: data.statement_period },
        { label: "Report Date", value: data.report_date },
      ]);
      return;
    }

    if (
      block.kind === "summary" ||
      block.kind === "transactions" ||
      block.kind === "financial"
    ) {
      drawTable(block);
      return;
    }

    if (block.kind === "performance") {
      sectionTitle(block.title || "Performance Metrics", block.subtitle);
      drawKeyValueGrid([
        { label: "DPI", value: data.dpi },
        { label: "TVPI", value: data.tvpi },
        { label: "IRR", value: data.irr },
        { label: "Distribution", value: data.distribution_amount },
      ]);
      return;
    }

    if (block.kind === "chart") {
      sectionTitle(block.chartConfig?.title || block.title || "Performance Chart", block.subtitle);
      ensureSpace(120);

      const barValues = [42, 78, 56, 92];
      const barWidth = 42;
      const gap = 24;
      const chartBaseY = y - 95;
      const startX = margin + 80;

      barValues.forEach((height, index) => {
        page.drawRectangle({
          x: startX + index * (barWidth + gap),
          y: chartBaseY,
          width: barWidth,
          height,
          color: index === 1 ? rgb(0.71, 0.51, 0.08) : rgb(0.12, 0.37, 0.66),
        });
      });

      page.drawText(
        safePdfText(`Series: ${block.chartConfig?.series || "current_nav"}`),
        {
          x: margin,
          y: chartBaseY - 18,
          size: 8,
          font: regularFont,
          color: rgb(0.39, 0.45, 0.55),
        }
      );

      y -= 140;
      return;
    }

    if (block.kind === "notes") {
      sectionTitle(block.title || "Notes", block.subtitle);
      ensureSpace(72);

      y = drawWrappedText({
        page,
        text: renderTemplateText(
          block.content ||
            "This statement is generated based on the books and records of the Fund as on {report_date}.",
          data
        ),
        x: margin,
        y,
        maxWidth: usableWidth,
        size: 9,
        font: regularFont,
        color: rgb(0.25, 0.29, 0.36),
        lineHeight: 13,
      });

      y -= 18;
      return;
    }

    if (block.kind === "signature") {
      ensureSpace(80);

      page.drawLine({
        start: { x: margin, y },
        end: { x: pageSize[0] - margin, y },
        thickness: 0.5,
        color: rgb(0.84, 0.82, 0.77),
      });

      y -= 28;

      page.drawText(safePdfText(`For ${data.fund_name}`), {
        x: margin,
        y,
        size: 10,
        font: boldFont,
        color: rgb(0.07, 0.1, 0.16),
      });

      page.drawText(safePdfText(block.content || "Authorized Signatory"), {
        x: margin,
        y: y - 16,
        size: 9,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55),
      });

      page.drawText(safePdfText(`Generated on ${data.generated_on}`), {
        x: pageSize[0] - margin - 140,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55),
      });

      y -= 58;
    }
  });

  return pdfDoc.save();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      batch_id?: string;
      document_ids?: unknown;
    };

    const batch_id = body.batch_id;

    const documentIds = Array.isArray(body.document_ids)
      ? body.document_ids.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (!batch_id) {
      return NextResponse.json(
        { error: "batch_id is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: batch, error: batchError } = await supabase
      .from("document_studio_generation_batches")
      .select("*")
      .eq("id", batch_id)
      .single<BatchRecord>();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Batch not found.");
    }

    const documentType = batch.document_type || "Statement of Account (SOA)";

    let templateBlocks: TemplateBlock[] = getDefaultBlocks(documentType);

    if (batch.template_id) {
      const { data: template, error: templateError } = await supabase
        .from("document_studio_templates")
        .select("blocks_json")
        .eq("id", batch.template_id)
        .maybeSingle();

      if (templateError) {
        throw new Error(templateError.message);
      }

      templateBlocks = normalizeBlocks(template?.blocks_json, documentType);
    }

    let documentsQuery = supabase
      .from("document_studio_generated_documents")
      .select("*")
      .eq("batch_id", batch_id)
      .in("generation_status", ["Ready", "Generated", "Failed"]);

    if (documentIds.length > 0) {
      documentsQuery = documentsQuery.in("id", documentIds);
    }

    const { data: documents, error: documentsError } =
      await documentsQuery.returns<GeneratedDocument[]>();

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        {
          error:
            documentIds.length > 0
              ? "No matching selected documents found for this batch."
              : "No ready documents found for this batch.",
        },
        { status: 404 }
      );
    }

    const generatedDocuments: {
      id: string;
      investor_code?: string | null;
      investor_name?: string | null;
      email?: string | null;
      document_type?: string | null;
      document_name?: string | null;
      file_name: string;
      file_url: string;
      generation_status: string;
      portal_publish_status?: string | null;
    }[] = [];

    let failedDocuments = 0;

    for (const document of documents) {
      try {
        const investorCode = safePdfText(document.investor_code || "INV");
        const investorName = safePdfText(document.investor_name || "Investor");
        const cleanDocumentType = safePdfText(documentType).replace(/\s+/g, "_");

        const fileName =
          document.file_name ||
          `${investorCode}_${cleanDocumentType}_${Date.now()}.pdf`;

        const pdfBytes = await createPdfForDocument({
          document,
          blocks: templateBlocks,
          documentType,
        });

        const storagePath = `${batch_id}/${document.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, Buffer.from(pdfBytes), {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const publicUrlResult = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        const fileUrl = publicUrlResult.data.publicUrl;

        const { error: updateError } = await supabase
          .from("document_studio_generated_documents")
          .update({
            file_name: fileName,
            file_url: fileUrl,
            storage_bucket: bucketName,
            storage_path: storagePath,
            generation_status: "Generated",
            generated_at: new Date().toISOString(),
          })
          .eq("id", document.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        generatedDocuments.push({
          id: document.id,
          investor_code: document.investor_code,
          investor_name: investorName,
          email: document.email,
          document_type: document.document_type || documentType,
          document_name: document.document_name,
          file_name: fileName,
          file_url: fileUrl,
          generation_status: "Generated",
          portal_publish_status: document.portal_publish_status,
        });
      } catch (error) {
        failedDocuments += 1;

        console.error("Document PDF generation failed:", error);

        const { error: failedUpdateError } = await supabase
          .from("document_studio_generated_documents")
          .update({
            generation_status: "Failed",
          })
          .eq("id", document.id);

        if (failedUpdateError) {
          console.error("Unable to mark document as Failed:", failedUpdateError);
        }
      }
    }

    const { count: totalDocumentsCount } = await supabase
      .from("document_studio_generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id);

    const { count: totalGeneratedCount } = await supabase
      .from("document_studio_generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id)
      .eq("generation_status", "Generated");

    const nextBatchStatus =
      failedDocuments > 0
        ? "Partially Generated"
        : totalDocumentsCount &&
          totalGeneratedCount &&
          totalGeneratedCount >= totalDocumentsCount
        ? "Generated"
        : "Partially Generated";

    await supabase
      .from("document_studio_generation_batches")
      .update({
        generated_count: totalGeneratedCount ?? generatedDocuments.length,
        status: nextBatchStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    const { data: currentDocuments, error: currentDocumentsError } =
      await supabase
        .from("document_studio_generated_documents")
        .select(
          "id, investor_code, investor_name, email, document_type, document_name, file_name, file_url, generation_status, portal_publish_status"
        )
        .eq("batch_id", batch_id)
        .order("investor_name", { ascending: true });

    if (currentDocumentsError) {
      throw new Error(currentDocumentsError.message);
    }

    return NextResponse.json({
      message:
        failedDocuments > 0
          ? `${generatedDocuments.length} PDFs generated. ${failedDocuments} failed.`
          : documentIds.length > 0
          ? `${generatedDocuments.length} selected PDF(s) generated successfully.`
          : `${generatedDocuments.length} PDFs generated successfully.`,
      batch_id,
      requestedDocuments: documentIds.length || documents.length,
      generatedDocuments: generatedDocuments.length,
      failedDocuments,
      documents: currentDocuments ?? generatedDocuments,
    });
  } catch (error) {
    console.error("generate-pdfs error:", error);

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