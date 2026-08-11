"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

type Investor = {
  id: string;
  name: string;
  investor_code: string | null;
  investor_type: string | null;
  email: string | null;
  country: string | null;
  kyc_status: string | null;
  bank_status: string | null;
  source: "migration" | "legacy";
};

type Commitment = {
  id: string;
  investor_id: string;
  fund_name: string;
  class_name: string | null;
  commitment_amount: number | null;
  called_amount: number | null;
  unfunded_amount: number | null;
  status: string | null;
};

type InvestorDocument = {
  id: string;
  investor_id?: string | null;
  investor_master_id?: string | null;
  investor_code?: string | null;
  document_type: string | null;
  document_name: string | null;
  document_category?: string | null;
  investor_name: string | null;
  investor_email?: string | null;
  email?: string | null;
  fund_name: string | null;
  amount: number | null;
  status: string | null;
  email_status?: string | null;
  portal_status?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  storage_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  publish_source?: string | null;
  source?: string | null;
  migration_status?: string | null;
  confidence_score?: number | null;
  period_label?: string | null;
  organisation_id?: string | null;
  document_studio_batch_id?: string | null;
  document_studio_generated_document_id?: string | null;
  fund_memory_snapshot_id?: string | null;
  fund_memory_reporting_date?: string | null;
  fund_memory_reporting_period?: string | null;
  fund_memory_snapshot_version?: number | null;
  fund_memory_source_kind?: string | null;
  canonical_lineage?: Record<string, unknown> | null;
  uploaded_at?: string | null;
  published_at?: string | null;
  generated_at?: string | null;
  created_at?: string | null;
  download_ready?: boolean;
  canonical?: boolean;
};

type InvestorDocumentsApiResponse = {
  available?: boolean;
  fund_name?: string;
  investor_code?: string;
  investor_name?: string;
  permissions?: {
    can_view_documents?: boolean;
    can_download_documents?: boolean;
  };
  summary?: {
    total_documents?: number;
    download_ready?: number;
    canonical_documents?: number;
  };
  documents?: InvestorDocument[];
  reason?: string;
  message?: string;
  error?: string;
};

type InvestorFinancialPosition = {
  id: string;
  investor_id: string | null;
  investor_code: string | null;
  investor_name: string | null;
  email: string | null;
  fund_name: string | null;
  class_name: string | null;
  commitment_amount: number | null;
  capital_called_till_date: number | null;
  uncalled_capital: number | null;
  distributions_till_date: number | null;
  setup_fee: number | null;
  management_fee: number | null;
  net_contributed: number | null;
  current_nav: number | null;
  investor_irr: number | null;
  investor_moic: number | null;
  investor_dpi: number | null;
  investor_rvpi: number | null;
  investor_tvpi: number | null;
  status: string | null;
  created_at: string | null;
};

type InvestorCashflow = {
  id: string;
  investor_id: string | null;
  investor_code: string | null;
  investor_name: string | null;
  fund_name: string | null;
  cashflow_date: string | null;
  cashflow_type: string | null;
  amount: number | null;
  direction: string | null;
  description: string | null;
};

type InvestorCapitalCall = {
  capital_call_code: string;
  call_name?: string | null;
  call_date?: string | null;
  due_date?: string | null;
  purpose?: string | null;
  allocation_code?: string | null;
  commitment_amount?: number | null;
  call_percentage?: number | null;
  called_amount?: number | null;
  total_due?: number | null;
  amount_received?: number | null;
  net_contribution?: number | null;
  outstanding_amount?: number | null;
  allocation_status?: string | null;
  receipt_status?: string | null;
  receipt_date?: string | null;
  bank_reference?: string | null;
  payment_method?: string | null;
  days_late?: number | null;
  currency?: string | null;
};

type InvestorDistribution = {
  distribution_code: string;
  distribution_name?: string | null;
  distribution_type?: string | null;
  declaration_date?: string | null;
  record_date?: string | null;
  payment_date?: string | null;
  gross_distribution?: number | null;
  return_of_capital?: number | null;
  income_distribution?: number | null;
  interest_distribution?: number | null;
  dividend_distribution?: number | null;
  capital_gain_distribution?: number | null;
  fee_rebate?: number | null;
  tax_withheld?: number | null;
  other_deductions?: number | null;
  net_distribution?: number | null;
  payment_status?: string | null;
  bank_reference?: string | null;
  currency?: string | null;
};

type InvestorCashflowSummary = {
  capital_call_count?: number | null;
  receipt_count?: number | null;
  distribution_count?: number | null;
  total_called?: number | null;
  total_due?: number | null;
  total_received?: number | null;
  total_outstanding?: number | null;
  total_distributed?: number | null;
};

type InvestorCashflowsApiResponse = {
  available?: boolean;
  fund_name?: string;
  investor_code?: string;
  investor_name?: string;
  summary?: InvestorCashflowSummary;
  capital_calls?: InvestorCapitalCall[];
  distributions?: InvestorDistribution[];
  reason?: string;
  message?: string;
  error?: string;
};

type DataRoomEvent = {
  id: string;
  fund_name?: string | null;
  investor_name?: string | null;
  investor_email?: string | null;
  document_name?: string | null;
  action?: string | null;
  event_time?: string | null;
  created_at?: string | null;
};

type DataRoomQuestion = {
  id: string;
  fund_name?: string | null;
  investor_name?: string | null;
  investor_email?: string | null;
  document_name?: string | null;
  category?: string | null;
  question?: string | null;
  status?: string | null;
  asked_at?: string | null;
  answered_at?: string | null;
  created_at?: string | null;
};

type DataRoomDocument = {
  id: string;
  fund_name?: string | null;
  file_name?: string | null;
  detected_type?: string | null;
  suggested_folder?: string | null;
  imported_at?: string | null;
  created_at?: string | null;
};

type DataRow = Record<string, unknown>;

type PerformanceCalculationResponse = {
  run?: DataRow | null;
  fundMetric?: DataRow | null;
  portfolioMetrics?: DataRow[];
  investorMetrics?: DataRow[];
  reconciliations?: DataRow[];
  portfolioValuations?: DataRow[];
  error?: string;
};

type FinancialVerification = {
  calculation_version?: string | null;
  as_of_date?: string | null;
  calculation_status?: string | null;
  reconciliation_status?: string | null;
  controls_passed?: number | null;
  controls_total?: number | null;
};

type FinancialPositionApiResponse = {
  available?: boolean;
  fund_name?: string;
  investor_code?: string;
  investor_name?: string;
  class_name?: string | null;
  currency?: string;
  verification?: FinancialVerification;
  financial_position?: {
    commitment_amount?: number | null;
    paid_in_capital?: number | null;
    total_distributions?: number | null;
    gross_distributions?: number | null;
    withholding_tax?: number | null;
    net_distributions?: number | null;
    performance_distribution_basis?: string | null;
    uncalled_commitment?: number | null;
    allocated_nav?: number | null;
    nav_allocation_percentage?: number | null;
    nav_allocation_method?: string | null;
    dpi?: number | null;
    rvpi?: number | null;
    tvpi?: number | null;
    net_irr?: number | null;
    cashflow_count?: number | null;
    calculation_status?: string | null;
  };
  reason?: string;
  message?: string;
  error?: string;
};

type PortalActivityEvent = {
  id: string;
  time: string;
  module: string;
  title: string;
  description: string;
  status: string;
};

