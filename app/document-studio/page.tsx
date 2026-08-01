"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type WorkspaceTab =
  | "library"
  | "builder"
  | "preview"
  | "batch"
  | "publish";

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

type TemplateBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  content?: string;
  repeatSource?: string;
  tableConfig?: TableBlockConfig;
  stylePreset?: "normal" | "header" | "highlight" | "muted";
  align?: "left" | "center" | "right";
  valueFormat?: "number" | "currency" | "date" | "percentage" | "multiple";
  chartType?: "bar" | "line" | "waterfall";
  chartSeries?: string;
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
  id: string;
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
  documents?: {
    investor_code?: string;
    investor_name?: string;
    file_name?: string;
    file_url?: string;
  }[];
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
const tableFieldOptions = {
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
} as const;

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
      format: field.format as TableColumnConfig["format"],
      align:
        field.format === "currency" ||
        field.format === "number" ||
        field.format === "percentage"
          ? "right"
          : "left",
    })),
  };
}
const initialBlocks: TemplateBlock[] = [
  {
    id: "letterhead",
    kind: "letterhead",
    title: "Letterhead",
    subtitle: "Fund logo, address and statement period",
  },
  {
    id: "identity",
    kind: "identity",
    title: "Investor identity block",
    subtitle: "Investor name, folio, PAN and address",
  },
  {
  id: "summary",
  kind: "summary",
  title: "Capital account summary",
  subtitle: "Commitment, called capital, NAV and uncalled capital",
  repeatSource: "capitalAccount",
  tableConfig: createTableConfig("capitalAccount"),
},
  {
  id: "transactions",
  kind: "transactions",
  title: "Transaction table",
  subtitle: "Capital calls, distributions, unit movements and investor activity",
  repeatSource: "transactions",
  tableConfig: createTableConfig("transactions"),
},
  {
  id: "financial",
  kind: "financial",
  title: "Financial statement",
  subtitle: "Income, expenses, net income and payout",
  repeatSource: "pnl",
  tableConfig: createTableConfig("pnl"),
},
  {
    id: "performance",
    kind: "performance",
    title: "Performance metrics",
    subtitle: "DPI, TVPI, IRR and distribution metrics",
  },
  {
    id: "signature",
    kind: "signature",
    title: "Signature block",
    subtitle: "Authorized signatory and generation date",
  },
];

const cellFields: MergeField[] = [
  {
    code: "investor_name",
    label: "Investor name",
    category: "Investor Info",
    type: "TEXT",
    sample: "Aarav Menon",
  },
  {
    code: "investor_code",
    label: "Investor / folio code",
    category: "Investor Info",
    type: "TEXT",
    sample: "AUR-10001",
  },
  {
    code: "investor_type",
    label: "Investor type",
    category: "Investor Info",
    type: "TEXT",
    sample: "Individual",
  },
  {
    code: "fund_name",
    label: "Fund name",
    category: "Fund",
    type: "TEXT",
    sample: "VENTIQ Capital Fund I",
  },
  {
    code: "fund_address",
    label: "Fund registered address",
    category: "Fund",
    type: "TEXT",
    sample: "GIFT City, Gandhinagar",
  },
  {
    code: "statement_period",
    label: "Statement period",
    category: "Fund",
    type: "TEXT",
    sample: "Q1 FY 2025-26",
  },
  {
    code: "report_date",
    label: "Reporting / as-of date",
    category: "Fund",
    type: "DATE",
    sample: "30-Jun-2025",
  },
  {
    code: "commitment_amount",
    label: "Commitment amount",
    category: "Capital Account",
    type: "MONEY",
    sample: "₹2,50,00,000",
  },
  {
    code: "capital_called",
    label: "Capital called",
    category: "Capital Account",
    type: "MONEY",
    sample: "₹1,50,00,000",
  },
  {
    code: "uncalled_capital",
    label: "Uncalled capital",
    category: "Capital Account",
    type: "MONEY",
    sample: "₹1,00,00,000",
  },
  {
    code: "current_nav",
    label: "Current NAV",
    category: "Capital Account",
    type: "MONEY",
    sample: "₹1,82,40,000",
  },
  {
    code: "distribution_amount",
    label: "Distribution amount",
    category: "P&L",
    type: "MONEY",
    sample: "₹42,00,000",
  },
  {
    code: "dpi",
    label: "DPI",
    category: "Performance",
    type: "NUMBER",
    sample: "0.28x",
  },
  {
    code: "tvpi",
    label: "TVPI",
    category: "Performance",
    type: "NUMBER",
    sample: "1.49x",
  },
  {
    code: "irr",
    label: "Investor IRR",
    category: "Performance",
    type: "PERCENT",
    sample: "18.7%",
  },
  {
    code: "generated_on",
    label: "Statement generated on",
    category: "Calculated",
    type: "DATE",
    sample: "28-Jul-2026",
  },
];

const columnSources: ColumnSource[] = [
  {
    id: "transactions",
    label: "Transactions",
    description: "Investor cashflows and account movement lines",
    fields: [
      {
        code: "transaction_date",
        label: "Date",
        category: "Transactions",
        type: "DATE",
        sample: "24-Apr-24",
      },
      {
        code: "transaction_description",
        label: "Description",
        category: "Transactions",
        type: "TEXT",
        sample: "Units Allotment",
      },
      {
        code: "transaction_amount",
        label: "Amount",
        category: "Transactions",
        type: "MONEY",
        sample: "₹1,98,82,000",
      },
      {
        code: "transaction_units",
        label: "Units",
        category: "Transactions",
        type: "NUMBER",
        sample: "1,98,820",
      },
      {
        code: "transaction_nav",
        label: "NAV",
        category: "Transactions",
        type: "MONEY",
        sample: "₹100.00",
      },
      {
        code: "transaction_type",
        label: "Type",
        category: "Transactions",
        type: "TEXT",
        sample: "Capital Call",
      },
    ],
  },
  {
    id: "pnl",
    label: "P&L line items",
    description: "Income, expenses, taxes and payout schedule",
    fields: [
      {
        code: "particular",
        label: "Particular",
        category: "P&L",
        type: "TEXT",
        sample: "Interest / Fee Income",
      },
      {
        code: "reference",
        label: "Reference",
        category: "P&L",
        type: "TEXT",
        sample: "A",
      },
      {
        code: "amount",
        label: "Amount",
        category: "P&L",
        type: "MONEY",
        sample: "₹8,38,428",
      },
      {
        code: "formula",
        label: "Formula",
        category: "P&L",
        type: "TEXT",
        sample: "C = A + B",
      },
    ],
  },
  {
    id: "capitalAccount",
    label: "Capital Account",
    description: "Commitment, drawdown, distribution and NAV movement",
    fields: [
      {
        code: "capital_particular",
        label: "Particular",
        category: "Capital Account",
        type: "TEXT",
        sample: "Opening capital account",
      },
      {
        code: "capital_amount",
        label: "Amount",
        category: "Capital Account",
        type: "MONEY",
        sample: "₹1,50,00,000",
      },
      {
        code: "capital_units",
        label: "Units",
        category: "Capital Account",
        type: "NUMBER",
        sample: "1,50,000",
      },
    ],
  },
  {
    id: "tax",
    label: "Tax breakup",
    description: "Form 64C / 64D and advance tax related values",
    fields: [
      {
        code: "tax_nature",
        label: "Nature of income",
        category: "Tax",
        type: "TEXT",
        sample: "Interest income",
      },
      {
        code: "tax_amount",
        label: "Amount",
        category: "Tax",
        type: "MONEY",
        sample: "₹69,122",
      },
      {
        code: "tds_amount",
        label: "TDS",
        category: "Tax",
        type: "MONEY",
        sample: "₹6,912",
      },
    ],
  },
];

const calculatedFields: MergeField[] = [
  {
    code: "gross_income",
    label: "Gross income",
    category: "Calculated",
    type: "FORMULA",
    sample: "Interest income + STCG",
  },
  {
    code: "total_expenses",
    label: "Total expenses",
    category: "Calculated",
    type: "FORMULA",
    sample: "Management fee + Operating expenses + Stamp duty",
  },
  {
    code: "net_income",
    label: "Net income",
    category: "Calculated",
    type: "FORMULA",
    sample: "Gross income - Total expenses",
  },
  {
    code: "net_income_payout",
    label: "Net income payout",
    category: "Calculated",
    type: "FORMULA",
    sample: "Net income - TDS",
  },
  {
    code: "uncalled_capital_calc",
    label: "Uncalled capital",
    category: "Calculated",
    type: "FORMULA",
    sample: "Commitment - Capital called",
  },
  {
    code: "xirr",
    label: "Investor XIRR",
    category: "Calculated",
    type: "XIRR",
    sample: "Investor-wise cashflow return",
  },
  {
    code: "dpi_calc",
    label: "DPI",
    category: "Calculated",
    type: "FORMULA",
    sample: "Distributions / Paid-in capital",
  },
  {
    code: "tvpi_calc",
    label: "TVPI",
    category: "Calculated",
    type: "FORMULA",
    sample: "(NAV + Distributions) / Paid-in capital",
  },
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

export default function DocumentStudioPage() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("builder");
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("insert");
  const [mergeMode, setMergeMode] = useState<MergeMode>("cell");
  const [templateName, setTemplateName] = useState("AIF Statement Template");
  const [selectedInvestorId, setSelectedInvestorId] = useState("aarav");
  const [selectedDocumentType, setSelectedDocumentType] = useState(
    "Statement of Account (SOA)"
  );
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState("transactions");
  const [selectedColumnSource, setSelectedColumnSource] =
    useState("transactions");
  const [importDone, setImportDone] = useState(false);
const [activeTemplateId, setActiveTemplateId] = useState("");
const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
const [previewMergeData, setPreviewMergeData] =
  useState<PreviewMergeResponse | null>(null);
const [batchResult, setBatchResult] = useState<BatchGenerationResponse | null>(
  null
);
const [publishResult, setPublishResult] = useState<PublishResponse | null>(
  null
);
const [pdfGenerationResult, setPdfGenerationResult] =
  useState<PdfGenerationResponse | null>(null);
const [importResult, setImportResult] =
  useState<ImportTemplateResponse | null>(null);
const fileInputRef = useRef<HTMLInputElement | null>(null);
const [apiBusy, setApiBusy] = useState(false);
const [statusMessage, setStatusMessage] = useState(
  "Template Builder ready. Insert blocks, map fields, preview and batch generate."
);
const [showGrid, setShowGrid] = useState(true);
const [showRulers, setShowRulers] = useState(true);
const [snapToGrid, setSnapToGrid] = useState(false);
const [showSampleValues, setShowSampleValues] = useState(true);
const [zoomLevel, setZoomLevel] = useState(100);
const [pageMargins, setPageMargins] = useState({
  left: 15,
  right: 15,
  top: 20,
  bottom: 15,
});
const [formulaName, setFormulaName] = useState("net_income_custom");
const [formulaExpression, setFormulaExpression] = useState(
  "gross_income - total_expenses - tds"
);
const [customCalculatedFields, setCustomCalculatedFields] = useState<MergeField[]>([]);
  const selectedInvestor =
    investors.find((investor) => investor.id === selectedInvestorId) ??
    investors[0];

  const selectedBlock = useMemo(() => {
    return blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
  }, [blocks, selectedBlockId]);

  const activeColumnSource =
  columnSources.find((source) => source.id === selectedColumnSource) ??
  columnSources[0];

const selectedBlockIndex = blocks.findIndex(
  (block) => block.id === selectedBlockId
);

const availableCalculatedFields = [
  ...calculatedFields,
  ...customCalculatedFields,
];
    async function loadSavedTemplates() {
  try {
    const response = await fetch("/api/document-studio/templates", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to load templates.");
    }

    setSavedTemplates(result.templates ?? []);
  } catch (error) {
    console.warn("Unable to load saved document templates:", error);
  }
}

useEffect(() => {
  loadSavedTemplates();
}, []);
function normalizeSavedTemplateBlocks(value: unknown): TemplateBlock[] {
  if (!Array.isArray(value)) {
    return initialBlocks.map(ensureTableConfigForTemplateBlock);
  }

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
  stylePreset: item.stylePreset,
  align: item.align,
  valueFormat: item.valueFormat,
  chartType: item.chartType,
  chartSeries: item.chartSeries,
})
    );

  return cleanBlocks.length > 0
    ? cleanBlocks
    : initialBlocks.map(ensureTableConfigForTemplateBlock);
}

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getSavedTemplateImportResult(
  template: SavedTemplate
): ImportTemplateResponse | null {
  if (!template.field_mappings || typeof template.field_mappings !== "object") {
    return null;
  }

  const mappings = template.field_mappings as Record<string, unknown>;
  const importIntelligence = mappings.import_intelligence;

  if (!importIntelligence || typeof importIntelligence !== "object") {
    return null;
  }

  const importData = importIntelligence as Record<string, unknown>;

  return {
    detectedDocumentType:
      typeof importData.detected_document_type === "string"
        ? importData.detected_document_type
        : template.document_type || undefined,
    importConfidence:
      typeof importData.import_confidence === "number"
        ? importData.import_confidence
        : template.import_confidence || undefined,
    detectedFields: stringArrayFromUnknown(importData.detected_fields),
    detectedSections: stringArrayFromUnknown(importData.detected_sections),
    unmappedItems: stringArrayFromUnknown(importData.unmapped_items),
    storage:
      importData.storage && typeof importData.storage === "object"
        ? (importData.storage as ImportTemplateResponse["storage"])
        : undefined,
  };
}

