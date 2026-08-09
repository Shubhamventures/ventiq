-- ============================================================================
-- VENTIQ
-- A3 Fund Memory Foundation
-- 2026-08-09
--
-- Purpose
--   1. Create canonical point-in-time investor position snapshots.
--   2. Preserve UNKNOWN as NULL (never manufacture zero).
--   3. Add deterministic statement-eligibility controls.
--   4. Install the server-only controlled snapshot builder.
--   5. Extend investor financial migration batches with governed
--      reporting-date lineage.
--
-- Important
--   * This migration intentionally performs NO historical backfill.
--   * Existing investor_financial_positions without dependable as-of dates
--     remain legacy evidence only.
--   * An approved fund NAV may corroborate a source reporting date, but must
--     never manufacture a missing investor reporting date.
-- ============================================================================

begin;

-- ============================================================================
-- A3-1A / A3-1B
-- Canonical point-in-time Investor Fund Memory
-- ============================================================================

create table if not exists public.investor_position_snapshots (
    id uuid primary key default gen_random_uuid(),

    organisation_id uuid not null
        references public.ventiq_organisations(id)
        on delete restrict,

    fund_name text not null,

    investor_id uuid not null
        references public.investor_master(id)
        on delete restrict,

    investor_code text,
    investor_name text,
    class_name text,

    reporting_date date not null,
    reporting_period text,
    currency text not null default 'INR',
    snapshot_version integer not null default 1,

    commitment_amount numeric,
    capital_called numeric,
    uncalled_capital numeric,
    distributions_to_date numeric,
    net_contributed numeric,
    current_nav numeric,

    units_held numeric,
    nav_per_unit numeric,

    opening_capital numeric,
    period_capital_contributions numeric,
    period_capital_distributions numeric,
    period_income_allocation numeric,
    period_expense_allocation numeric,
    closing_capital numeric,

    investor_dpi numeric,
    investor_tvpi numeric,
    investor_moic numeric,
    investor_irr numeric,
    gross_irr numeric,
    net_irr numeric,

    source_kind text not null default 'system_calculation',
    source_batch_id text,
    source_file_name text,
    source_row_number integer,
    source_document_id uuid,
    confidence numeric,
    source_record_refs jsonb not null default '[]'::jsonb,

    calculation_version text,
    calculated_at timestamptz,

    reconciliation_status text not null default 'not_checked',
    reconciliation_notes text,

    validation_status text not null default 'draft',
    validation_notes text,
    validated_by uuid references auth.users(id) on delete set null,
    validated_at timestamptz,

    approval_status text not null default 'draft',
    approval_notes text,
    approved_by uuid references auth.users(id) on delete set null,
    approved_at timestamptz,

    supersedes_snapshot_id uuid
        references public.investor_position_snapshots(id)
        on delete restrict,

    superseded_at timestamptz,
    correction_reason text,

    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint investor_position_snapshots_version_chk
        check (snapshot_version >= 1),

    constraint investor_position_snapshots_source_kind_chk
        check (
            source_kind in (
                'migration',
                'native_workflow',
                'api_sync',
                'document_intelligence',
                'manual_review',
                'system_calculation'
            )
        ),

    constraint investor_position_snapshots_reconciliation_status_chk
        check (
            reconciliation_status in (
                'not_checked',
                'matched',
                'variance',
                'exception'
            )
        ),

    constraint investor_position_snapshots_validation_status_chk
        check (
            validation_status in (
                'draft',
                'ready',
                'review',
                'exception'
            )
        ),

    constraint investor_position_snapshots_approval_status_chk
        check (
            approval_status in (
                'draft',
                'pending_approval',
                'approved',
                'rejected'
            )
        )
);

comment on table public.investor_position_snapshots is
'Canonical point-in-time investor Fund Memory. Investor-facing values must be source-traceable; unknown values remain NULL.';

comment on column public.investor_position_snapshots.reporting_date is
'Authoritative as-of date represented by this investor snapshot.';

comment on column public.investor_position_snapshots.source_record_refs is
'Structured lineage to source records used or inspected when building this snapshot.';

comment on column public.investor_position_snapshots.current_nav is
'Investor NAV as of reporting_date. NULL means point-in-time NAV evidence is not established.';

comment on column public.investor_position_snapshots.net_contributed is
'Net contributed capital as of reporting_date. NULL means insufficient dated evidence.';

alter table public.investor_position_snapshots
    alter column commitment_amount drop not null,
    alter column commitment_amount drop default,
    alter column capital_called drop not null,
    alter column capital_called drop default,
    alter column uncalled_capital drop not null,
    alter column uncalled_capital drop default,
    alter column distributions_to_date drop not null,
    alter column distributions_to_date drop default,
    alter column net_contributed drop not null,
    alter column net_contributed drop default,
    alter column current_nav drop not null,
    alter column current_nav drop default;

