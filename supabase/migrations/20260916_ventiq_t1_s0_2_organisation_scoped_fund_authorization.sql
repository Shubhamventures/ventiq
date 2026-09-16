-- ============================================================================
-- VENTIQ T1-S0.2 v2 — EXPLICIT FUND ENTITLEMENT + ORGANISATION SCOPE
-- ============================================================================
-- Corrected after the v1 fail-closed precondition identified one stale/demo
-- canonical fund with no active access mapping.
--
-- Key correction:
--   An unmapped canonical/test fund is allowed to remain in the database and
--   simply fails closed. We do NOT manufacture an organisation mapping for it.
--
-- Authorization model:
--   * Every internal user, INCLUDING Fund Admin, needs an explicit active
--     ventiq_user_fund_access row for the requested fund.
--   * That fund-access row must belong to an organisation in which the same
--     user is an active member.
--   * The requested normalized fund name must resolve to exactly one active
--     organisation across active fund-access rows. Any future cross-client
--     name collision therefore fails closed.
--   * Capability flags control view/edit/approve.
--   * Activation helpers delegate to these canonical helpers.
--
-- This is the safe interim bridge for the legacy name-keyed estate.
-- New Trifecta operating data will use organisation_id + canonical fund key.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- PRECONDITIONS
-- --------------------------------------------------------------------------
do $$
declare
  v_cross_org_collision_count bigint;
  v_internal_access_without_active_membership_count bigint;
  v_s0_1_bad_view_count bigint;
  v_s0_1_unexpected_grant_count bigint;
