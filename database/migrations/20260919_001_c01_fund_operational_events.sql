-- C01-A: additive foundation only; no source-module wiring.
begin;

create table public.fund_operational_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.ventiq_organisations(id),
  fund_name text not null check (fund_name = btrim(fund_name) and fund_name <> ''),
  fund_id uuid,
  event_type text not null check (btrim(event_type) <> ''),
  event_title text not null check (btrim(event_title) <> ''),
  event_description text,
  event_date date not null,
  effective_date date not null,
  accounting_date date,
  amount numeric check (amount not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  currency text,
  entity_type text,
  entity_id text,
  counterparty text,
  source_module text not null check (btrim(source_module) <> ''),
  source_record_type text not null check (btrim(source_record_type) <> ''),
  source_record_id text not null check (btrim(source_record_id) <> ''),
  source_subkey text,
  source_document_id uuid,
  source_document_path text,
  approval_request_id uuid,
  governance_status text,
  created_by uuid,
  created_by_name text,
  created_by_role text,
  reverses_event_id uuid,
  supersedes_event_id uuid,
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint fund_operational_events_currency check (
    amount is null or (currency is not null and btrim(currency) <> '')
  ),
  constraint fund_operational_events_correction check (
    reverses_event_id is null or supersedes_event_id is null
  ),
  unique (organisation_id, fund_name, id),
  foreign key (organisation_id, fund_name, reverses_event_id)
    references public.fund_operational_events(organisation_id, fund_name, id),
  foreign key (organisation_id, fund_name, supersedes_event_id)
    references public.fund_operational_events(organisation_id, fund_name, id)
);

create unique index fund_operational_events_idempotency_idx
  on public.fund_operational_events (organisation_id, lower(btrim(fund_name)), idempotency_key);
create index fund_operational_events_timeline_idx
  on public.fund_operational_events (organisation_id, fund_name, event_date desc, id desc);

alter table public.fund_operational_events enable row level security;
revoke all on table public.fund_operational_events from public, anon, authenticated, service_role;
grant select on table public.fund_operational_events to authenticated;
grant select, insert on table public.fund_operational_events to service_role;

create policy fund_operational_events_member_read
  on public.fund_operational_events for select to authenticated
  using (
    exists (
      select 1 from public.ventiq_organisation_members member
      where member.user_id = auth.uid()
        and member.organisation_id = fund_operational_events.organisation_id
        and lower(btrim(member.status)) = 'active'
    )
    and exists (
      select 1 from public.ventiq_user_fund_access access_record
      where access_record.user_id = auth.uid()
        and access_record.organisation_id = fund_operational_events.organisation_id
        and lower(btrim(access_record.fund_name)) = lower(btrim(fund_operational_events.fund_name))
        and lower(btrim(access_record.status)) = 'active'
        and (access_record.expires_at is null or access_record.expires_at > now())
        and access_record.can_view is true
    )
  );

-- Supabase service_role bypasses RLS, but has only SELECT/INSERT privileges.
-- Corrections append scoped reversal/supersession rows; no mutation policies.
commit;
