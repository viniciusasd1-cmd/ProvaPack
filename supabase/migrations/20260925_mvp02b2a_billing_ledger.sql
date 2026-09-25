-- PROVAPACK MVP-02B.2A
-- Persistent billing ledger foundation only.

-- 1. Asaas references on seller profiles. Mercado Pago fields remain legacy.
alter table public.seller_profiles
  add column if not exists asaas_customer_id text null,
  add column if not exists asaas_subscription_id text null,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists uq_seller_profiles_asaas_customer_id
  on public.seller_profiles (asaas_customer_id)
  where asaas_customer_id is not null;

create unique index if not exists uq_seller_profiles_asaas_subscription_id
  on public.seller_profiles (asaas_subscription_id)
  where asaas_subscription_id is not null;

-- 2. Normalized billing intents.
create table if not exists public.billing_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  provider text not null default 'asaas',
  provider_resource_type text null,
  provider_resource_id text null,
  external_reference text null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null default 'pending',
  provider_status text null,
  checkout_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_billing_intents_product_code
    check (product_code in ('pro_monthly', 'volume_monthly', 'extra_credits_5')),
  constraint chk_billing_intents_provider
    check (provider = 'asaas'),
  constraint chk_billing_intents_amount_cents
    check (amount_cents > 0),
  constraint chk_billing_intents_currency
    check (currency = 'BRL'),
  constraint chk_billing_intents_status
    check (status in ('pending', 'approved', 'failed', 'cancelled', 'expired', 'refunded'))
);

create index if not exists idx_billing_intents_user_created_at
  on public.billing_intents (user_id, created_at desc);

create index if not exists idx_billing_intents_status
  on public.billing_intents (status);

create unique index if not exists uq_billing_intents_provider_resource_id
  on public.billing_intents (provider, provider_resource_id)
  where provider_resource_id is not null;

create unique index if not exists uq_billing_intents_external_reference
  on public.billing_intents (external_reference)
  where external_reference is not null;

-- 3. Normalized billing events and webhook idempotency key.
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  provider_event_id text not null,
  event_type text not null,
  intent_id uuid null references public.billing_intents(id) on delete set null,
  provider_payment_id text null,
  provider_subscription_id text null,
  provider_status text null,
  amount_cents integer null,
  processing_status text not null default 'received',
  processing_error text null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  constraint chk_billing_events_provider
    check (provider = 'asaas'),
  constraint chk_billing_events_processing_status
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  constraint chk_billing_events_amount_cents
    check (amount_cents is null or amount_cents >= 0),
  constraint uq_billing_events_provider_event
    unique (provider, provider_event_id)
);

create index if not exists idx_billing_events_intent_id
  on public.billing_events (intent_id);

create index if not exists idx_billing_events_provider_payment_id
  on public.billing_events (provider_payment_id);

create index if not exists idx_billing_events_provider_subscription_id
  on public.billing_events (provider_subscription_id);

create index if not exists idx_billing_events_received_at
  on public.billing_events (received_at desc);

-- 4. Backend-only access boundary.
alter table public.billing_intents enable row level security;
alter table public.billing_events enable row level security;

revoke all on table public.billing_intents from anon, authenticated;
revoke all on table public.billing_events from anon, authenticated;

grant all on table public.billing_intents to service_role;
grant all on table public.billing_events to service_role;