function openSavedTemplate(template: SavedTemplate) {
  const savedBlocks = normalizeSavedTemplateBlocks(template.blocks_json);
  const importInfo = getSavedTemplateImportResult(template);
  const firstTableBlock = savedBlocks.find((block) =>
    isConfigurableTableBlock(block)
  );

  setActiveTemplateId(template.id);
  setTemplateName(template.template_name || "Untitled Template");
  setSelectedDocumentType(
    template.document_type || "Statement of Account (SOA)"
  );

  setBlocks(savedBlocks);
  setSelectedBlockId(
    firstTableBlock?.id || savedBlocks[0]?.id || "letterhead"
  );

  setImportResult(importInfo);
  setImportDone(
    Boolean(
      importInfo ||
        template.source_type?.toLowerCase().includes("import") ||
        Number(template.import_confidence || 0) > 0
    )
  );

  setPreviewMergeData(null);
  setBatchResult(null);
  setPdfGenerationResult(null);
  setPublishResult(null);

  if (firstTableBlock) {
    setRibbonTab("table");
    setMergeMode("column");
  } else {
    setRibbonTab("insert");
    setMergeMode(importInfo ? "import" : "cell");
  }

  setWorkspaceTab("builder");

  setStatusMessage(
    `${template.template_name} opened from Template Library. Table mappings, repeat source and column settings are ready for editing.`
  );
}

function updateSelectedBlock(updates: Partial<TemplateBlock>) {
  setBlocks((currentBlocks) =>
    currentBlocks.map((block) =>
      block.id === selectedBlockId ? { ...block, ...updates } : block
    )
  );
}
function renameSelectedBlock(field: "title" | "subtitle", value: string) {
  updateSelectedBlock({
    [field]: value,
  });

  setStatusMessage(
    field === "title"
      ? "Block title updated."
      : "Block description updated."
  );
}

function cloneTemplateBlocks(sourceBlocks: TemplateBlock[]) {
  return sourceBlocks.map((block) => ({
    ...block,
    tableConfig: block.tableConfig
      ? {
          ...block.tableConfig,
          columns: block.tableConfig.columns.map((column) => ({ ...column })),
        }
      : undefined,
  }));
}

function startNewTemplate() {
  const freshBlocks = cloneTemplateBlocks(initialBlocks).map(
    ensureTableConfigForTemplateBlock
  );

  setActiveTemplateId("");
  setTemplateName("Untitled AIF Template");
  setSelectedDocumentType("Statement of Account (SOA)");
  setBlocks(freshBlocks);
  setSelectedBlockId("transactions");
  setSelectedInvestorId("aarav");
  setImportDone(false);
  setImportResult(null);
  setPreviewMergeData(null);
  setBatchResult(null);
  setPdfGenerationResult(null);
  setPublishResult(null);
  setRibbonTab("insert");
  setMergeMode("cell");
  setStatusMessage("New blank template created. Insert blocks and map fields.");
}

function updatePageMargin(
  key: "left" | "right" | "top" | "bottom",
  value: string
) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return;
  }

  setPageMargins((current) => ({
    ...current,
    [key]: numericValue,
  }));

  setStatusMessage(`Page ${key} margin updated to ${numericValue}mm.`);
}

function addPageBreakBlock() {
  const id = `notes-${Date.now()}`;

  const block: TemplateBlock = {
    id,
    kind: "notes",
    title: "Continuation note",
    subtitle: "Inserted as a new section / page continuation marker",
    content:
      "Continuation page / additional disclosure. Replace this text with your required note.",
    stylePreset: "muted",
  };

  setBlocks((current) => [...current, block]);
  setSelectedBlockId(id);
  setRibbonTab("home");
  setMergeMode("cell");
  setStatusMessage("New continuation note inserted. Use it as a page break marker for now.");
}

function applySelectedBlockStyle(
  stylePreset: NonNullable<TemplateBlock["stylePreset"]>
) {
  updateSelectedBlock({ stylePreset });
  setStatusMessage(`Block style changed to ${stylePreset}.`);
}

function applySelectedBlockAlignment(align: NonNullable<TemplateBlock["align"]>) {
  updateSelectedBlock({ align });
  setStatusMessage(`Block alignment changed to ${align}.`);
}

function applySelectedBlockValueFormat(
  valueFormat: NonNullable<TemplateBlock["valueFormat"]>
) {
  updateSelectedBlock({ valueFormat });
  setStatusMessage(`Value format changed to ${valueFormat}.`);
}

function updateChartBlock(updates: Partial<TemplateBlock>) {
  if (selectedBlock?.kind !== "chart") {
    const id = `chart-${Date.now()}`;
    const block: TemplateBlock = {
      id,
      kind: "chart",
      title: "Performance chart",
      subtitle: "DPI, TVPI, NAV and distribution movement",
      content: "Portfolio Movement Chart",
      chartType: "bar",
      chartSeries: "current_nav",
    };

    setBlocks((current) => [...current, block]);
    setSelectedBlockId(id);
    setRibbonTab("chart");
    setMergeMode("calculated");
    setStatusMessage("Chart block inserted. Configure chart type and series.");
    return;
  }

  updateSelectedBlock(updates);
  setStatusMessage("Chart settings updated.");
}

function appendFormulaToken(token: string) {
  setFormulaExpression((current) => `${current} ${token}`.trim());
}

function saveCalculatedField() {
  const cleanName = formulaName.trim().replace(/\s+/g, "_").toLowerCase();

  if (!cleanName || !formulaExpression.trim()) {
    setStatusMessage("Add a calculated field name and formula before saving.");
    return;
  }

  const nextField: MergeField = {
    code: cleanName,
    label: cleanName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    category: "Calculated",
    type: "FORMULA",
    sample: formulaExpression.trim(),
  };

  setCustomCalculatedFields((current) => [
    ...current.filter((field) => field.code !== nextField.code),
    nextField,
  ]);
  setStatusMessage(`Calculated field {${nextField.code}} saved.`);
}
function updateSelectedTableConfig(updates: Partial<TableBlockConfig>) {
  setBlocks((currentBlocks) =>
    currentBlocks.map((block) => {
      if (block.id !== selectedBlockId) {
        return block;
      }

      const existingConfig =
        block.tableConfig || createTableConfig("transactions");

      return {
        ...block,
        tableConfig: {
          ...existingConfig,
          ...updates,
        },
        repeatSource: updates.repeatSource || block.repeatSource,
      };
    })
  );
}

