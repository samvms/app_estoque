-- ============================================
-- MIGRATION 002 - LWS (base: enums + tabelas)
-- Schema do produto: lws
-- Padrão: created_at/updated_at + trigger core.fn_set_updated_at()
-- Multi-tenant: empresa_id + core.fn_empresa_id_atual()
-- ============================================

create schema if not exists lws;

-- ============================================
-- 1) ENUMS (lws)
-- ============================================
do $$ begin
  create type lws.origem_auditoria as enum ('CONTAGEM','RECEBIMENTO','QR_DANIFICADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.status_caixa as enum ('CONFERIDO_OK','AGUARDANDO_CONFERENCIA','DIVERGENTE','SAIDA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.status_contagem as enum ('ABERTA','FECHADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.status_qr_etiqueta as enum ('DISPONIVEL','USADO','DANIFICADO','CANCELADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.status_recebimento as enum ('ABERTO','APROVADO','REPROVADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.status_recebimento_item as enum ('ABERTO','OK','DIVERGENTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.tipo_conferencia as enum ('AMOSTRA','TOTAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lws.tipo_contagem as enum ('INICIAL','PERIODICA');
exception when duplicate_object then null; end $$;

-- ============================================
-- 2) TABELAS - Catálogo interno (produto/variação)
-- ============================================
create table if not exists lws.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  nome_modelo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_empresa on lws.produtos (empresa_id);
create unique index if not exists uq_produtos_empresa_modelo on lws.produtos (empresa_id, lower(nome_modelo));

drop trigger if exists trg_produtos_set_updated_at on lws.produtos;
create trigger trg_produtos_set_updated_at
before update on lws.produtos
for each row execute function core.fn_set_updated_at();

create table if not exists lws.produto_variantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  produto_id uuid not null references lws.produtos(id) on delete restrict,
  sku text null,
  variacao text not null, -- antes "cor"
  nome_exibicao text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produto_variantes_sku_unq unique (empresa_id, sku)
);

create index if not exists idx_variantes_empresa on lws.produto_variantes (empresa_id);
create index if not exists idx_variantes_produto on lws.produto_variantes (produto_id);

drop trigger if exists trg_variantes_set_updated_at on lws.produto_variantes;
create trigger trg_variantes_set_updated_at
before update on lws.produto_variantes
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 3) LOCAIS (corrigido: unique por lower(nome) via INDEX)
-- ============================================
create table if not exists lws.locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_locais_empresa on lws.locais (empresa_id);

create unique index if not exists uq_locais_empresa_nome_lower
  on lws.locais (empresa_id, lower(nome));

drop trigger if exists trg_locais_set_updated_at on lws.locais;
create trigger trg_locais_set_updated_at
before update on lws.locais
for each row execute function core.fn_set_updated_at();


-- ============================================
-- 4) QR Codes (lotes + etiquetas)
-- ============================================
create table if not exists lws.qr_lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  produto_variante_id uuid not null references lws.produto_variantes(id) on delete restrict,
  quantidade int not null check (quantidade > 0),
  lote_texto text null,
  criado_por uuid not null, -- auth.uid()
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qr_lotes_empresa on lws.qr_lotes (empresa_id);
create index if not exists idx_qr_lotes_variante on lws.qr_lotes (produto_variante_id);

drop trigger if exists trg_qr_lotes_set_updated_at on lws.qr_lotes;
create trigger trg_qr_lotes_set_updated_at
before update on lws.qr_lotes
for each row execute function core.fn_set_updated_at();

create table if not exists lws.qr_etiquetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  lote_id uuid not null references lws.qr_lotes(id) on delete restrict,
  produto_variante_id uuid not null references lws.produto_variantes(id) on delete restrict,
  qr_code uuid not null,
  status lws.status_qr_etiqueta not null default 'DISPONIVEL',
  usado_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_etiquetas_qr_unq unique (empresa_id, qr_code)
);

create index if not exists idx_qr_etiquetas_empresa on lws.qr_etiquetas (empresa_id);
create index if not exists idx_qr_etiquetas_lote on lws.qr_etiquetas (lote_id);
create index if not exists idx_qr_etiquetas_variante on lws.qr_etiquetas (produto_variante_id);

