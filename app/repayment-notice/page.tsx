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

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadRepaymentData();
  }, []);

 async function loadRepaymentData() {
  if (!isSupabaseConfigured || !supabase) {
    setErrorMessage("Supabase is not configured. Please check .env.local.");
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

    return (
      dueDate.getFullYear() === targetYear &&
      dueDate.getMonth() + 1 === targetMonth &&
      isUnpaidStatus
    );
  });
}, [debtRepayments, bulkTargetMonth]);

  async function handleGenerateNotice() {
  setNoticeMessage(noticePreview);
  setCopied(false);

  if (selectedRepayment) {
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
}

  async function handleCopyNotice() {
    if (!noticeMessage) return;

    await navigator.clipboard.writeText(noticeMessage);
    setCopied(true);
  }
  async function handleGenerateBulkNotices() {
  if (bulkRepaymentRows.length === 0) {
    setBulkNoticeMessage(
      "No unpaid or upcoming repayment schedules found for the selected month."
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
    };
  });

  const noticesResult = await supabase
    .from("repayment_notices")
    .insert(noticeRows);

  if (noticesResult.error) {
    throw new Error(noticesResult.error.message);
  }

  await loadRepaymentData();
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
        "No unpaid or upcoming repayment schedules found for the selected month."
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

        {loading && (
          <div className="preview-card">
            <h2>Loading repayment schedules...</h2>
            <p>VENTIQ is reading portfolio and repayment data from Supabase.</p>
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
                notice draft and copy it for email or operational follow-up.
                PDF generation will be added in the next phase.
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
                  <h3>{portfolioCompanies.length}</h3>
                  <p>Portfolio companies</p>
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
                        const company = companyMap.get(
                          getString(repayment, ["portfolio_company_id"], "")
                        );

                        const companyName = getString(
                          company,
                          ["company_name", "name", "title"],
                          "Unknown Company"
                        );

                        const totalDue = getNumber(repayment, [
                          "total_due",
                          "amount_due",
                          "total_amount",
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
                      Current status:{" "}
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
                    </div>

                    <div className="action-row">
                      <button
                        type="button"
                        className="monitor-btn monitor-btn-primary"
                        onClick={handleGenerateNotice}
                      >
                        Generate Notice Draft
                      </button>

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
                unpaid, upcoming or overdue repayment schedules due in that
                month. Bulk email sending will be connected in the next phase.
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
                  {bulkRepaymentRows.length} repayment notices found for selected
                  month.
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

    {repaymentNoticeHistory.length === 0 && (
      <div className="explain-box">
        No repayment notices generated yet. Generate a single or bulk notice to
        create history.
      </div>
    )}

    {repaymentNoticeHistory.length > 0 && (
      <div className="review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Due Date</th>
              <th>Notice Status</th>
              <th>Delivery Status</th>
              <th>Generated At</th>
            </tr>
          </thead>

          <tbody>
            {repaymentNoticeHistory.map((notice) => (
              <tr key={getId(notice)}>
                <td>
                  <strong>
                    {getString(notice, ["company_name"], "Portfolio Company")}
                  </strong>
                </td>
                <td>{formatDate(notice["due_date"])}</td>
                <td>{statusLabel(getString(notice, ["notice_status"], ""))}</td>
                <td>{statusLabel(getString(notice, ["delivery_status"], ""))}</td>
                <td>{formatDate(notice["created_at"])}</td>
              </tr>
            ))}
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