import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const scenarioPath = path.join(
  root,
  "quality",
  "fixtures",
  "client-001",
  "quarter-end",
  "p2d-q2-fy27-quarter-end-scenario.json",
);

if (!fs.existsSync(scenarioPath)) {
  throw new Error(`P2D scenario missing: ${scenarioPath}`);
}

const s = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function repoHasMarker(marker) {
  try {
    const output = execFileSync(
      "git",
      ["grep", "-l", "-I", "-F", "--", marker, "--", "app", "scripts", "quality"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

assert(s.synthetic_only === true, "P2D scenario must be synthetic-only.");
assert(s.period?.financial_year === "FY27", "Expected FY27.");
assert(s.period?.quarter === "Q2", "Expected Q2.");
assert(s.period?.period_end === "2026-09-30", "Expected 30-Sep-2026 quarter end.");
assert(s.ready_close?.close_ready === true, "Ready-close phase must be ready.");
assert(s.draft_close?.close_ready === false, "Draft-close phase must fail closed.");

const opening = s.opening_fund_position;
const ready = s.ready_close;

const rollForward =
  opening.opening_nav +
  ready.capital_calls_received +
  ready.portfolio_interest_income +
  ready.portfolio_valuation_movement -
  ready.distributions_paid -
  ready.fees_and_expenses;

assert(
  rollForward === ready.closing_nav,
  `Fund NAV roll-forward mismatch: calculated ${rollForward}, expected ${ready.closing_nav}`,
);

const cashRollForward =
  opening.opening_cash +
  ready.capital_calls_received +
  ready.portfolio_interest_income -
  ready.distributions_paid -
  ready.fees_and_expenses;

assert(
  cashRollForward === ready.closing_cash,
  `Closing cash mismatch: calculated ${cashRollForward}, expected ${ready.closing_cash}`,
);

assert(
  ready.closing_portfolio_fair_value + ready.closing_cash === ready.closing_nav,
  "Closing NAV must equal closing portfolio fair value plus closing cash.",
);

assert(
  s.portfolio.closing_fair_value - s.portfolio.opening_fair_value ===
    s.portfolio.valuation_movement,
  "Portfolio valuation movement does not reconcile.",
);

const investors = s.investors || [];
assert(investors.length === 2, "P2D scenario must contain exactly two synthetic investors.");

for (const investor of investors) {
  assert(
    investor.opening_called_to_date + investor.quarter_capital_call ===
      investor.closing_called_to_date,
    `${investor.investor_code}: called-capital roll-forward mismatch.`,
  );

  assert(
    investor.closing_called_to_date + investor.closing_uncalled_capital ===
      investor.commitment_amount,
    `${investor.investor_code}: commitment math mismatch.`,
  );

  assert(
    investor.opening_nav +
      investor.quarter_capital_call -
      investor.quarter_distribution +
      investor.allocated_quarter_net_operating_gain ===
      investor.closing_nav,
    `${investor.investor_code}: investor NAV roll-forward mismatch.`,
  );
}

assert(
  sum(investors.map((x) => x.ownership_weight)) === 1,
  "Investor ownership weights must total 1.0.",
);

assert(
  sum(investors.map((x) => x.quarter_capital_call)) ===
    s.capital_activity.capital_call.total_call,
  "Investor capital-call allocations do not equal the fund-level call.",
);

assert(
  s.capital_activity.capital_call.total_received ===
    s.capital_activity.capital_call.total_call,
  "Capital-call receipts do not fully cover the quarter call.",
);

assert(
  sum(investors.map((x) => x.quarter_distribution)) ===
    s.capital_activity.distribution.total_distribution,
  "Investor distribution allocations do not equal the fund-level distribution.",
);

assert(
  sum(investors.map((x) => x.closing_nav)) === ready.closing_nav,
  "Investor closing NAV values do not sum to fund closing NAV.",
);

assert(
  sum(investors.map((x) => x.commitment_amount)) === 50000000,
  "Total commitments must equal INR 50,000,000.",
);

assert(
  sum(investors.map((x) => x.closing_called_to_date)) === 28000000,
  "Closing called capital must equal INR 28,000,000.",
);

assert(
  sum(investors.map((x) => x.closing_uncalled_capital)) === 22000000,
  "Closing uncalled capital must equal INR 22,000,000.",
);

assert(
  sum(s.fund_expenses.map((x) => x.amount)) === ready.fees_and_expenses,
  "Quarter fee/expense detail does not equal close total.",
);

assert(
  s.debt_close.scheduled_interest_due === s.debt_close.cash_received,
  "Debt schedule interest due must equal cash received.",
);

assert(
  s.debt_close.cash_received === s.portfolio.quarter_interest_cash_receipt,
  "Debt receipt must equal portfolio interest cashflow evidence.",
);

assert(
  s.draft_close.draft_closing_nav - s.draft_close.expected_closing_nav ===
    s.draft_close.nav_reconciliation_delta,
  "Draft NAV delta math mismatch.",
);

assert(
  s.draft_close.nav_reconciliation_delta === s.draft_close.missing_expense,
  "Missing close-required expense must explain the entire draft NAV delta.",
);

assert(
  s.draft_close.open_validation_exceptions > 0 &&
    s.draft_close.open_compliance_items > 0,
  "Draft phase must contain both validation and compliance blockers.",
);

assert(
  ready.open_validation_exceptions === 0 &&
    ready.open_compliance_items === 0,
  "Ready phase must contain zero validation/compliance blockers.",
);

const requiredMarkers = s.operating_tables || [];
const missingMarkers = requiredMarkers.filter((marker) => !repoHasMarker(marker));

assert(
  missingMarkers.length === 0,
  `Current repo is missing P2D operating-table marker(s): ${missingMarkers.join(", ")}`,
);

assert(
  Array.isArray(s.p2d3_contract_extraction_required) &&
    s.p2d3_contract_extraction_required.length >= 4,
  "P2D-3 contract-extraction requirements are incomplete.",
);

assert(
  s.governance_assertions.some((item) =>
    String(item).includes("does not invent a new approval action type"),
  ),
  "Scenario must explicitly forbid inventing a new quarter-close approval action type.",
);

console.log("PASS - P2D Q2 FY27 synthetic quarter-end scenario verified");
console.log("PASS - opening NAV + quarter activity -> closing NAV math reconciles");
console.log("PASS - closing NAV = portfolio fair value + cash");
console.log("PASS - portfolio valuation movement reconciles");
console.log("PASS - capital-call allocations + receipts reconcile");
console.log("PASS - distribution allocations reconcile");
console.log("PASS - fund fee/expense detail reconciles");
console.log("PASS - investor NAV roll-forwards reconcile to fund close");
console.log("PASS - commitment / called / uncalled math reconciles");
console.log("PASS - debt schedule interest due matches cash receipt");
console.log("PASS - draft close has deterministic INR 50,000 validation delta");
console.log("PASS - draft close is fail-closed on validation + compliance blockers");
console.log("PASS - ready close has zero blockers");
console.log("PASS - all required existing operating-table markers are present");
console.log("PASS - P2D-3 exact contract extraction is explicitly required before live mutation");
console.log("PASS - P2D-2 quarter-end rehearsal scenario contract");