# VENTIQ Client 001 Incident & Recovery Runbook

Status: Controlled paid-pilot operational runbook
Scope: Client 001 / assisted commercial deploymen
Owner: VENTIQ Founder / Fund Admin on duty
Applies to: Vercel-hosted VENTIQ application, Supabase-backed data layer, Sentry monitoring

## 1. Purpose

This runbook defines the minimum operational response for a Client 001 production incident. It is intentionally conservative: contain first, preserve evidence, avoid speculative data repair, and restore only through verified rollback/recovery steps.

This document is not a contractual SLA. Recovery targets below are internal pilot targets and must not be represented externally as guaranteed service levels unless separately agreed.

## 2. Severity model

### SEV-1 — Critical
Use when any of the following is true:

- confirmed cross-investor, cross-fund, or cross-organisation data disclosure;
- authentication/perimeter bypass exposing a protected page or API;
- unauthorised approval, checker/final action, or privilege escalation;
- confirmed destructive or materially corrupt database mutation;
- production application unavailable for all Client 001 users with no safe workaround.

Immediate action: contain access first. Do not wait for root-cause certainty.

### SEV-2 — High
Examples:

- a major governed workflow is unavailable;
- Investor Portal, Data Room, approval workflow, migration, or document operations materially fail for authorised users;
- Sentry shows repeated production exceptions affecting a critical workflow;
- incorrect generated output is possible but no confirmed unauthorised disclosure occurred.

### SEV-3 — Moderate
Examples:

- degraded non-critical module;
- isolated UI failure with a safe workaround;
- operational warning that does not affect data integrity, access control, or approvals.

## 3. First-response checklist

For SEV-1 or SEV-2:

1. Record incident start time, reporter, affected user/fund/module, and first observed symptom.
2. Open Sentry and capture the relevant Issue/Event ID. Do not copy secrets, tokens, cookies, request bodies, or investor data into informal chat.
3. Identify the currently deployed Vercel production deployment/commit.
4. Decide whether immediate containment is required:
   - rollback application deployment;
   - disable affected workflow through an existing safe control;
   - temporarily restrict affected user/fund access through governed administration;
   - suspend a risky operation until verified.
5. Preserve evidence before any data correction:
   - Sentry event ID;
   - Vercel deployment identifier;
   - relevant `ventiq_enterprise_audit_logs` references;
   - affected approval/document/workflow IDs;
   - exact timestamps.
6. Do not make ad-hoc Supabase edits merely to make the UI look correct.

## 4. Application rollback — Vercel

Use application rollback when the incident began after a deployment and prior deployed code is known-good.

Procedure:

1. In Vercel, open the VENTIQ project.
2. Open **Deployments**.
3. Identify the last known-good production deployment.
4. Review its commit/time before promoting it.
5. Use Vercel's production rollback/promote mechanism to make that known-good deployment active.
6. Confirm the public homepage responds.
7. Confirm a protected page redirects anonymous users to `/auth/login`.
8. Confirm a private API rejects anonymous access.
9. Sign in with an authorised test/admin account and validate only the affected workflow first.
10. Record the rollback deployment identifier in the incident record.

Do not delete the failed deployment; preserve it for diagnosis.

## 5. Database / Supabase incident containment

If database integrity, RLS, or destructive mutation is suspected:

1. Stop further risky workflow execution before attempting repair.
2. Identify the affected organisation, fund, user/investor, table(s), record IDs, and time window.
3. Capture relevant enterprise audit evidence.
4. Do not run broad `UPDATE`, `DELETE`, truncate, reset, or migration commands during initial triage.
5. Determine whether the issue is:
   - application-only with correct database state;
   - isolated bad records;
   - incorrect permissions/RLS;
   - systemic data corruption.
6. If restoration is required, use the recovery/backup capability available for the production Supabase project and restore only after confirming:
   - restore point/time;
   - expected data-loss window;
   - affected records/workflows;
   - rollback plan if restore validation fails.
7. After recovery, run the Client 001 critical-path validation before reopening the affected workflow.

VENTIQ must never fabricate missing fund/investor data after a failure. Where recovery cannot prove the authoritative state, fail closed and require governed operator confirmation.

## 6. Security / isolation incident

Any suspected cross-user, cross-investor, cross-fund, or cross-organisation disclosure is SEV-1.

Immediate containment:

