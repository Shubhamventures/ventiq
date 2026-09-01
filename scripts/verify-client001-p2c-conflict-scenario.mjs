import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = path.join(
  root,
  "quality",
  "fixtures",
  "client-001",
  "reconciliation",
  "p2c-conflict-resolution-scenario.json",
);
const p2bPath = path.join(
  root,
  "quality",
  "fixtures",
  "client-001",
  "pdf-intelligence",
  "p2b-pdf-intelligence-scenario.json",
);
const pdfPath = path.join(
  root,
  "quality",
  "fixtures",
  "client-001",
  "pdf-intelligence",
  "client001-capital-call-notice-2026-07-15.pdf",
);
const pdfApiPath = path.join(root, "app", "api", "migration", "pdf-intelligence", "route.ts");
const approvalPath = path.join(root, "app", "api", "admin", "approval-workflow", "route.ts");

for (const p of [scenarioPath, p2bPath, pdfPath, pdfApiPath, approvalPath]) {
  if (!fs.existsSync(p)) throw new Error(`Required P2C dependency missing: ${p}`);
}

const s = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
const p2b = JSON.parse(fs.readFileSync(p2bPath, "utf8"));
const pdfApi = fs.readFileSync(pdfApiPath, "utf8");
const approval = fs.readFileSync(approvalPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function num(v, label) {
  const n = Number(String(v).replace(/,/g, ""));
  assert(Number.isFinite(n), `${label} is not numeric`);
  return n;
}

assert(s.synthetic_only === true, "P2C scenario must be explicitly synthetic-only.");
assert(s.live_test_contract?.reporting_period === "Q2 FY27", "P2C period must align to the Capital Call fixture.");
assert(s.source_fixtures?.capital_call_pdf?.endsWith("client001-capital-call-notice-2026-07-15.pdf"), "P2C must reuse the checkpointed P2B Capital Call fixture.");

const p2bCall = p2b.capital_call;
assert(p2bCall, "P2B capital_call fixture contract missing.");

const pdfExpected = s.pdf_reconciliation_evidence;
assert(num(p2bCall.commitment_amount, "P2B commitment") === pdfExpected.commitment_amount, "P2C PDF commitment diverges from P2B fixture.");
assert(num(p2bCall.cumulative_capital_called, "P2B cumulative called") === pdfExpected.capital_called_to_date, "P2C PDF cumulative called diverges from P2B fixture.");
assert(num(p2bCall.remaining_uncalled_commitment, "P2B remaining uncalled") === pdfExpected.uncalled_capital, "P2C PDF uncalled diverges from P2B fixture.");
assert(p2bCall.notice_number === pdfExpected.notice_number, "P2C notice number diverges from P2B fixture.");
assert(p2bCall.notice_date === pdfExpected.notice_date, "P2C notice date diverges from P2B fixture.");
assert(p2bCall.due_date === pdfExpected.due_date, "P2C due date diverges from P2B fixture.");

const structured = s.structured_reconciliation_evidence;
assert(structured.commitment_amount === pdfExpected.commitment_amount, "Commitment amount must deliberately MATCH.");
assert(structured.capital_called_to_date !== pdfExpected.capital_called_to_date, "Capital called must deliberately CONFLICT.");
assert(structured.uncalled_capital !== pdfExpected.uncalled_capital, "Uncalled capital must deliberately CONFLICT.");
assert(
  structured.commitment_amount === structured.capital_called_to_date + structured.uncalled_capital,
  "Structured commitment equation is inconsistent.",
);
assert(
  pdfExpected.commitment_amount === pdfExpected.capital_called_to_date + pdfExpected.uncalled_capital,
  "PDF commitment equation is inconsistent.",
);

const expected = Object.fromEntries(s.expected_reconciliation.map((r) => [r.key, r]));
assert(expected.commitment_amount?.status === "MATCHED", "commitment_amount should be MATCHED.");
assert(expected.capital_called_to_date?.status === "CONFLICT", "capital_called_to_date should be CONFLICT.");
assert(expected.uncalled_capital?.status === "CONFLICT", "uncalled_capital should be CONFLICT.");

const first = s.resolution_sequence?.first_draft;
const final = s.resolution_sequence?.final_draft;
assert(first?.expected_unresolved_decision_count === 1, "First draft must retain exactly one unresolved row.");
assert(first?.canonical_preparation_must_fail === true, "First draft must fail closed on canonical preparation.");
assert(final?.expected_unresolved_decision_count === 0, "Final draft must resolve all rows.");
assert(final?.canonical_preparation_must_succeed === true, "Final draft must permit canonical preparation.");

for (const d of final.decisions) {
  assert(d.choice === "use_pdf", `Final decision ${d.key} must use PDF evidence.`);
  assert(String(d.note || "").trim().length > 0, `Final decision ${d.key} requires a resolution note.`);
}

const base = s.base_approved_snapshot;
const candidate = s.expected_pending_canonical_candidate;
assert(base.approval_status === "approved", "Base snapshot must start approved.");
assert(base.commitment_amount === 10000000, "Unexpected base commitment.");
assert(base.capital_called === 5000000, "Unexpected base capital called.");
assert(base.uncalled_capital === 5000000, "Unexpected base uncalled.");
assert(candidate.commitment_amount === pdfExpected.commitment_amount, "Canonical commitment must equal resolved evidence.");
assert(candidate.capital_called === pdfExpected.capital_called_to_date, "Canonical called must use PDF resolution.");
assert(candidate.uncalled_capital === pdfExpected.uncalled_capital, "Canonical uncalled must use PDF resolution.");
assert(candidate.net_contributed === candidate.capital_called - candidate.distributions_to_date, "Canonical net contributed math mismatch.");
assert(candidate.commitment_amount === candidate.capital_called + candidate.uncalled_capital, "Canonical commitment equation mismatch.");
assert(candidate.approval_status === "pending_approval", "Candidate must begin pending approval.");
assert(candidate.canonical_write_state === "pending_final_approval", "Candidate write state must be pending_final_approval.");

const pdfMarkers = [
  "MATCHED",
  "CONFLICT",
  "save_resolution_draft",
  "use_pdf",
  "unresolvedDecisionCount",
  "prepare_canonical_candidate",
  "PDF_CANONICAL_UNRESOLVED_ROWS",
  "pending_final_approval",
  "investor_position_snapshots",
  "sourceResolutionSidecarPath",
  "attach_approval_request",
  "PublicationGate",
  "publicationApprovalRequestId",
];
for (const marker of pdfMarkers) {
  assert(pdfApi.includes(marker), `Current PDF Intelligence source marker missing: ${marker}`);
}

const approvalMarkers = [
  "create_request",
  "decide_request",
  "Checker Review",
  "Final Approval",
  "FINAL_APPROVER_ROLES",
  "Fund Memory Approval",
  "investor_position_snapshots",
];
for (const marker of approvalMarkers) {
  assert(approval.includes(marker), `Current approval source marker missing: ${marker}`);
}

console.log("PASS - P2C deliberate conflict scenario verified");
console.log("PASS - P2B Capital Call fixture values locked into P2C");
console.log("PASS - commitment_amount deliberately MATCHED");
console.log("PASS - capital_called_to_date deliberately CONFLICT");
console.log("PASS - uncalled_capital deliberately CONFLICT");
console.log("PASS - first resolution draft retains exactly one unresolved row");
console.log("PASS - final resolution draft explicitly chooses PDF for both conflicts");
console.log("PASS - expected canonical commitment math reconciles");
console.log("PASS - expected canonical net contributed math reconciles");
console.log("PASS - current reconciliation/resolution/canonical/approval source markers verified");
console.log("PASS - P2C-2 conflict-resolution scenario contract");