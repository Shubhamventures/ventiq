-- ============================================================
-- VENTIQ CR-SEC-1C2
-- Activation workflow RLS + state-transition hardening
--
-- Proven findings addressed:
--   * anonymous SELECT exposure on fund_activation_status;
--   * authenticated same-org/no-fund-access SELECT exposure on
--     fund_activation_status and migration_data_approvals;
--   * direct browser -> Supabase writes;
--   * CR-SEC-1D2: maker/checker shared UPDATE capability without a
--     database-enforced workflow-state transition.
--
-- Current source state machine:
--   Draft (no persisted row)
--     -> Submitted                    [Maker/Fund Admin + can_edit]
--   Changes Requested
--     -> Submitted                    [Maker/Fund Admin + can_edit]
--   Submitted
--     -> Approved                     [Checker/Fund Admin + can_approve]
--   Submitted
--     -> Changes Requested            [Checker/Fund Admin + can_approve]
--   all five mandatory layers Approved
--     -> fund status Active           [Checker/Fund Admin + can_approve]
--
-- IMPORTANT:
--   This file has NOT been applied merely by existing in the repository.
--   Apply only after the dedicated pre-apply regression authorizes it.
--
-- Known remaining architecture limitation:
--   activation workflow rows are tenant-keyed by fund_name, not immutable
--   organisation_id/fund_id. This closes the proven Client 001 isolation
--   defect but does not eliminate globally duplicate fund-name collision.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Canonical capability helpers.
-- SECURITY DEFINER is deliberate: RLS evaluation needs governed access rows
-- even when the caller cannot SELECT that access table directly.
-- auth.uid() remains the identity boundary.
-- ------------------------------------------------------------

create or replace function public.ventiq_activation_can_view(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.ventiq_user_fund_access ufa
    where ufa.user_id = auth.uid()
      and lower(trim(coalesce(ufa.fund_name, ''))) =
          lower(trim(coalesce(requested_fund_name, '')))
      and ufa.status = 'Active'
      and ufa.can_view = true
  );
$$;

create or replace function public.ventiq_activation_can_submit(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.ventiq_user_fund_access ufa
    where ufa.user_id = auth.uid()
      and lower(trim(coalesce(ufa.fund_name, ''))) =
          lower(trim(coalesce(requested_fund_name, '')))
      and ufa.status = 'Active'
      and ufa.can_edit = true
      and ufa.role in ('maker', 'fund_admin')
  );
$$;

create or replace function public.ventiq_activation_can_review(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.ventiq_user_fund_access ufa
    where ufa.user_id = auth.uid()
      and lower(trim(coalesce(ufa.fund_name, ''))) =
          lower(trim(coalesce(requested_fund_name, '')))
      and ufa.status = 'Active'
      and ufa.can_approve = true
      and ufa.role in ('checker', 'fund_admin')
  );
$$;