1. Stop the affected surface/workflow from further use.
2. Preserve Sentry and enterprise-audit evidence.
3. Identify the exact source/target identities and fund/organisation scopes.
4. Verify whether the issue affects:
   - page access;
   - API payloads;
   - signed file URLs;
   - Investor Portal records;
   - Data Room documents;
   - approval records;
   - generated documents.
5. Do not rely only on UI denial. Verify server/API denial.
6. After remediation, rerun the relevant isolation regression plus the full commercial perimeter gate.
7. Do not reopen the surface until the regression passes.

## 7. Approval / governance incident

If maker-checker-final governance is suspected:

1. Preserve approval request ID, approval step IDs, actor IDs, source module, source record ID, timestamps, and enterprise audit entries.
2. Confirm whether the state is pending, approved, rejected, or final.
3. Do not manually rewrite approval history to hide an invalid action.
4. If a final business record is incorrect, treat approval history as evidence and remediate through an explicit governed correction path.
5. Re-run self-approval, cross-fund, checker, final, duplicate-pending, and final-state regression for the affected module before reopening.

## 8. Investor Portal / Data Room incident

For incorrect investor visibility or document access:

1. Treat any potential disclosure as SEV-1.
2. Record investor ID, fund, document/snapshot ID, requested URL/path, and time.
3. Invalidate or stop further signed-link issuance if required.
4. Verify server-side investor/fund access, not only client rendering.
5. Confirm another investor cannot access the affected record/document.
6. Re-run Investor A/B isolation and signed-link denial tests before reopening.

## 9. Sentry monitoring procedure

For production errors:

1. Open Sentry -> Issues.
2. Filter to the production environment.
3. Open the issue and record:
   - Issue/Event ID;
   - first seen / last seen;
   - affected route;
   - release/deployment where available;
   - occurrence count.
4. Do not expose or paste DSNs, tokens, cookies, auth headers, or sensitive request payloads.
5. Link the Sentry event to the incident record by ID only.
6. Resolve the Sentry issue only after the production fix/rollback is verified.

## 10. Recovery validation gate

Before declaring a SEV-1/SEV-2 incident recovered, verify as applicable:

- production build passed before deployment;
- `npm test` commercial release gate passes;
- anonymous public/private perimeter passes;
- private APIs reject anonymous access;
- login/token refresh/private workspace remains stable;
- affected role/fund access works for authorised identity;
- unauthorised cross-fund/cross-user access is denied;
- maker-checker-final workflow remains governed;
- affected Investor Portal/Data Room/document workflow is isolated;
- Sentry receives production events after deployment;
- no unresolved data-integrity discrepancy remains.

For database-affecting incidents, also reconcile authoritative source records before reopening the workflow.

## 11. Internal pilot recovery targets

These are planning targets, not contractual guarantees:

- SEV-1 acknowledgement: as soon as detected during active pilot support.
- SEV-1 containment decision: target within 30 minutes of confirmed critical incident.
- Application rollback when appropriate: target within 60 minutes after rollback decision.
- Full recovery time depends on whether database correction/restoration is required.
- Data-loss tolerance is not assumed. Any restore with possible data loss requires explicit assessment and reconciliation.

Do not promise a specific RTO/RPO to Client 001 unless separately approved and contractually documented.

## 12. Incident record template

Record:

- Incident ID:
- Severity:
- Start time:
- Detection source:
- Reporter:
- Affected organisation:
- Affected fund:
- Affected users/investors:
- Affected module/API:
- Sentry Issue/Event ID:
- Vercel deployment:
- Relevant audit-log / approval / document IDs:
- Customer-visible impact:
- Containment action:
- Root cause:
- Recovery action:
- Validation performed:
- Recovery time:
- Follow-up actions:
- Owner:
- Closure approval:

## 13. Closure criteria

An incident is closed only when:

1. containment is removed safely;
2. production validation passes;
3. affected data is reconciled;
4. Sentry/monitoring state is understood;
5. evidence is retained;
6. root cause and follow-up action are recorded;
7. any security/isolation incident has explicit founder/admin closure review.

## 14. Release linkage

The canonical local pre-release command is:

`npm test`

That gate validates commercial source controls, dependency baseline, repository hygiene, production-source ESLint ratchet, production build, and anonymous perimeter regression.

It does not replace the later authenticated Client 001 end-to-end regression.
