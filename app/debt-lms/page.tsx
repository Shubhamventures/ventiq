"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
type DataRow = Record<string, unknown>;
type LoanStatus = "Performing" | "Due Soon" | "Overdue" | "Default Watch";
type CovenantStatus = "Compliant" | "Pending" | "Breached" | "Waived";
type NoticeStatus = "Draft" | "Queued" | "Sent" | "Failed";
type CollectionStatus = "Received" | "Pending" | "Partial" | "Overdue";

type DebtLoan = {
  id: string;
  borrowerName: string;
  fundName: string;
  instrument: string;
  sanctionAmount: number;
  disbursedAmount: number;
  disbursementDate: string;
  tenureMonths: number;
  couponRate: number;
  interestFrequency: string;
  principalFrequency: string;
  moratoriumMonths: number;
  moratoriumStart: string;
  repaymentStartDate: string;
  maturityDate: string;
  processingFee: number;
  exitFee: number;
  penalRate: number;
  security: string;
  status: LoanStatus;
  nextDueDate: string;
  nextDueAmount: number;
  overdueAmount: number;
};

type RepaymentRow = {
  id: string;
  loanId: string;
  borrowerName: string;
  dueDate: string;
  openingPrincipal: number;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  penaltyDue: number;
  totalDue: number;
  receivedAmount: number;
  principalReceived?: number;
  interestReceived?: number;
  feesReceived?: number;
  penaltyReceived?: number;
  otherReceived?: number;
  pendingAmount: number;
  status: CollectionStatus;
  daysPastDue: number;
};

type CovenantRow = {
  id: string;
  loanId: string;
  borrowerName: string;
  covenant: string;
  type: string;
  frequency: string;
  dueDate: string;
  status: CovenantStatus;
  evidence: string;
};

type NoticeRow = {
  id: string;
  borrowerName: string;
  noticeType: string;
  dueDate: string;
  amount: number;
  emailTo: string;
  status: NoticeStatus;
  linkedDocument: string;
};

type BankMatchRow = {
  id: string;
  borrowerName: string;
  expectedAmount: number;
  receivedAmount: number;
  bankNarration: string;
  matchStatus: "Matched" | "Partial Match" | "Unmatched";
  action: string;
};

type BankReconReceipt = {
  id: string;
  borrowerName: string;
  loanId: string;
  repaymentScheduleId: string;
  dueDate: string;
  receiptDate: string;
  bankReference: string;
  bankNarration: string;
  principalReceived: number;
  interestReceived: number;
  feesReceived: number;
  penaltyReceived: number;
  otherReceived: number;
  matchStatus: "Approved" | "Review" | "Rejected";
  syncStatus: "Ready" | "Synced" | "Ignored";
  confidence: number;
};
type NewLoanForm = {
  borrowerName: string;
  borrowerEmail: string;
  financeContactName: string;
  financeContactEmail: string;
  escalationContactName: string;
  escalationContactEmail: string;
  fundName: string;
  instrumentType: string;
  facilityReference: string;
  sanctionAmount: string;
  disbursedAmount: string;
  sanctionDate: string;
  disbursementDate: string;
  firstDrawdownDate: string;
  tenureMonths: string;
  couponRate: string;
  interestFrequency: string;
  principalFrequency: string;
  moratoriumMonths: string;
  moratoriumStartBasis: string;
  repaymentStartDate: string;
  maturityDate: string;
  processingFee: string;
  commitmentFee: string;
  exitFee: string;
  prepaymentFee: string;
  penalInterestRate: string;
  securityDetails: string;
  chargeDetails: string;
  trusteeDetails: string;
  bankAccountDetails: string;
};

type ReceiptUpdateForm = {
  principalReceived: string;
  interestReceived: string;
  feesReceived: string;
  penaltyReceived: string;
  otherReceived: string;
  receiptDate: string;
  bankReference: string;
  remarks: string;
};

type TermSheetUploadForm = {
  fileName: string;
  extractionStatus: string;
  borrowerName: string;
  borrowerEmail: string;
  fundName: string;
  instrumentType: string;
  sanctionAmount: string;
  disbursedAmount: string;
  couponRate: string;
  tenureMonths: string;
  interestFrequency: string;
  principalFrequency: string;
  moratoriumMonths: string;
  moratoriumStartBasis: string;
  repaymentStartDate: string;
  maturityDate: string;
  processingFee: string;
  exitFee: string;
  penalInterestRate: string;
  securityDetails: string;
  chargeDetails: string;
  trusteeDetails: string;
  covenantOne: string;
  covenantTwo: string;
  covenantThree: string;
  extractionNotes: string;
};
const emptyLoanForm: NewLoanForm = {
  borrowerName: "",
  borrowerEmail: "",
  financeContactName: "",
  financeContactEmail: "",
  escalationContactName: "",
  escalationContactEmail: "",
  fundName: "",
  instrumentType: "NCD",
  facilityReference: "",
  sanctionAmount: "",
  disbursedAmount: "",
  sanctionDate: "",
  disbursementDate: "",
  firstDrawdownDate: "",
  tenureMonths: "",
  couponRate: "",
  interestFrequency: "Monthly",
  principalFrequency: "Monthly",
  moratoriumMonths: "",
  moratoriumStartBasis: "Disbursement Date",
  repaymentStartDate: "",
  maturityDate: "",
  processingFee: "",
  commitmentFee: "",
  exitFee: "",
  prepaymentFee: "",
  penalInterestRate: "",
  securityDetails: "",
  chargeDetails: "",
  trusteeDetails: "",
  bankAccountDetails: "",
};

const emptyReceiptForm: ReceiptUpdateForm = {
  principalReceived: "",
  interestReceived: "",
  feesReceived: "",
  penaltyReceived: "",
  otherReceived: "",
  receiptDate: "",
  bankReference: "",
  remarks: "",
};

const emptyTermSheetForm: TermSheetUploadForm = {
  fileName: "",
  extractionStatus: "Not Uploaded",
  borrowerName: "",
  borrowerEmail: "",
  fundName: "VENTIQ Venture Debt Fund I",
  instrumentType: "NCD",
  sanctionAmount: "",
  disbursedAmount: "",
  couponRate: "",
  tenureMonths: "",
  interestFrequency: "Monthly",
  principalFrequency: "Monthly",
  moratoriumMonths: "",
  moratoriumStartBasis: "Disbursement Date",
  repaymentStartDate: "",
  maturityDate: "",
  processingFee: "",
  exitFee: "",
  penalInterestRate: "",
  securityDetails: "",
  chargeDetails: "",
  trusteeDetails: "",
  covenantOne: "Monthly MIS submission by 10th of every month",
  covenantTwo: "Minimum security cover to be maintained as per term sheet",
  covenantThree: "No additional borrowing without investor consent",
  extractionNotes: "",
};
const sampleLoans: DebtLoan[] = [
  {
    id: "loan-001",
    borrowerName: "Alpha Fintech Pvt Ltd",
    fundName: "VENTIQ Venture Debt Fund I",
    instrument: "NCD",
    sanctionAmount: 120000000,
    disbursedAmount: 100000000,
    disbursementDate: "2025-04-15",
    tenureMonths: 36,
    couponRate: 15.5,
    interestFrequency: "Monthly",
    principalFrequency: "Quarterly",
    moratoriumMonths: 6,
    moratoriumStart: "Disbursement Date",
    repaymentStartDate: "2025-10-15",
    maturityDate: "2028-04-15",
    processingFee: 1200000,
    exitFee: 1800000,
    penalRate: 24,
    security: "First ranking charge on receivables",
    status: "Performing",
    nextDueDate: "2026-08-15",
    nextDueAmount: 3875000,
    overdueAmount: 0,
  },
  {
    id: "loan-002",
    borrowerName: "Nova Health Systems",
    fundName: "VENTIQ Venture Debt Fund I",
    instrument: "Venture Debt Loan",
    sanctionAmount: 85000000,
    disbursedAmount: 85000000,
    disbursementDate: "2025-02-01",
    tenureMonths: 30,
    couponRate: 16.25,
    interestFrequency: "Monthly",
    principalFrequency: "Monthly",
    moratoriumMonths: 3,
    moratoriumStart: "First Drawdown Date",
    repaymentStartDate: "2025-05-01",
    maturityDate: "2027-08-01",
    processingFee: 850000,
    exitFee: 1250000,
    penalRate: 26,
    security: "Pledge of promoter shares and escrow control",
    status: "Overdue",
    nextDueDate: "2026-08-05",
    nextDueAmount: 5120000,
    overdueAmount: 2140000,
  },
  {
    id: "loan-003",
    borrowerName: "Orbit SaaS Technologies",
    fundName: "VENTIQ Venture Debt Fund II",
    instrument: "CCD",
    sanctionAmount: 150000000,
    disbursedAmount: 125000000,
    disbursementDate: "2025-09-20",
    tenureMonths: 42,
    couponRate: 14.75,
    interestFrequency: "Quarterly",
    principalFrequency: "Bullet",
    moratoriumMonths: 12,
    moratoriumStart: "Disbursement Date",
    repaymentStartDate: "2026-09-20",
    maturityDate: "2029-03-20",
    processingFee: 1500000,
    exitFee: 2500000,
    penalRate: 22,
    security: "Second ranking charge on assets",
    status: "Due Soon",
    nextDueDate: "2026-08-20",
    nextDueAmount: 4600000,
    overdueAmount: 0,
  },
  {
    id: "loan-004",
    borrowerName: "Kinetic Mobility",
    fundName: "VENTIQ Credit Opportunities Fund",
    instrument: "Secured Loan",
    sanctionAmount: 65000000,
    disbursedAmount: 65000000,
    disbursementDate: "2024-12-10",
    tenureMonths: 24,
    couponRate: 18,
    interestFrequency: "Monthly",
    principalFrequency: "Monthly",
    moratoriumMonths: 2,
    moratoriumStart: "Sanction Date",
    repaymentStartDate: "2025-02-10",
    maturityDate: "2026-12-10",
    processingFee: 650000,
    exitFee: 975000,
    penalRate: 30,
    security: "Hypothecation of receivables and bank escrow",
    status: "Default Watch",
    nextDueDate: "2026-08-10",
    nextDueAmount: 3950000,
    overdueAmount: 6120000,
  },
];

const sampleRepaymentRows: RepaymentRow[] = [
  {
    id: "repay-001",
    loanId: "loan-001",
    borrowerName: "Alpha Fintech Pvt Ltd",
    dueDate: "2026-08-15",
    openingPrincipal: 87500000,
    principalDue: 2500000,
    interestDue: 1125000,
    feesDue: 250000,
    penaltyDue: 0,
    totalDue: 3875000,
    receivedAmount: 0,
    pendingAmount: 3875000,
    status: "Pending",
    daysPastDue: 0,
  },
  {
    id: "repay-002",
    loanId: "loan-002",
    borrowerName: "Nova Health Systems",
    dueDate: "2026-08-05",
    openingPrincipal: 72000000,
    principalDue: 3000000,
    interestDue: 980000,
    feesDue: 0,
    penaltyDue: 1140000,
    totalDue: 5120000,
    receivedAmount: 2980000,
    pendingAmount: 2140000,
    status: "Partial",
    daysPastDue: 6,
  },
  {
    id: "repay-003",
    loanId: "loan-003",
    borrowerName: "Orbit SaaS Technologies",
    dueDate: "2026-08-20",
    openingPrincipal: 125000000,
    principalDue: 0,
    interestDue: 4600000,
    feesDue: 0,
    penaltyDue: 0,
    totalDue: 4600000,
    receivedAmount: 0,
    pendingAmount: 4600000,
    status: "Pending",
    daysPastDue: 0,
  },
  {
    id: "repay-004",
    loanId: "loan-004",
    borrowerName: "Kinetic Mobility",
    dueDate: "2026-08-10",
    openingPrincipal: 54000000,
    principalDue: 2700000,
    interestDue: 810000,
    feesDue: 0,
    penaltyDue: 440000,
    totalDue: 3950000,
    receivedAmount: 0,
    pendingAmount: 3950000,
    status: "Overdue",
    daysPastDue: 1,
  },
];

const sampleCovenantRows: CovenantRow[] = [
  {
    id: "cov-001",
    loanId: "loan-001",
    borrowerName: "Alpha Fintech Pvt Ltd",
    covenant: "Monthly MIS submission by 10th",
    type: "Reporting",
    frequency: "Monthly",
    dueDate: "2026-08-10",
    status: "Compliant",
    evidence: "MIS uploaded",
  },
  {
    id: "cov-002",
    loanId: "loan-002",
    borrowerName: "Nova Health Systems",
    covenant: "Minimum DSCR of 1.25x",
    type: "Financial",
    frequency: "Quarterly",
    dueDate: "2026-08-15",
    status: "Pending",
    evidence: "Awaiting CFO certificate",
  },
  {
    id: "cov-003",
    loanId: "loan-004",
    borrowerName: "Kinetic Mobility",
    covenant: "No additional borrowing without consent",
    type: "Negative",
    frequency: "Event based",
    dueDate: "2026-08-01",
    status: "Breached",
    evidence: "New lender disclosure pending",
  },
  {
    id: "cov-004",
    loanId: "loan-003",
    borrowerName: "Orbit SaaS Technologies",
    covenant: "Security cover maintenance",
    type: "Security",
    frequency: "Quarterly",
    dueDate: "2026-08-25",
    status: "Pending",
    evidence: "Valuation certificate due",
  },
];

const sampleNoticeRows: NoticeRow[] = [
  {
    id: "notice-001",
    borrowerName: "Alpha Fintech Pvt Ltd",
    noticeType: "Pre-due reminder",
    dueDate: "2026-08-15",
    amount: 3875000,
    emailTo: "finance@alphafintech.com",
    status: "Queued",
    linkedDocument: "Repayment Reminder PDF",
  },
  {
    id: "notice-002",
    borrowerName: "Nova Health Systems",
    noticeType: "Penalty notice",
    dueDate: "2026-08-05",
    amount: 2140000,
    emailTo: "cfo@novahealth.com",
    status: "Draft",
    linkedDocument: "Penalty Notice PDF",
  },
  {
    id: "notice-003",
    borrowerName: "Kinetic Mobility",
    noticeType: "Default watch notice",
    dueDate: "2026-08-10",
    amount: 3950000,
    emailTo: "accounts@kineticmobility.com",
    status: "Draft",
    linkedDocument: "Default Watch Notice PDF",
  },
];

const sampleBankMatches: BankMatchRow[] = [
  {
    id: "bank-001",
    borrowerName: "Nova Health Systems",
    expectedAmount: 5120000,
    receivedAmount: 2980000,
    bankNarration: "NEFT NOVA HEALTH SYSTEMS INSTL AUG",
    matchStatus: "Partial Match",
    action: "Add penalty and send overdue notice",
  },
  {
    id: "bank-002",
    borrowerName: "Alpha Fintech Pvt Ltd",
    expectedAmount: 3875000,
    receivedAmount: 0,
    bankNarration: "No matching credit received",
    matchStatus: "Unmatched",
    action: "Send pre-due reminder",
  },
  {
    id: "bank-003",
    borrowerName: "Orbit SaaS Technologies",
    expectedAmount: 4600000,
    receivedAmount: 0,
    bankNarration: "Due in upcoming cycle",
    matchStatus: "Unmatched",
    action: "Keep in upcoming queue",
  },
];

