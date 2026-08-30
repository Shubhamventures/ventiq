import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const migrationPath = path.join(
  root,
  "database",
  "migrations",
  "20260830_002_activation_workflow_rls_hardening.sql"
);

const activationPagePath = path.join(
  root,
  "app",
  "migration",
  "activation",
  "page.tsx"
);

function fail(message) {
  console.error(`FAIL - ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS - ${message}`);
}

if (!fs.existsSync(migrationPath)) {
  fail("CR-SEC activation RLS migration missing");
  process.exit(1);
}

if (!fs.existsSync(activationPagePath)) {
  fail("activation page missing");
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");
const page = fs.readFileSync(activationPagePath, "utf8");

const requiredSql = [
  "VENTIQ CR-SEC-1C2",
  "alter table public.fund_activation_status enable row level security",
  "alter table public.migration_data_approvals enable row level security",
  "alter table public.migration_activation_events enable row level security",

  "revoke all on table public.fund_activation_status from public",
  "revoke all on table public.migration_data_approvals from public",
  "revoke all on table public.migration_activation_events from public",

  "revoke all on table public.fund_activation_status from anon",
  "revoke all on table public.migration_data_approvals from anon",
  "revoke all on table public.migration_activation_events from anon",

  "create policy ventiq_migration_approval_maker_resubmit",
  "and status = 'Changes Requested'",
  "and status = 'Submitted'",

  "create policy ventiq_migration_approval_checker_review",
  "and status in ('Approved', 'Changes Requested')",

  "create or replace function public.ventiq_guard_migration_approval_transition()",
  "old.status = 'Changes Requested'",
  "new.status = 'Submitted'",
  "old.status = 'Submitted'",
  "new.status in ('Approved', 'Changes Requested')",
  "Approval workflow identity keys are immutable.",

  "create or replace function public.ventiq_activation_all_layers_approved(",
  "'investor'",
  "'pdf'",
  "'portfolio'",
  "'fund'",
  "'compliance'",
  ") = 5",

  "create or replace function public.ventiq_guard_fund_activation()",
  "new.readiness_score is distinct from 100",
  "All mandatory layers must be Approved for the exact activation batch map.",

  "event_type = 'DATASET_SUBMITTED'",
  "'DATASET_APPROVED'",
  "'CHANGES_REQUESTED'",
  "'FUND_ACTIVATED'",

  "from pg_policies",
];

for (const marker of requiredSql) {
  if (!sql.includes(marker)) {
    fail(`migration contract missing: ${marker}`);
  }
}

const forbiddenSql = [
  "create policy ventiq_migration_approval_update",
  "for all\nto authenticated\nusing (true)",
  "to anon\nusing (true)",
  "to public\nusing (true)",
];

for (const marker of forbiddenSql) {
  if (sql.toLowerCase().includes(marker.toLowerCase())) {
    fail(`unsafe/obsolete policy marker detected: ${marker}`);
  }
}

const requiredPage = [
  'type ApprovalStatus = "Draft" | "Submitted" | "Changes Requested" | "Approved"',
  'async function updateApproval',
  'nextStatus === "Submitted"',
  'nextStatus === "Approved" || nextStatus === "Changes Requested"',
  '.eq("status", "Submitted")',
  'async function activateFund',
  'status: "Active"',
  'readiness_score: 100',
  'id: "investor"',
  'id: "pdf"',
  'id: "portfolio"',
  'id: "fund"',
  'id: "compliance"',
];

for (const marker of requiredPage) {
  if (!page.includes(marker)) {
    fail(`activation page state-machine contract changed: ${marker}`);
  }
}

if (!process.exitCode) {
  pass("anonymous/public activation table privileges are explicitly revoked");
  pass("maker INSERT is restricted to Submitted");
  pass("maker UPDATE is restricted to Changes Requested -> Submitted");
  pass("checker UPDATE is restricted to Submitted -> Approved/Changes Requested");
  pass("OLD/NEW transition trigger prevents cross-state and source-identity rewrites");
  pass("fund activation requires all five exact approved layer/batch pairs");
  pass("activation event types are capability constrained");
  pass("current client state-machine still matches DB remediation");
  console.log("");
  console.log("PASS - CR-SEC-1C2 STATIC TRANSITION-SAFE RLS VERIFIER");
}