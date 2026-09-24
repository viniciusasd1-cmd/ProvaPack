-- PROVAPACK MVP-01.4.1
-- Fechar RLS para public.provapacks e tornar registros estritamente imutáveis

-- 1. Remover policies antigas permissivas
drop policy if exists "Leitura pública de metadados de verificação" on public.provapacks;
drop policy if exists "Inserção via backend autorizado" on public.provapacks;

-- 2. Garantir RLS habilitado
alter table public.provapacks enable row level security;

-- 3. Nenhuma policy pública para SELECT ou INSERT.
-- O frontend não acessa o Supabase diretamente.
-- Todas as operações passam pelo backend Node/Express com SUPABASE_SERVICE_ROLE_KEY.
-- A chave service_role possui bypass nativo de RLS no Supabase/PostgreSQL.
