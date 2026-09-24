-- PROVAPACK MVP-02A
-- Identidade Persistente, Perfis de Vendedor e Controle de Cota no Backend

-- 1. Tabela de Perfis de Vendedor com Cota Autorizada pelo Servidor
create table if not exists public.seller_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'Gratuito (10 envios)',
  free_dossiers_remaining integer not null default 10,
  monthly_limit integer not null default 10,
  used_this_month integer not null default 0,
  extra_credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Vincular registros ProvaPack ao usuário autenticado (imutável e rastreável)
alter table public.provapacks 
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_provapacks_user_id on public.provapacks(user_id);

-- 3. Habilitar RLS em seller_profiles
alter table public.seller_profiles enable row level security;

-- 4. Policies de Segurança:
-- Usuário autenticado pode ler apenas seus próprios dados de cota/plano
drop policy if exists "Users can read own profile" on public.seller_profiles;
create policy "Users can read own profile"
  on public.seller_profiles
  for select
  using (auth.uid() = id);

-- Nenhuma policy pública de INSERT, UPDATE ou DELETE.
-- Apenas o backend autenticado com SERVICE_ROLE / SECRET_KEY tem permissão de escrita,
-- garantindo que o cliente web NUNCA altere plano ou créditos diretamente.
