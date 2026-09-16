-- ============================================================================
-- VENTIQ T1-S0.2W — WALKTHROUGH TEST FUND EXPLICIT ENTITLEMENT
-- ============================================================================
-- Purpose:
--   Restore the intended seamless walkthrough path WITHOUT restoring the
--   retired global Fund Admin bypass.
--
-- Exact governed grant:
--   user:         walkthrough@ventiq.test
--   user_id:      bd3294b5-aa8e-400c-87c3-0b2172cc6067
--   organisation: VENTIQ Demo Organisation
--   org_id:       3e9215b5-a96d-4315-b66b-f7c76cc2dfcb
--   fund:         VENTIQ Test Fund
--   fund_id:      d213c47f-7c8e-4f9b-b002-f00f8c17973c
--   role:         fund_admin
--   permissions:  view=true, edit=true, approve=true
--
-- No other user, organisation, fund, profile, membership, or access row is
-- changed by this migration.
-- ============================================================================

begin;

do $$
declare
  v_existing_id uuid;
  v_existing_role text;
  v_existing_status text;
  v_existing_can_view boolean;
  v_existing_can_edit boolean;
  v_existing_can_approve boolean;
  v_other_active_target_fund_access bigint;
begin
  -- ------------------------------------------------------------------------
  -- Identity / organisation / fund preconditions
  -- ------------------------------------------------------------------------
  if not exists (
    select 1
    from public.ventiq_user_profiles p
    where p.user_id = 'bd3294b5-aa8e-400c-87c3-0b2172cc6067'::uuid
      and lower(btrim(coalesce(p.email, ''))) = 'walkthrough@ventiq.test'
      and lower(btrim(coalesce(p.status, ''))) = 'active'
      and lower(btrim(coalesce(p.default_role, ''))) = 'fund_admin'
  ) then
    raise exception
      'VENTIQ_T1_S0_2W_STOP: expected active walkthrough Fund Admin profile not found.';
  end if;

  if not exists (
    select 1
    from public.ventiq_organisations o
    where o.id = '3e9215b5-a96d-4315-b66b-f7c76cc2dfcb'::uuid
      and lower(btrim(coalesce(o.name, ''))) = lower('VENTIQ Demo Organisation')
      and lower(btrim(coalesce(o.slug, ''))) = 'ventiq-demo-organisation'
      and lower(btrim(coalesce(o.status, ''))) = 'active'
  ) then
    raise exception
      'VENTIQ_T1_S0_2W_STOP: expected active demo organisation not found.';
  end if;

  if not exists (
    select 1
    from public.ventiq_organisation_members m
    where m.organisation_id = '3e9215b5-a96d-4315-b66b-f7c76cc2dfcb'::uuid
      and m.user_id = 'bd3294b5-aa8e-400c-87c3-0b2172cc6067'::uuid
      and lower(btrim(coalesce(m.status, ''))) = 'active'
      and lower(btrim(coalesce(m.role, ''))) = 'fund_admin'
  ) then
    raise exception
      'VENTIQ_T1_S0_2W_STOP: walkthrough user is not an active Fund Admin member of the demo organisation.';
  end if;

  if not exists (
    select 1
    from public.ventiq_funds f
    where f.id = 'd213c47f-7c8e-4f9b-b002-f00f8c17973c'::uuid
      and lower(btrim(f.fund_name)) = lower('VENTIQ Test Fund')
      and lower(btrim(coalesce(f.data_mode, ''))) = lower('Demo Data')
  ) then
    raise exception
      'VENTIQ_T1_S0_2W_STOP: expected Demo Data VENTIQ Test Fund not found.';
  end if;

  -- ------------------------------------------------------------------------
  -- Preserve S0.2 isolation semantics.
  -- Before this controlled grant there must be no OTHER active mapping of the
  -- target fund to any organisation/user.
  -- ------------------------------------------------------------------------
  select count(*)
    into v_other_active_target_fund_access
  from public.ventiq_user_fund_access ufa
  where lower(btrim(ufa.fund_name)) = lower('VENTIQ Test Fund')
    and lower(btrim(coalesce(ufa.status, ''))) = 'active'
    and (ufa.expires_at is null or ufa.expires_at > now())
    and not (
      ufa.organisation_id = '3e9215b5-a96d-4315-b66b-f7c76cc2dfcb'::uuid
      and ufa.user_id = 'bd3294b5-aa8e-400c-87c3-0b2172cc6067'::uuid
    );

  if v_other_active_target_fund_access <> 0 then
    raise exception
      'VENTIQ_T1_S0_2W_STOP: unexpected existing active access to VENTIQ Test Fund: %',
      v_other_active_target_fund_access;
  end if;

  -- ------------------------------------------------------------------------
  -- Idempotency:
  --   absent  -> create exact governed entitlement
  --   exact   -> no-op
  --   drifted -> STOP, do not silently overwrite
  -- ------------------------------------------------------------------------
  select
    ufa.id,
    ufa.role,
    ufa.status,
    ufa.can_view,
    ufa.can_edit,
    ufa.can_approve
  into
    v_existing_id,
    v_existing_role,
    v_existing_status,
    v_existing_can_view,
    v_existing_can_edit,
    v_existing_can_approve
  from public.ventiq_user_fund_access ufa
  where ufa.organisation_id = '3e9215b5-a96d-4315-b66b-f7c76cc2dfcb'::uuid
    and ufa.user_id = 'bd3294b5-aa8e-400c-87c3-0b2172cc6067'::uuid
    and lower(btrim(ufa.fund_name)) = lower('VENTIQ Test Fund')
  limit 1;

  if v_existing_id is null then
    insert into public.ventiq_user_fund_access (
      id,
      organisation_id,
      user_id,
      fund_name,
      role,
      can_view,
      can_edit,
      can_approve,
      investor_id,
      status,
      granted_by,
      granted_at,
      expires_at
    )
    values (
      '9058e6cd-4a18-416f-a282-ca8722688759'::uuid,
      '3e9215b5-a96d-4315-b66b-f7c76cc2dfcb'::uuid,
      'bd3294b5-aa8e-400c-87c3-0b2172cc6067'::uuid,
      'VENTIQ Test Fund',
      'fund_admin',
      true,
      true,
      true,
      null,
      'Active',
      null,
      now(),
      null
    );
  else
    if lower(btrim(coalesce(v_existing_role, ''))) <> 'fund_admin'
       or lower(btrim(coalesce(v_existing_status, ''))) <> 'active'
       or v_existing_can_view is not true
       or v_existing_can_edit is not true
       or v_existing_can_approve is not true
    then
      raise exception
        'VENTIQ_T1_S0_2W_STOP: target entitlement already exists but differs from the certified walkthrough contract.';
    end if;
  end if;
end
$$;

commit;
