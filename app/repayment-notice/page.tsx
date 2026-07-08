"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type DataRow = Record<string, unknown>;

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

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return 0;
}
function getBoolean(row: DataRow | undefined, keys: string[], fallback = false) {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.toLowerCase();

      if (normalizedValue === "true") return true;
      if (normalizedValue === "false") return false;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }

  return fallback;
}

function getId(row: DataRow | undefined) {
  return getString(row, ["id"], "");
}

function formatCurrencyCr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0 Cr";

  return `₹${(value / 10000000).toFixed(2)} Cr`;
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value: string) {
  if (!value || value === "-") return "Upcoming";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function RepaymentNoticePage() {
  const [portfolioCompanies, setPortfolioCompanies] = useState<DataRow[]>([]);
  const [fundInvestments, setFundInvestments] = useState<DataRow[]>([]);
  const [debtRepayments, setDebtRepayments] = useState<DataRow[]>([]);
  const [repaymentNoticeBatches, setRepaymentNoticeBatches] = useState<DataRow[]>(
    []
  );
  const [repaymentNoticeHistory, setRepaymentNoticeHistory] = useState<DataRow[]>(
    []
  );

  const [selectedRepaymentId, setSelectedRepaymentId] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const [bulkTargetMonth, setBulkTargetMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [bulkNoticeMessage, setBulkNoticeMessage] = useState("");
  const [bulkCopied, setBulkCopied] = useState(false);

  const [pdfGenerating, setPdfGenerating] = useState(false);
 const [bulkPdfGenerating, setBulkPdfGenerating] = useState(false);

const [queueActionLoadingId, setQueueActionLoadingId] = useState("");
const [queueActionMessage, setQueueActionMessage] = useState("");
const [queueStatusFilter, setQueueStatusFilter] = useState("all");

const [loading, setLoading] = useState(true);
const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadRepaymentData();
  }, []);

  async function loadRepaymentData() {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
  "The sample Repayment Notice workflow is temporarily unavailable. Please request a walkthrough."
);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const [
      companiesResult,
      investmentsResult,
      repaymentsResult,
      noticeBatchesResult,
      noticeHistoryResult,
    ] = await Promise.all([
      supabase.from("portfolio_companies").select("*"),
      supabase.from("fund_investments").select("*"),
      supabase.from("debt_repayment_schedules").select("*").order("due_date"),
      supabase
        .from("repayment_notice_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("repayment_notices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const firstError =
      companiesResult.error ||
      investmentsResult.error ||
      repaymentsResult.error ||
      noticeBatchesResult.error ||
      noticeHistoryResult.error;

    if (firstError) {
      setErrorMessage(firstError.message);
      setLoading(false);
      return;
    }

    const companies = (companiesResult.data ?? []) as DataRow[];
    const investments = (investmentsResult.data ?? []) as DataRow[];
    const repayments = (repaymentsResult.data ?? []) as DataRow[];
    const noticeBatches = (noticeBatchesResult.data ?? []) as DataRow[];
    const noticeHistory = (noticeHistoryResult.data ?? []) as DataRow[];

    setPortfolioCompanies(companies);
    setFundInvestments(investments);
    setDebtRepayments(repayments);
    setRepaymentNoticeBatches(noticeBatches);
    setRepaymentNoticeHistory(noticeHistory);

    if (repayments.length > 0 && !selectedRepaymentId) {
      setSelectedRepaymentId(getId(repayments[0]));
    }

    setLoading(false);
  }

  const companyMap = useMemo(() => {
    return new Map(portfolioCompanies.map((company) => [getId(company), company]));
  }, [portfolioCompanies]);

  const investmentMap = useMemo(() => {
    return new Map(
      fundInvestments.map((investment) => [getId(investment), investment])
    );
  }, [fundInvestments]);

  const selectedRepayment = useMemo(() => {
    return debtRepayments.find((repayment) => getId(repayment) === selectedRepaymentId);
  }, [debtRepayments, selectedRepaymentId]);

  const selectedInvestment = useMemo(() => {
    const investmentId = getString(
      selectedRepayment,
      ["fund_investment_id", "investment_id"],
      ""
    );

    return investmentMap.get(investmentId);
  }, [selectedRepayment, investmentMap]);

  const selectedCompany = useMemo(() => {
    const companyIdFromRepayment = getString(
      selectedRepayment,
      ["portfolio_company_id", "company_id"],
      ""
    );

    const companyIdFromInvestment = getString(
      selectedInvestment,
      ["portfolio_company_id", "company_id"],
      ""
    );

    return (
      companyMap.get(companyIdFromRepayment) ??
      companyMap.get(companyIdFromInvestment)
    );
  }, [selectedRepayment, selectedInvestment, companyMap]);

  function getInvestmentForRepayment(repayment: DataRow | undefined) {
    const investmentId = getString(
      repayment,
      ["fund_investment_id", "investment_id"],
      ""
    );

    return investmentMap.get(investmentId);
  }

  function getCompanyForRepayment(repayment: DataRow | undefined) {
    const investment = getInvestmentForRepayment(repayment);

    const companyIdFromRepayment = getString(
      repayment,
      ["portfolio_company_id", "company_id"],
      ""
    );

    const companyIdFromInvestment = getString(
      investment,
      ["portfolio_company_id", "company_id"],
      ""
    );

    return (
      companyMap.get(companyIdFromRepayment) ??
      companyMap.get(companyIdFromInvestment)
    );
  }

  function isNoticeAlreadyGenerated(repayment: DataRow | undefined) {
  const noticeStatus = getString(
    repayment,
    ["notice_status"],
    "not_generated"
  ).toLowerCase();

  return (
    noticeStatus === "generated" ||
    noticeStatus === "sent" ||
    noticeStatus === "reminder_sent"
  );
}

function getDeliveryStatus(notice: DataRow | undefined) {
  return getString(notice, ["delivery_status"], "not_sent").toLowerCase();
}

function canMarkNoticeSent(notice: DataRow | undefined) {
  const deliveryStatus = getDeliveryStatus(notice);

  return deliveryStatus !== "sent" && deliveryStatus !== "reminder_sent";
}

function canMarkReminderSent(notice: DataRow | undefined) {
  const deliveryStatus = getDeliveryStatus(notice);

  return deliveryStatus === "sent";
}

  function buildNoticeForRepayment(repayment: DataRow | undefined) {
    if (!repayment) return "";

    const investment = getInvestmentForRepayment(repayment);
    const company = getCompanyForRepayment(repayment);

    const companyName = getString(
      company,
      ["company_name", "name", "title"],
      "Portfolio Company"
    );

    const dueDate = formatDate(repayment["due_date"]);

    const principalDue = getNumber(repayment, [
      "principal_due",
      "principal_amount",
      "scheduled_principal",
    ]);

    const interestDue = getNumber(repayment, [
      "interest_due",
      "interest_amount",
      "scheduled_interest",
    ]);

    const totalDue =
      getNumber(repayment, ["total_due", "amount_due", "total_amount"]) ||
      principalDue + interestDue;

    const securityDetails = getString(investment, [
      "security_details",
      "security",
      "collateral",
    ]);

    const investmentType = getString(investment, [
      "investment_type",
      "instrument_type",
      "security_type",
    ]);

    return `Subject: Repayment Notice - Amount Due on ${dueDate}

Dear ${companyName} Team,

This is a formal repayment reminder in relation to the debt investment tracked by VENTIQ.

As per the repayment schedule, the following amount is due for payment:

Company: ${companyName}
Due Date: ${dueDate}
Instrument / Investment Type: ${investmentType}
Principal Due: ${formatCurrency(principalDue)}
Interest Due: ${formatCurrency(interestDue)}
Total Amount Due: ${formatCurrency(totalDue)}

Security / Collateral Details:
${securityDetails}

You are requested to arrange payment of the above amount on or before the due date and share payment confirmation with the fund team.

Please treat this as an operational repayment notice generated from the fund's repayment monitoring system.

Regards,
Fund Operations Team`;
  }

  const noticePreview = buildNoticeForRepayment(selectedRepayment);

  const bulkRepaymentRows = useMemo(() => {
    const [yearText, monthText] = bulkTargetMonth.split("-");
    const targetYear = Number(yearText);
    const targetMonth = Number(monthText);

    if (!targetYear || !targetMonth) return [];

    return debtRepayments.filter((repayment) => {
      const dueDateValue = repayment["due_date"];

      if (typeof dueDateValue !== "string" || !dueDateValue) return false;

      const dueDate = new Date(dueDateValue);

      const status = getString(repayment, ["payment_status"], "").toLowerCase();

      const isUnpaidStatus =
        status === "" ||
        status === "upcoming" ||
        status === "overdue" ||
        status === "due" ||
        status === "pending";

      const noticeStatus = getString(
        repayment,
        ["notice_status"],
        "not_generated"
      ).toLowerCase();

      const isNoticePending =
  noticeStatus !== "generated" &&
  noticeStatus !== "sent" &&
  noticeStatus !== "reminder_sent";

      return (
        dueDate.getFullYear() === targetYear &&
        dueDate.getMonth() + 1 === targetMonth &&
        isUnpaidStatus &&
        isNoticePending
      );
    });
  }, [debtRepayments, bulkTargetMonth]);
  const queueStats = useMemo(() => {
  const stats = {
    all: repaymentNoticeHistory.length,
    notSent: 0,
    sent: 0,
    reminderSent: 0,
  };

  repaymentNoticeHistory.forEach((notice) => {
    const deliveryStatus = getDeliveryStatus(notice);

    if (deliveryStatus === "not_sent") {
      stats.notSent += 1;
    }

    if (deliveryStatus === "sent") {
      stats.sent += 1;
    }

    if (deliveryStatus === "reminder_sent") {
      stats.reminderSent += 1;
    }
  });

  return stats;
}, [repaymentNoticeHistory]);
const dispatchStats = useMemo(() => {
  const stats = {
    total: repaymentNoticeHistory.length,
    pendingDispatch: 0,
    draftPrepared: 0,
    emailSent: 0,
    reminderSent: 0,
  };

  repaymentNoticeHistory.forEach((notice) => {
    const deliveryStatus = getDeliveryStatus(notice);
    const draftStatus = getString(
      notice,
      ["email_draft_status"],
      "not_prepared"
    ).toLowerCase();
    const dispatchStatus = getEmailDispatchStatus(notice);

    if (deliveryStatus === "not_sent") {
      stats.pendingDispatch += 1;
    }

    if (draftStatus === "prepared") {
      stats.draftPrepared += 1;
    }

    if (dispatchStatus === "sent") {
      stats.emailSent += 1;
    }

    if (deliveryStatus === "reminder_sent") {
      stats.reminderSent += 1;
    }
  });

  return stats;
}, [repaymentNoticeHistory]);
const filteredRepaymentNoticeHistory = useMemo(() => {
  if (queueStatusFilter === "all") {
    return repaymentNoticeHistory;
  }

  return repaymentNoticeHistory.filter((notice) => {
    return getDeliveryStatus(notice) === queueStatusFilter;
  });
}, [repaymentNoticeHistory, queueStatusFilter]);
function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRepaymentContactEmail(company: DataRow | undefined) {
  return getString(
    company,
    [
      "repayment_contact_email",
      "finance_contact_email",
      "contact_email",
      "email",
      "company_email",
    ],
    ""
  );
}

function getEmailReadyDetails(email: string) {
  if (!email) {
    return {
      emailReady: false,
      emailReadyNote: "Recipient email missing",
    };
  }

  if (!isValidEmail(email)) {
    return {
      emailReady: false,
      emailReadyNote: "Recipient email format looks invalid",
    };
  }

  return {
    emailReady: true,
    emailReadyNote: "Ready for email dispatch",
  };
}
function buildEmailSubjectFromNotice(notice: DataRow | undefined) {
  const existingSubject = getString(notice, ["email_subject"], "");

  if (existingSubject) {
    return existingSubject;
  }

  const noticeSubject = getString(notice, ["notice_subject"], "");

  if (noticeSubject) {
    return noticeSubject;
  }

  const companyName = getString(notice, ["company_name"], "Portfolio Company");
  const dueDate = formatDate(notice?.["due_date"]);

  return `Repayment Notice - ${companyName} - Due ${dueDate}`;
}

function buildEmailBodyFromNotice(notice: DataRow | undefined) {
  const existingBody = getString(notice, ["email_body"], "");

  if (existingBody) {
    return existingBody;
  }

  const companyName = getString(notice, ["company_name"], "Portfolio Company");
  const noticeBody = getString(
    notice,
    ["notice_body"],
    "No repayment notice body found."
  );

  return `Dear ${companyName} Team,

Please find below the repayment notice for your action.

${noticeBody}

Regards,
Fund Operations Team`;
}

function isEmailDraftPrepared(notice: DataRow | undefined) {
  const draftStatus = getString(
    notice,
    ["email_draft_status"],
    "not_prepared"
  ).toLowerCase();

  return draftStatus === "prepared";
}
function getEmailDispatchStatus(notice: DataRow | undefined) {
  return getString(
    notice,
    ["email_dispatch_status"],
    "not_sent"
  ).toLowerCase();
}

function isEmailDispatched(notice: DataRow | undefined) {
  return getEmailDispatchStatus(notice) === "sent";
}

function canSimulateEmailDispatch(notice: DataRow | undefined) {
  const emailReady = getBoolean(notice, ["email_ready"], false);
  const draftPrepared = isEmailDraftPrepared(notice);
  const dispatchStatus = getEmailDispatchStatus(notice);
  const deliveryStatus = getDeliveryStatus(notice);

  return (
    emailReady &&
    draftPrepared &&
    dispatchStatus !== "sent" &&
    deliveryStatus !== "sent" &&
    deliveryStatus !== "reminder_sent"
  );
}
function getStatusBadgeClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus === "sent" ||
    normalizedStatus === "prepared" ||
    normalizedStatus === "ready" ||
    normalizedStatus === "reminder_sent"
  ) {
    return "status-badge status-badge-success";
  }

  if (
    normalizedStatus === "not_sent" ||
    normalizedStatus === "not_prepared" ||
    normalizedStatus === "missing"
  ) {
    return "status-badge status-badge-warning";
  }

  if (
    normalizedStatus === "failed" ||
    normalizedStatus === "invalid" ||
    normalizedStatus === "error"
  ) {
    return "status-badge status-badge-danger";
  }

  return "status-badge status-badge-neutral";
}

function renderStatusBadge(status: string) {
  return (
    <span className={getStatusBadgeClass(status)}>
      {statusLabel(status)}
    </span>
  );
}

function getEmailReadyBadge(notice: DataRow | undefined) {
  const emailReady = getBoolean(notice, ["email_ready"], false);
  const emailReadyNote = getString(
    notice,
    ["email_ready_note"],
    "Not checked"
  );

  return (
    <span
      className={
        emailReady
          ? "status-badge status-badge-success"
          : "status-badge status-badge-warning"
      }
    >
      {emailReadyNote}
    </span>
  );
}
function getShortLastActionNote(notice: DataRow | undefined) {
  const note = getString(notice, ["last_action_note"], "-").toLowerCase();

  if (note.includes("email dispatch simulated")) {
    return "Email dispatched";
  }

  if (note.includes("email draft prepared")) {
    return "Draft prepared";
  }

  if (note.includes("marked as sent")) {
    return "Marked sent";
  }

  if (note.includes("reminder marked as sent")) {
    return "Reminder sent";
  }

  if (note.includes("reset")) {
    return "Dispatch reset";
  }

  if (note === "-") {
    return "-";
  }

  return "Updated";
}
function getOperationalWorkflowStatus(notice: DataRow | undefined) {
  const emailReady = getBoolean(notice, ["email_ready"], false);
  const draftPrepared = isEmailDraftPrepared(notice);
  const emailDispatched = isEmailDispatched(notice);
  const deliveryStatus = getDeliveryStatus(notice);
  const reminderStatus = getString(
    notice,
    ["reminder_status"],
    "not_sent"
  ).toLowerCase();

  if (!emailReady) {
    return "Needs Recipient Email";
  }

  if (emailDispatched && reminderStatus === "sent") {
    return "Email & Reminder Completed";
  }

  if (emailDispatched || deliveryStatus === "sent") {
    return "Email Sent";
  }

  if (draftPrepared) {
    return "Ready to Send";
  }

  return "Notice Generated";
}

function getOperationalWorkflowStatusKey(notice: DataRow | undefined) {
  const status = getOperationalWorkflowStatus(notice);

  if (
    status === "Email Sent" ||
    status === "Email & Reminder Completed"
  ) {
    return "sent";
  }

  if (status === "Ready to Send") {
    return "ready";
  }

  if (status === "Needs Recipient Email") {
    return "missing";
  }

  return "generated";
}

function renderOperationalWorkflowBadge(notice: DataRow | undefined) {
  const status = getOperationalWorkflowStatus(notice);
  const statusKey = getOperationalWorkflowStatusKey(notice);

  if (statusKey === "sent") {
    return (
      <span className="status-badge status-badge-success">
        {status}
      </span>
    );
  }

  if (statusKey === "ready") {
    return (
      <span className="status-badge status-badge-neutral">
        {status}
      </span>
    );
  }

  if (statusKey === "missing") {
    return (
      <span className="status-badge status-badge-warning">
        {status}
      </span>
    );
  }

  return (
    <span className="status-badge status-badge-neutral">
      {status}
    </span>
  );
}
function getQueueCompletionLabel(notice: DataRow | undefined) {
  const deliveryStatus = getDeliveryStatus(notice);

  if (deliveryStatus === "reminder_sent") {
    return "Notice & Reminder Sent";
  }

  if (deliveryStatus === "sent") {
    return "Notice Sent";
  }

  return "Pending Dispatch";
}

 async function handleGenerateNotice() {
  setNoticeMessage(noticePreview);
  setCopied(false);

  if (!selectedRepayment) return;

  if (isNoticeAlreadyGenerated(selectedRepayment)) {
    const repaymentId = getId(selectedRepayment);

    const existingNotice = repaymentNoticeHistory.find((notice) => {
      return getString(notice, ["repayment_schedule_id"], "") === repaymentId;
    });

    const existingNoticeBody = getString(existingNotice, ["notice_body"], "");

    setNoticeMessage(
      existingNoticeBody ||
        `${noticePreview}\n\nNote: This repayment notice was already generated earlier.`
    );

    return;
  }

  try {
    await saveNoticeHistory({
      noticeType: "single",
      repayments: [selectedRepayment],
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown save error.";

    setNoticeMessage(`${noticePreview}\n\nSave warning: ${errorMessage}`);
  }
}
async function handleDeleteGeneratedNotice() {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  if (!selectedRepayment) {
    setQueueActionMessage("Please select a repayment schedule first.");
    return;
  }

  const repaymentId = getId(selectedRepayment);

  if (!repaymentId) {
    setQueueActionMessage("Could not identify selected repayment schedule.");
    return;
  }

  const confirmed = window.confirm(
  "Delete this generated notice? This will remove notice history for this repayment and reset the schedule to Not Generated."
);

if (!confirmed) {
  return;
}

setQueueActionLoadingId(`delete-${repaymentId}`);
setQueueActionMessage("");

  const existingNoticesResult = await supabase
    .from("repayment_notices")
    .select("id, batch_id")
    .eq("repayment_schedule_id", repaymentId);

  if (existingNoticesResult.error) {
    setQueueActionMessage(existingNoticesResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  const existingNotices = (existingNoticesResult.data ?? []) as DataRow[];

  const noticeIds = existingNotices
    .map((notice) => getId(notice))
    .filter((id) => id.length > 0);

  const batchIds = existingNotices
    .map((notice) => getString(notice, ["batch_id"], ""))
    .filter((id) => id.length > 0);

  if (noticeIds.length > 0) {
    const deleteNoticeResult = await supabase
      .from("repayment_notices")
      .delete()
      .in("id", noticeIds);

    if (deleteNoticeResult.error) {
      setQueueActionMessage(deleteNoticeResult.error.message);
      setQueueActionLoadingId("");
      return;
    }
  }

  if (batchIds.length > 0) {
    await supabase
      .from("repayment_notice_batches")
      .delete()
      .in("id", batchIds)
      .eq("notice_type", "single");
  }

  const scheduleUpdateResult = await supabase
    .from("debt_repayment_schedules")
    .update({
      notice_status: "not_generated",
    })
    .eq("id", repaymentId);

  if (scheduleUpdateResult.error) {
    setQueueActionMessage(scheduleUpdateResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  setNoticeMessage("");
  setCopied(false);

  await loadRepaymentData();

  setQueueActionMessage(
    "Generated notice deleted. Repayment schedule is ready for fresh notice generation."
  );

  setQueueActionLoadingId("");
}
  async function handleCopyNotice() {
    if (!noticeMessage) return;

    await navigator.clipboard.writeText(noticeMessage);
    setCopied(true);
  }

  async function handleGenerateBulkNotices() {
    if (bulkRepaymentRows.length === 0) {
      setBulkNoticeMessage(
        "No unpaid, upcoming, overdue, or notice-pending repayment schedules found for the selected month."
      );
      setBulkCopied(false);
      return;
    }

    const bulkText = bulkRepaymentRows
      .map((repayment, index) => {
        const company = getCompanyForRepayment(repayment);

        const companyName = getString(
          company,
          ["company_name", "name", "title"],
          "Unknown Company"
        );

        return `NOTICE ${index + 1} OF ${bulkRepaymentRows.length}
Company: ${companyName}

${buildNoticeForRepayment(repayment)}`;
      })
      .join("\n\n------------------------------------------------------------\n\n");

    setBulkNoticeMessage(bulkText);
    setBulkCopied(false);

    try {
      await saveNoticeHistory({
        noticeType: "bulk",
        batchMonth: bulkTargetMonth,
        repayments: bulkRepaymentRows,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown save error.";

      setBulkNoticeMessage(`${bulkText}\n\nSave warning: ${errorMessage}`);
    }
  }

  async function handleCopyBulkNotices() {
    if (!bulkNoticeMessage) return;

    await navigator.clipboard.writeText(bulkNoticeMessage);
    setBulkCopied(true);
  }

  async function saveNoticeHistory({
    noticeType,
    batchMonth,
    repayments,
  }: {
    noticeType: "single" | "bulk";
    batchMonth?: string;
    repayments: DataRow[];
  }) {
    if (!supabase || repayments.length === 0) return;

    const batchResult = await supabase
      .from("repayment_notice_batches")
      .insert({
        batch_month: batchMonth ?? null,
        notice_type: noticeType,
        status: "generated",
        total_notices: repayments.length,
      })
      .select("id")
      .single();

    if (batchResult.error) {
      throw new Error(batchResult.error.message);
    }

    const batchId = getString(batchResult.data as DataRow, ["id"], "");

    const noticeRows = repayments.map((repayment) => {
  const investment = getInvestmentForRepayment(repayment);
  const company = getCompanyForRepayment(repayment);

  const companyName = getString(
    company,
    ["company_name", "name", "title"],
    "Portfolio Company"
  );

  const dueDateValue = getString(repayment, ["due_date"], "");
  const recipientEmail = getRepaymentContactEmail(company);
  const emailReadyDetails = getEmailReadyDetails(recipientEmail);

  return {
        batch_id: batchId,
        repayment_schedule_id: getId(repayment),
        portfolio_company_id: getString(
          company,
          ["id"],
          getString(repayment, ["portfolio_company_id", "company_id"], "")
        ),
        fund_investment_id: getString(
          investment,
          ["id"],
          getString(repayment, ["fund_investment_id", "investment_id"], "")
        ),
        company_name: companyName,
        due_date: dueDateValue || null,
        notice_subject: `Repayment Notice - Amount Due on ${formatDate(
          repayment["due_date"]
        )}`,
        notice_body: buildNoticeForRepayment(repayment),
        notice_status: "generated",
delivery_status: "not_sent",
recipient_email: recipientEmail || null,
recipient_source: recipientEmail ? "portfolio_company" : "missing",
email_ready: emailReadyDetails.emailReady,
email_ready_note: emailReadyDetails.emailReadyNote,
      };
    });

    const noticesResult = await supabase
      .from("repayment_notices")
      .insert(noticeRows);

    if (noticesResult.error) {
      throw new Error(noticesResult.error.message);
    }

    const repaymentIds = repayments
      .map((repayment) => getId(repayment))
      .filter((id) => id.length > 0);

    if (repaymentIds.length > 0) {
      const scheduleUpdateResult = await supabase
        .from("debt_repayment_schedules")
        .update({
          notice_status: "generated",
        })
        .in("id", repaymentIds);

      if (scheduleUpdateResult.error) {
        throw new Error(scheduleUpdateResult.error.message);
      }
    }

    await loadRepaymentData();
  }
async function handleMarkNoticeSent(notice: DataRow) {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const noticeId = getId(notice);
  const repaymentScheduleId = getString(notice, ["repayment_schedule_id"], "");

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

  const now = new Date().toISOString();

  setQueueActionLoadingId(`sent-${noticeId}`);
  setQueueActionMessage("");

  const noticeUpdateResult = await supabase
    .from("repayment_notices")
    .update({
      notice_status: "sent",
      delivery_status: "sent",
      sent_at: now,
      last_action_at: now,
      last_action_note: "Marked as sent from VENTIQ repayment send queue.",
    })
    .eq("id", noticeId);

  if (noticeUpdateResult.error) {
    setQueueActionMessage(noticeUpdateResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  if (repaymentScheduleId) {
    const scheduleUpdateResult = await supabase
      .from("debt_repayment_schedules")
      .update({
        notice_status: "sent",
      })
      .eq("id", repaymentScheduleId);

    if (scheduleUpdateResult.error) {
      setQueueActionMessage(scheduleUpdateResult.error.message);
      setQueueActionLoadingId("");
      return;
    }
  }

  await loadRepaymentData();

  setQueueActionMessage("Notice marked as sent successfully.");
  setQueueActionLoadingId("");
}

async function handleMarkReminderSent(notice: DataRow) {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const noticeId = getId(notice);
  const repaymentScheduleId = getString(notice, ["repayment_schedule_id"], "");

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

  const now = new Date().toISOString();

  setQueueActionLoadingId(`reminder-${noticeId}`);
  setQueueActionMessage("");

  const noticeUpdateResult = await supabase
    .from("repayment_notices")
    .update({
      delivery_status: "reminder_sent",
      reminder_status: "sent",
      reminder_sent_at: now,
      last_action_at: now,
      last_action_note: "Reminder marked as sent from VENTIQ repayment send queue.",
    })
    .eq("id", noticeId);

  if (noticeUpdateResult.error) {
    setQueueActionMessage(noticeUpdateResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  if (repaymentScheduleId) {
    const scheduleUpdateResult = await supabase
      .from("debt_repayment_schedules")
      .update({
        notice_status: "reminder_sent",
      })
      .eq("id", repaymentScheduleId);

    if (scheduleUpdateResult.error) {
      setQueueActionMessage(scheduleUpdateResult.error.message);
      setQueueActionLoadingId("");
      return;
    }
  }

  await loadRepaymentData();

  setQueueActionMessage("Reminder marked as sent successfully.");
  setQueueActionLoadingId("");
}
function handleViewNoticeFromQueue(notice: DataRow) {
  const noticeBody = getString(
    notice,
    ["notice_body"],
    "No notice body found for this record."
  );

  setNoticeMessage(noticeBody);
  setCopied(false);
  setQueueActionMessage("Notice loaded in preview panel.");
}

async function handleCopyNoticeFromQueue(notice: DataRow) {
  const noticeBody = getString(notice, ["notice_body"], "");

  if (!noticeBody) {
    setQueueActionMessage("No notice body found to copy.");
    return;
  }

  await navigator.clipboard.writeText(noticeBody);
  setQueueActionMessage("Notice copied from send queue.");
}
async function handlePrepareEmailDraft(notice: DataRow) {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const noticeId = getId(notice);

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

  const recipientEmail = getString(notice, ["recipient_email"], "");
  const emailReady = getBoolean(notice, ["email_ready"], false);

  if (!recipientEmail || !isValidEmail(recipientEmail) || !emailReady) {
    setQueueActionMessage(
      "Email draft cannot be prepared because recipient email is missing or invalid."
    );
    return;
  }

  const now = new Date().toISOString();
  const emailSubject = buildEmailSubjectFromNotice(notice);
  const emailBody = buildEmailBodyFromNotice(notice);

  setQueueActionLoadingId(`draft-${noticeId}`);
  setQueueActionMessage("");

  const draftUpdateResult = await supabase
    .from("repayment_notices")
    .update({
      email_subject: emailSubject,
      email_body: emailBody,
      email_draft_status: "prepared",
      email_drafted_at: now,
      email_dispatch_status: "ready",
      email_dispatch_note: "Email draft prepared from VENTIQ send queue.",
      last_action_at: now,
      last_action_note: "Email draft prepared from VENTIQ send queue.",
    })
    .eq("id", noticeId);

  if (draftUpdateResult.error) {
    setQueueActionMessage(draftUpdateResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  await loadRepaymentData();

  setQueueActionMessage("Email draft prepared successfully.");
  setQueueActionLoadingId("");
}
async function handleSimulateEmailDispatch(notice: DataRow) {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const noticeId = getId(notice);
  const repaymentScheduleId = getString(notice, ["repayment_schedule_id"], "");

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

  const recipientEmail = getString(notice, ["recipient_email"], "");
  const emailReady = getBoolean(notice, ["email_ready"], false);
  const emailDraftPrepared = isEmailDraftPrepared(notice);

  if (!recipientEmail || !isValidEmail(recipientEmail) || !emailReady) {
    setQueueActionMessage(
      "Email cannot be dispatched because recipient email is missing or invalid."
    );
    return;
  }

  if (!emailDraftPrepared) {
    setQueueActionMessage("Please prepare the email draft before dispatch.");
    return;
  }

  const now = new Date().toISOString();
  const previousAttemptCount = getNumber(notice, ["email_send_attempt_count"]);

  setQueueActionLoadingId(`send-email-${noticeId}`);
  setQueueActionMessage("");

  const simulatedMessageId = `ventiq-sim-${noticeId}-${Date.now()}`;

  const noticeUpdateResult = await supabase
    .from("repayment_notices")
    .update({
      notice_status: "sent",
      delivery_status: "sent",
      sent_at: now,
      email_dispatch_status: "sent",
      email_sent_at: now,
      email_last_attempt_at: now,
      email_send_attempt_count: previousAttemptCount + 1,
      email_provider_message_id: simulatedMessageId,
      email_dispatch_note:
        "Email dispatch simulated successfully from VENTIQ send queue.",
      last_action_at: now,
      last_action_note:
        "Email dispatch simulated successfully from VENTIQ send queue.",
    })
    .eq("id", noticeId);

  if (noticeUpdateResult.error) {
    setQueueActionMessage(noticeUpdateResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  if (repaymentScheduleId) {
    const scheduleUpdateResult = await supabase
      .from("debt_repayment_schedules")
      .update({
        notice_status: "sent",
      })
      .eq("id", repaymentScheduleId);

    if (scheduleUpdateResult.error) {
      setQueueActionMessage(scheduleUpdateResult.error.message);
      setQueueActionLoadingId("");
      return;
    }
  }

  await loadRepaymentData();

  setQueueActionMessage(
    `Email dispatch simulated successfully for ${recipientEmail}.`
  );

  setQueueActionLoadingId("");
}
async function handleResetEmailDispatch(notice: DataRow) {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const noticeId = getId(notice);
  const repaymentScheduleId = getString(notice, ["repayment_schedule_id"], "");

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

 const confirmed = window.confirm(
  "Reset email dispatch for this notice? This will clear sent timestamps and return the notice to Ready status."
);

if (!confirmed) {
  return;
}

const now = new Date().toISOString();

setQueueActionLoadingId(`reset-email-${noticeId}`);
setQueueActionMessage("");

  const resetResult = await supabase
    .from("repayment_notices")
    .update({
      notice_status: "generated",
      delivery_status: "not_sent",
      sent_at: null,
      reminder_sent_at: null,
      reminder_status: "not_sent",
      email_dispatch_status: "ready",
      email_sent_at: null,
      email_last_attempt_at: null,
      email_provider_message_id: null,
      email_dispatch_note: "Email dispatch reset for testing.",
      last_action_at: now,
      last_action_note: "Email dispatch reset for testing.",
    })
    .eq("id", noticeId);

  if (resetResult.error) {
    setQueueActionMessage(resetResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  if (repaymentScheduleId) {
    const scheduleUpdateResult = await supabase
      .from("debt_repayment_schedules")
      .update({
        notice_status: "generated",
      })
      .eq("id", repaymentScheduleId);

    if (scheduleUpdateResult.error) {
      setQueueActionMessage(scheduleUpdateResult.error.message);
      setQueueActionLoadingId("");
      return;
    }
  }

  await loadRepaymentData();

  setQueueActionMessage("Email dispatch reset successfully.");
  setQueueActionLoadingId("");
}
async function handleCleanupStaleNoticeBatches() {
  if (!supabase) {
    setQueueActionMessage(
  "The sample repayment notice workflow is temporarily unavailable. Please request a walkthrough."
);
    return;
  }

  const confirmed = window.confirm(
    "Clean up stale notice batches that do not have related notice records?"
  );

  if (!confirmed) {
    return;
  }

  setQueueActionLoadingId("cleanup-stale-batches");
  setQueueActionMessage("");

  const noticesResult = await supabase
    .from("repayment_notices")
    .select("batch_id");

  if (noticesResult.error) {
    setQueueActionMessage(noticesResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  const activeBatchIds = ((noticesResult.data ?? []) as DataRow[])
    .map((notice) => getString(notice, ["batch_id"], ""))
    .filter((id) => id.length > 0);

  const batchesResult = await supabase
    .from("repayment_notice_batches")
    .select("id");

  if (batchesResult.error) {
    setQueueActionMessage(batchesResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  const staleBatchIds = ((batchesResult.data ?? []) as DataRow[])
    .map((batch) => getId(batch))
    .filter((id) => id.length > 0 && !activeBatchIds.includes(id));

  if (staleBatchIds.length === 0) {
    setQueueActionMessage("No stale notice batches found.");
    setQueueActionLoadingId("");
    return;
  }

  const deleteResult = await supabase
    .from("repayment_notice_batches")
    .delete()
    .in("id", staleBatchIds);

  if (deleteResult.error) {
    setQueueActionMessage(deleteResult.error.message);
    setQueueActionLoadingId("");
    return;
  }

  await loadRepaymentData();

  setQueueActionMessage(
    `${staleBatchIds.length} stale notice batch record(s) cleaned up.`
  );

  setQueueActionLoadingId("");
}

async function handleCopyEmailDraft(notice: DataRow) {
  const recipientEmail = getString(notice, ["recipient_email"], "");
  const emailSubject = buildEmailSubjectFromNotice(notice);
  const emailBody = buildEmailBodyFromNotice(notice);

  if (!recipientEmail) {
    setQueueActionMessage("Recipient email is missing.");
    return;
  }

  const emailText = `To: ${recipientEmail}
Subject: ${emailSubject}

${emailBody}`;

  await navigator.clipboard.writeText(emailText);

  setQueueActionMessage("Email draft copied successfully.");
}
async function handleDownloadQueueNoticePdf(notice: DataRow) {
  const noticeId = getId(notice);

  if (!noticeId) {
    setQueueActionMessage("Could not identify selected notice.");
    return;
  }

  const noticeBody = getString(notice, ["notice_body"], "");

  if (!noticeBody) {
    setQueueActionMessage("No notice body found for PDF download.");
    return;
  }

  setQueueActionLoadingId(`pdf-${noticeId}`);
  setQueueActionMessage("");

  try {
    const companyName = getString(
      notice,
      ["company_name"],
      "Portfolio Company"
    );

    await downloadPdfFromNotices({
      fileName: `${companyName}-repayment-notice-history`,
      notices: [
        {
          title: "Repayment Notice",
          companyName,
          dueDate: formatDate(notice["due_date"]),
          noticeText: noticeBody,
        },
      ],
    });

    setQueueActionMessage("PDF downloaded from send queue.");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown PDF error.";

    setQueueActionMessage(`Queue PDF download failed: ${errorMessage}`);
  } finally {
    setQueueActionLoadingId("");
  }
}
  async function downloadPdfFromNotices({
    fileName,
    notices,
  }: {
    fileName: string;
    notices: {
      title: string;
      companyName: string;
      dueDate: string;
      noticeText: string;
    }[];
  }) {
    const response = await fetch("/api/repayment-notice/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        notices,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || "Could not generate repayment PDF.");
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `${fileName
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  }

  async function handleDownloadSinglePdf() {
    if (!selectedRepayment) return;

    setPdfGenerating(true);

    try {
      const company = getCompanyForRepayment(selectedRepayment);
      const companyName = getString(
        company,
        ["company_name", "name", "title"],
        "Portfolio Company"
      );

      await downloadPdfFromNotices({
        fileName: `${companyName}-repayment-notice`,
        notices: [
          {
            title: "Repayment Notice",
            companyName,
            dueDate: formatDate(selectedRepayment["due_date"]),
            noticeText: buildNoticeForRepayment(selectedRepayment),
          },
        ],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown PDF error.";

      setNoticeMessage(`PDF generation failed: ${errorMessage}`);
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleDownloadBulkPdf() {
    setBulkPdfGenerating(true);

    try {
      if (bulkRepaymentRows.length === 0) {
        setBulkNoticeMessage(
          "No unpaid, upcoming, overdue, or notice-pending repayment schedules found for the selected month."
        );
        return;
      }

      await downloadPdfFromNotices({
        fileName: `repayment-notice-pack-${bulkTargetMonth}`,
        notices: bulkRepaymentRows.map((repayment) => {
          const company = getCompanyForRepayment(repayment);

          const companyName = getString(
            company,
            ["company_name", "name", "title"],
            "Portfolio Company"
          );

          return {
            title: "Repayment Notice",
            companyName,
            dueDate: formatDate(repayment["due_date"]),
            noticeText: buildNoticeForRepayment(repayment),
          };
        }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown bulk PDF error.";

      setBulkNoticeMessage(`Bulk PDF generation failed: ${errorMessage}`);
    } finally {
      setBulkPdfGenerating(false);
    }
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Debt Fund Operations</p>
            <h1>Repayment Notice Generator</h1>
            <p>
              Generate professional repayment notices using live debt repayment
              schedules, portfolio company data and investment records.
            </p>
          </div>

          <a className="back-link" href="/managing-partner-ai">
            Back to Managing Partner AI
          </a>
        </div>
<div className="sample-data-ribbon">
  Live repayment notice workflow preview · Sample data shown for demonstration
</div>
       {loading && (
  <div className="preview-card">
    <h2>Preparing Repayment Notice Workflow...</h2>
    <p>
      VENTIQ is preparing the sample portfolio, investment and repayment
      schedule workflow.
    </p>
  </div>
)}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Connection Issue</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="preview-card">
              <h2>Repayment Notice Workflow</h2>

              <div className="explain-box">
                Select an upcoming repayment, review the amount due, generate a
                notice draft, download PDF, copy it for email, and track generated
                notices in the send queue.
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{debtRepayments.length}</h3>
                  <p>Total repayment schedules</p>
                </div>

                <div className="impact-card">
                  <h3>
                    {
                      debtRepayments.filter(
                        (row) =>
                          getString(row, ["payment_status"], "") === "upcoming"
                      ).length
                    }
                  </h3>
                  <p>Upcoming repayments</p>
                </div>

                <div className="impact-card">
                  <h3>
                    {
                      debtRepayments.filter(
                        (row) =>
                          getString(row, ["payment_status"], "") === "overdue"
                      ).length
                    }
                  </h3>
                  <p>Overdue repayments</p>
                </div>

                <div className="impact-card">
                  <h3>
                    {
                      debtRepayments.filter((row) =>
                        isNoticeAlreadyGenerated(row)
                      ).length
                    }
                  </h3>
                  <p>Generated notices</p>
                </div>
              </div>
            </div>

            <div className="knowledge-grid">
              <div className="form-card">
                <h2>Select Repayment</h2>

                {debtRepayments.length === 0 && (
                  <div className="explain-box">
                    No repayment schedules found. Add schedules in Portfolio
                    Intelligence first.
                  </div>
                )}

                {debtRepayments.length > 0 && (
                  <>
                    <label>Repayment schedule</label>
                    <select
                      value={selectedRepaymentId}
                      onChange={(event) => {
                        setSelectedRepaymentId(event.target.value);
                        setNoticeMessage("");
                        setCopied(false);
                      }}
                    >
                      {debtRepayments.map((repayment) => {
                        const company = getCompanyForRepayment(repayment);

                        const companyName = getString(
                          company,
                          ["company_name", "name", "title"],
                          "Unknown Company"
                        );

                        const totalDue =
                          getNumber(repayment, [
                            "total_due",
                            "amount_due",
                            "total_amount",
                          ]) ||
                          getNumber(repayment, [
                            "principal_due",
                            "principal_amount",
                            "scheduled_principal",
                          ]) +
                            getNumber(repayment, [
                              "interest_due",
                              "interest_amount",
                              "scheduled_interest",
                            ]);

                        return (
                          <option key={getId(repayment)} value={getId(repayment)}>
                            {companyName} • {formatDate(repayment["due_date"])} •{" "}
                            {formatCurrencyCr(totalDue)}
                          </option>
                        );
                      })}
                    </select>

                    <div className="logic-note">
                      Current payment status:{" "}
                      {statusLabel(
                        getString(selectedRepayment, ["payment_status"], "")
                      )}
                    </div>

                    <div className="queue-grid">
                      <div className="queue-item">
                        <strong>Company</strong>
                        <br />
                        {getString(
                          selectedCompany,
                          ["company_name", "name", "title"],
                          "Unknown Company"
                        )}
                      </div>

                      <div className="queue-item">
                        <strong>Due Date</strong>
                        <br />
                        {formatDate(selectedRepayment?.["due_date"])}
                      </div>

                      <div className="queue-item">
                        <strong>Principal Due</strong>
                        <br />
                        {formatCurrency(
                          getNumber(selectedRepayment, [
                            "principal_due",
                            "principal_amount",
                            "scheduled_principal",
                          ])
                        )}
                      </div>

                      <div className="queue-item">
                        <strong>Interest Due</strong>
                        <br />
                        {formatCurrency(
                          getNumber(selectedRepayment, [
                            "interest_due",
                            "interest_amount",
                            "scheduled_interest",
                          ])
                        )}
                      </div>

                      <div className="queue-item">
                        <strong>Total Due</strong>
                        <br />
                        {formatCurrency(
                          getNumber(selectedRepayment, [
                            "total_due",
                            "amount_due",
                            "total_amount",
                          ]) ||
                            getNumber(selectedRepayment, [
                              "principal_due",
                              "principal_amount",
                              "scheduled_principal",
                            ]) +
                              getNumber(selectedRepayment, [
                                "interest_due",
                                "interest_amount",
                                "scheduled_interest",
                              ])
                        )}
                      </div>

                      <div className="queue-item">
                        <strong>Instrument</strong>
                        <br />
                        {getString(selectedInvestment, [
                          "investment_type",
                          "instrument_type",
                          "security_type",
                        ])}
                      </div>

                      <div className="queue-item">
                        <strong>Notice Status</strong>
                        <br />
                        {statusLabel(
                          getString(
                            selectedRepayment,
                            ["notice_status"],
                            "not_generated"
                          )
                        )}
                      </div>
                      <div className="queue-item">
  <strong>Recipient Email</strong>
  <br />
  {getRepaymentContactEmail(selectedCompany) || "Missing"}
</div>
                    </div>

                   <div className="action-row">
  <button
    type="button"
    className="monitor-btn monitor-btn-primary"
    onClick={handleGenerateNotice}
  >
    {isNoticeAlreadyGenerated(selectedRepayment)
      ? "View Generated Notice"
      : "Generate Notice Draft"}
  </button>

  {isNoticeAlreadyGenerated(selectedRepayment) && (
    <button
      type="button"
      className="monitor-btn monitor-btn-secondary"
      disabled={
        queueActionLoadingId === `delete-${getId(selectedRepayment)}`
      }
      onClick={handleDeleteGeneratedNotice}
    >
      {queueActionLoadingId === `delete-${getId(selectedRepayment)}`
        ? "Deleting..."
        : "Delete Generated Notice"}
    </button>
  )}

  <button
    type="button"
    className="monitor-btn monitor-btn-secondary"
    disabled={!noticeMessage}
    onClick={handleCopyNotice}
  >
    {copied ? "Copied" : "Copy Notice"}
  </button>

  <button
    type="button"
    className="monitor-btn monitor-btn-secondary"
    disabled={!selectedRepayment || pdfGenerating}
    onClick={handleDownloadSinglePdf}
  >
    {pdfGenerating ? "Generating PDF..." : "Download PDF"}
  </button>
</div>
                  </>
                )}
              </div>

              <div className="preview-card">
                <h2>Notice Preview</h2>

                {!noticeMessage && (
                  <div className="explain-box">
                    Select a repayment schedule and click Generate Notice Draft.
                  </div>
                )}

                {noticeMessage && (
                  <pre className="notice-preview-box">{noticeMessage}</pre>
                )}
              </div>
            </div>

            <div className="preview-card">
              <h2>Monthly Bulk Notice Generator</h2>

              <div className="explain-box">
                Select a month and VENTIQ will prepare repayment notices for all
                unpaid, upcoming or overdue repayment schedules due in that month
                where notices have not already been generated.
              </div>

              <div className="form-card">
                <label>Target month</label>
                <input
                  type="month"
                  value={bulkTargetMonth}
                  onChange={(event) => {
                    setBulkTargetMonth(event.target.value);
                    setBulkNoticeMessage("");
                    setBulkCopied(false);
                  }}
                />

                <div className="logic-note">
                  {bulkRepaymentRows.length} notice-pending repayment schedules
                  found for selected month.
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="monitor-btn monitor-btn-primary"
                    onClick={handleGenerateBulkNotices}
                  >
                    Generate All Notices
                  </button>

                  <button
                    type="button"
                    className="monitor-btn monitor-btn-secondary"
                    disabled={!bulkNoticeMessage}
                    onClick={handleCopyBulkNotices}
                  >
                    {bulkCopied ? "Copied All Notices" : "Copy All Notices"}
                  </button>

                  <button
                    type="button"
                    className="monitor-btn monitor-btn-secondary"
                    disabled={bulkRepaymentRows.length === 0 || bulkPdfGenerating}
                    onClick={handleDownloadBulkPdf}
                  >
                    {bulkPdfGenerating ? "Generating PDF Pack..." : "Download PDF Pack"}
                  </button>
                </div>
              </div>

              {bulkNoticeMessage && (
                <pre className="notice-preview-box">{bulkNoticeMessage}</pre>
              )}
            </div>
          </>
        )}

       {!loading && !errorMessage && (
  <div className="preview-card">
    <h2>Repayment Notice History & Send Queue</h2>

    <div className="explain-box">
      Track generated repayment notices, mark them as sent, record reminder
      follow-ups, and manage queue-level notice actions. Actual email
      integration will be added in the next phase.
    </div>

    <div className="impact-grid">
      <button
        type="button"
        className="impact-card"
        onClick={() => setQueueStatusFilter("all")}
      >
        <h3>{queueStats.all}</h3>
        <p>All notices</p>
      </button>

      <button
        type="button"
        className="impact-card"
        onClick={() => setQueueStatusFilter("not_sent")}
      >
        <h3>{queueStats.notSent}</h3>
        <p>Not sent</p>
      </button>

      <button
        type="button"
        className="impact-card"
        onClick={() => setQueueStatusFilter("sent")}
      >
        <h3>{queueStats.sent}</h3>
        <p>Sent</p>
      </button>

      <button
        type="button"
        className="impact-card"
        onClick={() => setQueueStatusFilter("reminder_sent")}
      >
        <h3>{queueStats.reminderSent}</h3>
        <p>Reminder sent</p>
      </button>
    </div>
<div className="impact-grid">
  <div className="impact-card">
    <h3>{dispatchStats.total}</h3>
    <p>Total notices</p>
  </div>

  <div className="impact-card">
    <h3>{dispatchStats.pendingDispatch}</h3>
    <p>Pending dispatch</p>
  </div>

  <div className="impact-card">
    <h3>{dispatchStats.draftPrepared}</h3>
    <p>Email drafts prepared</p>
  </div>

  <div className="impact-card">
    <h3>{dispatchStats.emailSent}</h3>
    <p>Email sent</p>
  </div>
</div>
    <div className="logic-note">
      Current filter: {statusLabel(queueStatusFilter)}
    </div>
    <div className="action-row">
  <button
    type="button"
    className="monitor-btn monitor-btn-secondary"
    disabled={queueActionLoadingId === "cleanup-stale-batches"}
    onClick={handleCleanupStaleNoticeBatches}
  >
    {queueActionLoadingId === "cleanup-stale-batches"
      ? "Cleaning..."
      : "Clean Stale Batches"}
  </button>
</div>

    {queueActionMessage && (
      <div className="logic-note">{queueActionMessage}</div>
    )}

    {repaymentNoticeHistory.length === 0 && (
  <div className="explain-box">
    No active repayment notices are currently available in the send queue.
    Generate a repayment notice from the selected schedule above to start the
    operational workflow.
  </div>
)}

    {repaymentNoticeHistory.length > 0 &&
  filteredRepaymentNoticeHistory.length === 0 && (
    <div className="explain-box">
      No notices match the selected queue filter. Try switching back to All
      notices or generate a new notice.
    </div>
  )}

    {filteredRepaymentNoticeHistory.length > 0 && (
      <div className="review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
  <th>Company</th>
  <th>Recipient</th>
  <th>Email Ready</th>
  <th>Email Draft</th>
  <th>Email Dispatch</th>
  <th>Email Sent At</th>
  <th>Due Date</th>
  <th>Notice Status</th>
  <th>Delivery Status</th>
  <th>Generated At</th>
  <th>Sent At</th>
  <th>Reminder Sent At</th>
  <th className="queue-status-column">Queue Status</th>
<th>Operational Status</th>
<th className="last-action-column">Last Action</th>
<th>Attempts</th>
<th>Actions</th>
</tr>
          </thead>

          <tbody>
            {filteredRepaymentNoticeHistory.map((notice) => {
              const noticeId = getId(notice);
              const markSentLoading = queueActionLoadingId === `sent-${noticeId}`;
              const reminderLoading =
                queueActionLoadingId === `reminder-${noticeId}`;
           const pdfLoading = queueActionLoadingId === `pdf-${noticeId}`;
const draftLoading = queueActionLoadingId === `draft-${noticeId}`;
const emailSendLoading =
  queueActionLoadingId === `send-email-${noticeId}`;

const showMarkSent = canMarkNoticeSent(notice);
const showReminderSent = canMarkReminderSent(notice);
const emailReady = getBoolean(notice, ["email_ready"], false);
const emailDraftPrepared = isEmailDraftPrepared(notice);
const emailDispatched = isEmailDispatched(notice);
const showSendEmail = canSimulateEmailDispatch(notice);
const resetEmailLoading =
  queueActionLoadingId === `reset-email-${noticeId}`;

const dispatchStatus = getEmailDispatchStatus(notice);
const manualActionsLocked = dispatchStatus === "sent";

              return (
                <tr key={noticeId}>
  <td>
    <strong>
      {getString(notice, ["company_name"], "Portfolio Company")}
    </strong>
  </td>

  <td>
    {getString(notice, ["recipient_email"], "Missing")}
  </td>

 <td>
  {getEmailReadyBadge(notice)}
</td>

<td>
  {renderStatusBadge(
    getString(notice, ["email_draft_status"], "not_prepared")
  )}
</td>

<td>
  {renderStatusBadge(
    getString(notice, ["email_dispatch_status"], "not_sent")
  )}
</td>

<td>{formatDate(notice["email_sent_at"])}</td>

<td>{formatDate(notice["due_date"])}</td>

                  <td>
  {renderStatusBadge(getString(notice, ["notice_status"], ""))}
</td>

                  <td>
  {renderStatusBadge(getString(notice, ["delivery_status"], ""))}
</td>

                  <td>{formatDate(notice["created_at"])}</td>

                  <td>{formatDate(notice["sent_at"])}</td>

                  <td>{formatDate(notice["reminder_sent_at"])}</td>

               <td className="queue-status-column">
  <strong>{getQueueCompletionLabel(notice)}</strong>
</td>

<td>
  {renderOperationalWorkflowBadge(notice)}
</td>

<td className="last-action-column">
  <div className="last-action-box">
    <strong>{formatDate(notice["last_action_at"])}</strong>
    <span title={getString(notice, ["last_action_note"], "-")}>
      {getShortLastActionNote(notice)}
    </span>
  </div>
</td>
<td>
  {getNumber(notice, ["email_send_attempt_count"])}
</td>

<td className="queue-actions-cell">
  <div className="queue-actions">
    {showMarkSent && !manualActionsLocked && (
      <button
        type="button"
        className="monitor-btn monitor-btn-secondary queue-action-btn"
        disabled={queueActionLoadingId.length > 0}
        onClick={() => handleMarkNoticeSent(notice)}
      >
        {markSentLoading ? "Updating..." : "Mark Sent"}
      </button>
    )}
    {showSendEmail && (
  <button
    type="button"
    className="monitor-btn monitor-btn-secondary queue-action-btn"
    disabled={queueActionLoadingId.length > 0}
    onClick={() => handleSimulateEmailDispatch(notice)}
  >
    {emailSendLoading ? "Sending..." : "Send Email"}
  </button>
)}

{emailDispatched && (
  <>
    <span className="queue-completed-badge">Email Sent</span>

    <button
      type="button"
      className="monitor-btn monitor-btn-secondary queue-action-btn"
      disabled={queueActionLoadingId.length > 0}
      onClick={() => handleResetEmailDispatch(notice)}
    >
      {resetEmailLoading ? "Resetting..." : "Reset Dispatch"}
    </button>
  </>
)}

    {showReminderSent && (
      <button
        type="button"
        className="monitor-btn monitor-btn-secondary queue-action-btn"
        disabled={queueActionLoadingId.length > 0}
        onClick={() => handleMarkReminderSent(notice)}
      >
        {reminderLoading ? "Updating..." : "Reminder Sent"}
      </button>
    )}

    {!showMarkSent && !showReminderSent && (
      <span className="queue-completed-badge">Completed</span>
    )}

    {emailReady && !emailDraftPrepared && (
      <button
        type="button"
        className="monitor-btn monitor-btn-secondary queue-action-btn"
        disabled={queueActionLoadingId.length > 0}
        onClick={() => handlePrepareEmailDraft(notice)}
      >
        {draftLoading ? "Preparing..." : "Prepare Email"}
      </button>
    )}

    {emailReady && emailDraftPrepared && (
      <button
        type="button"
        className="monitor-btn monitor-btn-secondary queue-action-btn"
        disabled={queueActionLoadingId.length > 0}
        onClick={() => handleCopyEmailDraft(notice)}
      >
        Copy Email
      </button>
    )}

    {!emailReady && (
      <span className="queue-completed-badge">Email Missing</span>
    )}

    <button
      type="button"
      className="monitor-btn monitor-btn-secondary queue-action-btn"
      disabled={queueActionLoadingId.length > 0}
      onClick={() => handleViewNoticeFromQueue(notice)}
    >
      View
    </button>

    <button
      type="button"
      className="monitor-btn monitor-btn-secondary queue-action-btn"
      disabled={queueActionLoadingId.length > 0}
      onClick={() => handleCopyNoticeFromQueue(notice)}
    >
      Copy
    </button>

    <button
      type="button"
      className="monitor-btn monitor-btn-secondary queue-action-btn"
      disabled={queueActionLoadingId.length > 0}
      onClick={() => handleDownloadQueueNoticePdf(notice)}
    >
      {pdfLoading ? "PDF..." : "PDF"}
    </button>
  </div>
</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    {repaymentNoticeBatches.length > 0 && (
      <div className="logic-note">
        Latest batch:{" "}
        {getString(repaymentNoticeBatches[0], ["notice_type"], "-")} •{" "}
        {getNumber(repaymentNoticeBatches[0], ["total_notices"])} notices •{" "}
        {formatDate(repaymentNoticeBatches[0]["created_at"])}
      </div>
    )}
  </div>
)}

           
      </section>
    </main>
  );
}