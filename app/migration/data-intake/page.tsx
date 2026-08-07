"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { useVentiqAuth } from "../../../lib/auth/AuthProvider";
import { useActiveFund } from "../../../lib/useActiveFund";

type IntakeCategory =
  | "canonical"
  | "investor"
  | "portfolio"
  | "fund"
  | "compliance"
  | "pdf";

type DatasetKey =
  | "canonical_workbook"
  | "legacy_investor"
  | "legacy_portfolio"
  | "legacy_fund"
  | "legacy_compliance"
  | "pdf_dump";

type UploadStatus =
  | "Staged"
  | "Uploading"
  | "Uploaded"
  | "Duplicate"
  | "Processed"
  | "Failed"
  | "Review";

type UploadedFile = {
  id: string;
  file?: File;
  name: string;
  size: number;
  category: IntakeCategory;
  datasetKey: DatasetKey;
  detectedType: string;
  status: UploadStatus;
  note: string;
  error?: string;
};

type UploadApiResult = {
  batchId?: string;
  error?: string;
  uploadedFiles?: Array<{
    clientId: string;
    fileName: string;
    category: string;
    datasetKey?: string;
    status: string;
    storagePath?: string;
    error?: string;
  }>;
  uploadedCount?: number;
  duplicateCount?: number;
  failedCount?: number;
  totalFiles?: number;
};

type IntakeStatusApiResult = {
  error?: string;
  batch?: null | {
    id: string;
    batchName: string;
    fundName: string;
    status: string;
    processingStatus: string;
    totalFiles: number;
    uploadedFiles: number;
    processedFiles: number;
    totalRows: number;
    insertedRows: number;
    updatedRows: number;
    rejectedRows: number;
    warningRows: number;
    validationErrorCount: number;
    validationWarningCount: number;
    createdAt: string | null;
    updatedAt: string | null;
    processedAt: string | null;
  };
  files?: Array<{
    id: string;
    name: string;
    size: number;
    category: IntakeCategory;
    datasetKey: DatasetKey;
    detectedType: string;
    status: UploadStatus;
    note: string;
    error?: string;
  }>;
};

type ProcessSummary = Record<string, number>;

type ProcessApiResult = {
  error?: string;
  message?: string;
  summary?: ProcessSummary;
};

type CanonicalDataset = {
  sheetName: string;
  displayName: string;
  requirement: "Required" | "Conditionally Required" | "Optional";
  purpose: string;
  headers: string[];
  example: Array<string | number | boolean>;
};

const MAX_FILES_PER_UPLOAD_REQUEST = 10;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectPdfType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("capital") || normalized.includes("drawdown")) {
    return "Capital Call Notice";
  }

  if (normalized.includes("distribution") || normalized.includes("payout")) {
    return "Distribution Notice";
  }

  if (normalized.includes("irr")) {
    return "IRR Statement";
  }

  if (
    normalized.includes("soa") ||
    normalized.includes("statement") ||
    normalized.includes("account")
  ) {
    return "SOA / Account Statement";
  }

  if (
    normalized.includes("tax") ||
    normalized.includes("64c") ||
    normalized.includes("64d") ||
    normalized.includes("tds")
  ) {
    return "Tax Document";
  }

  if (
    normalized.includes("portfolio") ||
    normalized.includes("valuation") ||
    normalized.includes("company")
  ) {
    return "Portfolio Report";
  }

  if (
    normalized.includes("fund") ||
    normalized.includes("report") ||
    normalized.includes("quarterly")
  ) {
    return "Fund Report";
  }

  return "Other / Review";
}

function getCategoryLabel(category: IntakeCategory) {
  if (category === "canonical") return "Canonical Migration Workbook";
  if (category === "investor") return "Legacy Investor Data";
  if (category === "portfolio") return "Legacy Portfolio Data";
  if (category === "fund") return "Legacy Fund Data";
  if (category === "compliance") return "Legacy Compliance Data";
  return "Investor and Fund PDF Dump";
}

function getUploadNote(
  category: IntakeCategory,
  detectedType: string
) {
  if (category === "canonical") {
    return "Canonical workbook containing connected fund, investor, cashflow, valuation, NAV and compliance datasets.";
  }

  if (category === "pdf") {
    if (detectedType === "Other / Review") {
      return "Uploaded to intake. Needs PDF Intelligence review.";
    }

    return "Uploaded to intake. Ready for PDF Intelligence matching.";
  }

  return "Legacy template retained for backward-compatible migration.";
}

