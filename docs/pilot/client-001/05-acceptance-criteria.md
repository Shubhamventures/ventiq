# Client 001 Pilot Acceptance Criteria

Client 001 may move to controlled operational go-live only when every mandatory criterion below is satisfied or an explicitly documented non-blocking exception is approved by the client sponsor and VENTIQ pilot owner.

## A. Production and security

- [ ] Governed production release is deployed and healthy.
- [ ] Public/private perimeter is intact.
- [ ] Unauthenticated private access is denied/redirected as designed.
- [ ] Production monitoring is operational.
- [ ] No unresolved pilot-blocking security issue.
- [ ] Current commercial release/regression gate is green.

## B. Organisation, fund and access

- [ ] Correct organisation is established.
- [ ] Correct pilot fund is established.
- [ ] Named users are mapped to correct roles/fund.
- [ ] Maker and Checker are explicitly named.
- [ ] Investor users are mapped to the correct investor identity.
- [ ] Access matrix is approved.

## C. Migration

- [ ] Required source inventory is complete for the agreed scope.
- [ ] Historical structured data needed for go-live is imported/validated.
- [ ] Agreed PDF classes are processed and exceptions reviewed.
- [ ] Low-confidence/unmatched PDF items are not silently accepted.
- [ ] At least one realistic Excel/PDF conflict has been reconciled through controlled user resolution.
- [ ] Accepted canonical data can be traced to source evidence and review decision.

## D. Governed activation

- [ ] Investor layer approved.
- [ ] PDF layer approved.
- [ ] Portfolio layer approved.
- [ ] Fund layer approved.
- [ ] Compliance layer approved.
- [ ] Maker self-approval remains blocked.
- [ ] Changes Requested -> Maker resubmission -> Checker approval works for a realistic case.
- [ ] Premature activation remains blocked.
- [ ] Final activation succeeds only after agreed readiness.
- [ ] activation/audit events are retained.

## E. Operating workflows

- [ ] Finance owner can perform the agreed finance tasks.
- [ ] Compliance owner can perform the agreed compliance tasks.
- [ ] Portfolio owner can perform the selected portfolio workflow.
- [ ] One realistic quarter-end / reporting-cycle rehearsal is completed.
- [ ] Material operational exceptions have named owners and outcomes.

## F. Investor experience

- [ ] Approved pilot investor can authenticate.
- [ ] Investor sees the correct financial/cash-flow information.
- [ ] Investor sees only permitted documents.
- [ ] Data Room access is restricted as intended.
- [ ] Cross-investor disclosure is not possible in the acceptance test.
- [ ] Agreed SOA/capital-call history is consistent with accepted canonical data.

## G. Support and operations

- [ ] Client knows the pilot support contact.
- [ ] VENTIQ pilot owner is named.
- [ ] Incident escalation path is understood.
- [ ] Known pilot limitations are documented.
- [ ] Rollback/containment approach for a critical incident is understood.

## H. Go-live decision

Go-live is allowed only when:

- there is no unresolved `PILOT BLOCKER`;
- all mandatory acceptance criteria are passed;
- any remaining `FRICTION` has an explicit assisted operating procedure;
- Client 001 sponsor signs the go-live record;
- VENTIQ pilot owner signs the go-live record.

`SCALE-ONLY` items do not block Client 001 unless they become necessary to preserve security, data integrity or the agreed pilot workflow.