begin
  -- T1-S0.1 must remain certified.
  select count(*)
    into v_s0_1_bad_view_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname in (
      'investor_position_snapshot_controls',
      'v_latest_completed_metric_runs',
      'v_latest_fund_performance_metrics',
      'v_latest_investor_performance_metrics',
      'v_latest_metric_reconciliation_results',
      'v_latest_portfolio_performance_metrics',
      'ventiq_capital_call_receipt_summary',
      'ventiq_distribution_payment_summary',
      'ventiq_latest_fund_nav',
      'ventiq_latest_portfolio_valuations',
      'ventiq_portfolio_cashflow_ledger'
    )
    and not coalesce('security_invoker=true' = any(c.reloptions), false);

  select count(*)
    into v_s0_1_unexpected_grant_count
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name in (
      'investor_position_snapshot_controls',
      'v_latest_completed_metric_runs',
      'v_latest_fund_performance_metrics',
      'v_latest_investor_performance_metrics',
      'v_latest_metric_reconciliation_results',
      'v_latest_portfolio_performance_metrics',
      'ventiq_capital_call_receipt_summary',
      'ventiq_distribution_payment_summary',
      'ventiq_latest_fund_nav',
      'ventiq_latest_portfolio_valuations',
      'ventiq_portfolio_cashflow_ledger'
    )
    and g.grantee in ('anon', 'authenticated');

  if v_s0_1_bad_view_count <> 0
     or v_s0_1_unexpected_grant_count <> 0
  then
    raise exception
      'VENTIQ_T1_S0_2_V2_STOP: T1-S0.1 is not closed. bad_views=%, unexpected_grants=%',
      v_s0_1_bad_view_count,
      v_s0_1_unexpected_grant_count;
  end if;

  -- A name-keyed estate is safe only while one normalized fund name belongs
  -- to no more than one active organisation. This is checked again at runtime
  -- by the resolver below.
  select count(*)
    into v_cross_org_collision_count
  from (
    select lower(btrim(ufa.fund_name)) as normalized_fund_name
    from public.ventiq_user_fund_access ufa
    join public.ventiq_organisations org
      on org.id = ufa.organisation_id
     and lower(btrim(org.status)) = 'active'
    where lower(btrim(ufa.status)) = 'active'
      and (ufa.expires_at is null or ufa.expires_at > now())
      and nullif(btrim(ufa.fund_name), '') is not null
    group by lower(btrim(ufa.fund_name))
    having count(distinct ufa.organisation_id) > 1
  ) collision;

  if v_cross_org_collision_count <> 0 then
    raise exception
      'VENTIQ_T1_S0_2_V2_STOP: cross-organisation normalized fund-name collisions exist: %',
      v_cross_org_collision_count;
  end if;

  -- Existing active internal access must belong to an active organisation
  -- membership for the same user. If not, stop rather than unexpectedly
  -- locking out a legitimate user.
  select count(*)
    into v_internal_access_without_active_membership_count
  from public.ventiq_user_fund_access ufa
  where lower(btrim(ufa.status)) = 'active'
    and (ufa.expires_at is null or ufa.expires_at > now())
    and lower(btrim(ufa.role)) in (
      'fund_admin',
      'managing_partner',
      'finance_head',
      'investment_team',
      'compliance_team',
      'investor_relations',
      'maker',
      'checker'
    )
    and not exists (
      select 1
      from public.ventiq_organisation_members member
      join public.ventiq_organisations org
        on org.id = member.organisation_id
       and lower(btrim(org.status)) = 'active'
      where member.organisation_id = ufa.organisation_id
        and member.user_id = ufa.user_id
        and lower(btrim(member.status)) = 'active'
    );

  if v_internal_access_without_active_membership_count <> 0 then
    raise exception
      'VENTIQ_T1_S0_2_V2_STOP: active internal fund-access rows without active organisation membership: %',
      v_internal_access_without_active_membership_count;
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- LEGACY FUND-NAME -> ACTIVE ORGANISATION RESOLVER
--
-- 0 organisations  => NULL / fail closed
-- 1 organisation   => resolved organisation
-- >1 organisations => NULL / fail closed
-- --------------------------------------------------------------------------
create or replace function public.ventiq_resolve_active_fund_organisation(
  requested_fund_name text
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    case
      when count(*) = 1
      then max(scoped.organisation_id::text)::uuid
      else null::uuid
    end
  from (
    select distinct ufa.organisation_id
    from public.ventiq_user_fund_access ufa
    join public.ventiq_organisations org
      on org.id = ufa.organisation_id
     and lower(btrim(org.status)) = 'active'
    where requested_fund_name is not null
      and nullif(btrim(requested_fund_name), '') is not null
      and lower(btrim(ufa.status)) = 'active'
      and (ufa.expires_at is null or ufa.expires_at > now())
      and lower(btrim(ufa.fund_name)) = lower(btrim(requested_fund_name))
  ) scoped;
$function$;

revoke all on function public.ventiq_resolve_active_fund_organisation(text)
from public, anon, authenticated;

grant execute on function public.ventiq_resolve_active_fund_organisation(text)
to service_role;

-- --------------------------------------------------------------------------
-- VIEW AUTHORIZATION
-- Fund Admin no longer has a global bypass.
-- --------------------------------------------------------------------------
create or replace function public.ventiq_can_view_fund(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and requested_fund_name is not null
    and nullif(btrim(requested_fund_name), '') is not null
    and public.ventiq_is_active_user()
    and target.organisation_id is not null
    and exists (
      select 1
      from public.ventiq_user_fund_access access_record
      join public.ventiq_organisation_members member
        on member.organisation_id = access_record.organisation_id
       and member.user_id = access_record.user_id
       and lower(btrim(member.status)) = 'active'
      join public.ventiq_organisations org
        on org.id = access_record.organisation_id
       and lower(btrim(org.status)) = 'active'
      where access_record.organisation_id = target.organisation_id
        and access_record.user_id = auth.uid()
        and lower(btrim(access_record.status)) = 'active'
        and (access_record.expires_at is null or access_record.expires_at > now())
        and access_record.can_view is true
        and lower(btrim(access_record.role)) in (
          'fund_admin',
          'managing_partner',
          'finance_head',
          'investment_team',
          'compliance_team',
          'investor_relations',
          'maker',
          'checker'
        )
        and lower(btrim(access_record.fund_name))
            = lower(btrim(requested_fund_name))
    )
  from target;
$function$;

-- --------------------------------------------------------------------------
-- EDIT AUTHORIZATION
-- --------------------------------------------------------------------------
create or replace function public.ventiq_can_edit_fund(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and requested_fund_name is not null
    and nullif(btrim(requested_fund_name), '') is not null
    and public.ventiq_is_active_user()
    and target.organisation_id is not null
    and exists (
      select 1
      from public.ventiq_user_fund_access access_record
      join public.ventiq_organisation_members member
        on member.organisation_id = access_record.organisation_id
       and member.user_id = access_record.user_id
       and lower(btrim(member.status)) = 'active'
      join public.ventiq_organisations org
        on org.id = access_record.organisation_id
       and lower(btrim(org.status)) = 'active'
      where access_record.organisation_id = target.organisation_id
        and access_record.user_id = auth.uid()
        and lower(btrim(access_record.status)) = 'active'
        and (access_record.expires_at is null or access_record.expires_at > now())
        and access_record.can_view is true
        and access_record.can_edit is true
        and lower(btrim(access_record.role)) in (
          'fund_admin',
          'managing_partner',
          'finance_head',
          'investment_team',
          'compliance_team',
          'investor_relations'
        )
        and lower(btrim(access_record.fund_name))
            = lower(btrim(requested_fund_name))
    )
  from target;
$function$;

-- --------------------------------------------------------------------------
-- MAKER / SUBMIT AUTHORIZATION
-- --------------------------------------------------------------------------
create or replace function public.ventiq_can_submit_fund(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and requested_fund_name is not null
    and nullif(btrim(requested_fund_name), '') is not null
    and public.ventiq_is_active_user()
    and target.organisation_id is not null
    and exists (
      select 1
      from public.ventiq_user_fund_access access_record
      join public.ventiq_organisation_members member
        on member.organisation_id = access_record.organisation_id
       and member.user_id = access_record.user_id
       and lower(btrim(member.status)) = 'active'
      join public.ventiq_organisations org
        on org.id = access_record.organisation_id
       and lower(btrim(org.status)) = 'active'
      where access_record.organisation_id = target.organisation_id
        and access_record.user_id = auth.uid()
        and lower(btrim(access_record.status)) = 'active'
        and (access_record.expires_at is null or access_record.expires_at > now())
        and access_record.can_view is true
        and access_record.can_edit is true
        and lower(btrim(access_record.role)) in ('fund_admin', 'maker')
        and lower(btrim(access_record.fund_name))
            = lower(btrim(requested_fund_name))
    )
  from target;
$function$;

-- --------------------------------------------------------------------------
-- CHECKER / REVIEW AUTHORIZATION
-- --------------------------------------------------------------------------
create or replace function public.ventiq_can_review_fund(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and requested_fund_name is not null
    and nullif(btrim(requested_fund_name), '') is not null
    and public.ventiq_is_active_user()
    and target.organisation_id is not null
    and exists (
      select 1
      from public.ventiq_user_fund_access access_record
      join public.ventiq_organisation_members member
        on member.organisation_id = access_record.organisation_id
       and member.user_id = access_record.user_id
       and lower(btrim(member.status)) = 'active'
      join public.ventiq_organisations org
        on org.id = access_record.organisation_id
       and lower(btrim(org.status)) = 'active'
      where access_record.organisation_id = target.organisation_id
        and access_record.user_id = auth.uid()
        and lower(btrim(access_record.status)) = 'active'
        and (access_record.expires_at is null or access_record.expires_at > now())
        and access_record.can_view is true
        and access_record.can_approve is true
        and lower(btrim(access_record.role)) in ('fund_admin', 'checker')
        and lower(btrim(access_record.fund_name))
            = lower(btrim(requested_fund_name))
    )
  from target;
$function$;

-- --------------------------------------------------------------------------
-- ACTIVATION CONTROL CENTRE
-- --------------------------------------------------------------------------
create or replace function public.ventiq_activation_can_view(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.ventiq_can_view_fund(requested_fund_name);
$function$;

create or replace function public.ventiq_activation_can_submit(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.ventiq_can_submit_fund(requested_fund_name);
$function$;

create or replace function public.ventiq_activation_can_review(
  requested_fund_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.ventiq_can_review_fund(requested_fund_name);
$function$;

commit;
