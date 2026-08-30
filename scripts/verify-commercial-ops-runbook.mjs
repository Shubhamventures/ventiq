import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = "docs/operations/client-001-incident-recovery-runbook.md";
const file = path.join(root, rel);

const required = [
  "## 2. Severity model",
  "## 3. First-response checklist",
  "## 4. Application rollback — Vercel",
  "## 5. Database / Supabase incident containment",
  "## 6. Security / isolation incident",
  "## 7. Approval / governance incident",
  "## 8. Investor Portal / Data Room incident",
  "## 9. Sentry monitoring procedure",
  "## 10. Recovery validation gate",
  "## 11. Internal pilot recovery targets",
  "## 12. Incident record template",
  "## 13. Closure criteria",
  "`npm test`",
];

if (!fs.existsSync(file)) {
  console.error(`FAIL - operational runbook missing: ${rel}`);
  process.exit(1);
}

const text = fs.readFileSync(file, "utf8");
const missing = required.filter((marker) => !text.includes(marker));

if (missing.length) {
  console.error("FAIL - operational runbook is incomplete:");
  for (const marker of missing) console.error(`  missing: ${marker}`);
  process.exit(1);
}

console.log("PASS - Client 001 incident/recovery runbook is present and complete");
