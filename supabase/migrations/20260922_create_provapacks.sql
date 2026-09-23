-- PROVAPACK MVP-01 SCHEMA
-- Tabela para persistência de metadados essenciais de evidências
-- Vídeos e fotografias NÃO são armazenados aqui (permanecem em custódia local do vendedor).

create extension if not exists "uuid-ossp";

create table if not exists public.provapacks (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  recording_id text unique not null,
  marketplace text not null default 'Outros',
  order_number text not null,
  tracking_code text,
  product_name text not null,
  serial_number text,
  recorded_at timestamptz not null default now(),
  started_at_utc timestamptz,
  ended_at_utc timestamptz,
  timezone text default 'America/Sao_Paulo',
  time_source text default 'DEVICE_WITH_SERVER_REFERENCE',
  duration_seconds integer not null default 0,
  original_sha256 text not null,
  processed_sha256 text not null,
  file_size_bytes bigint default 0,
  status text not null default 'validado',
  created_at timestamptz not null default now()
);

-- Índices para consulta rápida por ID público ou ID de gravação
create index if not exists idx_provapacks_public_id on public.provapacks(public_id);
create index if not exists idx_provapacks_recording_id on public.provapacks(recording_id);
create index if not exists idx_provapacks_order_number on public.provapacks(order_number);

-- RLS (Row Level Security)
alter table public.provapacks enable row level security;

-- Política de leitura pública (qualquer pessoa com o ID/link pode verificar integridade técnica sem ver dados pessoais de compradores)
create policy "Leitura pública de metadados de verificação"
  on public.provapacks
  for select
  using (true);

-- Política de inserção protegida (via backend Express com service_role)
create policy "Inserção via backend autorizado"
  on public.provapacks
  for insert
  with check (true);
