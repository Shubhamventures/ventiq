-- ============================================================
-- VENTIQ B8-8D.2
-- Migration approval authenticated maker/checker identity hardening
--
-- Forward migration. Do NOT rewrite the already-applied CR-SEC-1C2 migration.
--
-- B8-8D.0 proved:
--   * Fund Admin can currently satisfy both maker and checker capabilities;
--   * migration_data_approvals retains display names but no durable auth user IDs;
--   * strict same-authenticated-user self-approval prevention is absent.
--
-- B8-8D.1 proved:
--   * target VENTIQ Demo Private Credit Fund approval rows = 0;
--   * global workflow has five historical rows, all already Approved;
--   * no Submitted / Changes Requested / Draft rows exist;
--   * one historical activation row exists.
--
-- Compatibility rule:
--   * historical Approved rows are NOT backfilled or rewritten;
--   * new actor columns remain nullable for those legacy rows;
--   * all NEW workflow inserts/updates are server-authoritative via auth.uid();
--   * no actor ID is inferred from maker_name/checker_name.
--
-- SECURITY RULE:
--   a principal may hold both Fund Admin maker/reviewer capabilities,
--   but auth.uid() may NEVER review the row whose current maker_user_id
--   equals that same auth.uid().
-- ============================================================

begin;

alter table public.migration_data_approvals
  add column if not exists maker_user_id uuid null;

alter table public.migration_data_approvals
  add column if not exists checker_user_id uuid null;

comment on column public.migration_data_approvals.maker_user_id is
  'Authenticated auth.uid() captured by DB trigger for the current maker submission/resubmission. Legacy Approved rows may remain null.';

comment on column public.migration_data_approvals.checker_user_id is
  'Authenticated auth.uid() captured by DB trigger for checker review. Legacy Approved rows may remain null.';

-- ------------------------------------------------------------
-- Replace only the approval transition guard.
-- Existing historical Approved rows are not touched.
-- ------------------------------------------------------------

create or replace function public.ventiq_guard_migration_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_uid uuid := auth.uid();
begin
  if actor_uid is null then
    raise exception 'Authenticated approval actor is required.'
      using errcode = '42501';
  end if;

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

    -- Server-authoritative identity capture. Never trust browser actor IDs.
    new.maker_user_id := actor_uid;
    new.checker_user_id := null;

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

      -- The current resubmitter becomes the maker for the next review.
      new.maker_user_id := actor_uid;
      new.checker_user_id := null;

      return new;
    end if;

    -- Checker review.
    if old.status = 'Submitted'
       and new.status in ('Approved', 'Changes Requested') then

      if not public.ventiq_activation_can_review(new.fund_name) then
        raise exception 'Checker approval capability is required.'
          using errcode = '42501';
      end if;

      if old.maker_user_id is null then
        raise exception 'Submitted migration approval is missing authenticated maker lineage.'
          using errcode = '42501';
      end if;

      if actor_uid = old.maker_user_id then
        raise exception 'Maker cannot review or approve own migration submission.'
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
         or new.owner_name is distinct from old.owner_name
         or new.maker_user_id is distinct from old.maker_user_id then
        raise exception 'Checker review cannot rewrite maker/source ownership fields.'
          using errcode = '42501';
      end if;

      -- Server-authoritative checker identity capture.
      new.checker_user_id := actor_uid;

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

revoke all on function public.ventiq_guard_migration_approval_transition()
  from public;

revoke all on function public.ventiq_guard_migration_approval_transition()
  from anon;

revoke execute on function public.ventiq_guard_migration_approval_transition()
  from authenticated;

-- Reassert the trigger explicitly so deployment does not depend on historical
-- trigger residue.
drop trigger if exists ventiq_guard_migration_approval_transition
on public.migration_data_approvals;

create trigger ventiq_guard_migration_approval_transition
before insert or update
on public.migration_data_approvals
for each row
execute function public.ventiq_guard_migration_approval_transition();

-- ------------------------------------------------------------
-- Replace only the three approval write policies.
-- SELECT policy and activation/event policies are unchanged.
--
-- BEFORE ROW trigger populates the server-authoritative actor IDs before
-- WITH CHECK evaluates the resulting row.
-- ------------------------------------------------------------

drop policy if exists ventiq_migration_approval_insert
on public.migration_data_approvals;

drop policy if exists ventiq_migration_approval_maker_resubmit
on public.migration_data_approvals;

drop policy if exists ventiq_migration_approval_checker_review
on public.migration_data_approvals;

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
  and maker_user_id = auth.uid()
  and checker_user_id is null
);

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
  and maker_user_id = auth.uid()
  and checker_user_id is null
);

create policy ventiq_migration_approval_checker_review
on public.migration_data_approvals
for update
to authenticated
using (
  public.ventiq_activation_can_review(fund_name)
  and status = 'Submitted'
  and maker_user_id is not null
  and maker_user_id <> auth.uid()
)
with check (
  public.ventiq_activation_can_review(fund_name)
  and status in ('Approved', 'Changes Requested')
  and maker_user_id is not null
  and maker_user_id <> auth.uid()
  and checker_name is not null
  and reviewed_at is not null
  and review_comment is not null
  and checker_user_id = auth.uid()
);

commit;