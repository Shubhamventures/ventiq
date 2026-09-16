-- ============================================================================
-- VENTIQ T1-S0.1 — PUBLIC VIEW PRIVACY HARDENING
-- ============================================================================
-- Purpose:
--   Close the authenticated public-view surface identified by T0.2A before
--   external investor / intermediary / family-office pilot identities expand.
--
-- Evidence baseline:
--   Repository HEAD: b59854724452f22af9090a67ccbc7356af27d3ba
--   Live capture:    T0.2A_security_helper_view_tenancy_v1
--
-- Change:
--   1) Require invoker-security semantics on every current public view.
--   2) Remove direct anon/authenticated privileges from those views.
--
-- Current VENTIQ source and captured public function bodies do not reference
-- any of these views. Service-role / postgres access is not revoked.
--
-- This migration does NOT alter underlying business rows.
-- ============================================================================

begin;

do $$
declare
  expected_views text[] := array[
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
  ];
  missing_views text[];
begin
  select array_agg(v)
    into missing_views
  from unnest(expected_views) as v
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname = v
  );

  if missing_views is not null then
    raise exception
      'VENTIQ_T1_S0_1_STOP: expected public views are missing: %',
      missing_views;
  end if;
end
$$;

alter view public.investor_position_snapshot_controls
  set (security_invoker = true);

alter view public.v_latest_completed_metric_runs
  set (security_invoker = true);

alter view public.v_latest_fund_performance_metrics
  set (security_invoker = true);

alter view public.v_latest_investor_performance_metrics
  set (security_invoker = true);

alter view public.v_latest_metric_reconciliation_results
  set (security_invoker = true);

alter view public.v_latest_portfolio_performance_metrics
  set (security_invoker = true);

alter view public.ventiq_capital_call_receipt_summary
  set (security_invoker = true);

alter view public.ventiq_distribution_payment_summary
  set (security_invoker = true);

alter view public.ventiq_latest_fund_nav
  set (security_invoker = true);

alter view public.ventiq_latest_portfolio_valuations
  set (security_invoker = true);

alter view public.ventiq_portfolio_cashflow_ledger
  set (security_invoker = true);

revoke all privileges on table
  public.investor_position_snapshot_controls,
  public.v_latest_completed_metric_runs,
  public.v_latest_fund_performance_metrics,
  public.v_latest_investor_performance_metrics,
  public.v_latest_metric_reconciliation_results,
  public.v_latest_portfolio_performance_metrics,
  public.ventiq_capital_call_receipt_summary,
  public.ventiq_distribution_payment_summary,
  public.ventiq_latest_fund_nav,
  public.ventiq_latest_portfolio_valuations,
  public.ventiq_portfolio_cashflow_ledger
from anon, authenticated;

commit;

-- Expected postcondition:
--   every listed view has security_invoker=true
--   anon/authenticated have zero direct grants on the listed views
