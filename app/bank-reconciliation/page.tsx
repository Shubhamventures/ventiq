"use client";

import Link from "next/link";
import { type ChangeEvent, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type TransactionDirection = "Credit" | "Debit";
type TransactionStatus =
  | "Auto Mapped"
  | "Needs Review"
  | "Approved"
  | "Synced"
  | "Learning";
type DownstreamModule =
  | "Capital Call"
  | "Debt LMS"
  | "Accounting"
  | "Expense"
  | "Investor Portal"
  | "Unmapped";

type BankTransaction = {
  id: string;
  date: string;
  narration: string;
  amount: number;
  direction: TransactionDirection;
  counterparty: string;
  aiSuggestion: string;
  category: string;
  downstreamModule: DownstreamModule;
  confidence: number;
  status: TransactionStatus;
  explanation: string;
  action: string;
  borrowerName?: string;
  dueDate?: string;
  principalReceived?: number;
  interestReceived?: number;
  feesReceived?: number;
  penaltyReceived?: number;
  otherReceived?: number;
  bankReference?: string;
};

type LearningRule = {
  id: string;
  pattern: string;
  mapTo: string;
  downstreamModule: DownstreamModule;
  confidenceLift: string;
  source: string;
};

type MissingItem = {
  id: string;
  transactionId: string;
  narration: string;
  amount: number;
  reason: string;
  guidance: string;
  status: "Open" | "Guidance Added" | "Resolved";
};

const sampleTransactions: BankTransaction[] = [
  {
    id: "txn-001",
    date: "2026-08-01",
    narration: "NEFT SIDBI CAPITAL CALL CC-2026-07",
    amount: 50000000,
    direction: "Credit",
    counterparty: "SIDBI",
    aiSuggestion: "Capital Call Receipt",
    category: "Investor contribution",
    downstreamModule: "Capital Call",
    confidence: 98,
    status: "Auto Mapped",
    explanation:
      "Narration contains SIDBI and CC-2026-07. Amount matches open capital call receivable.",
    action: "Approve capital call receipt and prepare journal entry",
    bankReference: "UTR-SIDBI-001",
  },
  {
    id: "txn-002",
    date: "2026-08-01",
    narration: "NEFT ALPHA FINTECH REPAYMENT AUG",
    amount: 3625000,
    direction: "Credit",
    counterparty: "Alpha Fintech Pvt Ltd",
    aiSuggestion: "Debt repayment receipt",
    category: "Debt LMS collection",
    downstreamModule: "Debt LMS",
    confidence: 96,
    status: "Auto Mapped",
    explanation:
      "Borrower name and amount match the Debt LMS repayment schedule for August.",
    action: "Sync receipt to Debt LMS",
    borrowerName: "Alpha Fintech Pvt Ltd",
    dueDate: "2026-08-15",
    principalReceived: 2500000,
    interestReceived: 1125000,
    feesReceived: 0,
    penaltyReceived: 0,
    otherReceived: 0,
    bankReference: "UTR-ALPHA-001",
  },
  {
    id: "txn-003",
    date: "2026-08-01",
    narration: "NEFT NOVA HEALTH SYSTEMS INSTL AUG",
    amount: 2980000,
    direction: "Credit",
    counterparty: "Nova Health Systems",
    aiSuggestion: "Partial debt repayment receipt",
    category: "Debt LMS collection",
    downstreamModule: "Debt LMS",
    confidence: 92,
    status: "Needs Review",
    explanation:
      "Borrower matched, but amount is lower than total due. Finance review required before sync.",
    action: "Review component breakup and sync partial receipt",
    borrowerName: "Nova Health Systems",
    dueDate: "2026-08-05",
    principalReceived: 2000000,
    interestReceived: 980000,
    feesReceived: 0,
    penaltyReceived: 0,
    otherReceived: 0,
    bankReference: "UTR-NOVA-002",
  },
  {
    id: "txn-004",
    date: "2026-08-01",
    narration: "BANK INT CREDIT JULY",
    amount: 1240000,
    direction: "Credit",
    counterparty: "Bank Interest",
    aiSuggestion: "Bank Interest Income",
    category: "Interest income",
    downstreamModule: "Accounting",
    confidence: 94,
    status: "Auto Mapped",
    explanation:
      "Interest narration matched previous monthly bank interest pattern.",
    action: "Prepare Dr Bank / Cr Interest Income journal",
    bankReference: "UTR-BANKINT-001",
  },
  {
    id: "txn-005",
    date: "2026-08-02",
    narration: "IM FEE PAYMENT JULY",
    amount: 1800000,
    direction: "Debit",
    counterparty: "Investment Manager",
    aiSuggestion: "Management Fee Payment",
    category: "Fund expense",
    downstreamModule: "Expense",
    confidence: 82,
    status: "Needs Review",
    explanation:
      "Vendor recognised, but amount differs from prior month by ₹5,000.",
    action: "Finance review required before posting",
    bankReference: "UTR-IMFEE-001",
  },
  {
    id: "txn-006",
    date: "2026-08-02",
    narration: "UNKNOWN CREDIT 4200000",
    amount: 4200000,
    direction: "Credit",
    counterparty: "Unknown",
    aiSuggestion: "Possible investor receipt",
    category: "Unclassified",
    downstreamModule: "Unmapped",
    confidence: 51,
    status: "Needs Review",
    explanation:
      "No open capital call, debt repayment schedule or historical counterparty pattern matched this entry.",
    action: "Ask Finance Head for guidance",
    bankReference: "UTR-UNKNOWN-001",
  },
];

const sampleLearningRules: LearningRule[] = [
  {
    id: "rule-001",
    pattern: "Narration contains SIDBI + capital call reference",
    mapTo: "Capital Call Receipt",
    downstreamModule: "Capital Call",
    confidenceLift: "98% future confidence",
    source: "Approved historical receipt",
  },
  {
    id: "rule-002",
    pattern: "Borrower name + repayment month + Debt LMS due amount",
    mapTo: "Debt LMS Receipt",
    downstreamModule: "Debt LMS",
    confidenceLift: "96% future confidence",
    source: "Debt LMS repayment schedule",
  },
  {
    id: "rule-003",
    pattern: "BANK INT CREDIT + monthly recurring bank interest",
    mapTo: "Interest Income",
    downstreamModule: "Accounting",
    confidenceLift: "94% future confidence",
    source: "Prior 11 months matched",
  },
];

const sampleMissingItems: MissingItem[] = [
  {
    id: "missing-001",
    transactionId: "txn-006",
    narration: "UNKNOWN CREDIT 4200000",
    amount: 4200000,
    reason: "No matching capital call, loan repayment, investor history or borrower pattern found.",
    guidance:
      "Finance Head should classify this once. If the same narration or counterparty appears again, VENTIQ will auto-map it.",
    status: "Open",
  },
];

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "₹0";

  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)} Cr`;
  }

  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(1)} L`;
  }

  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function buildDebtReceiptPayload(transaction: BankTransaction) {
  const principalReceived = transaction.principalReceived || 0;
  const interestReceived = transaction.interestReceived || 0;
  const feesReceived = transaction.feesReceived || 0;
  const penaltyReceived = transaction.penaltyReceived || 0;
  const otherReceived = transaction.otherReceived || 0;

  return {
    borrower_name: transaction.borrowerName || transaction.counterparty,
    due_date: transaction.dueDate || transaction.date,
    receipt_date: transaction.date,
    bank_reference: transaction.bankReference || transaction.id,
    bank_narration: transaction.narration,
    principal_received: principalReceived,
    interest_received: interestReceived,
    fees_received: feesReceived,
    penalty_received: penaltyReceived,
    other_received: otherReceived,
    total_received:
      principalReceived +
      interestReceived +
      feesReceived +
      penaltyReceived +
      otherReceived,
    match_status: "Approved",
    sync_status: "Ready",
    confidence: transaction.confidence,
    remarks: "Approved from Bank MIS / Bank Reconciliation",
  };
}