function createCanonicalDatasets(fundName: string): CanonicalDataset[] {
  return [
    {
      sheetName: "Fund_Master",
      displayName: "Fund Master",
      requirement: "Required",
      purpose: "Fund structure, economics, closes and service providers.",
      headers: [
        "fund_code",
        "fund_name",
        "fund_type",
        "category",
        "jurisdiction",
        "currency",
        "first_close_date",
        "second_close_date",
        "final_close_date",
        "target_corpus",
        "committed_capital",
        "green_shoe",
        "management_fee_rate",
        "setup_cost_rate",
        "carry_rate",
        "hurdle_rate",
        "waterfall_type",
        "sponsor_commitment",
        "trustee_name",
        "investment_manager",
      ],
      example: [
        "FUND-001",
        fundName,
        "Close-ended",
        "Category II AIF",
        "India",
        "INR",
        "2024-01-31",
        "2024-09-30",
        "2025-03-31",
        1000000000,
        981500000,
        250000000,
        2,
        1,
        20,
        10,
        "European",
        50000000,
        "ABC Trusteeship Services",
        "VENTIQ Capital Advisors",
      ],
    },
    {
      sheetName: "Investor_Master",
      displayName: "Investor Master",
      requirement: "Required",
      purpose: "Investor identity, contact, KYC and bank status.",
      headers: [
        "investor_code",
        "investor_name",
        "email",
        "investor_type",
        "country",
        "tax_id",
        "kyc_status",
        "bank_status",
        "onboarding_status",
        "fund_name",
      ],
      example: [
        "INV-0001",
        "Aarav Shah",
        "aarav@example.com",
        "Individual",
        "India",
        "ABCDE1234F",
        "Completed",
        "Verified",
        "Active",
        fundName,
      ],
    },
    {
      sheetName: "Commitments",
      displayName: "Commitments",
      requirement: "Required",
      purpose: "Investor commitment by fund and class.",
      headers: [
        "commitment_code",
        "fund_name",
        "investor_code",
        "investor_name",
        "email",
        "class_name",
        "commitment_date",
        "commitment_amount",
        "capital_called_till_date",
        "uncalled_capital",
        "distributions_till_date",
        "setup_fee",
        "management_fee",
        "currency",
        "status",
      ],
      example: [
        "COM-0001",
        fundName,
        "INV-0001",
        "Aarav Shah",
        "aarav@example.com",
        "Class A",
        "2024-02-15",
        5000000,
        2100000,
        2900000,
        400000,
        50000,
        100000,
        "INR",
        "Active",
      ],
    },
    {
      sheetName: "Investor_Cashflows",
      displayName: "Investor Cashflows",
      requirement: "Required",
      purpose: "Every dated investor contribution and distribution cashflow.",
      headers: [
        "cashflow_code",
        "fund_name",
        "investor_code",
        "investor_name",
        "class_name",
        "cashflow_date",
        "cashflow_type",
        "direction",
        "amount",
        "currency",
        "description",
        "status",
      ],
      example: [
        "ICF-0001",
        fundName,
        "INV-0001",
        "Aarav Shah",
        "Class A",
        "2024-03-15",
        "Capital Contribution",
        "Outflow",
        1000000,
        "INR",
        "Capital call receipt from investor perspective",
        "Confirmed",
      ],
    },
    {
      sheetName: "Capital_Call_Events",
      displayName: "Capital Call Events",
      requirement: "Required",
      purpose: "Historical fund-level capital-call events.",
      headers: [
        "capital_call_code",
        "fund_name",
        "call_name",
        "call_date",
        "due_date",
        "call_percentage",
        "base_call_amount",
        "equalisation_interest",
        "fee_amount",
        "tax_amount",
        "other_amount",
        "total_call_amount",
        "currency",
        "purpose",
        "allocation_method",
        "status",
      ],
      example: [
        "CC-2024-01",
        fundName,
        "Capital Call 1",
        "2024-03-01",
        "2024-03-15",
        20,
        196300000,
        0,
        0,
        0,
        0,
        196300000,
        "INR",
        "Initial deployment and fund expenses",
        "Pro rata to commitments",
        "Historical",
      ],
    },
    {
      sheetName: "Capital_Call_Allocations",
      displayName: "Capital Call Allocations",
      requirement: "Required",
      purpose: "Investor allocation under every capital call.",
      headers: [
        "allocation_code",
        "fund_name",
        "capital_call_code",
        "investor_code",
        "investor_name",
        "class_name",
        "commitment_amount",
        "call_percentage",
        "called_amount",
        "equalisation_interest",
        "fee_amount",
        "tax_amount",
        "other_amount",
        "total_due",
        "allocation_basis",
        "due_date",
        "currency",
        "status",
      ],
      example: [
        "CCA-2024-01-INV-0001",
        fundName,
        "CC-2024-01",
        "INV-0001",
        "Aarav Shah",
        "Class A",
        5000000,
        20,
        1000000,
        0,
        0,
        0,
        0,
        1000000,
        "Pro rata to commitments",
        "2024-03-15",
        "INR",
        "Paid",
      ],
    },
    {
      sheetName: "Capital_Call_Receipts",
      displayName: "Capital Call Receipts",
      requirement: "Required",
      purpose: "Actual investor contribution receipts and receipt dates.",
      headers: [
        "receipt_code",
        "fund_name",
        "capital_call_code",
        "allocation_code",
        "investor_code",
        "investor_name",
        "class_name",
        "receipt_date",
        "amount_received",
        "contribution_amount",
        "equalisation_interest_received",
        "fee_received",
        "tax_withheld",
        "other_amount",
        "net_contribution",
        "currency",
        "bank_reference",
        "payment_method",
        "receipt_status",
        "days_late",
      ],
      example: [
        "CCR-2024-01-INV-0001",
        fundName,
        "CC-2024-01",
        "CCA-2024-01-INV-0001",
        "INV-0001",
        "Aarav Shah",
        "Class A",
        "2024-03-14",
        1000000,
        1000000,
        0,
        0,
        0,
        0,
        1000000,
        "INR",
        "UTR0000001",
        "Bank Transfer",
        "Received",
        0,
      ],
    },
    {
      sheetName: "Distribution_Events",
      displayName: "Distribution Events",
      requirement: "Required",
      purpose: "Fund-level distribution declarations and payment events.",
      headers: [
        "distribution_code",
        "fund_name",
        "distribution_name",
        "declaration_date",
        "record_date",
        "distribution_date",
        "payment_date",
        "distribution_amount",
        "distribution_type",
        "waterfall_method",
        "currency",
        "status",
      ],
      example: [
        "DIST-2025-01",
        fundName,
        "Distribution 1",
        "2025-03-20",
        "2025-03-20",
        "2025-03-31",
        "2025-03-31",
        78520000,
        "Return of Capital and Income",
        "European",
        "INR",
        "Paid",
      ],
    },
    {
      sheetName: "Distribution_Allocations",
      displayName: "Distribution Allocations",
      requirement: "Required",
      purpose: "Investor-level distribution allocations and tax deductions.",
      headers: [
        "distribution_allocation_code",
        "fund_name",
        "distribution_code",
        "investor_code",
        "investor_name",
        "class_name",
        "declaration_date",
        "record_date",
        "payment_date",
        "allocation_percentage",
        "units_or_ratio",
        "gross_distribution",
        "return_of_capital",
        "income_distribution",
        "interest_distribution",
        "dividend_distribution",
        "capital_gain_distribution",
        "fee_rebate",
        "tax_withheld",
        "other_deductions",
        "net_distribution",
        "currency",
        "bank_reference",
        "payment_status",
      ],
      example: [
        "DA-2025-01-INV-0001",
        fundName,
        "DIST-2025-01",
        "INV-0001",
        "Aarav Shah",
        "Class A",
        "2025-03-20",
        "2025-03-20",
        "2025-03-31",
        0.51,
        1,
        400000,
        300000,
        100000,
        0,
        0,
        0,
        0,
        10000,
        0,
        390000,
        "INR",
        "UTR-DIST-0001",
        "Paid",
      ],
    },
    {
      sheetName: "Portfolio_Master",
      displayName: "Portfolio Investment Master",
      requirement: "Required",
      purpose: "Portfolio companies, instruments and permanent deal terms.",
      headers: [
        "portfolio_code",
        "portfolio_company",
        "fund_name",
        "fund_type",
        "sector",
        "stage",
        "instrument_code",
        "instrument_type",
        "investment_date",
        "investment_cost",
        "ownership_percent",
        "interest_rate",
        "repayment_due_date",
        "security_or_charge",
        "covenants",
        "risk_status",
        "latest_update",
        "migration_status",
      ],
      example: [
        "PORT-0001",
        "ABC Fintech Pvt Ltd",
        fundName,
        "Category II AIF - VC",
        "Fintech",
        "Series B",
        "INS-0001",
        "CCPS",
        "2024-04-15",
        25000000,
        12,
        0,
        "",
        "Not applicable",
        "Information rights and reserved matters",
        "Healthy",
        "Revenue growing; follow-on evaluation pending",
        "Ready",
      ],
    },
    {
      sheetName: "Portfolio_Cashflows",
      displayName: "Portfolio Cashflows",
      requirement: "Required",
      purpose: "Dated investment, realisation, principal, interest and fee cashflows.",
      headers: [
        "cashflow_code",
        "fund_name",
        "portfolio_code",
        "portfolio_company",
        "instrument_code",
        "instrument_type",
        "cashflow_date",
        "cashflow_type",
        "cashflow_direction",
        "gross_amount",
        "principal_component",
        "interest_component",
        "fee_component",
        "dividend_component",
        "tax_component",
        "other_component",
        "net_amount",
        "currency",
        "counterparty",
        "bank_reference",
        "status",
        "notes",
      ],
      example: [
        "PCF-0001",
        fundName,
        "PORT-0001",
        "ABC Fintech Pvt Ltd",
        "INS-0001",
        "CCPS",
        "2024-04-15",
        "Initial Investment",
        "Outflow",
        25000000,
        25000000,
        0,
        0,
        0,
        0,
        0,
        25000000,
        "INR",
        "ABC Fintech Pvt Ltd",
        "UTR-PORT-0001",
        "Confirmed",
        "Initial investment disbursement",
      ],
    },
    {
      sheetName: "Portfolio_Valuations",
      displayName: "Portfolio Valuations",
      requirement: "Required",
      purpose: "Reporting-date fair-value snapshots for every investment.",
      headers: [
        "valuation_code",
        "fund_name",
        "portfolio_code",
        "portfolio_company",
        "instrument_code",
        "instrument_type",
        "valuation_date",
        "reporting_period",
        "valuation_method",
        "valuation_basis",
        "currency",
        "investment_cost",
        "fair_value",
        "realised_value_to_date",
        "accrued_interest",
        "principal_outstanding",
        "impairment_amount",
        "ownership_percent",
        "expected_exit_value",
        "expected_exit_date",
        "gross_moic_reference",
        "valuation_status",
        "is_final",
        "approved_by",
      ],
      example: [
        "VAL-PORT-0001-2026-03-31",
        fundName,
        "PORT-0001",
        "ABC Fintech Pvt Ltd",
        "INS-0001",
        "CCPS",
        "2026-03-31",
        "FY26",
        "Market Multiple",
        "Latest management accounts and peer benchmark",
        "INR",
        25000000,
        42000000,
        0,
        0,
        0,
        0,
        12,
        80000000,
        "2028-03-31",
        1.68,
        "Approved",
        true,
        "Investment Committee",
      ],
    },
    {
      sheetName: "Fund_NAV_Snapshots",
      displayName: "Fund NAV Snapshots",
      requirement: "Required",
      purpose: "Reporting-date fund assets, liabilities, NAV and NAV per unit.",
      headers: [
        "nav_code",
        "fund_name",
        "reporting_date",
        "reporting_period",
        "currency",
        "cash_and_equivalents",
        "investment_fair_value",
        "accrued_income",
        "receivables",
        "other_assets",
        "total_assets",
        "management_fee_payable",
        "carry_payable",
        "expenses_payable",
        "other_liabilities",
        "total_liabilities",
        "gross_nav",
        "net_nav",
        "units_outstanding",
        "nav_per_unit",
        "commitments",
        "paid_in_capital",
        "distributions_to_date",
        "uncalled_commitment",
        "system_calculated",
        "calculation_version",
        "status",
        "approved_by",
      ],
      example: [
        "NAV-2026-03-31",
        fundName,
        "2026-03-31",
        "FY26",
        "INR",
        810000000,
        42000000,
        1000000,
        5000000,
        0,
        858000000,
        8000000,
        0,
        2000000,
        0,
        10000000,
        858000000,
        848000000,
        9815000,
        86.39837,
        981500000,
        210000000,
        40000000,
        771500000,
        true,
        "VENTIQ-NAV-1.0",
        "Approved",
        "Finance Head",
      ],
    },
    {
      sheetName: "Fund_Fee_Expenses",
      displayName: "Fund Fees and Expenses",
      requirement: "Required",
      purpose: "Management fees, setup costs and fund operating expenses.",
      headers: [
        "fee_expense_code",
        "fund_name",
        "expense_date",
        "period_start",
        "period_end",
        "fee_type",
        "expense_category",
        "description",
        "basis_amount",
        "rate_percent",
        "gross_amount",
        "indirect_tax_amount",
        "withholding_tax_amount",
        "other_adjustment",
        "net_amount",
        "payable_to",
        "payment_status",
        "payment_date",
        "capitalised",
        "allocation_basis",
        "currency",
      ],
      example: [
        "FEE-2026-Q4-MGMT",
        fundName,
        "2026-03-31",
        "2026-01-01",
        "2026-03-31",
        "Management Fee",
        "Management Fee",
        "Quarterly management fee",
        981500000,
        0.5,
        4907500,
        883350,
        0,
        0,
        5790850,
        "VENTIQ Capital Advisors",
        "Paid",
        "2026-04-05",
        false,
        "Pro rata to commitments",
        "INR",
      ],
    },
    {
      sheetName: "Debt_Repayment_Schedule",
      displayName: "Debt Repayment Schedule",
      requirement: "Conditionally Required",
      purpose: "Principal, interest and fee schedule for debt investments.",
      headers: [
        "schedule_code",
        "fund_name",
        "portfolio_code",
        "portfolio_company",
        "due_date",
        "repayment_type",
        "principal_due",
        "interest_due",
        "fee_due",
        "other_charges_due",
        "total_due",
        "amount_received",
        "paid_date",
        "payment_status",
        "notice_status",
        "reminder_count",
        "internal_note",
        "currency",
      ],
      example: [
        "DRS-PORT-0002-001",
        fundName,
        "PORT-0002",
        "XYZ Logistics Pvt Ltd",
        "2026-06-30",
        "scheduled",
        5000000,
        1200000,
        0,
        0,
        6200000,
        0,
        "",
        "upcoming",
        "not_sent",
        0,
        "Quarterly repayment",
        "INR",
      ],
    },
    {
      sheetName: "Compliance_Items",
      displayName: "Compliance and Evidence",
      requirement: "Required",
      purpose: "Compliance filings, evidence, due dates and ownership.",
      headers: [
        "compliance_code",
        "item_type",
        "document_name",
        "fund_name",
        "period",
        "authority",
        "due_date",
        "filing_status",
        "evidence_available",
        "owner",
        "category",
        "risk_level",
        "remarks",
      ],
      example: [
        "COMP-0001",
        "SEBI Filing",
        "Quarterly Compliance Report",
        fundName,
        "Q4 FY26",
        "SEBI",
        "2026-04-30",
        "Pending",
        true,
        "Compliance Officer",
        "Regulatory Filing",
        "Medium",
        "Supporting workings available",
      ],
    },
  ];
}

function addWorksheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  headers: string[],
  example: Array<string | number | boolean>
) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 2, 14), 32),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function downloadCanonicalWorkbook(fundName: string) {
  const datasets = createCanonicalDatasets(fundName);
  const workbook = XLSX.utils.book_new();

  const readmeRows = [
    ["VENTIQ Canonical Migration Workbook"],
    ["Selected Fund", fundName],
    ["Version", "1.0"],
    [],
    ["Instructions"],
    ["1", "Do not rename sheet names or column headings."],
    ["2", "Use one row per master record, transaction or dated valuation."],
    ["3", "Use the same portfolio_code across Portfolio Master, Cashflows, Valuations and Debt Schedule."],
    ["4", "Use the same investor_code across Investor Master, Commitments, Capital Calls, Distributions and Investor Cashflows."],
    ["5", "Use YYYY-MM-DD date format and amounts in the stated currency."],
    ["6", "Delete the example rows before uploading actual client data."],
    ["7", "Investor and fund PDFs are uploaded separately and do not belong in this workbook."],
  ];

  const readmeSheet = XLSX.utils.aoa_to_sheet(readmeRows);
  readmeSheet["!cols"] = [{ wch: 18 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "README");

  const dictionaryRows = [
    ["sequence_no", "sheet_name", "dataset", "requirement", "purpose"],
    ...datasets.map((dataset, index) => [
      index + 1,
      dataset.sheetName,
      dataset.displayName,
      dataset.requirement,
      dataset.purpose,
    ]),
  ];

  const dictionarySheet = XLSX.utils.aoa_to_sheet(dictionaryRows);
  dictionarySheet["!cols"] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 34 },
    { wch: 24 },
    { wch: 80 },
  ];
  XLSX.utils.book_append_sheet(workbook, dictionarySheet, "Data_Dictionary");

  datasets.forEach((dataset) => {
    addWorksheet(
      workbook,
      dataset.sheetName,
      dataset.headers,
      dataset.example
    );
  });

  const safeFundName = fundName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  XLSX.writeFile(
    workbook,
    `ventiq-canonical-migration-${safeFundName || "fund"}.xlsx`
  );
}

