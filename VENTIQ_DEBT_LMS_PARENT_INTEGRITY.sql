-- VENTIQ Debt LMS Parent Lineage Hardening
-- Purpose:
--   Prevent new orphan or mismatched parent references in the Debt LMS
--   notice, email queue, and bank match workflow.
--
-- Safe to keep in source control as an idempotent database hardening script.
-- Existing foreign keys remain the source of truth for referenced-row existence.

begin;

-- ============================================================
-- 1. Debt LMS Notices
--    A notice must resolve to one loan.
--    Optional repayment-schedule / covenant parents, when present,
--    must resolve to the same loan.
-- ============================================================

create or replace function public.ventiq_guard_debt_lms_notice_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_schedule_loan_id uuid;
    v_covenant_loan_id uuid;
begin
    if new.repayment_schedule_id is not null then
        select rs.loan_id
          into v_schedule_loan_id
          from public.debt_lms_repayment_schedule rs
         where rs.id = new.repayment_schedule_id;

        if v_schedule_loan_id is null then
            raise exception
                'VENTIQ_NOTICE_SCHEDULE_PARENT_INVALID: repayment_schedule_id % does not resolve to a valid loan',
                new.repayment_schedule_id;
        end if;

        if new.loan_id is null then
            new.loan_id := v_schedule_loan_id;
        elsif new.loan_id <> v_schedule_loan_id then
            raise exception
                'VENTIQ_NOTICE_PARENT_MISMATCH: notice loan_id % does not match repayment schedule loan_id %',
                new.loan_id,
                v_schedule_loan_id;
        end if;
    end if;

    if new.covenant_id is not null then
        select c.loan_id
          into v_covenant_loan_id
          from public.debt_lms_covenants c
         where c.id = new.covenant_id;

        if v_covenant_loan_id is null then
            raise exception
                'VENTIQ_NOTICE_COVENANT_PARENT_INVALID: covenant_id % does not resolve to a valid loan',
                new.covenant_id;
        end if;

        if new.loan_id is null then
            new.loan_id := v_covenant_loan_id;
        elsif new.loan_id <> v_covenant_loan_id then
            raise exception
                'VENTIQ_NOTICE_PARENT_MISMATCH: notice loan_id % does not match covenant loan_id %',
                new.loan_id,
                v_covenant_loan_id;
        end if;
    end if;

    if new.loan_id is null then
        raise exception
            'VENTIQ_NOTICE_PARENT_REQUIRED: notice must resolve to a valid loan';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_ventiq_guard_debt_lms_notice_parent
    on public.debt_lms_notices;

create trigger trg_ventiq_guard_debt_lms_notice_parent
before insert or update on public.debt_lms_notices
for each row
execute function public.ventiq_guard_debt_lms_notice_parent();


-- ============================================================
-- 2. Debt LMS Email Queue
--    An email must resolve to one loan.
--    If it references a notice, the notice must resolve to the same loan.
-- ============================================================

create or replace function public.ventiq_guard_debt_lms_email_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_notice_loan_id uuid;
begin
    if new.notice_id is not null then
        select n.loan_id
          into v_notice_loan_id
          from public.debt_lms_notices n
         where n.id = new.notice_id;

        if v_notice_loan_id is null then
            raise exception
                'VENTIQ_EMAIL_NOTICE_PARENT_INVALID: notice_id % does not resolve to a valid loan',
                new.notice_id;
        end if;

        if new.loan_id is null then
            new.loan_id := v_notice_loan_id;
        elsif new.loan_id <> v_notice_loan_id then
            raise exception
                'VENTIQ_EMAIL_PARENT_MISMATCH: email loan_id % does not match notice loan_id %',
                new.loan_id,
                v_notice_loan_id;
        end if;
    end if;

    if new.loan_id is null then
        raise exception
            'VENTIQ_EMAIL_PARENT_REQUIRED: email queue row must resolve to a valid loan';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_ventiq_guard_debt_lms_email_parent
    on public.debt_lms_email_queue;

create trigger trg_ventiq_guard_debt_lms_email_parent
before insert or update on public.debt_lms_email_queue
for each row
execute function public.ventiq_guard_debt_lms_email_parent();


-- ============================================================
-- 3. Debt LMS Bank Matches
--    A bank match must reference a repayment schedule and the same loan
--    as that schedule.
-- ============================================================

create or replace function public.ventiq_guard_debt_lms_bank_match_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_schedule_loan_id uuid;
begin
    if new.repayment_schedule_id is null then
        raise exception
            'VENTIQ_BANK_MATCH_SCHEDULE_REQUIRED: bank match requires repayment_schedule_id';
    end if;

    select rs.loan_id
      into v_schedule_loan_id
      from public.debt_lms_repayment_schedule rs
     where rs.id = new.repayment_schedule_id;

    if v_schedule_loan_id is null then
        raise exception
            'VENTIQ_BANK_MATCH_SCHEDULE_PARENT_INVALID: repayment_schedule_id % does not resolve to a valid loan',
            new.repayment_schedule_id;
    end if;

    if new.loan_id is null then
        new.loan_id := v_schedule_loan_id;
    elsif new.loan_id <> v_schedule_loan_id then
        raise exception
            'VENTIQ_BANK_MATCH_PARENT_MISMATCH: bank match loan_id % does not match repayment schedule loan_id %',
            new.loan_id,
            v_schedule_loan_id;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_ventiq_guard_debt_lms_bank_match_parent
    on public.debt_lms_bank_matches;

create trigger trg_ventiq_guard_debt_lms_bank_match_parent
before insert or update on public.debt_lms_bank_matches
for each row
execute function public.ventiq_guard_debt_lms_bank_match_parent();


-- ============================================================
-- 4. Required-parent CHECK constraints
--    Added only when missing so the script remains rerunnable.
-- ============================================================

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'debt_lms_notices_parent_required'
           and conrelid = 'public.debt_lms_notices'::regclass
    ) then
        alter table public.debt_lms_notices
            add constraint debt_lms_notices_parent_required
            check (loan_id is not null);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'debt_lms_email_queue_parent_required'
           and conrelid = 'public.debt_lms_email_queue'::regclass
    ) then
        alter table public.debt_lms_email_queue
            add constraint debt_lms_email_queue_parent_required
            check (loan_id is not null);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'debt_lms_bank_matches_parent_required'
           and conrelid = 'public.debt_lms_bank_matches'::regclass
    ) then
        alter table public.debt_lms_bank_matches
            add constraint debt_lms_bank_matches_parent_required
            check (
                loan_id is not null
                and repayment_schedule_id is not null
            );
    end if;
end;
$$;

commit;

-- ============================================================
-- Verification query
-- Expected: exactly 6 rows (INSERT + UPDATE event rows for 3 triggers)
-- ============================================================

select
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
      'trg_ventiq_guard_debt_lms_notice_parent',
      'trg_ventiq_guard_debt_lms_email_parent',
      'trg_ventiq_guard_debt_lms_bank_match_parent'
  )
order by table_name, trigger_name, event_manipulation;