export default function BankReconciliationPage() {
  const [connectionMode, setConnectionMode] = useState<"Bank Access" | "Daily Upload">(
    "Daily Upload"
  );
  const [transactions, setTransactions] = useState<BankTransaction[]>(sampleTransactions);
  const [learningRules, setLearningRules] = useState<LearningRule[]>(sampleLearningRules);
  const [missingItems, setMissingItems] = useState<MissingItem[]>(sampleMissingItems);
  const [selectedGuidanceTransaction, setSelectedGuidanceTransaction] =
    useState<BankTransaction | null>(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [runMessage, setRunMessage] = useState(
    "Daily Bank MIS is ready. Use bank access or upload a statement to process today’s transactions."
  );
  const [syncMessage, setSyncMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncingDebt, setIsSyncingDebt] = useState(false);

  const metrics = useMemo(() => {
    const totalTransactions = transactions.length;
    const autoMapped = transactions.filter((row) => row.status === "Auto Mapped").length;
    const approved = transactions.filter(
      (row) => row.status === "Approved" || row.status === "Synced"
    ).length;
    const reviewQueue = transactions.filter((row) => row.status === "Needs Review").length;
    const debtLmsReady = transactions.filter(
      (row) => row.downstreamModule === "Debt LMS" && row.status !== "Synced"
    ).length;
    const cashClassified = transactions.reduce(
      (sum, row) => (row.status === "Needs Review" ? sum : sum + row.amount),
      0
    );
    const averageConfidence = Math.round(
      transactions.reduce((sum, row) => sum + row.confidence, 0) / transactions.length
    );

    return {
      totalTransactions,
      autoMapped,
      approved,
      reviewQueue,
      debtLmsReady,
      cashClassified,
      averageConfidence,
    };
  }, [transactions]);

  function handleStatementUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setConnectionMode("Daily Upload");
    setRunMessage(
      `${file.name} uploaded. VENTIQ extracted ${transactions.length} transaction(s), auto-mapped ${metrics.autoMapped}, and moved ${metrics.reviewQueue} to Finance Head review.`
    );
  }

  async function runDailyBankMis() {
    setIsProcessing(true);
    setSyncMessage("");

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    setRunMessage(
      connectionMode === "Bank Access"
        ? `Bank access sync complete. ${metrics.totalTransactions} transaction(s) fetched today, ${metrics.autoMapped} auto-mapped and ${metrics.reviewQueue} require review.`
        : `Daily statement processing complete. ${metrics.totalTransactions} transaction(s) imported, ${metrics.autoMapped} auto-mapped and ${metrics.reviewQueue} require review.`
    );
    setIsProcessing(false);
  }

  async function approveTransaction(transactionId: string) {
    const transaction = transactions.find((row) => row.id === transactionId);

    if (!transaction) return;

    if (transaction.downstreamModule === "Debt LMS") {
      await syncSingleDebtReceipt(transaction);
      return;
    }

    setTransactions((currentRows) =>
      currentRows.map((row) =>
        row.id === transactionId ? { ...row, status: "Approved" } : row
      )
    );

    setRunMessage(`${transaction.aiSuggestion} approved and ready for journal entry.`);
  }

  async function syncSingleDebtReceipt(transaction: BankTransaction) {
    setIsSyncingDebt(true);
    setSyncMessage("");

    try {
      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;
        const { error } = await db
          .from("bank_reconciliation_debt_receipts")
          .insert(buildDebtReceiptPayload(transaction));

        if (error) {
          throw new Error(error.message);
        }
      }

      setTransactions((currentRows) =>
        currentRows.map((row) =>
          row.id === transaction.id ? { ...row, status: "Synced" } : row
        )
      );

      setSyncMessage(
        `${transaction.counterparty} receipt synced to Debt LMS bridge. Open Debt LMS and run Sync from Bank Reconciliation.`
      );
    } catch (error) {
      setSyncMessage(
        error instanceof Error
          ? `Debt LMS sync failed: ${error.message}`
          : "Debt LMS sync failed."
      );
    } finally {
      setIsSyncingDebt(false);
    }
  }

  async function syncDebtLmsReceipts() {
    const debtReceipts = transactions.filter(
      (row) =>
        row.downstreamModule === "Debt LMS" &&
        (row.status === "Auto Mapped" || row.status === "Approved" || row.status === "Needs Review")
    );

    if (debtReceipts.length === 0) {
      setSyncMessage("No Debt LMS receipts available for sync.");
      return;
    }

    setIsSyncingDebt(true);
    setSyncMessage("");

    try {
      if (isSupabaseConfigured && supabase) {
        const db = supabase as any;
        const { error } = await db
          .from("bank_reconciliation_debt_receipts")
          .insert(debtReceipts.map(buildDebtReceiptPayload));

        if (error) {
          throw new Error(error.message);
        }
      }

      const ids = debtReceipts.map((row) => row.id);

      setTransactions((currentRows) =>
        currentRows.map((row) =>
          ids.includes(row.id) ? { ...row, status: "Synced" } : row
        )
      );

      setSyncMessage(
        `${debtReceipts.length} approved debt receipt(s) pushed to Debt LMS bridge.`
      );
    } catch (error) {
      setSyncMessage(
        error instanceof Error
          ? `Debt LMS sync failed: ${error.message}`
          : "Debt LMS sync failed."
      );
    } finally {
      setIsSyncingDebt(false);
    }
  }

  function openGuidance(transaction: BankTransaction) {
    setSelectedGuidanceTransaction(transaction);
    setGuidanceText(
      transaction.downstreamModule === "Unmapped"
        ? "Map this narration to investor receipt / borrower receipt / expense / income."
        : transaction.action
    );
  }

  function applyFinanceGuidance() {
    if (!selectedGuidanceTransaction) return;

    const nextRule: LearningRule = {
      id: crypto.randomUUID(),
      pattern: selectedGuidanceTransaction.narration,
      mapTo: guidanceText || selectedGuidanceTransaction.aiSuggestion,
      downstreamModule:
        selectedGuidanceTransaction.downstreamModule === "Unmapped"
          ? "Accounting"
          : selectedGuidanceTransaction.downstreamModule,
      confidenceLift: "Future confidence increased to 90%+",
      source: "Finance Head guidance",
    };

    setLearningRules((currentRules) => [nextRule, ...currentRules]);
    setMissingItems((currentItems) =>
      currentItems.map((item) =>
        item.transactionId === selectedGuidanceTransaction.id
          ? { ...item, guidance: guidanceText, status: "Guidance Added" }
          : item
      )
    );
    setTransactions((currentRows) =>
      currentRows.map((row) =>
        row.id === selectedGuidanceTransaction.id
          ? {
              ...row,
              status: "Learning",
              aiSuggestion: guidanceText || row.aiSuggestion,
              explanation:
                "Finance Head guidance captured. Similar entries will be auto-mapped in future runs.",
              confidence: Math.max(row.confidence, 90),
            }
          : row
      )
    );

    setRunMessage(
      "Guidance captured. VENTIQ will use this pattern for future Bank MIS mapping."
    );
    setSelectedGuidanceTransaction(null);
    setGuidanceText("");
  }

  return (
    <main className="bank-page">
      <style>{`
        .bank-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 34rem),
            radial-gradient(circle at top right, rgba(245, 200, 91, 0.15), transparent 30rem),
            #07101f;
          color: #f8fbff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 34px;
        }

        .bank-shell {
          max-width: 1240px;
          margin: 0 auto;
        }

        .bank-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #f5c85b;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 950;
          margin: 0 0 14px;
        }

        h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 74px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .hero-copy {
          margin: 20px 0 0;
          color: #c7d7f4;
          font-size: 18px;
          line-height: 1.65;
          max-width: 820px;
        }

        .bank-actions,
        .panel-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primary-button,
        .secondary-button,
        .upload-button,
        .small-action,
        .back-link {
          border-radius: 999px;
          padding: 12px 17px;
          font-size: 14px;
          font-weight: 950;
          text-decoration: none;
          border: 0;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button,
        .upload-button {
          background: #f5c85b;
          color: #07101f;
        }

        .secondary-button,
        .back-link {
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.24);
        }

        .small-action {
          background: rgba(245, 200, 91, 0.14);
          color: #fde68a;
          border: 1px solid rgba(245, 200, 91, 0.26);
          padding: 9px 12px;
          font-size: 12px;
        }

        .hidden-file {
          display: none;
        }

        .mode-grid,
        .metric-grid,
        .two-col,
        .learning-grid {
          display: grid;
          gap: 14px;
        }

        .mode-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 18px;
        }

        .metric-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          margin-bottom: 18px;
        }

        .two-col {
          grid-template-columns: 1.15fr 0.85fr;
          margin-bottom: 18px;
        }

        .learning-grid {
          grid-template-columns: 0.9fr 1.1fr;
        }

        .panel,
        .mode-card,
        .metric-card,
        .transaction-card {
          border: 1px solid rgba(147, 197, 253, 0.16);
          background: rgba(15, 23, 42, 0.76);
          border-radius: 24px;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.20);
        }

        .mode-card,
        .metric-card,
        .transaction-card,
        .panel {
          padding: 20px;
        }

        .mode-card.active {
          border-color: rgba(245, 200, 91, 0.52);
          background: rgba(30, 41, 59, 0.92);
        }

        .mode-card h3,
        .panel h2,
        .transaction-card h3 {
          margin: 0;
          letter-spacing: -0.04em;
        }

        .mode-card p,
        .panel p,
        .transaction-card p {
          color: #9db3d7;
          line-height: 1.55;
        }

        .metric-card span {
          display: block;
          color: #9db3d7;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .metric-card strong {
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .run-ribbon,
        .sync-ribbon {
          border: 1px solid rgba(245, 200, 91, 0.22);
          background: rgba(245, 200, 91, 0.10);
          color: #fde68a;
          border-radius: 18px;
          padding: 14px 18px;
          margin-bottom: 18px;
          font-weight: 850;
          line-height: 1.45;
        }

        .sync-ribbon {
          border-color: rgba(34, 197, 94, 0.26);
          background: rgba(22, 163, 74, 0.12);
          color: #bbf7d0;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(147, 197, 253, 0.12);
          border-radius: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }

        th,
        td {
          padding: 14px;
          border-bottom: 1px solid rgba(147, 197, 253, 0.10);
          text-align: left;
          vertical-align: top;
        }

        th {
          color: #9db3d7;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        td {
          color: #eaf2ff;
          line-height: 1.45;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .right {
          text-align: right;
        }

        .status-pill,
        .module-pill,
        .direction-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .status-auto-mapped,
        .status-approved,
        .status-synced {
          background: rgba(22, 163, 74, 0.24);
          color: #bbf7d0;
        }

        .status-needs-review {
          background: rgba(245, 158, 11, 0.24);
          color: #fde68a;
        }

        .status-learning {
          background: rgba(59, 130, 246, 0.24);
          color: #bfdbfe;
        }

        .module-pill {
          background: rgba(59, 130, 246, 0.18);
          color: #bfdbfe;
        }

        .direction-credit {
          background: rgba(22, 163, 74, 0.20);
          color: #bbf7d0;
        }

        .direction-debit {
          background: rgba(239, 68, 68, 0.18);
          color: #fecaca;
        }

        .transaction-list,
        .rule-list,
        .missing-list {
          display: grid;
          gap: 12px;
        }

        .transaction-card {
          display: grid;
          gap: 10px;
        }

        .transaction-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .transaction-card small {
          color: #9db3d7;
        }

        .rule-item,
        .missing-item,
        .journal-box,
        .guidance-box {
          border: 1px solid rgba(147, 197, 253, 0.12);
          background: rgba(2, 6, 23, 0.28);
          border-radius: 18px;
          padding: 14px;
        }

        .rule-item strong,
        .missing-item strong,
        .journal-box strong {
          color: #ffffff;
        }

        .rule-item p,
        .missing-item p,
        .journal-box p {
          margin: 7px 0 0;
          color: #c7d7f4;
          line-height: 1.5;
        }

        .guidance-box textarea {
          width: 100%;
          min-height: 96px;
          border-radius: 16px;
          border: 1px solid rgba(147, 197, 253, 0.18);
          background: rgba(15, 23, 42, 0.82);
          color: #ffffff;
          padding: 12px;
          font: inherit;
          resize: vertical;
          margin: 10px 0;
        }

        @media (max-width: 980px) {
          .bank-header,
          .panel-header {
            flex-direction: column;
          }

          .mode-grid,
          .metric-grid,
          .two-col,
          .learning-grid {
            grid-template-columns: 1fr;
          }

          .bank-actions,
          .panel-actions {
            justify-content: flex-start;
          }
        }
      `}</style>

      <section className="bank-shell">
        <div className="bank-header">
          <div>
            <p className="eyebrow">VENTIQ Bank MIS</p>
            <h1>AI Bank Reconciliation</h1>
            <p className="hero-copy">
              Daily Bank MIS for private capital funds. Connect bank account
              access or upload statements, let VENTIQ classify transactions,
              send unmatched items to Finance Head review, learn from guidance,
              prepare journal entries and push approved receipts to downstream
              workflows including Debt LMS.
            </p>
          </div>

          <div className="bank-actions">
            <Link className="back-link" href="/finance">
              Back to Finance
            </Link>
            <Link className="secondary-button" href="/debt-lms">
              Open Debt LMS
            </Link>
          </div>
        </div>

        <div className="mode-grid">
          <button
            className={`mode-card ${connectionMode === "Bank Access" ? "active" : ""}`}
            onClick={() => setConnectionMode("Bank Access")}
            type="button"
          >
            <h3>Bank Account Access</h3>
            <p>
              VENTIQ fetches transactions daily from connected bank accounts,
              validates opening and closing balances and starts reconciliation
              automatically.
            </p>
          </button>

          <button
            className={`mode-card ${connectionMode === "Daily Upload" ? "active" : ""}`}
            onClick={() => setConnectionMode("Daily Upload")}
            type="button"
          >
            <h3>Daily Statement Upload</h3>
            <p>
              Finance team uploads bank statements daily or frequently. VENTIQ
              reads narrations, maps transactions and creates review queues.
            </p>
          </button>
        </div>

        <div className="run-ribbon">{runMessage}</div>
        {syncMessage && <div className="sync-ribbon">{syncMessage}</div>}

        <div className="metric-grid">
          <div className="metric-card">
            <span>Transactions</span>
            <strong>{metrics.totalTransactions}</strong>
          </div>
          <div className="metric-card">
            <span>Auto mapped</span>
            <strong>{metrics.autoMapped}</strong>
          </div>
          <div className="metric-card">
            <span>Review queue</span>
            <strong>{metrics.reviewQueue}</strong>
          </div>
          <div className="metric-card">
            <span>Avg confidence</span>
            <strong>{metrics.averageConfidence}%</strong>
          </div>
          <div className="metric-card">
            <span>Cash classified</span>
            <strong>{formatCurrency(metrics.cashClassified)}</strong>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Daily Bank MIS Processing Center</h2>
              <p>
                Run daily sync, upload a statement, approve mappings and push
                debt receipts to Debt LMS.
              </p>
            </div>

            <div className="panel-actions">
              <button
                className="primary-button"
                disabled={isProcessing}
                onClick={runDailyBankMis}
                type="button"
              >
                {isProcessing ? "Processing..." : "Run Daily Bank MIS"}
              </button>

              <label className="upload-button">
                Upload Statement
                <input
                  accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden-file"
                  onChange={handleStatementUpload}
                  type="file"
                />
              </label>

              <button
                className="secondary-button"
                disabled={isSyncingDebt}
                onClick={syncDebtLmsReceipts}
                type="button"
              >
                {isSyncingDebt ? "Syncing..." : "Sync Debt LMS Receipts"}
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Narration</th>
                  <th>Direction</th>
                  <th className="right">Amount</th>
                  <th>AI Suggestion</th>
                  <th>Module</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>
                      <strong>{transaction.narration}</strong>
                      <br />
                      <small>{transaction.explanation}</small>
                    </td>
                    <td>
                      <span
                        className={`direction-pill direction-${transaction.direction.toLowerCase()}`}
                      >
                        {transaction.direction}
                      </span>
                    </td>
                    <td className="right">{formatCurrency(transaction.amount)}</td>
                    <td>{transaction.aiSuggestion}</td>
                    <td>
                      <span className="module-pill">{transaction.downstreamModule}</span>
                    </td>
                    <td>{transaction.confidence}%</td>
                    <td>
                      <span
                        className={`status-pill status-${statusClass(transaction.status)}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td>
                      <div className="panel-actions">
                        <button
                          className="small-action"
                          onClick={() => approveTransaction(transaction.id)}
                          type="button"
                        >
                          {transaction.downstreamModule === "Debt LMS"
                            ? "Approve / Sync"
                            : "Approve"}
                        </button>

                        <button
                          className="small-action"
                          onClick={() => openGuidance(transaction)}
                          type="button"
                        >
                          Guide AI
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Finance Head Exception Review</h2>
                <p>
                  Missing or low-confidence items are escalated here. Once guided,
                  the same pattern becomes auto-mappable in future runs.
                </p>
              </div>
            </div>

            <div className="missing-list">
              {missingItems.map((item) => (
                <div className="missing-item" key={item.id}>
                  <strong>{item.narration}</strong>
                  <p>{formatCurrency(item.amount)} · {item.reason}</p>
                  <p>{item.guidance}</p>
                  <span className={`status-pill status-${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>AI Learning Rules</h2>
                <p>
                  Approved rules improve future mapping for investor receipts,
                  debt receipts, bank interest, fees, expenses and unknown items.
                </p>
              </div>
            </div>

            <div className="rule-list">
              {learningRules.map((rule) => (
                <div className="rule-item" key={rule.id}>
                  <strong>{rule.pattern}</strong>
                  <p>
                    Map to {rule.mapTo} · {rule.downstreamModule} · {rule.confidenceLift}
                  </p>
                  <p>Source: {rule.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="learning-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>VENTIQ AI Guidance</h2>
                <p>
                  Select any transaction and teach VENTIQ how it should map next
                  time.
                </p>
              </div>
            </div>

            {selectedGuidanceTransaction ? (
              <div className="guidance-box">
                <strong>{selectedGuidanceTransaction.narration}</strong>
                <p>{selectedGuidanceTransaction.explanation}</p>
                <textarea
                  value={guidanceText}
                  onChange={(event) => setGuidanceText(event.target.value)}
                  placeholder="Example: Map this narration to Debt LMS receipt for Alpha Fintech principal and interest collection."
                />
                <div className="panel-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setSelectedGuidanceTransaction(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    onClick={applyFinanceGuidance}
                    type="button"
                  >
                    Save Guidance
                  </button>
                </div>
              </div>
            ) : (
              <div className="guidance-box">
                <strong>No transaction selected</strong>
                <p>Click Guide AI on any transaction to create a reusable mapping rule.</p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Generated Journal Entry Preview</h2>
                <p>
                  Approved mappings can generate downstream accounting entries
                  and operational updates.
                </p>
              </div>
            </div>

            <div className="journal-box">
              <strong>Investor Capital Call Receipt</strong>
              <p>Dr Bank · ₹5.00 Cr</p>
              <p>Cr Capital Receivable — SIDBI · ₹5.00 Cr</p>
              <p>Validation: Amount, narration and ledger verified.</p>
            </div>

            <div className="journal-box" style={{ marginTop: 12 }}>
              <strong>Debt LMS Receipt Sync</strong>
              <p>Borrower: Alpha Fintech Pvt Ltd</p>
              <p>Principal received: ₹25.0 L · Interest received: ₹11.3 L</p>
              <p>Downstream: bank_reconciliation_debt_receipts → Debt LMS sync.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}