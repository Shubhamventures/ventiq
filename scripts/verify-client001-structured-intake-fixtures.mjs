import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const repoRoot = process.cwd();
const fixtureDir = process.argv[2];

if (!fixtureDir) {
  throw new Error("Usage: node scripts/verify-client001-structured-intake-fixtures.mjs <fixture-directory>");
}

const scenarioPath = path.join(
  repoRoot,
  "quality",
  "fixtures",
  "client-001",
  "structured-intake-scenario.json",
);
const processPath = path.join(repoRoot, "app", "api", "migration", "process-intake", "route.ts");

const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
const processSource = fs.readFileSync(processPath, "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "fixture-manifest.json"), "utf8"),
);

const expectedSheets = [
  "Fund_Master",
  "Investor_Master",
  "Commitments",
  "Investor_Cashflows",
  "Capital_Call_Events",
  "Capital_Call_Allocations",
  "Capital_Call_Receipts",
  "Distribution_Events",
  "Distribution_Allocations",
  "Portfolio_Master",
  "Portfolio_Cashflows",
  "Portfolio_Valuations",
  "Fund_NAV_Snapshots",
  "Fund_Fee_Expenses",
  "Debt_Repayment_Schedule",
  "Compliance_Items",
];

function readWorkbook(fileName) {
  const filePath = path.join(fixtureDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Fixture missing: ${fileName}`);
  const workbookBuffer = fs.readFileSync(filePath);
  return XLSX.read(workbookBuffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });
}

function sheetRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Sheet ${sheetName} missing.`);
  return XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
}

for (const marker of [
  '"REQUIRED_FIELD_MISSING"',
  '"REQUIRED_SHEET_MISSING"',
  '"DUPLICATE_SOURCE_KEY"',
]) {
  if (!processSource.includes(marker)) {
    throw new Error(`Required processing marker missing from current source: ${marker}`);
  }
}

if (manifest.canonical_sheet_count !== expectedSheets.length) {
  throw new Error("Fixture manifest canonical sheet count mismatch.");
}

const valid = readWorkbook("client001-valid-canonical.xlsx");
if (JSON.stringify(valid.SheetNames) !== JSON.stringify(expectedSheets)) {
  throw new Error("Valid canonical workbook sheet set/order mismatch.");
}
for (const sheetName of expectedSheets) {
  const rows = sheetRows(valid, sheetName);
  if (rows.length < 1) {
    throw new Error(`Valid workbook ${sheetName} contains no representative row.`);
  }
}

const missingField = readWorkbook("client001-missing-required-field.xlsx");
const missingFieldRows = sheetRows(missingField, "Investor_Master");
if (missingFieldRows.length < 1 || String(missingFieldRows[0].email ?? "").trim() !== "") {
  throw new Error("Missing-required-field fixture did not blank Investor_Master.email.");
}

const missingSheet = readWorkbook("client001-missing-required-sheet.xlsx");
if (missingSheet.SheetNames.includes("Fund_Master")) {
  throw new Error("Missing-required-sheet fixture still contains Fund_Master.");
}
if (missingSheet.SheetNames.length !== expectedSheets.length - 1) {
  throw new Error("Missing-required-sheet fixture has unexpected sheet count.");
}

const duplicate = readWorkbook("client001-duplicate-source-key.xlsx");
const duplicateRows = sheetRows(duplicate, "Investor_Master");
if (duplicateRows.length !== 2) {
  throw new Error(`Duplicate-source-key fixture expected 2 Investor_Master rows; found ${duplicateRows.length}.`);
}
if (duplicateRows[0].investor_code !== duplicateRows[1].investor_code) {
  throw new Error("Duplicate-source-key fixture investor_code values do not match.");
}

if (!Array.isArray(scenario.future_e2e_assertions) || scenario.future_e2e_assertions.length < 8) {
  throw new Error("Scenario does not define sufficient future E2E assertions.");
}

console.log("PASS - valid workbook has all 16 sheets and representative rows");
console.log("PASS - missing-required-field fixture verified");
console.log("PASS - missing-required-sheet fixture verified");
console.log("PASS - duplicate-source-key fixture verified");
console.log("PASS - validation source markers verified");
console.log(`PASS - future E2E assertions=${scenario.future_e2e_assertions.length}`);
console.log("PASS - P2A-2 structured-intake regression fixture preflight");