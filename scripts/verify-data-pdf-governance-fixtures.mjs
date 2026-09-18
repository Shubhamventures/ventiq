import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual route implementation with all imports removed. No service
// client, environment file, PDF worker or network implementation is loaded.
const path = "app/api/migration/pdf-intelligence/route.ts";
const source = fs.readFileSync(path, "utf8");
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
const isolated = ast.statements.filter((node) => !ts.isImportDeclaration(node))
  .map((node) => node.getText(ast)).join("\n");
let tables = {};
const uploads = [];
let downloads = 0;
let downloadResult = { data: null, error: { message: "fixture download failure" } };
const db = {
  from(table) {
    const filters = [];
    let patch;
    let single = false;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
      is(key, value) { filters.push((row) => (row[key] ?? null) === value); return query; },
      order() { return query; },
      limit() { return query; },
      update(value) { patch = value; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) {
        try {
          assert.ok(Object.hasOwn(tables, table), `Unexpected mocked table: ${table}`);
          const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          if (patch) rows.forEach((row) => Object.assign(row, patch));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  },
  storage: { from: () => ({ download: async () => { downloads++; return downloadResult; }, upload: async (path, buffer) => {
    uploads.push({ path, data: JSON.parse(buffer.toString()) });
    return { error: null };
  } }) },
};
const context = vm.createContext({
  exports: {}, Buffer, supabaseAdmin: db, process: { env: { OPENAI_API_KEY: "fixture-only" } },
  NextResponse: { json: (body, options) => ({ body, status: options.status }) },
});
vm.runInContext(ts.transpileModule(isolated, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, context);
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const scenario = JSON.parse(fs.readFileSync("quality/fixtures/client-001/pdf-intelligence/p2b-pdf-intelligence-scenario.json", "utf8"));
const parse = (documentType, text) => context.extractFinancialCandidatesFromText({ documentType, text });
const money = context.normalizeStructuredNumber;
const row = (structuredValue, pdfValue) => context.buildReconciliationRow({
  key: "commitment_amount", label: "Commitment", structuredValue: money(structuredValue),
  pdfValue: money(pdfValue), pdfSourcePage: 2, pdfSourceExcerpt: "fixture", structuredSource: null,
});
const soaFields = [
  ["Reporting Date", scenario.soa.reporting_date], ["Commitment Amount", scenario.soa.commitment_amount],
  ["Capital Called Till Date", scenario.soa.capital_called_to_date], ["Uncalled Capital", scenario.soa.uncalled_capital],
  ["Distributions Till Date", scenario.soa.distributions_to_date], ["Current NAV", scenario.soa.current_nav],
];
const soaText = (separator, dateSeparator) => `--- PAGE 1 ---\n${soaFields.map((pair) => pair.join("\n")).join("\n")}\n\n--- PAGE 2 ---\n${scenario.soa.transactions.map((tx) => [tx.date.replaceAll("-", dateSeparator), tx.nature, tx.reference, `INR ${tx.amount}`, tx.direction].join(separator)).join("\n")}`;
await test("mixed and scanned OCR eligibility; page and document bounds", async () => {
  for (const extractionMode of ["mixed_text_visual_review", "ocr_required"]) {
    assert.equal(context.eligibleForOcr({ extractionMode, pageLimitReached: false, ocrRequiredPages: [2] }), true);
  }
  assert.equal(context.eligibleForOcr({ extractionMode: "page_limit_review", pageLimitReached: true, ocrRequiredPages: [2] }), false);
  await assert.rejects(context.ocrDocument({ match_signals: [`A7.7_EVIDENCE_JSON:${JSON.stringify({
    version: "A7.7-2", extractionMode: "mixed_text_visual_review", parsedPages: 10,
    pageLimitReached: false, ocrRequiredPages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  })}`] }, "fund", []), /PDF_OCR_PAGE_LIMIT_EXCEEDED/);
  assert.match(source, /const MAX_OCR_DOCUMENTS_PER_REQUEST = 2/);
  assert.match(source, /const MAX_PDF_PAGES = 250/);
});
await test("existing SOA plus named-month slash/space dates and tabular whitespace", () => {
  for (const [separator, dateSeparator] of [["\n", "-"], ["\t", "/"], ["  ", " "]]) {
    const result = parse("SOA / Account Statement", soaText(separator, dateSeparator));
    assert.equal(result.transactions.length, 3);
    assert.equal(result.checks.some((check) => check.key === "extraction_completeness"), false);
    for (const tx of result.transactions) {
      assert.equal(tx.sourcePage, 2); assert.ok(tx.sourceExcerpt);
      assert.equal(tx.extractionMethod, "deterministic_row_match"); assert.ok(tx.confidence < 100);
    }
    assert.ok(result.checks.every((check) => check.status === "MATCHED"));
  }
  assert.equal(context.parseDateValue("31-Feb-2026"), "");
  assert.equal(parse("SOA / Account Statement", "Commitment Amount: USD 100").fields[0].currency, "USD");
  assert.equal(parse("SOA / Account Statement", "Currency: USD\nCommitment Amount\n100").fields[0].currency, "USD");
});
await test("unsupported and incomplete SOA retain explicit review evidence", () => {
  for (const text of ["unsupported table", "Reporting Date\n30-Jun-2026\nCapital Call\nunknown columns"]) {
    assert.ok(parse("SOA / Account Statement", text).checks.some((check) => check.key === "extraction_completeness" && check.status === "NOT_TESTED"));
  }
});
const callText = (before, current, cumulative) => [
  ["Commitment Amount", "1000"], ["Capital Called Before This Notice", before],
  ["Current Capital Call", current], ["Cumulative Capital Called", cumulative],
  ["Remaining Uncalled Commitment", "500"],
].filter((pair) => pair[1] !== null).map((pair) => pair.join("\n")).join("\n");
for (const [name, before, current, cumulative, expected] of [
  ["PASS", "300", "200", "500", "MATCHED"], ["FAIL", "300", "201", "500", "CONFLICT"],
  ["missing operand", null, "200", "500", "NOT_TESTED"],
]) await test(`capital-call arithmetic ${name}`, () => {
  const checks = parse("Capital Call Notice", callText(before, current, cumulative)).checks;
  assert.equal(checks.find((check) => check.key === "capital_call_notice_equation").status, expected);
  assert.equal(checks.find((check) => check.key === "commitment_equation").status, "MATCHED");
});
await test("structured null plus PDF value is PDF-ONLY", () => assert.equal(row(null, 12).status, "PDF-ONLY"));
await test("structured value plus PDF null is EXCEL-ONLY", () => assert.equal(row(12, null).status, "EXCEL-ONLY"));
await test("both missing creates no reconciliation evidence; real zero is retained", () => {
  for (const value of [null, undefined, "", "  "]) assert.equal(row(value, null), null);
  assert.equal(row(0, 0).status, "MATCHED"); assert.equal(row(1, 2).status, "CONFLICT");
});

const actor = { userId: "maker-id", fullName: "Fixture Maker", organisationId: "org" };
const access = { can_edit: true, role: "maker" };
const document = { id: "pdf", batch_id: null, fund_name: "fund", matched_investor_id: "investor",
  period_label: "Q1 FY27", document_type: "SOA / Account Statement", storage_bucket: "private",
  storage_path: "fixture.pdf", match_signals: [], confidence_score: 85 };
const identity = context.governedPdfIdentity(document);
const financial = { version: "A7.7-3", identity, checks: [], fields: [] };
const reconciliation = { version: "A7.7-4A", identity, sidecarBucket: "private", sidecarPath: "reconciliation.json", rows: [row(100, 100)] };
const signals = (resolution, canonical) => [
  `A7.7_FINANCIAL_JSON:${JSON.stringify(financial)}`,
  `A7.7_RECONCILIATION_JSON:${JSON.stringify(reconciliation)}`,
  ...(resolution ? [`A7.7_RESOLUTION_JSON:${JSON.stringify(resolution)}`] : []),
  ...(canonical ? [`A7.7_CANONICAL_CANDIDATE_JSON:${JSON.stringify(canonical)}`] : []),
];
function reset() {
  document.match_signals = signals();
  tables = { pdf_intelligence_batches: [{ id: "batch", fund_name: "fund" }],
    pdf_intelligence_documents: [document], investor_position_snapshots: [], investor_documents: [],
    investor_master: [{ id: "other-investor", fund_name: "fund" }] };
  document.batch_id = "batch";
}
await test("blank/null/nonfinite corrected values rejected by resolution handler", async () => {
  reconciliation.rows = [row(100, 101)];
  for (const value of ["", "  ", null, undefined, Infinity, "NaN", false]) {
    reset();
    const result = await context.handleResolutionDraft(actor, access, "fund", { documentId: "pdf",
      decisions: [{ key: "commitment_amount", choice: "corrected", correctedValue: value, note: "fixture" }] });
    assert.equal(result.status, 400); assert.match(result.body.error, /valid corrected numeric/);
  }
});
await test("unresolved choice blocks candidate preparation", async () => {
  reset();
  const response = await context.handleResolutionDraft(actor, access, "fund", { documentId: "pdf", decisions: [] });
  assert.equal(response.status, 200);
  await assert.rejects(context.prepareCanonicalSnapshot(actor, access, document, "fund"), /PDF_CANONICAL_UNRESOLVED_ROWS/);
});
let confirmedResolution;
await test("fully matched explicit confirmation reaches existing pending-candidate path", async () => {
  reconciliation.rows = [row(100, 100)]; reset();
  assert.equal((await context.handleResolutionDraft(actor, access, "fund", { documentId: "pdf" })).status, 400);
  const result = await context.handleResolutionDraft(actor, access, "fund", { documentId: "pdf", confirmMatchedSource: true });
  assert.equal(result.status, 200);
  confirmedResolution = context.getResolutionManifest(document.match_signals);
  assert.equal(confirmedResolution.decisions.length, 0);
  assert.equal(confirmedResolution.sourceConfirmation.confirmedByUserId, actor.userId);
  assert.ok(confirmedResolution.sourceConfirmation.confirmedAt);
  assert.equal(confirmedResolution.canonicalWrite, false);
  assert.equal(uploads.at(-1).data.sourceConfirmation.identity.sourcePath, "fixture.pdf");
  // The guard has passed: existing preparation now requires its approved base.
  await assert.rejects(context.prepareCanonicalSnapshot(actor, access, document, "fund"), /BASE|base|approved/i);
  const pending = { version: "A7.7-6A", identity, snapshotId: "pending", canonicalWrite: "pending_final_approval" };
  document.match_signals = signals(confirmedResolution, pending);
  assert.equal((await context.prepareCanonicalSnapshot(actor, access, document, "fund")).snapshotId, "pending");
});
await test("investor, period and classification review detach downstream evidence", async () => {
  for (const change of [{ investorId: "other-investor" }, { periodLabel: "Q2 FY27" }, { documentType: "Other" }]) {
    reset(); document.batch_id = null;
    tables.investor_master.push({ id: "investor", fund_name: "fund" });
    document.match_signals = signals(confirmedResolution, { version: "A7.7-6A", identity, snapshotId: "old" });
    const result = await context.handleReview(actor, access, "fund", { documentId: "pdf", investorId: "investor",
      periodLabel: "Q1 FY27", documentType: "SOA / Account Statement", status: "Ready", ...change });
    assert.equal(result.status, 200);
    for (const getter of ["getFinancialManifest", "getReconciliationManifest", "getResolutionManifest", "getCanonicalCandidateManifest"]) {
      assert.equal(context[getter](document.match_signals), null);
    }
    assert.equal(context.requiresFinancialPublicationApproval(document), true);
    assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, false);
    Object.assign(document, { matched_investor_id: "investor", period_label: "Q1 FY27", document_type: "SOA / Account Statement" });
  }
});
await test("publication binds current investor, fund, period, classification and source; legacy fails closed", async () => {
  const canonical = { version: "A7.7-6A", identity, snapshotId: "approved", approvalRequestId: "approval" };
  const snapshot = { id: "approved", fund_name: "fund", investor_id: "investor", reporting_period: "Q1 FY27",
    source_document_id: "pdf", source_kind: "document_intelligence", approval_status: "approved",
    reconciliation_status: "matched", validation_status: "ready", superseded_at: null };
  tables = { investor_position_snapshots: [snapshot], ventiq_approval_requests: [{ id: "approval",
    linked_record_id: "approved", linked_record_type: "Fund Memory Snapshot", action_type: "Fund Memory Approval",
    approval_status: "Approved", current_step: "Completed" }] };
  document.match_signals = signals(confirmedResolution, canonical);
  assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, true);
  for (const [key, value] of Object.entries({ matched_investor_id: "other", fund_name: "other", period_label: "Q2 FY27", document_type: "Other", storage_path: "other.pdf" })) {
    assert.equal((await context.buildPublicationGates("fund", [{ ...document, [key]: value }])).get("pdf").publishEligible, false);
  }
  for (const key of ["investor_id", "reporting_period"]) {
    const original = snapshot[key]; snapshot[key] = "other";
    assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, false);
    snapshot[key] = original;
  }
  document.match_signals = signals(confirmedResolution, { ...canonical, identity: undefined });
  assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, false);
});