function getString(row: DataRow | undefined, keys: string[], fallback = "-") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumber(row: DataRow | undefined, keys: string[]) {
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

function toCr(value: number | null | undefined) {
  return Number(value || 0) / 10000000;
}
function getPositionNumber(
  position: InvestorFinancialPosition | null,
  keys: string[]
) {
  if (!position) return 0;

  return getNumber(position as unknown as DataRow, keys);
}

function formatCr(value: number) {
  return `₹${value.toFixed(2)} Cr`;
}

function formatInr(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value: number | null | undefined) {
  const numeric = Number(value || 0);
  const percentage = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${percentage.toFixed(2)}%`;
}

function formatMultiple(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)}x`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDocumentIcon(type: string | null | undefined) {
  const normalizedType = (type || "").toLowerCase();

  if (normalizedType.includes("capital")) return "💰";
  if (normalizedType.includes("distribution")) return "📤";
  if (normalizedType.includes("irr")) return "📊";
  if (normalizedType.includes("tax")) return "🧾";
  if (normalizedType.includes("soa") || normalizedType.includes("statement")) {
    return "📄";
  }

  return "📑";
}

function getStatusIcon(value: string | null | undefined) {
  const status = (value || "").toLowerCase();

  if (status.includes("available") || status.includes("ready")) return "🟢";
  if (status.includes("published") || status.includes("active")) return "🟢";
  if (status.includes("review") || status.includes("pending")) return "🟡";
  if (status.includes("missing") || status.includes("not")) return "🔴";

  return "⚪";
}

function getActivityIcon(value: string | null | undefined) {
  const status = (value || "").toLowerCase();

  if (status.includes("download")) return "⬇️";
  if (status.includes("view")) return "👁️";
  if (status.includes("question")) return "❓";
  if (status.includes("cashflow")) return "💸";
  if (status.includes("capital")) return "💰";
  if (status.includes("distribution")) return "📤";
  if (status.includes("document")) return "📄";
  if (status.includes("ready")) return "🟢";
  if (status.includes("review")) return "🟡";
  if (status.includes("missing")) return "🔴";

  return "⚪";
}

function getDocumentTitle(documentRecord: InvestorDocument) {
  return (
    documentRecord.document_name ||
    documentRecord.file_name ||
    "Investor document"
  );
}

function getDocumentType(documentRecord: InvestorDocument) {
  return (
    documentRecord.document_type ||
    documentRecord.document_category ||
    "Investor Document"
  );
}

function getDocumentDate(documentRecord: InvestorDocument) {
  return (
    documentRecord.published_at ||
    documentRecord.generated_at ||
    documentRecord.uploaded_at ||
    documentRecord.created_at ||
    null
  );
}

function hasStoredPdf(documentRecord: InvestorDocument) {
  return Boolean(
    documentRecord.download_ready ||
      documentRecord.storage_url ||
      documentRecord.file_url ||
      documentRecord.storage_path
  );
}

function getCommitmentFundName(commitment: Commitment) {
  return commitment.fund_name || "Unknown Fund";
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function investorMatchesText(
  investor: Investor | undefined,
  name?: string | null,
  email?: string | null,
  investorCode?: string | null
) {
  if (!investor) return false;

  const investorName = normalizeText(investor.name);
  const investorEmail = normalizeText(investor.email);
  const investorCodeValue = normalizeText(investor.investor_code);
  const incomingName = normalizeText(name);
  const incomingEmail = normalizeText(email);
  const incomingInvestorCode = normalizeText(investorCode);

  return Boolean(
    (incomingInvestorCode &&
      investorCodeValue &&
      incomingInvestorCode === investorCodeValue) ||
      (incomingEmail && investorEmail && incomingEmail === investorEmail) ||
      (incomingName && investorName && incomingName === investorName)
  );
}
function getFundName(row: DataRow) {
  return getString(
    row,
    ["fund_name", "scheme_name", "fund", "fund_title"],
    ""
  ).trim();
}

function filterRowsForFund<T extends DataRow>(
  rows: T[],
  fundName: string,
  includeGlobalRows = false
) {
  const normalizedFundName = fundName.trim().toLowerCase();

  return rows.filter((row) => {
    const rowFundName = getFundName(row).toLowerCase();

    if (!rowFundName) return includeGlobalRows;
    return rowFundName === normalizedFundName;
  });
}

function isPdfUpload(row: DataRow) {
  const text = [
    getString(row, ["file_name", "original_file_name", "name"], ""),
    getString(row, ["file_type", "mime_type", "category"], ""),
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(".pdf") || text.includes("application/pdf") || text.includes("pdf");
}

const investorDocumentKits = [
  {
    label: "Statement of Account",
    description: "Quarterly or periodic investor SOA generated from Document Studio.",
  },
  {
    label: "Capital Call Notice",
    description: "Drawdown / capital call communication and payment notice.",
  },
  {
    label: "Distribution Notice",
    description: "Investor payout, gross distribution, tax withheld and net distribution.",
  },
  {
    label: "Unit Allotment Letter",
    description: "Post-drawdown unit allotment confirmation.",
  },
  {
    label: "Unit Statement",
    description: "Opening units, additions, redemptions and closing units.",
  },
  {
    label: "Form 64C",
    description: "Investor-wise AIF income and tax reporting document.",
  },
  {
    label: "Form 64D",
    description: "Fund-level AIF tax reporting support document.",
  },
  {
    label: "Advance Tax Data Points",
    description: "Investor tax estimation and advance tax support schedule.",
  },
  {
    label: "Annual Income Report",
    description: "Year-end investor income, capital account and tax report.",
  },
  {
    label: "Drawdown Reminder",
    description: "Reminder for pending capital call / drawdown payment.",
  },
];

function getInvestorDocumentGroup(documentRecord: InvestorDocument) {
  const text = `${getDocumentType(documentRecord)} ${getDocumentTitle(
    documentRecord
  )}`.toLowerCase();

  if (text.includes("64c")) return "Form 64C";
  if (text.includes("64d")) return "Form 64D";
  if (text.includes("advance tax")) return "Advance Tax Data Points";

  if (text.includes("annual income") || text.includes("annual report")) {
    return "Annual Income Report";
  }

  if (text.includes("unit allotment") || text.includes("allotment")) {
    return "Unit Allotment Letter";
  }

  if (text.includes("unit statement") || text.includes("unit movement")) {
    return "Unit Statement";
  }

  if (text.includes("distribution")) return "Distribution Notice";

  if (
    text.includes("capital call") ||
    text.includes("drawdown notice") ||
    text.includes("drawdown communication")
  ) {
    return "Capital Call Notice";
  }

  if (text.includes("drawdown reminder") || text.includes("reminder")) {
    return "Drawdown Reminder";
  }

  if (
    text.includes("soa") ||
    text.includes("statement of account") ||
    text.includes("investor statement") ||
    text.includes("statement")
  ) {
    return "Statement of Account";
  }

  if (text.includes("tax")) return "Advance Tax Data Points";

  return "Other Documents";
}

function documentMatchesExpectedType(
  documentRecord: InvestorDocument,
  expectedType: string
) {
  const groupedType = getInvestorDocumentGroup(documentRecord);
  const target = expectedType.toLowerCase();
  const type = getDocumentType(documentRecord).toLowerCase();
  const name = getDocumentTitle(documentRecord).toLowerCase();

  if (groupedType === expectedType) return true;

  if (target.includes("capital")) {
    return type.includes("capital") || name.includes("capital");
  }

  if (target.includes("distribution")) {
    return type.includes("distribution") || name.includes("distribution");
  }

  if (target.includes("statement") || target.includes("soa")) {
    return (
      type.includes("soa") ||
      name.includes("soa") ||
      type.includes("statement") ||
      name.includes("statement")
    );
  }

  if (target.includes("64c")) {
    return type.includes("64c") || name.includes("64c");
  }

  if (target.includes("64d")) {
    return type.includes("64d") || name.includes("64d");
  }

  if (target.includes("tax")) {
    return (
      type.includes("tax") ||
      name.includes("tax") ||
      type.includes("64c") ||
      name.includes("64c") ||
      type.includes("64d") ||
      name.includes("64d")
    );
  }

  if (target.includes("unit allotment")) {
    return name.includes("allotment") || type.includes("allotment");
  }

  if (target.includes("unit statement")) {
    return name.includes("unit") || type.includes("unit");
  }

  if (target.includes("annual income")) {
    return name.includes("annual") || type.includes("annual");
  }

  if (target.includes("advance tax")) {
    return name.includes("advance tax") || type.includes("advance tax");
  }

  if (target.includes("drawdown reminder")) {
    return name.includes("reminder") || type.includes("reminder");
  }

  return type.includes(target) || name.includes(target);
}

export default function InvestorPortalPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund("VENTIQ Growth Fund II");
  const {
    session,
    activeRole,
    fundAccess,
    investorId,
    loading: authLoading,
  } = useVentiqAuth();
  const isInvestorRole = activeRole === "investor";

  const investorAllowedFunds = useMemo(() => {
    if (!isInvestorRole) return [];

    return Array.from(
      new Set(
        fundAccess
          .filter(
            (access) =>
              access.status === "Active" &&
              Boolean(access.can_view) &&
              Boolean(access.fund_name?.trim())
          )
          .map((access) => access.fund_name.trim())
      )
    ).sort();
  }, [fundAccess, isInvestorRole]);
  const [availableFunds, setAvailableFunds] = useState<string[]>([
    "VENTIQ Growth Fund II",
  ]);
  const [fundActivationStatus, setFundActivationStatus] =
    useState("Setup Not Started");
  const [fundActivatedAt, setFundActivatedAt] = useState("");
  const [fundActivatedBy, setFundActivatedBy] = useState("");
  const [investorDocumentsModuleStatus, setInvestorDocumentsModuleStatus] =
    useState("Setup Not Started");
  const [investorDocumentsModuleActivatedAt, setInvestorDocumentsModuleActivatedAt] =
    useState("");
  const [investorDocumentsModuleActivatedBy, setInvestorDocumentsModuleActivatedBy] =
    useState("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [investorEntitlements, setInvestorEntitlements] = useState<DataRow[]>([]);
  const [financialPosition, setFinancialPosition] =
    useState<InvestorFinancialPosition | null>(null);
  const [cashflows, setCashflows] = useState<InvestorCashflow[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<InvestorCapitalCall[]>([]);
  const [distributionHistory, setDistributionHistory] = useState<
    InvestorDistribution[]
  >([]);
  const [cashflowSummary, setCashflowSummary] =
    useState<InvestorCashflowSummary | null>(null);
  const [cashflowAccessMessage, setCashflowAccessMessage] = useState("");

  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestCalculationRun, setLatestCalculationRun] =
    useState<DataRow | null>(null);
  const [calculatedFundMetric, setCalculatedFundMetric] =
    useState<DataRow | null>(null);
  const [calculatedInvestorMetrics, setCalculatedInvestorMetrics] = useState<
    DataRow[]
  >([]);
  const [calculationReconciliations, setCalculationReconciliations] = useState<
    DataRow[]
  >([]);
  const [sourceBatch, setSourceBatch] = useState("");
  const [calculationLoadMessage, setCalculationLoadMessage] = useState("");
  const [financialVerification, setFinancialVerification] =
    useState<FinancialVerification | null>(null);
  const [financialAccessMessage, setFinancialAccessMessage] = useState("");

  const [dataRoomDocuments, setDataRoomDocuments] = useState<DataRoomDocument[]>(
    []
  );
  const [dataRoomEngagementEvents, setDataRoomEngagementEvents] = useState<
    DataRoomEvent[]
  >([]);
  const [dataRoomQuestions, setDataRoomQuestions] = useState<
    DataRoomQuestion[]
  >([]);

  const [documentTypeFilter, setDocumentTypeFilter] =
    useState("All documents");
  const [loading, setLoading] = useState(true);
  const [loadingInvestorData, setLoadingInvestorData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [documentAccessBusyKey, setDocumentAccessBusyKey] = useState("");
  const [documentAccessMessage, setDocumentAccessMessage] = useState("");
  const [documentListMessage, setDocumentListMessage] = useState("");
  const [documentDownloadAllowed, setDocumentDownloadAllowed] = useState(true);

  useEffect(() => {
    if (!fundContextReady || authLoading || !isInvestorRole) return;

    if (investorAllowedFunds.length === 0) {
      setAvailableFunds([]);
      return;
    }

    setAvailableFunds(investorAllowedFunds);

    const hasCurrentFundAccess = investorAllowedFunds.some(
      (fundName) =>
        fundName.trim().toLowerCase() === activeFundName.trim().toLowerCase()
    );

    if (!hasCurrentFundAccess) {
      setActiveFundName(investorAllowedFunds[0]);
    }
  }, [
    activeFundName,
    authLoading,
    fundContextReady,
    investorAllowedFunds,
    isInvestorRole,
    setActiveFundName,
  ]);

  async function accessInvestorDocument(
    documentRecord: InvestorDocument,
    accessMode: "view" | "download"
  ) {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      setDocumentAccessMessage("Please sign in before opening investor documents.");
      return;
    }

    if (!documentRecord.id) {
      setDocumentAccessMessage("The selected investor document has no governed record ID.");
      return;
    }

    if (accessMode === "download" && !documentDownloadAllowed) {
      setDocumentAccessMessage(
        "Download access is not enabled for your investor entitlement. You can still view the document securely."
      );
      return;
    }

    const busyKey = `${documentRecord.id}:${accessMode}`;
    const previewWindow =
      accessMode === "view" ? window.open("about:blank", "_blank") : null;

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Opening secure VENTIQ document...";
    }

    try {
      setDocumentAccessBusyKey(busyKey);
      setDocumentAccessMessage(
        accessMode === "download"
          ? "Preparing governed PDF download..."
          : "Preparing secure PDF access..."
      );

      const response = await fetch("/api/investor-portal/document-access", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: documentRecord.id,
          access_mode: accessMode,
        }),
        cache: "no-store",
      });

      const result = (await response.json()) as {
        error?: string;
        signed_url?: string;
        expires_in_seconds?: number;
      };

      if (!response.ok || !result.signed_url) {
        throw new Error(result.error || "Unable to open the investor PDF securely.");
      }

      setDocumentAccessMessage(
        `Secure ${accessMode} access created. Link expires in ${
          result.expires_in_seconds ?? 180
        } seconds.`
      );

      if (accessMode === "view") {
        if (previewWindow) {
          previewWindow.location.href = result.signed_url;
        } else {
          window.open(result.signed_url, "_blank", "noopener,noreferrer");
        }
      } else {
        const link = document.createElement("a");
        link.href = result.signed_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      if (previewWindow) previewWindow.close();
      setDocumentAccessMessage(
        error instanceof Error
          ? error.message
          : "Unable to open the investor PDF securely."
      );
    } finally {
      setDocumentAccessBusyKey("");
    }
  }

  useEffect(() => {
    async function loadInvestors() {
      if (!fundContextReady || authLoading) return;

      if (isInvestorRole && investorAllowedFunds.length === 0) {
        setErrorMessage(
          "Your investor account has no active governed fund access."
        );
        setLoading(false);
        return;
      }

      if (
        isInvestorRole &&
        !investorAllowedFunds.some(
          (fundName) =>
            fundName.trim().toLowerCase() === activeFundName.trim().toLowerCase()
        )
      ) {
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage(
          "The Investor Portal is unavailable because Supabase is not configured."
        );
        setLoading(false);
        return;
      }

      const accessToken = session?.access_token ?? "";

      if (!accessToken) {
        setErrorMessage("Please sign in to load the verified Investor Portal.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setCalculationLoadMessage("");

      try {
        let calculationRun: DataRow | null = null;
        let authoritativeBatch = "";

        // Internal Calculation Engine data remains an internal support layer.
        // Investor-role users never call /api/metrics/calculate; their financial
        // position is released later through the governed LP-safe endpoint.
        if (!isInvestorRole) {
          try {
            const calculationResponse = await fetch(
              `/api/metrics/calculate?fundName=${encodeURIComponent(activeFundName)}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
              }
            );
            const calculationData =
              (await calculationResponse.json()) as PerformanceCalculationResponse;

            if (calculationResponse.ok) {
              calculationRun = calculationData.run ?? null;
              const sourceBatchIds = calculationRun?.source_batch_ids;
              authoritativeBatch = Array.isArray(sourceBatchIds)
                ? String(sourceBatchIds[0] ?? "")
                : "";

              setLatestCalculationRun(calculationRun);
              setCalculatedFundMetric(calculationData.fundMetric ?? null);
              setCalculatedInvestorMetrics(calculationData.investorMetrics ?? []);
              setCalculationReconciliations(calculationData.reconciliations ?? []);
              setSourceBatch(authoritativeBatch);

              if (!authoritativeBatch) {
                setCalculationLoadMessage(
                  "No completed verified Calculation Engine source batch is available for this fund yet. Canonical published documents remain independently governed by Fund Memory."
                );
              }
            } else {
              setLatestCalculationRun(null);
              setCalculatedFundMetric(null);
              setCalculatedInvestorMetrics([]);
              setCalculationReconciliations([]);
              setSourceBatch("");
              setCalculationLoadMessage(
                calculationData.error ||
                  "Verified investor calculations are not available for this fund yet. Canonical published documents can still be discovered from Fund Memory lineage after fund activation."
              );
            }
          } catch (calculationError) {
            setLatestCalculationRun(null);
            setCalculatedFundMetric(null);
            setCalculatedInvestorMetrics([]);
            setCalculationReconciliations([]);
            setSourceBatch("");
            setCalculationLoadMessage(
              calculationError instanceof Error
                ? calculationError.message
                : "Verified investor calculations are not available for this fund yet."
            );
          }
        } else {
          setLatestCalculationRun(null);
          setCalculatedFundMetric(null);
          setCalculatedInvestorMetrics([]);
          setCalculationReconciliations([]);
          setSourceBatch("");
          setCalculationLoadMessage("");
        }

        const db = supabase as any;

        let activeInvestorEntitlements: DataRow[] = [];

        if (isInvestorRole) {
          const entitlementResult = await db
            .from("ventiq_user_investor_access")
            .select(
              "investor_code,fund_name,status,expires_at,can_view_profile,can_view_financials,can_view_documents,can_download_documents,can_use_data_room,can_submit_questions"
            )
            .eq("status", "Active")
            .eq("fund_name", activeFundName);

          if (entitlementResult.error) {
            throw new Error(
              `Unable to resolve your investor entitlement: ${entitlementResult.error.message}`
            );
          }

          const now = Date.now();
          activeInvestorEntitlements = (
            (entitlementResult.data ?? []) as DataRow[]
          ).filter((row) => {
            const expiresAt = getString(row, ["expires_at"], "");
            if (!expiresAt) return true;
            const expiry = Date.parse(expiresAt);
            return Number.isFinite(expiry) && expiry > now;
          });

          setInvestorEntitlements(activeInvestorEntitlements);

          if (activeInvestorEntitlements.length === 0) {
            throw new Error(
              `Your investor account has no active entitlement for ${activeFundName}.`
            );
          }
        } else {
          setInvestorEntitlements([]);
        }

        let investorsQuery = db
          .from("investor_master")
          .select("*")
          .eq("fund_name", activeFundName)
          .order("investor_code", { ascending: true });

        let commitmentsQuery = db
          .from("fund_commitments")
          .select("*")
          .eq("fund_name", activeFundName);

        let uploadsQuery = db.from("migration_file_uploads").select("*");

        let complianceQuery = db
          .from("compliance_items")
          .select("*")
          .eq("fund_name", activeFundName);

        if (authoritativeBatch) {
          investorsQuery = investorsQuery.eq("source_batch_id", authoritativeBatch);
          commitmentsQuery = commitmentsQuery.eq(
            "source_batch_id",
            authoritativeBatch
          );
          uploadsQuery = uploadsQuery.eq("batch_id", authoritativeBatch);
          complianceQuery = complianceQuery.eq(
            "source_batch_id",
            authoritativeBatch
          );
        } else {
          // Without a verified Calculation Engine batch we still load the
          // governed investor master so canonical documents can be matched.
          // Batch-scoped operating records remain unavailable rather than being
          // mixed across historical migration batches.
          const impossibleBatch = "__VENTIQ_NO_VERIFIED_SOURCE_BATCH__";
          commitmentsQuery = commitmentsQuery.eq("source_batch_id", impossibleBatch);
          uploadsQuery = uploadsQuery.eq("batch_id", impossibleBatch);
          complianceQuery = complianceQuery.eq("source_batch_id", impossibleBatch);
        }

        const [
          investorsResult,
          commitmentsResult,
          fundOptionsResult,
          activationResult,
          moduleActivationResult,
          uploadsResult,
          complianceResult,
        ] = await Promise.all([
          investorsQuery,
          commitmentsQuery,
          db.from("fund_master").select("fund_name").not("fund_name", "is", null),
          db
            .from("fund_activation_status")
            .select("status, activated_at, activated_by, readiness_score")
            .eq("fund_name", activeFundName)
            .maybeSingle(),
          db
            .from("ventiq_module_activation_status")
            .select(
              "status, activated_at, activated_by_name, module_key, readiness_score"
            )
            .eq("fund_name", activeFundName)
            .eq("module_key", "investor_documents_portal")
            .maybeSingle(),
          uploadsQuery,
          complianceQuery,
        ]);

        if (investorsResult.error) {
          throw new Error(investorsResult.error.message);
        }
        if (commitmentsResult.error) {
          throw new Error(commitmentsResult.error.message);
        }

        const commitmentRows = (commitmentsResult.data ?? []) as DataRow[];
        const activeInvestorIds = new Set(
          commitmentRows
            .map((row) => getString(row, ["investor_id"], ""))
            .filter(Boolean)
        );
        const activeInvestorCodes = new Set(
          commitmentRows
            .map((row) => getString(row, ["investor_code"], ""))
            .filter(Boolean)
        );

        const restrictToVerifiedCommitments =
          Boolean(authoritativeBatch) && commitmentRows.length > 0;

        const entitledInvestorCodes = new Set(
          activeInvestorEntitlements
            .map((row) => getString(row, ["investor_code"], ""))
            .filter(Boolean)
        );

        const investorData = ((investorsResult.data ?? []) as DataRow[])
          .map((investor) => ({
            id: getString(investor, ["id"], ""),
            investor_code: getString(investor, ["investor_code"], "") || null,
            name: getString(
              investor,
              ["investor_name", "name"],
              "Unknown Investor"
            ),
            investor_type:
              getString(investor, ["investor_type", "type"], "") || null,
            email: getString(investor, ["email"], "") || null,
            country: getString(investor, ["country"], "India") || "India",
            kyc_status: getString(investor, ["kyc_status"], "") || null,
            bank_status: getString(investor, ["bank_status"], "") || null,
            source: "migration" as const,
          }))
          .filter((investor) =>
            restrictToVerifiedCommitments
              ? activeInvestorIds.has(investor.id) ||
                activeInvestorCodes.has(investor.investor_code || "")
              : true
          )
          .filter((investor) => {
            if (!isInvestorRole) return true;

            return Boolean(
              (investor.investor_code &&
                entitledInvestorCodes.has(investor.investor_code)) ||
                (investorId &&
                  (investor.id === investorId ||
                    investor.investor_code === investorId))
            );
          });

        if (isInvestorRole && investorData.length === 0) {
          throw new Error(
            "Your investor entitlement is active, but no matching governed investor record is available."
          );
        }

        setInvestors(investorData);

        if (!isInvestorRole && !fundOptionsResult.error) {
          const fundNames = Array.from(
            new Set<string>(
              ((fundOptionsResult.data ?? []) as DataRow[])
                .map((row) => getString(row, ["fund_name"], ""))
                .filter(Boolean)
            )
          ).sort();

          setAvailableFunds(
            Array.from(new Set([activeFundName, ...fundNames])).filter(Boolean)
          );
        }

        if (!activationResult.error && activationResult.data) {
          setFundActivationStatus(
            String(activationResult.data.status ?? "Setup Not Started")
          );
          setFundActivatedAt(String(activationResult.data.activated_at ?? ""));
          setFundActivatedBy(String(activationResult.data.activated_by ?? ""));
        } else {
          setFundActivationStatus("Setup Not Started");
          setFundActivatedAt("");
          setFundActivatedBy("");
        }

        if (!moduleActivationResult.error && moduleActivationResult.data) {
          setInvestorDocumentsModuleStatus(
            String(moduleActivationResult.data.status ?? "Setup Not Started")
          );
          setInvestorDocumentsModuleActivatedAt(
            String(moduleActivationResult.data.activated_at ?? "")
          );
          setInvestorDocumentsModuleActivatedBy(
            String(moduleActivationResult.data.activated_by_name ?? "")
          );
        } else {
          setInvestorDocumentsModuleStatus("Setup Not Started");
          setInvestorDocumentsModuleActivatedAt("");
          setInvestorDocumentsModuleActivatedBy("");
        }

        if (authoritativeBatch) {
          const totalCommitment = commitmentRows.reduce(
            (sum, row) =>
              sum +
              getNumber(row, [
                "commitment_amount",
                "committed_amount",
                "commitment",
              ]),
            0
          );
          setLatestInvestorBatch({
            id: authoritativeBatch,
            total_records: investorData.length,
            total_commitment: totalCommitment,
            created_at: getString(
              calculationRun ?? undefined,
              ["completed_at"],
              ""
            ),
          });
        } else {
          setLatestInvestorBatch(null);
        }

        const pdfUploads = uploadsResult.error
          ? []
          : ((uploadsResult.data ?? []) as DataRow[]).filter(isPdfUpload);
        setLatestPdfBatch(
          authoritativeBatch
            ? {
                id: authoritativeBatch,
                total_files: pdfUploads.length,
                ready_files: 0,
                review_files: 0,
                unmatched_files: 0,
              }
            : null
        );

        const complianceRows = complianceResult.error
          ? []
          : ((complianceResult.data ?? []) as DataRow[]);
        const complianceEvidence = complianceRows.filter((row) => {
          const value = row.evidence_available;
          return value === true || String(value).toLowerCase() === "true";
        }).length;
        const compliancePending = complianceRows.filter((row) => {
          const status = getString(
            row,
            ["filing_status", "status"],
            ""
          ).toLowerCase();
          return !["filed", "completed", "closed", "approved"].includes(status);
        }).length;
        setLatestComplianceBatch(
          authoritativeBatch
            ? {
                id: authoritativeBatch,
                total_items: complianceRows.length,
                evidence_available_count: complianceEvidence,
                pending_review_count: compliancePending,
              }
            : null
        );

        // Data-room/DDQ records are not inferred from unrelated historical
        // batches when no verified source batch exists.
        setDataRoomDocuments([]);
        setDataRoomEngagementEvents([]);
        setDataRoomQuestions([]);

        const investorIdFromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("investorId")
            : "";
        const investorCodeFromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("investorCode")
            : "";

        const investorFromUrl = isInvestorRole
          ? undefined
          : investorData.find(
              (investor) =>
                (investorIdFromUrl && investor.id === investorIdFromUrl) ||
                (investorCodeFromUrl &&
                  investor.investor_code === investorCodeFromUrl)
            );

        const recommendedInvestor = isInvestorRole
          ? investorData[0]
          : investorFromUrl ?? investorData[0];

        setSelectedInvestorId(recommendedInvestor?.id ?? "");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load investor portal.";
        setErrorMessage(message);
        setCalculationLoadMessage(message);
        setLatestCalculationRun(null);
        setCalculatedFundMetric(null);
        setCalculatedInvestorMetrics([]);
        setCalculationReconciliations([]);
        setSourceBatch("");
      } finally {
        setLoading(false);
      }
    }

    loadInvestors();
  }, [
    activeFundName,
    authLoading,
    fundContextReady,
    investorAllowedFunds,
    investorId,
    isInvestorRole,
    session?.access_token,
  ]);

  useEffect(() => {
    async function loadInvestorPortalData() {
      if (!selectedInvestorId || !supabase) return;

      const selectedInvestor = investors.find(
        (investor) => investor.id === selectedInvestorId
      );
      if (!selectedInvestor) return;

      setLoadingInvestorData(true);
      setErrorMessage("");

      try {
        const db = supabase as any;

        let commitmentQuery = db
          .from("fund_commitments")
          .select("*")
          .eq("fund_name", activeFundName);

        // Commitments remain tied to the verified calculation source batch.
        // Capital calls, receipts and distributions are loaded separately through
        // the entitlement-scoped server API below. Published canonical Document
        // Studio documents carry their own immutable Fund Memory lineage.
        if (sourceBatch) {
          commitmentQuery = commitmentQuery.eq("source_batch_id", sourceBatch);
        } else {
          const impossibleSourceBatch = "__VENTIQ_NO_VERIFIED_SOURCE_BATCH__";
          commitmentQuery = commitmentQuery.eq(
            "source_batch_id",
            impossibleSourceBatch
          );
        }

        const commitmentResult = await commitmentQuery;

        const commitmentRows = commitmentResult.error
          ? []
          : ((commitmentResult.data ?? []) as DataRow[]).filter((row) => {
              const rowInvestorId = getString(row, ["investor_id"], "");
              const rowInvestorCode = getString(row, ["investor_code"], "");
              return (
                rowInvestorId === selectedInvestorId ||
                (selectedInvestor.investor_code &&
                  rowInvestorCode === selectedInvestor.investor_code)
              );
            });

        const normalizedCommitments: Commitment[] = commitmentRows.map((row) => {
          const commitmentAmount = getNumber(row, [
            "commitment_amount",
            "committed_amount",
            "commitment",
          ]);
          const uncalledAmount = getNumber(row, [
            "uncalled_commitment",
            "unfunded_commitment",
            "unfunded_amount",
          ]);
          const paidInAmount = getNumber(row, [
            "paid_in_capital",
            "called_amount",
            "capital_called",
          ]);

          return {
            id: getString(row, ["id", "commitment_code"], ""),
            investor_id: getString(row, ["investor_id"], selectedInvestorId),
            fund_name: getString(row, ["fund_name"], activeFundName),
            class_name: getString(row, ["class_name"], "") || null,
            commitment_amount: commitmentAmount,
            called_amount:
              paidInAmount > 0
                ? paidInAmount
                : Math.max(commitmentAmount - uncalledAmount, 0),
            unfunded_amount: uncalledAmount,
            status:
              getString(
                row,
                ["commitment_status", "status"],
                "Active"
              ) || null,
          };
        });
        setCommitments(normalizedCommitments);

        const accessToken = session?.access_token ?? "";

        // A7-4: document metadata is now released through the same governed
        // server pattern as financials and cashflows. Browser code no longer
        // reads investor_documents directly and receives no storage path/URL.
        if (!accessToken) {
          setDocuments([]);
          setDocumentDownloadAllowed(false);
          setDocumentListMessage(
            "Please sign in to load your governed investor document library."
          );
        } else {
          const documentParams = new URLSearchParams({
            fundName: activeFundName,
          });

          // Internal support users explicitly select an investor. Investor-role
          // identity is derived server-side only from active entitlement.
          if (!isInvestorRole && selectedInvestor.investor_code) {
            documentParams.set(
              "investorCode",
              selectedInvestor.investor_code
            );
          }

          try {
            const documentResponse = await fetch(
              `/api/investor-portal/documents?${documentParams.toString()}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
              }
            );

            const documentData =
              (await documentResponse.json()) as InvestorDocumentsApiResponse;

            if (documentResponse.ok && documentData.available) {
              setDocuments(documentData.documents ?? []);
              setDocumentDownloadAllowed(
                Boolean(
                  documentData.permissions?.can_download_documents
                )
              );
              setDocumentListMessage("");
            } else {
              setDocuments([]);
              setDocumentDownloadAllowed(false);
              setDocumentListMessage(
                documentData.message ||
                  documentData.error ||
                  "Investor documents are not available for this investor yet."
              );
            }
          } catch (documentError) {
            setDocuments([]);
            setDocumentDownloadAllowed(false);
            setDocumentListMessage(
              documentError instanceof Error
                ? documentError.message
                : "Investor documents are not available for this investor yet."
            );
          }
        }

        if (!accessToken) {
          setFinancialPosition(null);
          setFinancialVerification(null);
          setFinancialAccessMessage(
            "Please sign in to load your verified financial position."
          );
        } else {
          const financialParams = new URLSearchParams({
            fundName: activeFundName,
          });

          // Internal support users explicitly select an investor. Investor-role
          // users never send browser-selected identity to the financial endpoint.
          if (!isInvestorRole && selectedInvestor.investor_code) {
            financialParams.set(
              "investorCode",
              selectedInvestor.investor_code
            );
          }

          try {
            const financialResponse = await fetch(
              `/api/investor-portal/financial-position?${financialParams.toString()}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
              }
            );

            const financialData =
              (await financialResponse.json()) as FinancialPositionApiResponse;

            if (
              financialResponse.ok &&
              financialData.available &&
              financialData.financial_position
            ) {
              const metric = financialData.financial_position;
              const paidInCapital = Number(metric.paid_in_capital ?? 0);
              const netDistributions = Number(
                metric.net_distributions ?? metric.total_distributions ?? 0
              );

              setFinancialPosition({
                id: `${financialData.investor_code || selectedInvestor.investor_code || selectedInvestorId}:verified-financial-position`,
                investor_id: selectedInvestorId,
                investor_code:
                  financialData.investor_code || selectedInvestor.investor_code,
                investor_name:
                  financialData.investor_name || selectedInvestor.name,
                email: selectedInvestor.email,
                fund_name: financialData.fund_name || activeFundName,
                class_name:
                  financialData.class_name || selectedInvestor.investor_type || null,
                commitment_amount: Number(metric.commitment_amount ?? 0),
                capital_called_till_date: paidInCapital,
                uncalled_capital: Number(metric.uncalled_commitment ?? 0),
                distributions_till_date: netDistributions,
                setup_fee: 0,
                management_fee: 0,
                net_contributed: Math.max(
                  paidInCapital - netDistributions,
                  0
                ),
                current_nav: Number(metric.allocated_nav ?? 0),
                investor_irr: Number(metric.net_irr ?? 0),
                investor_moic: Number(metric.tvpi ?? 0),
                investor_dpi: Number(metric.dpi ?? 0),
                investor_rvpi: Number(metric.rvpi ?? 0),
                investor_tvpi: Number(metric.tvpi ?? 0),
                status: metric.calculation_status || "Calculated",
                created_at: financialData.verification?.as_of_date || null,
              });
              setFinancialVerification(financialData.verification ?? null);
              setFinancialAccessMessage("");
            } else {
              setFinancialPosition(null);
              setFinancialVerification(null);
              setFinancialAccessMessage(
                financialData.message ||
                  financialData.error ||
                  "Verified performance data is not available for this investor yet."
              );
            }
          } catch (financialError) {
            setFinancialPosition(null);
            setFinancialVerification(null);
            setFinancialAccessMessage(
              financialError instanceof Error
                ? financialError.message
                : "Verified performance data is not available for this investor yet."
            );
          }
        }

        if (!accessToken) {
          setCapitalCalls([]);
          setDistributionHistory([]);
          setCashflowSummary(null);
          setCashflows([]);
          setCashflowAccessMessage(
            "Please sign in to load your capital-call and distribution history."
          );
        } else {
          const cashflowParams = new URLSearchParams({
            fundName: activeFundName,
          });

          // Internal support users explicitly select an investor. Investor-role
          // users never send browser-selected identity to the cashflow endpoint.
          if (!isInvestorRole && selectedInvestor.investor_code) {
            cashflowParams.set(
              "investorCode",
              selectedInvestor.investor_code
            );
          }

          try {
            const cashflowResponse = await fetch(
              `/api/investor-portal/cashflows?${cashflowParams.toString()}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
              }
            );

            const cashflowData =
              (await cashflowResponse.json()) as InvestorCashflowsApiResponse;

            if (cashflowResponse.ok && cashflowData.available) {
              const calls = cashflowData.capital_calls ?? [];
              const distributions = cashflowData.distributions ?? [];

              setCapitalCalls(calls);
              setDistributionHistory(distributions);
              setCashflowSummary(cashflowData.summary ?? null);
              setCashflowAccessMessage("");

              const secureTimeline: InvestorCashflow[] = [
                ...calls.map((call) => ({
                  id: `capital-call:${call.capital_call_code}`,
                  investor_id: selectedInvestorId,
                  investor_code:
                    cashflowData.investor_code || selectedInvestor.investor_code,
                  investor_name:
                    cashflowData.investor_name || selectedInvestor.name,
                  fund_name: cashflowData.fund_name || activeFundName,
                  cashflow_date:
                    call.receipt_date || call.due_date || call.call_date || null,
                  cashflow_type: "Capital Call",
                  amount: Number(call.amount_received ?? call.total_due ?? 0),
                  direction: "Outflow",
                  description: `${call.call_name || call.capital_call_code} · ${
                    call.receipt_status || call.allocation_status || "Recorded"
                  } · Outstanding ${formatInr(call.outstanding_amount)}`,
                })),
                ...distributions.map((distribution) => ({
                  id: `distribution:${distribution.distribution_code}`,
                  investor_id: selectedInvestorId,
                  investor_code:
                    cashflowData.investor_code || selectedInvestor.investor_code,
                  investor_name:
                    cashflowData.investor_name || selectedInvestor.name,
                  fund_name: cashflowData.fund_name || activeFundName,
                  cashflow_date:
                    distribution.payment_date ||
                    distribution.declaration_date ||
                    null,
                  cashflow_type: "Distribution",
                  amount: Number(distribution.net_distribution ?? 0),
                  direction: "Inflow",
                  description: `${
                    distribution.distribution_name ||
                    distribution.distribution_code
                  } · ${distribution.payment_status || "Recorded"}`,
                })),
              ].sort((a, b) =>
                String(b.cashflow_date || "").localeCompare(
                  String(a.cashflow_date || "")
                )
              );

              setCashflows(secureTimeline);
            } else {
              setCapitalCalls([]);
              setDistributionHistory([]);
              setCashflowSummary(null);
              setCashflows([]);
              setCashflowAccessMessage(
                cashflowData.message ||
                  cashflowData.error ||
                  "Capital-call and distribution history is not available for this investor yet."
              );
            }
          } catch (cashflowError) {
            setCapitalCalls([]);
            setDistributionHistory([]);
            setCashflowSummary(null);
            setCashflows([]);
            setCashflowAccessMessage(
              cashflowError instanceof Error
                ? cashflowError.message
                : "Capital-call and distribution history is not available for this investor yet."
            );
          }
        }

        setDataRoomEngagementEvents([]);
        setDataRoomQuestions([]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load selected investor portal data."
        );
        setCommitments([]);
        setDocuments([]);
        setDocumentDownloadAllowed(false);
        setDocumentListMessage("");
        setFinancialPosition(null);
        setCashflows([]);
        setCapitalCalls([]);
        setDistributionHistory([]);
        setCashflowSummary(null);
        setCashflowAccessMessage("");
      } finally {
        setLoadingInvestorData(false);
      }
    }

    loadInvestorPortalData();
  }, [
    selectedInvestorId,
    activeFundName,
    investors,
    sourceBatch,
    isInvestorRole,
    session?.access_token,
  ]);

  const selectedInvestor = investors.find(
    (investor) => investor.id === selectedInvestorId
  );

  const fullFundActive = fundActivationStatus === "Active";
  const investorDocumentsModuleActive =
    investorDocumentsModuleStatus === "Active";
  const investorPortalOperational =
    fullFundActive || investorDocumentsModuleActive;


  const calculationSummary = useMemo(() => {
    const passedControls = calculationReconciliations.filter((row) => {
      const statusText = getString(
        row,
        [
          "reconciliation_status",
          "status",
          "control_status",
          "result",
        ],
        ""
      )
        .trim()
        .toLowerCase();

      const explicitPassFlag =
        row["is_passed"] === true ||
        row["passed"] === true ||
        row["is_reconciled"] === true;

      return explicitPassFlag || statusText.includes("pass");
    }).length;

    const totalControls = calculationReconciliations.length;

    return {
      version: getString(
        latestCalculationRun ?? undefined,
        ["calculation_version"],
        "-"
      ),
      asOfDate: getString(
        latestCalculationRun ?? undefined,
        ["as_of_date"],
        ""
      ),
      passedControls,
      totalControls,
    };
  }, [latestCalculationRun, calculationReconciliations]);

  const portalMetrics = useMemo(() => {
    const totalCommitment = commitments.reduce(
      (sum, commitment) => sum + toCr(commitment.commitment_amount),
      0
    );

    const totalCalled = commitments.reduce(
      (sum, commitment) => sum + toCr(commitment.called_amount),
      0
    );

    const totalRemaining = commitments.reduce(
      (sum, commitment) => sum + toCr(commitment.unfunded_amount),
      0
    );

    const distributionDocuments = documents.filter((documentRecord) =>
      getDocumentType(documentRecord).toLowerCase().includes("distribution")
    );

    const totalDistributedFromDocuments = distributionDocuments.reduce(
      (sum, documentRecord) => sum + toCr(documentRecord.amount),
      0
    );

    const displayedCommitment = financialPosition
  ? toCr(
      getPositionNumber(financialPosition, [
        "commitment_amount",
        "committed_amount",
        "commitment",
      ])
    )
  : totalCommitment;

const displayedCalled = financialPosition
  ? toCr(
      getPositionNumber(financialPosition, [
        "capital_called_till_date",
        "capital_called",
        "called_capital",
        "called_amount",
      ])
    )
  : totalCalled;

const displayedRemaining = financialPosition
  ? toCr(
      getPositionNumber(financialPosition, [
        "uncalled_capital",
        "unfunded_commitment",
        "remaining_commitment",
      ])
    )
  : totalRemaining;

const displayedDistributed = financialPosition
  ? toCr(
      getPositionNumber(financialPosition, [
        "distributions_till_date",
        "distributions",
        "distributed_amount",
      ])
    )
  : totalDistributedFromDocuments;

const displayedCurrentNav = financialPosition
  ? toCr(
      getPositionNumber(financialPosition, [
        "current_nav",
        "nav",
        "latest_nav",
      ])
    )
  : 0;

const displayedSetupFee = financialPosition
  ? toCr(getPositionNumber(financialPosition, ["setup_fee"]))
  : 0;

const displayedManagementFee = financialPosition
  ? toCr(getPositionNumber(financialPosition, ["management_fee"]))
  : 0;

    const capitalCallDocuments = documents.filter((documentRecord) =>
      getDocumentType(documentRecord).toLowerCase().includes("capital")
    );

    const statementDocuments = documents.filter((documentRecord) => {
      const type = getDocumentType(documentRecord).toLowerCase();
      const title = getDocumentTitle(documentRecord).toLowerCase();

      return (
        type.includes("soa") ||
        title.includes("soa") ||
        type.includes("statement") ||
        title.includes("statement")
      );
    });

    const taxDocuments = documents.filter((documentRecord) => {
      const type = getDocumentType(documentRecord).toLowerCase();
      const title = getDocumentTitle(documentRecord).toLowerCase();

      return (
        type.includes("tax") ||
        title.includes("tax") ||
        type.includes("64c") ||
        title.includes("64c") ||
        type.includes("64d") ||
        title.includes("64d")
      );
    });

    const storedDocuments = documents.filter(hasStoredPdf);

    const portalReadyDocuments = documents.filter((documentRecord) => {
      const portalStatus = normalizeText(documentRecord.portal_status);
      const migrationStatus = normalizeText(documentRecord.migration_status);
      const status = normalizeText(documentRecord.status);

      return (
        portalStatus.includes("available") ||
        portalStatus.includes("published") ||
        migrationStatus.includes("published") ||
        status.includes("published") ||
        status.includes("available")
      );
    });

    const expectedDocumentTypes = investorDocumentKits.map((kit) => kit.label);

    const missingDocumentTypes = expectedDocumentTypes.filter(
      (expectedType) =>
        !documents.some((documentRecord) =>
          documentMatchesExpectedType(documentRecord, expectedType)
        )
    );

    const pdfTotal = getNumber(latestPdfBatch ?? undefined, ["total_files"]);
    const pdfReady = getNumber(latestPdfBatch ?? undefined, ["ready_files"]);
    const pdfReview =
      getNumber(latestPdfBatch ?? undefined, ["review_files"]) +
      getNumber(latestPdfBatch ?? undefined, ["unmatched_files"]);

    const importedInvestors = getNumber(latestInvestorBatch ?? undefined, [
      "total_records",
    ]);

    const importedCommitment = getNumber(latestInvestorBatch ?? undefined, [
      "total_commitment",
    ]);

    const complianceItems = getNumber(latestComplianceBatch ?? undefined, [
      "total_items",
    ]);

    const complianceEvidence = getNumber(latestComplianceBatch ?? undefined, [
      "evidence_available_count",
    ]);

    const compliancePending = getNumber(latestComplianceBatch ?? undefined, [
      "pending_review_count",
    ]);

    const openQuestions = dataRoomQuestions.filter(
      (question) => question.status !== "Answered"
    ).length;

    const answeredQuestions = dataRoomQuestions.filter(
      (question) => question.status === "Answered"
    ).length;

    const viewedEvents = dataRoomEngagementEvents.filter((event) =>
      normalizeText(event.action).includes("view")
    ).length;

    const downloadedEvents = dataRoomEngagementEvents.filter((event) =>
      normalizeText(event.action).includes("download")
    ).length;

    const documentReadinessScore = Math.min(
      95,
      Math.max(
        0,
        45 +
          Math.min(20, documents.length * 4) +
          Math.min(15, storedDocuments.length * 4) +
          Math.min(10, portalReadyDocuments.length * 3) +
          Math.min(10, answeredQuestions * 5) -
          Math.min(15, missingDocumentTypes.length * 3) -
          Math.min(10, pdfReview * 2) -
          Math.min(10, openQuestions * 4)
      )
    );

    return {
      totalCommitment,
      totalCalled,
      totalRemaining,
      displayedCommitment,
      displayedCalled,
      displayedRemaining,
      displayedDistributed,
      displayedCurrentNav,
      displayedSetupFee,
      displayedManagementFee,
      capitalCallDocuments,
      distributionDocuments,
      statementDocuments,
      taxDocuments,
      storedDocuments,
      portalReadyDocuments,
      missingDocumentTypes,
      pdfTotal,
      pdfReady,
      pdfReview,
      importedInvestors,
      importedCommitment,
      complianceItems,
      complianceEvidence,
      compliancePending,
      openQuestions,
      answeredQuestions,
      viewedEvents,
      downloadedEvents,
      documentReadinessScore,
    };
  }, [
    commitments,
    documents,
    financialPosition,
    latestPdfBatch,
    latestInvestorBatch,
    latestComplianceBatch,
    dataRoomQuestions,
    dataRoomEngagementEvents,
  ]);

 const filteredDocuments = useMemo(() => {
  if (documentTypeFilter === "All documents") return documents;

  return documents.filter(
    (documentRecord) => getInvestorDocumentGroup(documentRecord) === documentTypeFilter
  );
}, [documentTypeFilter, documents]);

 const documentTypeOptions = useMemo(() => {
  const standardGroups = investorDocumentKits.map((kit) => kit.label);

  const actualGroups: string[] = Array.from(
    new Set<string>(
      documents.map((documentRecord) =>
        getInvestorDocumentGroup(documentRecord)
      )
    )
  ).filter(Boolean);

  if (isInvestorRole) {
    return ["All documents", ...actualGroups];
  }

  return [
    "All documents",
    ...standardGroups,
    ...actualGroups.filter((group) => !standardGroups.includes(group)),
    "Other Documents",
  ];
}, [documents, isInvestorRole]);

  const investorActivityEvents = useMemo(() => {
    const events: PortalActivityEvent[] = [];

    documents.forEach((documentRecord) => {
      events.push({
        id: `document-${documentRecord.id}`,
        time: getDocumentDate(documentRecord) || "",
        module: "Investor Documents",
        title: `${getDocumentType(documentRecord)} published`,
        description: `${getDocumentTitle(documentRecord)} ${
          hasStoredPdf(documentRecord)
            ? "is available in the portal library."
            : "is available as a record but PDF storage is pending."
        }`,
        status: hasStoredPdf(documentRecord) ? "document ready" : "document review",
      });
    });

    cashflows.forEach((cashflow) => {
      events.push({
        id: `cashflow-${cashflow.id}`,
        time: cashflow.cashflow_date || "",
        module: "Cashflow Timeline",
        title: `${cashflow.cashflow_type || "Cashflow"} recorded`,
        description: `${cashflow.direction || "-"} • ${formatCr(
          toCr(cashflow.amount)
        )} • ${cashflow.description || "No description"}`,
        status: "cashflow",
      });
    });

    dataRoomEngagementEvents.forEach((event) => {
      events.push({
        id: `engagement-${event.id}`,
        time: event.event_time || event.created_at || "",
        module: "Data Room",
        title: `${event.action || "Viewed"} data room document`,
        description: `${event.document_name || "Data room document"} activity recorded.`,
        status: event.action || "viewed",
      });
    });

    dataRoomQuestions.forEach((question) => {
      const status = question.status || "Open";

      events.push({
        id: `question-${question.id}`,
        time:
          status === "Answered"
            ? question.answered_at || question.asked_at || question.created_at || ""
            : question.asked_at || question.created_at || "",
        module: "DDQ / Investor Questions",
        title: status === "Answered" ? "Question answered" : "Question open",
        description: `${question.category || "DDQ"} • ${
          question.document_name || question.question || "Investor question"
        }`,
        status: status === "Answered" ? "answered" : "question open",
      });
    });

    return events.sort((a, b) => {
      const aTime = new Date(a.time || 0).getTime();
      const bTime = new Date(b.time || 0).getTime();

      return bTime - aTime;
    });
  }, [documents, cashflows, dataRoomEngagementEvents, dataRoomQuestions]);

  const investorActions = useMemo(() => {
    return [
      {
        title: "Review latest documents",
        value: `${documents.length} document(s) available`,
        priority: documents.length > 0 ? "Ready" : "Not started",
        href: "#documents",
      },
      {
        title: "Download stored PDFs",
        value: `${portalMetrics.storedDocuments.length} file(s) download-ready`,
        priority: portalMetrics.storedDocuments.length > 0 ? "Ready" : "Pending",
        href: "#documents",
      },
      {
        title: "Review missing document signals",
        value: `${portalMetrics.missingDocumentTypes.length} expected item(s) missing`,
        priority:
          portalMetrics.missingDocumentTypes.length > 0 ? "Review" : "Clear",
        href: "#missing-documents",
      },
      {
        title: "Check DDQ / question trail",
        value: `${portalMetrics.openQuestions} open / ${portalMetrics.answeredQuestions} answered`,
        priority: portalMetrics.openQuestions > 0 ? "Review" : "Clear",
        href: "#ddq",
      },
      {
        title: "Review capital calls & distributions",
        value: `${capitalCalls.length} call(s) · ${distributionHistory.length} distribution(s)`,
        priority:
          capitalCalls.length + distributionHistory.length > 0
            ? "Ready"
            : "Pending",
        href: "#cashflows",
      },
      {
        title: "Open data room",
        value: `${dataRoomDocuments.length} data room document(s)`,
        priority: "Live",
        href: "/data-room",
      },
    ];
  }, [
    documents,
    portalMetrics,
    capitalCalls,
    distributionHistory,
    dataRoomDocuments,
  ]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Experience</p>
            <h1>Investor Portal</h1>
            <p>
              {isInvestorRole
                ? "Your private VENTIQ account for fund positions, cashflows, documents and governed investor access."
                : "One clean investor-facing view for commitments, capital calls, distributions, financial position, cashflows, documents, PDF records, DDQs and data room access."}
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div
          className="preview-card"
          style={{ marginBottom: 18, padding: 22 }}
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Active Fund Context</p>
              <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
              {isInvestorRole ? (
                <>
                  <p style={{ margin: 0 }}>
                    Private investor access: <strong>Active</strong>
                  </p>
                  <p style={{ margin: "6px 0 0" }}>
                    Your portal is restricted to the fund and investor identities
                    granted to your signed-in account.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0 }}>
                    Full fund activation: <strong>{fundActivationStatus}</strong>
                    {fundActivatedAt
                      ? ` · Activated ${formatDateTime(fundActivatedAt)}`
                      : ""}
                    {fundActivatedBy ? ` by ${fundActivatedBy}` : ""}
                  </p>
                  <p style={{ margin: "6px 0 0" }}>
                    Investor Documents module:{" "}
                    <strong>{investorDocumentsModuleStatus}</strong>
                    {investorDocumentsModuleActivatedAt
                      ? ` · Activated ${formatDateTime(
                          investorDocumentsModuleActivatedAt
                        )}`
                      : ""}
                    {investorDocumentsModuleActivatedBy
                      ? ` by ${investorDocumentsModuleActivatedBy}`
                      : ""}
                  </p>
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {(!isInvestorRole || availableFunds.length > 1) && (
                <label style={{ display: "grid", gap: 6, minWidth: 270 }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
                    {isInvestorRole ? "My fund" : "Switch active fund"}
                  </span>
                  <select
                    aria-label="Select active fund"
                    disabled={!fundContextReady || loading}
                    onChange={(event) => setActiveFundName(event.target.value)}
                    style={{
                      background: "#0f172a",
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      borderRadius: 12,
                      color: "#f8fafc",
                      minHeight: 42,
                      padding: "0 12px",
                    }}
                    value={activeFundName}
                  >
                    {availableFunds.map((fundName) => (
                      <option key={fundName} value={fundName}>
                        {fundName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isInvestorRole && (
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  Open Fund Activation
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {isInvestorRole ? (
            <>
              {activeFundName} · Private LP view · Access limited to your entitled
              investor account, verified financial position and governed documents
            </>
          ) : (
            <>
              {activeFundName} ·{" "}
              {fullFundActive
                ? "Full Fund Active"
                : investorDocumentsModuleActive
                  ? "Investor Documents Active · Full OS not activated"
                  : fundActivationStatus}{" "}
              · Connected investor portal reading this fund&apos;s governed investors
              and canonical investor documents
            </>
          )}
        </div>

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investor Portal...</h2>
            <p>
              VENTIQ is reading migrated investors, commitments, documents,
              financial positions, PDF batches and investor portal records.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">
              <strong>Error:</strong> {errorMessage}
            </div>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          !investorPortalOperational && (
            <div className="preview-card">
              <p className="eyebrow">Activation Required</p>
              <h2>Investor Documents Portal is not active for {activeFundName}</h2>
              <div className="explain-box">
                This fund may either complete Full OS activation or activate the
                governed Investor Documents module independently. Scoped module
                activation does not mark unrelated portfolio, compliance or
                accounting workflows as Active.
              </div>
              {!isInvestorRole && (
                <div className="action-row">
                  <a
                    className="monitor-btn monitor-btn-primary"
                    href="/document-studio"
                  >
                    Open Document Studio
                  </a>
                  <a
                    className="monitor-btn monitor-btn-secondary"
                    href="/migration/activation"
                  >
                    Full Fund Activation
                  </a>
                </div>
              )}
            </div>
          )}

        {!loading &&
          !errorMessage &&
          investorPortalOperational && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">
                    {isInvestorRole ? "My Governed Investor Account" : "Verified Investor Layer"}
                  </p>
                  <h2>
                    {isInvestorRole
                      ? `Private investor view for ${activeFundName}`
                      : `Calculated investor position for ${activeFundName}`}
                  </h2>
                </div>
                {!isInvestorRole && (
                  <a
                    className="monitor-btn monitor-btn-secondary"
                    href="/migration/performance-calculations"
                  >
                    Open Calculation Engine
                  </a>
                )}
              </div>

              {financialVerification ? (
                <div className="explain-box">
                  Verified financial position · Calculation Engine v
                  {financialVerification.calculation_version || "-"} · as of {formatDate(
                    financialVerification.as_of_date || ""
                  )} · {financialVerification.controls_passed ?? 0}/
                  {financialVerification.controls_total ?? 0} reconciliation controls passed.
                  {isInvestorRole
                    ? " Your financial position is released only through your signed-in investor entitlement."
                    : " Fund Admin support view is reading the selected investor through the governed financial endpoint."}
                </div>
              ) : (
                <div className="explain-box">
                  {financialAccessMessage ||
                    (isInvestorRole
                      ? "Verified performance data is not available for this fund yet."
                      : calculationLoadMessage ||
                        "No completed verified calculation is available for this fund.")}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>{isInvestorRole ? "My Investor Account" : "Investor Access"}</h2>

              <div className="form-card">
                {isInvestorRole ? (
                  <>
                    <p className="eyebrow">Signed-in investor identity</p>
                    <div className="journal-preview">
                      <div className="journal-row">
                        <span>Investor</span>
                        <strong>{selectedInvestor?.name ?? "Resolving..."}</strong>
                      </div>
                      <div className="journal-row">
                        <span>Investor code</span>
                        <strong>{selectedInvestor?.investor_code ?? "-"}</strong>
                      </div>
                      <div className="journal-row">
                        <span>Entitlement</span>
                        <strong>
                          {investorEntitlements.length > 0
                            ? "Active · account locked"
                            : "Resolving"}
                        </strong>
                      </div>
                    </div>
                    <div className="logic-note">
                      Investor switching is disabled for LP users. VENTIQ resolves
                      this account from the signed-in user&apos;s active investor
                      entitlement and RLS-governed investor record.
                    </div>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Select investor to view portal records</p>

                    <label>Investor</label>
                    <select
                      value={selectedInvestorId}
                      onChange={(event) => {
                        setSelectedInvestorId(event.target.value);
                        setDocumentTypeFilter("All documents");
                      }}
                    >
                      {investors.map((investor) => (
                        <option key={investor.id} value={investor.id}>
                          {investor.investor_code
                            ? `${investor.investor_code} - `
                            : ""}
                          {investor.name}
                        </option>
                      ))}
                    </select>

                    <div className="logic-note">
                      Fund Admin support view can switch between governed investors.
                      LP users cannot use this selector and are locked to their own
                      entitlement.
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="preview-card">
              <h2>Welcome back, {selectedInvestor?.name ?? "Investor"}</h2>

              <div className="explain-box">
                VENTIQ brings together your governed investor identity, verified
                financial position, canonical documents and entitled portal records.
                Only approved server-released data is shown below.
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="#documents"
                >
                  View My Documents
                </a>

                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="#cashflows"
                >
                  View Cashflows
                </a>

                <a className="monitor-btn monitor-btn-secondary" href="/data-room">
                  Open Data Room
                </a>

                {!isInvestorRole && (
                  <a
                    className="monitor-btn monitor-btn-secondary"
                    href="/fundraising-ai"
                  >
                    Open IR Workspace
                  </a>
                )}
              </div>
            </div>

            {loadingInvestorData && (
              <div className="preview-card">
                <h2>Refreshing investor records...</h2>
                <p>
                  VENTIQ is preparing this investor&apos;s documents, financial
                  position and fund activity.
                </p>
              </div>
            )}

            {!loadingInvestorData && (
              <>
                <div className="impact-grid">
                  <div className="impact-card">
                    <h3>{formatCr(portalMetrics.displayedCommitment)}</h3>
                    <p>Total commitment</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatCr(portalMetrics.displayedCalled)}</h3>
                    <p>Capital called</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatCr(portalMetrics.displayedDistributed)}</h3>
                    <p>Distributed</p>
                  </div>

                  <div className="impact-card">
                    <h3>{formatCr(portalMetrics.displayedRemaining)}</h3>
                    <p>Remaining commitment</p>
                  </div>
                </div>

                <div className="impact-grid">
                  <div className="impact-card">
                    <h3>{formatCr(portalMetrics.displayedCurrentNav)}</h3>
                    <p>Current NAV</p>
                  </div>

                  <div className="impact-card">
                    <h3>{documents.length}</h3>
                    <p>Total documents</p>
                  </div>

                  <div className="impact-card">
                    <h3>{portalMetrics.storedDocuments.length}</h3>
                    <p>Download-ready PDFs</p>
                  </div>

                  <div className="impact-card">
                    {isInvestorRole ? (
                      <>
                        <h3>{investorEntitlements.length > 0 ? "Active" : "Pending"}</h3>
                        <p>Account access</p>
                      </>
                    ) : (
                      <>
                        <h3>{portalMetrics.documentReadinessScore}%</h3>
                        <p>Portal readiness</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="preview-card">
                  <h2>Investor Profile</h2>

                  <div className="journal-preview">
                    <div className="journal-row">
                      <span>Investor Name</span>
                      <strong>{selectedInvestor?.name ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Investor Code</span>
                      <strong>{selectedInvestor?.investor_code ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Email</span>
                      <strong>{selectedInvestor?.email ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Investor Type</span>
                      <strong>{selectedInvestor?.investor_type ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Country</span>
                      <strong>{selectedInvestor?.country ?? "-"}</strong>
                    </div>

                    <div className="journal-row">
                      <span>KYC Status</span>
                      <strong>
                        {getStatusIcon(selectedInvestor?.kyc_status)}{" "}
                        {selectedInvestor?.kyc_status ?? "-"}
                      </strong>
                    </div>

                    <div className="journal-row">
                      <span>Bank Status</span>
                      <strong>
                        {getStatusIcon(selectedInvestor?.bank_status)}{" "}
                        {selectedInvestor?.bank_status ?? "-"}
                      </strong>
                    </div>

                    {!isInvestorRole && (
                      <div className="journal-row">
                        <span>Imported investor universe</span>
                        <strong>{portalMetrics.importedInvestors}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="preview-card">
                  <h2>My Investments</h2>

                  {commitments.length === 0 && financialPosition && (
                    <div className="queue-grid">
                      <div className="queue-item">
                        <strong>{activeFundName}</strong>
                        <br />
                        Commitment: {formatCr(toCr(financialPosition.commitment_amount))}
                        <br />
                        Called: {formatCr(toCr(financialPosition.capital_called_till_date))}
                        <br />
                        Remaining: {formatCr(toCr(financialPosition.uncalled_capital))}
                        <br />
                        Class: {financialPosition.class_name ?? "-"}
                        <br />
                        Status: {financialPosition.status ?? "Calculated"}
                      </div>
                    </div>
                  )}

                  {commitments.length === 0 && !financialPosition && (
                    <div className="explain-box">
                      Verified commitment data is not available for this investor yet.
                    </div>
                  )}

                  {commitments.length > 0 && (
                    <div className="queue-grid">
                      {commitments.map((commitment) => (
                        <div key={commitment.id} className="queue-item">
                          <strong>{getCommitmentFundName(commitment)}</strong>
                          <br />
                          Commitment: {formatCr(toCr(commitment.commitment_amount))}
                          <br />
                          Called: {formatCr(toCr(commitment.called_amount))}
                          <br />
                          Remaining: {formatCr(toCr(commitment.unfunded_amount))}
                          <br />
                          Class: {commitment.class_name ?? "-"}
                          <br />
                          Status: {commitment.status ?? "active"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="preview-card">
                  <div className="section-heading-row">
                    <div>
                      <p className="eyebrow">Verified Calculation Engine Output</p>
                      <h2>Investor Performance Snapshot</h2>
                    </div>
                    <span className="status-pill">
                      {financialVerification
                        ? `v${financialVerification.calculation_version || "-"} · ${formatDate(
                            financialVerification.as_of_date || ""
                          )}`
                        : "Verified data pending"}
                    </span>
                  </div>

                  {!financialPosition && (
                    <div className="explain-box">
                      {financialAccessMessage ||
                        "Verified performance data is not available for this investor yet."}
                    </div>
                  )}

                  {financialPosition && (
                    <>
                      <div className="impact-grid">
                        <div className="impact-card">
                          <h3>{formatPercent(financialPosition.investor_irr)}</h3>
                          <p>Net IRR</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_dpi)}</h3>
                          <p>DPI</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_rvpi)}</h3>
                          <p>RVPI</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_tvpi)}</h3>
                          <p>TVPI</p>
                        </div>
                      </div>

                      <div className="impact-grid">
                        <div className="impact-card">
                          <h3>{formatCr(toCr(financialPosition.commitment_amount))}</h3>
                          <p>Commitment</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatCr(toCr(financialPosition.capital_called_till_date))}</h3>
                          <p>Paid-in capital</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatCr(toCr(financialPosition.uncalled_capital))}</h3>
                          <p>Uncalled commitment</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatCr(toCr(financialPosition.current_nav))}</h3>
                          <p>Allocated NAV</p>
                        </div>
                      </div>

                      <div className="logic-note">
                        Verified source: Completed Calculation Engine run · {
                          financialVerification?.controls_passed ?? 0
                        }/{financialVerification?.controls_total ?? 0} reconciliation controls Pass.
                        Investor-role access is entitlement-scoped and audited server-side.
                      </div>
                    </>
                  )}
                </div>

                {!isInvestorRole && (
                  <>
                <div className="preview-card">
                  <h2>Investor Document Readiness</h2>

                  <div className="journal-preview">
                    <div className="journal-row">
                      <span>Published investor documents</span>
                      <strong>{documents.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Download-ready PDFs</span>
                      <strong>{portalMetrics.storedDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Portal-ready records</span>
                      <strong>{portalMetrics.portalReadyDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Capital call notices</span>
                      <strong>{portalMetrics.capitalCallDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Distribution notices</span>
                      <strong>{portalMetrics.distributionDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Statements / SOA</span>
                      <strong>{portalMetrics.statementDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>Tax documents</span>
                      <strong>{portalMetrics.taxDocuments.length}</strong>
                    </div>

                    <div className="journal-row">
                      <span>PDF review queue</span>
                      <strong>{portalMetrics.pdfReview}</strong>
                    </div>
                  </div>
                </div>

                <div className="preview-card" id="missing-documents">
                  <h2>Missing Document Signals</h2>

                  {portalMetrics.missingDocumentTypes.length === 0 && (
                    <div className="explain-box">
                      Core investor document types are available for this
                      investor.
                    </div>
                  )}

                  {portalMetrics.missingDocumentTypes.length > 0 && (
                    <div className="queue-grid">
                      {portalMetrics.missingDocumentTypes.map((documentType) => (
                        <div className="queue-item" key={documentType}>
                          🔴 <strong>{documentType}</strong>
                          <br />
                          Not available in this investor&apos;s current document
                          library.
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                  </>
                )}

                <div className="preview-card" id="documents">
                  <h2>
                    {isInvestorRole ? "My Documents" : "Investor Document Center"}
                  </h2>

                  <p className="section-copy">
                    Governed investor documents released for this account. PDF
                    access uses short-lived signed URLs; permanent storage paths
                    are never exposed in the portal.
                  </p>

                  {documentListMessage && (
                    <div className="explain-box" style={{ marginBottom: "14px" }}>
                      {documentListMessage}
                    </div>
                  )}

                  {documentAccessMessage && (
                    <div className="explain-box" style={{ marginBottom: "14px" }}>
                      {documentAccessMessage}
                    </div>
                  )}

                  <div className="form-card">
                    <label>Document Type</label>
                    <select
                      value={documentTypeFilter}
                      onChange={(event) =>
                        setDocumentTypeFilter(event.target.value)
                      }
                    >
                      {documentTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
<div className="portal-document-kit-grid">
  {investorDocumentKits
    .filter(
      (kit) =>
        !isInvestorRole ||
        documents.some(
          (documentRecord) =>
            getInvestorDocumentGroup(documentRecord) === kit.label
        )
    )
    .map((kit) => {
    const kitDocuments = documents.filter(
      (documentRecord) => getInvestorDocumentGroup(documentRecord) === kit.label
    );

    const storedKitDocuments = kitDocuments.filter(hasStoredPdf);

    return (
      <button
        className={`portal-document-kit-card ${
          documentTypeFilter === kit.label ? "active" : ""
        }`}
        key={kit.label}
        onClick={() => setDocumentTypeFilter(kit.label)}
        type="button"
      >
        <span>{getDocumentIcon(kit.label)} {kit.label}</span>
        <strong>{kitDocuments.length}</strong>
        <p>{kit.description}</p>
        <em>{storedKitDocuments.length} PDF ready</em>
      </button>
    );
  })}
</div>
                  {documents.length === 0 && !documentListMessage && (
                    <div className="explain-box">
                      {isInvestorRole
                        ? "No published investor documents are available for your account yet."
                        : "No governed investor documents are currently available for the selected investor."}
                    </div>
                  )}

                  {documents.length > 0 && filteredDocuments.length === 0 && (
                    <div className="explain-box">
                      No documents found for the selected filter.
                    </div>
                  )}

                  {filteredDocuments.length > 0 && (
                    <div
                      style={{
                        overflowX: "auto",
                        overflowY: "auto",
                        maxHeight: "560px",
                        border: "1px solid rgba(148, 163, 184, 0.22)",
                        borderRadius: "18px",
                        marginTop: "18px",
                      }}
                    >
                      <table
                        className="investor-table"
                        style={{
                          minWidth: "1150px",
                          width: "100%",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Document</th>
                            <th>Type</th>
                            {!isInvestorRole && <th>Fund</th>}
                            {!isInvestorRole && <th>Amount</th>}
                            <th>Period</th>
                            {!isInvestorRole && <th>Portal</th>}
                            {!isInvestorRole && <th>Email</th>}
                            <th>PDF</th>
                            <th>Date</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredDocuments.map((documentRecord) => (
                            <tr key={documentRecord.id}>
                              <td style={{ maxWidth: "260px" }}>
                                <strong>
                                  {getDocumentIcon(
                                    getDocumentType(documentRecord)
                                  )}{" "}
                                  {getDocumentTitle(documentRecord)}
                                </strong>
                              </td>

                              <td>{getDocumentType(documentRecord)}</td>

                              {!isInvestorRole && (
                                <td>{documentRecord.fund_name ?? "-"}</td>
                              )}

                              {!isInvestorRole && (
                                <td>
                                  {documentRecord.amount
                                    ? formatCr(toCr(documentRecord.amount))
                                    : "-"}
                                </td>
                              )}

                              <td>{documentRecord.period_label ?? "-"}</td>

                              {!isInvestorRole && (
                                <td>
                                  <span className="small-pill">
                                    {documentRecord.portal_status ??
                                      documentRecord.migration_status ??
                                      documentRecord.status ??
                                      "Published"}
                                  </span>
                                </td>
                              )}

                              {!isInvestorRole && (
                                <td>
                                  <span className="small-pill">
                                    {documentRecord.email_status ?? "not sent"}
                                  </span>
                                </td>
                              )}

                              <td>
                                <span className="small-pill">
                                  {hasStoredPdf(documentRecord)
                                    ? "Stored"
                                    : "Metadata only"}
                                </span>
                              </td>

                              <td>{formatDate(getDocumentDate(documentRecord))}</td>

                              <td>
                                {hasStoredPdf(documentRecord) ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                      minWidth: "190px",
                                    }}
                                  >
                                    <button
                                      className="monitor-btn monitor-btn-primary"
                                      disabled={
                                        documentAccessBusyKey ===
                                        `${documentRecord.id}:view`
                                      }
                                      onClick={() =>
                                        accessInvestorDocument(documentRecord, "view")
                                      }
                                      type="button"
                                      style={{ minHeight: "38px", padding: "8px 12px" }}
                                    >
                                      {documentAccessBusyKey ===
                                      `${documentRecord.id}:view`
                                        ? "Opening..."
                                        : "View PDF"}
                                    </button>

                                    {documentDownloadAllowed ? (
                                      <button
                                        className="monitor-btn monitor-btn-secondary"
                                        disabled={
                                          documentAccessBusyKey ===
                                          `${documentRecord.id}:download`
                                        }
                                        onClick={() =>
                                          accessInvestorDocument(
                                            documentRecord,
                                            "download"
                                          )
                                        }
                                        type="button"
                                        style={{ minHeight: "38px", padding: "8px 12px" }}
                                      >
                                        {documentAccessBusyKey ===
                                        `${documentRecord.id}:download`
                                          ? "Preparing..."
                                          : "Download"}
                                      </button>
                                    ) : (
                                      <span className="small-pill">View only</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="small-pill">Record only</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {documents.length > 0 && (
                    <div className="logic-note">
                      {isInvestorRole
                        ? `Document identity is locked to your signed-in entitlement. ${
                            documentDownloadAllowed
                              ? "View and download permissions are active."
                              : "View permission is active; download permission is restricted."
                          }`
                        : "Fund Admin support view uses the governed Investor Documents endpoint. PDF View/Download continues through the audited secure-access endpoint."}
                    </div>
                  )}
                </div>

                <div className="preview-card" id="cashflows">
                  <h2>Capital Calls &amp; Distributions</h2>
                  <p className="section-copy">
                    Entitlement-scoped investor cashflow history released through
                    the governed VENTIQ server layer.
                  </p>

                  {cashflowAccessMessage && (
                    <div className="explain-box">{cashflowAccessMessage}</div>
                  )}

                  {!cashflowAccessMessage && (
                    <>
                      <div className="impact-grid">
                        <div className="impact-card">
                          <h3>{formatInr(cashflowSummary?.total_called)}</h3>
                          <p>Total called</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatInr(cashflowSummary?.total_received)}</h3>
                          <p>Total received</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatInr(cashflowSummary?.total_outstanding)}</h3>
                          <p>Outstanding</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatInr(cashflowSummary?.total_distributed)}</h3>
                          <p>Total distributed</p>
                        </div>
                      </div>

                      <div style={{ marginTop: "24px" }}>
                        <h3>Capital Calls</h3>

                        {capitalCalls.length === 0 ? (
                          <div className="explain-box">
                            No governed capital-call records are available for this
                            investor yet.
                          </div>
                        ) : (
                          <div
                            style={{
                              overflowX: "auto",
                              border: "1px solid rgba(148, 163, 184, 0.22)",
                              borderRadius: "18px",
                              marginTop: "14px",
                            }}
                          >
                            <table
                              className="investor-table"
                              style={{ minWidth: "1100px", width: "100%" }}
                            >
                              <thead>
                                <tr>
                                  <th>Capital Call</th>
                                  <th>Call Date</th>
                                  <th>Due Date</th>
                                  <th>Called</th>
                                  <th>Received</th>
                                  <th>Outstanding</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {capitalCalls.map((call) => (
                                  <tr key={call.capital_call_code}>
                                    <td>
                                      <strong>{
                                        call.call_name || call.capital_call_code
                                      }</strong>
                                      <br />
                                      <span className="table-subtext">
                                        {call.capital_call_code}
                                      </span>
                                    </td>
                                    <td>{formatDate(call.call_date)}</td>
                                    <td>{formatDate(call.due_date)}</td>
                                    <td>{formatInr(call.called_amount)}</td>
                                    <td>{formatInr(call.amount_received)}</td>
                                    <td>{formatInr(call.outstanding_amount)}</td>
                                    <td>
                                      <span className="small-pill">
                                        {call.receipt_status ||
                                          call.allocation_status ||
                                          "Recorded"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: "30px" }}>
                        <h3>Distribution History</h3>

                        {distributionHistory.length === 0 ? (
                          <div className="explain-box">
                            No governed distribution records are available for this
                            investor yet.
                          </div>
                        ) : (
                          <div
                            style={{
                              overflowX: "auto",
                              border: "1px solid rgba(148, 163, 184, 0.22)",
                              borderRadius: "18px",
                              marginTop: "14px",
                            }}
                          >
                            <table
                              className="investor-table"
                              style={{ minWidth: "1050px", width: "100%" }}
                            >
                              <thead>
                                <tr>
                                  <th>Distribution</th>
                                  <th>Payment Date</th>
                                  <th>Gross</th>
                                  <th>Return of Capital</th>
                                  <th>Tax Withheld</th>
                                  <th>Net Distribution</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {distributionHistory.map((distribution) => (
                                  <tr key={distribution.distribution_code}>
                                    <td>
                                      <strong>{
                                        distribution.distribution_name ||
                                        distribution.distribution_code
                                      }</strong>
                                      <br />
                                      <span className="table-subtext">
                                        {distribution.distribution_code}
                                      </span>
                                    </td>
                                    <td>{formatDate(distribution.payment_date)}</td>
                                    <td>
                                      {formatInr(
                                        distribution.gross_distribution
                                      )}
                                    </td>
                                    <td>
                                      {formatInr(
                                        distribution.return_of_capital
                                      )}
                                    </td>
                                    <td>
                                      {formatInr(distribution.tax_withheld)}
                                    </td>
                                    <td>
                                      {formatInr(
                                        distribution.net_distribution
                                      )}
                                    </td>
                                    <td>
                                      <span className="small-pill">
                                        {distribution.payment_status || "Recorded"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: "30px" }}>
                        <h3>Investor Cashflow Timeline</h3>

                        {cashflows.length === 0 ? (
                          <div className="explain-box">
                            No released investor cashflow activity is available yet.
                          </div>
                        ) : (
                          <div
                            style={{
                              overflowX: "auto",
                              border: "1px solid rgba(148, 163, 184, 0.22)",
                              borderRadius: "18px",
                              marginTop: "14px",
                            }}
                          >
                            <table
                              className="investor-table"
                              style={{ minWidth: "900px", width: "100%" }}
                            >
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Direction</th>
                                  <th>Amount</th>
                                  <th>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cashflows.map((cashflow) => (
                                  <tr key={cashflow.id}>
                                    <td>{formatDate(cashflow.cashflow_date)}</td>
                                    <td>{cashflow.cashflow_type ?? "-"}</td>
                                    <td>
                                      <span className="small-pill">
                                        {cashflow.direction ?? "-"}
                                      </span>
                                    </td>
                                    <td>{formatInr(cashflow.amount)}</td>
                                    <td>{cashflow.description ?? "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="preview-card" id="ddq">
                  <h2>Data Room & DDQ Access</h2>

                  <div className="impact-grid">
                    <div className="impact-card">
                      <h3>{dataRoomDocuments.length}</h3>
                      <p>Data room documents</p>
                    </div>

                    <div className="impact-card">
                      <h3>{dataRoomEngagementEvents.length}</h3>
                      <p>Engagement events</p>
                    </div>

                    <div className="impact-card">
                      <h3>{portalMetrics.openQuestions}</h3>
                      <p>Open questions</p>
                    </div>

                    <div className="impact-card">
                      <h3>{portalMetrics.answeredQuestions}</h3>
                      <p>Answered questions</p>
                    </div>
                  </div>

                  {dataRoomQuestions.length === 0 && (
                    <div className="explain-box">
                      No investor-specific DDQ questions found for this
                      investor.
                    </div>
                  )}

                  {dataRoomQuestions.length > 0 && (
                    <div className="journal-preview">
                      {dataRoomQuestions.slice(0, 6).map((question) => (
                        <div className="journal-row" key={question.id}>
                          <span>
                            {question.category ?? "DDQ"}
                            <br />
                            {question.document_name ??
                              question.question ??
                              "Investor question"}
                          </span>
                          <strong>{question.status ?? "Open"}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="action-row">
                    <a className="monitor-btn monitor-btn-primary" href="/data-room">
                      Open Investor Data Room
                    </a>

                    <a
                      className="monitor-btn monitor-btn-secondary"
                      href="/fundraising-ai"
                    >
                      Open IR Workspace
                    </a>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>Investor Portal Control Queue</h2>

                  <div className="queue-grid">
                    {investorActions.map((action) => (
                      <a
                        key={action.title}
                        className="queue-item"
                        href={action.href}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <strong>{action.title}</strong>
                        <br />
                        {action.value}
                        <br />
                        Priority: {action.priority}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="knowledge-grid">
                  <div className="preview-card">
                    <h2>Recent Investor Activity</h2>

                    {investorActivityEvents.length === 0 && (
                      <div className="explain-box">
                        No investor activity found yet.
                      </div>
                    )}

                    {investorActivityEvents.length > 0 && (
                      <div className="audit-timeline">
                        {investorActivityEvents.slice(0, 12).map((event) => (
                          <div key={event.id} className="audit-item">
                            <strong>{formatDateTime(event.time)}</strong>{" "}
                            {getActivityIcon(event.status)} {event.title}
                            <br />
                            <span>
                              {event.module} — {event.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ai-side-panel">
                    <h2>Ask VENTIQ AI</h2>

                    <div className="chat-message">
                      Ask: “Show my latest capital call notice.”
                    </div>

                    <div className="chat-message">
                      Ask: “Download my latest distribution notice.”
                    </div>

                    <div className="chat-message">
                      Ask: “How much commitment remains?”
                    </div>

                    <div className="chat-message">
                      Ask: “Show my tax documents.”
                    </div>

                    <div className="chat-message">
                      Ask: “Show my data room questions.”
                    </div>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>AI Investor Answer Preview</h2>

                  <div className="explain-box">
                    <strong>Question:</strong> What is my current fund position?
                    <br />
                    <br />
                    <strong>VENTIQ AI:</strong>{" "}
                    {financialPosition
                      ? `Your current commitment is ${formatCr(
                          portalMetrics.displayedCommitment
                        )}. Capital called till date is ${formatCr(
                          portalMetrics.displayedCalled
                        )}, uncalled capital is ${formatCr(
                          portalMetrics.displayedRemaining
                        )}, distributions till date are ${formatCr(
                          portalMetrics.displayedDistributed
                        )}, current NAV is ${formatCr(
                          portalMetrics.displayedCurrentNav
                        )}, and your current IRR is ${formatPercent(
                          financialPosition.investor_irr
                        )}.`
                      : documents[0]
                      ? `Your latest document is ${getDocumentTitle(
                          documents[0]
                        )}. ${
                          hasStoredPdf(documents[0])
                            ? "The PDF is available in your document library."
                            : "The document record is available, but PDF storage or final download access is still pending."
                        }`
                      : "No investor financial position or documents are available yet."}
                  </div>
                </div>

                <div className="preview-card">
                  <h2>Quick Actions</h2>

                  <div className="queue-grid">
                    <a className="queue-item" href="#documents">
                      📄 Download SOA / Statements
                    </a>

                    <a className="queue-item" href="#documents">
                      📑 View Tax Certificates
                    </a>

                    <a className="queue-item" href="#documents">
                      💰 Capital Call Notices
                    </a>

                    <a className="queue-item" href="#documents">
                      📊 Performance Reports
                    </a>

                    <a className="queue-item" href="/data-room">
                      🗂️ Open Data Room
                    </a>

                    <a className="queue-item" href="#ddq">
                      ❓ View DDQ Updates
                    </a>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>Connected Investor Portal Loop</h2>

                  <div className="queue-grid">
                    <div className="queue-item">Investor Master Imported</div>
                    <div className="queue-item">Commitments Mapped</div>
                    <div className="queue-item">Financial Position Published</div>
                    <div className="queue-item">Cashflows Published</div>
                    <div className="queue-item">PDFs Classified</div>
                    <div className="queue-item">Documents Published</div>
                    <div className="queue-item">Investor Portal Updated</div>
                    <div className="queue-item">Data Room Connected</div>
                    <div className="queue-item">DDQ Trail Available</div>
                    <div className="queue-item">IR Workspace Updated</div>
                  </div>

                  <div className="explain-box">
                    This is the investor-facing side of the same VENTIQ
                    operating layer. Internal migration, finance, compliance,
                    document and IR workflows now convert into a clean portal
                    view for each investor.
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}