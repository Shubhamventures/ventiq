-- ============================================================================
-- VENTIQ T1-S0.4C2
-- PRIVILEGED DATABASE / RLS AAL2 ENFORCEMENT
--
-- Scope:
--   * 5 existing SECURITY DEFINER authorization function bodies only.
--   * 0 policy DDL changes.
--   * 0 table/row/business-data changes.
--   * Investor role remains usable at aal1.
--   * Privileged/internal roles require JWT aal2.
--
-- Architecture:
--   202/208 public policies already route through VENTIQ authorization helpers.
--   Rather than add blanket restrictive policies that would also force investors
--   to MFA, this migration centralizes conditional AAL2 enforcement in the
--   existing authorization helper chain.
--
-- The remaining 6 policies are identity/bootstrap/public policies required for
-- login, organisation/fund entitlement discovery, and walkthrough requests.
-- ============================================================================

begin;


do $precondition$
declare
  v_policy_count integer;
  v_helper_policy_count integer;
  v_direct_aal2_policy_count integer;
  v_hash text;
  v_count integer;
  v_nonhelper_count integer;
  v_expected_nonhelper_count integer;
begin
  select count(*)
    into v_policy_count
  from pg_policies
  where schemaname = 'public';

  if v_policy_count <> 208 then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: expected 208 public policies; found %',
      v_policy_count;
  end if;

  with policy_rows as (
    select lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) as policy_text
    from pg_policies
    where schemaname = 'public'
  )
  select count(*)
    into v_helper_policy_count
  from policy_rows
  where policy_text ~ '(ventiq_[a-z0-9_]+)[[:space:]]*\(';

  if v_helper_policy_count <> 202 then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: expected 202 helper-governed policies; found %',
      v_helper_policy_count;
  end if;

  select count(*)
    into v_direct_aal2_policy_count
  from pg_policies
  where schemaname = 'public'
    and lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%auth.jwt%'
    and lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%''aal2''%';

  if v_direct_aal2_policy_count <> 0 then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: direct AAL2 policy drift detected: %',
      v_direct_aal2_policy_count;
  end if;

  with policy_rows as (
    select tablename, policyname, cmd,
           lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) as policy_text
    from pg_policies
    where schemaname = 'public'
  ),
  nonhelper as (
    select *
    from policy_rows
    where policy_text !~ '(ventiq_[a-z0-9_]+)[[:space:]]*\('
  )
  select
    count(*),
    count(*) filter (
      where (tablename, policyname, cmd) in (
        ('ventiq_organisation_members', 'ventiq_members_select_own', 'SELECT'),
        ('ventiq_user_fund_access', 'ventiq_fund_access_select_own', 'SELECT'),
        ('ventiq_user_investor_access', 'ventiq_investor_access_select_own', 'SELECT'),
        ('ventiq_user_profiles', 'ventiq_profiles_select_own', 'SELECT'),
        ('ventiq_organisations', 'ventiq_organisations_select_member', 'SELECT'),
        ('walkthrough_requests', 'allow public insert walkthrough requests', 'INSERT')
      )
    )
    into v_nonhelper_count, v_expected_nonhelper_count
  from nonhelper;

  if v_nonhelper_count <> 6 or v_expected_nonhelper_count <> 6 then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: bootstrap/nonhelper policy set drift: total %, expected-set %',
      v_nonhelper_count,
      v_expected_nonhelper_count;
  end if;

  -- Exact certified pre-change function definitions.

  select
    count(*),
    max(
      upper(
        encode(
          digest(
            convert_to(pg_get_functiondef(p.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      )
    )
    into v_count, v_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_effective_role'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_count <> 1 or v_hash <> '488F8FCABC198A82FC7DB7A50C46CBB69B4ED0C126A6597A02128D1FFF13A042' then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: exact pre-change function drift: ventiq_effective_role(); count %, hash %',
      v_count,
      coalesce(v_hash, '<NULL>');
  end if;

  select
    count(*),
    max(
      upper(
        encode(
          digest(
            convert_to(pg_get_functiondef(p.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      )
    )
    into v_count, v_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_can_view_fund'
    and pg_get_function_identity_arguments(p.oid) = 'requested_fund_name text';

  if v_count <> 1 or v_hash <> 'D4FA3FCFD4327C0081F6D3831C8766ECB231C95A1177A7807A7B02C776DA2E98' then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: exact pre-change function drift: ventiq_can_view_fund(requested_fund_name text); count %, hash %',
      v_count,
      coalesce(v_hash, '<NULL>');
  end if;

  select
    count(*),
    max(
      upper(
        encode(
          digest(
            convert_to(pg_get_functiondef(p.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      )
    )
    into v_count, v_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_can_edit_fund'
    and pg_get_function_identity_arguments(p.oid) = 'requested_fund_name text';

  if v_count <> 1 or v_hash <> '6D6980D9DFDD8C73F1989C5038E1C5DD5FE7EB089F0653919535AD76134B00DA' then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: exact pre-change function drift: ventiq_can_edit_fund(requested_fund_name text); count %, hash %',
      v_count,
      coalesce(v_hash, '<NULL>');
  end if;

  select
    count(*),
    max(
      upper(
        encode(
          digest(
            convert_to(pg_get_functiondef(p.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      )
    )
    into v_count, v_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_can_submit_fund'
    and pg_get_function_identity_arguments(p.oid) = 'requested_fund_name text';

  if v_count <> 1 or v_hash <> 'D2E5783872F248B6C16DD0E6FB67559CF575F993881D0B2B0E2C8F9254F46A61' then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: exact pre-change function drift: ventiq_can_submit_fund(requested_fund_name text); count %, hash %',
      v_count,
      coalesce(v_hash, '<NULL>');
  end if;

  select
    count(*),
    max(
      upper(
        encode(
          digest(
            convert_to(pg_get_functiondef(p.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      )
    )
    into v_count, v_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_can_review_fund'
    and pg_get_function_identity_arguments(p.oid) = 'requested_fund_name text';

  if v_count <> 1 or v_hash <> 'A29D6F639BF9233BF2353E181C04377E0F4F712E907BBD3EFAC112FECD639A21' then
    raise exception
      'VENTIQ_T1_S0_4C2_STOP: exact pre-change function drift: ventiq_can_review_fund(requested_fund_name text); count %, hash %',
      v_count,
      coalesce(v_hash, '<NULL>');
  end if;

end
$precondition$;


-- ---------------------------------------------------------------------------
-- 1. Role resolution:
--    * active organisation membership is authoritative;
--    * no profile.default_role shortcut;
--    * investor remains valid at aal1/aal2;
--    * every privileged/internal role requires aal2.
-- ---------------------------------------------------------------------------

create or replace function public.ventiq_effective_role()
returns text
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  with active_profile as (
    select profile.active_organisation_id
    from public.ventiq_user_profiles profile
    where profile.user_id = auth.uid()
      and lower(btrim(profile.status)) = 'active'
    limit 1
  ),
  resolved_organisation as (
    select
      case
        when profile.active_organisation_id is not null
          then profile.active_organisation_id
        else (
          select member.organisation_id
          from public.ventiq_organisation_members member
          join public.ventiq_organisations organisation
            on organisation.id = member.organisation_id
           and lower(btrim(organisation.status)) = 'active'
          where member.user_id = auth.uid()
            and lower(btrim(member.status)) = 'active'
          order by
            coalesce(member.is_primary, false) desc,
            member.organisation_id
          limit 1
        )
      end as organisation_id
    from active_profile profile
  ),
  resolved_role as (
    select lower(btrim(member.role)) as role
    from resolved_organisation resolved
    join public.ventiq_organisation_members member
      on member.organisation_id = resolved.organisation_id
     and member.user_id = auth.uid()
     and lower(btrim(member.status)) = 'active'
    join public.ventiq_organisations organisation
      on organisation.id = member.organisation_id
     and lower(btrim(organisation.status)) = 'active'
    where lower(btrim(member.role)) in (
      'fund_admin',
      'managing_partner',
      'finance_head',
      'investment_team',
      'compliance_team',
      'investor_relations',
      'investor',
      'maker',
      'checker'
    )
    limit 1
  )
  select coalesce(
    (
      select
        case
          when role = 'investor'
            then 'investor'
          when role in (
            'fund_admin',
            'managing_partner',
            'finance_head',
            'investment_team',
            'compliance_team',
            'investor_relations',
            'maker',
            'checker'
          )
          and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
            then role
          else ''
        end
      from resolved_role
      limit 1
    ),
    ''
  );
$function$;


-- ---------------------------------------------------------------------------
-- 2. Canonical internal fund authorization:
--    AAL2 is required even for policies that call these helpers directly
--    without first calling ventiq_effective_role().
-- ---------------------------------------------------------------------------

create or replace function public.ventiq_can_view_fund(requested_fund_name text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
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


create or replace function public.ventiq_can_edit_fund(requested_fund_name text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
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


create or replace function public.ventiq_can_submit_fund(requested_fund_name text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
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


create or replace function public.ventiq_can_review_fund(requested_fund_name text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  with target as (
    select public.ventiq_resolve_active_fund_organisation(
      requested_fund_name
    ) as organisation_id
  )
  select
    auth.uid() is not null
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
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


commit;

-- Post-apply deterministic verification.

with recursive
policy_rows as (
  select
    p.tablename,
    p.policyname,
    p.cmd,
    p.roles,
    lower(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) as policy_text
  from pg_policies p
  where p.schemaname = 'public'
),
policy_direct_helper_calls as (
  select distinct
    pr.tablename,
    pr.policyname,
    pr.cmd,
    lower(m.call_name) as helper_name
  from policy_rows pr
  cross join lateral (
    select (regexp_matches(
      pr.policy_text,
      '(ventiq_[a-z0-9_]+)[[:space:]]*\(',
      'g'
    ))[1] as call_name
  ) m
),
ventiq_functions as (
  select
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    lower(pg_get_functiondef(p.oid)) as definition_lower
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'ventiq_%'
),
function_edges as (
  select distinct
    vf.proname as caller,
    lower(m.call_name) as callee
  from ventiq_functions vf
  cross join lateral (
    select (regexp_matches(
      vf.definition_lower,
      '(ventiq_[a-z0-9_]+)[[:space:]]*\(',
      'g'
    ))[1] as call_name
  ) m
  where lower(m.call_name) <> lower(vf.proname)
),
policy_helper_closure as (
  select
    pdhc.tablename,
    pdhc.policyname,
    pdhc.cmd,
    pdhc.helper_name as reachable_helper,
    0 as depth,
    array[pdhc.helper_name]::text[] as path
  from policy_direct_helper_calls pdhc

  union all

  select
    phc.tablename,
    phc.policyname,
    phc.cmd,
    fe.callee,
    phc.depth + 1,
    phc.path || fe.callee
  from policy_helper_closure phc
  join function_edges fe
    on fe.caller = phc.reachable_helper
  where phc.depth < 12
    and not fe.callee = any(phc.path)
),
covered_policies as (
  select distinct tablename, policyname, cmd
  from policy_helper_closure
  where reachable_helper in (
    'ventiq_effective_role',
    'ventiq_can_view_fund',
    'ventiq_can_edit_fund',
    'ventiq_can_submit_fund',
    'ventiq_can_review_fund'
  )
),
helper_policies as (
  select distinct tablename, policyname, cmd
  from policy_direct_helper_calls
),
nonhelper_policies as (
  select pr.tablename, pr.policyname, pr.cmd, pr.roles
  from policy_rows pr
  where not exists (
    select 1
    from policy_direct_helper_calls helper
    where helper.tablename = pr.tablename
      and helper.policyname = pr.policyname
      and helper.cmd = pr.cmd
  )
),
function_checks as (
  select
    count(*) filter (
      where vf.proname in (
        'ventiq_can_view_fund',
        'ventiq_can_edit_fund',
        'ventiq_can_submit_fund',
        'ventiq_can_review_fund'
      )
      and vf.definition_lower like '%auth.jwt%'
      and vf.definition_lower like '%''aal''%'
      and vf.definition_lower like '%''aal2''%'
    ) as canonical_fund_helpers_with_aal2,

    bool_and(
      case
        when vf.proname = 'ventiq_effective_role'
        then
          vf.definition_lower like '%active_organisation_id%'
          and vf.definition_lower like '%ventiq_organisation_members%'
          and vf.definition_lower like '%ventiq_organisations%'
          and vf.definition_lower like '%auth.jwt%'
          and vf.definition_lower like '%''aal2''%'
          and vf.definition_lower like '%when role = ''investor''%'
          and vf.definition_lower not like '%default_role%'
        else true
      end
    ) as effective_role_contract
  from ventiq_functions vf
  where vf.proname in (
    'ventiq_effective_role',
    'ventiq_can_view_fund',
    'ventiq_can_edit_fund',
    'ventiq_can_submit_fund',
    'ventiq_can_review_fund'
  )
),
bootstrap_policy_set as (
  select
    count(*) as bootstrap_policy_count,
    count(*) filter (
      where (tablename, policyname, cmd) in (
        ('ventiq_organisation_members', 'ventiq_members_select_own', 'SELECT'),
        ('ventiq_user_fund_access', 'ventiq_fund_access_select_own', 'SELECT'),
        ('ventiq_user_investor_access', 'ventiq_investor_access_select_own', 'SELECT'),
        ('ventiq_user_profiles', 'ventiq_profiles_select_own', 'SELECT'),
        ('ventiq_organisations', 'ventiq_organisations_select_member', 'SELECT'),
        ('walkthrough_requests', 'allow public insert walkthrough requests', 'INSERT')
      )
    ) as expected_bootstrap_policy_count
  from nonhelper_policies
)
select jsonb_pretty(
  jsonb_build_object(
    'ventiq_check',
      'T1-S0.4C2_privileged_database_aal2_enforcement',

    'result',
      case
        when (select count(*) from policy_rows) = 208
         and (select count(*) from helper_policies) = 202
         and (select count(*) from covered_policies) = 202
         and (select canonical_fund_helpers_with_aal2 from function_checks) = 4
         and coalesce((select effective_role_contract from function_checks), false)
         and (select bootstrap_policy_count from bootstrap_policy_set) = 6
         and (select expected_bootstrap_policy_count from bootstrap_policy_set) = 6
        then 'PASS'
        else 'FAIL'
      end,

    'public_policy_count',
      (select count(*) from policy_rows),

    'helper_governed_policy_count',
      (select count(*) from helper_policies),

    'privileged_aal2_covered_policy_count',
      (select count(*) from covered_policies),

    'canonical_fund_helpers_with_aal2',
      (select canonical_fund_helpers_with_aal2 from function_checks),

    'effective_role_active_org_and_conditional_aal2',
      coalesce((select effective_role_contract from function_checks), false),

    'bootstrap_identity_public_policy_count',
      (select bootstrap_policy_count from bootstrap_policy_set),

    'bootstrap_expected_policy_count',
      (select expected_bootstrap_policy_count from bootstrap_policy_set),

    'investor_aal1_path_preserved_by_role_contract',
      coalesce((select effective_role_contract from function_checks), false),

    'direct_policy_aal2_count_informational',
      (
        select count(*)
        from policy_rows
        where policy_text like '%''aal2''%'
          and policy_text like '%auth.jwt%'
      ),

    'function_post_hashes_informational',
      (
        select jsonb_agg(
          jsonb_build_object(
            'function_name', p.proname,
            'identity_arguments', pg_get_function_identity_arguments(p.oid),
            'definition_sha256',
              upper(
                encode(
                  digest(
                    convert_to(pg_get_functiondef(p.oid), 'UTF8'),
                    'sha256'
                  ),
                  'hex'
                )
              )
          )
          order by p.proname, pg_get_function_identity_arguments(p.oid)
        )
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'ventiq_effective_role',
            'ventiq_can_view_fund',
            'ventiq_can_edit_fund',
            'ventiq_can_submit_fund',
            'ventiq_can_review_fund'
          )
      ),

    'database_policy_model',
      'central_helper_enforcement',

    'blanket_restrictive_policy_added',
      false,

    'investor_mfa_made_mandatory',
      false
  )
) as ventiq_t1_s0_4c2_verification;