const marker = "PDF governed identity changed; fresh financial approval required";
const evidenceSignal = (mode = "mixed_text_visual_review") => `A7.7_EVIDENCE_JSON:${JSON.stringify({
  version: "A7.7-2", extractionMode: mode, parsedPages: 2, pageLimitReached: false, ocrRequiredPages: [2],
})}`;
await test("mixed financial source rejects before storage download", async () => {
  const before = downloads;
  await assert.rejects(context.loadFinancialSourceText({ ...document,
    match_signals: [evidenceSignal()] }), /PDF_FINANCIAL_EXTRACTION_NOT_READY/);
  await assert.rejects(context.loadFinancialSourceText({ ...document,
    match_signals: [evidenceSignal().replace('"pageLimitReached":false', '"pageLimitReached":true')] }),
    /PDF_FINANCIAL_EXTRACTION_NOT_READY/);
  assert.equal(downloads, before);
  for (const mode of ["embedded_text", "ocr_completed"]) {
    await assert.rejects(context.loadFinancialSourceText({ ...document,
      match_signals: [evidenceSignal(mode)] }), /fixture download failure/);
  }
  assert.equal(downloads, before + 2);
});
await test("failed reprocess invalidates every downstream manifest and retains one gate", async () => {
  reset();
  document.match_signals = [...signals(confirmedResolution, { version: "A7.7-6A", identity }),
    evidenceSignal(), 'A7.7_OCR_JSON:{"version":"A7.7-2K"}', marker, marker];
  const result = await context.handleReprocess(actor, access, "fund", { documentIds: [document.id] });
  assert.equal(result.body.failedCount, 1);
  assert.equal(document.status, "Failed");
  for (const getter of ["getFinancialManifest", "getReconciliationManifest", "getResolutionManifest",
    "getCanonicalCandidateManifest", "getEvidenceManifest", "getOcrManifest"]) {
    assert.equal(context[getter](document.match_signals), null);
  }
  assert.equal(document.match_signals.filter((signal) => signal === marker).length, 1);
  document.status = "Ready";
  assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, false);
});
await test("failed OCR preserves retry evidence and removes stale financial approval even after Ready", async () => {
  reset(); document.status = "Ready";
  const evidence = evidenceSignal();
  document.match_signals = [...signals(confirmedResolution, {
    version: "A7.7-6A", identity, snapshotId: "approved", approvalRequestId: "approval",
  }), evidence, marker, marker];
  tables.investor_position_snapshots = [{ id: "approved", fund_name: "fund", investor_id: "investor",
    reporting_period: "Q1 FY27", source_document_id: "pdf", source_kind: "document_intelligence",
    approval_status: "approved", reconciliation_status: "matched", validation_status: "ready", superseded_at: null }];
  tables.ventiq_approval_requests = [{ id: "approval", linked_record_id: "approved",
    linked_record_type: "Fund Memory Snapshot", action_type: "Fund Memory Approval",
    approval_status: "Approved", current_step: "Completed" }];
  assert.equal((await context.buildPublicationGates("fund", [document])).get("pdf").publishEligible, true);
  const beforeIdentity = JSON.stringify(context.governedPdfIdentity(document));
  const beforeEvidence = JSON.stringify(context.getEvidenceManifest(document.match_signals));
  const beforeApprovals = JSON.stringify([tables.investor_position_snapshots, tables.ventiq_approval_requests]);
  const beforeDownloads = downloads, beforeUploads = uploads.length;
  assert.equal(context.eligibleForOcr(context.getEvidenceManifest(document.match_signals)), true);
  // A valid old OCR manifest prevents selection; exercise its removal directly too.
  const cleaned = context.failedOcrSignals({ ...document,
    match_signals: [...document.match_signals, 'A7.7_OCR_JSON:{"version":"A7.7-2K"}'] });
  assert.equal(context.getOcrManifest(cleaned), null);
  assert.equal(JSON.stringify(context.getEvidenceManifest(cleaned)), beforeEvidence);
  downloadResult = { data: null, error: { message: "fixture download failure" } };
  const result = await context.handleOcrLatest(actor, access, "fund", { documentIds: [document.id] });
  assert.equal(result.status, 200);
  assert.equal(result.body.failedCount, 1);
  assert.equal(result.body.processedCount, 0);
  assert.equal(downloads, beforeDownloads + 1);
  assert.equal(uploads.length, beforeUploads);
  assert.equal(document.status, "Review");
  assert.equal(JSON.stringify(context.governedPdfIdentity(document)), beforeIdentity);
  assert.notEqual(context.getEvidenceManifest(document.match_signals), null);
  assert.equal(JSON.stringify(context.getEvidenceManifest(document.match_signals)), beforeEvidence);
  assert.ok(document.match_signals.includes(evidence));
  assert.equal(context.eligibleForOcr(context.getEvidenceManifest(document.match_signals)), true);
  for (const getter of ["getOcrManifest", "getFinancialManifest", "getReconciliationManifest",
    "getResolutionManifest", "getCanonicalCandidateManifest"]) {
    assert.equal(context[getter](document.match_signals), null);
  }
  assert.equal(document.match_signals.filter((signal) => signal === marker).length, 1);
  assert.ok(document.match_signals.includes(`A7.7-2K OCR failed: ${result.body.failures[0].error}`));
  assert.ok(document.match_signals.includes("A7.7-2K OCR failure retained in Review"));
  for (const status of ["Review", "Ready"]) {
    document.status = status;
    assert.equal(JSON.stringify(context.governedPdfIdentity(document)), beforeIdentity);
    const gate = (await context.buildPublicationGates("fund", [document])).get("pdf");
    assert.equal(gate.financialApprovalRequired, true);
    assert.equal(gate.publishEligible, false);
    assert.equal(gate.approvedSnapshotId, "");
    await assert.rejects(context.prepareCanonicalSnapshot(actor, access, document, "fund"), /PDF_RECONCILIATION_REQUIRED/);
  }
  assert.equal(JSON.stringify([tables.investor_position_snapshots, tables.ventiq_approval_requests]), beforeApprovals);
  // Retry must reach OCR again using the retained evidence.
  assert.equal((await context.handleOcrLatest(actor, access, "fund", { documentIds: [document.id] })).body.failedCount, 1);
  assert.equal(downloads, beforeDownloads + 2);
  assert.equal(document.match_signals.filter((signal) => signal === marker).length, 1);
});
await test("fresh server processing clears obsolete identity marker", async () => {
  reset(); document.match_signals = [marker, marker];
  const original = context.extractPdfEvidence;
  context.extractPdfEvidence = async () => ({ text: "Unclassified document", extractionSignals: [],
    manifest: { version: "A7.7-2", extractionMode: "embedded_text", ocrRequiredPages: [], pages: [] } });
  downloadResult = { data: { arrayBuffer: async () => new ArrayBuffer(0) }, error: null };
  try {
    await context.reprocessDocument(document, "fund", []);
    assert.equal(document.match_signals.includes(marker), false);
    assert.equal(context.requiresFinancialPublicationApproval(document), false);
  } finally {
    context.extractPdfEvidence = original;
    downloadResult = { data: null, error: { message: "fixture download failure" } };
    Object.assign(document, { matched_investor_id: "investor", period_label: "Q1 FY27", document_type: "SOA / Account Statement" });
  }
});
await test("fresh OCR clears obsolete marker and stale downstream evidence", async () => {
  reset(); document.match_signals = [...signals(confirmedResolution, { version: "A7.7-6A", identity }), evidenceSignal(), marker, marker];
  const originals = Object.fromEntries(["extractPdfEvidence", "renderOcrPages", "runOpenAiOcrPage"].map((key) => [key, context[key]]));
  context.extractPdfEvidence = async () => ({ text: "Unclassified document", manifest: {
    version: "A7.7-2", pageEvidence: [{ pageNumber: 2, characterCount: 0 }],
  } });
  context.renderOcrPages = async () => new Map([[2, Buffer.from("fixture")]]);
  context.runOpenAiOcrPage = async () => ({ text: "Unclassified document", characterCount: 21, legibility: "clear", notes: [], model: "fixture" });
  downloadResult = { data: { arrayBuffer: async () => new ArrayBuffer(0) }, error: null };
  try {
    await context.ocrDocument(document, "fund", []);
    assert.equal(document.match_signals.includes(marker), false);
    assert.equal(context.requiresFinancialPublicationApproval(document), false);
    assert.equal(context.getEvidenceManifest(document.match_signals).extractionMode, "ocr_completed");
    for (const getter of ["getFinancialManifest", "getReconciliationManifest", "getResolutionManifest", "getCanonicalCandidateManifest"]) {
      assert.equal(context[getter](document.match_signals), null);
    }
  } finally {
    Object.assign(context, originals);
    downloadResult = { data: null, error: { message: "fixture download failure" } };
    Object.assign(document, { matched_investor_id: "investor", period_label: "Q1 FY27", document_type: "SOA / Account Statement" });
  }
});
await test("published investor, period and type changes deny before any row mutation", async () => {
  for (const change of [{ investorId: "other-investor" }, { periodLabel: "Q2 FY27" }, { documentType: "Other" }]) {
    reset(); tables.investor_master.push({ id: "investor", fund_name: "fund" });
    tables.investor_documents = [{ fund_name: "fund", publish_source: "pdf_intelligence_engine", storage_path: document.storage_path }];
    const before = JSON.stringify(tables);
    const result = await context.handleReview(actor, access, "fund", { documentId: document.id,
      investorId: "investor", periodLabel: "Q1 FY27", documentType: "SOA / Account Statement", status: "Ready", ...change });
    assert.equal(result.status, 409);
    assert.match(result.body.error, /withdrawal\/revocation/);
    assert.equal(JSON.stringify(tables), before);
  }
});
await test("published explicit and bulk reprocess/OCR cannot mutate PDF rows", async () => {
  for (const handler of ["handleReprocess", "handleOcrLatest"]) {
    reset(); document.match_signals = handler === "handleOcrLatest" ? [evidenceSignal()] : [];
    tables.investor_documents = [{ fund_name: "fund", publish_source: "pdf_intelligence_engine", storage_path: document.storage_path }];
    const before = JSON.stringify(document), beforeDownloads = downloads;
    assert.equal((await context[handler](actor, access, "fund", { documentIds: [document.id] })).status, 409);
    assert.equal(JSON.stringify(document), before);
    const bulk = await context[handler](actor, access, "fund", {});
    assert.equal(bulk.body.processedCount, 0);
    assert.equal(JSON.stringify(document), before);
    assert.equal(downloads, beforeDownloads);
  }
});
await test("only explicit currency declarations supply fallback; attached currency wins", () => {
  for (const [text, expected] of [
    ["Currency: USD\nCommitment Amount\n100", "USD"],
    ["Currency - INR\nCommitment Amount\n100", "INR"],
    ["Reporting Currency: GBP\nCommitment Amount\n100", "GBP"],
    ["Unrelated USD 25\nCommitment Amount\n100", "INR"],
    ["Currency: GBP\nCommitment Amount: USD 100", "USD"],
  ]) assert.equal(parse("SOA / Account Statement", text).fields[0].currency, expected);
});

console.log(`PASS ${passed} local governance fixture groups; no external services loaded.`);
