-- VENTIQ T2-UX1B.1B
-- Governed organisation context switching.
--
-- Contract:
-- - one authenticated human identity may switch only to an Active organisation
--   where that same user has an Active membership;
-- - role is derived from the target membership, never profile.default_role;
-- - privileged/internal source or target context requires AAL2;
-- - the profile context update and enterprise audit event commit atomically;
-- - only active_organisation_id is changed on the profile;
-- - direct table UPDATE remains blocked by existing RLS;
-- - no fund/investor entitlement is created or broadened by switching context.

begin;

create or replace function public.ventiq_switch_active_organisation(
  p_expected_current_organisation_id uuid,
  p_target_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_aal text := coalesce(auth.jwt() ->> 'aal', 'aal1');
  v_profile public.ventiq_user_profiles%rowtype;
  v_current_role text;
  v_current_organisation_name text;
  v_target_role text;
  v_target_organisation_name text;
  v_target_membership_organisation_id uuid;
  v_requires_aal2 boolean := false;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_PROFILE_NOT_ACTIVE';
  end if;

  if p_target_organisation_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_TARGET_REQUIRED';
  end if;

  select p.*
  into v_profile
  from public.ventiq_user_profiles p
  where p.user_id = v_user_id
    and lower(btrim(p.status)) = 'active'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_PROFILE_NOT_ACTIVE';
  end if;

  if v_profile.active_organisation_id
       is distinct from p_expected_current_organisation_id then
    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_STALE_CONTEXT';
  end if;

  if v_profile.active_organisation_id is not null then
    select
      m.role,
      o.name
    into
      v_current_role,
      v_current_organisation_name
    from public.ventiq_organisation_members m
    left join public.ventiq_organisations o
      on o.id = m.organisation_id
    where m.user_id = v_user_id
      and m.organisation_id = v_profile.active_organisation_id
      and lower(btrim(m.status)) = 'active'
    limit 1;
  else
    select
      m.role,
      o.name
    into
      v_current_role,
      v_current_organisation_name
    from public.ventiq_organisation_members m
    left join public.ventiq_organisations o
      on o.id = m.organisation_id
    where m.user_id = v_user_id
      and lower(btrim(m.status)) = 'active'
    order by m.is_primary desc, m.id
    limit 1;
  end if;

  select
    m.organisation_id,
    m.role,
    o.name
  into
    v_target_membership_organisation_id,
    v_target_role,
    v_target_organisation_name
  from public.ventiq_organisation_members m
  join public.ventiq_organisations o
    on o.id = m.organisation_id
  where m.user_id = v_user_id
    and m.organisation_id = p_target_organisation_id
    and lower(btrim(m.status)) = 'active'
    and lower(btrim(o.status)) = 'active'
  limit 1;

  if v_target_membership_organisation_id is null then
    if exists (
      select 1
      from public.ventiq_organisations o
      where o.id = p_target_organisation_id
        and lower(btrim(o.status)) <> 'active'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'VENTIQ_SWITCH_TARGET_ORGANISATION_INACTIVE';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_TARGET_MEMBERSHIP_REQUIRED';
  end if;

  v_requires_aal2 :=
    (
      nullif(lower(btrim(coalesce(v_current_role, ''))), '') is not null
      and lower(btrim(v_current_role)) <> 'investor'
    )
    or lower(btrim(v_target_role)) <> 'investor';

  if v_requires_aal2 and v_aal <> 'aal2' then
    raise exception using
      errcode = 'P0001',
      message = 'VENTIQ_SWITCH_AAL2_REQUIRED';
  end if;

  if v_profile.active_organisation_id = p_target_organisation_id then
    return jsonb_build_object(
      'changed', false,
      'organisationId', p_target_organisation_id,
      'organisationName', v_target_organisation_name,
      'role', lower(btrim(v_target_role)),
      'assuranceLevel', v_aal
    );
  end if;

  update public.ventiq_user_profiles
  set active_organisation_id = p_target_organisation_id
  where user_id = v_user_id;

  insert into public.ventiq_enterprise_audit_logs (
    organisation_id,
    source_module,
    linked_record_id,
    linked_record_type,
    event_type,
    event_title,
    event_description,
    actor_name,
    actor_email,
    actor_role,
    event_status,
    risk_level,
    before_state,
    after_state
  )
  values (
    p_target_organisation_id,
    'Organisation Context',
    v_user_id::text,
    'User Profile',
    'Organisation Switched',
    'Active organisation changed',
    concat(
      'Active organisation changed from ',
      coalesce(v_current_organisation_name, 'unassigned'),
      ' to ',
      v_target_organisation_name,
      '.'
    ),
    v_profile.full_name,
    v_profile.email,
    coalesce(nullif(lower(btrim(v_current_role)), ''), lower(btrim(v_target_role))),
    'Recorded',
    'Medium',
    jsonb_build_object(
      'organisation_id', v_profile.active_organisation_id,
      'organisation_name', v_current_organisation_name,
      'role', v_current_role
    ),
    jsonb_build_object(
      'organisation_id', p_target_organisation_id,
      'organisation_name', v_target_organisation_name,
      'role', v_target_role
    )
  );

  return jsonb_build_object(
    'changed', true,
    'organisationId', p_target_organisation_id,
    'organisationName', v_target_organisation_name,
    'role', lower(btrim(v_target_role)),
    'assuranceLevel', v_aal
  );
end;
$function$;

revoke all on function public.ventiq_switch_active_organisation(uuid, uuid)
  from public;
revoke all on function public.ventiq_switch_active_organisation(uuid, uuid)
  from anon;
grant execute on function public.ventiq_switch_active_organisation(uuid, uuid)
  to authenticated;
grant execute on function public.ventiq_switch_active_organisation(uuid, uuid)
  to service_role;

comment on function public.ventiq_switch_active_organisation(uuid, uuid) is
  'T2-UX1B.1B governed active organisation switch: active membership + active organisation + conditional AAL2 + atomic enterprise audit.';

commit;

-- ------------------------------------------------------------
-- Post-apply verification: expected result = PASS
-- ------------------------------------------------------------

with function_row as (
  select
    p.oid,
    p.prosecdef,
    lower(pg_get_functiondef(p.oid)) as definition_lower
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ventiq_switch_active_organisation'
    and pg_get_function_identity_arguments(p.oid) =
      'p_expected_current_organisation_id uuid, p_target_organisation_id uuid'
),
execution_grants as (
  select
    has_function_privilege(
      'authenticated',
      'public.ventiq_switch_active_organisation(uuid,uuid)',
      'EXECUTE'
    ) as authenticated_execute,
    has_function_privilege(
      'anon',
      'public.ventiq_switch_active_organisation(uuid,uuid)',
      'EXECUTE'
    ) as anon_execute
),
profile_update_policies as (
  select count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'ventiq_user_profiles'
    and cmd in ('UPDATE', 'ALL')
)
select
  case
    when (select count(*) from function_row) = 1
     and coalesce((select prosecdef from function_row), false)
     and coalesce((select authenticated_execute from execution_grants), false)
     and not coalesce((select anon_execute from execution_grants), true)
     and (select policy_count from profile_update_policies) = 0
     and coalesce(
       (
         select
           definition_lower like '%auth.uid()%'
           and definition_lower like '%auth.jwt()%'
           and definition_lower like '%ventiq_organisation_members%'
           and definition_lower like '%ventiq_organisations%'
           and definition_lower like '%ventiq_enterprise_audit_logs%'
           and definition_lower like '%for update%'
           and definition_lower like '%active_organisation_id%'
           and definition_lower like '%aal2%'
           and definition_lower not like '%default_role%'
         from function_row
       ),
       false
     )
    then 'PASS - T2-UX1B.1B GOVERNED ORGANISATION SWITCHING DATABASE CONTRACT'
    else 'FAIL - T2-UX1B.1B DATABASE CONTRACT'
  end as result,
  (select authenticated_execute from execution_grants) as authenticated_execute,
  (select anon_execute from execution_grants) as anon_execute,
  (select policy_count from profile_update_policies) as profile_update_policy_count;
