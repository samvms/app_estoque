-- ============================================
-- CORE (multi-tenant) - SEM seed "SMARTWAY"
-- Copiar e colar como 1 migration.
-- ============================================

-- 0) Garantias básicas
create extension if not exists pgcrypto;

create schema if not exists core;

-- ============================================
-- 1) EMPRESAS (TENANTS)
-- ============================================
create table if not exists core.empresas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  cnpj text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresas_codigo_unq unique (codigo),
  constraint empresas_cnpj_unq unique (cnpj),
  constraint empresas_cnpj_chk check (
    cnpj is null
    or (cnpj ~ '^[0-9]{14}$')
  )
);

create or replace function core.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_empresas_set_updated_at on core.empresas;
create trigger trg_empresas_set_updated_at
before update on core.empresas
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 2) PERFIS (usuário dentro da empresa)
--    IMPORTANT: sem trigger em auth.users
-- ============================================
create table if not exists core.perfis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique, -- auth.users.id
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  nome text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_perfis_set_updated_at on core.perfis;
create trigger trg_perfis_set_updated_at
before update on core.perfis
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 3) FUNÇÃO "empresa atual" (multi-tenant)
-- ============================================
create or replace function core.fn_empresa_id_atual()
returns uuid
language sql
stable
security definer
set search_path = core, public
as $$
  select p.empresa_id
  from core.perfis p
  where p.user_id = auth.uid()
  limit 1
$$;

revoke all on function core.fn_empresa_id_atual() from public;
grant execute on function core.fn_empresa_id_atual() to authenticated;

-- ============================================
-- 4) ONBOARDING: cria empresa + cria perfil (SEM SMARTWAY)
--    Chame isso no frontend logo após login/signup.
-- ============================================
create or replace function core.fn_onboarding_criar_empresa_e_perfil(
  p_codigo text,
  p_nome text,
  p_cnpj text default null,
  p_nome_usuario text default null
)
returns uuid
language plpgsql
security definer
set search_path = core, public
as $$
declare
  v_user_id uuid;
  v_empresa_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'nao_autenticado';
  end if;

  if p_codigo is null or btrim(p_codigo) = '' then
    raise exception 'codigo_obrigatorio';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome_obrigatorio';
  end if;

  if p_cnpj is not null then
    p_cnpj := regexp_replace(p_cnpj, '[^0-9]', '', 'g');
    if length(p_cnpj) <> 14 then
      raise exception 'cnpj_invalido';
    end if;
  end if;

  -- Se já tem perfil, só retorna empresa atual
  select empresa_id into v_empresa_id
  from core.perfis
  where user_id = v_user_id
  limit 1;

  if v_empresa_id is not null then
    return v_empresa_id;
  end if;

  -- Cria empresa
  insert into core.empresas (codigo, nome, cnpj)
  values (upper(btrim(p_codigo)), btrim(p_nome), p_cnpj)
  returning id into v_empresa_id;

  -- Cria perfil
  insert into core.perfis (user_id, empresa_id, nome)
  values (v_user_id, v_empresa_id, nullif(btrim(p_nome_usuario), ''));

  return v_empresa_id;
end;
$$;

revoke all on function core.fn_onboarding_criar_empresa_e_perfil(text, text, text, text) from public;
grant execute on function core.fn_onboarding_criar_empresa_e_perfil(text, text, text, text) to authenticated;

-- ============================================
-- 5) RLS (recomendado)
-- ============================================
alter table core.empresas enable row level security;
alter table core.perfis enable row level security;

-- Empresas: usuário só vê a empresa do próprio perfil
drop policy if exists empresas_select on core.empresas;
create policy empresas_select
on core.empresas
for select
to authenticated
using (id = core.fn_empresa_id_atual());

-- (Opcional) bloquear update/insert/delete direto via API
drop policy if exists empresas_no_write on core.empresas;
create policy empresas_no_write
on core.empresas
for all
to authenticated
using (false)
with check (false);

-- Perfis: usuário só vê/edita o próprio perfil
drop policy if exists perfis_select on core.perfis;
create policy perfis_select
on core.perfis
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists perfis_update on core.perfis;
create policy perfis_update
on core.perfis
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists perfis_insert_block on core.perfis;
create policy perfis_insert_block
on core.perfis
for insert
to authenticated
with check (false);

drop policy if exists perfis_delete_block on core.perfis;
create policy perfis_delete_block
on core.perfis
for delete
to authenticated
using (false);

-- ============================================
-- 6) Remover trigger antigo (se existir) que criava perfil automático
--    (nomes variam; aqui tento os mais comuns)
-- ============================================
do $$
begin
  -- se você tinha um trigger em auth.users chamando fn_criar_perfil_novo_usuario, remova aqui.
  -- Esses drops são "best effort"; se não existir, não quebra.
  execute 'drop trigger if exists on_auth_user_created on auth.users';
exception when others then
  null;
end $$;

do $$
begin
  execute 'drop function if exists core.fn_criar_perfil_novo_usuario()';
exception when others then
  null;
end $$;
