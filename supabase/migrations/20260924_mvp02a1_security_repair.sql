-- PROVAPACK MVP-02A.1
-- AUTH & CREDIT SECURITY REPAIR: DATABASE-AUTHORITATIVE IDENTITY, ENTITLEMENT & ATOMIC USAGE

-- 1. Garantir que a tabela seller_profiles possua todos os campos contratuais
create table if not exists public.seller_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan_code text not null default 'free',
  subscription_status text not null default 'active',
  free_credit_limit integer not null default 10,
  monthly_limit integer null,
  extra_credits integer not null default 0,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  mp_customer_id text null,
  mp_subscription_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adicionar colunas se tabela já existia da migração anterior
alter table public.seller_profiles 
  add column if not exists plan_code text not null default 'free',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists free_credit_limit integer not null default 10,
  add column if not exists monthly_limit integer null,
  add column if not exists extra_credits integer not null default 0,
  add column if not exists current_period_start timestamptz null,
  add column if not exists current_period_end timestamptz null,
  add column if not exists mp_customer_id text null,
  add column if not exists mp_subscription_id text null,
  add column if not exists updated_at timestamptz not null default now();

-- Constraint checks para integridade de dados comerciais
alter table public.seller_profiles drop constraint if exists chk_seller_profiles_plan_code;
alter table public.seller_profiles add constraint chk_seller_profiles_plan_code
  check (plan_code in ('free', 'pro', 'volume'));

alter table public.seller_profiles drop constraint if exists chk_seller_profiles_subscription_status;
alter table public.seller_profiles add constraint chk_seller_profiles_subscription_status
  check (subscription_status in ('active', 'pending', 'past_due', 'cancelled'));

alter table public.seller_profiles drop constraint if exists chk_seller_profiles_free_credit_limit;
alter table public.seller_profiles add constraint chk_seller_profiles_free_credit_limit
  check (free_credit_limit >= 0);

alter table public.seller_profiles drop constraint if exists chk_seller_profiles_extra_credits;
alter table public.seller_profiles add constraint chk_seller_profiles_extra_credits
  check (extra_credits >= 0);

-- Habilitar RLS em seller_profiles
alter table public.seller_profiles enable row level security;

-- Usuário autenticado pode ler apenas seu próprio perfil
drop policy if exists "Users can read own profile" on public.seller_profiles;
create policy "Users can read own profile"
  on public.seller_profiles
  for select
  using (auth.uid() = id);

-- 2. Tabela de eventos de consumo imutáveis (usage_events)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dossier_id text not null,
  usage_source text not null check (usage_source in ('free', 'monthly', 'extra', 'unlimited')),
  created_at timestamptz not null default now(),
  constraint uq_user_dossier_usage unique (user_id, dossier_id)
);

create index if not exists idx_usage_events_user_id on public.usage_events(user_id);
create index if not exists idx_usage_events_dossier_id on public.usage_events(dossier_id);

alter table public.usage_events enable row level security;
-- Sem policies públicas para frontend: apenas backend autenticado com service_role insere via RPC.

-- 3. Vincular provapacks ao owner_user_id
alter table public.provapacks 
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

update public.provapacks 
  set owner_user_id = user_id 
  where owner_user_id is null and user_id is not null;

create index if not exists idx_provapacks_owner_user_id on public.provapacks(owner_user_id);

