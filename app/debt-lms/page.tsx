"use client";

import { useMemo, useState } from "react";

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

const loans: DebtLoan[] = [
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

const repaymentRows: RepaymentRow[] = [
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

const covenantRows: CovenantRow[] = [
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

const noticeRows: NoticeRow[] = [
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

const bankMatches: BankMatchRow[] = [
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

export default function DebtLMSPage() {
  const [selectedLoanId, setSelectedLoanId] = useState(loans[0].id);
  const selectedLoan = loans.find((loan) => loan.id === selectedLoanId) ?? loans[0];

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
  }, []);

  const selectedSchedule = repaymentRows.filter((row) => row.loanId === selectedLoan.id);
  const selectedCovenants = covenantRows.filter((row) => row.loanId === selectedLoan.id);

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
          grid-template-columns: 1.15fr 0.85fr;
          gap: 18px;
          margin-bottom: 18px;
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
            <button className="debt-primary" type="button">
              Add New Loan
            </button>

            <button className="debt-secondary" type="button">
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
          Complete debt fund flow · Term sheet intelligence → repayment schedule
          → notices → email dispatch → bank matching → penalty/default tracking
        </div>

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
              <button className="debt-secondary" type="button">
                Generate Reminder Notices
              </button>

              <button className="debt-secondary" type="button">
                Send Email Queue
              </button>
            </div>
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
                  <th>Status</th>
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
                    <td>
                      <span className={`status-pill status-${statusClass(row.status)}`}>
                        {row.status}
                      </span>
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

              <a className="debt-secondary" href="/bank-reconciliation">
                Open Bank Matching
              </a>
            </div>

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
              selectedSchedule.map((row) => (
                <div className="selected-loan-main" key={row.id}>
                  <h3>{formatDate(row.dueDate)}</h3>
                  <p>
                    Total due {formatCurrency(row.totalDue)} · received{" "}
                    {formatCurrency(row.receivedAmount)} · pending{" "}
                    {formatCurrency(row.pendingAmount)}
                  </p>

                  <span className={`status-pill status-${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </div>
              ))
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

              <button className="debt-primary" type="button">
                Send Queued Emails
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

                  <button className="small-action" type="button">
                    Add Penalty
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