-- ============================================================
-- VENTIQ Canonical Source-Batch Lineage Gate
-- Generated 2026-09-04
--
-- Purpose:
--   1) Define one database-level eligibility contract for canonical
--      calculation source batches.
--   2) Require activation calculations to originate from exactly one
--      eligible canonical intake batch for the same fund.
--   3) Require the calculation run's frozen input_summary sourceBatchId
--      to match source_batch_ids[0].
--
-- Eligibility:
--   - fund match
--   - intake_mode = Canonical
--   - processing_status = Completed
--   - status = Processed
--   - total_rows > 0
--   - validation_error_count = 0
--   - no Open Error validation issue for the batch
-- ============================================================

begin;

create or replace function public.ventiq_canonical_source_batch_eligible(
  requested_fund_name text,
  requested_source_batch_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    nullif(trim(coalesce(requested_source_batch_id, '')), '') is not null
    and exists (
      select 1
      from public.migration_intake_batches batch
      where batch.id::text = trim(requested_source_batch_id)
        and lower(trim(coalesce(batch.fund_name, ''))) =
            lower(trim(coalesce(requested_fund_name, '')))
        and lower(trim(coalesce(batch.intake_mode, ''))) = 'canonical'
        and batch.processing_status = 'Completed'
        and batch.status = 'Processed'
        and coalesce(batch.total_rows::numeric, 0) > 0
        and coalesce(batch.validation_error_count::numeric, 0) = 0
        and not exists (
          select 1
          from public.migration_validation_issues issue
          where issue.batch_id::text = batch.id::text
            and lower(trim(coalesce(issue.fund_name, ''))) =
                lower(trim(coalesce(requested_fund_name, '')))
            and lower(trim(coalesce(issue.severity, ''))) = 'error'
            and lower(trim(coalesce(issue.resolution_status, 'open'))) = 'open'
        )
    );
$$;

revoke all on function public.ventiq_canonical_source_batch_eligible(text, text)
  from public;
revoke all on function public.ventiq_canonical_source_batch_eligible(text, text)
  from anon;
grant execute on function public.ventiq_canonical_source_batch_eligible(text, text)
  to authenticated;

create or replace function public.ventiq_activation_calculation_ready(
  requested_fund_name text,
  requested_calculation_run_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    nullif(trim(coalesce(requested_calculation_run_id, '')), '') is not null
    and exists (
      select 1
      from public.metric_calculation_runs run
      where run.id::text = trim(requested_calculation_run_id)
        and lower(trim(coalesce(run.fund_name, ''))) =
            lower(trim(coalesce(requested_fund_name, '')))
        and run.calculation_status = 'Completed'
        and run.completed_at is not null
        and jsonb_typeof(to_jsonb(run.source_batch_ids)) = 'array'
        and jsonb_array_length(to_jsonb(run.source_batch_ids)) = 1
        and public.ventiq_canonical_source_batch_eligible(
          requested_fund_name,
          to_jsonb(run.source_batch_ids) ->> 0
        )
        and trim(
          coalesce(
            run.input_summary::jsonb ->> 'sourceBatchId',
            ''
          )
        ) = trim(to_jsonb(run.source_batch_ids) ->> 0)
        and exists (
          select 1
          from public.metric_reconciliation_results reconciliation
          where reconciliation.calculation_run_id = run.id
        )
        and not exists (
          select 1
          from public.metric_reconciliation_results reconciliation
          where reconciliation.calculation_run_id = run.id
            and lower(
              trim(coalesce(reconciliation.reconciliation_status, ''))
            ) <> 'pass'
        )
    );
$$;

revoke all on function public.ventiq_activation_calculation_ready(text, text)
  from public;
revoke all on function public.ventiq_activation_calculation_ready(text, text)
  from anon;
grant execute on function public.ventiq_activation_calculation_ready(text, text)
  to authenticated;

commit;
