"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type WorkspaceTab = "start" | "library" | "builder" | "preview" | "batch" | "publish";
type RibbonTab = "home" | "insert" | "layout" | "view" | "table" | "chart";
type MergeMode = "cell" | "column" | "calculated" | "import";
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

type BlockStyle = {
  fontFamily: "inter" | "serif" | "mono";
  fontSize: "small" | "normal" | "large";
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  underline: boolean;
  numberFormat: "plain" | "currency" | "number" | "percentage" | "date";
};

type ChartConfig = {
  chartType: "bar" | "line" | "waterfall" | "donut";
  series: "current_nav" | "distribution_amount" | "tvpi" | "irr";
  title: string;
};

type TemplateBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  content?: string;
  repeatSource?: TableBlockConfig["repeatSource"];
  tableConfig?: TableBlockConfig;
  style?: BlockStyle;
  chartConfig?: ChartConfig;
};

type InvestorProfile = {
  id: string;
  name: string;
  code: string;
  type: string;
  fundName: string;
  commitment: string;
  capitalCalled: string;
  uncalledCapital: string;
  nav: string;
  dpi: string;
  tvpi: string;
  irr: string;
  distribution: string;
};

type MergeField = {
  code: string;
  label: string;
  category: string;
  type: string;
  sample: string;
};

type ColumnSource = {
  id: TableBlockConfig["repeatSource"];
  label: string;
  description: string;
  fields: MergeField[];
};

type SavedTemplate = {
  id: string;
  template_name: string;
  document_type: string | null;
  template_status: string | null;
  source_type: string | null;
  import_confidence: number | null;
  version_number?: number | null;
  layout_json?: unknown;
  blocks_json?: unknown;
  field_mappings?: unknown;
  calculated_fields?: unknown;
  created_at?: string | null;
  updated_at: string | null;
};

type PreviewMergeResponse = {
  message?: string;
  investor?: {
    id?: string;
    investor_code?: string;
    investor_name?: string;
  };
  mergedFields?: Record<string, string | number>;
  tables?: {
    transactions?: {
      date?: string;
      description?: string;
      amount?: string;
      type?: string;
    }[];
  };
  sourceCounts?: Record<string, number>;
};

type BatchDocumentRow = {
  id?: string;
  investor_code?: string | null;
  investor_name?: string | null;
  email?: string | null;
  document_type?: string | null;
  document_name?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  generation_status?: string | null;
  portal_publish_status?: string | null;
};

type BatchGenerationResponse = {
  message?: string;
  batch?: {
    id: string;
    batch_name: string | null;
    document_type: string | null;
    total_investors: number | null;
    ready_count: number | null;
    review_count: number | null;
    generated_count: number | null;
    published_count: number | null;
    status: string | null;
  };
  queuedDocuments?: number;
  documents?: BatchDocumentRow[];
};

type PublishResponse = {
  message?: string;
  batch_id?: string;
  publishedDocuments?: number;
};


type PdfGenerationResponse = {
  message?: string;
  batch_id?: string;
  generatedDocuments?: number;
  failedDocuments?: number;
  documents?: BatchDocumentRow[];
};
type ImportTemplateResponse = {
  message?: string;
  detectedDocumentType?: string;
  importConfidence?: number;
  detectedFields?: string[];
  detectedSections?: string[];
  suggestedBlocks?: TemplateBlock[];
  unmappedItems?: string[];
  storage?: {
    bucket?: string;
    path?: string;
  };
  importRecord?: {
    id?: string;
    file_name?: string;
    file_type?: string;
    import_confidence?: number;
    detected_document_type?: string;
  };
};

type PageSettings = {
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  showGrid: boolean;
  showRulers: boolean;
  showSampleValues: boolean;
  zoom: number;
};
type DocumentPresetBlock = {
  kind: BlockKind;
  title?: string;
  subtitle?: string;
  content?: string;
  repeatSource?: TableBlockConfig["repeatSource"];
  chartConfig?: ChartConfig;
};

type DocumentPreset = {
  id: string;
  name: string;
  documentType: string;
  templateName: string;
  description: string;
  bestFor: string;
  blocks: DocumentPresetBlock[];
};

const investors: InvestorProfile[] = [
  {
    id: "aarav",
    name: "Aarav Menon",
    code: "AUR-10001",
    type: "Individual",
    fundName: "VENTIQ Capital Fund I",
    commitment: "₹2,50,00,000",
    capitalCalled: "₹1,50,00,000",
    uncalledCapital: "₹1,00,00,000",
    nav: "₹1,82,40,000",
    dpi: "0.28x",
    tvpi: "1.49x",
    irr: "18.7%",
    distribution: "₹42,00,000",
  },
  {
    id: "diya",
    name: "Diya Kumar",
    code: "AUR-10002",
    type: "Individual",
    fundName: "VENTIQ Capital Fund I",
    commitment: "₹1,75,00,000",
    capitalCalled: "₹1,05,00,000",
    uncalledCapital: "₹70,00,000",
    nav: "₹1,24,70,000",
    dpi: "0.22x",
    tvpi: "1.41x",
    irr: "16.9%",
    distribution: "₹23,10,000",
  },
  {
    id: "rohan",
    name: "Rohan Soni",
    code: "AUR-10003",
    type: "HNI",
    fundName: "VENTIQ Capital Fund I",
    commitment: "₹5,00,00,000",
    capitalCalled: "₹3,25,00,000",
    uncalledCapital: "₹1,75,00,000",
    nav: "₹3,88,00,000",
    dpi: "0.34x",
    tvpi: "1.53x",
    irr: "20.1%",
    distribution: "₹1,10,50,000",
  },
];

const tableFieldOptions: Record<TableBlockConfig["repeatSource"], { label: string; value: string; format: TableColumnConfig["format"] }[]> = {
  transactions: [
    { label: "Date", value: "transaction_date", format: "date" },
    { label: "Description", value: "transaction_description", format: "text" },
    { label: "Type", value: "transaction_type", format: "text" },
    { label: "Amount", value: "transaction_amount", format: "currency" },
    { label: "Units", value: "units", format: "number" },
    { label: "NAV", value: "nav", format: "currency" },
  ],
  pnl: [
    { label: "Particular", value: "particular", format: "text" },
    { label: "Reference", value: "reference", format: "text" },
    { label: "Amount", value: "amount", format: "currency" },
    { label: "Formula", value: "formula", format: "text" },
  ],
  cashflows: [
    { label: "Cashflow Date", value: "cashflow_date", format: "date" },
    { label: "Cashflow Type", value: "cashflow_type", format: "text" },
    { label: "Amount", value: "amount", format: "currency" },
    { label: "Remarks", value: "remarks", format: "text" },
  ],
  capitalAccount: [
    { label: "Opening Capital", value: "opening_capital", format: "currency" },
    { label: "Capital Contribution", value: "capital_contribution", format: "currency" },
    { label: "Income Allocation", value: "income_allocation", format: "currency" },
    { label: "Distribution", value: "distribution", format: "currency" },
    { label: "Closing Capital", value: "closing_capital", format: "currency" },
  ],
  taxBreakup: [
    { label: "Income Head", value: "income_head", format: "text" },
    { label: "Gross Income", value: "gross_income", format: "currency" },
    { label: "TDS", value: "tds", format: "currency" },
    { label: "Net Income", value: "net_income", format: "currency" },
  ],
  distributionDetails: [
    { label: "Distribution Date", value: "distribution_date", format: "date" },
    { label: "Gross Distribution", value: "gross_distribution", format: "currency" },
    { label: "Tax Withheld", value: "tax_withheld", format: "currency" },
    { label: "Net Distribution", value: "net_distribution", format: "currency" },
  ],
  unitMovements: [
    { label: "Date", value: "unit_date", format: "date" },
    { label: "Opening Units", value: "opening_units", format: "number" },
    { label: "Units Added", value: "units_added", format: "number" },
    { label: "Units Redeemed", value: "units_redeemed", format: "number" },
    { label: "Closing Units", value: "closing_units", format: "number" },
  ],
  portfolioPerformance: [
    { label: "Company", value: "company_name", format: "text" },
    { label: "Invested Amount", value: "invested_amount", format: "currency" },
    { label: "Current Value", value: "current_value", format: "currency" },
    { label: "MOIC", value: "moic", format: "number" },
    { label: "IRR", value: "irr", format: "percentage" },
  ],
  genericTable: [
    { label: "Particulars", value: "particulars", format: "text" },
    { label: "Amount", value: "amount", format: "currency" },
  ],
};

const baseStyle: BlockStyle = {
  fontFamily: "inter",
  fontSize: "normal",
  align: "left",
  bold: false,
  italic: false,
  underline: false,
  numberFormat: "plain",
};

const basePageSettings: PageSettings = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 20,
  marginBottom: 15,
  showGrid: true,
  showRulers: true,
  showSampleValues: true,
  zoom: 100,
};

function createTableConfig(
  repeatSource: TableBlockConfig["repeatSource"] = "transactions"
): TableBlockConfig {
  const fields = tableFieldOptions[repeatSource];

  return {
    repeatSource,
    repeatRows: true,
    borderPreset: "all",
    headerStyle: "gold",
    columns: fields.slice(0, 4).map((field, index) => ({
      id: `${repeatSource}-column-${index + 1}`,
      header: field.label,
      fieldKey: field.value,
      width: index === 1 ? 42 : 19,
      format: field.format,
      align:
        field.format === "currency" ||
        field.format === "number" ||
        field.format === "percentage"
          ? "right"
          : "left",
    })),
  };
}

function createBlock(kind: BlockKind): TemplateBlock {
  const timestamp = Date.now();
  const id = `${kind}-${timestamp}`;

  const titles: Record<BlockKind, string> = {
    letterhead: "Letterhead",
    identity: "Investor identity block",
    summary: "Capital account summary",
    transactions: "Transaction table",
    financial: "Financial statement",
    performance: "Metrics table",
    chart: "Performance chart",
    notes: "Notes",
    signature: "Signature block",
  };

  const subtitles: Record<BlockKind, string> = {
    letterhead: "Fund logo, address and statement period",
    identity: "Investor name, folio, PAN and address",
    summary: "Commitment, called capital, NAV and uncalled capital",
    transactions: "Capital calls, distributions, unit movements and investor activity",
    financial: "Income, expenses, net income and payout",
    performance: "DPI, TVPI, IRR and distribution metrics",
    chart: "Portfolio movement, returns and distribution visualisation",
    notes: "Narrative note, disclaimer or management commentary",
    signature: "Authorized signatory and generation date",
  };

  const repeatSource =
    kind === "summary"
      ? "capitalAccount"
      : kind === "transactions"
      ? "transactions"
      : kind === "financial"
      ? "pnl"
      : undefined;

  return {
    id,
    kind,
    title: titles[kind],
    subtitle: subtitles[kind],
    content:
      kind === "notes"
        ? "This statement is generated based on the books and records of the Fund as on {report_date}."
        : kind === "signature"
        ? "Authorized Signatory"
        : kind === "letterhead"
        ? "Registered AIF | GIFT City"
        : undefined,
    repeatSource,
    tableConfig: repeatSource ? createTableConfig(repeatSource) : undefined,
    style: { ...baseStyle },
    chartConfig:
      kind === "chart"
        ? {
            chartType: "bar",
            series: "current_nav",
            title: "Portfolio Movement Chart",
          }
        : undefined,
  };
}

const starterBlocks: TemplateBlock[] = [
  createBlock("letterhead"),
  createBlock("identity"),
  createBlock("summary"),
  createBlock("transactions"),
  createBlock("financial"),
  createBlock("performance"),
  createBlock("notes"),
  createBlock("signature"),
];

const cellFields: MergeField[] = [
  { code: "investor_name", label: "Investor name", category: "Investor Info", type: "TEXT", sample: "Aarav Menon" },
  { code: "investor_code", label: "Investor / folio code", category: "Investor Info", type: "TEXT", sample: "AUR-10001" },
  { code: "investor_type", label: "Investor type", category: "Investor Info", type: "TEXT", sample: "Individual" },
  { code: "fund_name", label: "Fund name", category: "Fund", type: "TEXT", sample: "VENTIQ Capital Fund I" },
  { code: "fund_address", label: "Fund registered address", category: "Fund", type: "TEXT", sample: "GIFT City, Gandhinagar" },
  { code: "statement_period", label: "Statement period", category: "Fund", type: "TEXT", sample: "Q1 FY 2025-26" },
  { code: "report_date", label: "Reporting / as-of date", category: "Fund", type: "DATE", sample: "30-Jun-2025" },
  { code: "commitment_amount", label: "Commitment amount", category: "Capital Account", type: "MONEY", sample: "₹2,50,00,000" },
  { code: "capital_called", label: "Capital called", category: "Capital Account", type: "MONEY", sample: "₹1,50,00,000" },
  { code: "uncalled_capital", label: "Uncalled capital", category: "Capital Account", type: "MONEY", sample: "₹1,00,00,000" },
  { code: "current_nav", label: "Current NAV", category: "Capital Account", type: "MONEY", sample: "₹1,82,40,000" },
  { code: "distribution_amount", label: "Distribution amount", category: "P&L", type: "MONEY", sample: "₹42,00,000" },
  { code: "dpi", label: "DPI", category: "Performance", type: "NUMBER", sample: "0.28x" },
  { code: "tvpi", label: "TVPI", category: "Performance", type: "NUMBER", sample: "1.49x" },
  { code: "irr", label: "Investor IRR", category: "Performance", type: "PERCENT", sample: "18.7%" },
  { code: "generated_on", label: "Statement generated on", category: "Calculated", type: "DATE", sample: "28-Jul-2026" },
];

const columnSources: ColumnSource[] = [
  {
    id: "transactions",
    label: "Transactions",
    description: "Investor cashflows and account movement lines",
    fields: [
      { code: "transaction_date", label: "Date", category: "Transactions", type: "DATE", sample: "24-Apr-24" },
      { code: "transaction_description", label: "Description", category: "Transactions", type: "TEXT", sample: "Units Allotment" },
      { code: "transaction_type", label: "Type", category: "Transactions", type: "TEXT", sample: "Capital Call" },
      { code: "transaction_amount", label: "Amount", category: "Transactions", type: "MONEY", sample: "₹1,98,82,000" },
      { code: "units", label: "Units", category: "Transactions", type: "NUMBER", sample: "1,98,820" },
      { code: "nav", label: "NAV", category: "Transactions", type: "MONEY", sample: "₹100.00" },
    ],
  },
  {
    id: "pnl",
    label: "P&L line items",
    description: "Income, expenses, taxes and payout schedule",
    fields: [
      { code: "particular", label: "Particular", category: "P&L", type: "TEXT", sample: "Interest / Fee Income" },
      { code: "reference", label: "Reference", category: "P&L", type: "TEXT", sample: "A" },
      { code: "amount", label: "Amount", category: "P&L", type: "MONEY", sample: "₹8,38,428" },
      { code: "formula", label: "Formula", category: "P&L", type: "TEXT", sample: "C = A + B" },
    ],
  },
  {
    id: "capitalAccount",
    label: "Capital Account",
    description: "Commitment, drawdown, distribution and NAV movement",
    fields: [
      { code: "opening_capital", label: "Opening Capital", category: "Capital Account", type: "MONEY", sample: "₹1,50,00,000" },
      { code: "capital_contribution", label: "Capital Contribution", category: "Capital Account", type: "MONEY", sample: "₹50,00,000" },
      { code: "income_allocation", label: "Income Allocation", category: "Capital Account", type: "MONEY", sample: "₹8,44,514" },
      { code: "distribution", label: "Distribution", category: "Capital Account", type: "MONEY", sample: "₹5,91,981" },
      { code: "closing_capital", label: "Closing Capital", category: "Capital Account", type: "MONEY", sample: "₹1,82,40,000" },
    ],
  },
  {
    id: "taxBreakup",
    label: "Tax breakup",
    description: "Form 64C / 64D and advance tax related values",
    fields: [
      { code: "income_head", label: "Income Head", category: "Tax", type: "TEXT", sample: "Interest income" },
      { code: "gross_income", label: "Gross Income", category: "Tax", type: "MONEY", sample: "₹8,44,514" },
      { code: "tds", label: "TDS", category: "Tax", type: "MONEY", sample: "₹84,451" },
      { code: "net_income", label: "Net Income", category: "Tax", type: "MONEY", sample: "₹7,60,063" },
    ],
  },
  {
    id: "distributionDetails",
    label: "Distribution Details",
    description: "Distribution notice and payout lines",
    fields: [
      { code: "distribution_date", label: "Distribution Date", category: "Distribution", type: "DATE", sample: "02-Jul-24" },
      { code: "gross_distribution", label: "Gross Distribution", category: "Distribution", type: "MONEY", sample: "₹5,91,981" },
      { code: "tax_withheld", label: "Tax Withheld", category: "Distribution", type: "MONEY", sample: "₹59,198" },
      { code: "net_distribution", label: "Net Distribution", category: "Distribution", type: "MONEY", sample: "₹5,32,783" },
    ],
  },
  {
    id: "unitMovements",
    label: "Unit Movements",
    description: "Unit allotment and redemption schedule",
    fields: [
      { code: "unit_date", label: "Date", category: "Units", type: "DATE", sample: "24-Apr-24" },
      { code: "opening_units", label: "Opening Units", category: "Units", type: "NUMBER", sample: "0" },
      { code: "units_added", label: "Units Added", category: "Units", type: "NUMBER", sample: "1,98,820" },
      { code: "units_redeemed", label: "Units Redeemed", category: "Units", type: "NUMBER", sample: "0" },
      { code: "closing_units", label: "Closing Units", category: "Units", type: "NUMBER", sample: "1,98,820" },
    ],
  },
  {
    id: "portfolioPerformance",
    label: "Portfolio Performance",
    description: "Portfolio company and valuation movement",
    fields: [
      { code: "company_name", label: "Company", category: "Portfolio", type: "TEXT", sample: "Portfolio Co A" },
      { code: "invested_amount", label: "Invested Amount", category: "Portfolio", type: "MONEY", sample: "₹50,00,000" },
      { code: "current_value", label: "Current Value", category: "Portfolio", type: "MONEY", sample: "₹82,00,000" },
      { code: "moic", label: "MOIC", category: "Portfolio", type: "NUMBER", sample: "1.64x" },
      { code: "irr", label: "IRR", category: "Portfolio", type: "PERCENT", sample: "22.4%" },
    ],
  },
  {
    id: "genericTable",
    label: "Generic Table",
    description: "Flexible two-column table",
    fields: [
      { code: "particulars", label: "Particulars", category: "Generic", type: "TEXT", sample: "Sample line item" },
      { code: "amount", label: "Amount", category: "Generic", type: "MONEY", sample: "₹1,00,000" },
    ],
  },
];

