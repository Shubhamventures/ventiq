# Client 001 Migration Checklist

## Stage 0 — Pilot preflight

- [ ] Pilot scope agreed.
- [ ] Fund and historical period agreed.
- [ ] Data owners named.
- [ ] Maker named.
- [ ] Checker named.
- [ ] Secure intake route agreed.
- [ ] Access matrix drafted.
- [ ] No unresolved production/security blocker.

## Stage 1 — Source intake

For each received source:

- [ ] register file/batch;
- [ ] identify source owner;
- [ ] identify layer;
- [ ] identify fund;
- [ ] identify period/as-of date;
- [ ] preserve original;
- [ ] note authoritative/non-authoritative status;
- [ ] identify known issues;
- [ ] prevent accidental duplicate intake.

## Stage 2 — Structured data validation

For Excel/CSV:

- [ ] sheet/table grain understood;
- [ ] mandatory columns mapped;
- [ ] IDs/business keys mapped;
- [ ] dates normalized;
- [ ] currency/units understood;
- [ ] duplicates assessed;
- [ ] totals reconciled to client control totals where available;
- [ ] rejected rows/exceptions visible;
- [ ] no silent defaulting of material fields.

## Stage 3 — PDF intelligence review

For agreed PDF document classes:

- [ ] document class detected/confirmed;
- [ ] investor match detected/confirmed where relevant;
- [ ] reporting period/date detected/confirmed;
- [ ] document confidence visible;
- [ ] extracted transaction/notice fields reviewable;
- [ ] original PDF retained;
- [ ] low-confidence or unmatched items routed to exception review.

Priority Client 001 classes:

- investor SOA;
- capital call notice;
- other agreed investor/fund documents.

## Stage 4 — Excel/PDF reconciliation

When structured data and PDF evidence overlap:

- [ ] matching key defined;
- [ ] matching records linked;
- [ ] equal values confirmed;
- [ ] differences surfaced explicitly;
- [ ] source context shown;
- [ ] user selects/resolves the canonical outcome;
- [ ] resolution reason recorded for material conflicts;
- [ ] no conflict is silently overwritten.

Required Client 001 dry-run example:

> Structured source and PDF intentionally contain a conflicting investor/call amount. VENTIQ must surface the inconsistency, permit controlled resolution and retain the chosen canonical result with traceable evidence.

## Stage 5 — Five governed activation layers

The pilot fund must have the required current batch for each layer:

- [ ] investor;
- [ ] PDF;
- [ ] portfolio;
- [ ] fund;
- [ ] compliance.

Each required layer follows:

1. Maker prepares/reviews.
2. Maker submits.
3. Checker reviews.
4. Checker approves or requests changes.
5. If changes requested, Maker corrects/resubmits.
6. Checker approves the corrected batch.

## Stage 6 — Activation controls

Before activation:

- [ ] exact required five layer/batch pairs are approved;
- [ ] no unresolved pilot-blocking exception;
- [ ] opening balances/control totals reconciled;
- [ ] access matrix approved;
- [ ] required source documents available;
- [ ] fund activation attempt before readiness remains blocked.

Activation:

- [ ] authorised activation succeeds only after readiness;
- [ ] activation event is recorded;
- [ ] activated state is visible to intended stakeholders.

## Stage 7 — Post-activation validation

- [ ] Finance views agree to accepted controls.
- [ ] Compliance views contain agreed records.
- [ ] Portfolio views contain agreed records.
- [ ] Investor Portal values agree to accepted investor controls.
- [ ] Investor A cannot see Investor B.
- [ ] Approved Data Room documents are accessible only to permitted users.
- [ ] Capital calls/distributions/documents required by scope are visible.
- [ ] audit/activity evidence is retained.

## Stage 8 — Migration close

Record:

- final accepted batches;
- unresolved non-blocking limitations;
- approved manual decisions;
- client owner;
- VENTIQ owner;
- acceptance date;
- activation date.