drop trigger if exists trg_qr_etiquetas_set_updated_at on lws.qr_etiquetas;
create trigger trg_qr_etiquetas_set_updated_at
before update on lws.qr_etiquetas
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 5) CAIXAS (instância física)
-- ============================================
create table if not exists lws.caixas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,

  qr_etiqueta_id uuid not null references lws.qr_etiquetas(id) on delete restrict,
  qr_code uuid not null,
  produto_variante_id uuid not null references lws.produto_variantes(id) on delete restrict,

  status_caixa lws.status_caixa not null default 'AGUARDANDO_CONFERENCIA',
  recebimento_id uuid null, -- fk criada depois (tabela recebimentos)
  contagem_ultima_id uuid null, -- fk criada depois (tabela contagens)
  local_id uuid null references lws.locais(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint caixas_qr_unq unique (empresa_id, qr_code)
);

create index if not exists idx_caixas_empresa on lws.caixas (empresa_id);
create index if not exists idx_caixas_status on lws.caixas (empresa_id, status_caixa);
create index if not exists idx_caixas_variante on lws.caixas (empresa_id, produto_variante_id);
create index if not exists idx_caixas_local on lws.caixas (empresa_id, local_id);

drop trigger if exists trg_caixas_set_updated_at on lws.caixas;
create trigger trg_caixas_set_updated_at
before update on lws.caixas
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 6) CONTAGENS
-- ============================================
create table if not exists lws.contagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,

  tipo lws.tipo_contagem not null,
  status lws.status_contagem not null default 'ABERTA',

  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz null,

  criada_por uuid not null, -- auth.uid()

  estoque_antes int null,
  estoque_contado int null,
  diferenca int null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contagens_empresa on lws.contagens (empresa_id);
create index if not exists idx_contagens_status on lws.contagens (empresa_id, status);

drop trigger if exists trg_contagens_set_updated_at on lws.contagens;
create trigger trg_contagens_set_updated_at
before update on lws.contagens
for each row execute function core.fn_set_updated_at();

create table if not exists lws.contagem_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  contagem_id uuid not null references lws.contagens(id) on delete cascade,
  caixa_id uuid not null references lws.caixas(id) on delete restrict,
  local_id uuid null references lws.locais(id) on delete restrict,
  bipado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contagem_itens_unq unique (contagem_id, caixa_id)
);

create index if not exists idx_contagem_itens_empresa on lws.contagem_itens (empresa_id);
create index if not exists idx_contagem_itens_contagem on lws.contagem_itens (contagem_id);

drop trigger if exists trg_contagem_itens_set_updated_at on lws.contagem_itens;
create trigger trg_contagem_itens_set_updated_at
before update on lws.contagem_itens
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 7) RECEBIMENTOS
-- ============================================
create table if not exists lws.recebimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,

  referencia text null,
  status lws.status_recebimento not null default 'ABERTO',
  tipo_conferencia lws.tipo_conferencia not null,

  criado_por uuid not null, -- auth.uid()
  aprovado_em timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recebimentos_empresa on lws.recebimentos (empresa_id);
create index if not exists idx_recebimentos_status on lws.recebimentos (empresa_id, status);

drop trigger if exists trg_recebimentos_set_updated_at on lws.recebimentos;
create trigger trg_recebimentos_set_updated_at
before update on lws.recebimentos
for each row execute function core.fn_set_updated_at();

create table if not exists lws.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,
  recebimento_id uuid not null references lws.recebimentos(id) on delete cascade,
  produto_variante_id uuid not null references lws.produto_variantes(id) on delete restrict,
  status lws.status_recebimento_item not null default 'ABERTO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recebimento_itens_unq unique (recebimento_id, produto_variante_id)
);

create index if not exists idx_recebimento_itens_empresa on lws.recebimento_itens (empresa_id);
create index if not exists idx_recebimento_itens_receb on lws.recebimento_itens (recebimento_id);

drop trigger if exists trg_recebimento_itens_set_updated_at on lws.recebimento_itens;
create trigger trg_recebimento_itens_set_updated_at
before update on lws.recebimento_itens
for each row execute function core.fn_set_updated_at();

-- Agora que recebimentos/contagens existem, cria FKs pendentes em caixas
do $$ begin
  alter table lws.caixas
    add constraint caixas_recebimento_fk
    foreign key (recebimento_id) references lws.recebimentos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table lws.caixas
    add constraint caixas_contagem_ultima_fk
    foreign key (contagem_ultima_id) references lws.contagens(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============================================
-- 8) AUDITORIA
-- ============================================
create table if not exists lws.auditorias_estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references core.empresas(id) on delete restrict,

  origem lws.origem_auditoria not null,
  referencia_id uuid not null,

  descricao text null,
  antes jsonb null,
  depois jsonb null,

  criado_por uuid not null, -- auth.uid()
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auditorias_empresa on lws.auditorias_estoque (empresa_id);
create index if not exists idx_auditorias_origem_ref on lws.auditorias_estoque (origem, referencia_id);