const baseCalculatedFields: MergeField[] = [
  { code: "gross_income", label: "Gross income", category: "Calculated", type: "FORMULA", sample: "Interest income + STCG" },
  { code: "total_expenses", label: "Total expenses", category: "Calculated", type: "FORMULA", sample: "Management fee + Operating expenses + Stamp duty" },
  { code: "net_income", label: "Net income", category: "Calculated", type: "FORMULA", sample: "Gross income - Total expenses" },
  { code: "net_income_payout", label: "Net income payout", category: "Calculated", type: "FORMULA", sample: "Net income - TDS" },
  { code: "uncalled_capital_calc", label: "Uncalled capital", category: "Calculated", type: "FORMULA", sample: "Commitment - Capital called" },
  { code: "xirr", label: "Investor XIRR", category: "Calculated", type: "XIRR", sample: "Investor-wise cashflow return" },
  { code: "dpi_calc", label: "DPI", category: "Calculated", type: "FORMULA", sample: "Distributions / Paid-in capital" },
  { code: "tvpi_calc", label: "TVPI", category: "Calculated", type: "FORMULA", sample: "(NAV + Distributions) / Paid-in capital" },
];

const documentTypes = [
  "Statement of Account (SOA)",
  "Capital Call Notice",
  "Distribution Notice",
  "Unit Allotment Letter",
  "Unit Statement",
  "Advance Tax Data Points",
  "Drawdown Reminder",
  "Form 64C",
  "Form 64D",
  "Annual Income Report",
];
const documentPresets: DocumentPreset[] = [
  {
    id: "statement-of-account",
    name: "Statement of Account",
    documentType: "Statement of Account (SOA)",
    templateName: "SOA - Smart Investor Statement",
    description:
      "Investor identity, capital account, transactions, financial statement, performance, notes and signature.",
    bestFor: "Quarterly investor reporting",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "summary",
        title: "Capital account summary",
        subtitle: "Commitment, capital called, uncalled capital and NAV",
        repeatSource: "capitalAccount",
      },
      {
        kind: "transactions",
        title: "Investor transaction statement",
        subtitle: "Capital calls, distributions, units and NAV movements",
        repeatSource: "transactions",
      },
      {
        kind: "financial",
        title: "Statement of income and distribution",
        subtitle: "Income, expenses, net income and payout",
        repeatSource: "pnl",
      },
      { kind: "performance" },
      { kind: "notes" },
      { kind: "signature" },
    ],
  },
  {
    id: "capital-call-notice",
    name: "Capital Call Notice",
    documentType: "Capital Call Notice",
    templateName: "Capital Call Notice Template",
    description:
      "Notice format for drawdown amount, investor commitment, due date, bank details and authorized signatory.",
    bestFor: "Drawdown communication",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "notes",
        title: "Capital call notice text",
        subtitle: "Purpose, amount due and due date wording",
        content:
          "Dear {investor_name}, this is to notify you of a capital call for {fund_name}. Please remit the called amount as per the fund records on or before the due date mentioned in this notice.",
      },
      {
        kind: "summary",
        title: "Capital call summary",
        subtitle: "Commitment, called capital and uncalled capital",
        repeatSource: "capitalAccount",
      },
      {
        kind: "transactions",
        title: "Drawdown schedule",
        subtitle: "Capital call and payment movement",
        repeatSource: "transactions",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "distribution-notice",
    name: "Distribution Notice",
    documentType: "Distribution Notice",
    templateName: "Distribution Notice Template",
    description:
      "Distribution communication with gross distribution, tax withheld, net payout and investor details.",
    bestFor: "Investor payout communication",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "notes",
        title: "Distribution notice text",
        subtitle: "Distribution communication wording",
        content:
          "Dear {investor_name}, we are pleased to inform you that a distribution has been approved for {fund_name}. The distribution details are provided below.",
      },
      {
        kind: "financial",
        title: "Distribution breakup",
        subtitle: "Gross distribution, tax withheld and net distribution",
        repeatSource: "distributionDetails",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "unit-allotment-letter",
    name: "Unit Allotment Letter",
    documentType: "Unit Allotment Letter",
    templateName: "Unit Allotment Letter Template",
    description:
      "Allotment confirmation with investor details, units allotted, NAV and capital contribution.",
    bestFor: "Post drawdown unit allotment",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "notes",
        title: "Unit allotment confirmation",
        subtitle: "Allotment confirmation wording",
        content:
          "This is to confirm that units have been allotted to {investor_name} in {fund_name} based on the capital contribution received.",
      },
      {
        kind: "financial",
        title: "Unit allotment schedule",
        subtitle: "Units added, opening units and closing units",
        repeatSource: "unitMovements",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "unit-statement",
    name: "Unit Statement",
    documentType: "Unit Statement",
    templateName: "Unit Statement Template",
    description:
      "Investor-wise unit holding statement with opening units, additions, redemptions and closing units.",
    bestFor: "Unit balance reporting",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "summary",
        title: "Unit holding summary",
        subtitle: "Investor holding and NAV summary",
        repeatSource: "capitalAccount",
      },
      {
        kind: "financial",
        title: "Unit movement schedule",
        subtitle: "Opening units, units added, redeemed and closing units",
        repeatSource: "unitMovements",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "advance-tax-data",
    name: "Advance Tax Data Points",
    documentType: "Advance Tax Data Points",
    templateName: "Advance Tax Data Points Template",
    description:
      "Tax-related investor data points including income nature, gross income, TDS and net income.",
    bestFor: "Investor tax communication",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "financial",
        title: "Advance tax data points",
        subtitle: "Income head, gross income, TDS and net income",
        repeatSource: "taxBreakup",
      },
      {
        kind: "notes",
        title: "Tax note",
        subtitle: "Investor tax note",
        content:
          "The above data points are provided for tax estimation purposes based on fund records as on {report_date}. Investors should consult their tax advisors before relying on this information.",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "drawdown-reminder",
    name: "Drawdown Reminder",
    documentType: "Drawdown Reminder",
    templateName: "Drawdown Reminder Template",
    description:
      "Reminder format for pending drawdown or capital call payment.",
    bestFor: "Pending capital call follow-up",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "notes",
        title: "Drawdown reminder text",
        subtitle: "Reminder wording",
        content:
          "Dear {investor_name}, this is a reminder for the pending drawdown obligation in respect of {fund_name}. Kindly complete the remittance as per the capital call notice.",
      },
      {
        kind: "summary",
        title: "Pending drawdown summary",
        subtitle: "Commitment, capital called and uncalled capital",
        repeatSource: "capitalAccount",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "form-64c",
    name: "Form 64C",
    documentType: "Form 64C",
    templateName: "Form 64C Template",
    description:
      "Investor-wise income and tax breakup format for AIF tax reporting.",
    bestFor: "AIF tax reporting to investors",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "financial",
        title: "Form 64C income breakup",
        subtitle: "Nature of income, gross income, TDS and net income",
        repeatSource: "taxBreakup",
      },
      {
        kind: "notes",
        title: "Form 64C note",
        subtitle: "Tax reporting note",
        content:
          "This statement provides income and tax information as per the records of {fund_name}. Investors should refer to the final signed Form 64C for statutory purposes.",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "form-64d",
    name: "Form 64D",
    documentType: "Form 64D",
    templateName: "Form 64D Template",
    description:
      "Fund-level tax reporting support format with income breakup and certification section.",
    bestFor: "Fund-level AIF tax reporting",
    blocks: [
      { kind: "letterhead" },
      {
        kind: "financial",
        title: "Form 64D income breakup",
        subtitle: "Income head, gross income, TDS and net income",
        repeatSource: "taxBreakup",
      },
      {
        kind: "notes",
        title: "Form 64D note",
        subtitle: "Fund-level reporting note",
        content:
          "This document captures fund-level income and tax data points for reporting and review purposes.",
      },
      { kind: "signature" },
    ],
  },
  {
    id: "annual-income-report",
    name: "Annual Income Report",
    documentType: "Annual Income Report",
    templateName: "Annual Income Report Template",
    description:
      "Annual investor income report with capital account, P&L, performance and tax breakup sections.",
    bestFor: "Year-end investor reporting",
    blocks: [
      { kind: "letterhead" },
      { kind: "identity" },
      {
        kind: "summary",
        title: "Annual capital account summary",
        subtitle: "Opening capital, contribution, income allocation, distribution and closing capital",
        repeatSource: "capitalAccount",
      },
      {
        kind: "financial",
        title: "Annual income statement",
        subtitle: "Annual income, expenses, tax and payout",
        repeatSource: "pnl",
      },
      {
        kind: "transactions",
        title: "Annual transaction statement",
        subtitle: "Full year capital calls, distributions and unit movements",
        repeatSource: "transactions",
      },
      { kind: "performance" },
      { kind: "chart" },
      { kind: "notes" },
      { kind: "signature" },
    ],
  },
];

function getInvestorValue(investor: InvestorProfile, code: string) {
  const values: Record<string, string> = {
    investor_name: investor.name,
    investor_code: investor.code,
    investor_type: investor.type,
    fund_name: investor.fundName,
    fund_address: "GIFT City, Gandhinagar",
    statement_period: "Q1 FY 2025-26",
    report_date: "30-Jun-2025",
    commitment_amount: investor.commitment,
    capital_called: investor.capitalCalled,
    uncalled_capital: investor.uncalledCapital,
    current_nav: investor.nav,
    distribution_amount: investor.distribution,
    dpi: investor.dpi,
    tvpi: investor.tvpi,
    irr: investor.irr,
    generated_on: "28-Jul-2026",
  };

  return values[code] ?? `{${code}}`;
}

function getDefaultRepeatSourceForBlock(block: TemplateBlock): TableBlockConfig["repeatSource"] {
  if (block.kind === "summary") return "capitalAccount";
  if (block.kind === "financial") return "pnl";
  return "transactions";
}

function isValidTableRepeatSource(value: unknown): value is TableBlockConfig["repeatSource"] {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(tableFieldOptions, value);
}

function isConfigurableTableBlock(block?: TemplateBlock | null) {
  return block?.kind === "summary" || block?.kind === "transactions" || block?.kind === "financial";
}

function getTableTitle(block: TemplateBlock) {
  const source = block.tableConfig?.repeatSource || block.repeatSource;

  if (source === "capitalAccount") return "Capital Account";
  if (source === "pnl") return "Financial Statement";
  if (source === "cashflows") return "Cashflows";
  if (source === "taxBreakup") return "Tax Breakup";
  if (source === "distributionDetails") return "Distribution Details";
  if (source === "unitMovements") return "Unit Movements";
  if (source === "portfolioPerformance") return "Portfolio Performance";
  if (source === "genericTable") return "Additional Schedule";
  return "Transactions";
}

function ensureTableConfigForTemplateBlock(block: TemplateBlock): TemplateBlock {
  const withStyle = {
    ...block,
    style: { ...baseStyle, ...block.style },
  };

  if (!isConfigurableTableBlock(withStyle)) {
    return withStyle;
  }

  const repeatSource = isValidTableRepeatSource(withStyle.tableConfig?.repeatSource)
    ? withStyle.tableConfig.repeatSource
    : isValidTableRepeatSource(withStyle.repeatSource)
    ? withStyle.repeatSource
    : getDefaultRepeatSourceForBlock(withStyle);

  const fallbackConfig = createTableConfig(repeatSource);
  const existingColumns =
    withStyle.tableConfig?.columns && withStyle.tableConfig.columns.length > 0
      ? withStyle.tableConfig.columns
      : fallbackConfig.columns;

  return {
    ...withStyle,
    repeatSource,
    tableConfig: {
      ...fallbackConfig,
      ...withStyle.tableConfig,
      repeatSource,
      columns: existingColumns,
    },
  };
}

function getSampleValueForTableField(fieldKey: string) {
  const sampleValues: Record<string, string> = {
    transaction_date: "24-Apr-24",
    transaction_description: "Units Allotment",
    transaction_type: "Capital Call",
    transaction_amount: "₹1,98,82,000",
    units: "1,98,820",
    nav: "₹100.00",
    cashflow_date: "24-Apr-24",
    cashflow_type: "Capital Call",
    amount: "₹1,98,82,000",
    remarks: "Investor cashflow",
    opening_capital: "₹1,50,00,000",
    capital_contribution: "₹50,00,000",
    income_allocation: "₹8,44,514",
    distribution: "₹5,91,981",
    closing_capital: "₹1,82,40,000",
    income_head: "Interest income",
    gross_income: "₹8,44,514",
    tds: "₹84,451",
    net_income: "₹7,60,063",
    distribution_date: "02-Jul-24",
    gross_distribution: "₹5,91,981",
    tax_withheld: "₹59,198",
    net_distribution: "₹5,32,783",
    unit_date: "24-Apr-24",
    opening_units: "0",
    units_added: "1,98,820",
    units_redeemed: "0",
    closing_units: "1,98,820",
    company_name: "Portfolio Co A",
    invested_amount: "₹50,00,000",
    current_value: "₹82,00,000",
    moic: "1.64x",
    particular: "Interest / Fee Income",
    reference: "A",
    formula: "C = A + B",
    particulars: "Sample line item",
  };

  return sampleValues[fieldKey] || `{${fieldKey}}`;
}

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeSavedTemplateBlocks(value: unknown): TemplateBlock[] {
  if (!Array.isArray(value)) return starterBlocks.map(ensureTableConfigForTemplateBlock);

  const allowedKinds: BlockKind[] = [
    "letterhead",
    "identity",
    "summary",
    "transactions",
    "financial",
    "performance",
    "chart",
    "notes",
    "signature",
  ];

  const cleanBlocks = value
    .map((item) => item as Partial<TemplateBlock>)
    .filter((item) => item.kind && allowedKinds.includes(item.kind))
    .map((item, index): TemplateBlock =>
      ensureTableConfigForTemplateBlock({
        id: item.id || `saved-block-${index}`,
        kind: item.kind as BlockKind,
        title: item.title || "Saved template block",
        subtitle: item.subtitle || "Loaded from saved template",
        content: item.content,
        repeatSource: item.repeatSource,
        tableConfig: item.tableConfig,
        style: item.style,
        chartConfig: item.chartConfig,
      })
    );

  return cleanBlocks.length > 0 ? cleanBlocks : starterBlocks.map(ensureTableConfigForTemplateBlock);
}

