-- PROVAPACK MVP-02A.2
-- RPC LOCKDOWN & FAIL-CLOSED FINAL GATE

-- 1. Atualizar public.register_provapack_with_usage com validação estrita de períodos e sem criação de perfil fallback
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
  v_remaining integer := null;
  v_unlimited boolean := false;
  v_is_period_valid boolean := false;
begin
  -- 1. Obter e bloquear a conta do vendedor com FOR UPDATE
  select * into v_profile
  from public.seller_profiles
  where id = p_user_id
  for update;

  -- Se perfil não existe, fail-closed: trigger auth.users deve ter provisionado
  if not found then
    raise exception 'PROFILE_NOT_PROVISIONED';
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
      
      v_is_period_valid := (
        v_profile.current_period_start is not null and
        v_profile.current_period_end is not null and
        v_profile.current_period_start <= now() and
        v_profile.current_period_end > now()
      );

      if v_profile.plan_code = 'free' then
        v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;
        v_unlimited := false;
      elsif v_profile.plan_code = 'pro' then
        select count(*) into v_monthly_used
        from public.usage_events
        where user_id = p_user_id
          and usage_source = 'monthly'
          and created_at >= v_profile.current_period_start
          and created_at < v_profile.current_period_end;
        v_remaining := greatest(0, coalesce(v_profile.monthly_limit, 50) - v_monthly_used) + v_profile.extra_credits;
        v_unlimited := false;
      elsif v_profile.plan_code = 'volume' then
        if v_profile.subscription_status = 'active' and v_is_period_valid then
          v_unlimited := true;
          v_remaining := null;
        else
          v_unlimited := false;
          v_remaining := v_profile.extra_credits;
        end if;
      end if;

      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'dossier_id', p_dossier_id,
        'usage_source', coalesce(v_existing_event.usage_source, 'idempotent_existing'),
        'remaining', v_remaining,
        'unlimited', v_unlimited,
        'account', jsonb_build_object(
          'planCode', v_profile.plan_code,
          'subscriptionStatus', v_profile.subscription_status,
          'freeLimit', v_profile.free_credit_limit,
          'freeUsed', v_free_used,
          'monthlyLimit', v_profile.monthly_limit,
          'monthlyUsed', v_monthly_used,
          'extraCredits', v_profile.extra_credits,
          'remaining', v_remaining,
          'unlimited', v_unlimited,
          'currentPeriodStart', v_profile.current_period_start,
          'currentPeriodEnd', v_profile.current_period_end
        )
      );
    else
      raise exception 'DOSSIER_CONFLICT';
    end if;
  end if;

  -- 4. Verificar entitlement
  v_is_period_valid := (
    v_profile.current_period_start is not null and
    v_profile.current_period_end is not null and
    v_profile.current_period_start <= now() and
    v_profile.current_period_end > now()
  );

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
    if v_profile.subscription_status = 'active' and v_is_period_valid then
      select count(*) into v_monthly_used
      from public.usage_events
      where user_id = p_user_id
        and usage_source = 'monthly'
        and created_at >= v_profile.current_period_start
        and created_at < v_profile.current_period_end;

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
    if v_profile.subscription_status = 'active' and v_is_period_valid then
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

  -- 7. Calcular saldo atualizado pós-inserção
  select count(*) into v_free_used from public.usage_events where user_id = p_user_id and usage_source = 'free';

  if v_profile.plan_code = 'free' then
    v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;
    v_unlimited := false;
  elsif v_profile.plan_code = 'pro' then
    select count(*) into v_monthly_used
    from public.usage_events
    where user_id = p_user_id
      and usage_source = 'monthly'
      and created_at >= v_profile.current_period_start
      and created_at < v_profile.current_period_end;
    v_remaining := greatest(0, coalesce(v_profile.monthly_limit, 50) - v_monthly_used) + v_profile.extra_credits;
    v_unlimited := false;
  elsif v_profile.plan_code = 'volume' then
    v_unlimited := true;
    v_remaining := null;
  end if;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'dossier_id', p_dossier_id,
    'usage_source', v_source,
    'remaining', v_remaining,
    'unlimited', v_unlimited,
    'account', jsonb_build_object(
      'planCode', v_profile.plan_code,
      'subscriptionStatus', v_profile.subscription_status,
      'freeLimit', v_profile.free_credit_limit,
      'freeUsed', v_free_used,
      'monthlyLimit', v_profile.monthly_limit,
      'monthlyUsed', v_monthly_used,
      'extraCredits', v_profile.extra_credits,
      'remaining', v_remaining,
      'unlimited', v_unlimited,
      'currentPeriodStart', v_profile.current_period_start,
      'currentPeriodEnd', v_profile.current_period_end
    )
  );
end;
$$;

-- 2. Atualizar public.get_account_summary com validação estrita e sem número sentinela 999999
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
  v_remaining integer := null;
  v_unlimited boolean := false;
  v_is_period_valid boolean := false;
begin
  select * into v_profile from public.seller_profiles where id = p_user_id;
  if not found then
    return null;
  end if;

  v_is_period_valid := (
    v_profile.current_period_start is not null and
    v_profile.current_period_end is not null and
    v_profile.current_period_start <= now() and
    v_profile.current_period_end > now()
  );

  select count(*) into v_free_used
  from public.usage_events
  where user_id = p_user_id and usage_source = 'free';

  if v_profile.plan_code = 'free' then
    v_remaining := greatest(0, v_profile.free_credit_limit - v_free_used) + v_profile.extra_credits;
    v_unlimited := false;

  elsif v_profile.plan_code = 'pro' then
    if v_profile.subscription_status = 'active' and v_is_period_valid then
      select count(*) into v_monthly_used
      from public.usage_events
      where user_id = p_user_id
        and usage_source = 'monthly'
        and created_at >= v_profile.current_period_start
        and created_at < v_profile.current_period_end;

      v_remaining := greatest(0, coalesce(v_profile.monthly_limit, 50) - v_monthly_used) + v_profile.extra_credits;
    else
      v_remaining := v_profile.extra_credits;
    end if;
    v_unlimited := false;

  elsif v_profile.plan_code = 'volume' then
    if v_profile.subscription_status = 'active' and v_is_period_valid then
      v_unlimited := true;
      v_remaining := null;
    else
      v_unlimited := false;
      v_remaining := v_profile.extra_credits;
    end if;
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
    'unlimited', v_unlimited,
    'currentPeriodStart', v_profile.current_period_start,
    'currentPeriodEnd', v_profile.current_period_end
  );
end;
$$;

-- 3. BLOQUEIO DE EXECUÇÃO DIRETA DAS RPCs PRIVILEGIADAS (P1)
-- Revogar privilégios de execução de PUBLIC, anon e authenticated.
-- Conceder EXCLUSIVAMENTE a service_role (chamado apenas pelo backend).

REVOKE EXECUTE
ON FUNCTION public.get_account_summary(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.get_account_summary(uuid)
TO service_role;

REVOKE EXECUTE
ON FUNCTION public.register_provapack_with_usage(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  integer,
  text,
  text,
  bigint,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.register_provapack_with_usage(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  integer,
  text,
  text,
  bigint,
  text
)
TO service_role;

-- Revogar permissões públicas da função interna de trigger
REVOKE EXECUTE
ON FUNCTION public.handle_new_provapack_user()
FROM PUBLIC, anon, authenticated;