function getLegacyTemplateRows(
  template: "investor" | "portfolio" | "fund" | "compliance",
  fundName: string
) {
  if (template === "investor") {
    return [
      [
        "investor_code",
        "investor_name",
        "email",
        "investor_type",
        "country",
        "kyc_status",
        "bank_status",
        "fund_name",
        "class_name",
        "commitment_amount",
        "capital_called_till_date",
        "uncalled_capital",
        "distributions_till_date",
        "setup_fee",
        "management_fee",
        "cashflow_date",
        "cashflow_type",
        "cashflow_amount",
      ],
      [
        "INV-0001",
        "Aarav Shah",
        "aarav@example.com",
        "Individual",
        "India",
        "Completed",
        "Verified",
        fundName,
        "Class A",
        "5000000",
        "2100000",
        "2900000",
        "400000",
        "50000",
        "100000",
        "2026-03-31",
        "Distribution",
        "400000",
      ],
    ];
  }

  if (template === "portfolio") {
    return [
      [
        "portfolio_code",
        "portfolio_company",
        "fund_name",
        "investment_date",
        "instrument_type",
        "sector",
        "investment_cost",
        "current_value",
        "valuation_date",
        "realised_value",
        "expected_exit_date",
        "expected_exit_value",
        "repayment_due_date",
        "interest_rate",
        "security_or_charge",
        "covenants",
        "risk_status",
        "latest_update",
      ],
      [
        "PORT-0001",
        "ABC Fintech Pvt Ltd",
        fundName,
        "2024-04-15",
        "Equity",
        "Fintech",
        "25000000",
        "42000000",
        "2026-03-31",
        "0",
        "2028-03-31",
        "80000000",
        "",
        "0",
        "Not applicable",
        "Information rights",
        "Healthy",
        "Revenue growing; follow-on evaluation pending",
      ],
    ];
  }

  if (template === "fund") {
    return [
      [
        "fund_name",
        "fund_type",
        "category",
        "jurisdiction",
        "first_close_date",
        "second_close_date",
        "final_close_date",
        "target_corpus",
        "committed_capital",
        "green_shoe",
        "management_fee_rate",
        "setup_cost_rate",
        "carry_rate",
        "hurdle_rate",
        "waterfall_type",
        "sponsor_commitment",
        "trustee_name",
        "investment_manager",
      ],
      [
        fundName,
        "Close-ended",
        "Category II AIF",
        "India",
        "2024-01-31",
        "2024-09-30",
        "2025-03-31",
        "1000000000",
        "981500000",
        "250000000",
        "2",
        "1",
        "20",
        "10",
        "European",
        "50000000",
        "ABC Trusteeship Services",
        "VENTIQ Capital Advisors",
      ],
    ];
  }

  return [
    [
      "compliance_code",
      "item_type",
      "document_name",
      "fund_name",
      "period",
      "authority",
      "due_date",
      "filing_status",
      "evidence_available",
      "owner",
      "category",
      "risk_level",
      "remarks",
    ],
    [
      "COMP-0001",
      "SEBI Filing",
      "Quarterly Compliance Report",
      fundName,
      "Q4 FY26",
      "SEBI",
      "2026-04-30",
      "Pending",
      "Yes",
      "Compliance Officer",
      "Regulatory Filing",
      "Medium",
      "Supporting workings available",
    ],
  ];
}