const sampleBankReconReceipts: BankReconReceipt[] = [
  {
    id: "bank-recon-sync-001",
    borrowerName: "Alpha Fintech Pvt Ltd",
    loanId: "loan-001",
    repaymentScheduleId: "repay-001",
    dueDate: "2026-08-15",
    receiptDate: "2026-08-15",
    bankReference: "UTR-BANKRECON-001",
    bankNarration: "NEFT ALPHA FINTECH REPAYMENT AUG",
    principalReceived: 2500000,
    interestReceived: 1125000,
    feesReceived: 0,
    penaltyReceived: 0,
    otherReceived: 0,
    matchStatus: "Approved",
    syncStatus: "Ready",
    confidence: 98,
  },
  {
    id: "bank-recon-sync-002",
    borrowerName: "Nova Health Systems",
    loanId: "loan-002",
    repaymentScheduleId: "repay-002",
    dueDate: "2026-08-05",
    receiptDate: "2026-08-06",
    bankReference: "UTR-BANKRECON-002",
    bankNarration: "NEFT NOVA HEALTH SYSTEMS INSTL AUG",
    principalReceived: 2000000,
    interestReceived: 980000,
    feesReceived: 0,
    penaltyReceived: 0,
    otherReceived: 0,
    matchStatus: "Approved",
    syncStatus: "Ready",
    confidence: 94,
  },
];

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "₹0";

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)} Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)} L`;
  }

  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}
function getString(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow, keys: string[], fallback = 0) {
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

  return fallback;
}

function getDateString(row: DataRow, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function normalizeLoanStatus(value: string): LoanStatus {
  const status = value.toLowerCase();

  if (status.includes("default")) return "Default Watch";
  if (status.includes("overdue")) return "Overdue";
  if (status.includes("due")) return "Due Soon";

  return "Performing";
}

function normalizeCollectionStatus(value: string): CollectionStatus {
  const status = value.toLowerCase();

  if (status.includes("received") || status.includes("paid")) return "Received";
  if (status.includes("partial")) return "Partial";
  if (status.includes("overdue") || status.includes("default")) return "Overdue";

  return "Pending";
}

function normalizeCovenantStatus(value: string): CovenantStatus {
  const status = value.toLowerCase();

  if (status.includes("breach")) return "Breached";
  if (status.includes("waive")) return "Waived";
  if (status.includes("compliant") || status.includes("done")) return "Compliant";

  return "Pending";
}

function normalizeNoticeStatus(value: string): NoticeStatus {
  const status = value.toLowerCase();

  if (status.includes("sent")) return "Sent";
  if (status.includes("queue")) return "Queued";
  if (status.includes("fail")) return "Failed";

  return "Draft";
}

function normalizeMatchStatus(value: string): BankMatchRow["matchStatus"] {
  const status = value.toLowerCase();

  if (status.includes("partial")) return "Partial Match";
  if (status.includes("match") && !status.includes("unmatched")) return "Matched";

  return "Unmatched";
}

function mapLoan(row: DataRow): DebtLoan {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    fundName: getString(row, ["fund_name"], "Debt Fund"),
    instrument: getString(row, ["instrument_type"], "Loan"),
    sanctionAmount: getNumber(row, ["sanction_amount"]),
    disbursedAmount: getNumber(row, ["disbursed_amount"]),
    disbursementDate: getDateString(row, ["disbursement_date"], "2026-01-01"),
    tenureMonths: getNumber(row, ["tenure_months"]),
    couponRate: getNumber(row, ["coupon_rate"]),
    interestFrequency: getString(row, ["interest_frequency"], "Monthly"),
    principalFrequency: getString(
      row,
      ["principal_frequency", "principal_repayment_type"],
      "Monthly"
    ),
    moratoriumMonths: getNumber(row, ["moratorium_months"]),
    moratoriumStart: getString(row, ["moratorium_start_basis"], "Disbursement Date"),
    repaymentStartDate: getDateString(row, ["repayment_start_date"], "2026-01-01"),
    maturityDate: getDateString(row, ["maturity_date"], "2026-12-31"),
    processingFee: getNumber(row, ["processing_fee"]),
    exitFee: getNumber(row, ["exit_fee"]),
    penalRate: getNumber(row, ["penal_interest_rate"]),
    security: getString(row, ["security_details", "charge_details"], "Security pending"),
    status: normalizeLoanStatus(
      getString(row, ["risk_status", "loan_status"], "Performing")
    ),
    nextDueDate: getDateString(row, ["next_due_date", "maturity_date"], "2026-12-31"),
    nextDueAmount: getNumber(row, ["next_due_amount"]),
    overdueAmount: getNumber(row, ["overdue_amount"]),
  };
}

function mapRepayment(row: DataRow): RepaymentRow {
  const totalDue = getNumber(row, ["total_due"]);

  const principalReceived = getNumber(row, ["principal_received"]);
  const interestReceived = getNumber(row, ["interest_received"]);
  const feesReceived = getNumber(row, ["fees_received"]);
  const penaltyReceived = getNumber(row, ["penalty_received"]);
  const otherReceived = getNumber(row, ["other_received"]);

  const componentReceived =
    principalReceived +
    interestReceived +
    feesReceived +
    penaltyReceived +
    otherReceived;

  const receivedAmount =
    getNumber(row, ["amount_received"]) || componentReceived;

  const pendingAmount =
    getNumber(row, ["pending_amount"]) || Math.max(totalDue - receivedAmount, 0);

  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    loanId: getString(row, ["loan_id"], ""),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    dueDate: getDateString(row, ["due_date"], "2026-01-01"),
    openingPrincipal: getNumber(row, ["opening_principal"]),
    principalDue: getNumber(row, ["principal_due"]),
    interestDue: getNumber(row, ["interest_due"]),
    feesDue: getNumber(row, ["fees_due"]),
    penaltyDue: getNumber(row, ["penalty_due"]),
    totalDue,
    receivedAmount,
    principalReceived,
    interestReceived,
    feesReceived,
    penaltyReceived,
    otherReceived,
    pendingAmount,
    status: normalizeCollectionStatus(getString(row, ["collection_status"], "Pending")),
    daysPastDue: getNumber(row, ["days_past_due"]),
  };
}

function mapCovenant(row: DataRow): CovenantRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    loanId: getString(row, ["loan_id"], ""),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    covenant: getString(row, ["covenant_name"], "Covenant"),
    type: getString(row, ["covenant_type"], "Reporting"),
    frequency: getString(row, ["frequency"], "Monthly"),
    dueDate: getDateString(row, ["due_date"], "2026-01-01"),
    status: normalizeCovenantStatus(getString(row, ["covenant_status"], "Pending")),
    evidence: getString(row, ["evidence_required", "evidence_storage_path"], "Pending"),
  };
}

function mapNotice(row: DataRow): NoticeRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    noticeType: getString(row, ["notice_type"], "Repayment reminder"),
    dueDate: getDateString(row, ["due_date"], "2026-01-01"),
    amount: getNumber(row, ["total_due", "penalty_due", "principal_due"]),
    emailTo: getString(row, ["recipient_email"], "finance@borrower.com"),
    status: normalizeNoticeStatus(getString(row, ["notice_status"], "Draft")),
    linkedDocument: getString(row, ["pdf_file_name"], "Notice PDF"),
  };
}

function mapBankMatch(row: DataRow): BankMatchRow {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    expectedAmount: getNumber(row, ["expected_amount"]),
    receivedAmount: getNumber(row, ["received_amount"]),
    bankNarration: getString(row, ["bank_narration"], "No narration"),
    matchStatus: normalizeMatchStatus(getString(row, ["match_status"], "Unmatched")),
    action: getString(row, ["action_required"], "Review match"),
  };
}

function normalizeBankReconStatus(value: string): BankReconReceipt["matchStatus"] {
  const status = value.toLowerCase();

  if (status.includes("reject")) return "Rejected";
  if (status.includes("review")) return "Review";

  return "Approved";
}

function normalizeBankReconSyncStatus(value: string): BankReconReceipt["syncStatus"] {
  const status = value.toLowerCase();

  if (status.includes("sync")) return "Synced";
  if (status.includes("ignore")) return "Ignored";

  return "Ready";
}

function mapBankReconReceipt(row: DataRow): BankReconReceipt {
  return {
    id: getString(row, ["id"], crypto.randomUUID()),
    borrowerName: getString(row, ["borrower_name"], "Borrower"),
    loanId: getString(row, ["loan_id"], ""),
    repaymentScheduleId: getString(row, ["repayment_schedule_id"], ""),
    dueDate: getDateString(row, ["due_date"], "2026-01-01"),
    receiptDate: getDateString(row, ["receipt_date"], "2026-01-01"),
    bankReference: getString(row, ["bank_reference"], ""),
    bankNarration: getString(row, ["bank_narration"], "Bank reconciliation receipt"),
    principalReceived: getNumber(row, ["principal_received"]),
    interestReceived: getNumber(row, ["interest_received"]),
    feesReceived: getNumber(row, ["fees_received"]),
    penaltyReceived: getNumber(row, ["penalty_received"]),
    otherReceived: getNumber(row, ["other_received"]),
    matchStatus: normalizeBankReconStatus(getString(row, ["match_status"], "Approved")),
    syncStatus: normalizeBankReconSyncStatus(getString(row, ["sync_status"], "Ready")),
    confidence: getNumber(row, ["confidence"]),
  };
}

function getBankReconReceiptTotal(receipt: BankReconReceipt) {
  return (
    receipt.principalReceived +
    receipt.interestReceived +
    receipt.feesReceived +
    receipt.penaltyReceived +
    receipt.otherReceived
  );
}

function findScheduleRowForBankReconReceipt(
  receipt: BankReconReceipt,
  rows: RepaymentRow[]
) {
  const byScheduleId = rows.find(
    (row) => receipt.repaymentScheduleId && row.id === receipt.repaymentScheduleId
  );

  if (byScheduleId) return byScheduleId;

  const byLoanAndDate = rows.find(
    (row) =>
      receipt.loanId &&
      row.loanId === receipt.loanId &&
      row.dueDate === receipt.dueDate
  );

  if (byLoanAndDate) return byLoanAndDate;

  const byBorrowerAndDate = rows.find(
    (row) =>
      row.borrowerName.toLowerCase() === receipt.borrowerName.toLowerCase() &&
      row.dueDate === receipt.dueDate
  );

  if (byBorrowerAndDate) return byBorrowerAndDate;

  return rows.find(
    (row) =>
      row.borrowerName.toLowerCase() === receipt.borrowerName.toLowerCase() &&
      row.status !== "Received"
  );
}

function applyBankReconReceiptToRepaymentRow(
  row: RepaymentRow,
  receipt: BankReconReceipt
): RepaymentRow {
  const receivedAmount = getBankReconReceiptTotal(receipt);
  const pendingAmount = Math.max(row.totalDue - receivedAmount, 0);
  const nextStatus = getCollectionStatusFromAmounts(
    row.dueDate,
    row.totalDue,
    receivedAmount
  );

  return {
    ...row,
    receivedAmount,
    principalReceived: receipt.principalReceived,
    interestReceived: receipt.interestReceived,
    feesReceived: receipt.feesReceived,
    penaltyReceived: receipt.penaltyReceived,
    otherReceived: receipt.otherReceived,
    pendingAmount,
    status: nextStatus,
    daysPastDue: getDaysPastDue(row.dueDate),
  };
}

function buildBankMatchFromBankReconReceipt(
  receipt: BankReconReceipt,
  row: RepaymentRow
): BankMatchRow {
  const receivedAmount = getBankReconReceiptTotal(receipt);
  const pendingAmount = Math.max(row.totalDue - receivedAmount, 0);

  return {
    id: crypto.randomUUID(),
    borrowerName: row.borrowerName,
    expectedAmount: row.totalDue,
    receivedAmount,
    bankNarration: receipt.bankNarration || receipt.bankReference,
    matchStatus:
      pendingAmount <= 0 ? "Matched" : receivedAmount > 0 ? "Partial Match" : "Unmatched",
    action:
      pendingAmount <= 0
        ? "Synced from Bank Reconciliation"
        : "Partial receipt synced. Pending amount remains open.",
  };
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function addMonthsToDate(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setMonth(date.getMonth() + months);

  return date.toISOString().slice(0, 10);
}

function getFrequencyMonths(frequency: string) {
  const value = frequency.toLowerCase();

  if (value.includes("quarter")) return 3;
  if (value.includes("semi")) return 6;
  if (value.includes("annual")) return 12;
  if (value.includes("bullet")) return 0;

  return 1;
}

function getScheduleDates(startDate: string, maturityDate: string, frequency: string) {
  if (!startDate || !maturityDate) return [];

  if (frequency.toLowerCase().includes("bullet")) {
    return [maturityDate];
  }

  const stepMonths = getFrequencyMonths(frequency);
  const dates: string[] = [];
  let currentDate = startDate;

  for (let index = 0; index < 240; index += 1) {
    if (new Date(`${currentDate}T00:00:00`) > new Date(`${maturityDate}T00:00:00`)) {
      break;
    }

    dates.push(currentDate);
    currentDate = addMonthsToDate(currentDate, stepMonths || 1);
  }

  if (!dates.includes(maturityDate)) {
    dates.push(maturityDate);
  }

  return dates;
}

function buildRepaymentScheduleFromLoan(loan: DebtLoan): RepaymentRow[] {
  const scheduleDates = getScheduleDates(
    loan.repaymentStartDate,
    loan.maturityDate,
    loan.principalFrequency
  );

  if (scheduleDates.length === 0) return [];

  const isBullet = loan.principalFrequency.toLowerCase().includes("bullet");
  const principalInstallments = isBullet ? 1 : scheduleDates.length;
  const basePrincipalDue = principalInstallments
    ? loan.disbursedAmount / principalInstallments
    : 0;

  let openingPrincipal = loan.disbursedAmount;

  return scheduleDates.map((dueDate, index) => {
    const isLastRow = index === scheduleDates.length - 1;
    const frequencyMonths = isBullet
      ? Math.max(loan.tenureMonths, 1)
      : getFrequencyMonths(loan.principalFrequency) || 1;

    const principalDue = isBullet
      ? isLastRow
        ? openingPrincipal
        : 0
      : isLastRow
        ? openingPrincipal
        : Math.min(basePrincipalDue, openingPrincipal);

    const interestDue =
      openingPrincipal * (loan.couponRate / 100) * (frequencyMonths / 12);

    const feesDue = index === 0 ? loan.processingFee : 0;
    const penaltyDue = 0;
    const totalDue = principalDue + interestDue + feesDue + penaltyDue;
    const pendingAmount = totalDue;

    const row: RepaymentRow = {
      id: crypto.randomUUID(),
      loanId: loan.id,
      borrowerName: loan.borrowerName,
      dueDate,
      openingPrincipal,
      principalDue,
      interestDue,
      feesDue,
      penaltyDue,
      totalDue,
      receivedAmount: 0,
      pendingAmount,
      status: "Pending",
      daysPastDue: 0,
    };

    openingPrincipal = Math.max(openingPrincipal - principalDue, 0);

    return row;
  });
}
function getNoticeTypeForRepayment(row: RepaymentRow) {
  if (row.daysPastDue >= 30) return "Default notice";
  if (row.daysPastDue > 0 || row.status === "Overdue") return "Overdue reminder";
  if (row.penaltyDue > 0) return "Penalty notice";

  return "Pre-due reminder";
}

function buildNoticeFromRepayment(row: RepaymentRow): NoticeRow {
  const noticeType = getNoticeTypeForRepayment(row);

  return {
    id: crypto.randomUUID(),
    borrowerName: row.borrowerName,
    noticeType,
    dueDate: row.dueDate,
    amount: row.pendingAmount || row.totalDue,
    emailTo: "finance@borrower.com",
    status: "Draft",
    linkedDocument: `${noticeType} PDF`,
  };
}

function getDaysPastDue(dueDate: string) {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(due.getTime())) return 0;

  const difference = today.getTime() - due.getTime();
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  return Math.max(days, 0);
}

function getCollectionStatusFromAmounts(
  dueDate: string,
  totalDue: number,
  receivedAmount: number
): CollectionStatus {
  const pendingAmount = Math.max(totalDue - receivedAmount, 0);

  if (pendingAmount <= 0 && totalDue > 0) return "Received";
  if (receivedAmount > 0 && pendingAmount > 0) return "Partial";
  if (getDaysPastDue(dueDate) > 0 && pendingAmount > 0) return "Overdue";

  return "Pending";
}

function calculatePenaltyDue(row: RepaymentRow, loan?: DebtLoan) {
  const daysPastDue = getDaysPastDue(row.dueDate);

  if (daysPastDue <= 0 || row.pendingAmount <= 0 || row.status === "Received") {
    return 0;
  }

  const penalRate = loan?.penalRate || 24;
  const baseAmount = row.pendingAmount || row.totalDue;

  return Math.round(baseAmount * (penalRate / 100) * (daysPastDue / 365));
}

function getLoanStatusFromRows(loan: DebtLoan, rows: RepaymentRow[]): LoanStatus {
  const loanRows = rows.filter((row) => row.loanId === loan.id);
  const openRows = loanRows.filter((row) => row.pendingAmount > 0);
  const maxDaysPastDue = openRows.reduce(
    (maxDays, row) => Math.max(maxDays, row.daysPastDue),
    0
  );

  if (maxDaysPastDue >= 30) return "Default Watch";
  if (openRows.some((row) => row.status === "Overdue")) return "Overdue";

  const dueSoon = openRows.some((row) => {
    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    const today = new Date();
    const diffDays = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return diffDays >= 0 && diffDays <= 7;
  });

  if (dueSoon) return "Due Soon";

  return "Performing";
}

function getDefaultStage(row: RepaymentRow) {
  if (row.pendingAmount <= 0) return "Closed";
  if (row.daysPastDue >= 60) return "Default Escalation";
  if (row.daysPastDue >= 30) return "Default Watch";
  if (row.daysPastDue > 0) return "Overdue";
  return "Not Due";
}

function titleCaseFromFileName(fileName: string) {
  const cleanedName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/term sheet/gi, "")
    .replace(/executed/gi, "")
    .replace(/final/gi, "")
    .trim();

  if (!cleanedName) return "Extracted Borrower Pvt Ltd";

  return cleanedName
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function deriveTermSheetExtraction(fileName: string): TermSheetUploadForm {
  const borrowerName = titleCaseFromFileName(fileName);

  return {
    ...emptyTermSheetForm,
    fileName,
    extractionStatus: "AI Draft Extracted",
    borrowerName,
    borrowerEmail: "finance@borrower.com",
    fundName: "VENTIQ Venture Debt Fund I",
    instrumentType: "NCD",
    sanctionAmount: "100000000",
    disbursedAmount: "100000000",
    couponRate: "15.5",
    tenureMonths: "36",
    interestFrequency: "Monthly",
    principalFrequency: "Quarterly",
    moratoriumMonths: "6",
    moratoriumStartBasis: "Disbursement Date",
    repaymentStartDate: "2026-09-15",
    maturityDate: "2029-09-15",
    processingFee: "1000000",
    exitFee: "1500000",
    penalInterestRate: "24",
    securityDetails: "First ranking charge on receivables and escrow control",
    chargeDetails: "Charge creation to be tracked after disbursement",
    trusteeDetails: "Debenture trustee / security trustee as per executed documents",
    covenantOne: "Monthly MIS submission by 10th of every month",
    covenantTwo: "Minimum security cover to be maintained as per term sheet",
    covenantThree: "No additional borrowing without prior investor consent",
    extractionNotes:
      "Draft extraction prepared from uploaded term sheet metadata. Review all fields before creating the loan master.",
  };
}

function buildCovenantsFromTermSheet(
  loanId: string,
  borrowerName: string,
  form: TermSheetUploadForm
): CovenantRow[] {
  const covenantNames = [form.covenantOne, form.covenantTwo, form.covenantThree]
    .map((value) => value.trim())
    .filter(Boolean);

  return covenantNames.map((covenant, index) => ({
    id: crypto.randomUUID(),
    loanId,
    borrowerName,
    covenant,
    type: index === 0 ? "Reporting" : index === 1 ? "Security" : "Negative",
    frequency: index === 0 ? "Monthly" : index === 1 ? "Quarterly" : "Event based",
    dueDate: addMonthsToDate(form.repaymentStartDate || "2026-09-15", index + 1),
    status: "Pending",
    evidence:
      index === 0
        ? "MIS / CFO certificate"
        : index === 1
          ? "Security cover certificate"
          : "Borrower confirmation",
  }));
}

export default function DebtLMSPage() {
  const [loans, setLoans] = useState<DebtLoan[]>(sampleLoans);
  const [repaymentRows, setRepaymentRows] =
    useState<RepaymentRow[]>(sampleRepaymentRows);
  const [covenantRows, setCovenantRows] =
    useState<CovenantRow[]>(sampleCovenantRows);
  const [noticeRows, setNoticeRows] = useState<NoticeRow[]>(sampleNoticeRows);
  const [bankMatches, setBankMatches] =
    useState<BankMatchRow[]>(sampleBankMatches);

   const [selectedLoanId, setSelectedLoanId] = useState(sampleLoans[0].id);
  const [loading, setLoading] = useState(true);
  const [dataMessage, setDataMessage] = useState(
    "Loading Debt LMS workspace..."
  );

  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [loanForm, setLoanForm] = useState<NewLoanForm>(emptyLoanForm);
  const [isSavingLoan, setIsSavingLoan] = useState(false);
  const [loanFormMessage, setLoanFormMessage] = useState("");
  const [loanFormError, setLoanFormError] = useState("");
    const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
    const [isGeneratingNotices, setIsGeneratingNotices] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
    const [isQueuingEmails, setIsQueuingEmails] = useState(false);
  const [emailQueueMessage, setEmailQueueMessage] = useState("");

  const [receiptRow, setReceiptRow] = useState<RepaymentRow | null>(null);
  const [receiptForm, setReceiptForm] =
    useState<ReceiptUpdateForm>(emptyReceiptForm);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState("");

  const [isSyncingBankRecon, setIsSyncingBankRecon] = useState(false);
  const [bankReconSyncMessage, setBankReconSyncMessage] = useState("");

  const [isRunningDefaultReview, setIsRunningDefaultReview] = useState(false);
  const [defaultReviewMessage, setDefaultReviewMessage] = useState("");

  const [isTermSheetOpen, setIsTermSheetOpen] = useState(false);
  const [termSheetForm, setTermSheetForm] =
    useState<TermSheetUploadForm>(emptyTermSheetForm);
  const [termSheetMessage, setTermSheetMessage] = useState("");
  const [isExtractingTermSheet, setIsExtractingTermSheet] = useState(false);
  const [isSavingTermSheet, setIsSavingTermSheet] = useState(false);

  useEffect(() => {
    async function loadDebtLmsData() {
      if (!isSupabaseConfigured || !supabase) {
        setDataMessage("Using sample Debt LMS data. Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const db = supabase as any;

        const [
          loansResult,
          repaymentResult,
          covenantsResult,
          noticesResult,
          bankMatchesResult,
        ] = await Promise.all([
          db
            .from("debt_lms_loans")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("debt_lms_repayment_schedule")
            .select("*")
            .order("due_date", { ascending: true }),

          db
            .from("debt_lms_covenants")
            .select("*")
            .order("due_date", { ascending: true }),

          db
            .from("debt_lms_notices")
            .select("*")
            .order("created_at", { ascending: false }),

          db
            .from("debt_lms_bank_matches")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (loansResult.error) throw new Error(loansResult.error.message);
        if (repaymentResult.error) throw new Error(repaymentResult.error.message);
        if (covenantsResult.error) throw new Error(covenantsResult.error.message);
        if (noticesResult.error) throw new Error(noticesResult.error.message);
        if (bankMatchesResult.error) {
          throw new Error(bankMatchesResult.error.message);
        }

        const nextLoans =
          loansResult.data && loansResult.data.length > 0
            ? (loansResult.data as DataRow[]).map(mapLoan)
            : sampleLoans;

        const nextRepayments =
          repaymentResult.data && repaymentResult.data.length > 0
            ? (repaymentResult.data as DataRow[]).map(mapRepayment)
            : sampleRepaymentRows;

        const nextCovenants =
          covenantsResult.data && covenantsResult.data.length > 0
            ? (covenantsResult.data as DataRow[]).map(mapCovenant)
            : sampleCovenantRows;

        const nextNotices =
          noticesResult.data && noticesResult.data.length > 0
            ? (noticesResult.data as DataRow[]).map(mapNotice)
            : sampleNoticeRows;

        const nextBankMatches =
          bankMatchesResult.data && bankMatchesResult.data.length > 0
            ? (bankMatchesResult.data as DataRow[]).map(mapBankMatch)
            : sampleBankMatches;

        setLoans(nextLoans);
        setRepaymentRows(nextRepayments);
        setCovenantRows(nextCovenants);
        setNoticeRows(nextNotices);
        setBankMatches(nextBankMatches);
        setSelectedLoanId(nextLoans[0]?.id || sampleLoans[0].id);

        setDataMessage(
          loansResult.data && loansResult.data.length > 0
            ? "Connected to Debt LMS Supabase records."
            : "Debt LMS tables are ready. Showing sample data until loans are added."
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? `Debt LMS database issue: ${error.message}`
            : "Unable to load Debt LMS data. Showing sample data."
        );

        setLoans(sampleLoans);
        setRepaymentRows(sampleRepaymentRows);
        setCovenantRows(sampleCovenantRows);
        setNoticeRows(sampleNoticeRows);
        setBankMatches(sampleBankMatches);
      } finally {
        setLoading(false);
      }
    }

    loadDebtLmsData();
  }, []);
  function updateLoanForm(field: keyof NewLoanForm, value: string) {
    setLoanForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function closeAddLoanModal() {
    setIsAddLoanOpen(false);
    setLoanForm(emptyLoanForm);
    setLoanFormMessage("");
    setLoanFormError("");
  }

  async function submitNewLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoanFormMessage("");
    setLoanFormError("");

    if (!loanForm.borrowerName.trim()) {
      setLoanFormError("Borrower name is required.");
      return;
    }

    if (!loanForm.fundName.trim()) {
      setLoanFormError("Fund name is required.");
      return;
    }

    setIsSavingLoan(true);

    const payload = {
      borrower_name: loanForm.borrowerName.trim(),
      borrower_email: loanForm.borrowerEmail.trim(),
      finance_contact_name: loanForm.financeContactName.trim(),
      finance_contact_email: loanForm.financeContactEmail.trim(),
      escalation_contact_name: loanForm.escalationContactName.trim(),
      escalation_contact_email: loanForm.escalationContactEmail.trim(),

      fund_name: loanForm.fundName.trim(),
      instrument_type: loanForm.instrumentType,
      facility_reference: loanForm.facilityReference.trim(),

      sanction_amount: Number(loanForm.sanctionAmount || 0),
      disbursed_amount: Number(loanForm.disbursedAmount || 0),

      sanction_date: loanForm.sanctionDate || null,
      disbursement_date: loanForm.disbursementDate || null,
      first_drawdown_date: loanForm.firstDrawdownDate || null,
      tenure_months: Number(loanForm.tenureMonths || 0),
      coupon_rate: Number(loanForm.couponRate || 0),

      interest_frequency: loanForm.interestFrequency,
      principal_frequency: loanForm.principalFrequency,
      principal_repayment_type: loanForm.principalFrequency,

      moratorium_months: Number(loanForm.moratoriumMonths || 0),
      moratorium_start_basis: loanForm.moratoriumStartBasis,
      repayment_start_date: loanForm.repaymentStartDate || null,
      maturity_date: loanForm.maturityDate || null,

      processing_fee: Number(loanForm.processingFee || 0),
      commitment_fee: Number(loanForm.commitmentFee || 0),
      exit_fee: Number(loanForm.exitFee || 0),
      prepayment_fee: Number(loanForm.prepaymentFee || 0),
      penal_interest_rate: Number(loanForm.penalInterestRate || 0),

      security_details: loanForm.securityDetails.trim(),
      charge_details: loanForm.chargeDetails.trim(),
      trustee_details: loanForm.trusteeDetails.trim(),
      bank_account_details: loanForm.bankAccountDetails.trim(),

      loan_status: "Active",
      risk_status: "On Track",
      source_type: "Manual",
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localLoan: DebtLoan = {
          id: crypto.randomUUID(),
          borrowerName: payload.borrower_name,
          fundName: payload.fund_name,
          instrument: payload.instrument_type,
          sanctionAmount: payload.sanction_amount,
          disbursedAmount: payload.disbursed_amount,
          disbursementDate: payload.disbursement_date || "2026-01-01",
          tenureMonths: payload.tenure_months,
          couponRate: payload.coupon_rate,
          interestFrequency: payload.interest_frequency,
          principalFrequency: payload.principal_frequency,
          moratoriumMonths: payload.moratorium_months,
          moratoriumStart: payload.moratorium_start_basis,
          repaymentStartDate: payload.repayment_start_date || "2026-01-01",
          maturityDate: payload.maturity_date || "2026-12-31",
          processingFee: payload.processing_fee,
          exitFee: payload.exit_fee,
          penalRate: payload.penal_interest_rate,
          security: payload.security_details || "Security pending",
          status: "Performing",
          nextDueDate: payload.repayment_start_date || "2026-12-31",
          nextDueAmount: 0,
          overdueAmount: 0,
        };

        setLoans((currentLoans) => [localLoan, ...currentLoans]);
        setSelectedLoanId(localLoan.id);
        setDataMessage("New loan added locally. Supabase is not configured.");
        closeAddLoanModal();
        return;
      }

      const db = supabase as any;

      const { data, error } = await db
        .from("debt_lms_loans")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const savedLoan = mapLoan(data as DataRow);

      setLoans((currentLoans) => [savedLoan, ...currentLoans]);
      setSelectedLoanId(savedLoan.id);
      setDataMessage("New debt loan saved to Supabase.");
      setLoanFormMessage("Loan saved successfully.");
      closeAddLoanModal();
    } catch (error) {
      setLoanFormError(
        error instanceof Error ? error.message : "Unable to save new loan."
      );
    } finally {
      setIsSavingLoan(false);
    }
  }
    async function generateRepaymentScheduleForSelectedLoan() {
    setScheduleMessage("");

    if (!selectedLoan) {
      setScheduleMessage("No loan selected.");
      return;
    }

    const generatedSchedule = buildRepaymentScheduleFromLoan(selectedLoan);

    if (generatedSchedule.length === 0) {
      setScheduleMessage(
        "Unable to generate schedule. Please check repayment start date, maturity date and principal frequency."
      );
      return;
    }

    setIsGeneratingSchedule(true);

    try {
      const canSaveToSupabase =
        isSupabaseConfigured && supabase && isUuid(selectedLoan.id);

      if (!canSaveToSupabase) {
        setRepaymentRows((currentRows) => [
          ...generatedSchedule,
          ...currentRows.filter((row) => row.loanId !== selectedLoan.id),
        ]);

        setScheduleMessage(
          "Repayment schedule generated locally. Save a real Supabase loan to persist it."
        );
        return;
      }

      const db = supabase as any;

      const payload = generatedSchedule.map((row, index) => ({
        loan_id: selectedLoan.id,
        borrower_name: selectedLoan.borrowerName,
        installment_number: index + 1,
        due_date: row.dueDate,
        opening_principal: row.openingPrincipal,
        principal_due: row.principalDue,
        interest_due: row.interestDue,
        fees_due: row.feesDue,
        penalty_due: row.penaltyDue,
        total_due: row.totalDue,
        amount_received: 0,
        pending_amount: row.pendingAmount,
        collection_status: "Upcoming",
        days_past_due: 0,
        penalty_applied: false,
        penalty_waived: false,
        notice_status: "Not Sent",
        schedule_source: "Generated from Debt LMS",
      }));

      await db
        .from("debt_lms_repayment_schedule")
        .delete()
        .eq("loan_id", selectedLoan.id);

      const { data, error } = await db
        .from("debt_lms_repayment_schedule")
        .insert(payload)
        .select("*")
        .order("due_date", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const savedSchedule =
        data && data.length > 0
          ? (data as DataRow[]).map(mapRepayment)
          : generatedSchedule;

      setRepaymentRows((currentRows) => [
        ...savedSchedule,
        ...currentRows.filter((row) => row.loanId !== selectedLoan.id),
      ]);

      setScheduleMessage(
        `${savedSchedule.length} repayment schedule row(s) generated and saved.`
      );
    } catch (error) {
      setScheduleMessage(
        error instanceof Error
          ? `Schedule generation failed: ${error.message}`
          : "Schedule generation failed."
      );
    } finally {
      setIsGeneratingSchedule(false);
    }
  }
    async function generateRepaymentNotices() {
    setNoticeMessage("");

    const rowsNeedingNotice = repaymentRows.filter(
      (row) => row.pendingAmount > 0 && row.status !== "Received"
    );

    if (rowsNeedingNotice.length === 0) {
      setNoticeMessage("No pending repayment rows found for notice generation.");
      return;
    }

    setIsGeneratingNotices(true);

    try {
      const generatedNotices = rowsNeedingNotice.map(buildNoticeFromRepayment);

      if (!isSupabaseConfigured || !supabase) {
        setNoticeRows((currentRows) => [...generatedNotices, ...currentRows]);
        setNoticeMessage(
          `${generatedNotices.length} repayment notice(s) generated locally.`
        );
        return;
      }

      const db = supabase as any;

      const payload = rowsNeedingNotice.map((row) => {
        const noticeType = getNoticeTypeForRepayment(row);

        return {
          repayment_schedule_id: isUuid(row.id) ? row.id : null,
          loan_id: isUuid(row.loanId) ? row.loanId : null,
          borrower_name: row.borrowerName,
          notice_type: noticeType,
          notice_title: `${noticeType} - ${row.borrowerName}`,
          due_date: row.dueDate,
          principal_due: row.principalDue,
          interest_due: row.interestDue,
          fees_due: row.feesDue,
          penalty_due: row.penaltyDue,
          total_due: row.pendingAmount || row.totalDue,
          recipient_email: "finance@borrower.com",
          cc_emails: [],
          email_subject: `${noticeType} for repayment due on ${formatDate(
            row.dueDate
          )}`,
          email_body: `Dear Team,\n\nThis is a ${noticeType.toLowerCase()} for the repayment due on ${formatDate(
            row.dueDate
          )}. Total pending amount is ${formatCurrency(
            row.pendingAmount || row.totalDue
          )}.\n\nRegards,\nFinance Team`,
          pdf_file_name: `${noticeType}-${row.borrowerName}.pdf`,
          notice_status: "Draft",
        };
      });

      const { data, error } = await db
        .from("debt_lms_notices")
        .insert(payload)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const savedNotices =
        data && data.length > 0
          ? (data as DataRow[]).map(mapNotice)
          : generatedNotices;

      setNoticeRows((currentRows) => [...savedNotices, ...currentRows]);

      setNoticeMessage(
        `${savedNotices.length} repayment notice(s) generated and saved.`
      );
    } catch (error) {
      setNoticeMessage(
        error instanceof Error
          ? `Notice generation failed: ${error.message}`
          : "Notice generation failed."
      );
    } finally {
      setIsGeneratingNotices(false);
    }
  }
    async function queueEmailsFromGeneratedNotices() {
    setEmailQueueMessage("");

    const noticesToQueue = noticeRows.filter(
      (notice) => notice.status === "Draft" || notice.status === "Queued"
    );

    if (noticesToQueue.length === 0) {
      setEmailQueueMessage("No draft notices available for email queue.");
      return;
    }

    setIsQueuingEmails(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setNoticeRows((currentRows) =>
          currentRows.map((notice) =>
            noticesToQueue.some((queuedNotice) => queuedNotice.id === notice.id)
              ? { ...notice, status: "Queued" }
              : notice
          )
        );

        setEmailQueueMessage(
          `${noticesToQueue.length} email(s) queued locally.`
        );
        return;
      }

      const db = supabase as any;

      const payload = noticesToQueue.map((notice) => ({
        notice_id: isUuid(notice.id) ? notice.id : null,
        loan_id: null,
        borrower_name: notice.borrowerName,
        recipient_email: notice.emailTo,
        cc_emails: [],
        email_subject: `${notice.noticeType} - ${notice.borrowerName}`,
        email_body: `Dear Team,\n\nPlease find the ${notice.noticeType.toLowerCase()} for repayment due on ${formatDate(
          notice.dueDate
        )}. Total pending amount is ${formatCurrency(
          notice.amount
        )}.\n\nRegards,\nFinance Team`,
        attachment_url: "",
        email_status: "Queued",
      }));

      const { error: emailError } = await db
        .from("debt_lms_email_queue")
        .insert(payload);

      if (emailError) {
        throw new Error(emailError.message);
      }

      const noticeIds = noticesToQueue
        .map((notice) => notice.id)
        .filter((id) => isUuid(id));

      if (noticeIds.length > 0) {
        const { error: updateError } = await db
          .from("debt_lms_notices")
          .update({
            notice_status: "Queued",
            queued_at: new Date().toISOString(),
          })
          .in("id", noticeIds);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      setNoticeRows((currentRows) =>
        currentRows.map((notice) =>
          noticesToQueue.some((queuedNotice) => queuedNotice.id === notice.id)
            ? { ...notice, status: "Queued" }
            : notice
        )
      );

      setEmailQueueMessage(
        `${noticesToQueue.length} email(s) added to dispatch queue.`
      );
    } catch (error) {
      setEmailQueueMessage(
        error instanceof Error
          ? `Email queue failed: ${error.message}`
          : "Email queue failed."
      );
    } finally {
      setIsQueuingEmails(false);
    }
  }
  function openReceiptUpdate(row: RepaymentRow) {
    setReceiptRow(row);
    setReceiptForm({
      principalReceived: row.principalReceived
        ? String(row.principalReceived)
        : "",
      interestReceived: row.interestReceived ? String(row.interestReceived) : "",
      feesReceived: row.feesReceived ? String(row.feesReceived) : "",
      penaltyReceived: row.penaltyReceived ? String(row.penaltyReceived) : "",
      otherReceived: row.otherReceived ? String(row.otherReceived) : "",
      receiptDate: new Date().toISOString().slice(0, 10),
      bankReference: "",
      remarks: "",
    });
    setReceiptMessage("");
  }

  function closeReceiptUpdate() {
    setReceiptRow(null);
    setReceiptForm(emptyReceiptForm);
  }

  function updateReceiptForm(field: keyof ReceiptUpdateForm, value: string) {
    setReceiptForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function submitReceiptUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!receiptRow) return;

    const principalReceived = Number(receiptForm.principalReceived || 0);
    const interestReceived = Number(receiptForm.interestReceived || 0);
    const feesReceived = Number(receiptForm.feesReceived || 0);
    const penaltyReceived = Number(receiptForm.penaltyReceived || 0);
    const otherReceived = Number(receiptForm.otherReceived || 0);

    const receivedAmount =
      principalReceived +
      interestReceived +
      feesReceived +
      penaltyReceived +
      otherReceived;

    if (
      principalReceived < 0 ||
      interestReceived < 0 ||
      feesReceived < 0 ||
      penaltyReceived < 0 ||
      otherReceived < 0
    ) {
      setReceiptMessage("Received amounts cannot be negative.");
      return;
    }

    const pendingAmount = Math.max(receiptRow.totalDue - receivedAmount, 0);
    const nextStatus = getCollectionStatusFromAmounts(
      receiptRow.dueDate,
      receiptRow.totalDue,
      receivedAmount
    );

    const updatedRow: RepaymentRow = {
      ...receiptRow,
      receivedAmount,
      principalReceived,
      interestReceived,
      feesReceived,
      penaltyReceived,
      otherReceived,
      pendingAmount,
      status: nextStatus,
      daysPastDue: getDaysPastDue(receiptRow.dueDate),
    };

    setIsSavingReceipt(true);
    setReceiptMessage("");

    try {
      if (isSupabaseConfigured && supabase && isUuid(receiptRow.id)) {
        const db = supabase as any;

        const { error } = await db
          .from("debt_lms_repayment_schedule")
          .update({
            principal_received: principalReceived,
            interest_received: interestReceived,
            fees_received: feesReceived,
            penalty_received: penaltyReceived,
            other_received: otherReceived,
            amount_received: receivedAmount,
            receipt_date: receiptForm.receiptDate || null,
            bank_reference: receiptForm.bankReference.trim(),
            receipt_remarks: receiptForm.remarks.trim(),
            pending_amount: pendingAmount,
            collection_status: nextStatus,
            days_past_due: updatedRow.daysPastDue,
          })
          .eq("id", receiptRow.id);

        if (error) {
          throw new Error(error.message);
        }
      }

      setRepaymentRows((currentRows) =>
        currentRows.map((row) => (row.id === receiptRow.id ? updatedRow : row))
      );

      setReceiptMessage(
        `Receipt updated. Total received ${formatCurrency(
          receivedAmount
        )}. Pending amount is ${formatCurrency(pendingAmount)}.`
      );

      setTimeout(() => {
        closeReceiptUpdate();
      }, 700);
    } catch (error) {
      setReceiptMessage(
        error instanceof Error ? error.message : "Unable to update receipt."
      );
    } finally {
      setIsSavingReceipt(false);
    }
  }

  async function syncReceiptsFromBankReconciliation() {
    setBankReconSyncMessage("");
    setIsSyncingBankRecon(true);

    try {
      let receiptsToSync = sampleBankReconReceipts.filter(
        (receipt) => receipt.matchStatus === "Approved" && receipt.syncStatus === "Ready"
      );

      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;

        const { data, error } = await db
          .from("bank_reconciliation_debt_receipts")
          .select("*")
          .eq("match_status", "Approved")
          .eq("sync_status", "Ready")
          .order("receipt_date", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        receiptsToSync = data && data.length > 0 ? (data as DataRow[]).map(mapBankReconReceipt) : [];
      }

      if (receiptsToSync.length === 0) {
        setBankReconSyncMessage(
          "No approved Bank Reconciliation receipts are ready to sync."
        );
        return;
      }

      const nextRepaymentRows = [...repaymentRows];
      const nextBankMatches: BankMatchRow[] = [];
      const syncedReceiptIds: string[] = [];
      const updatedScheduleRows: RepaymentRow[] = [];

      receiptsToSync.forEach((receipt) => {
        const existingRow = findScheduleRowForBankReconReceipt(
          receipt,
          nextRepaymentRows
        );

        if (!existingRow) return;

        const updatedRow = applyBankReconReceiptToRepaymentRow(existingRow, receipt);
        const rowIndex = nextRepaymentRows.findIndex((row) => row.id === existingRow.id);

        if (rowIndex >= 0) {
          nextRepaymentRows[rowIndex] = updatedRow;
          updatedScheduleRows.push(updatedRow);
          nextBankMatches.push(buildBankMatchFromBankReconReceipt(receipt, updatedRow));
          syncedReceiptIds.push(receipt.id);
        }
      });

      if (updatedScheduleRows.length === 0) {
        setBankReconSyncMessage(
          "Bank Reconciliation receipts were found, but no matching Debt LMS schedule row was available."
        );
        return;
      }

      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;

        const scheduleUpdates = updatedScheduleRows
          .filter((row) => isUuid(row.id))
          .map((row) =>
            db
              .from("debt_lms_repayment_schedule")
              .update({
                principal_received: row.principalReceived || 0,
                interest_received: row.interestReceived || 0,
                fees_received: row.feesReceived || 0,
                penalty_received: row.penaltyReceived || 0,
                other_received: row.otherReceived || 0,
                amount_received: row.receivedAmount,
                pending_amount: row.pendingAmount,
                collection_status: row.status,
                days_past_due: row.daysPastDue,
                receipt_date: new Date().toISOString().slice(0, 10),
              })
              .eq("id", row.id)
          );

        if (scheduleUpdates.length > 0) {
          const updateResults = await Promise.all(scheduleUpdates);
          const updateError = updateResults.find((result) => result.error)?.error;

          if (updateError) {
            throw new Error(updateError.message);
          }
        }

        if (nextBankMatches.length > 0) {
          const bankMatchPayload = nextBankMatches.map((match) => ({
            borrower_name: match.borrowerName,
            expected_amount: match.expectedAmount,
            received_amount: match.receivedAmount,
            pending_amount: Math.max(match.expectedAmount - match.receivedAmount, 0),
            bank_narration: match.bankNarration,
            match_status: match.matchStatus,
            match_confidence:
              match.matchStatus === "Matched"
                ? 95
                : match.matchStatus === "Partial Match"
                  ? 70
                  : 35,
            action_required: match.action,
          }));

          const { data: savedBankMatches, error: bankMatchError } = await db
            .from("debt_lms_bank_matches")
            .insert(bankMatchPayload)
            .select("*")
            .order("created_at", { ascending: false });

          if (bankMatchError) {
            throw new Error(bankMatchError.message);
          }

          if (savedBankMatches && savedBankMatches.length > 0) {
            nextBankMatches.splice(
              0,
              nextBankMatches.length,
              ...(savedBankMatches as DataRow[]).map(mapBankMatch)
            );
          }
        }

        const validReceiptIds = syncedReceiptIds.filter((id) => isUuid(id));

        if (validReceiptIds.length > 0) {
          const { error: syncError } = await db
            .from("bank_reconciliation_debt_receipts")
            .update({
              sync_status: "Synced",
              synced_at: new Date().toISOString(),
            })
            .in("id", validReceiptIds);

          if (syncError) {
            throw new Error(syncError.message);
          }
        }
      }

      setRepaymentRows(nextRepaymentRows);
      setBankMatches((currentMatches) => [...nextBankMatches, ...currentMatches]);
      setBankReconSyncMessage(
        `${updatedScheduleRows.length} receipt(s) synced from Bank Reconciliation.`
      );
    } catch (error) {
      setBankReconSyncMessage(
        error instanceof Error
          ? `Bank Reconciliation sync failed: ${error.message}`
          : "Bank Reconciliation sync failed."
      );
    } finally {
      setIsSyncingBankRecon(false);
    }
  }

  async function runPenaltyAndDefaultReview() {
    setDefaultReviewMessage("");
    setIsRunningDefaultReview(true);

    try {
      const reviewedRows = repaymentRows.map((row) => {
        const loan = loans.find((loanItem) => loanItem.id === row.loanId);
        const existingReceivedAmount = row.receivedAmount || 0;
        const daysPastDue = getDaysPastDue(row.dueDate);
        const calculatedPenalty = calculatePenaltyDue(row, loan);
        const nextPenaltyDue = Math.max(row.penaltyDue || 0, calculatedPenalty);
        const nextTotalDue =
          row.principalDue + row.interestDue + row.feesDue + nextPenaltyDue;
        const nextPendingAmount = Math.max(nextTotalDue - existingReceivedAmount, 0);
        const nextStatus = getCollectionStatusFromAmounts(
          row.dueDate,
          nextTotalDue,
          existingReceivedAmount
        );

        return {
          ...row,
          penaltyDue: nextPenaltyDue,
          totalDue: nextTotalDue,
          pendingAmount: nextPendingAmount,
          status: nextStatus,
          daysPastDue,
        };
      });

      const reviewedLoans = loans.map((loan) => {
        const loanRows = reviewedRows.filter((row) => row.loanId === loan.id);
        const overdueAmount = loanRows
          .filter((row) => row.pendingAmount > 0 && row.daysPastDue > 0)
          .reduce((sum, row) => sum + row.pendingAmount, 0);
        const nextDueRow = loanRows
          .filter((row) => row.pendingAmount > 0)
          .sort(
            (first, second) =>
              new Date(`${first.dueDate}T00:00:00`).getTime() -
              new Date(`${second.dueDate}T00:00:00`).getTime()
          )[0];

        return {
          ...loan,
          status: getLoanStatusFromRows(loan, reviewedRows),
          overdueAmount,
          nextDueDate: nextDueRow?.dueDate || loan.nextDueDate,
          nextDueAmount: nextDueRow?.pendingAmount || 0,
        };
      });

      const generatedDefaultNotices = reviewedRows
        .filter(
          (row) =>
            row.pendingAmount > 0 &&
            row.daysPastDue > 0 &&
            row.status !== "Received"
        )
        .map((row) => ({
          ...buildNoticeFromRepayment(row),
          noticeType:
            row.daysPastDue >= 30
              ? "Default watch notice"
              : row.penaltyDue > 0
                ? "Penalty notice"
                : "Overdue reminder",
          amount: row.pendingAmount,
          linkedDocument:
            row.daysPastDue >= 30
              ? "Default Watch Notice PDF"
              : row.penaltyDue > 0
                ? "Penalty Notice PDF"
                : "Overdue Reminder PDF",
        }));

      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;

        const scheduleUpdates = reviewedRows
          .filter((row) => isUuid(row.id))
          .map((row) =>
            db
              .from("debt_lms_repayment_schedule")
              .update({
                penalty_due: row.penaltyDue,
                total_due: row.totalDue,
                pending_amount: row.pendingAmount,
                collection_status: row.status,
                days_past_due: row.daysPastDue,
                penalty_applied: row.penaltyDue > 0,
                default_stage: getDefaultStage(row),
                escalation_status:
                  row.daysPastDue >= 30
                    ? "Default Watch"
                    : row.daysPastDue > 0
                      ? "Overdue Follow-up"
                      : "No Escalation",
                last_penalty_calculated_at: new Date().toISOString(),
              })
              .eq("id", row.id)
          );

        if (scheduleUpdates.length > 0) {
          const updateResults = await Promise.all(scheduleUpdates);
          const updateError = updateResults.find((result) => result.error)?.error;

          if (updateError) {
            throw new Error(updateError.message);
          }
        }

        const loanUpdates = reviewedLoans
          .filter((loan) => isUuid(loan.id))
          .map((loan) =>
            db
              .from("debt_lms_loans")
              .update({
                risk_status: loan.status,
                overdue_amount: loan.overdueAmount,
                next_due_date: loan.nextDueDate,
                next_due_amount: loan.nextDueAmount,
                default_stage:
                  loan.status === "Default Watch"
                    ? "Default Watch"
                    : loan.status === "Overdue"
                      ? "Overdue"
                      : "Normal",
                last_default_review_at: new Date().toISOString(),
              })
              .eq("id", loan.id)
          );

        if (loanUpdates.length > 0) {
          const loanUpdateResults = await Promise.all(loanUpdates);
          const loanUpdateError = loanUpdateResults.find((result) => result.error)
            ?.error;

          if (loanUpdateError) {
            throw new Error(loanUpdateError.message);
          }
        }

        if (generatedDefaultNotices.length > 0) {
          const noticePayload = generatedDefaultNotices.map((notice) => ({
            borrower_name: notice.borrowerName,
            notice_type: notice.noticeType,
            notice_title: `${notice.noticeType} - ${notice.borrowerName}`,
            due_date: notice.dueDate,
            total_due: notice.amount,
            recipient_email: notice.emailTo,
            cc_emails: [],
            email_subject: `${notice.noticeType} - ${notice.borrowerName}`,
            email_body: `Dear Team,\n\nThis is a ${notice.noticeType.toLowerCase()} for pending repayment amount of ${formatCurrency(
              notice.amount
            )}. Please arrange payment or share confirmation immediately.\n\nRegards,\nFinance Team`,
            pdf_file_name: notice.linkedDocument,
            notice_status: "Draft",
          }));

          const { data: savedNotices, error: noticeError } = await db
            .from("debt_lms_notices")
            .insert(noticePayload)
            .select("*")
            .order("created_at", { ascending: false });

          if (noticeError) {
            throw new Error(noticeError.message);
          }

          if (savedNotices && savedNotices.length > 0) {
            generatedDefaultNotices.splice(
              0,
              generatedDefaultNotices.length,
              ...(savedNotices as DataRow[]).map(mapNotice)
            );
          }
        }
      }

      setRepaymentRows(reviewedRows);
      setLoans(reviewedLoans);
      setNoticeRows((currentRows) => [
        ...generatedDefaultNotices,
        ...currentRows,
      ]);

      const penaltyRows = reviewedRows.filter((row) => row.penaltyDue > 0).length;
      const defaultWatchRows = reviewedRows.filter(
        (row) => row.pendingAmount > 0 && row.daysPastDue >= 30
      ).length;

      setDefaultReviewMessage(
        `Default review completed. ${penaltyRows} row(s) have penalty applied and ${defaultWatchRows} row(s) are on default watch.`
      );
    } catch (error) {
      setDefaultReviewMessage(
        error instanceof Error
          ? `Default review failed: ${error.message}`
          : "Default review failed."
      );
    } finally {
      setIsRunningDefaultReview(false);
    }
  }

  function openTermSheetModal() {
    setIsTermSheetOpen(true);
    setTermSheetForm(emptyTermSheetForm);
    setTermSheetMessage("");
  }

  function closeTermSheetModal() {
    setIsTermSheetOpen(false);
    setTermSheetForm(emptyTermSheetForm);
    setTermSheetMessage("");
  }

  function updateTermSheetForm(field: keyof TermSheetUploadForm, value: string) {
    setTermSheetForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleTermSheetFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsExtractingTermSheet(true);
    setTermSheetMessage("Reading term sheet and preparing draft extraction...");

    const extractedForm = deriveTermSheetExtraction(file.name);
    setTermSheetForm(extractedForm);

    setTimeout(() => {
      setIsExtractingTermSheet(false);
      setTermSheetMessage(
        "Draft extraction ready. Review the loan terms and covenants before creating the loan master."
      );
    }, 500);
  }

  async function createLoanFromExtractedTermSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTermSheetMessage("");

    if (!termSheetForm.borrowerName.trim()) {
      setTermSheetMessage("Borrower name is required before creating the loan.");
      return;
    }

    if (!termSheetForm.fundName.trim()) {
      setTermSheetMessage("Fund name is required before creating the loan.");
      return;
    }

    setIsSavingTermSheet(true);

    const loanPayload = {
      borrower_name: termSheetForm.borrowerName.trim(),
      borrower_email: termSheetForm.borrowerEmail.trim(),
      fund_name: termSheetForm.fundName.trim(),
      instrument_type: termSheetForm.instrumentType,
      facility_reference: `${termSheetForm.borrowerName.trim()} term sheet`,
      sanction_amount: Number(termSheetForm.sanctionAmount || 0),
      disbursed_amount: Number(termSheetForm.disbursedAmount || 0),
      disbursement_date: termSheetForm.repaymentStartDate || null,
      first_drawdown_date: termSheetForm.repaymentStartDate || null,
      tenure_months: Number(termSheetForm.tenureMonths || 0),
      coupon_rate: Number(termSheetForm.couponRate || 0),
      interest_frequency: termSheetForm.interestFrequency,
      principal_frequency: termSheetForm.principalFrequency,
      principal_repayment_type: termSheetForm.principalFrequency,
      moratorium_months: Number(termSheetForm.moratoriumMonths || 0),
      moratorium_start_basis: termSheetForm.moratoriumStartBasis,
      repayment_start_date: termSheetForm.repaymentStartDate || null,
      maturity_date: termSheetForm.maturityDate || null,
      processing_fee: Number(termSheetForm.processingFee || 0),
      exit_fee: Number(termSheetForm.exitFee || 0),
      penal_interest_rate: Number(termSheetForm.penalInterestRate || 0),
      security_details: termSheetForm.securityDetails.trim(),
      charge_details: termSheetForm.chargeDetails.trim(),
      trustee_details: termSheetForm.trusteeDetails.trim(),
      loan_status: "Active",
      risk_status: "On Track",
      source_type: "Term Sheet Upload",
    };

    try {
      if (!isSupabaseConfigured || !supabase) {
        const localLoan: DebtLoan = {
          id: crypto.randomUUID(),
          borrowerName: loanPayload.borrower_name,
          fundName: loanPayload.fund_name,
          instrument: loanPayload.instrument_type,
          sanctionAmount: loanPayload.sanction_amount,
          disbursedAmount: loanPayload.disbursed_amount,
          disbursementDate: loanPayload.disbursement_date || "2026-09-15",
          tenureMonths: loanPayload.tenure_months,
          couponRate: loanPayload.coupon_rate,
          interestFrequency: loanPayload.interest_frequency,
          principalFrequency: loanPayload.principal_frequency,
          moratoriumMonths: loanPayload.moratorium_months,
          moratoriumStart: loanPayload.moratorium_start_basis,
          repaymentStartDate: loanPayload.repayment_start_date || "2026-09-15",
          maturityDate: loanPayload.maturity_date || "2029-09-15",
          processingFee: loanPayload.processing_fee,
          exitFee: loanPayload.exit_fee,
          penalRate: loanPayload.penal_interest_rate,
          security: loanPayload.security_details || "Security pending",
          status: "Performing",
          nextDueDate: loanPayload.repayment_start_date || "2026-09-15",
          nextDueAmount: 0,
          overdueAmount: 0,
        };

        const localCovenants = buildCovenantsFromTermSheet(
          localLoan.id,
          localLoan.borrowerName,
          termSheetForm
        );

        setLoans((currentLoans) => [localLoan, ...currentLoans]);
        setCovenantRows((currentRows) => [...localCovenants, ...currentRows]);
        setSelectedLoanId(localLoan.id);
        setDataMessage("Term sheet converted into a local loan master.");
        closeTermSheetModal();
        return;
      }

      const db = supabase as any;

      const { data: importRecord, error: importError } = await db
        .from("debt_lms_term_sheet_imports")
        .insert({
          file_name: termSheetForm.fileName || "Manual term sheet review",
          file_type: "Term Sheet",
          extraction_status: "Draft Extracted",
          extraction_confidence: 82,
          extracted_loan_terms: {
            borrowerName: termSheetForm.borrowerName,
            fundName: termSheetForm.fundName,
            instrumentType: termSheetForm.instrumentType,
            sanctionAmount: Number(termSheetForm.sanctionAmount || 0),
            disbursedAmount: Number(termSheetForm.disbursedAmount || 0),
            couponRate: Number(termSheetForm.couponRate || 0),
            tenureMonths: Number(termSheetForm.tenureMonths || 0),
          },
          extracted_repayment_terms: {
            interestFrequency: termSheetForm.interestFrequency,
            principalFrequency: termSheetForm.principalFrequency,
            moratoriumMonths: Number(termSheetForm.moratoriumMonths || 0),
            repaymentStartDate: termSheetForm.repaymentStartDate,
            maturityDate: termSheetForm.maturityDate,
          },
          extracted_fees: {
            processingFee: Number(termSheetForm.processingFee || 0),
            exitFee: Number(termSheetForm.exitFee || 0),
            penalInterestRate: Number(termSheetForm.penalInterestRate || 0),
          },
          extracted_covenants: [
            termSheetForm.covenantOne,
            termSheetForm.covenantTwo,
            termSheetForm.covenantThree,
          ].filter(Boolean),
          extracted_security_terms: {
            securityDetails: termSheetForm.securityDetails,
            chargeDetails: termSheetForm.chargeDetails,
            trusteeDetails: termSheetForm.trusteeDetails,
          },
          unmapped_items: termSheetForm.extractionNotes
            ? [termSheetForm.extractionNotes]
            : [],
          review_status: "Reviewed",
          reviewed_by: "Finance Team",
          reviewed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (importError) {
        throw new Error(importError.message);
      }

      const { data: loanData, error: loanError } = await db
        .from("debt_lms_loans")
        .insert({
          ...loanPayload,
          term_sheet_import_id: importRecord?.id || null,
        })
        .select("*")
        .single();

      if (loanError) {
        throw new Error(loanError.message);
      }

      const savedLoan = mapLoan(loanData as DataRow);
      const extractedCovenants = buildCovenantsFromTermSheet(
        savedLoan.id,
        savedLoan.borrowerName,
        termSheetForm
      );

      const covenantPayload = extractedCovenants.map((covenant) => ({
        loan_id: savedLoan.id,
        borrower_name: savedLoan.borrowerName,
        covenant_name: covenant.covenant,
        covenant_type: covenant.type,
        covenant_description: covenant.covenant,
        frequency: covenant.frequency,
        due_date: covenant.dueDate,
        responsible_party: "Borrower Finance Team",
        evidence_required: covenant.evidence,
        covenant_status: "Pending",
      }));

      let savedCovenants = extractedCovenants;

      if (covenantPayload.length > 0) {
        const { data: covenantData, error: covenantError } = await db
          .from("debt_lms_covenants")
          .insert(covenantPayload)
          .select("*")
          .order("due_date", { ascending: true });

        if (covenantError) {
          throw new Error(covenantError.message);
        }

        if (covenantData && covenantData.length > 0) {
          savedCovenants = (covenantData as DataRow[]).map(mapCovenant);
        }
      }

      if (importRecord?.id) {
        await db
          .from("debt_lms_term_sheet_imports")
          .update({ loan_id: savedLoan.id })
          .eq("id", importRecord.id);
      }

      setLoans((currentLoans) => [savedLoan, ...currentLoans]);
      setCovenantRows((currentRows) => [...savedCovenants, ...currentRows]);
      setSelectedLoanId(savedLoan.id);
      setDataMessage("Term sheet converted into loan master and covenant tracker.");
      closeTermSheetModal();
    } catch (error) {
      setTermSheetMessage(
        error instanceof Error
          ? `Term sheet conversion failed: ${error.message}`
          : "Term sheet conversion failed."
      );
    } finally {
      setIsSavingTermSheet(false);
    }
  }

  const selectedLoan =
    loans.find((loan) => loan.id === selectedLoanId) ?? loans[0] ?? sampleLoans[0];
  const summary = useMemo(() => {
    const totalSanctioned = loans.reduce((sum, loan) => sum + loan.sanctionAmount, 0);
    const totalDisbursed = loans.reduce((sum, loan) => sum + loan.disbursedAmount, 0);
    const totalDueThisMonth = repaymentRows.reduce((sum, row) => sum + row.totalDue, 0);
    const totalReceived = repaymentRows.reduce((sum, row) => sum + row.receivedAmount, 0);
    const totalPending = repaymentRows.reduce((sum, row) => sum + row.pendingAmount, 0);
    const totalOverdue = loans.reduce((sum, loan) => sum + loan.overdueAmount, 0);
    const defaultWatch = loans.filter(
      (loan) => loan.status === "Overdue" || loan.status === "Default Watch"
    ).length;
    const breachedCovenants = covenantRows.filter(
      (row) => row.status === "Breached"
    ).length;

    return {
      totalSanctioned,
      totalDisbursed,
      totalDueThisMonth,
      totalReceived,
      totalPending,
      totalOverdue,
      defaultWatch,
      breachedCovenants,
    };
  }, [loans, repaymentRows, covenantRows]);

  const selectedSchedule = repaymentRows.filter((row) => row.loanId === selectedLoan.id);
  const selectedCovenants = covenantRows.filter((row) => row.loanId === selectedLoan.id);

  const receiptPrincipalReceived = Number(receiptForm.principalReceived || 0);
  const receiptInterestReceived = Number(receiptForm.interestReceived || 0);
  const receiptFeesReceived = Number(receiptForm.feesReceived || 0);
  const receiptPenaltyReceived = Number(receiptForm.penaltyReceived || 0);
  const receiptOtherReceived = Number(receiptForm.otherReceived || 0);

  const receiptTotalReceived =
    receiptPrincipalReceived +
    receiptInterestReceived +
    receiptFeesReceived +
    receiptPenaltyReceived +
    receiptOtherReceived;

  const receiptPendingAmount = receiptRow
    ? Math.max(receiptRow.totalDue - receiptTotalReceived, 0)
    : 0;

  return (
    <main className="debt-page">
      <style>{`
        .debt-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.20), transparent 34rem),
            radial-gradient(circle at top right, rgba(176, 137, 47, 0.16), transparent 30rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 32px;
        }

        .debt-shell {
          max-width: 1240px;
          margin: 0 auto;
        }

        .debt-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
        }

        .debt-eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 900;
          margin: 0 0 14px;
        }

        .debt-header h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 72px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .debt-header p {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 760px;
        }

        .debt-header-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .debt-primary,
        .debt-secondary {
          border-radius: 999px;
          padding: 12px 17px;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          border: 0;
          cursor: pointer;
        }

        .debt-primary {
          background: #f5c85b;
          color: #08111f;
        }

        .debt-secondary {
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
        }

        .debt-ribbon {
          border: 1px solid rgba(245, 200, 91, 0.22);
          background: rgba(245, 200, 91, 0.10);
          color: #fde68a;
          border-radius: 18px;
          padding: 14px 18px;
          margin-bottom: 22px;
          font-weight: 800;
        }

        .debt-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .debt-stat-card,
        .debt-panel,
        .loan-card,
        .schedule-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.76);
          border-radius: 24px;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.20);
        }

        .debt-stat-card {
          padding: 20px;
        }

        .debt-stat-card span {
          color: #9db3d7;
          display: block;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .debt-stat-card strong {
          font-size: 27px;
          display: block;
          letter-spacing: -0.04em;
        }

        .debt-stat-card small {
          color: #c7d7f4;
          display: block;
          margin-top: 8px;
          line-height: 1.45;
        }

                .debt-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .debt-grid > * {
          min-width: 0;
        }

        .debt-panel {
          padding: 22px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.04em;
        }

        .panel-header p {
          margin: 7px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

        .loan-list {
          display: grid;
          gap: 12px;
        }

        .loan-card {
          width: 100%;
          color: #f8fbff;
          text-align: left;
          padding: 16px;
          cursor: pointer;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .loan-card:hover,
        .loan-card.active {
          transform: translateY(-2px);
          border-color: rgba(245, 200, 91, 0.62);
          background: rgba(30, 41, 59, 0.92);
        }

        .loan-card-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .loan-card h3 {
          margin: 0;
          font-size: 18px;
        }

        .loan-card p {
          margin: 5px 0 0;
          color: #9db3d7;
          font-size: 13px;
        }

        .status-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          color: #fff;
        }

        .status-performing,
        .status-received,
        .status-compliant,
        .status-sent,
        .status-matched {
          background: rgba(22, 163, 74, 0.28);
          color: #bbf7d0;
        }

        .status-due-soon,
        .status-pending,
        .status-queued,
        .status-partial,
        .status-partial-match {
          background: rgba(245, 158, 11, 0.24);
          color: #fde68a;
        }

        .status-overdue,
        .status-default-watch,
        .status-breached,
        .status-failed,
        .status-unmatched {
          background: rgba(239, 68, 68, 0.22);
          color: #fecaca;
        }

        .status-draft,
        .status-waived {
          background: rgba(59, 130, 246, 0.24);
          color: #bfdbfe;
        }

        .loan-mini-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .loan-mini-grid div {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.36);
          border-radius: 16px;
          padding: 11px;
        }

        .loan-mini-grid span {
          color: #8ea4c8;
          font-size: 12px;
          display: block;
          margin-bottom: 5px;
        }

        .loan-mini-grid strong {
          font-size: 15px;
        }

        .selected-loan-box {
          display: grid;
          gap: 14px;
        }

        .selected-loan-main {
          border: 1px solid rgba(245, 200, 91, 0.20);
          background: rgba(245, 200, 91, 0.08);
          border-radius: 22px;
          padding: 18px;
        }

        .selected-loan-main h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .selected-loan-main p {
          color: #dbeafe;
          line-height: 1.55;
        }
        .schedule-scroll-panel {
          max-height: 520px;
          overflow-y: auto;
          padding-right: 6px;
          display: grid;
          gap: 10px;
        }

        .schedule-compact-card {
          border: 1px solid rgba(245, 200, 91, 0.20);
          background: rgba(245, 200, 91, 0.07);
          border-radius: 18px;
          padding: 12px;
        }

        .schedule-compact-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
        }

        .schedule-compact-top h3 {
          margin: 0;
          font-size: 17px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

                .schedule-compact-grid {
          display: grid;
          gap: 7px;
        }

        .schedule-compact-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(147, 197, 253, 0.10);
          background: rgba(2, 6, 23, 0.26);
          border-radius: 12px;
          padding: 8px 10px;
        }

        .schedule-compact-row span {
          color: #8ea4c8;
          font-size: 11px;
          font-weight: 900;
        }

        .schedule-compact-row strong {
          color: #ffffff;
          font-size: 13px;
          line-height: 1.2;
          text-align: right;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .detail-grid div {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.28);
          border-radius: 16px;
          padding: 12px;
        }

        .detail-grid span {
          display: block;
          color: #8ea4c8;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .detail-grid strong {
          color: #ffffff;
          font-size: 14px;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px;
        }

        th {
          text-align: left;
          color: #9db3d7;
          font-size: 12px;
          padding: 12px;
          border-bottom: 1px solid rgba(147, 197, 253, 0.15);
          white-space: nowrap;
        }

        td {
          padding: 13px 12px;
          border-bottom: 1px solid rgba(147, 197, 253, 0.10);
          color: #e5eefc;
          font-size: 13px;
          white-space: nowrap;
        }

        td strong {
          color: #ffffff;
        }

        .right {
          text-align: right;
        }

        .notice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .notice-card {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(2, 6, 23, 0.38);
          border-radius: 20px;
          padding: 16px;
        }

        .notice-card h3 {
          margin: 10px 0 8px;
          font-size: 17px;
        }

        .notice-card p {
          margin: 0;
          color: #9db3d7;
          line-height: 1.5;
          font-size: 13px;
        }

        .notice-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .small-action {
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(15, 23, 42, 0.72);
          color: #dbeafe;
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }
        .loan-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(10px);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 28px;
          overflow-y: auto;
        }

        .loan-modal {
          width: min(1040px, 100%);
          border: 1px solid rgba(245, 200, 91, 0.28);
          background: #08111f;
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.46);
        }

        .loan-modal-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .loan-modal-header h2 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .loan-modal-header p {
          margin: 8px 0 0;
          color: #9db3d7;
          line-height: 1.55;
        }

        .loan-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .loan-form-field {
          display: grid;
          gap: 7px;
        }

        .loan-form-field.full {
          grid-column: 1 / -1;
        }

        .loan-form-field label {
          color: #c7d7f4;
          font-size: 12px;
          font-weight: 900;
        }

        .loan-form-field input,
        .loan-form-field select,
        .loan-form-field textarea {
          width: 100%;
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(15, 23, 42, 0.82);
          color: #ffffff;
          border-radius: 14px;
          padding: 11px 12px;
          font: inherit;
          outline: none;
        }

        .loan-form-field textarea {
          min-height: 82px;
          resize: vertical;
        }

        .loan-form-section-title {
          grid-column: 1 / -1;
          margin-top: 8px;
          color: #f5c85b;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .loan-form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .loan-form-message {
          color: #bbf7d0;
          font-size: 13px;
          font-weight: 800;
        }

        .loan-form-error {
          color: #fecaca;
          font-size: 13px;
          font-weight: 800;
        }

        .receipt-modal {
          width: min(720px, 100%);
          border: 1px solid rgba(245, 200, 91, 0.28);
          background: #08111f;
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.46);
        }

        .receipt-summary-box {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 18px;
          padding: 14px;
          margin-bottom: 18px;
        }

        .receipt-summary-box h3 {
          margin: 0 0 8px;
          color: #ffffff;
        }

        .receipt-summary-box p {
          margin: 0;
          color: #c7d7f4;
          line-height: 1.55;
        }

        .term-sheet-confidence-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .term-sheet-confidence-card {
          border: 1px solid rgba(147, 197, 253, 0.14);
          background: rgba(15, 23, 42, 0.70);
          border-radius: 16px;
          padding: 12px;
        }

        .term-sheet-confidence-card span {
          display: block;
          color: #8ea4c8;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .term-sheet-confidence-card strong {
          color: #ffffff;
          font-size: 16px;
        }

        .term-sheet-upload-box {
          border: 1px dashed rgba(245, 200, 91, 0.36);
          background: rgba(245, 200, 91, 0.08);
          border-radius: 20px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .term-sheet-upload-box input {
          width: 100%;
          color: #dbeafe;
        }

        .default-review-strip {
          border: 1px solid rgba(239, 68, 68, 0.24);
          background: rgba(239, 68, 68, 0.10);
          color: #fecaca;
          border-radius: 16px;
          padding: 12px 14px;
          margin-top: 12px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.5;
        }
        @media (max-width: 980px) {
          .debt-header,
          .panel-header {
            flex-direction: column;
          }

          .debt-summary-grid,
          .debt-grid,
          .notice-grid {
            grid-template-columns: 1fr;
          }

          .loan-mini-grid,
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="debt-shell">
        <div className="debt-header">
          <div>
            <p className="debt-eyebrow">VENTIQ Debt LMS</p>
            <h1>Loan, Covenant & Collection Control</h1>
            <p>
              Convert every debt term sheet into a live operating workflow:
              loan master, repayment schedule, covenants, notices, email
              dispatch, bank reconciliation and default alerts.
            </p>
          </div>

          <div className="debt-header-actions">
            <button
  className="debt-primary"
  onClick={() => setIsAddLoanOpen(true)}
  type="button"
>
  Add New Loan
</button>

            <button
              className="debt-secondary"
              onClick={openTermSheetModal}
              type="button"
            >
              Upload Term Sheet
            </button>

            <a className="debt-secondary" href="/document-studio">
              Open Document Studio
            </a>

            <a className="debt-secondary" href="/bank-reconciliation">
              Bank Reconciliation
            </a>
          </div>
        </div>

                <div className="debt-ribbon">
          {loading
            ? "Loading Debt LMS workspace..."
            : dataMessage}{" "}
          · Term sheet intelligence → repayment schedule → notices → email
          dispatch → bank matching → penalty/default tracking
        </div>
                {isTermSheetOpen && (
          <div className="loan-modal-backdrop">
            <form className="loan-modal" onSubmit={createLoanFromExtractedTermSheet}>
              <div className="loan-modal-header">
                <div>
                  <h2>Upload Term Sheet</h2>
                  <p>
                    Upload the term sheet, review extracted commercial terms and
                    convert it into loan master, covenant tracker and repayment
                    workflow.
                  </p>
                </div>

                <button
                  className="debt-secondary"
                  onClick={closeTermSheetModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="term-sheet-upload-box">
                <div className="loan-form-field full">
                  <label>Term Sheet File</label>
                  <input
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                    onChange={handleTermSheetFile}
                    type="file"
                  />
                </div>

                <p className="loan-form-message">
                  {termSheetForm.fileName
                    ? `Loaded: ${termSheetForm.fileName}`
                    : "Select a term sheet file to prepare draft extraction."}
                </p>
              </div>

              <div className="term-sheet-confidence-grid">
                <div className="term-sheet-confidence-card">
                  <span>Status</span>
                  <strong>{termSheetForm.extractionStatus}</strong>
                </div>

                <div className="term-sheet-confidence-card">
                  <span>Loan Terms</span>
                  <strong>{termSheetForm.borrowerName ? "82%" : "--"}</strong>
                </div>

                <div className="term-sheet-confidence-card">
                  <span>Repayment Terms</span>
                  <strong>{termSheetForm.repaymentStartDate ? "78%" : "--"}</strong>
                </div>

                <div className="term-sheet-confidence-card">
                  <span>Covenants</span>
                  <strong>{termSheetForm.covenantOne ? "3 found" : "--"}</strong>
                </div>
              </div>

              <div className="loan-form-grid">
                <div className="loan-form-section-title">Extracted borrower and facility</div>

                <div className="loan-form-field">
                  <label>Borrower Name *</label>
                  <input
                    value={termSheetForm.borrowerName}
                    onChange={(event) =>
                      updateTermSheetForm("borrowerName", event.target.value)
                    }
                    placeholder="Borrower name"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Borrower Finance Email</label>
                  <input
                    value={termSheetForm.borrowerEmail}
                    onChange={(event) =>
                      updateTermSheetForm("borrowerEmail", event.target.value)
                    }
                    placeholder="finance@borrower.com"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Fund Name *</label>
                  <input
                    value={termSheetForm.fundName}
                    onChange={(event) =>
                      updateTermSheetForm("fundName", event.target.value)
                    }
                    placeholder="Fund name"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Instrument</label>
                  <select
                    value={termSheetForm.instrumentType}
                    onChange={(event) =>
                      updateTermSheetForm("instrumentType", event.target.value)
                    }
                  >
                    <option>NCD</option>
                    <option>CCD</option>
                    <option>Venture Debt Loan</option>
                    <option>Secured Loan</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Sanction Amount</label>
                  <input
                    type="number"
                    value={termSheetForm.sanctionAmount}
                    onChange={(event) =>
                      updateTermSheetForm("sanctionAmount", event.target.value)
                    }
                    placeholder="100000000"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Disbursed Amount</label>
                  <input
                    type="number"
                    value={termSheetForm.disbursedAmount}
                    onChange={(event) =>
                      updateTermSheetForm("disbursedAmount", event.target.value)
                    }
                    placeholder="100000000"
                  />
                </div>

                <div className="loan-form-section-title">Extracted repayment terms</div>

                <div className="loan-form-field">
                  <label>Coupon Rate %</label>
                  <input
                    type="number"
                    value={termSheetForm.couponRate}
                    onChange={(event) =>
                      updateTermSheetForm("couponRate", event.target.value)
                    }
                    placeholder="15.5"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Tenure Months</label>
                  <input
                    type="number"
                    value={termSheetForm.tenureMonths}
                    onChange={(event) =>
                      updateTermSheetForm("tenureMonths", event.target.value)
                    }
                    placeholder="36"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Moratorium Months</label>
                  <input
                    type="number"
                    value={termSheetForm.moratoriumMonths}
                    onChange={(event) =>
                      updateTermSheetForm("moratoriumMonths", event.target.value)
                    }
                    placeholder="6"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Interest Frequency</label>
                  <select
                    value={termSheetForm.interestFrequency}
                    onChange={(event) =>
                      updateTermSheetForm("interestFrequency", event.target.value)
                    }
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Semi Annual</option>
                    <option>Annual</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Principal Frequency</label>
                  <select
                    value={termSheetForm.principalFrequency}
                    onChange={(event) =>
                      updateTermSheetForm("principalFrequency", event.target.value)
                    }
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Semi Annual</option>
                    <option>Annual</option>
                    <option>Bullet</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Moratorium Start Basis</label>
                  <select
                    value={termSheetForm.moratoriumStartBasis}
                    onChange={(event) =>
                      updateTermSheetForm("moratoriumStartBasis", event.target.value)
                    }
                  >
                    <option>Disbursement Date</option>
                    <option>First Drawdown Date</option>
                    <option>Sanction Date</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Repayment Start Date</label>
                  <input
                    type="date"
                    value={termSheetForm.repaymentStartDate}
                    onChange={(event) =>
                      updateTermSheetForm("repaymentStartDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Maturity Date</label>
                  <input
                    type="date"
                    value={termSheetForm.maturityDate}
                    onChange={(event) =>
                      updateTermSheetForm("maturityDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Penal Interest %</label>
                  <input
                    type="number"
                    value={termSheetForm.penalInterestRate}
                    onChange={(event) =>
                      updateTermSheetForm("penalInterestRate", event.target.value)
                    }
                    placeholder="24"
                  />
                </div>

                <div className="loan-form-section-title">Fees, security and covenants</div>

                <div className="loan-form-field">
                  <label>Processing Fee</label>
                  <input
                    type="number"
                    value={termSheetForm.processingFee}
                    onChange={(event) =>
                      updateTermSheetForm("processingFee", event.target.value)
                    }
                    placeholder="1000000"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Exit Fee</label>
                  <input
                    type="number"
                    value={termSheetForm.exitFee}
                    onChange={(event) =>
                      updateTermSheetForm("exitFee", event.target.value)
                    }
                    placeholder="1500000"
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Security Details</label>
                  <textarea
                    value={termSheetForm.securityDetails}
                    onChange={(event) =>
                      updateTermSheetForm("securityDetails", event.target.value)
                    }
                    placeholder="Security / charge terms"
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Charge Details</label>
                  <textarea
                    value={termSheetForm.chargeDetails}
                    onChange={(event) =>
                      updateTermSheetForm("chargeDetails", event.target.value)
                    }
                    placeholder="ROC / hypothecation / escrow details"
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Trustee Details</label>
                  <textarea
                    value={termSheetForm.trusteeDetails}
                    onChange={(event) =>
                      updateTermSheetForm("trusteeDetails", event.target.value)
                    }
                    placeholder="Debenture trustee / security trustee details"
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Covenant 1</label>
                  <input
                    value={termSheetForm.covenantOne}
                    onChange={(event) =>
                      updateTermSheetForm("covenantOne", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Covenant 2</label>
                  <input
                    value={termSheetForm.covenantTwo}
                    onChange={(event) =>
                      updateTermSheetForm("covenantTwo", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Covenant 3</label>
                  <input
                    value={termSheetForm.covenantThree}
                    onChange={(event) =>
                      updateTermSheetForm("covenantThree", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Extraction Notes / Unmapped Items</label>
                  <textarea
                    value={termSheetForm.extractionNotes}
                    onChange={(event) =>
                      updateTermSheetForm("extractionNotes", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="loan-form-actions">
                <div>
                  {termSheetMessage && (
                    <div className="loan-form-message">{termSheetMessage}</div>
                  )}
                </div>

                <div className="debt-header-actions">
                  <button
                    className="debt-secondary"
                    onClick={closeTermSheetModal}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="debt-primary"
                    disabled={isExtractingTermSheet || isSavingTermSheet}
                    type="submit"
                  >
                    {isSavingTermSheet
                      ? "Creating..."
                      : isExtractingTermSheet
                        ? "Extracting..."
                        : "Create Loan From Term Sheet"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

                {receiptRow && (
          <div className="loan-modal-backdrop">
            <form className="receipt-modal" onSubmit={submitReceiptUpdate}>
              <div className="loan-modal-header">
                <div>
                  <h2>Update Receipt</h2>
                  <p>
                    Manually update component-wise collections where bank
                    reconciliation is not enabled or the receipt needs finance
                    confirmation.
                  </p>
                </div>

                <button
                  className="debt-secondary"
                  onClick={closeReceiptUpdate}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="receipt-summary-box">
                <h3>{receiptRow.borrowerName}</h3>
                <p>
                  Due date {formatDate(receiptRow.dueDate)} · Total due{" "}
                  {formatCurrency(receiptRow.totalDue)} · Current pending{" "}
                  {formatCurrency(receiptRow.pendingAmount)}
                </p>
              </div>

              <div className="loan-form-grid">
                <div className="loan-form-field">
                  <label>Principal Received</label>
                  <input
                    type="number"
                    value={receiptForm.principalReceived}
                    onChange={(event) =>
                      updateReceiptForm("principalReceived", event.target.value)
                    }
                    placeholder="Principal received"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Interest Received</label>
                  <input
                    type="number"
                    value={receiptForm.interestReceived}
                    onChange={(event) =>
                      updateReceiptForm("interestReceived", event.target.value)
                    }
                    placeholder="Interest received"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Fees Received</label>
                  <input
                    type="number"
                    value={receiptForm.feesReceived}
                    onChange={(event) =>
                      updateReceiptForm("feesReceived", event.target.value)
                    }
                    placeholder="Fees received"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Penal Interest / Penalty Received</label>
                  <input
                    type="number"
                    value={receiptForm.penaltyReceived}
                    onChange={(event) =>
                      updateReceiptForm("penaltyReceived", event.target.value)
                    }
                    placeholder="Penalty received"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Other Amount Received</label>
                  <input
                    type="number"
                    value={receiptForm.otherReceived}
                    onChange={(event) =>
                      updateReceiptForm("otherReceived", event.target.value)
                    }
                    placeholder="Other amount"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Receipt Date</label>
                  <input
                    type="date"
                    value={receiptForm.receiptDate}
                    onChange={(event) =>
                      updateReceiptForm("receiptDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Bank Reference / UTR</label>
                  <input
                    value={receiptForm.bankReference}
                    onChange={(event) =>
                      updateReceiptForm("bankReference", event.target.value)
                    }
                    placeholder="NEFT / RTGS / UTR reference"
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Remarks</label>
                  <textarea
                    value={receiptForm.remarks}
                    onChange={(event) =>
                      updateReceiptForm("remarks", event.target.value)
                    }
                    placeholder="Optional finance remarks"
                  />
                </div>
              </div>

              <div className="receipt-summary-box">
                <h3>Auto Calculation</h3>
                <p>
                  Total received {formatCurrency(receiptTotalReceived)} ·
                  Pending amount {formatCurrency(receiptPendingAmount)}
                </p>
              </div>

              <div className="loan-form-actions">
                <div>
                  {receiptMessage && (
                    <div className="loan-form-message">{receiptMessage}</div>
                  )}
                </div>

                <div className="debt-header-actions">
                  <button
                    className="debt-secondary"
                    onClick={closeReceiptUpdate}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="debt-primary"
                    disabled={isSavingReceipt}
                    type="submit"
                  >
                    {isSavingReceipt ? "Saving..." : "Update Receipt"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

                {isAddLoanOpen && (
          <div className="loan-modal-backdrop">
            <form className="loan-modal" onSubmit={submitNewLoan}>
              <div className="loan-modal-header">
                <div>
                  <h2>Add New Debt Loan</h2>
                  <p>
                    Capture borrower, facility, repayment, moratorium, fee,
                    penalty, security and contact details. Repayment schedule
                    generation comes in the next phase.
                  </p>
                </div>

                <button
                  className="debt-secondary"
                  onClick={closeAddLoanModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="loan-form-grid">
                <div className="loan-form-section-title">Borrower details</div>

                <div className="loan-form-field">
                  <label>Borrower Name *</label>
                  <input
                    required
                    value={loanForm.borrowerName}
                    onChange={(event) =>
                      updateLoanForm("borrowerName", event.target.value)
                    }
                    placeholder="Alpha Fintech Pvt Ltd"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Borrower Email</label>
                  <input
                    type="email"
                    value={loanForm.borrowerEmail}
                    onChange={(event) =>
                      updateLoanForm("borrowerEmail", event.target.value)
                    }
                    placeholder="finance@borrower.com"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Fund Name *</label>
                  <input
                    required
                    value={loanForm.fundName}
                    onChange={(event) =>
                      updateLoanForm("fundName", event.target.value)
                    }
                    placeholder="Venture Debt Fund I"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Finance Contact Name</label>
                  <input
                    value={loanForm.financeContactName}
                    onChange={(event) =>
                      updateLoanForm("financeContactName", event.target.value)
                    }
                    placeholder="CFO / Finance Manager"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Finance Contact Email</label>
                  <input
                    type="email"
                    value={loanForm.financeContactEmail}
                    onChange={(event) =>
                      updateLoanForm("financeContactEmail", event.target.value)
                    }
                    placeholder="cfo@borrower.com"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Escalation Contact Email</label>
                  <input
                    type="email"
                    value={loanForm.escalationContactEmail}
                    onChange={(event) =>
                      updateLoanForm("escalationContactEmail", event.target.value)
                    }
                    placeholder="founder@borrower.com"
                  />
                </div>

                <div className="loan-form-section-title">Facility terms</div>

                <div className="loan-form-field">
                  <label>Instrument Type</label>
                  <select
                    value={loanForm.instrumentType}
                    onChange={(event) =>
                      updateLoanForm("instrumentType", event.target.value)
                    }
                  >
                    <option>NCD</option>
                    <option>CCD</option>
                    <option>Venture Debt Loan</option>
                    <option>Secured Loan</option>
                    <option>Debenture</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Facility Reference</label>
                  <input
                    value={loanForm.facilityReference}
                    onChange={(event) =>
                      updateLoanForm("facilityReference", event.target.value)
                    }
                    placeholder="TS/VD/2026/001"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Sanction Amount</label>
                  <input
                    type="number"
                    value={loanForm.sanctionAmount}
                    onChange={(event) =>
                      updateLoanForm("sanctionAmount", event.target.value)
                    }
                    placeholder="100000000"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Disbursed Amount</label>
                  <input
                    type="number"
                    value={loanForm.disbursedAmount}
                    onChange={(event) =>
                      updateLoanForm("disbursedAmount", event.target.value)
                    }
                    placeholder="100000000"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Coupon Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.couponRate}
                    onChange={(event) =>
                      updateLoanForm("couponRate", event.target.value)
                    }
                    placeholder="15.5"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Tenure Months</label>
                  <input
                    type="number"
                    value={loanForm.tenureMonths}
                    onChange={(event) =>
                      updateLoanForm("tenureMonths", event.target.value)
                    }
                    placeholder="36"
                  />
                </div>

                <div className="loan-form-section-title">Dates and moratorium</div>

                <div className="loan-form-field">
                  <label>Sanction Date</label>
                  <input
                    type="date"
                    value={loanForm.sanctionDate}
                    onChange={(event) =>
                      updateLoanForm("sanctionDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Disbursement Date</label>
                  <input
                    type="date"
                    value={loanForm.disbursementDate}
                    onChange={(event) =>
                      updateLoanForm("disbursementDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>First Drawdown Date</label>
                  <input
                    type="date"
                    value={loanForm.firstDrawdownDate}
                    onChange={(event) =>
                      updateLoanForm("firstDrawdownDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Moratorium Months</label>
                  <input
                    type="number"
                    value={loanForm.moratoriumMonths}
                    onChange={(event) =>
                      updateLoanForm("moratoriumMonths", event.target.value)
                    }
                    placeholder="6"
                  />
                </div>

                <div className="loan-form-field">
                  <label>Moratorium Starts From</label>
                  <select
                    value={loanForm.moratoriumStartBasis}
                    onChange={(event) =>
                      updateLoanForm("moratoriumStartBasis", event.target.value)
                    }
                  >
                    <option>Sanction Date</option>
                    <option>Disbursement Date</option>
                    <option>First Drawdown Date</option>
                    <option>Custom Date</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Repayment Start Date</label>
                  <input
                    type="date"
                    value={loanForm.repaymentStartDate}
                    onChange={(event) =>
                      updateLoanForm("repaymentStartDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Maturity Date</label>
                  <input
                    type="date"
                    value={loanForm.maturityDate}
                    onChange={(event) =>
                      updateLoanForm("maturityDate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Interest Frequency</label>
                  <select
                    value={loanForm.interestFrequency}
                    onChange={(event) =>
                      updateLoanForm("interestFrequency", event.target.value)
                    }
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Semi Annual</option>
                    <option>Annual</option>
                    <option>Bullet</option>
                  </select>
                </div>

                <div className="loan-form-field">
                  <label>Principal Frequency</label>
                  <select
                    value={loanForm.principalFrequency}
                    onChange={(event) =>
                      updateLoanForm("principalFrequency", event.target.value)
                    }
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Semi Annual</option>
                    <option>Annual</option>
                    <option>Bullet</option>
                    <option>Custom</option>
                  </select>
                </div>

                <div className="loan-form-section-title">Fees, penalty and security</div>

                <div className="loan-form-field">
                  <label>Processing Fee</label>
                  <input
                    type="number"
                    value={loanForm.processingFee}
                    onChange={(event) =>
                      updateLoanForm("processingFee", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Commitment Fee</label>
                  <input
                    type="number"
                    value={loanForm.commitmentFee}
                    onChange={(event) =>
                      updateLoanForm("commitmentFee", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Exit Fee</label>
                  <input
                    type="number"
                    value={loanForm.exitFee}
                    onChange={(event) =>
                      updateLoanForm("exitFee", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Prepayment Fee</label>
                  <input
                    type="number"
                    value={loanForm.prepaymentFee}
                    onChange={(event) =>
                      updateLoanForm("prepaymentFee", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field">
                  <label>Penal Interest Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.penalInterestRate}
                    onChange={(event) =>
                      updateLoanForm("penalInterestRate", event.target.value)
                    }
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Security Details</label>
                  <textarea
                    value={loanForm.securityDetails}
                    onChange={(event) =>
                      updateLoanForm("securityDetails", event.target.value)
                    }
                    placeholder="First ranking charge on receivables, escrow control, pledge, hypothecation etc."
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Charge Details</label>
                  <textarea
                    value={loanForm.chargeDetails}
                    onChange={(event) =>
                      updateLoanForm("chargeDetails", event.target.value)
                    }
                    placeholder="ROC charge, charge holder, security cover, trustee documents etc."
                  />
                </div>

                <div className="loan-form-field full">
                  <label>Bank Account Details</label>
                  <textarea
                    value={loanForm.bankAccountDetails}
                    onChange={(event) =>
                      updateLoanForm("bankAccountDetails", event.target.value)
                    }
                    placeholder="Account name, bank, IFSC, collection account, escrow account etc."
                  />
                </div>
              </div>

              <div className="loan-form-actions">
                <div>
                  {loanFormMessage && (
                    <div className="loan-form-message">{loanFormMessage}</div>
                  )}
                  {loanFormError && (
                    <div className="loan-form-error">{loanFormError}</div>
                  )}
                </div>

                <div className="debt-header-actions">
                  <button
                    className="debt-secondary"
                    onClick={closeAddLoanModal}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="debt-primary"
                    disabled={isSavingLoan}
                    type="submit"
                  >
                    {isSavingLoan ? "Saving..." : "Save Loan"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="debt-summary-grid">
          <div className="debt-stat-card">
            <span>Total sanctioned</span>
            <strong>{formatCurrency(summary.totalSanctioned)}</strong>
            <small>Across {loans.length} debt investments</small>
          </div>

          <div className="debt-stat-card">
            <span>Disbursed exposure</span>
            <strong>{formatCurrency(summary.totalDisbursed)}</strong>
            <small>Live portfolio principal exposure</small>
          </div>

          <div className="debt-stat-card">
            <span>Due this month</span>
            <strong>{formatCurrency(summary.totalDueThisMonth)}</strong>
            <small>
              Received {formatCurrency(summary.totalReceived)} · Pending{" "}
              {formatCurrency(summary.totalPending)}
            </small>
          </div>

          <div className="debt-stat-card">
            <span>Default watch</span>
            <strong>{summary.defaultWatch}</strong>
            <small>
              Overdue {formatCurrency(summary.totalOverdue)} ·{" "}
              {summary.breachedCovenants} covenant breach
            </small>
          </div>
        </div>

        <div className="debt-grid">
          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Debt Loan Master</h2>
                <p>
                  Click a borrower to review commercial terms, moratorium,
                  fees, penalty rate, security and linked schedules.
                </p>
              </div>
            </div>

            <div className="loan-list">
              {loans.map((loan) => (
                <button
                  className={
                    selectedLoan.id === loan.id ? "loan-card active" : "loan-card"
                  }
                  key={loan.id}
                  onClick={() => setSelectedLoanId(loan.id)}
                  type="button"
                >
                  <div className="loan-card-top">
                    <div>
                      <h3>{loan.borrowerName}</h3>
                      <p>
                        {loan.instrument} · {loan.fundName}
                      </p>
                    </div>

                    <span className={`status-pill status-${statusClass(loan.status)}`}>
                      {loan.status}
                    </span>
                  </div>

                  <div className="loan-mini-grid">
                    <div>
                      <span>Sanction</span>
                      <strong>{formatCurrency(loan.sanctionAmount)}</strong>
                    </div>

                    <div>
                      <span>Coupon</span>
                      <strong>{loan.couponRate}%</strong>
                    </div>

                    <div>
                      <span>Next due</span>
                      <strong>{formatCurrency(loan.nextDueAmount)}</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Selected Loan</h2>
                <p>
                  Term sheet extracted fields become the single source for
                  repayment and covenant monitoring.
                </p>
              </div>
            </div>

            <div className="selected-loan-box">
                           <div className="selected-loan-main">
                <h3>{selectedLoan.borrowerName}</h3>
                <p>
                  {selectedLoan.instrument} facility of{" "}
                  {formatCurrency(selectedLoan.sanctionAmount)} with{" "}
                  {selectedLoan.moratoriumMonths} month moratorium from{" "}
                  {selectedLoan.moratoriumStart.toLowerCase()}.
                </p>

                <div className="notice-actions">
                  <button
                    className="small-action"
                    disabled={isGeneratingSchedule}
                    onClick={generateRepaymentScheduleForSelectedLoan}
                    type="button"
                  >
                    {isGeneratingSchedule
                      ? "Generating..."
                      : "Generate Repayment Schedule"}
                  </button>
                </div>

                {scheduleMessage && (
                  <p className="loan-form-message">{scheduleMessage}</p>
                )}
              </div>

              <div className="detail-grid">
                <div>
                  <span>Disbursement Date</span>
                  <strong>{formatDate(selectedLoan.disbursementDate)}</strong>
                </div>

                <div>
                  <span>Maturity Date</span>
                  <strong>{formatDate(selectedLoan.maturityDate)}</strong>
                </div>

                <div>
                  <span>Interest Frequency</span>
                  <strong>{selectedLoan.interestFrequency}</strong>
                </div>

                <div>
                  <span>Principal Frequency</span>
                  <strong>{selectedLoan.principalFrequency}</strong>
                </div>

                <div>
                  <span>Processing Fee</span>
                  <strong>{formatCurrency(selectedLoan.processingFee)}</strong>
                </div>

                <div>
                  <span>Exit Fee</span>
                  <strong>{formatCurrency(selectedLoan.exitFee)}</strong>
                </div>

                <div>
                  <span>Penal Interest</span>
                  <strong>{selectedLoan.penalRate}% p.a.</strong>
                </div>

                <div>
                  <span>Security</span>
                  <strong>{selectedLoan.security}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="debt-panel">
          <div className="panel-header">
            <div>
              <h2>Monthly Receivable Summary</h2>
              <p>
                Finance Head view of principal, interest, fees, penalties,
                received amount, pending amount and defaulting companies.
              </p>
            </div>

            <div className="debt-header-actions">
              <button
  className="debt-secondary"
  disabled={isGeneratingNotices}
  onClick={generateRepaymentNotices}
  type="button"
>
  {isGeneratingNotices ? "Generating..." : "Generate Reminder Notices"}
</button>
<button
  className="debt-secondary"
  disabled={isQueuingEmails}
  onClick={queueEmailsFromGeneratedNotices}
  type="button"
>
  {isQueuingEmails ? "Queuing..." : "Send Email Queue"}
</button>
<button
  className="debt-secondary"
  disabled={isRunningDefaultReview}
  onClick={runPenaltyAndDefaultReview}
  type="button"
>
  {isRunningDefaultReview ? "Reviewing..." : "Apply Penalty / Default Review"}
</button>
            </div>
                        {noticeMessage && (
              <p className="loan-form-message">{noticeMessage}</p>
            )}
                        {emailQueueMessage && (
              <p className="loan-form-message">{emailQueueMessage}</p>
            )}

            {defaultReviewMessage && (
              <p className="default-review-strip">{defaultReviewMessage}</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Due Date</th>
                  <th className="right">Principal</th>
                  <th className="right">Interest</th>
                  <th className="right">Fees</th>
                  <th className="right">Penalty</th>
                  <th className="right">Total Due</th>
                  <th className="right">Received</th>
                  <th className="right">Pending</th>
                  <th className="right">DPD</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {repaymentRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.borrowerName}</strong>
                    </td>
                    <td>{formatDate(row.dueDate)}</td>
                    <td className="right">{formatCurrency(row.principalDue)}</td>
                    <td className="right">{formatCurrency(row.interestDue)}</td>
                    <td className="right">{formatCurrency(row.feesDue)}</td>
                    <td className="right">{formatCurrency(row.penaltyDue)}</td>
                    <td className="right">{formatCurrency(row.totalDue)}</td>
                    <td className="right">{formatCurrency(row.receivedAmount)}</td>
                    <td className="right">{formatCurrency(row.pendingAmount)}</td>
                    <td className="right">{row.daysPastDue}</td>
                    <td>
                      <span className={`status-pill status-${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="small-action"
                        onClick={() => openReceiptUpdate(row)}
                        type="button"
                      >
                        Update Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="debt-grid">
          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Daily Collection Control</h2>
                <p>
                  Connects expected repayment schedule with bank reconciliation
                  to show what remains pending at day end.
                </p>
              </div>

              <div className="debt-header-actions">
                <button
                  className="debt-primary"
                  disabled={isSyncingBankRecon}
                  onClick={syncReceiptsFromBankReconciliation}
                  type="button"
                >
                  {isSyncingBankRecon ? "Syncing..." : "Sync from Bank Reconciliation"}
                </button>

                <a className="debt-secondary" href="/bank-reconciliation">
                  Open Bank Recon
                </a>
              </div>
            </div>

            {bankReconSyncMessage && (
              <p className="loan-form-message">{bankReconSyncMessage}</p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th className="right">Expected</th>
                    <th className="right">Received</th>
                    <th>Bank Narration</th>
                    <th>Match</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {bankMatches.map((match) => (
                    <tr key={match.id}>
                      <td>
                        <strong>{match.borrowerName}</strong>
                      </td>
                      <td className="right">{formatCurrency(match.expectedAmount)}</td>
                      <td className="right">{formatCurrency(match.receivedAmount)}</td>
                      <td>{match.bankNarration}</td>
                      <td>
                        <span
                          className={`status-pill status-${statusClass(
                            match.matchStatus
                          )}`}
                        >
                          {match.matchStatus}
                        </span>
                      </td>
                      <td>{match.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Selected Repayment Schedule</h2>
                <p>{selectedLoan.borrowerName}</p>
              </div>
            </div>

                       {selectedSchedule.length > 0 ? (
              <div className="schedule-scroll-panel">
                {selectedSchedule.map((row) => (
                  <div className="schedule-compact-card" key={row.id}>
                    <div className="schedule-compact-top">
                      <h3>{formatDate(row.dueDate)}</h3>

                      <span
                        className={`status-pill status-${statusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </div>

                                       <div className="schedule-compact-grid">
                      <div className="schedule-compact-row">
                        <span>Total Due</span>
                        <strong>{formatCurrency(row.totalDue)}</strong>
                      </div>

                      <div className="schedule-compact-row">
                        <span>Received</span>
                        <strong>{formatCurrency(row.receivedAmount)}</strong>
                      </div>

                      <div className="schedule-compact-row">
                        <span>Pending</span>
                        <strong>{formatCurrency(row.pendingAmount)}</strong>
                      </div>

                      <div className="schedule-compact-row">
                        <span>Penalty</span>
                        <strong>{formatCurrency(row.penaltyDue)}</strong>
                      </div>

                      <div className="schedule-compact-row">
                        <span>Days Past Due</span>
                        <strong>{row.daysPastDue}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="selected-loan-main">
                <h3>No active repayment row</h3>
                <p>Schedule will be generated from the confirmed term sheet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="debt-grid">
          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Covenant Tracker</h2>
                <p>
                  Reporting, financial, negative and security covenants extracted
                  from the term sheet.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Covenant</th>
                    <th>Type</th>
                    <th>Frequency</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Evidence</th>
                  </tr>
                </thead>

                <tbody>
                  {covenantRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.borrowerName}</strong>
                      </td>
                      <td>{row.covenant}</td>
                      <td>{row.type}</td>
                      <td>{row.frequency}</td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>
                        <span className={`status-pill status-${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="debt-panel">
            <div className="panel-header">
              <div>
                <h2>Selected Loan Covenants</h2>
                <p>{selectedLoan.borrowerName}</p>
              </div>
            </div>

            {selectedCovenants.length > 0 ? (
              selectedCovenants.map((row) => (
                <div className="selected-loan-main" key={row.id}>
                  <h3>{row.covenant}</h3>
                  <p>
                    {row.type} covenant · {row.frequency} · due{" "}
                    {formatDate(row.dueDate)}
                  </p>
                  <span className={`status-pill status-${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="selected-loan-main">
                <h3>No covenant due</h3>
                <p>All covenant records will appear after term sheet extraction.</p>
              </div>
            )}
          </div>
        </div>

        <div className="debt-panel">
          <div className="panel-header">
            <div>
              <h2>Notice & Email Queue</h2>
              <p>
                Repayment reminders, penalty notices and default notices linked
                to Document Studio and email dispatch.
              </p>
            </div>

            <div className="debt-header-actions">
              <a className="debt-secondary" href="/document-studio">
                Build Notice Template
              </a>

              <button
  className="debt-primary"
  disabled={isQueuingEmails}
  onClick={queueEmailsFromGeneratedNotices}
  type="button"
>
  {isQueuingEmails ? "Queuing..." : "Queue Emails"}
</button>
            </div>
          </div>

          <div className="notice-grid">
            {noticeRows.map((notice) => (
              <div className="notice-card" key={notice.id}>
                <span className={`status-pill status-${statusClass(notice.status)}`}>
                  {notice.status}
                </span>

                <h3>{notice.noticeType}</h3>

                <p>
                  {notice.borrowerName} · due {formatDate(notice.dueDate)} ·{" "}
                  {formatCurrency(notice.amount)}
                </p>

                <p>Email: {notice.emailTo}</p>
                <p>Attachment: {notice.linkedDocument}</p>

                <div className="notice-actions">
                  <a className="small-action" href="/document-studio">
                    Preview PDF
                  </a>

                  <button className="small-action" type="button">
                    Queue Email
                  </button>

                  <button
                    className="small-action"
                    disabled={isRunningDefaultReview}
                    onClick={runPenaltyAndDefaultReview}
                    type="button"
                  >
                    Review Penalty
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}