-- 4. Trigger seguro: Criação automática de perfil ao cadastrar usuário no Supabase Auth
create or replace function public.handle_new_provapack_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.seller_profiles (
    id,
    email,
    plan_code,
    subscription_status,
    free_credit_limit,
    extra_credits,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    'active',
    10,
    0,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provapack on auth.users;
create trigger on_auth_user_created_provapack
  after insert on auth.users
  for each row execute function public.handle_new_provapack_user();

-- 5. Função RPC atômica para registro de dossiê e consumo de crédito em transação única
create or replace function public.register_provapack_with_usage(
  p_user_id uuid,
  p_dossier_id text,
  p_recording_id text,
  p_marketplace text,
  p_order_number text,
  p_tracking_code text,
  p_product_name text,
  p_serial_number text,
  p_recorded_at timestamptz,
  p_started_at_utc timestamptz,
  p_ended_at_utc timestamptz,
  p_timezone text,
  p_time_source text,
  p_duration_seconds integer,
  p_original_sha256 text,
  p_processed_sha256 text,
  p_file_size_bytes bigint,
  p_status text default 'validado'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_existing_event record;
  v_existing_pack record;
  v_free_used integer := 0;
  v_monthly_used integer := 0;
  v_source text := null;
  v_remaining integer := 0;
begin
  -- 1. Obter e bloquear a conta do vendedor com FOR UPDATE
  select * into v_profile
  from public.seller_profiles
  where id = p_user_id
  for update;

  if not found then
    -- Perfil inicial de segurança se trigger não tiver disparado
    insert into public.seller_profiles (
      id, email, plan_code, subscription_status, free_credit_limit, extra_credits
    ) values (
      p_user_id, '', 'free', 'active', 10, 0
    )
    on conflict (id) do nothing;

    select * into v_profile
    from public.seller_profiles
    where id = p_user_id
    for update;
  end if;

  -- 2. Verificar se o registro provapack já existe
  select * into v_existing_pack
  from public.provapacks
  where public_id = p_dossier_id;

  -- 3. Verificar se já existe usage_event para user_id + dossier_id (Idempotência estrita)
  select * into v_existing_event
  from public.usage_events
  where user_id = p_user_id and dossier_id = p_dossier_id;

  if v_existing_pack.public_id is not null or v_existing_event.id is not null then
    if v_existing_pack.public_id is not null and
       v_existing_pack.recording_id = p_recording_id and
       v_existing_pack.original_sha256 = p_original_sha256 and
       v_existing_pack.processed_sha256 = p_processed_sha256 then

      select count(*) into v_free_used from public.usage_events where user_id = p_user_id and usage_source = 'free';
      v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;

      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'dossier_id', p_dossier_id,
        'usage_source', coalesce(v_existing_event.usage_source, 'idempotent_existing'),
        'remaining', v_remaining,
        'account', jsonb_build_object(
          'planCode', v_profile.plan_code,
          'subscriptionStatus', v_profile.subscription_status,
          'freeLimit', v_profile.free_credit_limit,
          'freeUsed', v_free_used,
          'extraCredits', v_profile.extra_credits,
          'remaining', v_remaining,
          'unlimited', (v_profile.plan_code = 'volume')
        )
      );
    else
      raise exception 'DOSSIER_CONFLICT';
    end if;
  end if;

  -- 4. Verificar entitlement
  if v_profile.plan_code = 'free' then
    select count(*) into v_free_used
    from public.usage_events
    where user_id = p_user_id and usage_source = 'free';

    if v_free_used < v_profile.free_credit_limit then
      v_source := 'free';
    elsif v_profile.extra_credits > 0 then
      update public.seller_profiles
      set extra_credits = extra_credits - 1, updated_at = now()
      where id = p_user_id;
      v_profile.extra_credits := v_profile.extra_credits - 1;
      v_source := 'extra';
    else
      raise exception 'NO_CREDITS';
    end if;

  elsif v_profile.plan_code = 'pro' then
    if v_profile.subscription_status = 'active' then
      select count(*) into v_monthly_used
      from public.usage_events
      where user_id = p_user_id
        and usage_source = 'monthly'
        and created_at >= coalesce(v_profile.current_period_start, now() - interval '30 days');

      if v_monthly_used < coalesce(v_profile.monthly_limit, 50) then
        v_source := 'monthly';
      elsif v_profile.extra_credits > 0 then
        update public.seller_profiles
        set extra_credits = extra_credits - 1, updated_at = now()
        where id = p_user_id;
        v_profile.extra_credits := v_profile.extra_credits - 1;
        v_source := 'extra';
      else
        raise exception 'NO_CREDITS';
      end if;
    else
      raise exception 'SUBSCRIPTION_INACTIVE';
    end if;

  elsif v_profile.plan_code = 'volume' then
    if v_profile.subscription_status = 'active' then
      v_source := 'unlimited';
    else
      raise exception 'SUBSCRIPTION_INACTIVE';
    end if;

  else
    raise exception 'INVALID_PLAN';
  end if;

  -- 5. Inserir registro em provapacks (imutável)
  insert into public.provapacks (
    user_id,
    owner_user_id,
    public_id,
    recording_id,
    marketplace,
    order_number,
    tracking_code,
    product_name,
    serial_number,
    recorded_at,
    started_at_utc,
    ended_at_utc,
    timezone,
    time_source,
    duration_seconds,
    original_sha256,
    processed_sha256,
    file_size_bytes,
    status
  ) values (
    p_user_id,
    p_user_id,
    p_dossier_id,
    p_recording_id,
    coalesce(p_marketplace, 'Outros'),
    coalesce(p_order_number, ''),
    p_tracking_code,
    coalesce(p_product_name, ''),
    p_serial_number,
    coalesce(p_recorded_at, now()),
    p_started_at_utc,
    p_ended_at_utc,
    coalesce(p_timezone, 'America/Sao_Paulo'),
    coalesce(p_time_source, 'DEVICE_WITH_SERVER_REFERENCE'),
    coalesce(p_duration_seconds, 0),
    p_original_sha256,
    p_processed_sha256,
    coalesce(p_file_size_bytes, 0),
    coalesce(p_status, 'validado')
  );

  -- 6. Inserir em usage_events
  insert into public.usage_events (
    user_id,
    dossier_id,
    usage_source
  ) values (
    p_user_id,
    p_dossier_id,
    v_source
  );

  -- 7. Retornar resumo da conta atualizado
  select count(*) into v_free_used from public.usage_events where user_id = p_user_id and usage_source = 'free';
  if v_profile.plan_code = 'free' then
    v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;
  elsif v_profile.plan_code = 'pro' then
    v_remaining := greatest(0, coalesce(v_profile.monthly_limit, 50) - v_monthly_used) + v_profile.extra_credits;
  else
    v_remaining := 999999;
  end if;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'dossier_id', p_dossier_id,
    'usage_source', v_source,
    'remaining', v_remaining,
    'account', jsonb_build_object(
      'planCode', v_profile.plan_code,
      'subscriptionStatus', v_profile.subscription_status,
      'freeLimit', v_profile.free_credit_limit,
      'freeUsed', v_free_used,
      'monthlyLimit', v_profile.monthly_limit,
      'monthlyUsed', v_monthly_used,
      'extraCredits', v_profile.extra_credits,
      'remaining', v_remaining,
      'unlimited', (v_profile.plan_code = 'volume'),
      'currentPeriodStart', v_profile.current_period_start,
      'currentPeriodEnd', v_profile.current_period_end
    )
  );