-- All five browser-defined mandatory layers must be Approved against the exact
-- batch IDs embedded in the activation payload.
create or replace function public.ventiq_activation_all_layers_approved(
  requested_fund_name text,
  requested_batch_map jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    requested_batch_map is not null
    and requested_batch_map ?& array[
      'investor',
      'pdf',
      'portfolio',
      'fund',
      'compliance'
    ]
    and (
      select count(distinct approval.layer_key)
      from public.migration_data_approvals approval
      where lower(trim(coalesce(approval.fund_name, ''))) =
            lower(trim(coalesce(requested_fund_name, '')))
        and approval.status = 'Approved'
        and approval.layer_key in (
          'investor',
          'pdf',
          'portfolio',
          'fund',
          'compliance'
        )
        and coalesce(approval.source_batch_id::text, '') =
            coalesce(requested_batch_map ->> approval.layer_key, '')
    ) = 5;
$$;

revoke all on function public.ventiq_activation_can_view(text) from public;
revoke all on function public.ventiq_activation_can_submit(text) from public;
revoke all on function public.ventiq_activation_can_review(text) from public;
revoke all on function public.ventiq_activation_all_layers_approved(text, jsonb) from public;

revoke all on function public.ventiq_activation_can_view(text) from anon;
revoke all on function public.ventiq_activation_can_submit(text) from anon;
revoke all on function public.ventiq_activation_can_review(text) from anon;
revoke all on function public.ventiq_activation_all_layers_approved(text, jsonb) from anon;

grant execute on function public.ventiq_activation_can_view(text) to authenticated;
grant execute on function public.ventiq_activation_can_submit(text) to authenticated;
grant execute on function public.ventiq_activation_can_review(text) to authenticated;
grant execute on function public.ventiq_activation_all_layers_approved(text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Transition guard.
--
-- RLS can constrain OLD rows through USING and NEW rows through WITH CHECK,
-- but it cannot compare OLD and NEW fields. The trigger therefore enforces
-- the exact state machine and immutable source identity.
-- ------------------------------------------------------------

create or replace function public.ventiq_guard_migration_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.ventiq_activation_can_submit(new.fund_name) then
      raise exception 'Maker submission capability is required.'
        using errcode = '42501';
    end if;

    if new.status is distinct from 'Submitted' then
      raise exception 'New migration approvals must start as Submitted.'
        using errcode = '42501';
    end if;

    if new.maker_name is null or new.submitted_at is null then
      raise exception 'Maker identity and submitted_at are required.'
        using errcode = '42501';
    end if;

    if new.checker_name is not null
       or new.reviewed_at is not null
       or new.review_comment is not null then
      raise exception 'Maker submission cannot populate checker review fields.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.fund_name is distinct from old.fund_name
       or new.layer_key is distinct from old.layer_key
       or new.source_batch_id is distinct from old.source_batch_id then
      raise exception 'Approval workflow identity keys are immutable.'
        using errcode = '42501';
    end if;

    -- Maker correction/resubmission.
    if old.status = 'Changes Requested'
       and new.status = 'Submitted' then

      if not public.ventiq_activation_can_submit(new.fund_name) then
        raise exception 'Maker submission capability is required.'
          using errcode = '42501';
      end if;

      if new.maker_name is null or new.submitted_at is null then
        raise exception 'Maker identity and submitted_at are required.'
          using errcode = '42501';
      end if;

      if new.checker_name is not null
         or new.reviewed_at is not null
         or new.review_comment is not null then
        raise exception 'Resubmission must clear checker review fields.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    -- Checker review.
    if old.status = 'Submitted'
       and new.status in ('Approved', 'Changes Requested') then

      if not public.ventiq_activation_can_review(new.fund_name) then
        raise exception 'Checker approval capability is required.'
          using errcode = '42501';
      end if;

      if new.checker_name is null
         or new.reviewed_at is null
         or new.review_comment is null then
        raise exception 'Checker identity, reviewed_at and review_comment are required.'
          using errcode = '42501';
      end if;

      if new.maker_name is distinct from old.maker_name
         or new.submitted_at is distinct from old.submitted_at
         or new.source_table is distinct from old.source_table
         or new.source_batch_name is distinct from old.source_batch_name
         or new.owner_name is distinct from old.owner_name then
        raise exception 'Checker review cannot rewrite maker/source ownership fields.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    raise exception 'Invalid migration approval state transition: % -> %',
      coalesce(old.status, '<null>'),
      coalesce(new.status, '<null>')
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.ventiq_guard_migration_approval_transition() from public;
revoke all on function public.ventiq_guard_migration_approval_transition() from anon;

-- Trigger functions are invoked by PostgreSQL, not called by browser clients.
revoke execute on function public.ventiq_guard_migration_approval_transition()
  from authenticated;

drop trigger if exists ventiq_guard_migration_approval_transition
on public.migration_data_approvals;

create trigger ventiq_guard_migration_approval_transition
before insert or update
on public.migration_data_approvals
for each row
execute function public.ventiq_guard_migration_approval_transition();

-- ------------------------------------------------------------
-- Fund activation guard.
-- Prevents browser callers with approval permission from bypassing the
-- five-approved-layer readiness condition enforced by the UI.
-- ------------------------------------------------------------

create or replace function public.ventiq_guard_fund_activation()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
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

-- ------------------------------------------------------------
-- Enable RLS and remove inherited/public anonymous capability.
-- ------------------------------------------------------------

alter table public.fund_activation_status enable row level security;
alter table public.migration_data_approvals enable row level security;
alter table public.migration_activation_events enable row level security;

revoke all on table public.fund_activation_status from public;
revoke all on table public.migration_data_approvals from public;
revoke all on table public.migration_activation_events from public;

revoke all on table public.fund_activation_status from anon;
revoke all on table public.migration_data_approvals from anon;
revoke all on table public.migration_activation_events from anon;

grant select, insert, update on table public.fund_activation_status to authenticated;
grant select, insert, update on table public.migration_data_approvals to authenticated;
grant select, insert on table public.migration_activation_events to authenticated;

revoke delete on table public.fund_activation_status from authenticated;
revoke delete on table public.migration_data_approvals from authenticated;
revoke update, delete on table public.migration_activation_events from authenticated;

-- ------------------------------------------------------------
-- Remove ALL historical policies on these direct-client tables.
-- PostgreSQL permissive policies are OR-combined; keeping an old permissive
-- policy would defeat a newly restrictive policy.
-- ------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'fund_activation_status',
        'migration_data_approvals',
        'migration_activation_events'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  end loop;
end
$$;

-- ------------------------------------------------------------
-- fund_activation_status
-- ------------------------------------------------------------

create policy ventiq_fund_activation_select
on public.fund_activation_status
for select
to authenticated
using (
  public.ventiq_activation_can_view(fund_name)
);

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
);

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
);