export default function DocumentStudioPage() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("start");
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("insert");
  const [mergeMode, setMergeMode] = useState<MergeMode>("cell");
  const [templateName, setTemplateName] = useState("AIF Statement Template");
  const [selectedInvestorId, setSelectedInvestorId] = useState("aarav");
  const [selectedDocumentType, setSelectedDocumentType] = useState("Statement of Account (SOA)");
  const [selectedDocumentPresetId, setSelectedDocumentPresetId] = useState(
  documentPresets[0]?.id || "statement-of-account"
);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(starterBlocks.map(ensureTableConfigForTemplateBlock));
  const [selectedBlockId, setSelectedBlockId] = useState(starterBlocks[2]?.id || "");
  const [selectedColumnSource, setSelectedColumnSource] = useState<TableBlockConfig["repeatSource"]>("transactions");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [importDone, setImportDone] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [previewMergeData, setPreviewMergeData] = useState<PreviewMergeResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchGenerationResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [pdfGenerationResult, setPdfGenerationResult] = useState<PdfGenerationResponse | null>(null);
  const [selectedBatchDocumentIds, setSelectedBatchDocumentIds] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportTemplateResponse | null>(null);
  const [apiBusy, setApiBusy] = useState(false);
  const [pageSettings, setPageSettings] = useState<PageSettings>(basePageSettings);
  const [calculatedFields, setCalculatedFields] = useState<MergeField[]>(baseCalculatedFields);
  const [newCalculatedCode, setNewCalculatedCode] = useState("net_income_custom");
  const [newCalculatedFormula, setNewCalculatedFormula] = useState("gross_income - total_expenses - tds");
  const [statusMessage, setStatusMessage] = useState(
    "Choose how you want to prepare the investor document template."
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedInvestor = investors.find((investor) => investor.id === selectedInvestorId) ?? investors[0];
  const batchDocuments = useMemo(() => {
  return pdfGenerationResult?.documents || batchResult?.documents || [];
}, [batchResult, pdfGenerationResult]);

const selectedBatchDocuments = useMemo(() => {
  return batchDocuments.filter(
    (document) => document.id && selectedBatchDocumentIds.includes(document.id)
  );
}, [batchDocuments, selectedBatchDocumentIds]);

const failedBatchDocumentIds = useMemo(() => {
  return batchDocuments
    .filter((document) =>
      (document.generation_status || "").toLowerCase().includes("failed")
    )
    .map((document) => document.id)
    .filter((id): id is string => Boolean(id));
}, [batchDocuments]);

  const selectedBlock = useMemo(() => {
    return blocks.find((block) => block.id === selectedBlockId) ?? blocks[0] ?? null;
  }, [blocks, selectedBlockId]);

  const selectedBlockIndex = selectedBlock ? blocks.findIndex((block) => block.id === selectedBlock.id) : -1;

  const activeColumnSource =
    columnSources.find((source) => source.id === selectedColumnSource) ?? columnSources[0];
    const selectedDocumentPreset =
  documentPresets.find((preset) => preset.id === selectedDocumentPresetId) ??
  documentPresets[0] ??
  null;

  const selectedTableConfig = isConfigurableTableBlock(selectedBlock)
    ? selectedBlock.tableConfig || createTableConfig(getDefaultRepeatSourceForBlock(selectedBlock))
    : null;

  const selectedColumn = selectedTableConfig?.columns.find((column) => column.id === selectedColumnId) || null;

  useEffect(() => {
    loadSavedTemplates();
  }, []);

  async function loadSavedTemplates() {
    try {
      const response = await fetch("/api/document-studio/templates", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Unable to load templates.");
      setSavedTemplates(result.templates ?? []);
    } catch (error) {
      console.warn("Unable to load saved document templates:", error);
    }
  }
function selectAllBatchDocuments() {
  const ids = batchDocuments
    .map((document) => document.id)
    .filter((id): id is string => Boolean(id));

  setSelectedBatchDocumentIds(ids);
  setStatusMessage(`${ids.length} queued document(s) selected.`);
}

function clearBatchSelection() {
  setSelectedBatchDocumentIds([]);
  setStatusMessage("Batch selection cleared.");
}

function selectFailedBatchDocuments() {
  setSelectedBatchDocumentIds(failedBatchDocumentIds);

  setStatusMessage(
    failedBatchDocumentIds.length > 0
      ? `${failedBatchDocumentIds.length} failed document(s) selected for regeneration.`
      : "No failed documents found in this batch."
  );
}

function toggleBatchDocumentSelection(documentId?: string) {
  if (!documentId) return;

  setSelectedBatchDocumentIds((currentIds) =>
    currentIds.includes(documentId)
      ? currentIds.filter((id) => id !== documentId)
      : [...currentIds, documentId]
  );
}
  function resetRuntimeResults() {
    setPreviewMergeData(null);
    setBatchResult(null);
    setPdfGenerationResult(null);
    setPublishResult(null);
  }

  function startNewTemplate(blank = true) {
    const nextBlocks = blank
      ? [createBlock("letterhead"), createBlock("identity")].map(ensureTableConfigForTemplateBlock)
      : starterBlocks.map((block) => ensureTableConfigForTemplateBlock({ ...block, id: `${block.kind}-${Date.now()}-${Math.random()}` }));

    setActiveTemplateId("");
    setTemplateName(blank ? "Untitled AIF Template" : "AIF Statement Template");
    setSelectedDocumentType("Statement of Account (SOA)");
    setBlocks(nextBlocks);
    setSelectedBlockId(nextBlocks[0]?.id || "");
    setSelectedColumnId("");
    setImportDone(false);
    setImportResult(null);
    resetRuntimeResults();
    setRibbonTab("insert");
    setMergeMode("cell");
    setWorkspaceTab("builder");
    setStatusMessage(blank ? "New blank template created. Use Insert tools to add sections." : "Existing VENTIQ starter template loaded.");
  }
function createPresetBlock(presetBlock: DocumentPresetBlock): TemplateBlock {
  const baseBlock = ensureTableConfigForTemplateBlock(createBlock(presetBlock.kind));

  const repeatSource =
    presetBlock.repeatSource ||
    baseBlock.tableConfig?.repeatSource ||
    baseBlock.repeatSource;

  return ensureTableConfigForTemplateBlock({
    ...baseBlock,
    title: presetBlock.title || baseBlock.title,
    subtitle: presetBlock.subtitle || baseBlock.subtitle,
    content: presetBlock.content ?? baseBlock.content,
    repeatSource,
    tableConfig: repeatSource ? createTableConfig(repeatSource) : baseBlock.tableConfig,
    chartConfig: presetBlock.chartConfig || baseBlock.chartConfig,
  });
}

function startDocumentPreset(preset: DocumentPreset) {
  const nextBlocks = preset.blocks.map(createPresetBlock);

  setActiveTemplateId("");
  setTemplateName(preset.templateName);
  setSelectedDocumentType(preset.documentType);
  setSelectedDocumentPresetId(preset.id);
  setBlocks(nextBlocks);
  setSelectedBlockId(nextBlocks[0]?.id || "");
  setSelectedColumnId(
    nextBlocks.find((block) => block.tableConfig)?.tableConfig?.columns[0]?.id ||
      ""
  );
  setImportDone(false);
  setImportResult(null);
  resetRuntimeResults();
  setRibbonTab("insert");
  setMergeMode("cell");
  setWorkspaceTab("builder");
  setStatusMessage(
    `${preset.name} kit loaded. You can now edit blocks, fields, tables, notes and signature before saving.`
  );
}
  function openSavedTemplate(template: SavedTemplate) {
    const savedBlocks = normalizeSavedTemplateBlocks(template.blocks_json);
    const importInfo = getSavedTemplateImportResult(template);

    setActiveTemplateId(template.id);
    setTemplateName(template.template_name || "Untitled Template");
    setSelectedDocumentType(template.document_type || "Statement of Account (SOA)");
    setBlocks(savedBlocks);
    setSelectedBlockId(savedBlocks[0]?.id || "");
    setSelectedColumnId("");
    setImportResult(importInfo);
    setImportDone(Boolean(importInfo || template.source_type?.toLowerCase().includes("import") || Number(template.import_confidence || 0) > 0));
    resetRuntimeResults();
    setRibbonTab("insert");
    setMergeMode(importInfo ? "import" : "cell");
    setWorkspaceTab("builder");
    setStatusMessage(`${template.template_name} opened. You can edit, save and preview this template.`);
  }

  function getSavedTemplateImportResult(template: SavedTemplate): ImportTemplateResponse | null {
    if (!template.field_mappings || typeof template.field_mappings !== "object") return null;
    const mappings = template.field_mappings as Record<string, unknown>;
    const importIntelligence = mappings.import_intelligence;
    if (!importIntelligence || typeof importIntelligence !== "object") return null;
    const importData = importIntelligence as Record<string, unknown>;

    return {
      detectedDocumentType:
        typeof importData.detected_document_type === "string"
          ? importData.detected_document_type
          : template.document_type || undefined,
      importConfidence:
        typeof importData.import_confidence === "number" ? importData.import_confidence : template.import_confidence || undefined,
      detectedFields: stringArrayFromUnknown(importData.detected_fields),
      detectedSections: stringArrayFromUnknown(importData.detected_sections),
      unmappedItems: stringArrayFromUnknown(importData.unmapped_items),
      storage:
        importData.storage && typeof importData.storage === "object"
          ? (importData.storage as ImportTemplateResponse["storage"])
          : undefined,
    };
  }

  function updateSelectedBlock(updates: Partial<TemplateBlock>) {
    if (!selectedBlock) return;

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.id === selectedBlock.id ? { ...block, ...updates } : block))
    );
  }

  function updateSelectedBlockStyle(updates: Partial<BlockStyle>) {
    if (!selectedBlock) return;
    updateSelectedBlock({ style: { ...baseStyle, ...selectedBlock.style, ...updates } });
    setStatusMessage("Selected block formatting updated.");
  }

  function updatePageSettings(updates: Partial<PageSettings>) {
    setPageSettings((current) => ({ ...current, ...updates }));
    setStatusMessage("Page layout/view setting updated.");
  }

  function updateSelectedTableConfig(updates: Partial<TableBlockConfig>) {
    if (!selectedBlock || !isConfigurableTableBlock(selectedBlock)) {
      setStatusMessage("Select a table block first.");
      return;
    }

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== selectedBlock.id) return block;
        const existingConfig = block.tableConfig || createTableConfig(getDefaultRepeatSourceForBlock(block));
        return {
          ...block,
          repeatSource: updates.repeatSource || existingConfig.repeatSource,
          tableConfig: {
            ...existingConfig,
            ...updates,
          },
        };
      })
    );
  }

  function updateSelectedTableColumn(columnId: string, updates: Partial<TableColumnConfig>) {
    if (!selectedBlock || !isConfigurableTableBlock(selectedBlock)) return;

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== selectedBlock.id || !block.tableConfig) return block;
        return {
          ...block,
          tableConfig: {
            ...block.tableConfig,
            columns: block.tableConfig.columns.map((column) =>
              column.id === columnId ? { ...column, ...updates } : column
            ),
          },
        };
      })
    );
  }

  function addBlock(kind: BlockKind) {
    const block = ensureTableConfigForTemplateBlock(createBlock(kind));
    setBlocks((current) => [...current, block]);
    setSelectedBlockId(block.id);
    setSelectedColumnId(block.tableConfig?.columns[0]?.id || "");
    setWorkspaceTab("builder");
    setStatusMessage(`${block.title} inserted. Insert tab remains active so you can add more sections.`);
  }

  function deleteSelectedBlock() {
    if (!selectedBlock) return;
    if (blocks.length <= 1) {
      setStatusMessage("At least one template block is required.");
      return;
    }

    const deletedTitle = selectedBlock.title;
    const currentIndex = selectedBlockIndex;
    const nextBlocks = blocks.filter((block) => block.id !== selectedBlock.id);
    setBlocks(nextBlocks);
    setSelectedBlockId(nextBlocks[Math.max(0, currentIndex - 1)]?.id || nextBlocks[0]?.id || "");
    setSelectedColumnId("");
    setStatusMessage(`${deletedTitle} deleted from the template.`);
  }

  function duplicateSelectedBlock() {
    if (!selectedBlock) return;
    const timestamp = Date.now();
    const duplicatedBlock: TemplateBlock = {
      ...selectedBlock,
      id: `${selectedBlock.kind}-${timestamp}`,
      title: `${selectedBlock.title} Copy`,
      tableConfig: selectedBlock.tableConfig
        ? {
            ...selectedBlock.tableConfig,
            columns: selectedBlock.tableConfig.columns.map((column, index) => ({
              ...column,
              id: `${column.id}-copy-${timestamp}-${index}`,
            })),
          }
        : undefined,
    };

    setBlocks((currentBlocks) => {
      const currentIndex = currentBlocks.findIndex((block) => block.id === selectedBlock.id);
      const nextBlocks = [...currentBlocks];
      nextBlocks.splice(currentIndex + 1, 0, duplicatedBlock);
      return nextBlocks;
    });
    setSelectedBlockId(duplicatedBlock.id);
    setStatusMessage(`${selectedBlock.title} duplicated.`);
  }

  function moveSelectedBlock(direction: "up" | "down") {
    if (!selectedBlock) return;

    setBlocks((currentBlocks) => {
      const currentIndex = currentBlocks.findIndex((block) => block.id === selectedBlock.id);
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= currentBlocks.length) {
        setStatusMessage(direction === "up" ? "Selected block is already at the top." : "Selected block is already at the bottom.");
        return currentBlocks;
      }

      const nextBlocks = [...currentBlocks];
      const movingBlock = nextBlocks[currentIndex];
      nextBlocks[currentIndex] = nextBlocks[nextIndex];
      nextBlocks[nextIndex] = movingBlock;
      setStatusMessage(`${movingBlock.title} moved ${direction}.`);
      return nextBlocks;
    });
  }

  function addTableColumn(format?: TableColumnConfig["format"]) {
    if (!selectedBlock || !isConfigurableTableBlock(selectedBlock)) {
      setStatusMessage("Select Summary, Transaction or Financial table before adding a column.");
      return;
    }

    const tableConfig = selectedBlock.tableConfig || createTableConfig(getDefaultRepeatSourceForBlock(selectedBlock));
    const sourceFields = tableFieldOptions[tableConfig.repeatSource];
    const alreadyUsedFields = new Set(tableConfig.columns.map((column) => column.fieldKey));
    const formatMatch = format ? sourceFields.find((field) => field.format === format && !alreadyUsedFields.has(field.value)) : undefined;
    const nextAvailableField = formatMatch || sourceFields.find((field) => !alreadyUsedFields.has(field.value)) || sourceFields[sourceFields.length - 1];
    const nextColumnNumber = tableConfig.columns.length + 1;
    const nextFormat = format || nextAvailableField?.format || "text";

    const nextColumn: TableColumnConfig = {
      id: `column-${Date.now()}`,
      header: nextAvailableField?.label || `Column ${nextColumnNumber}`,
      fieldKey: nextAvailableField?.value || "particulars",
      width: nextFormat === "text" ? 32 : 18,
      format: nextFormat,
      align: nextFormat === "currency" || nextFormat === "number" || nextFormat === "percentage" ? "right" : "left",
    };

    updateSelectedTableConfig({ columns: [...tableConfig.columns, nextColumn] });
    setSelectedColumnId(nextColumn.id);
    setStatusMessage(`${nextColumn.header} column added and selected.`);
  }

  function deleteTableColumn(columnId: string) {
    if (!selectedTableConfig || selectedTableConfig.columns.length <= 1) {
      setStatusMessage("At least one table column is required.");
      return;
    }

    updateSelectedTableConfig({ columns: selectedTableConfig.columns.filter((column) => column.id !== columnId) });
    setSelectedColumnId(selectedTableConfig.columns[0]?.id || "");
    setStatusMessage("Selected table column deleted.");
  }

  function mergeSelectedColumnWithNext() {
    if (!selectedTableConfig || !selectedColumnId) {
      setStatusMessage("Select a table column header first, then click Merge with Next.");
      return;
    }

    const currentIndex = selectedTableConfig.columns.findIndex((column) => column.id === selectedColumnId);
    const nextColumn = selectedTableConfig.columns[currentIndex + 1];

    if (currentIndex === -1 || !nextColumn) {
      setStatusMessage("There is no next column to merge with.");
      return;
    }

    const currentColumn = selectedTableConfig.columns[currentIndex];
    const mergedColumn: TableColumnConfig = {
      ...currentColumn,
      header: `${currentColumn.header} / ${nextColumn.header}`,
      width: currentColumn.width + nextColumn.width,
    };

    updateSelectedTableConfig({
      columns: selectedTableConfig.columns
        .map((column, index) => (index === currentIndex ? mergedColumn : column))
        .filter((_, index) => index !== currentIndex + 1),
    });
    setSelectedColumnId(mergedColumn.id);
    setStatusMessage("Selected column merged with the next column.");
  }

  function splitSelectedColumn() {
    if (!selectedTableConfig || !selectedColumnId) {
      setStatusMessage("Select a column to split.");
      return;
    }

    const currentIndex = selectedTableConfig.columns.findIndex((column) => column.id === selectedColumnId);
    if (currentIndex === -1) return;

    const currentColumn = selectedTableConfig.columns[currentIndex];
    const newColumn: TableColumnConfig = {
      ...currentColumn,
      id: `split-column-${Date.now()}`,
      header: "New split column",
      width: Math.max(12, Math.round(currentColumn.width / 2)),
    };

    const adjustedCurrent = { ...currentColumn, width: Math.max(12, Math.round(currentColumn.width / 2)) };
    const nextColumns = [...selectedTableConfig.columns];
    nextColumns[currentIndex] = adjustedCurrent;
    nextColumns.splice(currentIndex + 1, 0, newColumn);
    updateSelectedTableConfig({ columns: nextColumns });
    setSelectedColumnId(newColumn.id);
    setStatusMessage("Column split into two configurable columns.");
  }

  function changeTableRepeatSource(repeatSource: TableBlockConfig["repeatSource"]) {
    const nextConfig = createTableConfig(repeatSource);
    updateSelectedTableConfig(nextConfig);
    updateSelectedBlock({ repeatSource, subtitle: `Repeating table mapped to ${repeatSource}` });
    setSelectedColumnSource(repeatSource);
    setSelectedColumnId(nextConfig.columns[0]?.id || "");
    setStatusMessage(`Table source changed to ${repeatSource}. Columns remapped automatically.`);
  }

  function updateSelectedChartConfig(updates: Partial<ChartConfig>) {
    if (!selectedBlock || selectedBlock.kind !== "chart") {
      setStatusMessage("Select a chart block first.");
      return;
    }

    updateSelectedBlock({
      chartConfig: {
        chartType: "bar",
        series: "current_nav",
        title: "Portfolio Movement Chart",
        ...selectedBlock.chartConfig,
        ...updates,
      },
    });
    setStatusMessage("Chart configuration updated.");
  }

  function insertField(field: MergeField) {
    if (!selectedBlock) {
      setStatusMessage("Select a block before inserting a field.");
      return;
    }

    if (isConfigurableTableBlock(selectedBlock)) {
      if (!selectedColumnId) {
        setStatusMessage("Select a table column header first, then choose a field mapping.");
        return;
      }

      const fieldFormat = field.type === "MONEY" ? "currency" : field.type === "DATE" ? "date" : field.type === "NUMBER" ? "number" : field.type === "PERCENT" ? "percentage" : "text";
      updateSelectedTableColumn(selectedColumnId, {
        header: field.label,
        fieldKey: field.code,
        format: fieldFormat,
        align: fieldFormat === "currency" || fieldFormat === "number" || fieldFormat === "percentage" ? "right" : "left",
      });
      setStatusMessage(`${field.label} mapped to selected table column.`);
      return;
    }

    const fieldCode = `{${field.code}}`;
    updateSelectedBlock({ content: `${selectedBlock.content || ""}${selectedBlock.content ? " " : ""}${fieldCode}` });
    setStatusMessage(`${fieldCode} inserted into ${selectedBlock.title}.`);
  }

  function saveCalculatedField() {
    const cleanCode = newCalculatedCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanCode) {
      setStatusMessage("Enter a calculated field name first.");
      return;
    }

    const nextField: MergeField = {
      code: cleanCode,
      label: cleanCode.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      category: "Calculated",
      type: cleanCode.includes("xirr") ? "XIRR" : "FORMULA",
      sample: newCalculatedFormula || "Custom calculated formula",
    };

    setCalculatedFields((current) => {
      const withoutDuplicate = current.filter((field) => field.code !== cleanCode);
      return [...withoutDuplicate, nextField];
    });
    setStatusMessage(`Calculated field {${cleanCode}} saved and available for insertion.`);
  }

  function renderContentWithSampleValues(content: string) {
    return content.replace(/\{([^}]+)\}/g, (_match, code: string) => getInvestorValue(selectedInvestor, code.trim()));
  }

  function fallbackImportedBlocks(): TemplateBlock[] {
    return [
      createBlock("letterhead"),
      createBlock("identity"),
      createBlock("summary"),
      createBlock("transactions"),
      createBlock("financial"),
      createBlock("signature"),
    ].map(ensureTableConfigForTemplateBlock);
  }

  function applyImportedTemplate(result: ImportTemplateResponse, fileName: string) {
    const suggestedBlocks = result.suggestedBlocks && result.suggestedBlocks.length > 0 ? result.suggestedBlocks : fallbackImportedBlocks();
    const normalizedBlocks = suggestedBlocks.map(ensureTableConfigForTemplateBlock);

    setImportDone(true);
    setImportResult(result);
    setBlocks(normalizedBlocks);
    setSelectedBlockId(normalizedBlocks[0]?.id || "");
    setSelectedColumnId(normalizedBlocks.find((block) => block.tableConfig)?.tableConfig?.columns[0]?.id || "");
    setSelectedDocumentType(result.detectedDocumentType || "Statement of Account (SOA)");
    setTemplateName(fileName.replace(/\.[^.]+$/, " Smart Template"));
    resetRuntimeResults();
    setWorkspaceTab("builder");
    setRibbonTab("insert");
    setMergeMode("import");
    setStatusMessage(result.message || "Template imported. Review blocks, fields and formatting before saving.");
  }

  function simulateImport() {
    fileInputRef.current?.click();
  }

  async function importTemplateFile(event: ChangeEvent<HTMLInputElement>) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setApiBusy(true);
      setStatusMessage("Uploading and analyzing existing Word/PDF template...");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/document-studio/import-template", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Unable to import template.");
      applyImportedTemplate(result, file.name);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to import Word/PDF template.");
    } finally {
      setApiBusy(false);
      if (event.target) event.target.value = "";
    }
  }

  async function saveTemplate() {
    try {
      setApiBusy(true);
      setStatusMessage("Saving template to Document Studio...");

      const response = await fetch("/api/document-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeTemplateId || undefined,
          template_name: templateName,
          document_type: selectedDocumentType,
          template_status: "Draft",
          source_type: importDone ? "Imported Word/PDF" : "Created in VENTIQ",
          import_confidence: importDone ? importResult?.importConfidence ?? 87 : 0,
          layout_json: {
            page_size: "A4",
            orientation: "Portrait",
            margin_left_mm: pageSettings.marginLeft,
            margin_right_mm: pageSettings.marginRight,
            margin_top_mm: pageSettings.marginTop,
            margin_bottom_mm: pageSettings.marginBottom,
            show_grid: pageSettings.showGrid,
            show_rulers: pageSettings.showRulers,
            show_sample_values: pageSettings.showSampleValues,
            zoom: pageSettings.zoom,
          },
          blocks_json: blocks,
          field_mappings: {
            cell_fields: cellFields.map((field) => field.code),
            column_sources: columnSources.map((source) => ({
              id: source.id,
              label: source.label,
              fields: source.fields.map((field) => field.code),
            })),
            import_intelligence: importResult
              ? {
                  detected_document_type: importResult.detectedDocumentType,
                  import_confidence: importResult.importConfidence,
                  detected_fields: importResult.detectedFields ?? [],
                  detected_sections: importResult.detectedSections ?? [],
                  unmapped_items: importResult.unmappedItems ?? [],
                  storage: importResult.storage ?? null,
                }
              : null,
          },
          calculated_fields: calculatedFields,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save template.");

      if (result.template?.id) setActiveTemplateId(result.template.id);
      await loadSavedTemplates();
      setStatusMessage(result.message || `${templateName} saved as a smart template.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save Document Studio template.");
    } finally {
      setApiBusy(false);
    }
  }

  async function previewTemplate() {
    try {
      setApiBusy(true);
      setStatusMessage("Generating investor-wise preview from migrated data...");

      const response = await fetch("/api/document-studio/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: activeTemplateId || undefined,
          document_type: selectedDocumentType,
          investor_code: selectedInvestor.code,
          statement_period: "Q1 FY 2025-26",
          report_date: "30-Jun-2025",
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to generate preview.");
      setPreviewMergeData(result);
      setWorkspaceTab("preview");
      setStatusMessage(result.message || `Preview generated for ${result.investor?.investor_name || selectedInvestor.name}.`);
    } catch (error) {
      setPreviewMergeData(null);
      setWorkspaceTab("preview");
      setStatusMessage(error instanceof Error ? error.message : "Unable to generate investor preview.");
    } finally {
      setApiBusy(false);
    }
  }

  async function runBatch() {
  try {
    setApiBusy(true);
    setStatusMessage("Preparing batch generation queue...");

    const response = await fetch("/api/document-studio/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: activeTemplateId || undefined,
        document_type: selectedDocumentType,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to prepare batch.");
    }

    const queuedDocumentIds = (result.documents || [])
      .map((document: BatchDocumentRow) => document.id)
      .filter((id: string | undefined): id is string => Boolean(id));

    setBatchResult(result);
    setPdfGenerationResult(null);
    setPublishResult(null);
    setSelectedBatchDocumentIds(queuedDocumentIds);
    setWorkspaceTab("batch");

    setStatusMessage(
      result.message ||
        `Batch generation prepared. ${queuedDocumentIds.length} document(s) selected.`
    );
  } catch (error) {
    setBatchResult(null);
    setSelectedBatchDocumentIds([]);
    setWorkspaceTab("batch");
    setStatusMessage(
      error instanceof Error ? error.message : "Unable to prepare batch generation."
    );
  } finally {
    setApiBusy(false);
  }
}

async function generatePdfFiles(mode: "selected" | "failed" | "all" = "selected") {
  try {
    const batchId = batchResult?.batch?.id;

    if (!batchId) {
      setStatusMessage("Prepare a batch first before generating PDF files.");
      setWorkspaceTab("batch");
      return;
    }

    const allDocumentIds = batchDocuments
      .map((document) => document.id)
      .filter((id): id is string => Boolean(id));

    const selectedIds =
      mode === "all"
        ? allDocumentIds
        : mode === "failed"
        ? failedBatchDocumentIds
        : selectedBatchDocumentIds;

    if (allDocumentIds.length > 0 && selectedIds.length === 0) {
      setStatusMessage("Select at least one queued document before generating PDFs.");
      setWorkspaceTab("batch");
      return;
    }

    setApiBusy(true);

    setStatusMessage(
      mode === "failed"
        ? "Regenerating failed PDF files..."
        : mode === "all"
        ? "Generating all PDF files..."
        : "Generating selected PDF files..."
    );

    const response = await fetch("/api/document-studio/generate-pdfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batch_id: batchId,
        document_ids: selectedIds.length > 0 ? selectedIds : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate PDF files.");
    }

    setPdfGenerationResult(result);
    setWorkspaceTab("batch");

    setStatusMessage(
      result.message || "PDF files generated and uploaded successfully."
    );
  } catch (error) {
    setPdfGenerationResult(null);
    setWorkspaceTab("batch");
    setStatusMessage(
      error instanceof Error ? error.message : "Unable to generate PDF files."
    );
  } finally {
    setApiBusy(false);
  }
}

  async function publishQueue() {
    try {
      setWorkspaceTab("publish");
      const batchId = batchResult?.batch?.id;
      if (!batchId) {
        setStatusMessage("Prepare a batch first before publishing documents to Investor Portal.");
        return;
      }

      setApiBusy(true);
      setStatusMessage("Publishing generated document records to Investor Portal...");
      const response = await fetch("/api/document-studio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to publish documents.");
      setPublishResult(result);
      setStatusMessage(result.message || "Documents published to Investor Portal successfully.");
    } catch (error) {
      setPublishResult(null);
      setStatusMessage(error instanceof Error ? error.message : "Unable to publish documents to Investor Portal.");
    } finally {
      setApiBusy(false);
    }
  }

  function renderStart() {
    return (
      <div className="ids-start-screen">
        <div className="ids-start-hero">
          <p className="ids-eyebrow">VENTIQ Document Studio</p>
          <h1>How do you want to prepare this investor document?</h1>
          <p>
            Start from an existing Word/PDF, build a fresh AIF template using VENTIQ tools, or reuse a saved template from the library.
          </p>
        </div>

        <div className="ids-start-options">
          <button className="ids-start-card" onClick={simulateImport} type="button">
            <span>01</span>
            <strong>Upload existing Word/PDF</strong>
            <p>Import your existing SOA, capital call, Form 64C/64D or notice template. VENTIQ extracts sections and creates editable blocks.</p>
            <em>Best for client migration</em>
          </button>

          <button className="ids-start-card highlighted" onClick={() => startNewTemplate(true)} type="button">
            <span>02</span>
            <strong>Create new document</strong>
            <p>Use Insert, Layout, Table Tools, Chart Tools and Merge Fields to build a new template from scratch.</p>
            <em>Best for new fund templates</em>
          </button>

          <button className="ids-start-card" onClick={() => setWorkspaceTab("library")} type="button">
            <span>03</span>
            <strong>Use existing VENTIQ template</strong>
            <p>Open a saved draft or load a ready starter template and customize it for the client.</p>
            <em>Best for repeat use</em>
          </button>
        </div>

      <div className="ids-start-actions">
  <button className="ids-secondary-btn" onClick={() => startNewTemplate(false)} type="button">
    Load full SOA starter template
  </button>
  <button className="ids-secondary-btn" onClick={() => setWorkspaceTab("library")} type="button">
    Open Template Library
  </button>
</div>

<div className="ids-document-kit-section">
  <div>
    <p className="ids-eyebrow">Ready Document Kits</p>
    <h2>Create any AIF investor document from a preset</h2>
    <p>
      Each kit loads the right blocks, table sources, merge fields, notes and
      signature section for that document type.
    </p>
  </div>

  <div className="ids-document-kit-grid">
    {documentPresets.map((preset) => (
      <button
        className="ids-document-kit-card"
        key={preset.id}
        onClick={() => startDocumentPreset(preset)}
        type="button"
      >
        <span>{preset.documentType}</span>
        <strong>{preset.name}</strong>
        <p>{preset.description}</p>
        <em>{preset.bestFor}</em>
      </button>
    ))}
  </div>
</div>
      </div>
    );
  }

  function renderLibrary() {
    return (
      <div className="ids-library-layout">
        <div className="ids-library-hero">
          <div>
            <p className="ids-eyebrow">Template Library</p>
            <h2>Open a saved template or start from a ready VENTIQ template.</h2>
            <p>Saved templates preserve block order, table columns, mapped fields, notes, signatures, chart settings and formatting.</p>
          </div>
          <div className="ids-action-row">
            <button className="ids-secondary-btn" onClick={() => setWorkspaceTab("start")} type="button">
              Back to start
            </button>
            <button className="ids-primary-btn" onClick={() => startNewTemplate(false)} type="button">
              Use starter template
            </button>
          </div>
        </div>

        <div className="ids-template-grid">
          {savedTemplates.length === 0 && (
            <div className="ids-empty-card">
              <strong>No saved templates loaded yet</strong>
              <p>Create a new template or import a Word/PDF and save it. It will appear here.</p>
              <button className="ids-primary-btn" onClick={() => startNewTemplate(true)} type="button">
                Create new template
              </button>
            </div>
          )}

          {savedTemplates.map((template) => (
            <button className="ids-template-card" key={template.id} onClick={() => openSavedTemplate(template)} type="button">
              <span>{template.document_type || "AIF document"}</span>
              <strong>{template.template_name}</strong>
              <p>{template.source_type || "Created in VENTIQ"}</p>
              <em>{template.template_status || "Draft"}</em>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderRibbon() {
    if (ribbonTab === "home") {
      const style = { ...baseStyle, ...selectedBlock?.style };

      return (
        <div className="ids-ribbon-grid compact">
          <div className="ids-ribbon-group">
            <div className="ids-control-row">
              <button className={`ids-icon-btn ${style.bold ? "active" : ""}`} onClick={() => updateSelectedBlockStyle({ bold: !style.bold })} type="button">B</button>
              <button className={`ids-icon-btn ${style.italic ? "active" : ""}`} onClick={() => updateSelectedBlockStyle({ italic: !style.italic })} type="button">/</button>
              <button className={`ids-icon-btn ${style.underline ? "active" : ""}`} onClick={() => updateSelectedBlockStyle({ underline: !style.underline })} type="button">U</button>
            </div>
            <div className="ids-group-label">Text style</div>
          </div>

          <div className="ids-ribbon-group wide">
            <select className="ids-select" value={style.fontFamily} onChange={(event) => updateSelectedBlockStyle({ fontFamily: event.target.value as BlockStyle["fontFamily"] })}>
              <option value="inter">Inter / Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
            </select>
            <select className="ids-select" value={style.fontSize} onChange={(event) => updateSelectedBlockStyle({ fontSize: event.target.value as BlockStyle["fontSize"] })}>
              <option value="small">Small</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
            <div className="ids-group-label">Font</div>
          </div>

          <div className="ids-ribbon-group">
            <div className="ids-control-row">
              {(["left", "center", "right"] as BlockStyle["align"][]).map((align) => (
                <button key={align} className={`ids-icon-btn ${style.align === align ? "active" : ""}`} onClick={() => updateSelectedBlockStyle({ align })} type="button">
                  {align === "left" ? "←" : align === "center" ? "↔" : "→"}
                </button>
              ))}
            </div>
            <div className="ids-group-label">Alignment</div>
          </div>

          <div className="ids-ribbon-group wide">
            <select className="ids-select" value={style.numberFormat} onChange={(event) => updateSelectedBlockStyle({ numberFormat: event.target.value as BlockStyle["numberFormat"] })}>
              <option value="plain">Plain</option>
              <option value="currency">Currency</option>
              <option value="number">Number</option>
              <option value="percentage">Percentage</option>
              <option value="date">Date</option>
            </select>
            <button className="ids-soft-btn" onClick={() => addTableColumn("number")} type="button">+ Number column</button>
            <div className="ids-group-label">Number tools</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={duplicateSelectedBlock} type="button">⧉ Duplicate</button>
            <button className="ids-soft-btn danger" onClick={deleteSelectedBlock} type="button">× Delete</button>
            <div className="ids-group-label">Block</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "insert") {
      return (
        <div className="ids-ribbon-grid compact">
          <div className="ids-ribbon-group wide">
  <select
    className="ids-select"
    value={selectedDocumentPresetId}
    onChange={(event) => setSelectedDocumentPresetId(event.target.value)}
  >
    {documentPresets.map((preset) => (
      <option key={preset.id} value={preset.id}>
        {preset.name}
      </option>
    ))}
  </select>

  <button
    className="ids-soft-btn"
    disabled={!selectedDocumentPreset}
    onClick={() => {
      if (selectedDocumentPreset) {
        startDocumentPreset(selectedDocumentPreset);
      }
    }}
    type="button"
  >
    Load document kit
  </button>

  <div className="ids-group-label">Document Kits</div>
</div>
          <div className="ids-ribbon-group wide">
            <div className="ids-tile-row">
              <button onClick={() => addBlock("summary")} type="button">📋<span>Summary Table</span></button>
              <button onClick={() => addBlock("transactions")} type="button">⇄<span>Transactions</span></button>
              <button onClick={() => addBlock("financial")} type="button">📄<span>Financial</span></button>
              <button onClick={() => addBlock("performance")} type="button">↗<span>Metrics</span></button>
              <button onClick={() => addBlock("notes")} type="button">☰<span>Text / Notes</span></button>
              <button onClick={() => addBlock("signature")} type="button">✍<span>Signature</span></button>
            </div>
            <div className="ids-group-label">Insert AIF sections</div>
          </div>

          <div className="ids-ribbon-group">
            <div className="ids-tile-row small">
              <button onClick={() => addBlock("identity")} type="button">🪪<span>Identity</span></button>
              <button onClick={() => addBlock("letterhead")} type="button">▣<span>Letterhead</span></button>
              <button onClick={() => addBlock("chart")} type="button">📊<span>Chart</span></button>
            </div>
            <div className="ids-group-label">Header & media</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={() => startNewTemplate(true)} type="button">+ New template</button>
            <button className="ids-soft-btn" onClick={simulateImport} type="button">Import Word/PDF</button>
            <div className="ids-group-label">Template</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "layout") {
      return (
        <div className="ids-ribbon-grid compact">
          <div className="ids-ribbon-group wide">
            <div className="ids-margin-grid compact-margins">
              <label>Left<input type="number" value={pageSettings.marginLeft} onChange={(event) => updatePageSettings({ marginLeft: Number(event.target.value) })} /></label>
              <label>Right<input type="number" value={pageSettings.marginRight} onChange={(event) => updatePageSettings({ marginRight: Number(event.target.value) })} /></label>
              <label>Top<input type="number" value={pageSettings.marginTop} onChange={(event) => updatePageSettings({ marginTop: Number(event.target.value) })} /></label>
              <label>Bottom<input type="number" value={pageSettings.marginBottom} onChange={(event) => updatePageSettings({ marginBottom: Number(event.target.value) })} /></label>
            </div>
            <div className="ids-group-label">Margins mm</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" disabled={selectedBlockIndex <= 0} onClick={() => moveSelectedBlock("up")} type="button">↑ Move up</button>
            <button className="ids-soft-btn" disabled={selectedBlockIndex === -1 || selectedBlockIndex >= blocks.length - 1} onClick={() => moveSelectedBlock("down")} type="button">↓ Move down</button>
            <div className="ids-group-label">Order</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={() => updatePageSettings(basePageSettings)} type="button">Reset page</button>
            <button className="ids-soft-btn danger" onClick={deleteSelectedBlock} type="button">Delete block</button>
            <div className="ids-group-label">Page</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "view") {
      return (
        <div className="ids-ribbon-grid compact">
          <div className="ids-ribbon-group wide">
            <label className="ids-check-row"><input checked={pageSettings.showGrid} onChange={(event) => updatePageSettings({ showGrid: event.target.checked })} type="checkbox" /> Grid</label>
            <label className="ids-check-row"><input checked={pageSettings.showRulers} onChange={(event) => updatePageSettings({ showRulers: event.target.checked })} type="checkbox" /> Rulers</label>
            <label className="ids-check-row"><input checked={pageSettings.showSampleValues} onChange={(event) => updatePageSettings({ showSampleValues: event.target.checked })} type="checkbox" /> Sample values</label>
            <div className="ids-group-label">Show / hide</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={() => updatePageSettings({ zoom: Math.max(60, pageSettings.zoom - 10) })} type="button">− Zoom</button>
            <button className="ids-soft-btn" onClick={() => updatePageSettings({ zoom: Math.min(150, pageSettings.zoom + 10) })} type="button">+ Zoom</button>
            <strong>{pageSettings.zoom}%</strong>
            <div className="ids-group-label">Zoom</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "table") {
      if (!selectedTableConfig) {
        return (
          <div className="ids-ribbon-empty">
            <strong>Select Summary, Transaction or Financial table to use Table Tools.</strong>
            <button className="ids-soft-btn" onClick={() => addBlock("transactions")} type="button">Insert transaction table</button>
          </div>
        );
      }

      return (
        <div className="ids-ribbon-grid compact">
          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={() => updateSelectedTableConfig({ repeatRows: !selectedTableConfig.repeatRows })} type="button">
              {selectedTableConfig.repeatRows ? "Static Rows" : "Repeat Rows"}
            </button>
            <button className="ids-soft-btn" onClick={() => addTableColumn()} type="button">+ Column</button>
            <button className="ids-soft-btn" onClick={() => addTableColumn("number")} type="button">+ Number</button>
            <div className="ids-group-label">Rows & columns</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={mergeSelectedColumnWithNext} type="button">Merge with next</button>
            <button className="ids-soft-btn" onClick={splitSelectedColumn} type="button">Split column</button>
            <button className="ids-soft-btn danger" onClick={() => selectedColumnId && deleteTableColumn(selectedColumnId)} type="button">Delete column</button>
            <div className="ids-group-label">Selected column</div>
          </div>

          <div className="ids-ribbon-group wide">
            <select className="ids-select" value={selectedTableConfig.repeatSource} onChange={(event) => changeTableRepeatSource(event.target.value as TableBlockConfig["repeatSource"])}>
              {columnSources.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
            <div className="ids-group-label">Repeat source</div>
          </div>

          <div className="ids-ribbon-group">
            {(["all", "horizontal", "outer", "none"] as TableBlockConfig["borderPreset"][]).map((borderPreset) => (
              <button key={borderPreset} className={`ids-soft-btn ${selectedTableConfig.borderPreset === borderPreset ? "active-tool" : ""}`} onClick={() => updateSelectedTableConfig({ borderPreset })} type="button">
                {borderPreset}
              </button>
            ))}
            <div className="ids-group-label">Borders</div>
          </div>

          <div className="ids-ribbon-group">
            {(["gold", "dark", "light", "minimal"] as TableBlockConfig["headerStyle"][]).map((headerStyle) => (
              <button key={headerStyle} className={`ids-soft-btn ${selectedTableConfig.headerStyle === headerStyle ? "active-tool" : ""}`} onClick={() => updateSelectedTableConfig({ headerStyle })} type="button">
                {headerStyle}
              </button>
            ))}
            <div className="ids-group-label">Header</div>
          </div>
        </div>
      );
    }

    const chartConfig = selectedBlock?.kind === "chart" ? selectedBlock.chartConfig || createBlock("chart").chartConfig : null;

    return (
      <div className="ids-ribbon-grid compact">
        {!chartConfig && (
          <div className="ids-ribbon-empty">
            <strong>Select a chart block or insert a new chart.</strong>
            <button className="ids-soft-btn" onClick={() => addBlock("chart")} type="button">Insert chart</button>
          </div>
        )}

        {chartConfig && (
          <>
            <div className="ids-ribbon-group wide">
              <select className="ids-select" value={chartConfig.chartType} onChange={(event) => updateSelectedChartConfig({ chartType: event.target.value as ChartConfig["chartType"] })}>
                <option value="bar">Bar chart</option>
                <option value="line">Line chart</option>
                <option value="waterfall">Waterfall</option>
                <option value="donut">Donut</option>
              </select>
              <select className="ids-select" value={chartConfig.series} onChange={(event) => updateSelectedChartConfig({ series: event.target.value as ChartConfig["series"] })}>
                <option value="current_nav">Current NAV</option>
                <option value="distribution_amount">Distribution</option>
                <option value="tvpi">TVPI</option>
                <option value="irr">IRR</option>
              </select>
              <div className="ids-group-label">Chart design</div>
            </div>

            <div className="ids-ribbon-group wide">
              <input className="ids-select" value={chartConfig.title} onChange={(event) => updateSelectedChartConfig({ title: event.target.value })} />
              <div className="ids-group-label">Chart title</div>
            </div>
          </>
        )}
      </div>
    );
  }

  function getBlockClass(block: TemplateBlock) {
    const style = { ...baseStyle, ...block.style };
    return [
      "ids-doc-block",
      block.kind,
      block.id === selectedBlockId ? "selected" : "",
      `font-${style.fontFamily}`,
      `size-${style.fontSize}`,
      `align-${style.align}`,
      style.bold ? "is-bold" : "",
      style.italic ? "is-italic" : "",
      style.underline ? "is-underlined" : "",
    ].filter(Boolean).join(" ");
  }

  function renderTemplateBlock(block: TemplateBlock) {
    const tableConfig = block.tableConfig || (isConfigurableTableBlock(block) ? createTableConfig(getDefaultRepeatSourceForBlock(block)) : null);
    const chartConfig = block.chartConfig || (block.kind === "chart" ? { chartType: "bar", series: "current_nav", title: "Portfolio Movement Chart" } : null);

    return (
      <div
        className={getBlockClass(block)}
        key={block.id}
        onClick={() => {
          setSelectedBlockId(block.id);
          if (block.tableConfig?.columns?.[0]) setSelectedColumnId(block.tableConfig.columns[0].id);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="ids-block-tag">{block.title}</span>

        {block.kind === "letterhead" && (
          <div className="ids-letterhead">
            <div>
              <strong>{getInvestorValue(selectedInvestor, "fund_name")}</strong>
              <span>{block.content || "Registered AIF | GIFT City"}</span>
            </div>
            <div className="ids-logo-box">VENTIQ</div>
          </div>
        )}

        {block.kind === "identity" && (
          <div className="ids-identity-grid">
            <div><span>Investor</span><strong>{getInvestorValue(selectedInvestor, "investor_name")}</strong></div>
            <div><span>Folio</span><strong>{getInvestorValue(selectedInvestor, "investor_code")}</strong></div>
            <div><span>Statement period</span><strong>{getInvestorValue(selectedInvestor, "statement_period")}</strong></div>
            <div><span>Report date</span><strong>{getInvestorValue(selectedInvestor, "report_date")}</strong></div>
          </div>
        )}

        {tableConfig && (
          <table className={`ids-template-table table-border-${tableConfig.borderPreset} table-header-${tableConfig.headerStyle}`}>
            <thead>
              <tr>
                <th colSpan={tableConfig.columns.length}>{getTableTitle(block)}</th>
              </tr>
              <tr>
                {tableConfig.columns.map((column) => (
                  <th
                    className={`${column.align === "right" ? "right" : column.align === "center" ? "center" : ""} ${selectedColumnId === column.id ? "selected-column" : ""}`}
                    key={column.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedBlockId(block.id);
                      setSelectedColumnId(column.id);
                      setRibbonTab("table");
                      setStatusMessage(`${column.header} column selected. Use right panel or Table Tools to edit it.`);
                    }}
                    style={{ width: `${column.width}%` }}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tableConfig.repeatRows ? [0, 1, 2] : [0]).map((rowIndex) => (
                <tr key={`${block.id}-row-${rowIndex}`}>
                  {tableConfig.columns.map((column) => (
                    <td className={column.align === "right" ? "right" : column.align === "center" ? "center" : ""} key={`${block.id}-${rowIndex}-${column.id}`}>
                      {pageSettings.showSampleValues ? getSampleValueForTableField(column.fieldKey) : `{${column.fieldKey}}`}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td colSpan={tableConfig.columns.length}>
                  <span className="ids-repeat-pill">
                    {tableConfig.repeatRows ? "↻ Repeats from" : "Static table from"} {tableConfig.repeatSource} · {tableConfig.columns.length} mapped columns
                  </span>
                </td>
          </tr>
            </tbody>
          </table>
        )}

        {block.kind === "performance" && (
          <div className="ids-performance-grid">
            <div><span>DPI</span><strong>{getInvestorValue(selectedInvestor, "dpi")}</strong></div>
            <div><span>TVPI</span><strong>{getInvestorValue(selectedInvestor, "tvpi")}</strong></div>
            <div><span>IRR</span><strong>{getInvestorValue(selectedInvestor, "irr")}</strong></div>
            <div><span>Distribution</span><strong>{getInvestorValue(selectedInvestor, "distribution_amount")}</strong></div>
          </div>
        )}

        {block.kind === "chart" && chartConfig && (
          <div className={`ids-chart-box chart-${chartConfig.chartType}`}>
            <h4>{chartConfig.title}</h4>
            {chartConfig.chartType === "donut" ? (
              <div className="ids-donut"><span>{getInvestorValue(selectedInvestor, chartConfig.series)}</span></div>
            ) : chartConfig.chartType === "line" ? (
              <div className="ids-line-chart"><span /><span /><span /><span /></div>
            ) : (
              <div className="ids-bars">
                <span style={{ height: "48%" }} />
                <span style={{ height: "72%" }} />
                <span style={{ height: "58%" }} />
                <span style={{ height: "86%" }} />
              </div>
            )}
            <p>{`Series bind to {${chartConfig.series}}`}</p>
          </div>
        )}

        {block.kind === "notes" && (
          <div className="ids-note-block">
            {renderContentWithSampleValues(block.content || "This statement is generated based on the books and records of the Fund as on {report_date}.")}
          </div>
        )}

        {block.kind === "signature" && (
          <div className="ids-signature-block">
            <div>
              <strong>For {getInvestorValue(selectedInvestor, "fund_name")}</strong>
              <span>{block.content || "Authorized Signatory"}</span>
            </div>
            <div>
              <span>Generated on</span>
              <strong>{getInvestorValue(selectedInvestor, "generated_on")}</strong>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderBuilder() {
    return (
      <div className="ids-builder-shell">
        <div className="ids-page-sidebar">
          <button className="active" type="button">Page 1</button>
          <button onClick={() => setStatusMessage("Multi-page templates will be enabled after PDF rendering stabilizes.")} type="button">+ Page</button>
        </div>

        <div className="ids-canvas-wrap">
          {pageSettings.showRulers && <div className="ids-ruler-top" />}
          <div className={`ids-canvas-grid ${pageSettings.showGrid ? "show-grid" : ""}`}>
            <div
              className="ids-a4-page"
              style={{
                padding: `${pageSettings.marginTop}px ${pageSettings.marginRight}px ${pageSettings.marginBottom}px ${pageSettings.marginLeft}px`,
                transform: `scale(${pageSettings.zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              {blocks.length === 0 && (
                <div className="ids-empty-canvas">
                  <strong>Blank template</strong>
                  <p>Use the Insert tab to add Letterhead, Summary, Transactions, Metrics, Notes and Signature blocks.</p>
                </div>
              )}
              {blocks.map((block) => renderTemplateBlock(block))}
            </div>
          </div>
        </div>

        {renderMergePanel()}
      </div>
    );
  }

  function renderMergePanel() {
    return (
      <aside className="ids-merge-panel">
        <div className="ids-panel-header">
          <strong>MERGE FIELDS</strong>
          <span>{selectedBlock?.title ?? "No block selected"}</span>
        </div>

        <div className="ids-selected-context">
          <p>Selected block</p>
          <strong>{selectedBlock?.title ?? "No selection"}</strong>
          <span>{selectedBlock?.subtitle ?? "Select a block to configure."}</span>
        </div>

        {selectedBlock && (
          <div className="ids-block-editor">
            <label>
              Block title
              <input value={selectedBlock.title} onChange={(event) => updateSelectedBlock({ title: event.target.value })} placeholder="Enter block title" />
            </label>
            <label>
              Block description
              <textarea value={selectedBlock.subtitle} onChange={(event) => updateSelectedBlock({ subtitle: event.target.value })} placeholder="Enter block description" rows={2} />
            </label>
            {(selectedBlock.kind === "notes" || selectedBlock.kind === "signature" || selectedBlock.kind === "letterhead") && (
              <label>
                {selectedBlock.kind === "notes" ? "Notes content" : selectedBlock.kind === "signature" ? "Signature role" : "Letterhead subtitle"}
                <textarea value={selectedBlock.content || ""} onChange={(event) => updateSelectedBlock({ content: event.target.value })} placeholder="Enter editable content" rows={3} />
              </label>
            )}
          </div>
        )}

        <div className="ids-merge-tabs">
          <button className={mergeMode === "cell" ? "active" : ""} onClick={() => setMergeMode("cell")} type="button">Cell fields</button>
          <button className={mergeMode === "column" ? "active" : ""} onClick={() => setMergeMode("column")} type="button">Column fields</button>
          <button className={mergeMode === "calculated" ? "active" : ""} onClick={() => setMergeMode("calculated")} type="button">Calculated</button>
          <button className={mergeMode === "import" ? "active" : ""} onClick={() => setMergeMode("import")} type="button">Import AI</button>
        </div>

        {selectedTableConfig && (
          <div className="ids-field-panel">
            <div className="ids-panel-heading">
              <div>
                <p className="ids-eyebrow">Table Tools</p>
                <h3>Column mapping</h3>
              </div>
            </div>

            <label className="ids-form-label">
              Repeat source
              <select value={selectedTableConfig.repeatSource} onChange={(event) => changeTableRepeatSource(event.target.value as TableBlockConfig["repeatSource"])}>
                {columnSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
              </select>
            </label>

            <div className="ids-table-config-summary">
              <span>Rows: {selectedTableConfig.repeatRows ? "Repeat with investor data" : "Static rows"}</span>
              <span>Borders: {selectedTableConfig.borderPreset}</span>
              <span>Header: {selectedTableConfig.headerStyle}</span>
              <span>Selected column: {selectedColumn?.header || "Click a header"}</span>
            </div>

            <div className="ids-column-config-list">
              {selectedTableConfig.columns.map((column) => (
                <div className={`ids-column-config-card ${selectedColumnId === column.id ? "active" : ""}`} key={column.id} onClick={() => setSelectedColumnId(column.id)}>
                  <div className="ids-column-config-top">
                    <input value={column.header} onChange={(event) => updateSelectedTableColumn(column.id, { header: event.target.value })} />
                    <button onClick={() => deleteTableColumn(column.id)} type="button">Delete</button>
                  </div>

                  <label>
                    Field mapping
                    <select value={column.fieldKey} onChange={(event) => {
                      const selectedField = tableFieldOptions[selectedTableConfig.repeatSource].find((field) => field.value === event.target.value);
                      updateSelectedTableColumn(column.id, {
                        fieldKey: event.target.value,
                        format: selectedField?.format || column.format,
                        align: selectedField?.format === "currency" || selectedField?.format === "number" || selectedField?.format === "percentage" ? "right" : column.align,
                      });
                    }}>
                      {tableFieldOptions[selectedTableConfig.repeatSource].map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>
                  </label>

                  <div className="ids-column-config-grid">
                    <label>
                      Format
                      <select value={column.format} onChange={(event) => updateSelectedTableColumn(column.id, { format: event.target.value as TableColumnConfig["format"] })}>
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="currency">Currency</option>
                        <option value="number">Number</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </label>
                    <label>
                      Align
                      <select value={column.align} onChange={(event) => updateSelectedTableColumn(column.id, { align: event.target.value as TableColumnConfig["align"] })}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mergeMode === "cell" && (
          <div className="ids-panel-body">
            <input className="ids-search" placeholder="Search fields..." />
            <div className="ids-field-list">
              {cellFields.map((field) => (
                <button key={field.code} onClick={() => insertField(field)} type="button">
                  <span>{field.label}<small>{field.sample}</small></span>
                  <em>{field.type}</em>
                  <code>{`{${field.code}}`}</code>
                </button>
              ))}
            </div>
          </div>
        )}

        {mergeMode === "column" && (
          <div className="ids-panel-body">
            <p className="ids-muted">Map selected table column from source</p>
            <select className="ids-select full" value={selectedColumnSource} onChange={(event) => setSelectedColumnSource(event.target.value as TableBlockConfig["repeatSource"])}>
              {columnSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
            <div className="ids-source-card"><strong>{activeColumnSource.label}</strong><span>{activeColumnSource.description}</span></div>
            <div className="ids-field-list compact">
              {activeColumnSource.fields.map((field) => (
                <button key={field.code} onClick={() => insertField(field)} type="button">
                  <span>{field.label}<small>{field.sample}</small></span>
                  <code>{field.code}</code>
                </button>
              ))}
            </div>
            <div className="ids-explain">Click a table column header first, then click a field here to map it.</div>
          </div>
        )}

        {mergeMode === "calculated" && (
          <div className="ids-panel-body">
            <div className="ids-formula-box">
              <label>New calculated field</label>
              <input value={newCalculatedCode} onChange={(event) => setNewCalculatedCode(event.target.value)} placeholder="e.g. net_income" />
              <textarea value={newCalculatedFormula} onChange={(event) => setNewCalculatedFormula(event.target.value)} placeholder="Formula: gross_income - total_expenses - tds" rows={3} />
              <div className="ids-chip-row">
                {["+", "−", "×", "÷", "XIRR"].map((symbol) => (
                  <button key={symbol} onClick={() => setNewCalculatedFormula((current) => `${current} ${symbol} `)} type="button">{symbol}</button>
                ))}
              </div>
              <button className="ids-gold-btn full" onClick={saveCalculatedField} type="button">Save calculated field</button>
            </div>
            <div className="ids-field-list compact">
              {calculatedFields.map((field) => (
                <button key={field.code} onClick={() => insertField(field)} type="button">
                  <span>{field.label}<small>{field.sample}</small></span>
                  <em>{field.type}</em>
                  <code>{`{${field.code}}`}</code>
                </button>
              ))}
            </div>
          </div>
        )}

        {mergeMode === "import" && (
          <div className="ids-panel-body">
            <div className="ids-import-score"><strong>{importResult?.importConfidence !== undefined ? `${importResult.importConfidence}%` : importDone ? "87%" : "—"}</strong><span>Import confidence</span></div>
            <div className="ids-import-grid">
              <div><strong>{importResult?.suggestedBlocks?.length ?? (importDone ? blocks.length : 0)}</strong><span>Blocks detected</span></div>
              <div><strong>{importResult?.detectedFields?.length ?? 0}</strong><span>Fields detected</span></div>
              <div><strong>{importResult?.unmappedItems?.length ?? 0}</strong><span>Need review</span></div>
            </div>
            {importResult?.detectedSections && importResult.detectedSections.length > 0 && (
              <div className="ids-source-card"><strong>Detected sections</strong><span>{importResult.detectedSections.join(" · ")}</span></div>
            )}
            <button className="ids-primary-btn full" disabled={apiBusy} onClick={simulateImport} type="button">{apiBusy ? "Importing..." : "Import Word/PDF Template"}</button>
            <div className="ids-explain">Upload a client template to convert it into editable VENTIQ blocks. Formatting can then be refined using Home, Layout, Table and Chart tools.</div>
          </div>
        )}
      </aside>
    );
  }

  function renderPdfPreviewBlock(block: TemplateBlock) {
  const tableConfig =
    block.tableConfig ||
    (isConfigurableTableBlock(block)
      ? createTableConfig(getDefaultRepeatSourceForBlock(block))
      : null);

  const chartConfig =
    block.chartConfig ||
    (block.kind === "chart"
      ? {
          chartType: "bar" as const,
          series: "current_nav" as const,
          title: "Portfolio Movement Chart",
        }
      : null);

  return (
    <section
      className={`ids-generated-preview-block pdf-kind-${block.kind}`}
      key={`pdf-preview-${block.id}`}
    >
      {block.kind !== "letterhead" &&
        block.kind !== "identity" &&
        block.kind !== "signature" && (
          <div className="ids-generated-preview-heading">
            <h3>{block.title}</h3>
            {block.subtitle && <p>{block.subtitle}</p>}
          </div>
        )}

      {block.kind === "letterhead" && (
        <div className="ids-generated-preview-letterhead">
          <div>
            <h2>{getInvestorValue(selectedInvestor, "fund_name")}</h2>
            <p>{block.content || "Registered AIF | GIFT City"}</p>
          </div>
          <strong>VENTIQ</strong>
        </div>
      )}

      {block.kind === "identity" && (
        <div className="ids-generated-preview-identity">
          <div>
            <span>Investor Name</span>
            <strong>{getInvestorValue(selectedInvestor, "investor_name")}</strong>
          </div>

          <div>
            <span>Investor Code</span>
            <strong>{getInvestorValue(selectedInvestor, "investor_code")}</strong>
          </div>

          <div>
            <span>Investor Type</span>
            <strong>{getInvestorValue(selectedInvestor, "investor_type")}</strong>
          </div>

          <div>
            <span>Statement Period</span>
            <strong>{getInvestorValue(selectedInvestor, "statement_period")}</strong>
          </div>

          <div>
            <span>Report Date</span>
            <strong>{getInvestorValue(selectedInvestor, "report_date")}</strong>
          </div>
        </div>
      )}

      {tableConfig && (
        <table className="ids-generated-preview-table">
          <thead>
            <tr>
              <th colSpan={tableConfig.columns.length}>
                {getTableTitle(block)}
              </th>
            </tr>

            <tr>
              {tableConfig.columns.map((column) => (
                <th
                  className={
                    column.align === "right"
                      ? "right"
                      : column.align === "center"
                      ? "center"
                      : ""
                  }
                  key={`preview-${block.id}-${column.id}`}
                  style={{ width: `${column.width}%` }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(tableConfig.repeatRows ? [0, 1, 2] : [0]).map((rowIndex) => (
              <tr key={`preview-${block.id}-row-${rowIndex}`}>
                {tableConfig.columns.map((column) => (
                  <td
                    className={
                      column.align === "right"
                        ? "right"
                        : column.align === "center"
                        ? "center"
                        : ""
                    }
                    key={`preview-${block.id}-${rowIndex}-${column.id}`}
                  >
                    {pageSettings.showSampleValues
                      ? getSampleValueForTableField(column.fieldKey)
                      : `{${column.fieldKey}}`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {block.kind === "performance" && (
        <div className="ids-generated-preview-metrics">
          <div>
            <span>DPI</span>
            <strong>{getInvestorValue(selectedInvestor, "dpi")}</strong>
          </div>

          <div>
            <span>TVPI</span>
            <strong>{getInvestorValue(selectedInvestor, "tvpi")}</strong>
          </div>

          <div>
            <span>IRR</span>
            <strong>{getInvestorValue(selectedInvestor, "irr")}</strong>
          </div>

          <div>
            <span>Distribution</span>
            <strong>{getInvestorValue(selectedInvestor, "distribution_amount")}</strong>
          </div>
        </div>
      )}

      {block.kind === "chart" && chartConfig && (
        <div className="ids-generated-preview-chart">
          <h4>{chartConfig.title}</h4>

          <div className="ids-generated-preview-bars">
            <span style={{ height: "46%" }} />
            <span style={{ height: "72%" }} />
            <span style={{ height: "58%" }} />
            <span style={{ height: "86%" }} />
          </div>

          <p>{`Series: {${chartConfig.series}}`}</p>
        </div>
      )}

      {block.kind === "notes" && (
        <p className="ids-generated-preview-note">
          {renderContentWithSampleValues(
            block.content ||
              "This statement is generated based on the books and records of the Fund as on {report_date}."
          )}
        </p>
      )}

      {block.kind === "signature" && (
        <div className="ids-generated-preview-signature">
          <div>
            <strong>For {getInvestorValue(selectedInvestor, "fund_name")}</strong>
            <span>{block.content || "Authorized Signatory"}</span>
          </div>

          <div>
            <span>Generated on</span>
            <strong>{getInvestorValue(selectedInvestor, "generated_on")}</strong>
          </div>
        </div>
      )}
    </section>
  );
}

function renderPreview() {
  return (
    <div className="ids-preview-layout">
      <div className="ids-preview-toolbar">
        <div>
          <p className="ids-eyebrow">PDF-compatible preview</p>
          <h2>{selectedDocumentType}</h2>
          <p>
            Previewing {templateName} for{" "}
            {previewMergeData?.investor?.investor_name || selectedInvestor.name}.
            This view removes builder-only controls so it is closer to the generated PDF.
          </p>
        </div>

        <div className="ids-action-row">
          <button
            className="ids-secondary-btn"
            onClick={() => setWorkspaceTab("builder")}
            type="button"
          >
            Back to Builder
          </button>

          <button
            className="ids-secondary-btn"
            disabled={apiBusy}
            onClick={previewTemplate}
            type="button"
          >
            Refresh Preview Data
          </button>

          <button
            className="ids-primary-btn"
            disabled={apiBusy}
            onClick={runBatch}
            type="button"
          >
            Generate Batch
          </button>
        </div>
      </div>

      <div className="ids-generated-preview-wrap">
        <div className="ids-generated-preview-page">
          {blocks.length === 0 ? (
            <div className="ids-empty-canvas">
              <strong>No blocks available</strong>
              <p>Go back to Builder and add sections before previewing.</p>
            </div>
          ) : (
            blocks.map((block) => renderPdfPreviewBlock(block))
          )}
        </div>
      </div>
    </div>
  );
}


 function renderBatch() {
  const generatedCount = pdfGenerationResult?.generatedDocuments ?? 0;
  const failedCount = pdfGenerationResult?.failedDocuments ?? 0;
  const queuedCount = batchResult?.queuedDocuments ?? batchDocuments.length;
  const selectedCount = selectedBatchDocumentIds.length;

  return (
    <div className="ids-workflow-page">
      <div className="ids-library-hero">
        <div>
          <p className="ids-eyebrow">Batch Generation</p>
          <h2>Generate investor-wise documents from this template.</h2>
          <p>
            Current template: {templateName}. Select investors, generate PDFs,
            and regenerate failed documents if required.
          </p>
        </div>

        <div className="ids-action-row">
          <button
            className="ids-secondary-btn"
            onClick={() => setWorkspaceTab("builder")}
            type="button"
          >
            Back to Builder
          </button>

          <button
            className="ids-secondary-btn"
            disabled={apiBusy}
            onClick={runBatch}
            type="button"
          >
            Refresh Queue
          </button>

          <button
            className="ids-primary-btn"
            disabled={apiBusy || !batchResult?.batch?.id}
            onClick={() => generatePdfFiles("selected")}
            type="button"
          >
            Generate Selected
          </button>
        </div>
      </div>

      <div className="ids-batch-grid">
        <div>
          <strong>{batchResult?.batch?.total_investors ?? investors.length}</strong>
          <span>Total investors</span>
        </div>

        <div>
          <strong>{queuedCount}</strong>
          <span>Queued documents</span>
        </div>

        <div>
          <strong>{selectedCount}</strong>
          <span>Selected</span>
        </div>

        <div>
          <strong>{generatedCount}</strong>
          <span>Generated PDFs</span>
        </div>

        <div>
          <strong>{failedCount}</strong>
          <span>Failed</span>
        </div>
      </div>

      <div className="ids-action-row ids-batch-actions">
        <button
          className="ids-secondary-btn"
          disabled={apiBusy || batchDocuments.length === 0}
          onClick={selectAllBatchDocuments}
          type="button"
        >
          Select All
        </button>

        <button
          className="ids-secondary-btn"
          disabled={apiBusy || selectedBatchDocumentIds.length === 0}
          onClick={clearBatchSelection}
          type="button"
        >
          Clear Selection
        </button>

        <button
          className="ids-secondary-btn"
          disabled={apiBusy || failedBatchDocumentIds.length === 0}
          onClick={selectFailedBatchDocuments}
          type="button"
        >
          Select Failed
        </button>

        <button
          className="ids-secondary-btn"
          disabled={apiBusy || failedBatchDocumentIds.length === 0}
          onClick={() => generatePdfFiles("failed")}
          type="button"
        >
          Regenerate Failed
        </button>

        <button
          className="ids-secondary-btn"
          disabled={apiBusy || batchDocuments.length === 0}
          onClick={() => generatePdfFiles("all")}
          type="button"
        >
          Generate All
        </button>
      </div>

      {batchDocuments.length === 0 && (
        <div className="ids-empty-card">
          <strong>No batch queue loaded</strong>
          <p>
            Click Generate Batch from Preview or Refresh Queue here to prepare
            investor-wise documents.
          </p>
          <button className="ids-primary-btn" onClick={runBatch} type="button">
            Prepare Batch Queue
          </button>
        </div>
      )}

      {batchDocuments.length > 0 && (
        <div className="ids-publish-grid">
          {batchDocuments.map((document) => {
            const documentId = document.id || "";
            const isSelected = selectedBatchDocumentIds.includes(documentId);
            const status = document.generation_status || "Ready";

            return (
              <div
                className={`ids-publish-card ${
                  isSelected ? "ids-batch-card-selected" : ""
                }`}
                key={`${document.investor_code}-${document.file_name}-${document.id}`}
              >
                <label className="ids-batch-check-row">
                  <input
                    checked={isSelected}
                    disabled={!documentId}
                    onChange={() => toggleBatchDocumentSelection(documentId)}
                    type="checkbox"
                  />
                  <span>{isSelected ? "Selected" : "Not selected"}</span>
                </label>

                <strong>{document.investor_name || "Investor"}</strong>
                <span>{document.investor_code || "Investor code pending"}</span>
                <p>{document.file_name || document.document_name || templateName}</p>
                <em>{status}</em>

                {document.file_url && (
                  <a href={document.file_url} target="_blank">
                    Open PDF
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

  function renderPublish() {
  const generatedPdfCards = pdfGenerationResult?.documents ?? [];
  const generatedCount =
    pdfGenerationResult?.generatedDocuments ?? generatedPdfCards.length;
  const failedCount = pdfGenerationResult?.failedDocuments ?? 0;
  const publishedCount = publishResult?.publishedDocuments ?? 0;

  return (
    <div className="ids-workflow-page">
      <div className="ids-library-hero">
        <div>
          <p className="ids-eyebrow">Publish Queue</p>
          <h2>Publish generated investor documents to Investor Portal.</h2>
          <p>
            {publishResult
              ? `${publishedCount} documents published to Investor Portal.`
              : generatedCount > 0
              ? `${generatedCount} generated PDFs are ready for portal publishing.`
              : "Generate PDFs first, then publish them to Investor Portal."}
          </p>
        </div>

        <div className="ids-action-row">
          <button
            className="ids-secondary-btn"
            onClick={() => setWorkspaceTab("batch")}
            type="button"
          >
            Back to Batch
          </button>

          <button
            className="ids-primary-btn"
            disabled={apiBusy || !batchResult?.batch?.id}
            onClick={publishQueue}
            type="button"
          >
            {apiBusy ? "Publishing..." : "Publish to Portal"}
          </button>

          <button
            className="ids-secondary-btn"
            onClick={() => {
              window.location.href = "/investor-portal";
            }}
            type="button"
          >
            Open Investor Portal
          </button>
        </div>
      </div>

      <div className="ids-batch-grid">
        <div>
          <strong>{batchResult?.batch?.total_investors ?? investors.length}</strong>
          <span>Total investors</span>
        </div>
        <div>
          <strong>{generatedCount}</strong>
          <span>Generated PDFs</span>
        </div>
        <div>
          <strong>{failedCount}</strong>
          <span>Failed</span>
        </div>
        <div>
          <strong>{publishedCount}</strong>
          <span>Published to portal</span>
        </div>
      </div>

      {generatedPdfCards.length === 0 ? (
        <div className="ids-empty-card">
          <strong>No generated PDFs available in this browser session</strong>
          <p>
            Go back to Batch Generation, generate PDFs, and then return here to
            publish them to the Investor Portal.
          </p>
          <button
            className="ids-primary-btn"
            onClick={() => setWorkspaceTab("batch")}
            type="button"
          >
            Go to Batch Generation
          </button>
        </div>
      ) : (
        <div className="ids-publish-grid">
          {generatedPdfCards.map((document) => (
            <div
              className="ids-publish-card"
              key={`${document.investor_code}-${document.file_name}`}
            >
              <strong>{document.investor_name || "Investor"}</strong>
              <span>{document.investor_code || "Investor code"}</span>
              <p>{document.file_name}</p>
              <em>
                {publishResult ? "Published to Portal" : "Generated PDF ready"}
              </em>

              {document.file_url && (
                <a href={document.file_url} target="_blank">
                  Open PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

  return (
    <main className="ids-page">
      <div className="ids-shell">
        <input ref={fileInputRef} type="file" accept=".docx,.pdf" onChange={importTemplateFile} style={{ display: "none" }} />

        <div className="ids-workspace-tabs">
          <button className={workspaceTab === "start" ? "active" : ""} onClick={() => setWorkspaceTab("start")} type="button">Start</button>
          <button className={workspaceTab === "library" ? "active" : ""} onClick={() => setWorkspaceTab("library")} type="button">Template Library</button>
          <button className={workspaceTab === "builder" ? "active" : ""} onClick={() => setWorkspaceTab("builder")} type="button">Template Builder</button>
          <button className={workspaceTab === "preview" ? "active" : ""} onClick={previewTemplate} type="button">PDF Preview</button>
          <button className={workspaceTab === "batch" ? "active" : ""} onClick={runBatch} type="button">Batch Generation</button>
          <button className={workspaceTab === "publish" ? "active" : ""} onClick={publishQueue} type="button">Publish Queue</button>
        </div>

        {workspaceTab === "start" && renderStart()}
        {workspaceTab === "library" && renderLibrary()}

        {workspaceTab === "builder" && (
          <div className="ids-studio-frame">
            <div className="ids-title-bar">
              <div className="ids-undo-group">
                <button onClick={() => setStatusMessage("Undo will be connected to version history later.")} type="button">↶</button>
                <button onClick={() => setStatusMessage("Redo will be connected to version history later.")} type="button">↷</button>
              </div>

              <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              <button className="ids-primary-btn" disabled={apiBusy} onClick={saveTemplate} type="button">{apiBusy ? "Working..." : "Save"}</button>
              <button className="ids-primary-btn" disabled={apiBusy} onClick={previewTemplate} type="button">{apiBusy ? "Working..." : "Preview"}</button>
              <span>Preview as</span>
              <select value={selectedInvestorId} onChange={(event) => setSelectedInvestorId(event.target.value)}>
                {investors.map((investor) => <option key={investor.id} value={investor.id}>{investor.name}</option>)}
              </select>
              <select value={selectedDocumentType} onChange={(event) => setSelectedDocumentType(event.target.value)}>
                {documentTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <button onClick={() => startNewTemplate(true)} type="button">New</button>
              <button onClick={simulateImport} type="button">Import Word/PDF</button>
              <button onClick={() => setWorkspaceTab("library")} type="button">Open</button>
            </div>

            <div className="ids-ribbon-tabs">
              {(["home", "insert", "layout", "view", "table", "chart"] as RibbonTab[]).map((tab) => (
                <button className={ribbonTab === tab ? "active" : ""} key={tab} onClick={() => setRibbonTab(tab)} type="button">
                  {tab === "home" ? "Home" : tab === "insert" ? "Insert" : tab === "layout" ? "Layout" : tab === "view" ? "View" : tab === "table" ? "Table Tools" : "Chart Tools"}
                </button>
              ))}
            </div>

            <div className="ids-ribbon-content">{renderRibbon()}</div>
            {renderBuilder()}

            <div className="ids-status-bar">
              <span>Page 1 of 1</span>
              <span>{selectedBlock?.title ?? "No block selected"}</span>
              <span>{statusMessage}</span>
              <div>
                <button onClick={() => updatePageSettings({ zoom: Math.max(60, pageSettings.zoom - 10) })} type="button">−</button>
                <input type="range" min="60" max="150" value={pageSettings.zoom} onChange={(event) => updatePageSettings({ zoom: Number(event.target.value) })} />
                <button onClick={() => updatePageSettings({ zoom: Math.min(150, pageSettings.zoom + 10) })} type="button">+</button>
                <strong>{pageSettings.zoom}%</strong>
              </div>
            </div>
          </div>
        )}

        {workspaceTab === "preview" && renderPreview()}
        {workspaceTab === "batch" && renderBatch()}
        {workspaceTab === "publish" && renderPublish()}
      </div>

      <style>{`
        .ids-page {
          min-height: 100vh;
          background: #f5f2ea;
          color: #0b1833;
          padding: 14px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ids-shell {
          max-width: 1600px;
          margin: 0 auto;
        }

        .ids-eyebrow {
          color: #9a7312;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin: 0 0 8px;
        }

        .ids-workspace-tabs {
          display: inline-flex;
          background: #fffaf1;
          border: 1px solid #e1d6bd;
          border-radius: 14px;
          padding: 5px;
          gap: 4px;
          margin-bottom: 10px;
          overflow-x: auto;
          max-width: 100%;
        }

        .ids-workspace-tabs button {
          border: 0;
          background: transparent;
          padding: 9px 14px;
          border-radius: 10px;
          color: #475569;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .ids-workspace-tabs button.active {
          background: #9a7312;
          color: white;
        }

        .ids-start-screen,
        .ids-library-layout,
        .ids-workflow-page,
        .ids-preview-layout {
          border: 1px solid #e0d4bd;
          background: #fffdf8;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        }

        .ids-start-hero h1,
        .ids-library-hero h2,
        .ids-preview-toolbar h2 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .ids-start-hero p,
        .ids-library-hero p,
        .ids-preview-toolbar p {
          color: #64748b;
          line-height: 1.55;
          max-width: 860px;
        }

        .ids-start-options,
        .ids-template-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .ids-start-card,
        .ids-template-card,
        .ids-empty-card {
          text-align: left;
          border: 1px solid #e4dac9;
          background: #fffaf1;
          border-radius: 18px;
          padding: 20px;
          cursor: pointer;
          color: inherit;
          min-height: 220px;
        }

        .ids-start-card.highlighted {
          background: #091b3c;
          color: white;
        }

        .ids-start-card span,
        .ids-template-card span {
          color: #b48314;
          font-weight: 900;
          font-size: 12px;
        }

        .ids-start-card strong,
        .ids-template-card strong,
        .ids-empty-card strong {
          display: block;
          font-size: 20px;
          margin: 10px 0;
        }

        .ids-start-card p,
        .ids-template-card p,
        .ids-empty-card p {
          color: #64748b;
          line-height: 1.5;
        }

        .ids-start-card.highlighted p {
          color: #cbd5e1;
        }

        .ids-start-card em,
        .ids-template-card em {
          display: inline-block;
          margin-top: 12px;
          color: #9a7312;
          font-style: normal;
          font-weight: 900;
        }

        .ids-start-actions,
        .ids-action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .ids-library-hero,
        .ids-preview-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .ids-studio-frame {
          height: calc(100vh - 74px);
          display: flex;
          flex-direction: column;
          border: 1px solid #e0d4bd;
          background: #fffaf3;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        }

        .ids-title-bar {
          display: grid;
          grid-template-columns: auto minmax(180px, 260px) auto auto auto minmax(150px, 220px) minmax(170px, 280px) auto auto auto;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid #e6dcc9;
          background: #fbf7ef;
          overflow-x: auto;
        }

        .ids-title-bar input,
        .ids-title-bar select,
        .ids-select,
        .ids-search,
        .ids-formula-box input,
        .ids-formula-box textarea,
        .ids-block-editor input,
        .ids-block-editor textarea,
        .ids-column-config-card input,
        .ids-column-config-card select,
        .ids-form-label select,
        .ids-margin-grid input {
          border: 1px solid #c8b995;
          background: white;
          border-radius: 10px;
          padding: 9px 10px;
          color: #111827;
          font: inherit;
          min-width: 0;
        }

        .ids-title-bar button,
        .ids-primary-btn,
        .ids-secondary-btn,
        .ids-gold-btn {
          border: 0;
          background: #071a3a;
          color: white;
          border-radius: 10px;
          padding: 9px 13px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .ids-secondary-btn {
          background: #fffaf1;
          color: #071a3a;
          border: 1px solid #d8caa9;
        }

        .ids-primary-btn:disabled,
        .ids-title-bar button:disabled,
        .ids-soft-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .ids-undo-group {
          display: flex;
          gap: 4px;
        }

        .ids-ribbon-tabs {
          display: flex;
          gap: 4px;
          padding: 6px 12px 0;
          background: #fbf7ef;
          overflow-x: auto;
        }

        .ids-ribbon-tabs button {
          border: 0;
          background: transparent;
          padding: 9px 13px;
          border-radius: 10px 10px 0 0;
          font-weight: 900;
          color: #64748b;
          cursor: pointer;
          white-space: nowrap;
        }

        .ids-ribbon-tabs button.active {
          background: white;
          color: #071a3a;
          border: 1px solid #eadfc9;
          border-bottom: 0;
        }

        .ids-ribbon-content {
          background: white;
          border-top: 1px solid #eadfc9;
          border-bottom: 1px solid #e6dcc9;
          padding: 8px 12px;
          min-height: 82px;
          overflow-x: auto;
        }

        .ids-ribbon-grid {
          display: grid;
          grid-template-columns: repeat(5, max-content);
          gap: 8px;
          align-items: stretch;
        }

        .ids-ribbon-grid.compact {
          grid-auto-flow: column;
          grid-auto-columns: max-content;
        }

        .ids-ribbon-group,
        .ids-ribbon-empty {
          border: 1px solid #eadfc9;
          border-radius: 12px;
          padding: 8px;
          min-width: 120px;
          display: grid;
          gap: 7px;
          align-content: start;
          background: #fffdf8;
        }

        .ids-ribbon-group.wide {
          min-width: 250px;
        }

        .ids-group-label {
          font-size: 10px;
          color: #8a7650;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
        }

        .ids-control-row,
        .ids-tile-row,
        .ids-chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .ids-icon-btn,
        .ids-soft-btn,
        .ids-tile-row button,
        .ids-chip-row button {
          border: 1px solid #d8caa9;
          background: #fffaf1;
          color: #071a3a;
          border-radius: 10px;
          padding: 8px 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .ids-icon-btn.active,
        .ids-soft-btn.active-tool {
          background: #b48314;
          color: #ffffff;
          border-color: #b48314;
        }

        .ids-soft-btn.danger {
          border-color: rgba(185, 28, 28, 0.3);
          color: #991b1b;
          background: #fff1f2;
        }

        .ids-tile-row button {
          display: grid;
          justify-items: center;
          gap: 2px;
          min-width: 78px;
        }

        .ids-tile-row.small button {
          min-width: 72px;
        }

        .ids-check-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #334155;
          font-weight: 800;
        }

        .ids-margin-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(58px, 1fr));
          gap: 6px;
        }

        .ids-margin-grid label {
          display: grid;
          gap: 4px;
          font-size: 11px;
          color: #64748b;
          font-weight: 800;
        }

        .ids-builder-shell {
          min-height: 0;
          flex: 1;
          display: grid;
          grid-template-columns: 86px minmax(600px, 1fr) 370px;
          overflow: hidden;
        }

        .ids-page-sidebar {
          background: #f8f2e7;
          border-right: 1px solid #e6dcc9;
          padding: 12px 8px;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .ids-page-sidebar button {
          border: 1px solid #d8caa9;
          border-radius: 10px;
          background: white;
          padding: 10px 6px;
          font-weight: 900;
          cursor: pointer;
        }

        .ids-page-sidebar button.active {
          border-color: #9a7312;
          color: #9a7312;
        }

        .ids-canvas-wrap {
          min-width: 0;
          overflow: auto;
          background: #efe8da;
        }

        .ids-ruler-top {
          height: 18px;
          background: repeating-linear-gradient(90deg, #e2d8c5 0 1px, transparent 1px 22px), #f7f1e7;
          border-bottom: 1px solid #ded4bf;
        }

        .ids-canvas-grid {
          min-height: 100%;
          padding: 24px 30px 80px;
          display: flex;
          justify-content: center;
        }

        .ids-canvas-grid.show-grid {
          background-image: linear-gradient(rgba(154, 115, 18, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(154, 115, 18, 0.08) 1px, transparent 1px);
          background-size: 18px 18px;
        }

        .ids-a4-page,
        .ids-pdf-page {
          width: 720px;
          min-height: 1018px;
          background: white;
          color: #0f172a;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ids-pdf-page {
          margin: 0 auto;
          padding: 36px;
        }

        .ids-empty-canvas {
          border: 1px dashed #c8b995;
          border-radius: 14px;
          padding: 24px;
          text-align: center;
          color: #64748b;
        }

        .ids-doc-block {
          position: relative;
          border: 1px solid transparent;
          padding: 14px;
          border-radius: 12px;
          cursor: pointer;
        }

        .ids-doc-block:hover,
        .ids-doc-block.selected {
          border-color: #b48314;
          background: rgba(180, 131, 20, 0.04);
        }

        .ids-block-tag {
          position: absolute;
          top: -9px;
          left: 12px;
          background: #fff7e6;
          color: #9a7312;
          border: 1px solid #eadfc9;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 900;
        }

        .font-serif { font-family: Georgia, "Times New Roman", serif; }
        .font-mono { font-family: "SFMono-Regular", Consolas, monospace; }
        .size-small { font-size: 12px; }
        .size-normal { font-size: 14px; }
        .size-large { font-size: 16px; }
        .align-center { text-align: center; }
        .align-right { text-align: right; }
        .is-bold { font-weight: 800; }
        .is-italic { font-style: italic; }
        .is-underlined { text-decoration: underline; }

        .ids-letterhead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #b48314;
          padding-bottom: 12px;
        }

        .ids-letterhead strong {
          display: block;
          font-size: 20px;
        }

        .ids-letterhead span,
        .ids-signature-block span,
        .ids-identity-grid span,
        .ids-performance-grid span {
          display: block;
          color: #64748b;
          margin-top: 4px;
        }

        .ids-logo-box {
          border: 2px solid #071a3a;
          color: #071a3a;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .ids-identity-grid,
        .ids-performance-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .ids-identity-grid div,
        .ids-performance-grid div {
          border: 1px solid #e2d8c5;
          border-radius: 10px;
          padding: 10px;
          background: #fffdf8;
        }

        .ids-template-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          background: white;
        }

        .ids-template-table th,
        .ids-template-table td {
          border: 1px solid #d6d0c4;
          padding: 8px;
          text-align: left;
        }

        .ids-template-table th.right,
        .ids-template-table td.right { text-align: right; }
        .ids-template-table th.center,
        .ids-template-table td.center { text-align: center; }

        .ids-template-table th.selected-column {
          outline: 3px solid rgba(180, 131, 20, 0.28);
          background: #fff4d2 !important;
        }

        .table-header-gold thead tr:first-child th,
        .table-header-gold thead tr:nth-child(2) th { background: #b48314; color: white; }
        .table-header-dark thead tr:first-child th,
        .table-header-dark thead tr:nth-child(2) th { background: #071a3a; color: white; }
        .table-header-light thead tr:first-child th,
        .table-header-light thead tr:nth-child(2) th { background: #f8f2e7; color: #0f172a; }
        .table-header-minimal thead tr:first-child th,
        .table-header-minimal thead tr:nth-child(2) th { background: white; color: #0f172a; }
        .table-border-horizontal th,
        .table-border-horizontal td { border-left: 0; border-right: 0; }
        .table-border-outer th,
        .table-border-outer td { border: 0; border-bottom: 1px solid #e2d8c5; }
        .table-border-none th,
        .table-border-none td { border: 0; }

        .ids-repeat-pill {
          display: inline-block;
          color: #9a7312;
          font-weight: 900;
          font-size: 11px;
        }

        .ids-note-block {
          border-left: 4px solid #9a7312;
          background: #fff8e8;
          padding: 14px;
          color: #334155;
          line-height: 1.55;
        }

        .ids-signature-block {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #d6d0c4;
        }

        .ids-chart-box {
          border: 1px solid #e2d8c5;
          border-radius: 14px;
          padding: 16px;
          background: #fffdf8;
        }

        .ids-chart-box h4 {
          margin: 0 0 12px;
        }

        .ids-bars {
          height: 130px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 22px;
          margin: 10px 0;
        }

        .ids-bars span {
          display: block;
          width: 48px;
          background: #1f5fa8;
          border-radius: 8px 8px 0 0;
        }

        .chart-waterfall .ids-bars span:nth-child(2),
        .chart-waterfall .ids-bars span:nth-child(4) {
          background: #9a7312;
        }

        .ids-line-chart {
          height: 140px;
          position: relative;
          background: linear-gradient(180deg, transparent 24%, #e2d8c5 25%, transparent 26%, transparent 49%, #e2d8c5 50%, transparent 51%, transparent 74%, #e2d8c5 75%, transparent 76%);
        }

        .ids-line-chart span {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #1f5fa8;
        }

        .ids-line-chart span:nth-child(1) { left: 12%; top: 62%; }
        .ids-line-chart span:nth-child(2) { left: 36%; top: 42%; }
        .ids-line-chart span:nth-child(3) { left: 60%; top: 52%; }
        .ids-line-chart span:nth-child(4) { left: 84%; top: 24%; }

        .ids-donut {
          width: 150px;
          height: 150px;
          border-radius: 999px;
          margin: 10px auto;
          background: conic-gradient(#1f5fa8 0 62%, #b48314 62% 82%, #e2d8c5 82% 100%);
          display: grid;
          place-items: center;
        }

        .ids-donut span {
          width: 88px;
          height: 88px;
          border-radius: 999px;
          background: white;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .ids-merge-panel {
          background: #fffdf8;
          border-left: 1px solid #e2d8c5;
          overflow: auto;
        }

        .ids-panel-header {
          padding: 14px;
          border-bottom: 1px solid #e2d8c5;
        }

        .ids-panel-header strong {
          color: #9a7312;
          font-size: 12px;
          letter-spacing: 0.08em;
        }

        .ids-panel-header span {
          display: block;
          color: #64748b;
          margin-top: 4px;
        }

        .ids-selected-context,
        .ids-field-panel,
        .ids-panel-body,
        .ids-block-editor {
          margin: 12px;
          padding: 12px;
          border: 1px solid #eadfc9;
          border-radius: 14px;
          background: white;
        }

        .ids-selected-context p,
        .ids-muted {
          margin: 0 0 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .ids-selected-context strong {
          display: block;
        }

        .ids-selected-context span {
          display: block;
          color: #64748b;
          margin-top: 4px;
          font-size: 12px;
        }

        .ids-block-editor {
          display: grid;
          gap: 10px;
        }

        .ids-block-editor label,
        .ids-form-label,
        .ids-column-config-card label,
        .ids-formula-box label {
          display: grid;
          gap: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .ids-block-editor textarea {
          resize: vertical;
        }

        .ids-merge-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          margin: 12px;
          background: #f8f2e7;
          border-radius: 12px;
          padding: 4px;
        }

        .ids-merge-tabs button {
          border: 0;
          background: transparent;
          color: #64748b;
          border-radius: 9px;
          padding: 8px 4px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ids-merge-tabs button.active {
          background: #071a3a;
          color: white;
        }

        .ids-table-config-summary,
        .ids-import-grid,
        .ids-batch-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin: 12px 0;
        }

        .ids-table-config-summary span,
        .ids-import-grid div,
        .ids-batch-grid div {
          background: #fffaf1;
          border: 1px solid #eadfc9;
          border-radius: 10px;
          padding: 9px;
          font-size: 12px;
          color: #475569;
        }

        .ids-column-config-list,
        .ids-field-list {
          display: grid;
          gap: 8px;
        }

        .ids-column-config-card {
          border: 1px solid #e2d8c5;
          border-radius: 12px;
          padding: 10px;
          background: #fffdf8;
        }

        .ids-column-config-card.active {
          border-color: #b48314;
          box-shadow: 0 0 0 3px rgba(180, 131, 20, 0.12);
        }

        .ids-column-config-top,
        .ids-column-config-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .ids-column-config-grid {
          grid-template-columns: 1fr 1fr;
          margin-top: 8px;
        }

        .ids-column-config-top button {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .ids-field-list button {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          text-align: left;
          border: 1px solid #e2d8c5;
          background: #fffaf1;
          border-radius: 12px;
          padding: 10px;
          cursor: pointer;
          color: #0f172a;
        }

        .ids-field-list button small,
        .ids-field-list code,
        .ids-field-list em {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
          font-style: normal;
        }

        .ids-source-card,
        .ids-explain,
        .ids-import-score {
          background: #fffaf1;
          border: 1px solid #eadfc9;
          border-radius: 12px;
          padding: 12px;
          margin: 10px 0;
          color: #475569;
          line-height: 1.45;
        }

        .ids-import-score strong {
          display: block;
          font-size: 30px;
          color: #071a3a;
        }

        .ids-formula-box {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .full {
          width: 100%;
        }

        .ids-status-bar {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 8px 12px;
          border-top: 1px solid #e6dcc9;
          background: #fbf7ef;
          color: #64748b;
          font-size: 12px;
        }

        .ids-status-bar div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ids-status-bar button {
          border: 1px solid #d8caa9;
          background: white;
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
        }

        .ids-publish-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .ids-publish-card {
          border: 1px solid #eadfc9;
          background: #fffdf8;
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 6px;
        }

        .ids-publish-card span,
        .ids-publish-card p,
        .ids-publish-card em {
          margin: 0;
          color: #64748b;
          font-style: normal;
        }

        @media (max-width: 1180px) {
          .ids-builder-shell {
            grid-template-columns: 76px minmax(500px, 1fr) 340px;
          }

          .ids-title-bar {
            grid-template-columns: auto 220px auto auto auto 180px 220px auto auto auto;
          }
        }
          /* Compact premium Document Studio ribbon v3 */
.ids-page {
  padding: 8px !important;
}

.ids-studio-frame {
  height: calc(100vh - 18px) !important;
  max-height: calc(100vh - 18px) !important;
  border-radius: 14px !important;
  overflow: hidden !important;
}

.ids-title-bar {
  height: 48px !important;
  min-height: 48px !important;
  padding: 6px 10px !important;
  gap: 8px !important;
  grid-template-columns:
    auto
    minmax(260px, 430px)
    auto
    auto
    auto
    minmax(180px, 280px)
    minmax(220px, 360px)
    auto
    auto
    auto !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
}

.ids-title-bar input,
.ids-title-bar select {
  height: 34px !important;
  padding: 6px 10px !important;
  font-size: 13px !important;
  border-radius: 10px !important;
}

.ids-title-bar button,
.ids-primary-btn,
.ids-secondary-btn,
.ids-gold-btn {
  height: 34px !important;
  padding: 6px 12px !important;
  font-size: 12px !important;
  border-radius: 10px !important;
  line-height: 1 !important;
}

.ids-undo-group {
  gap: 5px !important;
}

.ids-undo-group button {
  width: 34px !important;
  min-width: 34px !important;
  padding: 0 !important;
}

.ids-ribbon-tabs {
  height: 38px !important;
  min-height: 38px !important;
  padding: 4px 10px 0 !important;
  gap: 4px !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  background: #fbf7ef !important;
}

.ids-ribbon-tabs button {
  height: 34px !important;
  padding: 0 16px !important;
  font-size: 13px !important;
  border-radius: 10px 10px 0 0 !important;
  white-space: nowrap !important;
}

.ids-ribbon-content {
  height: 74px !important;
  min-height: 74px !important;
  max-height: 74px !important;
  padding: 6px 10px !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  background: #fffdf8 !important;
}

.ids-ribbon-grid,
.ids-ribbon-grid.compact {
  height: 62px !important;
  min-height: 62px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  width: max-content !important;
  min-width: 100% !important;
}

.ids-ribbon-group,
.ids-ribbon-empty {
  height: 58px !important;
  min-height: 58px !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 6px 8px !important;
  border-radius: 12px !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  align-content: center !important;
  gap: 6px !important;
  background: #fffaf1 !important;
}

.ids-ribbon-group.wide {
  min-width: auto !important;
  max-width: none !important;
}

.ids-group-label {
  display: none !important;
}

.ids-control-row,
.ids-tile-row,
.ids-tile-row.small,
.ids-chip-row {
  display: flex !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 5px !important;
}

.ids-icon-btn {
  width: 32px !important;
  min-width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  font-size: 13px !important;
  border-radius: 9px !important;
}

.ids-soft-btn,
.ids-tile-row button,
.ids-tile-row.small button,
.ids-chip-row button {
  height: 32px !important;
  min-height: 32px !important;
  padding: 6px 10px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  border-radius: 9px !important;
  white-space: nowrap !important;
}

.ids-tile-row button,
.ids-tile-row.small button {
  min-width: auto !important;
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
}

.ids-tile-row button span,
.ids-tile-row.small button span {
  font-size: 12px !important;
}

.ids-select,
.ids-search,
.ids-ribbon-group select {
  height: 32px !important;
  min-height: 32px !important;
  padding: 5px 10px !important;
  font-size: 12px !important;
  border-radius: 9px !important;
}

.ids-check-row {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  margin: 0 !important;
}

.ids-check-row input {
  width: 14px !important;
  height: 14px !important;
}

.ids-margin-grid {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.ids-margin-grid label {
  width: 54px !important;
  display: grid !important;
  gap: 3px !important;
  font-size: 9px !important;
  line-height: 1 !important;
}

.ids-margin-grid input {
  height: 30px !important;
  width: 52px !important;
  padding: 4px !important;
  font-size: 12px !important;
  text-align: center !important;
  border-radius: 9px !important;
}

.ids-info-pair {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 12px !important;
  white-space: nowrap !important;
}

.ids-mini-note {
  display: none !important;
}

.ids-builder-shell {
  height: calc(100vh - 192px) !important;
  min-height: 0 !important;
  grid-template-columns: 74px minmax(620px, 1fr) 330px !important;
  overflow: hidden !important;
}

.ids-page-sidebar {
  width: 74px !important;
  padding: 8px 6px !important;
  overflow: hidden !important;
}

.ids-page-sidebar button {
  width: 58px !important;
  min-height: 48px !important;
  padding: 6px 4px !important;
  font-size: 12px !important;
  border-radius: 10px !important;
}

.ids-canvas-wrap {
  min-width: 0 !important;
  overflow: auto !important;
}

.ids-ruler-top {
  height: 14px !important;
}

.ids-canvas-grid {
  padding: 18px 22px 70px !important;
}

.ids-a4-page {
  width: 700px !important;
  min-height: 960px !important;
  padding: 26px 30px !important;
}

.ids-doc-block {
  padding: 12px !important;
}

.ids-merge-panel {
  width: 330px !important;
  min-width: 330px !important;
  max-width: 330px !important;
}

.ids-panel-header {
  padding: 10px 12px !important;
}

.ids-selected-context,
.ids-block-editor,
.ids-panel-body,
.ids-field-panel {
  margin: 8px !important;
  padding: 10px !important;
  border-radius: 12px !important;
}

.ids-merge-tabs {
  margin: 8px !important;
}

.ids-status-bar {
  height: 30px !important;
  min-height: 30px !important;
  padding: 5px 10px !important;
  font-size: 11px !important;
}.ids-document-kit-section {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid #e4dac9;
}

.ids-document-kit-section h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.03em;
}

.ids-document-kit-section p {
  color: #64748b;
  max-width: 880px;
}

.ids-document-kit-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.ids-document-kit-card {
  text-align: left;
  border: 1px solid #e4dac9;
  background: #fffdf8;
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  color: #071a3a;
  min-height: 170px;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.ids-document-kit-card:hover {
  transform: translateY(-2px);
  border-color: #b48314;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.ids-document-kit-card span {
  color: #9a7312;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ids-document-kit-card strong {
  display: block;
  margin-top: 8px;
  font-size: 15px;
}

.ids-document-kit-card p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #64748b;
}

.ids-document-kit-card em {
  display: inline-block;
  margin-top: 10px;
  color: #9a7312;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

@media (max-width: 1300px) {
  .ids-document-kit-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
      `}</style>
    </main>
  );
}