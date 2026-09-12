-- ============================================================
-- VENTIQ Canonical Calculation -> Activation Gate
-- Generated 2026-09-04
--
-- Purpose:
--   A fund cannot be activated unless:
--   1) the five mandatory migration layers are approved against the
--      exact frozen batch map; and
--   2) the frozen calculation_run points to a Completed canonical
--      metric calculation for the same fund; and
--   3) at least one reconciliation control exists and every control
--      for that calculation run is Pass.
--
-- This extends the existing 20260830 activation RLS/trigger hardening.
-- ============================================================

begin;

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
        and exists (
          select 1
          from public.metric_reconciliation_results reconciliation
          where reconciliation.calculation_run_id = run.id
        )
        and not exists (
          select 1
          from public.metric_reconciliation_results reconciliation
          where reconciliation.calculation_run_id = run.id
            and lower(trim(coalesce(reconciliation.reconciliation_status, ''))) <> 'pass'
        )
    );
$$;

revoke all on function public.ventiq_activation_calculation_ready(text, text)
  from public;
revoke all on function public.ventiq_activation_calculation_ready(text, text)
  from anon;
grant execute on function public.ventiq_activation_calculation_ready(text, text)
  to authenticated;

create or replace function public.ventiq_guard_fund_activation()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  calculation_run_id text;
begin
  if not public.ventiq_activation_can_review(new.fund_name) then
    raise exception 'Checker/Fund Admin activation capability is required.'
      using errcode = '42501';
  end if;

  if new.status is distinct from 'Active'
     or new.readiness_score is distinct from 100 then
    raise exception 'Fund activation requires Active status and readiness_score=100.'
      using errcode = '42501';
  end if;

  if not public.ventiq_activation_all_layers_approved(
    new.fund_name,
    new.approved_batch_map::jsonb
  ) then
    raise exception 'All mandatory layers must be Approved for the exact activation batch map.'
      using errcode = '42501';
  end if;

  calculation_run_id :=
    nullif(trim(coalesce(new.approved_batch_map::jsonb ->> 'calculation_run', '')), '');

  if not public.ventiq_activation_calculation_ready(
    new.fund_name,
    calculation_run_id
  ) then
    raise exception 'Fund activation requires a Completed canonical calculation with every reconciliation control in Pass status.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.fund_name is distinct from old.fund_name then
    raise exception 'Fund activation identity is immutable.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.ventiq_guard_fund_activation() from public;
revoke all on function public.ventiq_guard_fund_activation() from anon;
revoke execute on function public.ventiq_guard_fund_activation() from authenticated;

drop trigger if exists ventiq_guard_fund_activation
on public.fund_activation_status;

create trigger ventiq_guard_fund_activation
before insert or update
on public.fund_activation_status
for each row
execute function public.ventiq_guard_fund_activation();

drop policy if exists ventiq_fund_activation_insert
on public.fund_activation_status;

create policy ventiq_fund_activation_insert
on public.fund_activation_status
for insert
to authenticated
with check (
  public.ventiq_activation_can_review(fund_name)
  and status = 'Active'
  and readiness_score = 100
  and public.ventiq_activation_all_layers_approved(
    fund_name,
    approved_batch_map::jsonb
  )
  and public.ventiq_activation_calculation_ready(
    fund_name,
    approved_batch_map::jsonb ->> 'calculation_run'
  )
);

drop policy if exists ventiq_fund_activation_update
on public.fund_activation_status;

create policy ventiq_fund_activation_update
on public.fund_activation_status
for update
to authenticated
using (
  public.ventiq_activation_can_review(fund_name)
)
with check (
  public.ventiq_activation_can_review(fund_name)
  and status = 'Active'
  and readiness_score = 100
  and public.ventiq_activation_all_layers_approved(
    fund_name,
    approved_batch_map::jsonb
  )
  and public.ventiq_activation_calculation_ready(
    fund_name,
    approved_batch_map::jsonb ->> 'calculation_run'
  )
);

commit;
