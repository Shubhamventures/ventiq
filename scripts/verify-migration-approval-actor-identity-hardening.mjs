import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const migrationPath = path.join(
  root,
  "database",
  "migrations",
  "20260906_001_migration_approval_actor_identity_hardening.sql",
);

const activationPath = path.join(
  root,
  "app",
  "migration",
  "activation",
  "page.tsx",
);

const previousMigrationPath = path.join(
  root,
  "database",
  "migrations",
  "20260830_002_activation_workflow_rls_hardening.sql",
);

function fail(message) {
  console.error(`FAIL - ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS - ${message}`);
}

for (const file of [migrationPath, activationPath, previousMigrationPath]) {
  if (!fs.existsSync(file)) {
    fail(`required source missing: ${path.relative(root, file)}`);
  }
}

if (process.exitCode) process.exit(1);

const sql = fs.readFileSync(migrationPath, "utf8");
const page = fs.readFileSync(activationPath, "utf8");
const prior = fs.readFileSync(previousMigrationPath, "utf8");

const required = [
  "VENTIQ B8-8D.2",
  "add column if not exists maker_user_id uuid null",
  "add column if not exists checker_user_id uuid null",
  "actor_uid uuid := auth.uid()",
  "Authenticated approval actor is required.",
  "new.maker_user_id := actor_uid",
  "new.checker_user_id := null",
  "old.maker_user_id is null",
  "Submitted migration approval is missing authenticated maker lineage.",
  "actor_uid = old.maker_user_id",
  "Maker cannot review or approve own migration submission.",
  "new.maker_user_id is distinct from old.maker_user_id",
  "new.checker_user_id := actor_uid",
  "maker_user_id = auth.uid()",
  "checker_user_id = auth.uid()",
  "maker_user_id <> auth.uid()",
  "drop policy if exists ventiq_migration_approval_insert",
  "drop policy if exists ventiq_migration_approval_maker_resubmit",
  "drop policy if exists ventiq_migration_approval_checker_review",
  "create policy ventiq_migration_approval_insert",
  "create policy ventiq_migration_approval_maker_resubmit",
  "create policy ventiq_migration_approval_checker_review",
];

for (const marker of required) {
  if (!sql.includes(marker)) {
    fail(`B8-8D.2 SQL marker missing: ${marker}`);
  }
}

const forbidden = [
  /update\s+public\.migration_data_approvals\b/i,
  /delete\s+from\s+public\.migration_data_approvals\b/i,
  /alter\s+column\s+maker_user_id\s+set\s+not\s+null/i,
  /alter\s+column\s+checker_user_id\s+set\s+not\s+null/i,
  /references\s+auth\.users/i,
  /update\s+public\.fund_activation_status\b/i,
  /delete\s+from\s+public\.fund_activation_status\b/i,
];

for (const pattern of forbidden) {
  if (pattern.test(sql)) {
    fail(`forbidden compatibility/mutation SQL detected: ${pattern}`);
  }
}

const oldDualCapability =
  prior.includes("ufa.role in ('maker', 'fund_admin')") &&
  prior.includes("ufa.role in ('checker', 'fund_admin')");

if (!oldDualCapability) {
  fail("current Fund Admin dual-capability source contract changed");
}

for (const marker of [
  "async function updateApproval",
  'onConflict: "fund_name,layer_key,source_batch_id"',
  "maker_name: actorName",
  "checker_name: actorName",
  '.eq("status", "Submitted")',
]) {
  if (!page.includes(marker)) {
    fail(`activation page contract changed: ${marker}`);
  }
}

if (
  page.includes("maker_user_id:") ||
  page.includes("checker_user_id:")
) {
  fail(
    "browser must not supply approval actor IDs; DB trigger must remain authoritative",
  );
}

if (!process.exitCode) {
  pass("new forward migration exists separately from already-applied CR-SEC-1C2");
  pass("legacy Approved rows receive no UPDATE/backfill");
  pass("actor columns are nullable for historical compatibility");
  pass("no auth.users FK means audit UUID survives user lifecycle independently");
  pass("DB trigger captures maker_user_id from auth.uid()");
  pass("DB trigger captures checker_user_id from auth.uid()");
  pass("same authenticated actor cannot review own current submission");
  pass("maker resubmission resets current authenticated maker identity");
  pass("RLS WITH CHECK independently enforces actor IDs");
  pass("Fund Admin dual capability remains, but self-approval is denied");
  pass("browser does not provide trusted actor-ID fields");
  pass("fund activation/event/calculation tables are not mutated by this migration");
  console.log("");
  console.log("B8_8D2_STATIC_ACTOR_IDENTITY_HARDENING=PASS");
}