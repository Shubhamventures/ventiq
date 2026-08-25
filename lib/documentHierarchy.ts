export type GovernedDocumentHierarchy = {
  fund: string;
  investorCode: string;
  investorName: string;
  financialYear: string;
  quarter: string;
  nature: string;
  periodLabel: string;
  periodSource: "explicit" | "metadata" | "filename" | "fallback";
  periodAssigned: boolean;
};

type HierarchyInput = {
  fundName?: unknown;
  investorCode?: unknown;
  investorName?: unknown;
  periodLabel?: unknown;
  documentType?: unknown;
  documentCategory?: unknown;
  detectedType?: unknown;
  suggestedFolder?: unknown;
  documentName?: unknown;
  fileName?: unknown;
  metadata?: unknown;
};

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeFinancialYear(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 2) return `FY${digits}`;
  if (digits.length === 4) return `FY${digits.slice(-2)}`;
  return "";
}

function parsePeriod(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const quarterFirst = normalized.match(
    /\bQ([1-4])\s*[-_/ ]?\s*FY\s*[-_/ ]?\s*(\d{2,4})\b/i
  );
  if (quarterFirst) {
    const financialYear = normalizeFinancialYear(quarterFirst[2]);
    if (financialYear) {
      return {
        financialYear,
        quarter: `Q${quarterFirst[1]}`,
        periodLabel: `Q${quarterFirst[1]} ${financialYear}`,
      };
    }
  }

  const yearFirst = normalized.match(
    /\bFY\s*[-_/ ]?\s*(\d{2,4})\s*[-_/ ]?\s*Q([1-4])\b/i
  );
  if (yearFirst) {
    const financialYear = normalizeFinancialYear(yearFirst[1]);
    if (financialYear) {
      return {
        financialYear,
        quarter: `Q${yearFirst[2]}`,
        periodLabel: `Q${yearFirst[2]} ${financialYear}`,
      };
    }
  }

  const fyOnly = normalized.match(/\bFY\s*[-_/ ]?\s*(\d{2,4})\b/i);
  if (fyOnly) {
    const financialYear = normalizeFinancialYear(fyOnly[1]);
    if (financialYear) {
      return {
        financialYear,
        quarter: "Annual / General",
        periodLabel: financialYear,
      };
    }
  }

  return null;
}

function canonicalNature(input: HierarchyInput) {
  const candidate =
    text(input.documentType) ||
    text(input.documentCategory) ||
    text(input.detectedType) ||
    text(input.suggestedFolder) ||
    "Other";

  const combined = [
    candidate,
    text(input.documentName),
    text(input.fileName),
  ]
    .join(" ")
    .toLowerCase();

  if (
    combined.includes("statement of account") ||
    /\bsoa\b/.test(combined)
  ) {
    return "Statement of Account";
  }

  if (
    combined.includes("capital call") ||
    combined.includes("drawdown notice")
  ) {
    return "Capital Call";
  }

  if (combined.includes("distribution")) {
    return "Distribution";
  }

  if (combined.includes("irr")) {
    return "IRR / Performance";
  }

  if (
    combined.includes("64c") ||
    combined.includes("64d") ||
    combined.includes("tax")
  ) {
    return "Tax & Regulatory";
  }

  if (
    combined.includes("fund overview") ||
    combined.includes("fund deck") ||
    combined.includes("fundraising deck")
  ) {
    return "Fund Overview";
  }

  if (combined.includes("ddq")) {
    return "DDQ & Q&A";
  }

  if (
    combined.includes("ppm") ||
    combined.includes("legal") ||
    combined.includes("compliance")
  ) {
    return "Legal & Compliance";
  }

  if (
    combined.includes("track record") ||
    combined.includes("performance")
  ) {
    return "Track Record & Performance";
  }

  return candidate;
}

export function resolveGovernedDocumentHierarchy(
  input: HierarchyInput
): GovernedDocumentHierarchy {
  const metadata = metadataObject(input.metadata);

  const explicitPeriod = text(input.periodLabel);

  const metadataPeriod =
    text(metadata.period_label) ||
    text(metadata.periodLabel) ||
    text(metadata.period) ||
    [
      text(metadata.quarter),
      text(metadata.financial_year) ||
        text(metadata.financialYear) ||
        text(metadata.fy),
    ]
      .filter(Boolean)
      .join(" ");

  const filenamePeriod = [
    text(input.fileName),
    text(input.documentName),
  ]
    .filter(Boolean)
    .join(" ");

  const explicit = parsePeriod(explicitPeriod);
  const fromMetadata = explicit ? null : parsePeriod(metadataPeriod);
  const fromFilename =
    explicit || fromMetadata ? null : parsePeriod(filenamePeriod);

  const resolved = explicit || fromMetadata || fromFilename;

  return {
    fund: text(input.fundName) || "Fund not assigned",
    investorCode: text(input.investorCode) || "Fund-level",
    investorName:
      text(input.investorName) ||
      (text(input.investorCode)
        ? "Mapped investor"
        : "All entitled investors"),
    financialYear: resolved?.financialYear || "FY not assigned",
    quarter: resolved?.quarter || "General / Non-periodic",
    nature: canonicalNature(input),
    periodLabel: resolved?.periodLabel || "Period not assigned",
    periodSource: explicit
      ? "explicit"
      : fromMetadata
      ? "metadata"
      : fromFilename
      ? "filename"
      : "fallback",
    periodAssigned: Boolean(resolved),
  };
}
