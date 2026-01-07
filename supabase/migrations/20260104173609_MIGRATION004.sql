-- ============================================
-- MIGRATION 004 - LWS (RPCs de leitura / telas)
-- Listagens + obter + stats + resumos
-- ============================================

-- ============================================
-- 1) LOCAIS (listar)
-- ============================================
create or replace function lws.fn_listar_locais()
returns table (
  id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    l.id,
    l.nome,
    l.ativo,
    l.created_at,
    l.updated_at
  from lws.locais l
  where l.empresa_id = core.fn_empresa_id_atual()
  order by lower(l.nome) asc;
$$;

grant execute on function lws.fn_listar_locais() to authenticated;

-- ============================================
-- 2) CONTAGENS (listar / obter / stats)
-- ============================================
create or replace function lws.fn_listar_contagens()
returns table (
  id uuid,
  tipo lws.tipo_contagem,
  status lws.status_contagem,
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  criada_por uuid,
  estoque_antes int,
  estoque_contado int,
  diferenca int,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    c.id,
    c.tipo,
    c.status,
    c.iniciada_em,
    c.finalizada_em,
    c.criada_por,
    c.estoque_antes,
    c.estoque_contado,
    c.diferenca,
    c.created_at,
    c.updated_at
  from lws.contagens c
  where c.empresa_id = core.fn_empresa_id_atual()
  order by coalesce(c.iniciada_em, c.created_at) desc;
$$;

grant execute on function lws.fn_listar_contagens() to authenticated;

create or replace function lws.fn_obter_contagem(p_contagem_id uuid)
returns table (
  id uuid,
  tipo lws.tipo_contagem,
  status lws.status_contagem,
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  criada_por uuid,
  estoque_antes int,
  estoque_contado int,
  diferenca int,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    c.id,
    c.tipo,
    c.status,
    c.iniciada_em,
    c.finalizada_em,
    c.criada_por,
    c.estoque_antes,
    c.estoque_contado,
    c.diferenca,
    c.created_at,
    c.updated_at
  from lws.contagens c
  where c.empresa_id = core.fn_empresa_id_atual()
    and c.id = p_contagem_id;
$$;

grant execute on function lws.fn_obter_contagem(uuid) to authenticated;

create or replace function lws.fn_contagem_stats(p_contagem_id uuid)
returns table (
  total_bipado int,
  ultimo_bipado_em timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    count(distinct ci.caixa_id)::int as total_bipado,
    max(ci.bipado_em) as ultimo_bipado_em
  from lws.contagem_itens ci
  join lws.contagens c on c.id = ci.contagem_id
  where c.empresa_id = core.fn_empresa_id_atual()
    and ci.contagem_id = p_contagem_id;
$$;

grant execute on function lws.fn_contagem_stats(uuid) to authenticated;

-- ============================================
-- 3) RECEBIMENTOS (listar / obter / stats / resumo modo escala)
-- ============================================
create or replace function lws.fn_listar_recebimentos()
returns table (
  id uuid,
  referencia text,
  status lws.status_recebimento,
  tipo_conferencia lws.tipo_conferencia,
  aprovado_em timestamptz,
  criado_por uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    r.id,
    r.referencia,
    r.status,
    r.tipo_conferencia,
    r.aprovado_em,
    r.criado_por,
    r.created_at,
    r.updated_at
  from lws.recebimentos r
  where r.empresa_id = core.fn_empresa_id_atual()
  order by r.created_at desc;
$$;

grant execute on function lws.fn_listar_recebimentos() to authenticated;


create or replace function lws.fn_obter_recebimento(p_recebimento_id uuid)
returns table (
  id uuid,
  referencia text,
  status lws.status_recebimento,
  tipo_conferencia lws.tipo_conferencia,
  aprovado_em timestamptz,
  criado_por uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    r.id,
    r.referencia,
    r.status,
    r.tipo_conferencia,
    r.aprovado_em,
    r.criado_por,
    r.created_at,
    r.updated_at
  from lws.recebimentos r
  where r.empresa_id = core.fn_empresa_id_atual()
    and r.id = p_recebimento_id;
$$;

grant execute on function lws.fn_obter_recebimento(uuid) to authenticated;


create or replace function lws.fn_recebimento_stats(p_recebimento_id uuid)
returns table (
  total_bipado int,
  ultimo_bipado_em timestamptz,
  total_ok int,
  total_divergente int
)
language sql
security definer
set search_path = lws, core, public
as $$
  with base as (
    select
      c.id,
      c.status_caixa,
      c.updated_at
    from lws.caixas c
    where c.empresa_id = core.fn_empresa_id_atual()
      and c.recebimento_id = p_recebimento_id
  )
  select
    count(*)::int as total_bipado,
    max(updated_at) as ultimo_bipado_em,
    sum(case when status_caixa = 'CONFERIDO_OK' then 1 else 0 end)::int as total_ok,
    sum(case when status_caixa = 'DIVERGENTE' then 1 else 0 end)::int as total_divergente
  from base;
$$;

grant execute on function lws.fn_recebimento_stats(uuid) to authenticated;

create or replace function lws.fn_resumo_recebimento(p_recebimento_id uuid)
returns table (
  produto_variante_id uuid,
  status_item lws.status_recebimento_item,
  qtd_ok int,
  qtd_divergente int
)
language sql
security definer
set search_path = lws, core, public
as $$
  with cx as (
    select
      c.produto_variante_id,
      c.status_caixa
    from lws.caixas c
    where c.empresa_id = core.fn_empresa_id_atual()
      and c.recebimento_id = p_recebimento_id
  ),
  agg as (
    select
      produto_variante_id,
      sum(case when status_caixa = 'CONFERIDO_OK' then 1 else 0 end)::int as qtd_ok,
      sum(case when status_caixa = 'DIVERGENTE' then 1 else 0 end)::int as qtd_divergente
    from cx
    group by produto_variante_id
  )
  select
    a.produto_variante_id,
    case when a.qtd_divergente > 0 then 'DIVERGENTE' else 'OK' end::lws.status_recebimento_item as status_item,
    a.qtd_ok,
    a.qtd_divergente
  from agg a
  order by (a.qtd_divergente > 0) desc, a.qtd_ok desc;
$$;

grant execute on function lws.fn_resumo_recebimento(uuid) to authenticated;

-- ============================================
-- 4) RECEBIMENTOS (resumo por variação + últimos bipados)
-- ============================================
create or replace function lws.fn_recebimento_resumo_por_variacao(p_recebimento_id uuid)
returns table (
  produto_variante_id uuid,
  modelo text,
  variacao text,
  total_ok int,
  total_divergente int,
  total int,
  status_item lws.status_recebimento_item
)
language sql
security definer
set search_path = lws, core, public
as $$
  with base as (
    select
      c.produto_variante_id,
      c.status_caixa
    from lws.caixas c
    where c.empresa_id = core.fn_empresa_id_atual()
      and c.recebimento_id = p_recebimento_id
  ),
  agg as (
    select
      produto_variante_id,
      sum(case when status_caixa = 'CONFERIDO_OK' then 1 else 0 end)::int as total_ok,
      sum(case when status_caixa = 'DIVERGENTE' then 1 else 0 end)::int as total_divergente,
      count(*)::int as total
    from base
    group by produto_variante_id
  )
  select
    a.produto_variante_id,
    p.nome_modelo as modelo,
    v.variacao,
    a.total_ok,
    a.total_divergente,
    a.total,
    case when a.total_divergente > 0 then 'DIVERGENTE' else 'OK' end::lws.status_recebimento_item as status_item
  from agg a
  join lws.produto_variantes v on v.id = a.produto_variante_id
  join lws.produtos p on p.id = v.produto_id
  where v.empresa_id = core.fn_empresa_id_atual()
  order by (a.total_divergente > 0) desc, a.total desc;
$$;

grant execute on function lws.fn_recebimento_resumo_por_variacao(uuid) to authenticated;

create or replace function lws.fn_recebimento_ultimos_bipados(
  p_recebimento_id uuid,
  p_limit int default 25
)
returns table (
  bipado_em timestamptz,
  qr_code uuid,
  modelo text,
  variacao text,
  resultado lws.status_recebimento_item
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    c.updated_at as bipado_em,
    c.qr_code,
    p.nome_modelo as modelo,
    v.variacao,
    case when c.status_caixa = 'DIVERGENTE' then 'DIVERGENTE' else 'OK' end::lws.status_recebimento_item as resultado
  from lws.caixas c
  join lws.produto_variantes v on v.id = c.produto_variante_id
  join lws.produtos p on p.id = v.produto_id
  where c.empresa_id = core.fn_empresa_id_atual()
    and c.recebimento_id = p_recebimento_id
  order by c.updated_at desc
  limit greatest(coalesce(p_limit, 25), 1);
$$;


grant execute on function lws.fn_recebimento_ultimos_bipados(uuid, int) to authenticated;

-- ============================================
-- 5) RESOLVER LABEL DO QR (modelo + variação)
-- ============================================
create or replace function lws.fn_resolver_qr_label(p_qr_code uuid)
returns table (
  qr_code uuid,
  produto_variante_id uuid,
  modelo text,
  variacao text,
  label text
)
language sql
security definer
set search_path = lws, core, public
as $$
  select
    e.qr_code,
    e.produto_variante_id,
    p.nome_modelo as modelo,
    v.variacao,
    (p.nome_modelo || ' • ' || v.variacao) as label
  from lws.qr_etiquetas e
  join lws.produto_variantes v on v.id = e.produto_variante_id
  join lws.produtos p on p.id = v.produto_id
  where e.empresa_id = core.fn_empresa_id_atual()
    and e.qr_code = p_qr_code;
$$;

grant execute on function lws.fn_resolver_qr_label(uuid) to authenticated;