create unique index if not exists investor_position_snapshots_version_uidx
on public.investor_position_snapshots (
    organisation_id,
    lower(btrim(fund_name)),
    investor_id,
    coalesce(class_name, ''),
    reporting_date,
    snapshot_version
);

create unique index if not exists investor_position_snapshots_live_approved_uidx
on public.investor_position_snapshots (
    organisation_id,
    lower(btrim(fund_name)),
    investor_id,
    coalesce(class_name, ''),
    reporting_date
)
where approval_status = 'approved'
  and superseded_at is null;

create index if not exists investor_position_snapshots_fund_date_idx
on public.investor_position_snapshots (
    organisation_id,
    fund_name,
    reporting_date desc
);

create index if not exists investor_position_snapshots_investor_date_idx
on public.investor_position_snapshots (
    investor_id,
    reporting_date desc
);

create index if not exists investor_position_snapshots_approval_idx
on public.investor_position_snapshots (
    organisation_id,
    fund_name,
    approval_status,
    reporting_date desc
);

create index if not exists investor_position_snapshots_validation_idx
on public.investor_position_snapshots (
    organisation_id,
    fund_name,
    validation_status,
    reporting_date desc
);

create or replace function public.ventiq_touch_investor_position_snapshot_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists ventiq_touch_investor_position_snapshot_updated_at
on public.investor_position_snapshots;

create trigger ventiq_touch_investor_position_snapshot_updated_at
before update on public.investor_position_snapshots
for each row
execute function public.ventiq_touch_investor_position_snapshot_updated_at();

alter table public.investor_position_snapshots enable row level security;

revoke all on table public.investor_position_snapshots from anon;
revoke all on table public.investor_position_snapshots from authenticated;

-- ============================================================================
-- A3-1C
-- Conservative statement eligibility control view
-- ============================================================================

create or replace view public.investor_position_snapshot_controls
with (security_invoker = true)
as
select
    s.id as snapshot_id,
    s.organisation_id,
    s.fund_name,
    s.investor_id,
    s.investor_code,
    s.investor_name,
    s.class_name,
    s.reporting_date,
    s.reporting_period,
    s.snapshot_version,

    (
        s.commitment_amount is not null
        and s.capital_called is not null
        and s.uncalled_capital is not null
    ) as commitment_fields_present,

    (
        s.commitment_amount is not null
        and s.capital_called is not null
        and s.uncalled_capital is not null
        and abs(
            s.commitment_amount
            - (s.capital_called + s.uncalled_capital)
        ) <= 0.01
    ) as commitment_math_ok,

    (s.distributions_to_date is not null) as distributions_present,
    (s.net_contributed is not null) as net_contributed_present,
    (s.current_nav is not null) as nav_present,

    (
        s.source_record_refs is not null
        and jsonb_typeof(s.source_record_refs) in ('array', 'object')
        and s.source_record_refs <> '[]'::jsonb
        and s.source_record_refs <> '{}'::jsonb
    ) as source_lineage_present,

    (s.reconciliation_status = 'matched') as reconciliation_passed,
    (s.validation_status = 'ready') as validation_passed,

    (
        s.approval_status = 'approved'
        and s.approved_at is not null
        and s.superseded_at is null
    ) as approval_passed,

    (
        s.commitment_amount is not null
        and s.capital_called is not null
        and s.uncalled_capital is not null
        and abs(
            s.commitment_amount
            - (s.capital_called + s.uncalled_capital)
        ) <= 0.01
        and s.distributions_to_date is not null
        and s.net_contributed is not null
        and s.current_nav is not null
        and s.source_record_refs is not null
        and jsonb_typeof(s.source_record_refs) in ('array', 'object')
        and s.source_record_refs <> '[]'::jsonb
        and s.source_record_refs <> '{}'::jsonb
        and s.reconciliation_status = 'matched'
        and s.validation_status = 'ready'
        and s.approval_status = 'approved'
        and s.approved_at is not null
        and s.superseded_at is null
    ) as investor_statement_eligible,

    array_remove(
        array[
            case when s.commitment_amount is null
                then 'COMMITMENT_MISSING' end,
            case when s.capital_called is null
                then 'CAPITAL_CALLED_MISSING' end,
            case when s.uncalled_capital is null
                then 'UNCALLED_CAPITAL_MISSING' end,
            case when
                s.commitment_amount is not null
                and s.capital_called is not null
                and s.uncalled_capital is not null
                and abs(
                    s.commitment_amount
                    - (s.capital_called + s.uncalled_capital)
                ) > 0.01
                then 'COMMITMENT_MATH_MISMATCH' end,
            case when s.distributions_to_date is null
                then 'DISTRIBUTIONS_MISSING' end,
            case when s.net_contributed is null
                then 'NET_CONTRIBUTED_MISSING' end,
            case when s.current_nav is null
                then 'CURRENT_NAV_MISSING' end,
            case when
                s.source_record_refs is null
                or jsonb_typeof(s.source_record_refs) not in ('array', 'object')
                or s.source_record_refs = '[]'::jsonb
                or s.source_record_refs = '{}'::jsonb
                then 'SOURCE_LINEAGE_MISSING' end,
            case when s.reconciliation_status <> 'matched'
                then 'RECONCILIATION_NOT_MATCHED' end,
            case when s.validation_status <> 'ready'
                then 'VALIDATION_NOT_READY' end,
            case when
                s.approval_status <> 'approved'
                or s.approved_at is null
                then 'NOT_APPROVED' end,
            case when s.superseded_at is not null
                then 'SNAPSHOT_SUPERSEDED' end
        ]::text[],
        null
    ) as blocker_codes