-- ------------------------------------------------------------
-- migration_data_approvals
-- ------------------------------------------------------------

create policy ventiq_migration_approval_select
on public.migration_data_approvals
for select
to authenticated
using (
  public.ventiq_activation_can_view(fund_name)
);

-- First maker submission. Draft is a UI-only state; the first persisted row
-- must be Submitted.
create policy ventiq_migration_approval_insert
on public.migration_data_approvals
for insert
to authenticated
with check (
  public.ventiq_activation_can_submit(fund_name)
  and status = 'Submitted'
  and maker_name is not null
  and submitted_at is not null
  and checker_name is null
  and reviewed_at is null
  and review_comment is null
);

-- Maker can only resubmit a row after Changes Requested.
create policy ventiq_migration_approval_maker_resubmit
on public.migration_data_approvals
for update
to authenticated
using (
  public.ventiq_activation_can_submit(fund_name)
  and status = 'Changes Requested'
)
with check (
  public.ventiq_activation_can_submit(fund_name)
  and status = 'Submitted'
  and maker_name is not null
  and submitted_at is not null
  and checker_name is null
  and reviewed_at is null
  and review_comment is null
);

-- Checker can only resolve a currently Submitted row.
create policy ventiq_migration_approval_checker_review
on public.migration_data_approvals
for update
to authenticated
using (
  public.ventiq_activation_can_review(fund_name)
  and status = 'Submitted'
)
with check (
  public.ventiq_activation_can_review(fund_name)
  and status in ('Approved', 'Changes Requested')
  and checker_name is not null
  and reviewed_at is not null
  and review_comment is not null
);

-- ------------------------------------------------------------
-- migration_activation_events
-- Event type is tied to the capability that legitimately produces it.
-- ------------------------------------------------------------

create policy ventiq_migration_activation_event_select
on public.migration_activation_events
for select
to authenticated
using (
  public.ventiq_activation_can_view(fund_name)
);

create policy ventiq_migration_activation_event_insert
on public.migration_activation_events
for insert
to authenticated
with check (
  (
    event_type = 'DATASET_SUBMITTED'
    and public.ventiq_activation_can_submit(fund_name)
  )
  or
  (
    event_type in (
      'DATASET_APPROVED',
      'CHANGES_REQUESTED',
      'FUND_ACTIVATED'
    )
    and public.ventiq_activation_can_review(fund_name)
  )
);

commit;