import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as XLSX from "xlsx";

const repoRoot = process.cwd();
const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error("Usage: node scripts/generate-client001-structured-intake-fixtures.mjs <output-directory>");
}

const uiPath = path.join(repoRoot, "app", "migration", "data-intake", "page.tsx");
const processPath = path.join(repoRoot, "app", "api", "migration", "process-intake", "route.ts");
const scenarioPath = path.join(
  repoRoot,
  "quality",
  "fixtures",
  "client-001",
  "structured-intake-scenario.json",
);

const uiSource = fs.readFileSync(uiPath, "utf8");
const processSource = fs.readFileSync(processPath, "utf8");
const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

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

const sourceContractMarkers = [
  'requiredSheet: true',
  'requiredFields: ["investor_code", "investor_name", "email"]',
  '"REQUIRED_FIELD_MISSING"',
  '"REQUIRED_SHEET_MISSING"',
  '"DUPLICATE_SOURCE_KEY"',
  "source_batch_id",
  "source_sheet_name",
  "source_row_number",
];

for (const marker of sourceContractMarkers) {
  if (!processSource.includes(marker)) {
    throw new Error(`Current process-intake source contract marker missing: ${marker}`);
  }
}

function extractCanonicalDatasetFactory(source) {
  const marker = "function createCanonicalDatasets";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error("createCanonicalDatasets function not found.");
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) {
    throw new Error("createCanonicalDatasets opening brace not found.");
  }

  let depth = 0;
  let end = -1;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error("createCanonicalDatasets closing brace not found.");
  }

  let fnSource = source.slice(start, end);
  fnSource = fnSource.replace(
    /function createCanonicalDatasets\(fundName:\s*string\):\s*CanonicalDataset\[\]/,
    "function createCanonicalDatasets(fundName)",
  );

  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${fnSource}; this.__createCanonicalDatasets = createCanonicalDatasets;`,
    context,
  );

  if (typeof context.__createCanonicalDatasets !== "function") {
    throw new Error("Unable to evaluate canonical dataset factory.");
  }

  return context.__createCanonicalDatasets;
}

const createCanonicalDatasets = extractCanonicalDatasetFactory(uiSource);
const datasets = createCanonicalDatasets(scenario.synthetic_fund_name);

if (!Array.isArray(datasets) || datasets.length !== expectedSheets.length) {
  throw new Error(
    `Expected ${expectedSheets.length} canonical datasets; found ${datasets?.length ?? "unknown"}.`,
  );
}

const actualSheets = datasets.map((dataset) => dataset.sheetName);
if (JSON.stringify(actualSheets) !== JSON.stringify(expectedSheets)) {
  throw new Error(
    `Canonical sheet order/names changed.\nExpected: ${expectedSheets.join(", ")}\nActual: ${actualSheets.join(", ")}`,
  );
}

for (const dataset of datasets) {
  if (!Array.isArray(dataset.headers) || dataset.headers.length === 0) {
    throw new Error(`Dataset ${dataset.sheetName} has no headers.`);
  }
  if (!Array.isArray(dataset.example) || dataset.example.length !== dataset.headers.length) {
    throw new Error(
      `Dataset ${dataset.sheetName} example/header length mismatch: ${dataset.example?.length} vs ${dataset.headers.length}.`,
    );
  }
}

function cloneDatasets() {
  return datasets.map((dataset) => ({
    ...dataset,
    headers: [...dataset.headers],
    example: [...dataset.example],
  }));
}

function writeWorkbook(filePath, caseDatasets, rowOverrides = new Map()) {
  const workbook = XLSX.utils.book_new();

  for (const dataset of caseDatasets) {
    const override = rowOverrides.get(dataset.sheetName);
    const dataRows = override ?? [dataset.example];
    const worksheet = XLSX.utils.aoa_to_sheet([dataset.headers, ...dataRows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, dataset.sheetName);
  }

  const workbookBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    compression: true,
  });
  fs.writeFileSync(filePath, workbookBuffer);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

fs.mkdirSync(outputDir, { recursive: true });

const generated = [];

// Case 1: canonical valid workbook.
{
  const fileName = "client001-valid-canonical.xlsx";
  const filePath = path.join(outputDir, fileName);
  writeWorkbook(filePath, cloneDatasets());
  generated.push({ id: "valid_canonical", file: fileName, sha256: sha256(filePath) });
}

// Case 2: required Investor_Master email blank.
{
  const caseDatasets = cloneDatasets();
  const investor = caseDatasets.find((dataset) => dataset.sheetName === "Investor_Master");
  if (!investor) throw new Error("Investor_Master dataset missing.");

  const emailIndex = investor.headers.indexOf("email");
  if (emailIndex < 0) throw new Error("Investor_Master email column missing.");

  investor.example[emailIndex] = "";

  const fileName = "client001-missing-required-field.xlsx";
  const filePath = path.join(outputDir, fileName);
  writeWorkbook(filePath, caseDatasets);
  generated.push({
    id: "missing_required_field",
    file: fileName,
    sha256: sha256(filePath),
  });
}

// Case 3: required Fund_Master sheet omitted.
{
  const caseDatasets = cloneDatasets().filter(
    (dataset) => dataset.sheetName !== "Fund_Master",
  );

  const fileName = "client001-missing-required-sheet.xlsx";
  const filePath = path.join(outputDir, fileName);
  writeWorkbook(filePath, caseDatasets);
  generated.push({
    id: "missing_required_sheet",
    file: fileName,
    sha256: sha256(filePath),
  });
}

// Case 4: duplicate Investor_Master source key.
{
  const caseDatasets = cloneDatasets();
  const investor = caseDatasets.find((dataset) => dataset.sheetName === "Investor_Master");
  if (!investor) throw new Error("Investor_Master dataset missing.");

  const duplicate = [...investor.example];
  const nameIndex = investor.headers.indexOf("investor_name");
  if (nameIndex >= 0) duplicate[nameIndex] = "Aarav Shah Duplicate Row";

  const overrides = new Map([
    ["Investor_Master", [[...investor.example], duplicate]],
  ]);

  const fileName = "client001-duplicate-source-key.xlsx";
  const filePath = path.join(outputDir, fileName);
  writeWorkbook(filePath, caseDatasets, overrides);
  generated.push({
    id: "duplicate_source_key",
    file: fileName,
    sha256: sha256(filePath),
  });
}

const manifest = {
  generated_at: new Date().toISOString(),
  synthetic_fund_name: scenario.synthetic_fund_name,
  canonical_sheet_count: expectedSheets.length,
  source_contract_markers_verified: sourceContractMarkers,
  generated,
};

fs.writeFileSync(
  path.join(outputDir, "fixture-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log("PASS - canonical dataset factory extracted from current VENTIQ source");
console.log("PASS - SheetJS buffer IO path used (no XLSX.readFile/writeFile filesystem adapter)");
console.log("PASS - required-field/sheet validation markers verified in process-intake");
console.log(`PASS - canonical sheets verified=${expectedSheets.length}`);
console.log(`PASS - structured-intake workbooks generated=${generated.length}`);
console.log(`FIXTURE_DIR=${outputDir}`);