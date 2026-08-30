# VENTIQ — Client 001 Governed Pilot Operating Pack

**Purpose:** Govern the first assisted commercial pilot of VENTIQ around one real fund, one controlled stakeholder set, and a clearly defined operational acceptance standard.

**Baseline:** The pilot begins from the governed VENTIQ production checkpoint `961f88b`.

This pack is the operating contract for Client 001 onboarding. It is intentionally narrower than general availability and is designed to answer one question:

> Can one real fund manager operate a fund through VENTIQ more effectively, with stronger control, traceability and stakeholder visibility than its current spreadsheet/email/shared-drive operating model?

## Pack contents

1. `01-pilot-scope.md` — what is and is not included in Client 001.
2. `02-data-request-list.md` — exact historical and opening-state information required from the client.
3. `03-access-matrix.md` — stakeholder roles, access ownership and approval responsibilities.
4. `04-migration-checklist.md` — controlled data intake, reconciliation, maker-checker and activation path.
5. `05-acceptance-criteria.md` — evidence required before the pilot is declared operational.
6. `06-go-live-signoff.md` — final client/VENTIQ go-live approval record.

## Governing principles

- One organisation and one agreed pilot fund first.
- Assisted onboarding rather than broad self-service.
- No production activation until the required migration layers are approved.
- No silent resolution of source conflicts.
- Investor access remains fund- and investor-scoped.
- Maker/checker separation is preserved for governed activation.
- Canonical data must be traceable to source evidence and user decisions.
- Pilot-only friction may be handled through an explicit assisted procedure; security or data-isolation failures may not.
- New feature requests do not automatically enter pilot scope.
- Every production issue must have an owner, impact assessment and resolution record.

## Pilot status vocabulary

| Status | Meaning |
|---|---|
| PASS | Proven sufficiently for the controlled Client 001 pilot. |
| FRICTION | Usable for the pilot with an explicit assisted process or rehearsal. |
| PILOT BLOCKER | Must be closed before Client 001 go-live. |
| SCALE-ONLY | Deferred until broader multi-client rollout. |

## Change control

Any change to pilot scope, source-data requirements, user access, activation criteria or acceptance criteria must be recorded before execution. The final go-live sign-off must reference the accepted scope and any approved deviations.