function downloadLegacyTemplate(
  template: "investor" | "portfolio" | "fund" | "compliance",
  fundName: string
) {
  const rows = getLegacyTemplateRows(template, fundName);
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ventiq-legacy-${template}-template.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function DataIntakeCommandCenterPage() {
  const { session, activeRole } = useVentiqAuth();
  const { activeFundName, isReady: fundContextReady } = useActiveFund(
    "VENTIQ Growth Fund II"
  );

  const canManageIntake =
    activeRole === "fund_admin" || activeRole === "maker";
  const isCheckerView = activeRole === "checker";

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [isProcessingIntake, setIsProcessingIntake] = useState(false);
  const [processMessage, setProcessMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);
  const [batchProcessingStatus, setBatchProcessingStatus] = useState("");

  useEffect(() => {
    const accessToken = session?.access_token;

    if (
      !fundContextReady ||
      !activeFundName.trim() ||
      !accessToken
    ) {
      return;
    }

    let cancelled = false;

    async function restoreLatestBatch() {
      setIsLoadingBatch(true);

      try {
        const response = await fetch(
          `/api/migration/intake-upload?fundName=${encodeURIComponent(
            activeFundName
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        const result = (await response.json()) as IntakeStatusApiResult;

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to restore migration intake status."
          );
        }

        if (cancelled) return;

        if (!result.batch) {
          setBatchId("");
          setBatchProcessingStatus("");
          setUploadedFiles([]);
          return;
        }

        setBatchId(result.batch.id);
        setBatchProcessingStatus(result.batch.processingStatus);
        setUploadedFiles(
          (result.files ?? []).map((file) => ({
            ...file,
            file: undefined,
          }))
        );
        setMessage(
          `Restored migration batch ${result.batch.id}. Uploaded files: ${
            result.batch.uploadedFiles
          }; processing status: ${result.batch.processingStatus}.`
        );

        if (result.batch.processingStatus === "Completed") {
          setProcessMessage(
            `Processing completed. Inserted: ${result.batch.insertedRows}; updated: ${result.batch.updatedRows}; rejected: ${result.batch.rejectedRows}; warnings: ${result.batch.warningRows}.`
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to restore migration intake status."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBatch(false);
        }
      }
    }

    void restoreLatestBatch();

    return () => {
      cancelled = true;
    };
  }, [
    activeFundName,
    fundContextReady,
    session?.access_token,
  ]);

  function handleFilesSelected(
    category: IntakeCategory,
    datasetKey: DatasetKey,
    fileList: FileList | null
  ) {
    if (!canManageIntake) {
      setMessage(
        "Read-only access: only a Fund Admin or Maker can stage migration files."
      );
      return;
    }

    if (!fileList || fileList.length === 0) return;

    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      const detectedType =
        category === "pdf" ? detectPdfType(file.name) : getCategoryLabel(category);

      return {
        id: `${datasetKey}-${file.name}-${file.lastModified}-${file.size}`,
        file,
        name: file.name,
        size: file.size,
        category,
        datasetKey,
        detectedType,
        status: detectedType === "Other / Review" ? "Review" : "Staged",
        note: getUploadNote(category, detectedType),
      };
    });

    setUploadedFiles((current) => {
      const existingIds = new Set(current.map((file) => file.id));
      const uniqueNewFiles = newFiles.filter((file) => !existingIds.has(file.id));
      return [...uniqueNewFiles, ...current];
    });

    setMessage(
      `${newFiles.length} file(s) staged. Uploads will run in batches of ${MAX_FILES_PER_UPLOAD_REQUEST}.`
    );
  }

  function removeFile(fileId: string) {
    if (!canManageIntake) {
      setMessage(
        "Read-only access: only a Fund Admin or Maker can change the intake queue."
      );
      return;
    }

    setUploadedFiles((current) => current.filter((file) => file.id !== fileId));
  }

  async function uploadMigrationData() {
    if (!canManageIntake) {
      setMessage(
        "Read-only access: only a Fund Admin or Maker can upload migration data."
      );
      return;
    }
    const filesToUpload = uploadedFiles.filter(
      (file) =>
        Boolean(file.file) &&
        ["Staged", "Review", "Failed"].includes(file.status)
    );

    if (filesToUpload.length === 0) {
      setMessage("All selected files are already uploaded or marked duplicate.");
      return;
    }

    if (!fundContextReady || !activeFundName.trim()) {
      setMessage("Active fund context is not ready.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMessage("Uploading migration files in controlled batches...");

    setUploadedFiles((current) =>
      current.map((file) =>
        filesToUpload.some((pending) => pending.id === file.id)
          ? { ...file, status: "Uploading", error: "" }
          : file
      )
    );

    let currentBatchId = batchId;
    let processedFileCount = 0;
    let totalUploaded = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;

    try {
      for (
        let startIndex = 0;
        startIndex < filesToUpload.length;
        startIndex += MAX_FILES_PER_UPLOAD_REQUEST
      ) {
        const chunk = filesToUpload.slice(
          startIndex,
          startIndex + MAX_FILES_PER_UPLOAD_REQUEST
        );

        const formData = new FormData();
        formData.append(
          "batchName",
          `VENTIQ Canonical Migration Intake ${new Date().toLocaleString("en-IN")}`
        );
        formData.append("fundName", activeFundName);

        if (currentBatchId) {
          formData.append("batchId", currentBatchId);
        }

        chunk.forEach((file) => {
          if (!file.file) return;

          formData.append("files", file.file);
          formData.append("categories", file.category);
          formData.append("datasetKeys", file.datasetKey);
          formData.append("detectedTypes", file.detectedType);
          formData.append("clientIds", file.id);
          formData.append("notes", file.note);
        });

        const response = await fetch("/api/migration/intake-upload", {
          method: "POST",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
          body: formData,
        });

        const responseText = await response.text();
        let result: UploadApiResult = {};

        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(
            responseText || `Upload API failed with status ${response.status}`
          );
        }

        if (!response.ok) {
          throw new Error(result.error || "Unable to upload migration intake.");
        }

        currentBatchId = result.batchId || currentBatchId;

        setUploadedFiles((current) =>
          current.map((file) => {
            const uploadedResult = result.uploadedFiles?.find(
              (item) => item.clientId === file.id
            );

            if (!uploadedResult) return file;

            if (uploadedResult.status === "Uploaded") {
              return { ...file, status: "Uploaded", error: "" };
            }

            if (uploadedResult.status === "Duplicate") {
              return {
                ...file,
                status: "Duplicate",
                error: uploadedResult.error || "Duplicate file skipped.",
              };
            }

            return {
              ...file,
              status: "Failed",
              error: uploadedResult.error || "Upload failed.",
            };
          })
        );

        totalUploaded += result.uploadedCount ?? 0;
        totalDuplicates += result.duplicateCount ?? 0;
        totalFailed += result.failedCount ?? 0;
        processedFileCount += chunk.length;

        setUploadProgress(
          Math.round((processedFileCount / filesToUpload.length) * 100)
        );
      }

      setBatchId(currentBatchId);
      setBatchProcessingStatus("Not Started");
      setMessage(
        `Upload completed. Uploaded: ${totalUploaded}; duplicates skipped: ${totalDuplicates}; failed: ${totalFailed}.`
      );
    } catch (error) {
      setUploadedFiles((current) =>
        current.map((file) =>
          file.status === "Uploading"
            ? {
                ...file,
                status: "Failed",
                error:
                  error instanceof Error ? error.message : "Upload failed.",
              }
            : file
        )
      );

      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function processMigrationData() {
    if (!canManageIntake) {
      setProcessMessage(
        "Read-only access: only a Fund Admin or Maker can process migration data."
      );
      return;
    }

    if (!batchId) {
      setProcessMessage("Please upload migration data before processing.");
      return;
    }

    setIsProcessingIntake(true);
    setProcessMessage(
      "Validating and processing the intake batch into VENTIQ operating tables..."
    );

    try {
      const response = await fetch("/api/migration/process-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          batchId,
          fundName: activeFundName,
        }),
      });

      const result = (await response.json()) as ProcessApiResult;

      if (!response.ok) {
        throw new Error(result.error || "Unable to process migration intake.");
      }

      const summaryText = Object.entries(result.summary ?? {})
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ");

      setBatchProcessingStatus("Completed");
      setProcessMessage(
        summaryText
          ? `Processing completed. ${summaryText}.`
          : result.message || "Processing completed with no inserted rows."
      );
    } catch (error) {
      setProcessMessage(
        error instanceof Error
          ? error.message
          : "Unable to process migration intake."
      );
    } finally {
      setIsProcessingIntake(false);
    }
  }

  const metrics = useMemo(() => {
    const canonicalFiles = uploadedFiles.filter(
      (file) => file.category === "canonical"
    );
    const pdfFiles = uploadedFiles.filter((file) => file.category === "pdf");
    const legacyFiles = uploadedFiles.filter(
      (file) => file.category !== "canonical" && file.category !== "pdf"
    );
    const uploadedCount = uploadedFiles.filter(
      (file) => file.status === "Uploaded" || file.status === "Processed"
    ).length;
    const duplicateCount = uploadedFiles.filter(
      (file) => file.status === "Duplicate"
    ).length;
    const failedCount = uploadedFiles.filter(
      (file) => file.status === "Failed"
    ).length;

    return {
      totalFiles: uploadedFiles.length,
      canonicalFiles: canonicalFiles.length,
      pdfFiles: pdfFiles.length,
      legacyFiles: legacyFiles.length,
      uploadedCount,
      duplicateCount,
      failedCount,
    };
  }, [uploadedFiles]);

  const pendingUploadCount = uploadedFiles.filter(
    (file) =>
      Boolean(file.file) &&
      ["Staged", "Review", "Failed"].includes(file.status)
  ).length;

  const datasets = useMemo(
    () => createCanonicalDatasets(activeFundName),
    [activeFundName]
  );

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Migration Portal</p>
            <h1>Canonical Data Intake Command Center</h1>
            <p>
              Upload one structured workbook for the complete operating data layer,
              retain legacy templates for backward compatibility, and upload PDF
              dumps separately in controlled batches.
            </p>
          </div>

          <a className="back-link" href="/migration">
            Back to Migration
          </a>
        </div>

        <div className="sample-data-ribbon">
          Active fund: {activeFundName} · Canonical workbook · Deal cashflows ·
          Valuations · NAV · Investor PDFs
        </div>

        {isCheckerView && (
          <div className="preview-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">Checker access</p>
                <h2>Read-only migration intake</h2>
              </div>
              <span className="status-pill">Review Mode</span>
            </div>

            <div className="explain-box">
              You can review the active fund, restored migration batch, uploaded
              files and processing status. Uploading, staging, removing and
              processing migration data are restricted to the Fund Admin and
              Maker roles.
            </div>
          </div>
        )}

        <div className="preview-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Recommended intake path</p>
              <h2>One workbook for connected structured data</h2>
            </div>
            <span className="status-pill">Version 1.0</span>
          </div>

          <div className="explain-box">
            The canonical workbook contains separate sheets for fund master,
            investor master, commitments, capital calls, distributions, deal-level
            cashflows, portfolio valuations, NAV, fees, debt schedules and
            compliance. Investor and fund PDFs remain a separate upload because
            VENTIQ classifies and matches them individually.
          </div>

          <div className="action-row">
            <button
              className="monitor-btn monitor-btn-primary"
              disabled={!fundContextReady}
              onClick={() => downloadCanonicalWorkbook(activeFundName)}
              type="button"
            >
              Download Canonical Workbook
            </button>

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/migration/activation"
            >
              Open Activation Dashboard
            </a>
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{metrics.totalFiles}</h3>
            <p>Total files staged</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.uploadedCount}</h3>
            <p>Uploaded files</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.pdfFiles}</h3>
            <p>PDFs staged</p>
          </div>

          <div className="impact-card">
            <h3>{metrics.failedCount}</h3>
            <p>Failed uploads</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>Upload Migration Files</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <span className="small-pill">
                {metrics.canonicalFiles > 0 ? "Selected" : "Recommended"}
              </span>
              <br />
              <strong>Canonical Migration Workbook</strong>
              <br />
              Complete structured data package with 16 connected operating
              datasets.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadCanonicalWorkbook(activeFundName)}
                type="button"
              >
                Download Canonical Workbook
              </button>
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".xlsx,.xls"
                  onChange={(event) =>
                    handleFilesSelected(
                      "canonical",
                      "canonical_workbook",
                      event.target.files
                    )
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>

            <div className="queue-item">
              <span className="small-pill">
                {metrics.pdfFiles > 0 ? "Selected" : "After Structured Data"}
              </span>
              <br />
              <strong>Investor and Fund PDF Dump</strong>
              <br />
              SOAs, capital-call notices, distribution notices, tax files,
              valuation reports, compliance evidence and unmatched documents.
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".pdf"
                  multiple
                  onChange={(event) =>
                    handleFilesSelected("pdf", "pdf_dump", event.target.files)
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Legacy Templates</h2>
          <div className="explain-box">
            Existing clients may continue using the four earlier templates. For
            the 500-investor, 500-portfolio and complete metric test, use the
            canonical workbook instead.
          </div>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Legacy Investor Template</strong>
              <br />
              Investor master, commitments and one combined cashflow layout.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadLegacyTemplate("investor", activeFundName)}
                type="button"
              >
                Download Investor Template
              </button>
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    handleFilesSelected(
                      "investor",
                      "legacy_investor",
                      event.target.files
                    )
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>

            <div className="queue-item">
              <strong>Legacy Portfolio Template</strong>
              <br />
              Combined portfolio master and current valuation data.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadLegacyTemplate("portfolio", activeFundName)}
                type="button"
              >
                Download Portfolio Template
              </button>
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    handleFilesSelected(
                      "portfolio",
                      "legacy_portfolio",
                      event.target.files
                    )
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>

            <div className="queue-item">
              <strong>Legacy Fund Template</strong>
              <br />
              Fund structure and economic terms.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() => downloadLegacyTemplate("fund", activeFundName)}
                type="button"
              >
                Download Fund Template
              </button>
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    handleFilesSelected(
                      "fund",
                      "legacy_fund",
                      event.target.files
                    )
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>

            <div className="queue-item">
              <strong>Legacy Compliance Template</strong>
              <br />
              Filing tracker, evidence status and compliance ownership.
              <br />
              <br />
              <button
                className="secondary-action"
                onClick={() =>
                  downloadLegacyTemplate("compliance", activeFundName)
                }
                type="button"
              >
                Download Compliance Template
              </button>
              <br />
              <br />
              {canManageIntake ? (
                <input
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    handleFilesSelected(
                      "compliance",
                      "legacy_compliance",
                      event.target.files
                    )
                  }
                  type="file"
                />
              ) : (
                <span className="small-pill">Upload restricted</span>
              )}
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Canonical Dataset Coverage</h2>

          <div className="queue-grid">
            {datasets.map((dataset, index) => (
              <div className="queue-item" key={dataset.sheetName}>
                <span className="small-pill">{dataset.requirement}</span>
                <br />
                <strong>
                  {index + 1}. {dataset.displayName}
                </strong>
                <br />
                Sheet: {dataset.sheetName}
                <br />
                {dataset.purpose}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Upload and Processing Controls</h2>

          <div className="action-row">
            {canManageIntake && (
              <>
                <button
                  className="monitor-btn monitor-btn-primary"
                  disabled={
                    isLoadingBatch ||
                    isUploading ||
                    uploadedFiles.length === 0 ||
                    pendingUploadCount === 0
                  }
                  onClick={uploadMigrationData}
                  type="button"
                >
                  {isUploading
                    ? `Uploading ${uploadProgress}%...`
                    : pendingUploadCount === 0 && uploadedFiles.length > 0
                    ? "All Files Uploaded"
                    : "Upload Migration Data"}
                </button>

                <button
                  className="monitor-btn monitor-btn-primary"
                  disabled={
                    isLoadingBatch ||
                    !batchId ||
                    isProcessingIntake ||
                    ["Processing", "Completed"].includes(batchProcessingStatus)
                  }
                  onClick={processMigrationData}
                  type="button"
                >
                  {isProcessingIntake
                    ? "Validating and Processing..."
                    : "Process Migration Data"}
                </button>
              </>
            )}

            <a
              className="monitor-btn monitor-btn-secondary"
              href="/migration/pdf-intelligence"
            >
              Open PDF Intelligence
            </a>
          </div>

          {!canManageIntake && !isLoadingBatch && (
            <div className="logic-note">
              Read-only access. Upload and processing actions are available only
              to the Fund Admin and Maker roles.
            </div>
          )}

          {isLoadingBatch && (
            <div className="logic-note">Loading the latest stored migration batch...</div>
          )}

          {isUploading && (
            <div className="logic-note">Upload progress: {uploadProgress}%</div>
          )}

          {message && <div className="logic-note">{message}</div>}
          {processMessage && <div className="logic-note">{processMessage}</div>}

          {batchId && (
            <div className="explain-box">
              Migration batch: <strong>{batchId}</strong>
              <br />
              Processing status: <strong>{batchProcessingStatus || "Not Started"}</strong>
            </div>
          )}
        </div>

        <div className="preview-card">
          <h2>Upload Status</h2>

          {uploadedFiles.length === 0 ? (
            <div className="explain-box">
              No files selected. Download the canonical workbook, populate the
              required sheets, and upload it here. PDFs are selected separately.
            </div>
          ) : (
            <div className="queue-grid">
              {uploadedFiles.map((file) => (
                <div className="queue-item" key={file.id}>
                  <span className="small-pill">{file.status}</span>
                  <br />
                  <strong>{file.name}</strong>
                  <br />
                  Category: {getCategoryLabel(file.category)}
                  <br />
                  Dataset key: {file.datasetKey}
                  <br />
                  Type: {file.detectedType}
                  <br />
                  Size: {formatFileSize(file.size)}
                  <br />
                  Note: {file.note}
                  {file.error && (
                    <>
                      <br />
                      Error: {file.error}
                    </>
                  )}
                  <br />
                  <br />
                  {canManageIntake &&
                    Boolean(file.file) &&
                    ["Staged", "Review", "Failed"].includes(file.status) &&
                    !isUploading && (
                      <button
                        className="secondary-action"
                        onClick={() => removeFile(file.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="preview-card">
          <h2>Test Sequence</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>1. Canonical workbook pilot</strong>
              <br />
              50 investors, 50 portfolio companies and all connected transaction
              and valuation sheets.
            </div>

            <div className="queue-item">
              <strong>2. PDF pilot</strong>
              <br />
              Start with 25–50 small PDFs and verify investor/document matching.
            </div>

            <div className="queue-item">
              <strong>3. Medium load</strong>
              <br />
              250 investors, 250 portfolio companies and 500 PDFs.
            </div>

            <div className="queue-item">
              <strong>4. Full load</strong>
              <br />
              500 investors, 500 portfolio companies and 1,000 PDFs.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}