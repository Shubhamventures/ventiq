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
  source_batch_id: string | null;
  updated_at: string | null;
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
  uploaded_at?: string | null;
  published_at?: string | null;
  generated_at?: string | null;
  created_at?: string | null;
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
  investor_rvpi: number | null;
  investor_dpi: number | null;
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

function getDocumentUrl(documentRecord: InvestorDocument) {
  return documentRecord.storage_url || documentRecord.file_url || "";
}

function hasStoredPdf(documentRecord: InvestorDocument) {
  return Boolean(
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
    loading: authLoading,
  } = useVentiqAuth();

  const availableFunds = useMemo(() => {
    const authorisedFunds = Array.from(
      new Set(
        fundAccess
          .filter(
            (access) =>
              access.role === "investor" &&
              access.status === "Active" &&
              access.can_view &&
              access.fund_name?.trim()
          )
          .map((access) => access.fund_name.trim())
      )
    ).sort();

    return authorisedFunds.length > 0
      ? authorisedFunds
      : [activeFundName];
  }, [fundAccess, activeFundName]);

  const [fundActivationStatus, setFundActivationStatus] =
    useState("Setup Not Started");
  const [fundActivatedAt, setFundActivatedAt] = useState("");
  const [fundActivatedBy, setFundActivatedBy] = useState("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [financialPosition, setFinancialPosition] =
    useState<InvestorFinancialPosition | null>(null);
  const [cashflows, setCashflows] = useState<InvestorCashflow[]>([]);

  const [latestInvestorBatch, setLatestInvestorBatch] =
    useState<DataRow | null>(null);
  const [latestPdfBatch, setLatestPdfBatch] = useState<DataRow | null>(null);
  const [latestComplianceBatch, setLatestComplianceBatch] =
    useState<DataRow | null>(null);
  const [latestCalculationRun, setLatestCalculationRun] =
    useState<DataRow | null>(null);
  const [calculatedInvestorMetrics, setCalculatedInvestorMetrics] = useState<
    DataRow[]
  >([]);
  const [sourceBatch, setSourceBatch] = useState("");
  const [calculationLoadMessage, setCalculationLoadMessage] = useState("");

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

  useEffect(() => {
    if (!fundContextReady || authLoading || availableFunds.length === 0) {
      return;
    }

    if (
      activeRole === "investor" &&
      !availableFunds.some(
        (fundName) =>
          fundName.trim().toLowerCase() === activeFundName.trim().toLowerCase()
      )
    ) {
      setActiveFundName(availableFunds[0]);
    }
  }, [
    activeFundName,
    activeRole,
    authLoading,
    availableFunds,
    fundContextReady,
    setActiveFundName,
  ]);

  useEffect(() => {
    async function loadInvestors() {
      if (!fundContextReady || authLoading) return;

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

      if (activeRole !== "investor") {
        setErrorMessage(
          "This workspace requires an authenticated Investor role."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setCalculationLoadMessage("");
      setLatestCalculationRun(null);
      setCalculatedInvestorMetrics([]);
      setSourceBatch("");

      try {
        const db = supabase as any;

        const [activationResult, investorsResult, commitmentsResult] =
          await Promise.all([
            db
              .from("fund_activation_status")
              .select(
                "status, activated_at, activated_by, readiness_score, approved_batch_map"
              )
              .eq("fund_name", activeFundName)
              .maybeSingle(),

            db
              .from("investor_master")
              .select("*")
              .eq("fund_name", activeFundName)
              .order("updated_at", { ascending: false }),

            db
              .from("fund_commitments")
              .select("*")
              .eq("fund_name", activeFundName),
          ]);

        if (activationResult.error) {
          throw new Error(activationResult.error.message);
        }

        if (investorsResult.error) {
          throw new Error(investorsResult.error.message);
        }

        if (commitmentsResult.error) {
          throw new Error(commitmentsResult.error.message);
        }

        if (activationResult.data) {
          setFundActivationStatus(
            String(activationResult.data.status ?? "Setup Not Started")
          );
          setFundActivatedAt(
            String(activationResult.data.activated_at ?? "")
          );
          setFundActivatedBy(
            String(activationResult.data.activated_by ?? "")
          );
        } else {
          setFundActivationStatus("Setup Not Started");
          setFundActivatedAt("");
          setFundActivatedBy("");
        }

        const rawInvestorRows = (investorsResult.data ?? []) as DataRow[];
        const seenInvestorCodes = new Set<string>();

        const investorData = rawInvestorRows
          .map((investor) => ({
            id: getString(investor, ["id"], ""),
            investor_code:
              getString(investor, ["investor_code"], "") || null,
            name: getString(
              investor,
              ["investor_name", "name"],
              "Unknown Investor"
            ),
            investor_type:
              getString(investor, ["investor_type", "type"], "") || null,
            email: getString(investor, ["email"], "") || null,
            country:
              getString(investor, ["country"], "India") || "India",
            kyc_status:
              getString(investor, ["kyc_status"], "") || null,
            bank_status:
              getString(investor, ["bank_status"], "") || null,
            source_batch_id:
              getString(investor, ["source_batch_id"], "") || null,
            updated_at:
              getString(
                investor,
                ["updated_at", "created_at"],
                ""
              ) || null,
            source: "migration" as const,
          }))
          .filter((investor) => {
            const code = normalizeText(investor.investor_code);

            if (!code || seenInvestorCodes.has(code)) {
              return false;
            }

            seenInvestorCodes.add(code);
            return true;
          });

        setInvestors(investorData);

        const investorIdFromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("investorId")
            : "";

        const investorCodeFromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("investorCode")
            : "";

        const investorFromUrl = investorData.find(
          (investor) =>
            (investorIdFromUrl && investor.id === investorIdFromUrl) ||
            (investorCodeFromUrl &&
              investor.investor_code === investorCodeFromUrl)
        );

        const recommendedInvestor = investorFromUrl ?? investorData[0] ?? null;

        setSelectedInvestorId(recommendedInvestor?.id ?? "");
        setSourceBatch(recommendedInvestor?.source_batch_id ?? "");

        const commitmentRows = (commitmentsResult.data ?? []) as DataRow[];

        const currentCommitmentRows = recommendedInvestor?.source_batch_id
          ? commitmentRows.filter(
              (row) =>
                getString(row, ["source_batch_id"], "") ===
                recommendedInvestor.source_batch_id
            )
          : commitmentRows;

        const totalCommitment = currentCommitmentRows.reduce(
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
          id: recommendedInvestor?.source_batch_id ?? "",
          total_records: investorData.length,
          total_commitment: totalCommitment,
          created_at: recommendedInvestor?.updated_at ?? "",
        });

        // LPs should never receive internal migration/compliance diagnostics.
        setLatestPdfBatch({
          id: recommendedInvestor?.source_batch_id ?? "",
          total_files: 0,
          ready_files: 0,
          review_files: 0,
          unmatched_files: 0,
        });

        setLatestComplianceBatch({
          id: recommendedInvestor?.source_batch_id ?? "",
          total_items: 0,
          evidence_available_count: 0,
          pending_review_count: 0,
        });

        setDataRoomDocuments([]);
        setDataRoomEngagementEvents([]);
        setDataRoomQuestions([]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load investor portal.";

        setErrorMessage(message);
        setInvestors([]);
        setSelectedInvestorId("");
        setSourceBatch("");
      } finally {
        setLoading(false);
      }
    }

    loadInvestors();
  }, [
    activeFundName,
    activeRole,
    authLoading,
    fundContextReady,
    session?.access_token,
  ]);

  useEffect(() => {
    async function loadInvestorPortalData() {
      if (!selectedInvestorId || !supabase) return;

      const selectedInvestor = investors.find(
        (investor) => investor.id === selectedInvestorId
      );

      if (!selectedInvestor || !selectedInvestor.investor_code) return;

      setLoadingInvestorData(true);
      setErrorMessage("");
      setCalculationLoadMessage("");

      try {
        const db = supabase as any;
        const investorCode = selectedInvestor.investor_code;
        const investorSourceBatch = selectedInvestor.source_batch_id ?? "";

        let commitmentQuery = db
          .from("fund_commitments")
          .select("*")
          .eq("fund_name", activeFundName)
          .eq("investor_code", investorCode);

        let cashflowQuery = db
          .from("investor_cashflows")
          .select("*")
          .eq("fund_name", activeFundName)
          .eq("investor_code", investorCode)
          .order("cashflow_date", { ascending: false });

        if (investorSourceBatch) {
          commitmentQuery = commitmentQuery.eq(
            "source_batch_id",
            investorSourceBatch
          );

          cashflowQuery = cashflowQuery.eq(
            "source_batch_id",
            investorSourceBatch
          );
        }

        const [
          commitmentResult,
          documentResult,
          cashflowResult,
          performanceResult,
        ] = await Promise.all([
          commitmentQuery,

          db
            .from("investor_documents")
            .select("*")
            .eq("fund_name", activeFundName)
            .eq("investor_code", investorCode)
            .order("published_at", { ascending: false }),

          cashflowQuery,

          db
            .from("investor_performance_metrics")
            .select("*")
            .eq("fund_name", activeFundName)
            .eq("investor_code", investorCode)
            .order("as_of_date", { ascending: false })
            .order("updated_at", { ascending: false }),
        ]);

        if (commitmentResult.error) {
          throw new Error(commitmentResult.error.message);
        }

        if (cashflowResult.error) {
          throw new Error(cashflowResult.error.message);
        }

        if (performanceResult.error) {
          throw new Error(performanceResult.error.message);
        }

        const commitmentRows = (commitmentResult.data ?? []) as DataRow[];

        const normalizedCommitments: Commitment[] = commitmentRows.map(
          (row) => {
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
              investor_id: getString(
                row,
                ["investor_id"],
                selectedInvestorId
              ),
              fund_name: getString(
                row,
                ["fund_name"],
                activeFundName
              ),
              class_name:
                getString(row, ["class_name"], "") || null,
              commitment_amount: commitmentAmount,
              called_amount:
                paidInAmount > 0
                  ? paidInAmount
                  : Math.max(
                      commitmentAmount - uncalledAmount,
                      0
                    ),
              unfunded_amount: uncalledAmount,
              status:
                getString(
                  row,
                  ["commitment_status", "status"],
                  "Active"
                ) || null,
            };
          }
        );

        setCommitments(normalizedCommitments);

        const investorDocuments = documentResult.error
          ? []
          : ((documentResult.data ?? []) as unknown as InvestorDocument[]);

        setDocuments(investorDocuments);

        const performanceRows =
          (performanceResult.data ?? []) as DataRow[];

        const investorMetric = performanceRows[0];

        setCalculatedInvestorMetrics(
          investorMetric ? [investorMetric] : []
        );

        if (investorMetric) {
          const paidInCapital = getNumber(
            investorMetric,
            ["paid_in_capital"]
          );

          const netDistributions = getNumber(
            investorMetric,
            ["net_distributions", "total_distributions"]
          );

          const allocatedNav = getNumber(
            investorMetric,
            ["allocated_nav"]
          );

          const asOfDate = getString(
            investorMetric,
            ["as_of_date"],
            ""
          );

          const updatedAt = getString(
            investorMetric,
            ["updated_at", "created_at"],
            ""
          );

          const calculationRunId = getString(
            investorMetric,
            ["calculation_run_id"],
            ""
          );

          setLatestCalculationRun({
            calculation_run_id: calculationRunId,
            as_of_date: asOfDate,
            completed_at: updatedAt,
          });

          setFinancialPosition({
            id: getString(
              investorMetric,
              ["id"],
              selectedInvestor.investor_code ||
                selectedInvestorId
            ),
            investor_id: selectedInvestorId,
            investor_code: selectedInvestor.investor_code,
            investor_name: selectedInvestor.name,
            email: selectedInvestor.email,
            fund_name: activeFundName,
            class_name:
              getString(investorMetric, ["class_name"], "") || null,
            commitment_amount: getNumber(
              investorMetric,
              ["commitment_amount"]
            ),
            capital_called_till_date: paidInCapital,
            uncalled_capital: getNumber(
              investorMetric,
              ["uncalled_commitment"]
            ),
            distributions_till_date: netDistributions,
            setup_fee: 0,
            management_fee: 0,
            net_contributed: Math.max(
              paidInCapital - netDistributions,
              0
            ),
            current_nav: allocatedNav,
            investor_irr: getNumber(
              investorMetric,
              ["net_irr"]
            ),
            investor_rvpi: getNumber(
              investorMetric,
              ["rvpi"]
            ),
            investor_dpi: getNumber(
              investorMetric,
              ["dpi"]
            ),
            investor_tvpi: getNumber(
              investorMetric,
              ["tvpi"]
            ),
            status:
              getString(
                investorMetric,
                ["calculation_status"],
                "Calculated"
              ) || null,
            created_at: updatedAt || null,
          });
        } else {
          setLatestCalculationRun(null);
          setFinancialPosition(null);
          setCalculationLoadMessage(
            "No verified investor performance metric is available yet."
          );
        }

        const investorCashflows = (
          (cashflowResult.data ?? []) as DataRow[]
        )
          .slice(0, 20)
          .map(
            (row) =>
              ({
                id: getString(
                  row,
                  ["id", "cashflow_code"],
                  ""
                ),
                investor_id:
                  getString(
                    row,
                    ["investor_id"],
                    selectedInvestorId
                  ) || null,
                investor_code:
                  getString(
                    row,
                    ["investor_code"],
                    ""
                  ) || null,
                investor_name:
                  getString(
                    row,
                    ["investor_name"],
                    selectedInvestor.name
                  ) || null,
                fund_name:
                  getString(
                    row,
                    ["fund_name"],
                    activeFundName
                  ) || null,
                cashflow_date:
                  getString(
                    row,
                    ["cashflow_date"],
                    ""
                  ) || null,
                cashflow_type:
                  getString(
                    row,
                    ["cashflow_type"],
                    "Cashflow"
                  ) || null,
                amount: getNumber(
                  row,
                  ["amount", "cashflow_amount"]
                ),
                direction:
                  getString(row, ["direction"], "") || null,
                description:
                  getString(
                    row,
                    ["description", "remarks"],
                    ""
                  ) || null,
              } as InvestorCashflow)
          );

        setCashflows(investorCashflows);
        setSourceBatch(investorSourceBatch);

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
        setFinancialPosition(null);
        setCashflows([]);
        setLatestCalculationRun(null);
        setCalculatedInvestorMetrics([]);
      } finally {
        setLoadingInvestorData(false);
      }
    }

    loadInvestorPortalData();
  }, [
    selectedInvestorId,
    activeFundName,
    investors,
  ]);

  const selectedInvestor = investors.find(
    (investor) => investor.id === selectedInvestorId
  );


  const calculationSummary = useMemo(() => {
    return {
      asOfDate: getString(
        latestCalculationRun ?? undefined,
        ["as_of_date"],
        ""
      ),
      calculationRunId: getString(
        latestCalculationRun ?? undefined,
        ["calculation_run_id"],
        ""
      ),
    };
  }, [latestCalculationRun]);

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
  ).filter((group) => group && group !== "Other Documents");

  return [
    "All documents",
    ...standardGroups,
    ...actualGroups.filter((group) => !standardGroups.includes(group)),
    "Other Documents",
  ];
}, [documents]);

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
        title: "View cashflow history",
        value: `${cashflows.length} cashflow item(s)`,
        priority: cashflows.length > 0 ? "Ready" : "Pending",
        href: "#cashflows",
      },
      {
        title: "Open data room",
        value: `${dataRoomDocuments.length} data room document(s)`,
        priority: "Live",
        href: "/data-room",
      },
    ];
  }, [documents, portalMetrics, cashflows, dataRoomDocuments]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Experience</p>
            <h1>Investor Portal</h1>
            <p>
              One clean investor-facing view for commitments, capital calls,
              distributions, financial position, cashflows, documents, PDF
              records, DDQs and data room access.
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
              <p style={{ margin: 0 }}>
                Activation status: <strong>{fundActivationStatus}</strong>
                {fundActivatedAt
                  ? ` · Activated ${formatDateTime(fundActivatedAt)}`
                  : ""}
                {fundActivatedBy ? ` by ${fundActivatedBy}` : ""}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {availableFunds.length > 1 ? (
                <label style={{ display: "grid", gap: 6, minWidth: 270 }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
                    My fund
                  </span>
                  <select
                    aria-label="Select investor fund"
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
              ) : (
                <span className="status-pill">
                  Investor access · Authenticated
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="sample-data-ribbon">
          {activeFundName} · {fundActivationStatus} · Connected investor portal
          reading this fund&apos;s investors, commitments, cashflows, documents
          and DDQ records
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
          fundActivationStatus !== "Active" && (
            <div className="preview-card">
              <p className="eyebrow">Activation Required</p>
              <h2>{activeFundName} is not active across VENTIQ</h2>
              <div className="explain-box">
                The Investor Portal is locked because this fund has not completed
                controlled activation. Complete data validation and maker-checker
                approval before publishing investor balances, cashflows, notices
                and documents from the operational data layer.
              </div>
              <div className="explain-box">
                Investor access will become available after the fund administrator
                completes the controlled activation process.
              </div>
            </div>
          )}

        {!loading &&
          !errorMessage &&
          fundActivationStatus === "Active" && (
          <>
            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Verified Investor Layer</p>
                  <h2>Your calculated position in {activeFundName}</h2>
                </div>
                <span className="status-pill">
                  RLS isolated · Investor only
                </span>
              </div>

              {latestCalculationRun ? (
                <div className="explain-box">
                  Verified investor performance as of{" "}
                  {formatDate(calculationSummary.asOfDate)}. VENTIQ loads only
                  financial records explicitly entitled to this authenticated
                  investor login
                  {sourceBatch ? ` · source batch: ${sourceBatch}` : ""}.
                </div>
              ) : (
                <div className="explain-box">
                  {calculationLoadMessage ||
                    "No verified investor performance metric is available yet."}
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>Investor Access</h2>

              <div className="form-card">
                {investors.length > 1 ? (
                  <>
                    <p className="eyebrow">
                      Select one of your authorised investor entities
                    </p>

                    <label>Investor entity</label>
                    <select
                      value={selectedInvestorId}
                      onChange={(event) => {
                        const nextInvestorId = event.target.value;
                        const nextInvestor = investors.find(
                          (investor) => investor.id === nextInvestorId
                        );

                        setSelectedInvestorId(nextInvestorId);
                        setSourceBatch(nextInvestor?.source_batch_id ?? "");
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
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Authenticated investor entity</p>
                    <strong>
                      {selectedInvestor?.investor_code
                        ? `${selectedInvestor.investor_code} - `
                        : ""}
                      {selectedInvestor?.name ?? "Investor"}
                    </strong>
                  </>
                )}

                <div className="logic-note">
                  Investor master, commitments, performance, cashflows and
                  published documents are filtered by database-level investor
                  entitlement before they reach this browser.
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Welcome back, {selectedInvestor?.name ?? "Investor"}</h2>

              <div className="explain-box">
                VENTIQ reviewed your commitments, capital called, distributions,
                current NAV, uploaded documents, stored PDFs, data room activity
                and DDQ trail. Your latest investor records are available below.
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
                    <h3>{portalMetrics.documentReadinessScore}%</h3>
                    <p>Portal readiness</p>
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

                    <div className="journal-row">
                      <span>Imported investor universe</span>
                      <strong>{portalMetrics.importedInvestors}</strong>
                    </div>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>My Investments</h2>

                  {commitments.length === 0 && (
                    <div className="explain-box">
                      No commitments found for this investor.
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
                      As of {formatDate(calculationSummary.asOfDate)}
                    </span>
                  </div>

                  {!financialPosition && (
                    <div className="explain-box">
                      No migrated financial position found yet. Publish investor
                      financial data from the Investor Financial Migration
                      workspace first.
                    </div>
                  )}

                  {financialPosition && (
                    <>
                      <div className="impact-grid">
                        <div className="impact-card">
                          <h3>{formatPercent(financialPosition.investor_irr)}</h3>
                          <p>Investor IRR</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_rvpi)}</h3>
                          <p>RVPI</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_dpi)}</h3>
                          <p>DPI</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatMultiple(financialPosition.investor_tvpi)}</h3>
                          <p>TVPI</p>
                        </div>
                      </div>

                      <div className="impact-grid">
                        <div className="impact-card">
                          <h3>{formatCr(portalMetrics.displayedSetupFee)}</h3>
                          <p>Setup fee</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatCr(portalMetrics.displayedManagementFee)}</h3>
                          <p>Management fee</p>
                        </div>

                        <div className="impact-card">
                          <h3>{formatCr(toCr(financialPosition.net_contributed))}</h3>
                          <p>Net contributed</p>
                        </div>

                        <div className="impact-card">
                          <h3>{financialPosition.status ?? "Ready"}</h3>
                          <p>Financial status</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

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

                <div className="preview-card" id="documents">
                  <h2>Investor Document Library</h2>

                  <p className="eyebrow">
                    Capital call notices, distribution notices, SOAs, tax
                    certificates, reports and stored PDFs available to this
                    investor
                  </p>

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
  {investorDocumentKits.map((kit) => {
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
                  {documents.length === 0 && (
                    <div className="explain-box">
                      No investor documents found yet. Publish investor PDFs from
                      PDF Intelligence or generate notices from the Document
                      Engine first.
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
                            <th>Fund</th>
                            <th>Amount</th>
                            <th>Period</th>
                            <th>Portal</th>
                            <th>Email</th>
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

                              <td>{documentRecord.fund_name ?? "-"}</td>

                              <td>
                                {documentRecord.amount
                                  ? formatCr(toCr(documentRecord.amount))
                                  : "-"}
                              </td>

                              <td>{documentRecord.period_label ?? "-"}</td>

                              <td>
                                <span className="small-pill">
                                  {documentRecord.portal_status ??
                                    documentRecord.migration_status ??
                                    documentRecord.status ??
                                    "Published"}
                                </span>
                              </td>

                              <td>
                                <span className="small-pill">
                                  {documentRecord.email_status ?? "not sent"}
                                </span>
                              </td>

                              <td>
                                <span className="small-pill">
                                  {hasStoredPdf(documentRecord)
                                    ? "Stored"
                                    : "Metadata only"}
                                </span>
                              </td>

                              <td>{formatDate(getDocumentDate(documentRecord))}</td>

                              <td>
                                {getDocumentUrl(documentRecord) ? (
                                  <a
                                    href={getDocumentUrl(documentRecord)}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border:
                                        "1px solid rgba(74, 222, 128, 0.45)",
                                      background: "rgba(22, 101, 52, 0.18)",
                                      color: "#bbf7d0",
                                      borderRadius: "999px",
                                      padding: "8px 16px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      textDecoration: "none",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Open PDF
                                  </a>
                                ) : hasStoredPdf(documentRecord) ? (
                                  <span className="small-pill">
                                    Stored in vault
                                  </span>
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
                </div>

                <div className="preview-card" id="cashflows">
                  <h2>Investor Cashflow Timeline</h2>

                  {cashflows.length === 0 && (
                    <div className="explain-box">
                      No investor cashflows found yet. Publish financial
                      migration data first.
                    </div>
                  )}

                  {cashflows.length > 0 && (
                    <div
                      style={{
                        overflowX: "auto",
                        border: "1px solid rgba(148, 163, 184, 0.22)",
                        borderRadius: "18px",
                        marginTop: "18px",
                      }}
                    >
                      <table
                        className="investor-table"
                        style={{
                          minWidth: "900px",
                          width: "100%",
                        }}
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
                              <td>{formatCr(toCr(cashflow.amount))}</td>
                              <td>{cashflow.description ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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