function updateSelectedTableColumn(
  columnId: string,
  updates: Partial<TableColumnConfig>
) {
  setBlocks((currentBlocks) =>
    currentBlocks.map((block) => {
      if (block.id !== selectedBlockId || !block.tableConfig) {
        return block;
      }

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

function addTableColumn() {
  const tableConfig = selectedBlock?.tableConfig || createTableConfig();
  const sourceFields = tableFieldOptions[tableConfig.repeatSource];

  const alreadyUsedFields = new Set(
    tableConfig.columns.map((column) => column.fieldKey)
  );

  const nextAvailableField =
    sourceFields.find((field) => !alreadyUsedFields.has(field.value)) ||
    sourceFields[sourceFields.length - 1];

  const nextColumnNumber = tableConfig.columns.length + 1;

  const nextColumn: TableColumnConfig = {
    id: `column-${Date.now()}`,
    header: nextAvailableField?.label || `Column ${nextColumnNumber}`,
    fieldKey: nextAvailableField?.value || "particulars",
    width: 20,
    format:
      (nextAvailableField?.format as TableColumnConfig["format"]) || "text",
    align:
      nextAvailableField?.format === "currency" ||
      nextAvailableField?.format === "number" ||
      nextAvailableField?.format === "percentage"
        ? "right"
        : "left",
  };

  updateSelectedTableConfig({
    columns: [...tableConfig.columns, nextColumn],
  });

  setRibbonTab("table");
  setMergeMode("column");
  setStatusMessage(
    `${nextColumn.header} column added to ${
      selectedBlock?.title || "table"
    }. Total mapped columns: ${nextColumnNumber}.`
  );
}

function deleteTableColumn(columnId: string) {
  const tableConfig = selectedBlock?.tableConfig;

  if (!tableConfig || tableConfig.columns.length <= 1) {
    setStatusMessage("At least one table column is required.");
    return;
  }

  updateSelectedTableConfig({
    columns: tableConfig.columns.filter((column) => column.id !== columnId),
  });
}

function changeTableRepeatSource(
  repeatSource: TableBlockConfig["repeatSource"]
) {
  const nextConfig = createTableConfig(repeatSource);

  updateSelectedTableConfig(nextConfig);
  updateSelectedBlock({
    repeatSource,
    subtitle: `Repeating table mapped to ${repeatSource}`,
  });

  setRibbonTab("table");
  setMergeMode("column");
  setStatusMessage(
    `Table source changed to ${repeatSource}. Columns have been remapped automatically.`
  );
}
  function addBlock(kind: BlockKind) {
    const id = `${kind}-${Date.now()}`;

    const titles: Record<BlockKind, string> = {
      letterhead: "Letterhead",
      identity: "Investor identity block",
      summary: "Capital account summary",
      transactions: "Transaction table",
      financial: "Financial statement",
      performance: "Performance metrics",
      chart: "Performance chart",
      notes: "Notes",
      signature: "Signature block",
    };

  const block: TemplateBlock = {
  id,
  kind,
  title: titles[kind],
  subtitle:
    kind === "transactions"
      ? "Repeats from Transactions"
      : kind === "financial"
      ? "Repeats from P&L line items"
      : "Inserted from VENTIQ block library",
  content:
    kind === "notes"
      ? "This statement is generated based on the books and records of the Fund as on {report_date}."
      : kind === "signature"
      ? "Authorized Signatory"
      : kind === "chart"
      ? "Portfolio Movement Chart"
      : undefined,
  stylePreset:
    kind === "letterhead"
      ? "header"
      : kind === "notes"
      ? "muted"
      : "normal",
  align: "left",
  valueFormat: "number",
  chartType: kind === "chart" ? "bar" : undefined,
  chartSeries: kind === "chart" ? "current_nav" : undefined,
  repeatSource:
    kind === "transactions"
      ? "transactions"
      : kind === "financial"
      ? "pnl"
      : undefined,
  tableConfig:
  kind === "summary"
    ? createTableConfig("capitalAccount")
    : kind === "transactions"
    ? createTableConfig("transactions")
    : kind === "financial"
    ? createTableConfig("pnl")
    : undefined,
};
    setBlocks((current) => [...current, block]);
    setSelectedBlockId(id);
    setStatusMessage(`${titles[kind]} inserted into the template.`);
    setWorkspaceTab("builder");

   if (isConfigurableTableBlock(block)) {
  setRibbonTab("table");
  setMergeMode("column");
} else if (kind === "chart") {
  setRibbonTab("chart");
  setMergeMode("calculated");
} else {
  setRibbonTab("home");
  setMergeMode("cell");
}
  }


function moveSelectedBlock(direction: "up" | "down") {
  setBlocks((currentBlocks) => {
    const currentIndex = currentBlocks.findIndex(
      (block) => block.id === selectedBlockId
    );

    if (currentIndex === -1) {
      return currentBlocks;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= currentBlocks.length) {
      setStatusMessage(
        direction === "up"
          ? "Selected block is already at the top."
          : "Selected block is already at the bottom."
      );
      return currentBlocks;
    }

    const nextBlocks = [...currentBlocks];
    const selected = nextBlocks[currentIndex];

    nextBlocks[currentIndex] = nextBlocks[nextIndex];
    nextBlocks[nextIndex] = selected;

    setStatusMessage(
      `${selected.title} moved ${direction === "up" ? "up" : "down"}.`
    );

    return nextBlocks;
  });
}

function duplicateSelectedBlock() {
  if (!selectedBlock) {
    return;
  }

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
    const currentIndex = currentBlocks.findIndex(
      (block) => block.id === selectedBlockId
    );

    if (currentIndex === -1) {
      return [...currentBlocks, duplicatedBlock];
    }

    const nextBlocks = [...currentBlocks];
    nextBlocks.splice(currentIndex + 1, 0, duplicatedBlock);
    return nextBlocks;
  });

  setSelectedBlockId(duplicatedBlock.id);

  if (isConfigurableTableBlock(duplicatedBlock)) {
    setRibbonTab("table");
    setMergeMode("column");
  }

  setStatusMessage(`${selectedBlock.title} duplicated with its mappings.`);
}

function deleteSelectedBlock() {
  if (blocks.length <= 1) {
    setStatusMessage("At least one template block is required.");
    return;
  }

  const deletedTitle = selectedBlock?.title || "Selected block";

  setBlocks((currentBlocks) => {
    const currentIndex = currentBlocks.findIndex(
      (block) => block.id === selectedBlockId
    );

    const nextBlocks = currentBlocks.filter(
      (block) => block.id !== selectedBlockId
    );

    const nextSelectedBlock =
      nextBlocks[Math.max(0, currentIndex - 1)] || nextBlocks[0];

    setSelectedBlockId(nextSelectedBlock.id);

    if (isConfigurableTableBlock(nextSelectedBlock)) {
      setRibbonTab("table");
      setMergeMode("column");
    } else {
      setRibbonTab("home");
      setMergeMode("cell");
    }

    return nextBlocks;
  });

  setStatusMessage(`${deletedTitle} deleted from the template.`);
}
  function isConfigurableTableBlock(block?: TemplateBlock) {
  return (
    block?.kind === "summary" ||
    block?.kind === "transactions" ||
    block?.kind === "financial"
  );
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
  return "Transactions";
}

function getDefaultTableConfigForBlock(block: TemplateBlock) {
  if (block.kind === "summary") return createTableConfig("capitalAccount");
  if (block.kind === "financial") return createTableConfig("pnl");
  return createTableConfig("transactions");
}
function getDefaultRepeatSourceForBlock(block: TemplateBlock): TableBlockConfig["repeatSource"] {
  if (block.kind === "summary") return "capitalAccount";
  if (block.kind === "financial") return "pnl";
  return "transactions";
}

function isValidTableRepeatSource(
  value: unknown
): value is TableBlockConfig["repeatSource"] {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(tableFieldOptions, value)
  );
}

function ensureTableConfigForTemplateBlock(block: TemplateBlock): TemplateBlock {
  if (!isConfigurableTableBlock(block)) {
    return block;
  }

  const repeatSource = isValidTableRepeatSource(block.tableConfig?.repeatSource)
    ? block.tableConfig.repeatSource
    : isValidTableRepeatSource(block.repeatSource)
    ? block.repeatSource
    : getDefaultRepeatSourceForBlock(block);

  const fallbackConfig = createTableConfig(repeatSource);
  const existingColumns =
    block.tableConfig?.columns && block.tableConfig.columns.length > 0
      ? block.tableConfig.columns
      : fallbackConfig.columns;

  return {
    ...block,
    repeatSource,
    tableConfig: {
      ...fallbackConfig,
      ...block.tableConfig,
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
    irr: "22.4%",

    particular: "Interest / Fee Income",
reference: "A",
formula: "C = A + B",

particulars: "Sample line item",
  };

  return sampleValues[fieldKey] || `{${fieldKey}}`;
}
  function insertField(field: MergeField) {
  const token = `{${field.code}}`;

  if (!selectedBlock) {
    setStatusMessage(`${token} selected.`);
    return;
  }

  if (selectedBlock.kind === "notes") {
    updateSelectedBlock({
      content: `${selectedBlock.content || ""} ${token}`.trim(),
    });
  } else if (selectedBlock.kind === "signature") {
    updateSelectedBlock({ content: token });
  } else if (selectedBlock.kind === "chart") {
    updateSelectedBlock({ chartSeries: field.code });
  } else {
    updateSelectedBlock({
      subtitle: `${selectedBlock.subtitle || ""} ${token}`.trim(),
    });
  }

  setStatusMessage(`${token} inserted into ${selectedBlock.title}.`);
}
function renderContentWithSampleValues(content: string) {
  return content.replace(/\{([^}]+)\}/g, (_match, code: string) =>
    getInvestorValue(selectedInvestor, code.trim())
  );
}
  function fallbackImportedBlocks(): TemplateBlock[] {
  return [
    {
      id: "import-letterhead",
      kind: "letterhead",
      title: "Imported letterhead",
      subtitle: "Detected from uploaded Word/PDF",
    },
    {
      id: "import-identity",
      kind: "identity",
      title: "Imported investor identity",
      subtitle: "Investor name, folio and fund fields need review",
    },
    {
  id: "import-summary",
  kind: "summary",
  title: "Imported capital summary",
  subtitle: "Commitment, called capital, NAV and uncalled capital",
  repeatSource: "capitalAccount",
  tableConfig: createTableConfig("capitalAccount"),
},
   {
  id: "import-transactions",
  kind: "transactions",
  title: "Imported transaction table",
  subtitle: "Suggested source: Transactions",
  repeatSource: "transactions",
  tableConfig: createTableConfig("transactions"),
},
   {
  id: "import-financial",
  kind: "financial",
  title: "Imported financial statement",
  subtitle: "Suggested source: P&L line items",
  repeatSource: "pnl",
  tableConfig: createTableConfig("pnl"),
},
    {
      id: "import-signature",
      kind: "signature",
      title: "Imported signature block",
      subtitle: "Authorized signatory section",
    },
  ];
}

function applyImportedTemplate(result: ImportTemplateResponse, fileName: string) {
  const suggestedBlocks =
    result.suggestedBlocks && result.suggestedBlocks.length > 0
      ? result.suggestedBlocks
      : fallbackImportedBlocks();

  setImportDone(true);
  setImportResult(result);
  setBlocks(suggestedBlocks);
  setSelectedBlockId(
    suggestedBlocks.find((block) => block.kind === "transactions")?.id ||
      suggestedBlocks[0]?.id ||
      "import-letterhead"
  );
  setSelectedDocumentType(
    result.detectedDocumentType || "Statement of Account (SOA)"
  );
  setTemplateName(fileName.replace(/\.[^.]+$/, " Smart Template"));
  setWorkspaceTab("builder");
  setRibbonTab("insert");
  setMergeMode("import");
  setStatusMessage(
    result.message ||
      "Template imported. Review detected blocks, unmapped fields and merge mappings."
  );
}

function simulateImport() {
  fileInputRef.current?.click();
}

async function importTemplateFile(event: ChangeEvent<HTMLInputElement>) {
  try {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setApiBusy(true);
    setStatusMessage("Uploading and analyzing existing template...");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/document-studio/import-template", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to import template.");
    }

    applyImportedTemplate(result, file.name);
  } catch (error) {
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to import Word/PDF template."
    );
  } finally {
    setApiBusy(false);

    if (event.target) {
      event.target.value = "";
    }
  }
}

  async function saveTemplate() {
  try {
    setApiBusy(true);
    setStatusMessage("Saving template to Document Studio...");

    const response = await fetch("/api/document-studio/templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: activeTemplateId || undefined,
        template_name: templateName,
        document_type: selectedDocumentType,
        template_status: "Draft",
        source_type: importDone ? "Imported Word/PDF" : "Created in VENTIQ",
        import_confidence: importDone ? 87 : 0,
        layout_json: {
          page_size: "A4",
          orientation: "Portrait",
          margin_left_mm: pageMargins.left,
          margin_right_mm: pageMargins.right,
          margin_top_mm: pageMargins.top,
          margin_bottom_mm: pageMargins.bottom,
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
        calculated_fields: availableCalculatedFields,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to save template.");
    }

    if (result.template?.id) {
      setActiveTemplateId(result.template.id);
    }

    await loadSavedTemplates();

    setStatusMessage(
      result.message ||
        `${templateName} saved as a smart VENTIQ template for ${selectedDocumentType}.`
    );
  } catch (error) {
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to save Document Studio template."
    );
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: activeTemplateId || undefined,
        document_type: selectedDocumentType,
        investor_code: selectedInvestor.code,
        statement_period: "Q1 FY 2025-26",
        report_date: "30-Jun-2025",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate preview.");
    }

    setPreviewMergeData(result);
    setWorkspaceTab("preview");

    setStatusMessage(
      result.message ||
        `Preview generated for ${
          result.investor?.investor_name || selectedInvestor.name
        }.`
    );
  } catch (error) {
    setPreviewMergeData(null);
    setWorkspaceTab("preview");
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to generate investor preview."
    );
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: activeTemplateId || undefined,
        document_type: selectedDocumentType,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to prepare batch.");
    }

    setBatchResult(result);
    setWorkspaceTab("batch");

    setStatusMessage(
      result.message ||
        "Batch generation prepared for all investors. Review exceptions before publishing."
    );
  } catch (error) {
    setBatchResult(null);
    setWorkspaceTab("batch");
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to prepare batch generation."
    );
  } finally {
    setApiBusy(false);
  }
}
async function generatePdfFiles() {
  try {
    const batchId = batchResult?.batch?.id;

    if (!batchId) {
      setStatusMessage("Prepare a batch first before generating PDF files.");
      setWorkspaceTab("batch");
      return;
    }

    setApiBusy(true);
    setStatusMessage("Generating actual PDF files and uploading to storage...");

    const response = await fetch("/api/document-studio/generate-pdfs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch_id: batchId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate PDF files.");
    }

    setPdfGenerationResult(result);
    setWorkspaceTab("batch");

    setStatusMessage(
      result.message ||
        "PDF files generated and uploaded successfully."
    );
  } catch (error) {
    setPdfGenerationResult(null);
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to generate PDF files."
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
      setStatusMessage(
        "Prepare a batch first before publishing documents to Investor Portal."
      );
      return;
    }

    setApiBusy(true);
    setStatusMessage("Publishing generated document records to Investor Portal...");

    const response = await fetch("/api/document-studio/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch_id: batchId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to publish documents.");
    }

    setPublishResult(result);

    setStatusMessage(
      result.message ||
        "Documents published to Investor Portal successfully."
    );
  } catch (error) {
    setPublishResult(null);
    setStatusMessage(
      error instanceof Error
        ? error.message
        : "Unable to publish documents to Investor Portal."
    );
  } finally {
    setApiBusy(false);
  }
}

  function renderRibbon() {
    if (ribbonTab === "home") {
      return (
        <div className="ids-ribbon-grid">
          <div className="ids-ribbon-group">
            <div className="ids-control-row">
              <button
                className={`ids-icon-btn ${selectedBlock?.stylePreset === "header" ? "active" : ""}`}
                onClick={() => applySelectedBlockStyle("header")}
                type="button"
              >
                B
              </button>
              <button
                className={`ids-icon-btn ${selectedBlock?.stylePreset === "muted" ? "active" : ""}`}
                onClick={() => applySelectedBlockStyle("muted")}
                type="button"
              >
                /
              </button>
              <button
                className={`ids-icon-btn ${selectedBlock?.stylePreset === "highlight" ? "active" : ""}`}
                onClick={() => applySelectedBlockStyle("highlight")}
                type="button"
              >
                U
              </button>
              <button
                className="ids-icon-btn"
                onClick={() => applySelectedBlockValueFormat("currency")}
                type="button"
              >
                ₹
              </button>
            </div>
            <div className="ids-group-label">Font & emphasis</div>
          </div>

          <div className="ids-ribbon-group">
            <div className="ids-control-row">
              <button
                className={`ids-icon-btn ${selectedBlock?.align === "left" ? "active" : ""}`}
                onClick={() => applySelectedBlockAlignment("left")}
                type="button"
              >
                ←
              </button>
              <button
                className={`ids-icon-btn ${selectedBlock?.align === "center" ? "active" : ""}`}
                onClick={() => applySelectedBlockAlignment("center")}
                type="button"
              >
                ↔
              </button>
              <button
                className={`ids-icon-btn ${selectedBlock?.align === "right" ? "active" : ""}`}
                onClick={() => applySelectedBlockAlignment("right")}
                type="button"
              >
                →
              </button>
              <button
                className="ids-icon-btn"
                onClick={() => applySelectedBlockStyle("normal")}
                type="button"
              >
                ≡
              </button>
            </div>
            <div className="ids-group-label">Alignment</div>
          </div>

          <div className="ids-ribbon-group wide">
            <select
              className="ids-select"
              value={selectedBlock?.valueFormat || "number"}
              onChange={(event) =>
                applySelectedBlockValueFormat(
                  event.target.value as NonNullable<TemplateBlock["valueFormat"]>
                )
              }
            >
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="date">Date</option>
              <option value="percentage">Percentage</option>
              <option value="multiple">Multiple</option>
            </select>
            <select
              className="ids-select"
              value={selectedBlock?.stylePreset || "normal"}
              onChange={(event) =>
                applySelectedBlockStyle(
                  event.target.value as NonNullable<TemplateBlock["stylePreset"]>
                )
              }
            >
              <option value="normal">Normal</option>
              <option value="header">Header</option>
              <option value="highlight">Subtotal / Highlight</option>
              <option value="muted">Muted note</option>
            </select>
            <div className="ids-group-label">Value format & styles</div>
          </div>

          <div className="ids-ribbon-group">
            <button
              className="ids-soft-btn"
              onClick={() => {
                applySelectedBlockStyle(selectedBlock?.stylePreset || "normal");
                setStatusMessage("Current block formatting re-applied.");
              }}
              type="button"
            >
              🖌 Format Painter
            </button>
            <button
              className="ids-soft-btn"
              onClick={duplicateSelectedBlock}
              type="button"
            >
              ⧉ Duplicate block
            </button>
            <div className="ids-group-label">Clipboard</div>
          </div>

          <div className="ids-ribbon-group">
            <button
              className="ids-soft-btn"
              onClick={() => addBlock("letterhead")}
              type="button"
            >
              ⌂ Letterhead
            </button>
            <button
              className="ids-soft-btn"
              onClick={() => addBlock("signature")}
              type="button"
            >
              ✍ Signature
            </button>
            <div className="ids-group-label">Header & footer</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "insert") {
      return (
        <div className="ids-ribbon-grid">
          <div className="ids-ribbon-group wide">
            <div className="ids-tile-row">
              <button onClick={() => addBlock("summary")} type="button">
                📋
                <span>Summary</span>
              </button>
              <button onClick={() => addBlock("transactions")} type="button">
                ⇄
                <span>Transaction</span>
              </button>
              <button onClick={() => addBlock("financial")} type="button">
                📄
                <span>Financial</span>
              </button>
              <button onClick={() => addBlock("performance")} type="button">
                ↗
                <span>Performance</span>
              </button>
              <button onClick={() => addBlock("identity")} type="button">
                🪪
                <span>Identity</span>
              </button>
              <button onClick={() => addBlock("notes")} type="button">
                ☰
                <span>Text / Notes</span>
              </button>
            </div>
            <div className="ids-group-label">Insert AIF blocks</div>
          </div>

          <div className="ids-ribbon-group">
            <div className="ids-tile-row small">
              <button onClick={() => addBlock("signature")} type="button">
                ✍
                <span>Signature</span>
              </button>
              <button onClick={() => addBlock("letterhead")} type="button">
                ▣
                <span>Letterhead</span>
              </button>
              <button onClick={() => addBlock("chart")} type="button">
                📊
                <span>Chart</span>
              </button>
            </div>
            <div className="ids-group-label">Text & media</div>
          </div>

          <div className="ids-ribbon-group">
            <button className="ids-soft-btn" onClick={addPageBreakBlock} type="button">
              + Add page marker
            </button>
            <button
              className={`ids-soft-btn danger ${blocks.length <= 1 ? "disabled" : ""}`}
              disabled={blocks.length <= 1}
              onClick={deleteSelectedBlock}
              type="button"
            >
              × Delete block
            </button>
            <div className="ids-group-label">Pages / flow</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "layout") {
      return (
        <div className="ids-ribbon-grid">
          <div className="ids-ribbon-group">
            <div className="ids-margin-grid">
              <label>
                Left
                <input
                  value={pageMargins.left}
                  onChange={(event) => updatePageMargin("left", event.target.value)}
                />
              </label>
              <label>
                Right
                <input
                  value={pageMargins.right}
                  onChange={(event) => updatePageMargin("right", event.target.value)}
                />
              </label>
              <label>
                Top
                <input
                  value={pageMargins.top}
                  onChange={(event) => updatePageMargin("top", event.target.value)}
                />
              </label>
              <label>
                Bottom
                <input
                  value={pageMargins.bottom}
                  onChange={(event) => updatePageMargin("bottom", event.target.value)}
                />
              </label>
            </div>
            <div className="ids-group-label">Margins (mm)</div>
          </div>

          <div className="ids-ribbon-group">
            <div className="ids-info-pair">
              <span>Size</span>
              <strong>A4</strong>
            </div>
            <div className="ids-info-pair">
              <span>Orientation</span>
              <strong>Portrait</strong>
            </div>
            <div className="ids-group-label">Page</div>
          </div>

          <div className="ids-ribbon-group">
            <button
              className={`ids-soft-btn ${selectedBlockIndex <= 0 ? "disabled" : ""}`}
              disabled={selectedBlockIndex <= 0}
              onClick={() => moveSelectedBlock("up")}
              type="button"
            >
              ↑ Move up
            </button>

            <button
              className={`ids-soft-btn ${
                selectedBlockIndex === -1 || selectedBlockIndex >= blocks.length - 1
                  ? "disabled"
                  : ""
              }`}
              disabled={selectedBlockIndex === -1 || selectedBlockIndex >= blocks.length - 1}
              onClick={() => moveSelectedBlock("down")}
              type="button"
            >
              ↓ Move down
            </button>
            <div className="ids-group-label">Order in flow</div>
          </div>

          <div className="ids-ribbon-group wide">
            <label className="ids-check-row">
              <input
                checked={snapToGrid}
                onChange={(event) => {
                  setSnapToGrid(event.target.checked);
                  setStatusMessage(event.target.checked ? "Snap to grid enabled." : "Snap to grid disabled.");
                }}
                type="checkbox"
              />
              Snap to grid
            </label>
            <div className="ids-control-row">
              <button
                className="ids-soft-btn"
                onClick={() => setStatusMessage("Selected block brought to front in the template flow.")}
                type="button"
              >
                To Front
              </button>
              <button
                className="ids-soft-btn"
                onClick={() => setStatusMessage("Selected block sent to back in the template flow.")}
                type="button"
              >
                To Back
              </button>
            </div>
            <div className="ids-group-label">Arrange</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "view") {
      return (
        <div className="ids-ribbon-grid">
          <div className="ids-ribbon-group">
            <label className="ids-check-row">
              <input
                checked={showGrid}
                onChange={(event) => {
                  setShowGrid(event.target.checked);
                  setStatusMessage(event.target.checked ? "Grid shown." : "Grid hidden.");
                }}
                type="checkbox"
              />
              Grid
            </label>
            <label className="ids-check-row">
              <input
                checked={showRulers}
                onChange={(event) => {
                  setShowRulers(event.target.checked);
                  setStatusMessage(event.target.checked ? "Rulers shown." : "Rulers hidden.");
                }}
                type="checkbox"
              />
              Rulers
            </label>
            <label className="ids-check-row">
              <input
                checked={snapToGrid}
                onChange={(event) => setSnapToGrid(event.target.checked)}
                type="checkbox"
              />
              Snap to grid
            </label>
            <label className="ids-check-row">
              <input
                checked={showSampleValues}
                onChange={(event) => {
                  setShowSampleValues(event.target.checked);
                  setStatusMessage(
                    event.target.checked
                      ? "Sample values shown in template."
                      : "Merge field tokens shown in template."
                  );
                }}
                type="checkbox"
              />
              Sample values
            </label>
            <div className="ids-group-label">Show</div>
          </div>

          <div className="ids-ribbon-group">
            <select
              className="ids-select"
              value={showGrid ? "fine" : "off"}
              onChange={(event) => {
                setShowGrid(event.target.value !== "off");
                setStatusMessage(`Grid mode changed to ${event.target.value}.`);
              }}
            >
              <option value="fine">Grid — fine (¼)</option>
              <option value="medium">Grid — medium</option>
              <option value="off">Grid — off</option>
            </select>
            <p className="ids-mini-note">Zoom is live on the status bar.</p>
            <div className="ids-group-label">Grid</div>
          </div>
        </div>
      );
    }

    if (ribbonTab === "table") {
      if (!isConfigurableTableBlock(selectedBlock)) {
        return (
          <div className="ids-ribbon-grid">
            <div className="ids-ribbon-group wide">
              <div className="ids-mini-note">
                Select a Summary, Transaction or Financial table block to use Table Tools.
              </div>
              <button className="ids-soft-btn" onClick={() => addBlock("transactions")} type="button">
                Insert Transaction Table
              </button>
              <div className="ids-group-label">Table Tools</div>
            </div>
          </div>
        );
      }

      const config = selectedBlock.tableConfig || getDefaultTableConfigForBlock(selectedBlock);

      return (
        <div className="ids-ribbon-grid">
          <div className="ids-ribbon-group">
            <button
              className="ids-soft-btn"
              onClick={() => updateSelectedTableConfig({ repeatRows: !config.repeatRows })}
              type="button"
            >
              {config.repeatRows ? "Static Rows" : "Repeat Rows"}
            </button>

            <button className="ids-soft-btn" onClick={addTableColumn} type="button">
              + Add Column
            </button>

            <div className="ids-group-label">Rows & columns</div>
          </div>

          <div className="ids-ribbon-group wide">
            <select
              className="ids-select"
              value={config.repeatSource}
              onChange={(event) =>
                changeTableRepeatSource(
                  event.target.value as TableBlockConfig["repeatSource"]
                )
              }
            >
              <option value="transactions">Repeats from Transactions</option>
              <option value="pnl">P&L Line Items</option>
              <option value="cashflows">Repeats from Cashflows</option>
              <option value="capitalAccount">Repeats from Capital Account</option>
              <option value="taxBreakup">Repeats from Tax Breakup</option>
              <option value="distributionDetails">Repeats from Distribution Details</option>
              <option value="unitMovements">Repeats from Unit Movements</option>
              <option value="portfolioPerformance">Repeats from Portfolio Performance</option>
              <option value="genericTable">Repeats from Generic Table</option>
            </select>

            <div className="ids-group-label">Repeat with data</div>
          </div>

          <div className="ids-ribbon-group">
            {(["all", "horizontal", "none"] as TableBlockConfig["borderPreset"][]).map(
              (borderPreset) => (
                <button
                  className={`ids-soft-btn ${config.borderPreset === borderPreset ? "active-tool" : ""}`}
                  key={borderPreset}
                  onClick={() => {
                    updateSelectedTableConfig({ borderPreset });
                    setStatusMessage(`${borderPreset} table border applied.`);
                  }}
                  type="button"
                >
                  {borderPreset === "all"
                    ? "All Borders"
                    : borderPreset === "horizontal"
                    ? "Horizontal"
                    : "No Borders"}
                </button>
              )
            )}
            <div className="ids-group-label">Borders</div>
          </div>

          <div className="ids-ribbon-group">
            {(["gold", "minimal", "dark", "light"] as TableBlockConfig["headerStyle"][]).map(
              (headerStyle) => (
                <button
                  className={`ids-soft-btn ${config.headerStyle === headerStyle ? "active-tool" : ""}`}
                  key={headerStyle}
                  onClick={() => {
                    updateSelectedTableConfig({ headerStyle });
                    setStatusMessage(`${headerStyle} table header style applied.`);
                  }}
                  type="button"
                >
                  {headerStyle === "gold"
                    ? "Gold Header"
                    : headerStyle === "minimal"
                    ? "Minimal Header"
                    : headerStyle === "dark"
                    ? "Dark Header"
                    : "Light Header"}
                </button>
              )
            )}
            <div className="ids-group-label">Header style</div>
          </div>
        </div>
      );
    }

    return (
      <div className="ids-ribbon-grid">
        <div className="ids-ribbon-group">
          <select
            className="ids-select"
            value={selectedBlock?.kind === "chart" ? selectedBlock.chartType || "bar" : "bar"}
            onChange={(event) =>
              updateChartBlock({
                chartType: event.target.value as NonNullable<TemplateBlock["chartType"]>,
              })
            }
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="waterfall">Waterfall</option>
          </select>

          <select
            className="ids-select"
            value={selectedBlock?.kind === "chart" ? selectedBlock.chartSeries || "current_nav" : "current_nav"}
            onChange={(event) => updateChartBlock({ chartSeries: event.target.value })}
          >
            <option value="current_nav">Series: {`{current_nav}`}</option>
            <option value="distribution_amount">Series: {`{distribution_amount}`}</option>
            <option value="dpi">Series: {`{dpi}`}</option>
            <option value="tvpi">Series: {`{tvpi}`}</option>
            <option value="irr">Series: {`{irr}`}</option>
          </select>

          <div className="ids-group-label">Chart type & series</div>
        </div>

        <div className="ids-ribbon-group wide">
          <input
            className="ids-select"
            value={selectedBlock?.kind === "chart" ? selectedBlock.content || "Portfolio Movement Chart" : "Portfolio Movement Chart"}
            onChange={(event) => updateChartBlock({ content: event.target.value })}
            placeholder="Chart title"
          />
          <button
            className="ids-soft-btn"
            onClick={() => updateChartBlock({})}
            type="button"
          >
            Insert / Select Chart
          </button>

          <div className="ids-group-label">Chart fields</div>
        </div>
      </div>
    );
  }

  function renderTemplateBlock(block: TemplateBlock) {
    const isSelected = block.id === selectedBlockId;

    return (
      <div
        className={`ids-doc-block ${block.kind} ${isSelected ? "selected" : ""} block-align-${block.align || "left"} block-style-${block.stylePreset || "normal"}`}
        key={block.id}
        onClick={() => {
          setSelectedBlockId(block.id);

         if (isConfigurableTableBlock(block)) {
  setRibbonTab("table");
  setMergeMode("column");
} else if (block.kind === "chart") {
            setRibbonTab("chart");
            setMergeMode("calculated");
          } else {
            setRibbonTab("home");
            setMergeMode("cell");
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="ids-block-tag">{block.title}</span>

        {block.kind === "letterhead" && (
          <div className="ids-letterhead">
            <div>
              <strong>{getInvestorValue(selectedInvestor, "fund_name")}</strong>
              <span>Registered AIF | GIFT City</span>
            </div>
            <div className="ids-logo-box">VENTIQ</div>
          </div>
        )}

        {block.kind === "identity" && (
          <div className="ids-identity-grid">
            <div>
              <span>Investor</span>
              <strong>{getInvestorValue(selectedInvestor, "investor_name")}</strong>
            </div>
            <div>
              <span>Folio</span>
              <strong>{getInvestorValue(selectedInvestor, "investor_code")}</strong>
            </div>
            <div>
              <span>Statement period</span>
              <strong>{getInvestorValue(selectedInvestor, "statement_period")}</strong>
            </div>
            <div>
              <span>Report date</span>
              <strong>{getInvestorValue(selectedInvestor, "report_date")}</strong>
            </div>
          </div>
        )}

       

      
        {isConfigurableTableBlock(block) && (
  <table
  className={`ids-template-table table-border-${
    block.tableConfig?.borderPreset || "all"
  } table-header-${block.tableConfig?.headerStyle || "gold"}`}
>
    <thead>
      <tr>
        <th colSpan={block.tableConfig?.columns.length || 3}>
          {getTableTitle(block)}
        </th>
      </tr>

      <tr>
        {(block.tableConfig?.columns || getDefaultTableConfigForBlock(block).columns).map(
          (column) => (
            <th
              className={column.align === "right" ? "right" : ""}
              key={column.id}
            >
              {column.header}
            </th>
          )
        )}
      </tr>
    </thead>

    <tbody>
      {(block.tableConfig?.repeatRows ? [0, 1, 2] : [0]).map((rowIndex) => (
        <tr key={`sample-row-${block.id}-${rowIndex}`}>
          {(block.tableConfig?.columns || getDefaultTableConfigForBlock(block).columns).map(
            (column) => (
              <td
                className={column.align === "right" ? "right" : ""}
                key={`${block.id}-${rowIndex}-${column.id}`}
              >
                {showSampleValues
                  ? getSampleValueForTableField(column.fieldKey)
                  : `{${column.fieldKey}}`}
              </td>
            )
          )}
        </tr>
      ))}

      <tr>
        <td colSpan={block.tableConfig?.columns.length || 3}>
          <span className="ids-repeat-pill">
            {block.tableConfig?.repeatRows ? "↻ repeats from" : "Static table from"}{" "}
            {block.tableConfig?.repeatSource || block.repeatSource || "table"} ·{" "}
            {block.tableConfig?.columns.length || 3} mapped columns
          </span>
        </td>
      </tr>
    </tbody>
  </table>
)}

        {block.kind === "performance" && (
          <div className="ids-performance-grid">
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

        {block.kind === "chart" && (
          <div className={`ids-chart-box chart-${block.chartType || "bar"}`}>
            <h4>{block.content || "Portfolio Movement Chart"}</h4>
            <div className="ids-bars">
              <span style={{ height: block.chartType === "line" ? "58%" : "48%" }} />
              <span style={{ height: block.chartType === "waterfall" ? "64%" : "72%" }} />
              <span style={{ height: block.chartType === "line" ? "76%" : "58%" }} />
              <span style={{ height: "86%" }} />
            </div>
            <p>{`Series binds to {${block.chartSeries || "current_nav"}}`}</p>
          </div>
        )}

        {block.kind === "notes" && (
  <div className="ids-note-block">
    {renderContentWithSampleValues(
      block.content ||
        "This statement is generated based on the books and records of the Fund as on {report_date}."
    )}
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
          <button className="active" type="button">
            Page 1
          </button>
          <button type="button">+ Page</button>
        </div>

        <div className="ids-canvas-wrap">
          {showRulers && <div className="ids-ruler-top" />}
          <div className={`ids-canvas-grid ${showGrid ? "" : "grid-off"}`}>
            <div
              className="ids-a4-page"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
            >
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
          <span>{selectedBlock?.title ?? "No tile selected"}</span>
        </div>

        <div className="ids-selected-context">
  <p>Selected block</p>
  <strong>{selectedBlock?.title ?? "No selection"}</strong>
  <span>{selectedBlock?.subtitle ?? "Select a block to configure."}</span>
</div>

<div className="ids-block-editor">
  <label>
    Block title
    <input
      value={selectedBlock?.title ?? ""}
      onChange={(event) =>
        renameSelectedBlock("title", event.target.value)
      }
      placeholder="Enter block title"
    />
  </label>

  <label>
    Block description
    <textarea
      value={selectedBlock?.subtitle ?? ""}
      onChange={(event) =>
        renameSelectedBlock("subtitle", event.target.value)
      }
      placeholder="Enter block description"
      rows={3}
    />
  </label>
</div>
{(selectedBlock?.kind === "notes" || selectedBlock?.kind === "signature") && (
  <div className="ids-block-editor">
    <label>
      {selectedBlock.kind === "notes" ? "Notes content" : "Signature role"}
      {selectedBlock.kind === "notes" ? (
        <textarea
          value={
            selectedBlock.content ||
            "This statement is generated based on the books and records of the Fund as on {report_date}."
          }
          onChange={(event) =>
            updateSelectedBlock({ content: event.target.value })
          }
          placeholder="Enter note content"
          rows={4}
        />
      ) : (
        <input
          value={selectedBlock.content || "Authorized Signatory"}
          onChange={(event) =>
            updateSelectedBlock({ content: event.target.value })
          }
          placeholder="Enter signature role"
        />
      )}
    </label>
  </div>
)}
        <div className="ids-merge-tabs">
          <button
            className={mergeMode === "cell" ? "active" : ""}
            onClick={() => setMergeMode("cell")}
            type="button"
          >
            Cell fields
          </button>
          <button
            className={mergeMode === "column" ? "active" : ""}
            onClick={() => setMergeMode("column")}
            type="button"
          >
            Column fields
          </button>
          <button
            className={mergeMode === "calculated" ? "active" : ""}
            onClick={() => setMergeMode("calculated")}
            type="button"
          >
            Calculated
          </button>
          <button
            className={mergeMode === "import" ? "active" : ""}
            onClick={() => setMergeMode("import")}
            type="button"
          >
            Import AI
          </button>
        </div>

        {mergeMode === "cell" && (
          <div className="ids-panel-body">
            <input className="ids-search" placeholder="Search fields..." />

            <div className="ids-chip-row">
              {["Fund", "Investor Info", "Capital Account", "P&L", "Performance"].map(
                (category) => (
                  <button key={category} type="button">
                    {category}
                  </button>
                )
              )}
            </div>

            <div className="ids-field-list">
              {cellFields.map((field) => (
                <button
                  key={field.code}
                  onClick={() => insertField(field)}
                  type="button"
                >
                  <span>
                    {field.label}
                    <small>{field.sample}</small>
                  </span>
                  <em>{field.type}</em>
                  <code>{`{${field.code}}`}</code>
                </button>
              ))}
            </div>
          </div>
        )}
{isConfigurableTableBlock(selectedBlock) && (
  <div className="ids-field-panel">
    <div className="ids-panel-heading">
      <div>
        <p className="ids-eyebrow">Table Tools</p>
        <h3>Table source and column mapping</h3>
      </div>
    </div>

    <label className="ids-form-label">
      Repeat source
      <select
        value={selectedBlock.tableConfig?.repeatSource || "transactions"}
        onChange={(event) =>
          changeTableRepeatSource(
            event.target.value as TableBlockConfig["repeatSource"]
          )
        }
      >
        <option value="transactions">Transactions</option>
        <option value="pnl">P&L Line Items</option>
        <option value="cashflows">Cashflows</option>
        <option value="capitalAccount">Capital Account</option>
        <option value="taxBreakup">Tax Breakup</option>
        <option value="distributionDetails">Distribution Details</option>
        <option value="unitMovements">Unit Movements</option>
        <option value="portfolioPerformance">Portfolio Performance</option>
        <option value="genericTable">Generic Table</option>
      </select>
    </label>

    <div className="ids-table-config-summary">
      <span>
        Rows:{" "}
        {selectedBlock.tableConfig?.repeatRows
          ? "Repeat with investor data"
          : "Static rows"}
      </span>
      <span>
        Borders: {selectedBlock.tableConfig?.borderPreset || "all"}
      </span>
      <span>
        Header: {selectedBlock.tableConfig?.headerStyle || "gold"}
      </span>
    </div>

    <div className="ids-column-config-list">
      {(selectedBlock.tableConfig?.columns || createTableConfig().columns).map(
        (column) => (
          <div className="ids-column-config-card" key={column.id}>
            <div className="ids-column-config-top">
              <input
                value={column.header}
                onChange={(event) =>
                  updateSelectedTableColumn(column.id, {
                    header: event.target.value,
                  })
                }
              />

              <button
                onClick={() => deleteTableColumn(column.id)}
                type="button"
              >
                Delete
              </button>
            </div>

            <label>
              Field mapping
              <select
                value={column.fieldKey}
                onChange={(event) => {
                  const selectedField = tableFieldOptions[
                    selectedBlock.tableConfig?.repeatSource || "transactions"
                  ].find((field) => field.value === event.target.value);

                  updateSelectedTableColumn(column.id, {
                    fieldKey: event.target.value,
                    format:
                      (selectedField?.format as TableColumnConfig["format"]) ||
                      column.format,
                  });
                }}
              >
                {tableFieldOptions[
                  selectedBlock.tableConfig?.repeatSource || "transactions"
                ].map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="ids-column-config-grid">
              <label>
                Format
                <select
                  value={column.format}
                  onChange={(event) =>
                    updateSelectedTableColumn(column.id, {
                      format: event.target.value as TableColumnConfig["format"],
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="currency">Currency</option>
                  <option value="number">Number</option>
                  <option value="percentage">Percentage</option>
                </select>
              </label>

              <label>
                Align
                <select
                  value={column.align}
                  onChange={(event) =>
                    updateSelectedTableColumn(column.id, {
                      align: event.target.value as TableColumnConfig["align"],
                    })
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
        )
      )}
    </div>
  </div>
)}
        {mergeMode === "column" && (
          <div className="ids-panel-body">
            <p className="ids-muted">Table repeats from</p>
            <select
              className="ids-select full"
              value={selectedColumnSource}
              onChange={(event) => setSelectedColumnSource(event.target.value)}
            >
              {columnSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>

            <div className="ids-source-card">
              <strong>{activeColumnSource.label}</strong>
              <span>{activeColumnSource.description}</span>
            </div>

            <p className="ids-muted">Map selected column to</p>

            <div className="ids-field-list compact">
              {activeColumnSource.fields.map((field) => (
                <button
                  key={field.code}
                  onClick={() => insertField(field)}
                  type="button"
                >
                  <span>
                    {field.label}
                    <small>{field.sample}</small>
                  </span>
                  <code>{field.code}</code>
                </button>
              ))}
            </div>

            <div className="ids-explain">
              Column fields are used when the table repeats investor-wise rows,
              such as transactions, cashflows, tax breakup or P&L line items.
            </div>
          </div>
        )}

        {mergeMode === "calculated" && (
          <div className="ids-panel-body">
            <div className="ids-formula-box">
              <label>New calculated field</label>
              <input
                value={formulaName}
                onChange={(event) => setFormulaName(event.target.value)}
                placeholder="e.g. net_income"
              />
              <textarea
                value={formulaExpression}
                onChange={(event) => setFormulaExpression(event.target.value)}
                placeholder="Formula: gross_income - total_expenses - tds"
                rows={3}
              />
              <div className="ids-chip-row">
                <button onClick={() => appendFormulaToken("+")} type="button">+</button>
                <button onClick={() => appendFormulaToken("-")} type="button">−</button>
                <button onClick={() => appendFormulaToken("×")} type="button">×</button>
                <button onClick={() => appendFormulaToken("÷")} type="button">÷</button>
                <button onClick={() => appendFormulaToken("XIRR()") } type="button">XIRR</button>
              </div>
              <button
                className="ids-gold-btn full"
                onClick={saveCalculatedField}
                type="button"
              >
                Save calculated field
              </button>
            </div>

            <div className="ids-field-list compact">
              {availableCalculatedFields.map((field) => (
                <button
                  key={field.code}
                  onClick={() => insertField(field)}
                  type="button"
                >
                  <span>
                    {field.label}
                    <small>{field.sample}</small>
                  </span>
                  <em>{field.type}</em>
                  <code>{`{${field.code}}`}</code>
                </button>
              ))}
            </div>
          </div>
        )}

               {mergeMode === "import" && (
          <div className="ids-panel-body">
            <div className="ids-import-score">
              <strong>
                {importResult?.importConfidence !== undefined
                  ? `${importResult.importConfidence}%`
                  : importDone
                  ? "87%"
                  : "—"}
              </strong>
              <span>Import confidence</span>
            </div>

            <div className="ids-import-grid">
              <div>
                <strong>
                  {importResult?.suggestedBlocks?.filter(
                    (block) =>
                      block.kind === "transactions" ||
                      block.kind === "financial" ||
                      block.kind === "summary"
                  ).length ?? (importDone ? 5 : 0)}
                </strong>
                <span>Tables / blocks detected</span>
              </div>

              <div>
                <strong>
                  {importResult?.detectedFields?.length ?? (importDone ? 23 : 0)}
                </strong>
                <span>Fields detected</span>
              </div>

              <div>
                <strong>
                  {Math.max(
                    0,
                    (importResult?.detectedFields?.length ?? 0) -
                      (importResult?.unmappedItems?.length ?? 0)
                  ) || (importDone ? 19 : 0)}
                </strong>
                <span>Auto-mapped</span>
              </div>

              <div>
                <strong>
                  {importResult?.unmappedItems?.length ?? (importDone ? 4 : 0)}
                </strong>
                <span>Need review</span>
              </div>
            </div>

            {importResult?.detectedDocumentType && (
              <div className="ids-source-card">
                <strong>Detected activity</strong>
                <span>{importResult.detectedDocumentType}</span>
              </div>
            )}

            {importResult?.detectedSections &&
              importResult.detectedSections.length > 0 && (
                <div className="ids-source-card">
                  <strong>Detected sections</strong>
                  <span>{importResult.detectedSections.join(" · ")}</span>
                </div>
              )}

            {importResult?.detectedFields &&
              importResult.detectedFields.length > 0 && (
                <div className="ids-source-card">
                  <strong>Detected merge fields</strong>
                  <div className="ids-chip-row">
                    {importResult.detectedFields.slice(0, 18).map((field) => (
                      <button key={field} type="button">
                        {`{${field}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {importResult?.unmappedItems &&
              importResult.unmappedItems.length > 0 && (
                <div className="ids-source-card">
                  <strong>Needs mapping review</strong>
                  <div className="ids-chip-row">
                    {importResult.unmappedItems.slice(0, 12).map((field) => (
                      <button key={field} type="button">
                        {`{${field}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <button
              className="ids-primary-btn full"
              disabled={apiBusy}
              onClick={simulateImport}
              type="button"
            >
              {apiBusy ? "Importing..." : "Import Word/PDF Template"}
            </button>

            <div className="ids-explain">
              Word .docx templates are parsed for merge fields, AIF sections and
              smart block suggestions. PDF upload is stored and classified now;
              deep PDF layout extraction will come in the next version.
            </div>
          </div>
        )}
      </aside>
    );
  }

 function renderPreview() {
  const mergedFields = previewMergeData?.mergedFields ?? {};

  function previewValue(code: string, fallback: string) {
    const value = mergedFields[code];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    return fallback;
  }

  const previewInvestorName = previewValue(
    "investor_name",
    selectedInvestor.name
  );

  const previewInvestorCode = previewValue(
    "investor_code",
    selectedInvestor.code
  );

  const previewInvestorType = previewValue(
    "investor_type",
    selectedInvestor.type
  );

  const previewFundName = previewValue("fund_name", selectedInvestor.fundName);

  const previewTransactions =
    previewMergeData?.tables?.transactions &&
    previewMergeData.tables.transactions.length > 0
      ? previewMergeData.tables.transactions
      : [
          {
            date: "24-Apr-24",
            description: "Units Allotment",
            amount: "₹1,98,82,000",
          },
          {
            date: "24-Apr-24",
            description: "Setup Fees (One-time)",
            amount: "₹1,18,000",
          },
          {
            date: "02-Jul-24",
            description: "Quarterly Income Distribution June 2024",
            amount: "₹5,91,981",
          },
        ];

  return (
    <div className="ids-preview-layout">
      <div className="ids-preview-toolbar">
        <div>
          <h2>PDF Preview</h2>
          <p>
            Previewing {selectedDocumentType} for {previewInvestorName}. Merge
            fields are replaced with investor-specific migrated data.
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
            className="ids-primary-btn"
            disabled={apiBusy}
            onClick={runBatch}
            type="button"
          >
            {apiBusy ? "Preparing..." : "Generate Batch"}
          </button>
        </div>
      </div>

      {previewMergeData?.sourceCounts && (
        <div className="ids-import-hero" style={{ marginBottom: 22 }}>
          <div>
            <p className="ids-eyebrow">Live Merge Data</p>
            <h3>Preview is connected to migrated investor records</h3>
            <p>
              Commitment rows: {previewMergeData.sourceCounts.commitmentRows} ·
              Financial position rows:{" "}
              {previewMergeData.sourceCounts.positionRows} · Cashflow rows:{" "}
              {previewMergeData.sourceCounts.cashflowRows} · Document rows:{" "}
              {previewMergeData.sourceCounts.documentRows}
            </p>
          </div>
        </div>
      )}

      <div className="ids-pdf-page">
        <div className="ids-pdf-header">
          <div>
            <h2>{previewFundName}</h2>
            <p>
              {selectedDocumentType} ·{" "}
              {previewValue("statement_period", "Q1 FY 2025-26")}
            </p>
          </div>
          <strong>VENTIQ</strong>
        </div>

        <div className="ids-pdf-section">
          <h3>Investor Details</h3>
          <div className="ids-pdf-grid">
            <span>Investor Name</span>
            <strong>{previewInvestorName}</strong>

            <span>Folio Code</span>
            <strong>{previewInvestorCode}</strong>

            <span>Investor Type</span>
            <strong>{previewInvestorType}</strong>

            <span>Report Date</span>
            <strong>{previewValue("report_date", "30-Jun-2025")}</strong>
          </div>
        </div>

        <div className="ids-pdf-section">
          <h3>Capital Account Summary</h3>
          <table>
            <tbody>
              <tr>
                <td>Commitment Amount</td>
                <td>
                  {previewValue("commitment_amount", selectedInvestor.commitment)}
                </td>
              </tr>
              <tr>
                <td>Capital Called</td>
                <td>
                  {previewValue("capital_called", selectedInvestor.capitalCalled)}
                </td>
              </tr>
              <tr>
                <td>Uncalled Capital</td>
                <td>
                  {previewValue(
                    "uncalled_capital",
                    selectedInvestor.uncalledCapital
                  )}
                </td>
              </tr>
              <tr>
                <td>Current NAV</td>
                <td>{previewValue("current_nav", selectedInvestor.nav)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ids-pdf-section">
          <h3>Transactions</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {previewTransactions.map((transaction, index) => (
                <tr key={`${transaction.date}-${transaction.description}-${index}`}>
                  <td>{transaction.date || "-"}</td>
                  <td>{transaction.description || "-"}</td>
                  <td>{transaction.amount || "₹0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ids-pdf-section">
          <h3>Performance</h3>
          <div className="ids-pdf-metrics">
            <div>
              <span>DPI</span>
              <strong>{previewValue("dpi", selectedInvestor.dpi)}</strong>
            </div>
            <div>
              <span>TVPI</span>
              <strong>{previewValue("tvpi", selectedInvestor.tvpi)}</strong>
            </div>
            <div>
              <span>IRR</span>
              <strong>{previewValue("irr", selectedInvestor.irr)}</strong>
            </div>
            <div>
              <span>Distribution</span>
              <strong>
                {previewValue(
                  "distribution_amount",
                  selectedInvestor.distribution
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="ids-pdf-signature">
          <span>For {previewFundName}</span>
          <strong>Authorized Signatory</strong>
        </div>
      </div>
    </div>
  );
}
  function renderLibrary() {
    return (
      <div className="ids-simple-page">
        <div className="ids-studio-hero">
          <p className="ids-eyebrow">Template Library</p>
          <h2>Build once. Generate investor-wise forever.</h2>
          <p>
  Store SOA, capital call, distribution, Form 64C/64D and annual
  income report templates as smart VENTIQ documents. Saved templates in
  database: {savedTemplates.length}.
</p>
        </div>

        <div className="ids-card-grid">
          {[
            "Statement of Account",
            "Capital Call Notice",
            "Distribution Notice",
            "Form 64C",
            "Annual Income Report",
            "Unit Statement",
          ].map((template) => (
            <button
              className="ids-template-card"
              key={template}
              onClick={() => {
                setSelectedDocumentType(template);
                setWorkspaceTab("builder");
                setStatusMessage(`${template} opened in Template Builder.`);
              }}
              type="button"
            >
              <strong>{template}</strong>
              <span>Smart merge fields · AIF blocks · PDF preview</span>
            </button>
          ))}
        </div>

        <div className="ids-import-hero">
          <div>
            <p className="ids-eyebrow">Import Existing Template</p>
            <h3>Upload old Word/PDF and auto-create 80–90% of the template</h3>
            <p>
              VENTIQ will detect tables, headings, fields, signature blocks,
              charts and merge-field candidates, then create an editable smart
              template.
            </p>
          </div>

          <button className="ids-primary-btn" onClick={simulateImport} type="button">
            Import Existing Template
          </button>
        </div>
      </div>
    );
  }

  function renderBatch() {
  const batch = batchResult?.batch;

  return (
    <div className="ids-simple-page">
      <div className="ids-studio-hero">
        <p className="ids-eyebrow">Batch Generation</p>
        <h2>Generate investor-wise PDFs from one template</h2>
        <p>
          Prepare the queue, generate actual PDF files, then publish the final
          documents to Investor Portal.
        </p>
      </div>

      <div className="ids-batch-card">
        <label>
          Template
          <select
            className="ids-select full"
            value={selectedDocumentType}
            onChange={(event) => setSelectedDocumentType(event.target.value)}
          >
            {documentTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <div className="ids-action-row" style={{ marginTop: 16 }}>
          <button
            className="ids-primary-btn"
            disabled={apiBusy}
            onClick={runBatch}
            type="button"
          >
            {apiBusy ? "Preparing..." : "1. Prepare Batch"}
          </button>

          <button
            className="ids-primary-btn"
            disabled={apiBusy || !batch}
            onClick={generatePdfFiles}
            type="button"
          >
            {apiBusy ? "Generating..." : "2. Generate PDF Files"}
          </button>

          <button
            className="ids-secondary-btn"
            disabled={apiBusy || !pdfGenerationResult}
            onClick={publishQueue}
            type="button"
          >
            3. Publish Queue
          </button>
        </div>

        {batch && (
          <div className="ids-import-hero" style={{ marginTop: 22 }}>
            <div>
              <p className="ids-eyebrow">Batch Prepared</p>
              <h3>{batch.batch_name}</h3>
              <p>
                Total investors: {batch.total_investors} · Ready:{" "}
                {batch.ready_count} · Review: {batch.review_count} · Queued
                documents: {batchResult?.queuedDocuments ?? 0}
              </p>
            </div>
          </div>
        )}

        {pdfGenerationResult && (
          <div className="ids-import-hero" style={{ marginTop: 22 }}>
            <div>
              <p className="ids-eyebrow">PDF Files Generated</p>
              <h3>
                {pdfGenerationResult.generatedDocuments} PDF file(s) generated
              </h3>
              <p>
                Failed: {pdfGenerationResult.failedDocuments ?? 0}. Files are
                uploaded to Supabase Storage and linked to the generation queue.
              </p>
            </div>
          </div>
        )}

        {!batch && (
          <div className="ids-explain" style={{ marginTop: 22 }}>
            Batch is not prepared yet. Click “Prepare Batch” to create a
            generation queue from investor_master.
          </div>
        )}

        {pdfGenerationResult?.documents &&
          pdfGenerationResult.documents.length > 0 && (
            <div className="ids-investor-list">
              {pdfGenerationResult.documents.slice(0, 10).map((document) => (
                <div key={`${document.investor_code}-${document.file_name}`}>
                  <span>
                    <strong>{document.investor_name}</strong>
                    <small>
                      {document.investor_code} · {document.file_name}
                    </small>
                  </span>

                  {document.file_url ? (
                    <a
                      className="ids-secondary-btn"
                      href={document.file_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open PDF
                    </a>
                  ) : (
                    <em className="review">No URL</em>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
function renderPublish() {
  const batch = batchResult?.batch;
  const hasGeneratedPdfs =
    Boolean(pdfGenerationResult?.generatedDocuments) &&
    Number(pdfGenerationResult?.generatedDocuments) > 0;

  return (
    <div className="ids-simple-page">
      <div className="ids-studio-hero">
        <p className="ids-eyebrow">Publish Queue</p>
        <h2>Push approved PDF files to Investor Portal</h2>
        <p>
          Final generated PDF records are inserted into investor_documents and
          become visible inside the Investor Portal.
        </p>
      </div>

      {!batch && (
        <div className="ids-explain" style={{ marginTop: 22 }}>
          No batch is prepared yet. Go to Batch Generation and prepare a batch
          first.
        </div>
      )}

      {batch && !hasGeneratedPdfs && (
        <div className="ids-explain" style={{ marginTop: 22 }}>
          Batch is prepared, but PDF files are not generated yet. Go back to
          Batch Generation and click “Generate PDF Files”.
        </div>
      )}

      {batch && (
        <>
          <div className="ids-import-hero" style={{ marginTop: 22 }}>
            <div>
              <p className="ids-eyebrow">Current Batch</p>
              <h3>{batch.batch_name}</h3>
              <p>
                Total investors: {batch.total_investors} · Generated PDFs:{" "}
                {pdfGenerationResult?.generatedDocuments ?? 0} · Already
                published:{" "}
                {publishResult?.publishedDocuments ?? batch.published_count ?? 0}
              </p>
            </div>

            <button
              className="ids-primary-btn"
              disabled={apiBusy || !hasGeneratedPdfs}
              onClick={publishQueue}
              type="button"
            >
              {apiBusy ? "Publishing..." : "Publish to Investor Portal"}
            </button>
          </div>

          {publishResult && (
            <div className="ids-import-hero" style={{ marginTop: 22 }}>
              <div>
                <p className="ids-eyebrow">Published</p>
                <h3>{publishResult.publishedDocuments} PDF records pushed</h3>
                <p>
                  These records are now available in investor_documents and can
                  be surfaced inside the Investor Portal.
                </p>
              </div>

              <a className="ids-primary-btn" href="/investor-portal">
                Open Investor Portal
              </a>
            </div>
          )}

          <div className="ids-publish-grid">
            {(pdfGenerationResult?.documents ?? investors).map((item: any) => {
              const investorName = item.investor_name || item.name;
              const investorCode = item.investor_code || item.code;

              return (
                <div className="ids-publish-card" key={investorCode}>
                  <strong>{investorName}</strong>
                  <span>{investorCode}</span>
                  <p>{selectedDocumentType}</p>
                  <em>
                    {publishResult ? "Published to Portal" : "Ready to publish"}
                  </em>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

  return (
    <main className="ids-page">
      <div className="ids-shell">
        <div className="ids-top-header">
          <div>
            <p className="ids-eyebrow">VENTIQ Investor Document Studio</p>
            <h1>AIF document templates, merge fields and PDF generation</h1>
            <p>
              Import existing Word/PDF templates, convert them into smart AIF
              blocks, preview investor-wise output and batch-generate PDFs.
            </p>
          </div>

          <a className="ids-home-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="ids-workspace-tabs">
          <button
            className={workspaceTab === "library" ? "active" : ""}
            onClick={() => setWorkspaceTab("library")}
            type="button"
          >
            Template Library
          </button>
          <button
            className={workspaceTab === "builder" ? "active" : ""}
            onClick={() => setWorkspaceTab("builder")}
            type="button"
          >
            Template Builder
          </button>
          <button
            className={workspaceTab === "preview" ? "active" : ""}
            onClick={previewTemplate}
            type="button"
          >
            PDF Preview
          </button>
          <button
            className={workspaceTab === "batch" ? "active" : ""}
            onClick={runBatch}
            type="button"
          >
            Batch Generation
          </button>
          <button
            className={workspaceTab === "publish" ? "active" : ""}
            onClick={publishQueue}
            type="button"
          >
            Publish Queue
          </button>
                </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          onChange={importTemplateFile}
          style={{ display: "none" }}
        />

        {workspaceTab === "builder" && (
          <div className="ids-studio-frame">
            <div className="ids-title-bar">
              <div className="ids-undo-group">
                <button type="button">↶</button>
                <button type="button">↷</button>
              </div>

              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />

             <button
  className="ids-primary-btn"
  disabled={apiBusy}
  onClick={saveTemplate}
  type="button"
>
  {apiBusy ? "Working..." : "Save"}
</button>

<button
  className="ids-primary-btn"
  disabled={apiBusy}
  onClick={previewTemplate}
  type="button"
>
  {apiBusy ? "Working..." : "Preview"}
</button>

              <span>Preview as</span>

              <select
                value={selectedInvestorId}
                onChange={(event) => setSelectedInvestorId(event.target.value)}
              >
                {investors.map((investor) => (
                  <option key={investor.id} value={investor.id}>
                    {investor.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedDocumentType}
                onChange={(event) => setSelectedDocumentType(event.target.value)}
              >
                {documentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>

              <button onClick={startNewTemplate} type="button">
                New
              </button>
              <button onClick={simulateImport} type="button">
                Import Word/PDF
              </button>
              <button onClick={() => setWorkspaceTab("library")} type="button">
                Open
              </button>
            </div>

            <div className="ids-ribbon-tabs">
              {(["home", "insert", "layout", "view", "table", "chart"] as RibbonTab[]).map(
                (tab) => (
                  <button
                    className={ribbonTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => setRibbonTab(tab)}
                    type="button"
                  >
                    {tab === "home"
                      ? "Home"
                      : tab === "insert"
                      ? "Insert"
                      : tab === "layout"
                      ? "Layout"
                      : tab === "view"
                      ? "View"
                      : tab === "table"
                      ? "Table Tools"
                      : "Chart Tools"}
                  </button>
                )
              )}
            </div>

            <div className="ids-ribbon-content">{renderRibbon()}</div>

            {renderBuilder()}

            <div className="ids-status-bar">
              <span>Page 1 of 1</span>
              <span>{selectedBlock?.title ?? "No block selected"}</span>
              <span>{statusMessage}</span>
              <div>
                <button
                  onClick={() => setZoomLevel((current) => Math.max(50, current - 10))}
                  type="button"
                >
                  −
                </button>
                <input
                  type="range"
                  min="50"
                  max="160"
                  value={zoomLevel}
                  onChange={(event) => setZoomLevel(Number(event.target.value))}
                />
                <button
                  onClick={() => setZoomLevel((current) => Math.min(160, current + 10))}
                  type="button"
                >
                  +
                </button>
                <strong>{zoomLevel}%</strong>
              </div>
            </div>
          </div>
        )}

        {workspaceTab === "library" && renderLibrary()}
        {workspaceTab === "preview" && renderPreview()}
        {workspaceTab === "batch" && renderBatch()}
        {workspaceTab === "publish" && renderPublish()}
      </div>

      <style>{`
        .ids-page {
          min-height: 100vh;
          background: #f5f2ea;
          color: #0b1833;
          padding: 28px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ids-shell {
          max-width: 1600px;
          margin: 0 auto;
        }

        .ids-top-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .ids-eyebrow {
          color: #9a7312;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin: 0 0 8px;
        }

        .ids-top-header h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        .ids-top-header p {
          margin: 8px 0 0;
          color: #5f6b80;
          max-width: 820px;
          font-size: 16px;
          line-height: 1.5;
        }

        .ids-home-link {
          color: #0b1833;
          text-decoration: none;
          border: 1px solid #ded4bf;
          border-radius: 12px;
          padding: 10px 14px;
          background: #fffaf1;
          font-weight: 700;
        }

        .ids-workspace-tabs {
          display: inline-flex;
          background: #fffaf1;
          border: 1px solid #e1d6bd;
          border-radius: 14px;
          padding: 5px;
          gap: 4px;
          margin-bottom: 16px;
        }

        .ids-workspace-tabs button {
          border: 0;
          background: transparent;
          padding: 10px 16px;
          border-radius: 10px;
          color: #475569;
          font-weight: 700;
          cursor: pointer;
        }

        .ids-workspace-tabs button.active {
          background: #9a7312;
          color: white;
        }

        .ids-studio-frame {
          border: 1px solid #e0d4bd;
          background: #fffaf3;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        }

        .ids-title-bar {
          display: grid;
          grid-template-columns: auto 250px auto auto auto 240px 300px auto auto auto;
          gap: 10px;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #e6dcc9;
          background: #fbf7ef;
        }

        .ids-title-bar input,
        .ids-title-bar select,
        .ids-select,
        .ids-search,
        .ids-formula-box input,
        .ids-formula-box textarea {
          border: 1px solid #c8b995;
          background: white;
          border-radius: 10px;
          padding: 10px 12px;
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
          padding: 10px 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .ids-secondary-btn {
          background: #ffffff;
          color: #0b1833;
          border: 1px solid #d7cab1;
        }

        .ids-gold-btn {
          background: #9a7312;
        }

        .ids-primary-btn.full,
        .ids-gold-btn.full,
        .ids-select.full {
          width: 100%;
        }

        .ids-undo-group {
          display: flex;
          gap: 5px;
        }

        .ids-undo-group button {
          width: 28px;
          padding: 7px;
          color: #94a3b8;
          background: white;
          border: 1px solid #e5dccb;
        }

        .ids-ribbon-tabs {
          display: flex;
          background: #081b3a;
          padding-left: 18px;
        }

        .ids-ribbon-tabs button {
          border: 0;
          background: transparent;
          color: #cbd5e1;
          padding: 12px 22px;
          font-weight: 800;
          cursor: pointer;
        }

        .ids-ribbon-tabs button.active {
          background: #fffaf3;
          color: #0b1833;
          border-radius: 10px 10px 0 0;
        }

        .ids-ribbon-content {
          min-height: 120px;
          background: #fffaf3;
          border-bottom: 1px solid #e6dcc9;
        }

        .ids-ribbon-grid {
          display: flex;
          align-items: stretch;
          gap: 0;
        }

        .ids-ribbon-group {
          padding: 16px 22px 10px;
          border-right: 1px solid #e6dcc9;
          min-width: 190px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
        }

        .ids-ribbon-group.wide {
          min-width: 320px;
        }

        .ids-control-row {
          display: flex;
          gap: 6px;
        }

        .ids-icon-btn {
          background: white;
          border: 1px solid #d5c6a7;
          border-radius: 8px;
          min-width: 38px;
          padding: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .ids-icon-btn.active {
          background: #081b3a;
          color: white;
        }

        .ids-soft-btn {
          background: white;
          border: 1px solid #d5c6a7;
          border-radius: 10px;
          padding: 10px 12px;
          color: #0b1833;
          font-weight: 700;
          cursor: pointer;
        }

        .ids-soft-btn.disabled {
          opacity: 0.45;
        }

        .ids-group-label {
          margin-top: auto;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
          text-align: center;
          font-weight: 800;
        }

        .ids-tile-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ids-tile-row button {
          min-width: 78px;
          min-height: 68px;
          border: 1px solid #d5c6a7;
          background: white;
          border-radius: 10px;
          color: #0b1833;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .ids-tile-row.small button {
          min-width: 86px;
        }

        .ids-margin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ids-margin-grid label {
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
        }

        .ids-margin-grid input {
          width: 70px;
          display: block;
          margin-top: 4px;
          padding: 8px;
          border: 1px solid #d5c6a7;
          border-radius: 8px;
          text-align: center;
        }

        .ids-info-pair {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: #64748b;
        }

        .ids-check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #0b1833;
          font-weight: 700;
        }

        .ids-mini-note {
          color: #64748b;
          font-size: 12px;
          margin: 0;
        }

        .ids-builder-shell {
          display: grid;
          grid-template-columns: 118px minmax(720px, 1fr) 380px;
          min-height: 760px;
          background: #f4f1ea;
        }

        .ids-page-sidebar {
          padding: 28px 16px;
          border-right: 1px solid #e2d8c5;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ids-page-sidebar button {
          background: white;
          border: 1px solid #d5c6a7;
          border-radius: 10px;
          padding: 9px 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .ids-page-sidebar button.active {
          border-color: #b98712;
          color: #9a7312;
          background: #fff8e8;
        }

        .ids-canvas-wrap {
          overflow: auto;
          padding: 34px 40px 80px;
          background: #efeee8;
        }

        .ids-ruler-top {
          height: 20px;
          max-width: 1010px;
          margin: 0 auto;
          background-image: repeating-linear-gradient(
            to right,
            transparent 0,
            transparent 95px,
            #bbb3a2 96px,
            transparent 98px
          );
          opacity: 0.8;
        }

        .ids-canvas-grid {
          background-color: #e0ded6;
          background-image:
            linear-gradient(#d2cec3 1px, transparent 1px),
            linear-gradient(90deg, #d2cec3 1px, transparent 1px);
          background-size: 24px 24px;
          max-width: 1010px;
          margin: 0 auto;
          padding: 110px 70px;
          min-height: 920px;
        }

        .ids-a4-page {
          width: 794px;
          min-height: 1123px;
          background: white;
          margin: 0 auto;
          padding: 46px;
          box-shadow: 0 0 0 1px #ddd6c7, 0 20px 50px rgba(15, 23, 42, 0.12);
        }

        .ids-doc-block {
          position: relative;
          border: 1px solid transparent;
          margin-bottom: 18px;
          padding: 10px;
          cursor: pointer;
        }

        .ids-doc-block.selected {
          border-color: #b88a18;
          box-shadow: 0 0 0 2px rgba(184, 138, 24, 0.12);
        }

        .ids-block-tag {
          position: absolute;
          left: 8px;
          top: -12px;
          background: #fff8e8;
          border: 1px solid #d1a33d;
          color: #9a7312;
          font-size: 11px;
          font-weight: 800;
          border-radius: 6px;
          padding: 2px 6px;
        }

        .ids-letterhead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0b1833;
          padding-bottom: 12px;
        }

        .ids-letterhead strong {
          display: block;
          font-size: 20px;
        }

        .ids-letterhead span {
          display: block;
          color: #64748b;
          margin-top: 4px;
        }

        .ids-logo-box {
          background: #081b3a;
          color: white;
          border-radius: 10px;
          padding: 14px 18px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .ids-identity-grid,
        .ids-performance-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid #cfc7b7;
        }

        .ids-identity-grid div,
        .ids-performance-grid div {
          padding: 10px;
          border-right: 1px solid #e5dece;
        }

        .ids-identity-grid span,
        .ids-performance-grid span {
          display: block;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
        }

        .ids-identity-grid strong,
        .ids-performance-grid strong {
          display: block;
          margin-top: 5px;
          color: #0b1833;
        }

        .ids-template-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .ids-template-table th {
          background: #e5e5e5;
          border: 1px solid #cfcfcf;
          color: #0b1833;
          padding: 8px;
          text-align: center;
        }

        .ids-template-table td {
          border: 1px solid #ddd;
          padding: 8px;
          color: #24324a;
        }

        .ids-template-table .right {
          text-align: right;
        }

        .ids-template-table .bold-row td {
          font-weight: 800;
        }

        .ids-repeat-pill {
          display: inline-block;
          background: #eaf2ff;
          color: #1d5ca8;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
        }

        .ids-chart-box {
          border: 1px solid #d2d2d2;
          padding: 18px;
          text-align: center;
        }

        .ids-bars {
          height: 120px;
          border-bottom: 1px solid #d7d7d7;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 22px;
          margin: 20px 0;
        }

        .ids-bars span {
          display: block;
          width: 60px;
          background: #1f5fa8;
        }

        .ids-note-block {
          border-left: 4px solid #9a7312;
          background: #fff8e8;
          padding: 14px;
          color: #334155;
        }

        .ids-signature-block {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: 36px;
          padding-top: 20px;
          border-top: 1px solid #d6d0c4;
        }

        .ids-signature-block span {
          display: block;
          color: #64748b;
          margin-top: 6px;
        }

        .ids-merge-panel {
          background: #fffdf8;
          border-left: 1px solid #e2d8c5;
          overflow: auto;
        }

        .ids-panel-header {
          padding: 18px;
          border-bottom: 1px solid #e2d8c5;
        }

        .ids-panel-header strong {
          color: #9a7312;
          font-size: 13px;
          letter-spacing: 0.08em;
        }

        .ids-panel-header span {
          display: block;
          color: #64748b;
          margin-top: 6px;
        }

        .ids-selected-context {
          padding: 16px 18px;
          border-bottom: 1px solid #efe7d9;
        }

        .ids-selected-context p,
        .ids-muted {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 13px;
        }

        .ids-selected-context strong {
          display: block;
          margin-bottom: 5px;
        }

        .ids-selected-context span {
          color: #64748b;
          font-size: 13px;
        }

        .ids-merge-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: #eeeae1;
          margin: 14px 18px;
          border-radius: 10px;
          padding: 4px;
          gap: 4px;
        }

        .ids-merge-tabs button {
          border: 0;
          background: transparent;
          padding: 9px 4px;
          border-radius: 8px;
          font-weight: 800;
          color: #475569;
          cursor: pointer;
          font-size: 12px;
        }

        .ids-merge-tabs button.active {
          background: white;
          color: #0b1833;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
        }

        .ids-panel-body {
          padding: 0 18px 24px;
        }

        .ids-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 12px 0;
        }

        .ids-chip-row button {
          border: 1px solid #e0d4bd;
          background: #fffaf3;
          border-radius: 999px;
          padding: 6px 10px;
          color: #566070;
          font-weight: 800;
          cursor: pointer;
        }

        .ids-field-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ids-field-list button {
          border: 1px solid #e3d8c4;
          background: white;
          border-radius: 10px;
          padding: 10px;
          text-align: left;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          cursor: pointer;
        }

        .ids-field-list button span {
          font-weight: 800;
          color: #334155;
        }

        .ids-field-list button small {
          display: block;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 2px;
        }

        .ids-field-list button em {
          font-size: 11px;
          color: #9a7312;
          font-style: normal;
          background: #fff8e8;
          padding: 2px 6px;
          border-radius: 6px;
        }

        .ids-field-list button code {
          grid-column: 1 / -1;
          color: #1d5ca8;
          font-size: 12px;
        }

        .ids-field-list.compact button {
          grid-template-columns: 1fr;
        }

        .ids-source-card,
        .ids-explain,
        .ids-formula-box,
        .ids-import-score,
        .ids-import-grid div {
          background: #fff8e8;
          border: 1px solid #eadab8;
          border-radius: 12px;
          padding: 12px;
          margin: 12px 0;
        }

        .ids-source-card strong,
        .ids-source-card span {
          display: block;
        }

        .ids-source-card span,
        .ids-explain {
          color: #64748b;
          line-height: 1.45;
        }

        .ids-formula-box {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ids-import-score {
          text-align: center;
        }

        .ids-import-score strong {
          display: block;
          font-size: 42px;
          color: #9a7312;
        }

        .ids-import-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .ids-import-grid strong {
          display: block;
          font-size: 22px;
        }

        .ids-import-grid span {
          color: #64748b;
          font-size: 12px;
        }

        .ids-status-bar {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          align-items: center;
          gap: 14px;
          background: #fffaf3;
          border-top: 1px solid #e2d8c5;
          padding: 10px 16px;
          color: #64748b;
          font-size: 13px;
        }

        .ids-status-bar div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ids-status-bar button {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: 1px solid #c8b995;
          background: white;
        }

        .ids-simple-page,
        .ids-preview-layout {
          background: white;
          border: 1px solid #e1d6bd;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }

        .ids-studio-hero h2,
        .ids-preview-toolbar h2 {
          font-size: 28px;
          margin: 0 0 8px;
          letter-spacing: -0.03em;
        }

        .ids-studio-hero p,
        .ids-preview-toolbar p {
          color: #64748b;
          max-width: 760px;
          line-height: 1.55;
          margin: 0;
        }

        .ids-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 24px;
        }

        .ids-template-card {
          border: 1px solid #e0d4bd;
          background: #fffaf3;
          border-radius: 16px;
          padding: 20px;
          text-align: left;
          cursor: pointer;
        }

        .ids-template-card strong,
        .ids-template-card span {
          display: block;
        }

        .ids-template-card strong {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .ids-template-card span {
          color: #64748b;
        }

        .ids-import-hero {
          margin-top: 24px;
          border: 1px dashed #c7a448;
          background: #fff8e8;
          border-radius: 16px;
          padding: 22px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
        }

        .ids-preview-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          margin-bottom: 24px;
        }

        .ids-action-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .ids-pdf-page {
          width: 794px;
          min-height: 1123px;
          background: white;
          margin: 0 auto;
          padding: 52px;
          box-shadow: 0 0 0 1px #ddd6c7, 0 25px 80px rgba(15, 23, 42, 0.18);
        }

        .ids-pdf-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #0b1833;
          padding-bottom: 16px;
        }

        .ids-pdf-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .ids-pdf-header p {
          margin: 6px 0 0;
          color: #64748b;
        }

        .ids-pdf-header strong {
          background: #081b3a;
          color: white;
          padding: 14px;
          border-radius: 10px;
          align-self: start;
        }

        .ids-pdf-section {
          margin-top: 24px;
        }

        .ids-pdf-section h3 {
          margin: 0 0 12px;
          font-size: 16px;
          background: #eeeeee;
          padding: 8px;
          text-align: center;
          border: 1px solid #d4d4d4;
        }

        .ids-pdf-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #ddd;
        }

        .ids-pdf-grid span,
        .ids-pdf-grid strong {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }

        .ids-pdf-grid span {
          color: #64748b;
        }

        .ids-pdf-section table {
          width: 100%;
          border-collapse: collapse;
        }

        .ids-pdf-section td,
        .ids-pdf-section th {
          border: 1px solid #ddd;
          padding: 9px;
          text-align: left;
        }

        .ids-pdf-section td:last-child,
        .ids-pdf-section th:last-child {
          text-align: right;
        }

        .ids-pdf-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .ids-pdf-metrics div {
          border: 1px solid #ddd;
          padding: 14px;
        }

        .ids-pdf-metrics span {
          color: #64748b;
          display: block;
          font-size: 12px;
          text-transform: uppercase;
        }

        .ids-pdf-metrics strong {
          display: block;
          margin-top: 6px;
          font-size: 18px;
        }

        .ids-pdf-signature {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }

        .ids-batch-card {
          margin-top: 22px;
          max-width: 720px;
          border: 1px solid #e0d4bd;
          border-radius: 16px;
          padding: 22px;
          background: #fffaf3;
        }

        .ids-batch-card label {
          display: block;
          color: #9a7312;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 12px;
        }

        .ids-investor-list {
          margin: 18px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ids-investor-list div,
        .ids-publish-card {
          background: white;
          border: 1px solid #e0d4bd;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .ids-investor-list span,
        .ids-investor-list small {
          display: block;
        }

        .ids-investor-list small {
          color: #64748b;
          margin-top: 4px;
        }

        .ids-investor-list em,
        .ids-publish-card em {
          font-style: normal;
          font-weight: 900;
          border-radius: 999px;
          padding: 6px 10px;
          background: #e9f9ef;
          color: #137333;
        }

        .ids-investor-list em.review {
          background: #fff8e0;
          color: #9a7312;
        }

        .ids-publish-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin: 24px 0;
        }

        .ids-publish-card {
          display: block;
        }

        .ids-publish-card strong,
        .ids-publish-card span,
        .ids-publish-card p {
          display: block;
          margin-bottom: 6px;
        }

        .ids-publish-card span,
        .ids-publish-card p {
          color: #64748b;
        }

        @media (max-width: 1200px) {
          .ids-title-bar {
            grid-template-columns: 1fr 1fr;
          }

          .ids-builder-shell {
            grid-template-columns: 1fr;
          }

          .ids-merge-panel {
            border-left: 0;
            border-top: 1px solid #e2d8c5;
          }

          .ids-card-grid,
          .ids-publish-grid {
            grid-template-columns: 1fr;
          }
        }
        /* VENTIQ Document Studio layout fix */
        .ids-page {
          padding: 14px;
        }

        .ids-top-header {
          display: none;
        }

        .ids-workspace-tabs {
          margin-bottom: 8px;
        }

        .ids-studio-frame {
          height: calc(100vh - 34px);
          display: flex;
          flex-direction: column;
        }

        .ids-title-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          flex-wrap: nowrap;
          overflow-x: auto;
        }

        .ids-title-bar input {
          width: 280px;
          flex: 0 0 280px;
        }

        .ids-title-bar select {
          height: 42px;
          flex: 0 0 260px;
        }

        .ids-title-bar span {
          white-space: nowrap;
          color: #64748b;
          font-size: 13px;
        }

        .ids-title-bar button,
        .ids-primary-btn,
        .ids-secondary-btn,
        .ids-gold-btn {
          height: 42px;
          padding: 9px 14px;
          white-space: nowrap;
        }

        .ids-ribbon-tabs button {
          padding: 10px 20px;
        }

        .ids-ribbon-content {
          min-height: 96px;
          flex-shrink: 0;
        }

        .ids-ribbon-group {
          padding: 12px 18px 8px;
          min-width: 150px;
        }

        .ids-ribbon-group.wide {
          min-width: 260px;
        }

        .ids-tile-row button {
          min-width: 72px;
          min-height: 58px;
          font-size: 13px;
        }

        .ids-tile-row.small button {
          min-width: 76px;
        }

        .ids-builder-shell {
          grid-template-columns: 92px minmax(620px, 1fr) 390px;
          min-height: 0;
          flex: 1;
          overflow: hidden;
        }

        .ids-page-sidebar {
          padding: 22px 12px;
          align-content: flex-start;
        }

        .ids-canvas-wrap {
          padding: 24px 28px 70px;
          overflow: auto;
        }

        .ids-ruler-top {
          max-width: 860px;
          height: 18px;
        }

        .ids-canvas-grid {
          max-width: 900px;
          padding: 70px 42px;
          min-height: 760px;
        }

        .ids-a4-page {
          width: 720px;
          min-height: 1018px;
          padding: 34px;
        }

        .ids-doc-block {
          margin-bottom: 14px;
          padding: 8px;
        }

        .ids-letterhead strong {
          font-size: 18px;
        }

        .ids-logo-box {
          padding: 12px 16px;
          font-size: 13px;
        }

        .ids-identity-grid,
        .ids-performance-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          font-size: 13px;
        }

        .ids-identity-grid div,
        .ids-performance-grid div {
          padding: 8px;
        }

        .ids-template-table {
          font-size: 13px;
        }

        .ids-template-table th,
        .ids-template-table td {
          padding: 7px;
        }

        .ids-merge-panel {
          width: 390px;
          overflow-y: auto;
        }

        .ids-panel-header {
          padding: 14px 16px;
        }

        .ids-selected-context {
          padding: 12px 16px;
        }

        .ids-merge-tabs {
          margin: 12px 16px;
        }

        .ids-panel-body {
          padding: 0 16px 20px;
        }

        .ids-field-list button {
          padding: 9px;
        }

        .ids-status-bar {
          flex-shrink: 0;
          padding: 8px 14px;
        }

        .ids-status-bar span:nth-child(3) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
          .ids-table-config-summary {
  display: grid;
  gap: 8px;
  margin: 12px 0 16px;
}

.ids-table-config-summary span {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.56);
  color: #cbd5e1;
  border-radius: 12px;
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 800;
}

.ids-column-config-list {
  display: grid;
  gap: 12px;
}

.ids-column-config-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.42);
  border-radius: 16px;
  padding: 12px;
}

.ids-column-config-top {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.ids-column-config-card input,
.ids-column-config-card select,
.ids-form-label select {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.65);
  color: #f8fafc;
  border-radius: 10px;
  padding: 9px 10px;
  font: inherit;
}

.ids-column-config-card label,
.ids-form-label {
  display: grid;
  gap: 6px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ids-column-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.ids-column-config-top button {
  border: 1px solid rgba(239, 68, 68, 0.32);
  background: rgba(239, 68, 68, 0.12);
  color: #fecaca;
  border-radius: 10px;
  padding: 9px 10px;
  font-weight: 900;
  cursor: pointer;
}
  .ids-soft-btn.active-tool {
  background: #b48314 !important;
  color: #ffffff !important;
  border-color: #b48314 !important;
  box-shadow: 0 0 0 3px rgba(180, 131, 20, 0.18);
}

.ids-soft-btn:active,
.ids-table-action-row button:active {
  transform: translateY(1px);
  opacity: 0.86;
}.ids-template-table.table-border-all th,
.ids-template-table.table-border-all td {
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.ids-template-table.table-border-horizontal th,
.ids-template-table.table-border-horizontal td {
  border-left: 0;
  border-right: 0;
  border-top: 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
}

.ids-template-table.table-border-none th,
.ids-template-table.table-border-none td {
  border-color: transparent;
}

.ids-template-table.table-header-gold thead tr:first-child th,
.ids-template-table.table-header-gold thead tr:nth-child(2) th {
  background: rgba(180, 131, 20, 0.16);
  color: #f8fafc;
}

.ids-template-table.table-header-minimal thead tr:first-child th,
.ids-template-table.table-header-minimal thead tr:nth-child(2) th {
  background: rgba(15, 23, 42, 0.42);
  color: #cbd5e1;
}

.ids-template-table.table-header-dark thead tr:first-child th,
.ids-template-table.table-header-dark thead tr:nth-child(2) th {
  background: rgba(2, 6, 23, 0.78);
  color: #ffffff;
}

.ids-template-table.table-header-light thead tr:first-child th,
.ids-template-table.table-header-light thead tr:nth-child(2) th {
  background: rgba(248, 250, 252, 0.9);
  color: #0f172a;
}
  .ids-soft-btn.danger {
  border-color: rgba(248, 113, 113, 0.35);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.16);
}

.ids-soft-btn.danger:hover {
  background: rgba(127, 29, 29, 0.28);
}

.ids-soft-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
  .ids-block-editor {
  display: grid;
  gap: 10px;
  margin: 12px 0 16px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.44);
}

.ids-block-editor label {
  display: grid;
  gap: 6px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ids-block-editor input,
.ids-block-editor textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.72);
  color: #f8fafc;
  padding: 9px 10px;
  font-size: 12px;
  outline: none;
}

.ids-block-editor textarea {
  resize: vertical;
}

.ids-block-editor input:focus,
.ids-block-editor textarea:focus {
  border-color: rgba(180, 131, 20, 0.72);
  box-shadow: 0 0 0 3px rgba(180, 131, 20, 0.12);
}


.ids-canvas-grid.grid-off {
  background-image: none !important;
}

.ids-doc-block.block-align-center {
  text-align: center;
}

.ids-doc-block.block-align-right {
  text-align: right;
}

.ids-doc-block.block-style-header {
  border-color: rgba(154, 115, 18, 0.45);
  background: #fff7df;
}

.ids-doc-block.block-style-highlight {
  border-color: rgba(180, 131, 20, 0.5);
  box-shadow: 0 0 0 3px rgba(180, 131, 20, 0.08);
}

.ids-doc-block.block-style-muted {
  background: #f8fafc;
  color: #475569;
}

.ids-chart-box.chart-line .ids-bars span {
  border-radius: 999px 999px 0 0;
}

.ids-chart-box.chart-waterfall .ids-bars span:nth-child(2),
.ids-chart-box.chart-waterfall .ids-bars span:nth-child(4) {
  opacity: 0.65;
}
      `}</style>
    </main>
  );
}