end;
$$;

-- 6. Função para consulta autorizada de resumo da conta do usuário autenticado
create or replace function public.get_account_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_free_used integer := 0;
  v_monthly_used integer := 0;
  v_remaining integer := 0;
begin
  select * into v_profile from public.seller_profiles where id = p_user_id;
  if not found then
    return null;
  end if;

  select count(*) into v_free_used
  from public.usage_events
  where user_id = p_user_id and usage_source = 'free';

  select count(*) into v_monthly_used
  from public.usage_events
  where user_id = p_user_id
    and usage_source = 'monthly'
    and created_at >= coalesce(v_profile.current_period_start, now() - interval '30 days');

  if v_profile.plan_code = 'free' then
    v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;
  elsif v_profile.plan_code = 'pro' then
    v_remaining := greatest(0, coalesce(v_profile.monthly_limit, 50) - v_monthly_used) + v_profile.extra_credits;
  else
    v_remaining := 999999;
  end if;

  return jsonb_build_object(
    'planCode', v_profile.plan_code,
    'subscriptionStatus', v_profile.subscription_status,
    'freeLimit', v_profile.free_credit_limit,
    'freeUsed', v_free_used,
    'monthlyLimit', v_profile.monthly_limit,
    'monthlyUsed', v_monthly_used,
    'extraCredits', v_profile.extra_credits,
    'remaining', v_remaining,
    'unlimited', (v_profile.plan_code = 'volume'),
    'currentPeriodStart', v_profile.current_period_start,
    'currentPeriodEnd', v_profile.current_period_end
  );
end;
$$;
