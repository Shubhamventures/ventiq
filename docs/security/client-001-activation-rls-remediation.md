# Client 001 — Activation Workflow RLS Remediation

## Proven security findings

The commercial-readiness regression established:

1. `fund_activation_status` disclosed rows to an anonymous Supabase client.
2. A valid same-organisation Fund Admin with **no access to the target fund**
   could read `fund_activation_status`.
3. The same no-access principal could read `migration_data_approvals`.
4. The activation page writes workflow state directly from the browser to
   Supabase; UI controls are therefore not a sufficient security boundary.
5. CR-SEC-1D2 found that the first remediation draft was not transition-safe:
   maker and checker capability paths shared UPDATE access without the database
   constraining `Changes Requested -> Submitted` versus
   `Submitted -> Approved / Changes Requested`.

The first CR-SEC-1C SQL was **never authorized for live application**.

## CR-SEC-1C2 remediation

The same pending migration file is replaced before any live application:

`database/migrations/20260830_002_activation_workflow_rls_hardening.sql`

The migration now enforces both isolation and workflow transitions.

### Isolation

- RLS is enabled on:
  - `fund_activation_status`
  - `migration_data_approvals`
  - `migration_activation_events`
- anonymous and inherited `PUBLIC` table privileges are revoked;
- all historical policies on the three direct-client tables are removed before
  the canonical policy set is created;
- authenticated visibility requires an Active `ventiq_user_fund_access` row
  for the requested `fund_name` with `can_view=true`.

### State machine

Current application workflow is enforced at the database:

- first persisted approval:
  - `Submitted`
  - Maker/Fund Admin
  - `can_edit=true`
- correction resubmission:
  - `Changes Requested -> Submitted`
  - Maker/Fund Admin
  - `can_edit=true`
- checker resolution:
  - `Submitted -> Approved`
  - `Submitted -> Changes Requested`
  - Checker/Fund Admin
  - `can_approve=true`

A BEFORE INSERT/UPDATE trigger compares OLD and NEW rows and blocks:

- arbitrary approval state changes;
- maker population of checker-review fields;
- checker rewriting of maker/source ownership fields;
- mutation of workflow identity keys.

### Fund activation

Direct activation is permitted only when:

- the actor is Checker/Fund Admin with `can_approve=true`;
- `status='Active'`;
- `readiness_score=100`;
- all five mandatory layer keys are Approved:
  - investor
  - pdf
  - portfolio
  - fund
  - compliance
- each Approved row matches the exact batch ID in `approved_batch_map`.

This moves the critical readiness condition from UI-only enforcement into the
database boundary as well.

### Activation events

Direct-client event writes are capability constrained:

- Maker/Fund Admin:
  - `DATASET_SUBMITTED`
- Checker/Fund Admin:
  - `DATASET_APPROVED`
  - `CHANGES_REQUESTED`
  - `FUND_ACTIVATED`

## Remaining governance item

The current persisted workflow records store human-readable maker/checker names
rather than immutable maker/checker user IDs. CR-SEC-1C2 prevents role/state
escalation but does not introduce an identity-schema migration.

Before repeatable multi-tenant deployment, add immutable actor IDs and enforce
maker/checker separation at the database level. This is particularly relevant
because the current UI intentionally grants a `fund_admin` both submit and
review capability.

## Remaining tenancy item

The activation workflow is still keyed by `fund_name` rather than an immutable
organisation-scoped fund ID. The proven anonymous/no-access Client 001 defect is
addressed by the remediation, but globally duplicate fund names across
organisations remain a separate schema-hardening requirement.

## Live release gate

Source remediation is not live remediation. The blocker remains OPEN until:

1. a pre-apply audit confirms no incompatible pending workflow state;
2. this exact migration is applied through the Supabase SQL Editor;
3. anonymous reads disclose no activation rows;
4. same-org/no-fund-access reads disclose no target-fund rows;
5. negative write probes fail because of DB authorization/state controls;
6. authorized maker/checker transitions continue to work;
7. activation cannot occur without five Approved exact batch pairs;
8. cleanup and the commercial release gate pass.

Do not run authorized fund activation before those gates pass.