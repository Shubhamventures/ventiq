import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Execute the actual helper, with Node's type stripping; no duplicated logic,
// dependency installation, services or generated files are needed (Node 22.13+).
const source = readFileSync(new URL("../lib/issues/pdfIssueProjection.ts", import.meta.url), "utf8");
const { projectPdfIssues } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log(`PASS ${name}`);
}
const document = (patch = {}) => ({
  id: "fixture-document", published: false, publishEligible: false,
  financialApprovalRequired: true, fileName: "fixture.pdf",
  documentType: "Statement of Account", investorId: "fixture-investor",
  investorName: "Fixture Investor", investorCode: "FIXTURE",
  periodLabel: "Q1 FY2026", status: "Ready", ...patch,
});
function expectIssue(patch, code, severity) {
  const issues = projectPdfIssues([document(patch)]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, code);
  assert.equal(issues[0].severity, severity);
  return issues[0];
}
const reconciliationCode = "PDF_RECONCILIATION_RESOLUTION_REQUIRED";
const classificationCode = "PDF_CLASSIFICATION_REVIEW_REQUIRED";
const approvalPendingReason = "Linked Fund Memory approval workflow has not reached final Approved / Completed status.";
test("published documents have no issue", () => {
  assert.equal(projectPdfIssues([document({ published: true, reconciliation: { conflictCount: 1 } })]).length, 0);
});
test("clean Ready matched document with a valid period and publishEligible has no issue", () => {
  assert.equal(projectPdfIssues([document({ publishEligible: true })]).length, 0);
});
for (const [name, patch] of [
  ["status Review", { status: "Review" }],
  ["status Unmatched", { status: "Unmatched" }],
  ["document type Other / Review", { documentType: "Other / Review" }],
  ["missing investor", { investorId: undefined }],
  ["blank investor", { investorId: "  " }],
  ["missing period", { periodLabel: undefined }],
  ["blank period", { periodLabel: "  " }],
  ["undetected period", { periodLabel: "Period not detected" }],
]) {
  test(`publishEligible does not suppress ${name}`, () => {
    expectIssue({ ...patch, publishEligible: true }, classificationCode, "Review");
  });
}
test("unresolved reconciliation wins even when publishEligible is true", () => {
  expectIssue({ publishEligible: true, status: "Review", reconciliation: { conflictCount: 1 }, publishBlockReason: approvalPendingReason }, reconciliationCode, "Blocking");
});
test("conflict without resolution blocks progression", () => {
  const issue = expectIssue({ reconciliation: { conflictCount: 1 } }, reconciliationCode, "Blocking");
  assert.match(issue.message, /value disagreement.*PDF Intelligence before canonical progression/);
});
for (const count of ["pdfOnlyCount", "excelOnlyCount"]) {
  test(`${count} without resolution blocks progression`, () => {
    expectIssue({ reconciliation: { [count]: 1 } }, reconciliationCode, "Blocking");
  });
}
test("unresolved resolution draft blocks progression", () => {
  expectIssue({ reconciliation: { conflictCount: 2 }, resolutionDraft: { unresolvedDecisionCount: 1 } }, reconciliationCode, "Blocking");
});
test("classification review", () => {
  expectIssue({ status: "Review" }, classificationCode, "Review");
});
test("missing investor identity", () => {
  expectIssue({ investorId: "", investorName: "Not matched", investorCode: "-" }, classificationCode, "Review");
});
test("undetected period", () => {
  const issue = expectIssue({ periodLabel: "Period not detected" }, classificationCode, "Review");
  assert.equal(issue.context.periodLabel, "Period not detected");
});
test("server-confirmed live approval pending uses maker-checker", () => {
  const issue = expectIssue({ publishBlockReason: approvalPendingReason, canonicalCandidate: { approvalRequestId: "approval", approvalStatus: "Approved", approvalStep: "Checker" } }, "PDF_APPROVAL_PENDING", "Review");
  assert.match(issue.message, /maker-checker workflow remains authoritative/);
});
test("live approval reason needs no stored candidate and tolerates whitespace", () => {
  expectIssue({ publishBlockReason: " Linked Fund Memory approval workflow has not reached final Approved /\n Completed status. " }, "PDF_APPROVAL_PENDING", "Review");
});
test("stale pending metadata with another gate reason remains Blocking", () => {
  const reason = "Snapshot superseded";
  const issue = expectIssue({ canonicalCandidate: { approvalRequestId: "approval", approvalStatus: "Pending Review" }, publishBlockReason: reason }, "PDF_PUBLICATION_GATE_BLOCKED", "Blocking");
  assert.ok(issue.message.includes(reason));
  assert.equal(issue.context.publishBlockReason, reason);
});
test("stored pending metadata alone does not establish live approval pending", () => {
  const canonicalCandidate = { approvalRequestId: "approval", approvalStatus: "Pending Review" };
  expectIssue({ canonicalCandidate }, "PDF_PUBLICATION_GATE_BLOCKED", "Blocking");
  assert.deepEqual(projectPdfIssues([document({ canonicalCandidate, publishEligible: true })]), []);
});
test("approved candidate with explicit publication block", () => {
  const issue = expectIssue({ canonicalCandidate: { approvalRequestId: "approval", approvalStatus: "Approved" }, publishBlockReason: "Snapshot superseded" }, "PDF_PUBLICATION_GATE_BLOCKED", "Blocking");
  assert.equal(issue.context.publishBlockReason, "Snapshot superseded");
  assert.ok(issue.message.includes("Snapshot superseded"));
});
test("priority emits one dominant issue", () => {
  const patch = { status: "Review", reconciliation: { conflictCount: 1 }, publishBlockReason: approvalPendingReason, canonicalCandidate: { approvalRequestId: "approval", approvalStatus: "Pending Review" } };
  expectIssue(patch, reconciliationCode, "Blocking");
  expectIssue({ ...patch, resolutionDraft: { unresolvedDecisionCount: 0 } }, classificationCode, "Review");
  expectIssue({ ...patch, status: "Ready", resolutionDraft: { unresolvedDecisionCount: 0 } }, "PDF_APPROVAL_PENDING", "Review");
  expectIssue({ ...patch, status: "Ready", resolutionDraft: { unresolvedDecisionCount: 0 }, publishBlockReason: "Snapshot superseded" }, "PDF_PUBLICATION_GATE_BLOCKED", "Blocking");
});
const allKinds = [
  document({ reconciliation: { conflictCount: 1 } }),
  document({ status: "Review" }),
  document({ publishBlockReason: approvalPendingReason, canonicalCandidate: { approvalRequestId: "approval" } }),
  document(),
];
test("every repairHref returns to PDF Intelligence", () => {
  for (const issue of projectPdfIssues(allKinds)) assert.equal(issue.repairHref, "/migration/pdf-intelligence");
});
test("every source is PDF Intelligence", () => {
  for (const issue of projectPdfIssues(allKinds)) assert.equal(issue.source, "PDF Intelligence");
});
test("private extraction and OCR never appear in projection", () => {
  const privateText = "PRIVATE_EXTRACTION_SENTINEL";
  const issues = projectPdfIssues([document({ textPreview: privateText, extractedText: privateText, ocr: { text: privateText }, signals: [privateText], reconciliation: { conflictCount: 1, rows: [{ pdfSourceExcerpt: privateText }] } })]);
  assert.equal(JSON.stringify(issues).includes(privateText), false);
  assert.equal(Object.hasOwn(issues[0].context, "textPreview"), false);
});
test("stable ids depend only on document id and issue code", () => {
  const first = projectPdfIssues(allKinds);
  assert.deepEqual(first, projectPdfIssues(allKinds));
  assert.equal(new Set(first.map((issue) => issue.id)).size, 4);
  assert.equal(projectPdfIssues([document({ fileName: "renamed.pdf" })])[0].id, first[3].id);
  assert.notEqual(projectPdfIssues([document({ id: "another" })])[0].id, first[3].id);
});
test("input objects are never mutated", () => {
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const input = freeze(structuredClone(allKinds));
  const before = JSON.stringify(input);
  projectPdfIssues(input);
  assert.equal(JSON.stringify(input), before);
});
test("resolved evidence alone creates no issue", () => {
  assert.equal(projectPdfIssues([document({ financialApprovalRequired: false, reconciliation: { conflictCount: 1 }, resolutionDraft: { unresolvedDecisionCount: 0 } })]).length, 0);
  assert.equal(projectPdfIssues([document({ publishEligible: true, reconciliation: { conflictCount: 1 }, resolutionDraft: { unresolvedDecisionCount: 0 } })]).length, 0);
});
console.log(`${passed} fixtures passed.`);