drop trigger if exists trg_auditorias_set_updated_at on lws.auditorias_estoque;
create trigger trg_auditorias_set_updated_at
before update on lws.auditorias_estoque
for each row execute function core.fn_set_updated_at();

-- ============================================
-- 9) PERMISSÕES + RLS
--   - manter padrão: front NÃO dá select direto, mas RLS já fica ok
-- ============================================
grant usage on schema lws to authenticated;

alter table lws.produtos enable row level security;
alter table lws.produto_variantes enable row level security;
alter table lws.locais enable row level security;
alter table lws.qr_lotes enable row level security;
alter table lws.qr_etiquetas enable row level security;
alter table lws.caixas enable row level security;
alter table lws.contagens enable row level security;
alter table lws.contagem_itens enable row level security;
alter table lws.recebimentos enable row level security;
alter table lws.recebimento_itens enable row level security;
alter table lws.auditorias_estoque enable row level security;

-- policies (select apenas da empresa atual; write geralmente via RPC depois)
-- PRODUTOS
drop policy if exists p_produtos_select on lws.produtos;
create policy p_produtos_select on lws.produtos
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_produtos_write_block on lws.produtos;
create policy p_produtos_write_block on lws.produtos
for all to authenticated
using (false) with check (false);

-- VARIANTES
drop policy if exists p_variantes_select on lws.produto_variantes;
create policy p_variantes_select on lws.produto_variantes
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_variantes_write_block on lws.produto_variantes;
create policy p_variantes_write_block on lws.produto_variantes
for all to authenticated
using (false) with check (false);

-- LOCAIS
drop policy if exists p_locais_select on lws.locais;
create policy p_locais_select on lws.locais
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_locais_write_block on lws.locais;
create policy p_locais_write_block on lws.locais
for all to authenticated
using (false) with check (false);

-- QR LOTES / ETIQUETAS
drop policy if exists p_qr_lotes_select on lws.qr_lotes;
create policy p_qr_lotes_select on lws.qr_lotes
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_qr_lotes_write_block on lws.qr_lotes;
create policy p_qr_lotes_write_block on lws.qr_lotes
for all to authenticated
using (false) with check (false);

drop policy if exists p_qr_etiquetas_select on lws.qr_etiquetas;
create policy p_qr_etiquetas_select on lws.qr_etiquetas
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_qr_etiquetas_write_block on lws.qr_etiquetas;
create policy p_qr_etiquetas_write_block on lws.qr_etiquetas
for all to authenticated
using (false) with check (false);

-- CAIXAS
drop policy if exists p_caixas_select on lws.caixas;
create policy p_caixas_select on lws.caixas
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_caixas_write_block on lws.caixas;
create policy p_caixas_write_block on lws.caixas
for all to authenticated
using (false) with check (false);

-- CONTAGENS / ITENS
drop policy if exists p_contagens_select on lws.contagens;
create policy p_contagens_select on lws.contagens
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_contagens_write_block on lws.contagens;
create policy p_contagens_write_block on lws.contagens
for all to authenticated
using (false) with check (false);

drop policy if exists p_contagem_itens_select on lws.contagem_itens;
create policy p_contagem_itens_select on lws.contagem_itens
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_contagem_itens_write_block on lws.contagem_itens;
create policy p_contagem_itens_write_block on lws.contagem_itens
for all to authenticated
using (false) with check (false);

-- RECEBIMENTOS / ITENS
drop policy if exists p_recebimentos_select on lws.recebimentos;
create policy p_recebimentos_select on lws.recebimentos
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_recebimentos_write_block on lws.recebimentos;
create policy p_recebimentos_write_block on lws.recebimentos
for all to authenticated
using (false) with check (false);

drop policy if exists p_receb_itens_select on lws.recebimento_itens;
create policy p_receb_itens_select on lws.recebimento_itens
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_receb_itens_write_block on lws.recebimento_itens;
create policy p_receb_itens_write_block on lws.recebimento_itens
for all to authenticated
using (false) with check (false);

-- AUDITORIAS
drop policy if exists p_auditorias_select on lws.auditorias_estoque;
create policy p_auditorias_select on lws.auditorias_estoque
for select to authenticated
using (empresa_id = core.fn_empresa_id_atual());

drop policy if exists p_auditorias_write_block on lws.auditorias_estoque;
create policy p_auditorias_write_block on lws.auditorias_estoque
for all to authenticated
using (false) with check (false);