from public.investor_position_snapshots s;

comment on view public.investor_position_snapshot_controls is
'Deterministic Fund Memory control view. Document Studio should consume eligibility instead of deciding financial trustworthiness itself.';

revoke all on table public.investor_position_snapshot_controls from anon;
revoke all on table public.investor_position_snapshot_controls from authenticated;

-- ============================================================================
-- A3-1D
-- Controlled, server-only snapshot builder
-- ============================================================================

create or replace function public.ventiq_build_investor_position_snapshot(
    p_organisation_id uuid,
    p_fund_name text,
    p_investor_id uuid,
    p_reporting_date date,
    p_reporting_period text,
    p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_fund_name text := btrim(coalesce(p_fund_name, ''));
    v_investor record;
    v_commitment record;
    v_legacy_position record;
    v_fund_nav record;

    v_cashflow_count integer := 0;
    v_first_cashflow_date date;
    v_last_cashflow_date date;

    v_commitment_amount numeric;
    v_capital_called numeric;
    v_uncalled_capital numeric;
    v_distributions_to_date numeric;

    v_class_name text;
    v_commitment_math_ok boolean := false;

    v_previous_snapshot_id uuid;
    v_next_version integer := 1;
    v_snapshot_id uuid;

    v_reconciliation_status text := 'exception';
    v_reconciliation_notes text;
    v_source_refs jsonb := '[]'::jsonb;
begin
    if p_organisation_id is null then
        raise exception 'ORGANISATION_REQUIRED';
    end if;

    if v_fund_name = '' then
        raise exception 'FUND_NAME_REQUIRED';
    end if;

    if p_investor_id is null then
        raise exception 'INVESTOR_REQUIRED';
    end if;

    if p_reporting_date is null then
        raise exception 'REPORTING_DATE_REQUIRED';
    end if;

    select
        im.id,
        im.investor_code,
        im.investor_name,
        im.fund_name
    into v_investor
    from public.investor_master im
    where im.id = p_investor_id
      and lower(btrim(im.fund_name)) = lower(v_fund_name)
    limit 1;

    if not found then
        raise exception 'INVESTOR_NOT_FOUND_IN_FUND';
    end if;

    select
        fc.id,
        fc.class_name,
        fc.commitment_amount,
        fc.capital_called_till_date,
        fc.uncalled_capital,
        fc.distributions_till_date,
        fc.updated_at
    into v_commitment
    from public.fund_commitments fc
    where fc.investor_id = p_investor_id
      and lower(btrim(fc.fund_name)) = lower(v_fund_name)
    order by fc.updated_at desc nulls last, fc.id desc
    limit 1;

    if found then
        v_class_name := v_commitment.class_name;
        v_commitment_amount := v_commitment.commitment_amount;
        v_capital_called := v_commitment.capital_called_till_date;
        v_uncalled_capital := v_commitment.uncalled_capital;
        v_distributions_to_date := v_commitment.distributions_till_date;

        v_source_refs := v_source_refs || jsonb_build_array(
            jsonb_build_object(
                'table', 'fund_commitments',
                'record_id', v_commitment.id,
                'purpose', 'commitment / called / uncalled / distribution evidence'
            )
        );
    end if;

    select
        p.id,
        p.created_at
    into v_legacy_position
    from public.investor_financial_positions p
    where p.investor_id = p_investor_id
      and lower(btrim(p.fund_name)) = lower(v_fund_name)
    order by p.created_at desc nulls last, p.id desc
    limit 1;

    if found then
        v_source_refs := v_source_refs || jsonb_build_array(
            jsonb_build_object(
                'table', 'investor_financial_positions',
                'record_id', v_legacy_position.id,
                'purpose', 'legacy financial-position evidence; point-in-time date not established'
            )
        );
    end if;

    select
        count(*)::integer,
        min(ic.cashflow_date),
        max(ic.cashflow_date)
    into
        v_cashflow_count,
        v_first_cashflow_date,
        v_last_cashflow_date
    from public.investor_cashflows ic
    where ic.investor_id = p_investor_id
      and lower(btrim(ic.fund_name)) = lower(v_fund_name)
      and ic.cashflow_date <= p_reporting_date;

    select
        fns.id,
        fns.reporting_date,
        fns.reporting_period,
        fns.status
    into v_fund_nav
    from public.fund_nav_snapshots fns
    where lower(btrim(fns.fund_name)) = lower(v_fund_name)
      and fns.reporting_date = p_reporting_date
      and lower(btrim(coalesce(fns.status, ''))) = 'approved'
    order by fns.updated_at desc nulls last, fns.id desc
    limit 1;

    if found then
        v_source_refs := v_source_refs || jsonb_build_array(
            jsonb_build_object(
                'table', 'fund_nav_snapshots',
                'record_id', v_fund_nav.id,
                'purpose', 'approved fund reporting-date anchor',
                'reporting_date', v_fund_nav.reporting_date,
                'reporting_period', v_fund_nav.reporting_period
            )
        );
    end if;

    if
        v_commitment_amount is not null
        and v_capital_called is not null
        and v_uncalled_capital is not null
    then
        v_commitment_math_ok :=
            abs(
                v_commitment_amount
                - (v_capital_called + v_uncalled_capital)
            ) <= 0.01;
    end if;

    if
        v_commitment_amount is not null
        and v_capital_called is not null
        and v_uncalled_capital is not null
        and not v_commitment_math_ok
    then
        v_reconciliation_status := 'variance';
        v_reconciliation_notes :=
            'Commitment does not equal capital called plus uncalled capital. '
            || 'Point-in-time investor NAV/performance evidence remains incomplete.';
    else
        v_reconciliation_status := 'exception';
        v_reconciliation_notes :=
            'Builder v1 preserves known commitment evidence but does not infer '
            || 'point-in-time investor NAV/performance. '
            || format(
                'Dated cashflows through reporting date: %s; first: %s; last: %s.',
                v_cashflow_count,
                coalesce(v_first_cashflow_date::text, 'none'),
                coalesce(v_last_cashflow_date::text, 'none')
            );
    end if;

    select s.id
    into v_previous_snapshot_id
    from public.investor_position_snapshots s
    where s.organisation_id = p_organisation_id
      and lower(btrim(s.fund_name)) = lower(v_fund_name)
      and s.investor_id = p_investor_id
      and coalesce(s.class_name, '') = coalesce(v_class_name, '')
      and s.reporting_date = p_reporting_date
    order by s.snapshot_version desc, s.created_at desc
    limit 1;

    select coalesce(max(s.snapshot_version), 0) + 1
    into v_next_version
    from public.investor_position_snapshots s
    where s.organisation_id = p_organisation_id
      and lower(btrim(s.fund_name)) = lower(v_fund_name)
      and s.investor_id = p_investor_id
      and coalesce(s.class_name, '') = coalesce(v_class_name, '')
      and s.reporting_date = p_reporting_date;

    insert into public.investor_position_snapshots (
        organisation_id,
        fund_name,
        investor_id,
        investor_code,
        investor_name,
        class_name,
        reporting_date,
        reporting_period,
        currency,
        snapshot_version,

        commitment_amount,
        capital_called,
        uncalled_capital,
        distributions_to_date,

        net_contributed,
        current_nav,

        investor_dpi,
        investor_tvpi,
        investor_moic,
        investor_irr,
        gross_irr,
        net_irr,

        source_kind,
        source_record_refs,
        calculation_version,
        calculated_at,

        reconciliation_status,
        reconciliation_notes,

        validation_status,
        validation_notes,

        approval_status,
        approval_notes,

        supersedes_snapshot_id,
        created_by
    )
    values (
        p_organisation_id,
        v_fund_name,
        p_investor_id,
        v_investor.investor_code,
        v_investor.investor_name,
        v_class_name,
        p_reporting_date,
        nullif(btrim(coalesce(p_reporting_period, '')), ''),
        'INR',
        v_next_version,

        v_commitment_amount,
        v_capital_called,
        v_uncalled_capital,
        v_distributions_to_date,

        null,
        null,

        null,
        null,
        null,
        null,
        null,
        null,

        'system_calculation',
        v_source_refs,
        'fund-memory-builder-v1',
        now(),

        v_reconciliation_status,
        v_reconciliation_notes,

        'exception',
        'Point-in-time investor NAV/performance evidence is incomplete.',

        'draft',
        'Snapshot requires reconciliation, validation and governed approval before investor-facing use.',

        v_previous_snapshot_id,
        p_created_by
    )
    returning id into v_snapshot_id;

    return v_snapshot_id;
end;
$$;

comment on function public.ventiq_build_investor_position_snapshot(
    uuid,
    text,
    uuid,
    date,
    text,
    uuid
) is
'Server-only Fund Memory builder v1. Preserves known evidence, keeps unknown investor NAV/performance NULL, and creates immutable governed draft snapshots.';

revoke all on function public.ventiq_build_investor_position_snapshot(
    uuid,
    text,
    uuid,
    date,
    text,
    uuid
) from public;

revoke all on function public.ventiq_build_investor_position_snapshot(
    uuid,
    text,
    uuid,
    date,
    text,
    uuid
) from anon;

revoke all on function public.ventiq_build_investor_position_snapshot(
    uuid,
    text,
    uuid,
    date,
    text,
    uuid
) from authenticated;

grant execute on function public.ventiq_build_investor_position_snapshot(
    uuid,
    text,
    uuid,
    date,
    text,
    uuid
) to service_role;

-- ============================================================================
-- A3-2C
-- Canonical reporting-period identity on investor financial migration batches
-- ============================================================================

alter table public.investor_financial_migration_batches
    add column if not exists organisation_id uuid
        references public.ventiq_organisations(id)
        on delete restrict;

alter table public.investor_financial_migration_batches
    add column if not exists reporting_date date,
    add column if not exists reporting_period text,
    add column if not exists fund_nav_snapshot_id uuid
        references public.fund_nav_snapshots(id)
        on delete restrict,
    add column if not exists reporting_date_source text,
    add column if not exists reporting_date_evidence jsonb
        not null default '{}'::jsonb;

alter table public.investor_financial_migration_batches
    drop constraint if exists investor_financial_batches_reporting_date_source_chk;

alter table public.investor_financial_migration_batches
    add constraint investor_financial_batches_reporting_date_source_chk
    check (
        reporting_date_source is null
        or reporting_date_source in (
            'fund_nav_snapshot',
            'migration_file',
            'document_intelligence',
            'api_sync',
            'native_workflow',
            'manual_review'
        )
    );

alter table public.investor_financial_migration_batches
    drop constraint if exists investor_financial_batches_nav_date_chk;

alter table public.investor_financial_migration_batches
    add constraint investor_financial_batches_nav_date_chk
    check (
        fund_nav_snapshot_id is null
        or reporting_date is not null
    );

create index if not exists investor_financial_batches_org_fund_date_idx
on public.investor_financial_migration_batches (
    organisation_id,
    fund_name,
    reporting_date desc
);

create index if not exists investor_financial_batches_nav_snapshot_idx
on public.investor_financial_migration_batches (
    fund_nav_snapshot_id
)
where fund_nav_snapshot_id is not null;

comment on column public.investor_financial_migration_batches.reporting_date is
'Authoritative as-of date represented by investor financial positions in this batch. NULL means the point-in-time date has not been established.';

comment on column public.investor_financial_migration_batches.reporting_period is
'Human-readable reporting period corresponding to reporting_date, e.g. Q1 FY27.';

comment on column public.investor_financial_migration_batches.fund_nav_snapshot_id is
'Approved fund NAV snapshot used as the reporting-period anchor when applicable.';

comment on column public.investor_financial_migration_batches.reporting_date_source is
'How VENTIQ established the reporting date. Does not itself imply approval.';

comment on column public.investor_financial_migration_batches.reporting_date_evidence is
'Structured evidence explaining how the reporting date was established.';

commit;

-- ============================================================================
-- Optional read-only verification
-- ============================================================================

-- select
--     c.relname as table_name,
--     c.relrowsecurity as rls_enabled,
--     count(a.attname) filter (where a.attnum > 0 and not a.attisdropped) as column_count
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_attribute a on a.attrelid = c.oid
-- where n.nspname = 'public'
--   and c.relname = 'investor_position_snapshots'
-- group by c.relname, c.relrowsecurity;

-- select
--     p.proname,
--     p.prosecdef as security_definer,
--     has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
--     has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'ventiq_build_investor_position_snapshot';
