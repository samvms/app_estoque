-- ============================================
-- MIGRATION 003 - LWS (RPCs operacionais)
-- Tudo via RPC (SECURITY DEFINER)
-- ============================================

-- ============================================
-- 1) CRIAR LOTE DE QR
-- ============================================
create or replace function lws.fn_criar_lote_qr(
  p_produto_variante_id uuid,
  p_quantidade int,
  p_lote_texto text default null
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_lote_id uuid;
begin
  v_empresa_id := core.fn_empresa_id_atual();
  if v_empresa_id is null then
    raise exception 'empresa_nao_resolvida';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida';
  end if;

  insert into lws.qr_lotes (
    empresa_id, produto_variante_id, quantidade, lote_texto, criado_por
  )
  values (
    v_empresa_id, p_produto_variante_id, p_quantidade, p_lote_texto, auth.uid()
  )
  returning id into v_lote_id;

  insert into lws.qr_etiquetas (
    empresa_id, lote_id, produto_variante_id, qr_code
  )
  select
    v_empresa_id,
    v_lote_id,
    p_produto_variante_id,
    gen_random_uuid()
  from generate_series(1, p_quantidade);

  return v_lote_id;
end;
$$;

grant execute on function lws.fn_criar_lote_qr(uuid, int, text) to authenticated;

-- ============================================
-- 2) ATUALIZAR STATUS DA ETIQUETA
-- ============================================
create or replace function lws.fn_atualizar_status_etiqueta(
  p_qr_code uuid,
  p_novo_status lws.status_qr_etiqueta
)
returns void
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  update lws.qr_etiquetas
     set status = p_novo_status,
         usado_em = case when p_novo_status = 'USADO' then now() else usado_em end
   where empresa_id = v_empresa_id
     and qr_code = p_qr_code;

  if not found then
    raise exception 'qr_nao_encontrado';
  end if;
end;
$$;

grant execute on function lws.fn_atualizar_status_etiqueta(uuid, lws.status_qr_etiqueta) to authenticated;

-- ============================================
-- 3) BIPAR QR (cria caixa idempotente)
-- ============================================
create or replace function lws.fn_bipar_qr(
  p_qr_code uuid,
  p_local_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_caixa_id uuid;
  v_etiqueta record;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  select *
    into v_etiqueta
    from lws.qr_etiquetas
   where empresa_id = v_empresa_id
     and qr_code = p_qr_code;

  if not found then
    raise exception 'qr_nao_encontrado';
  end if;

  insert into lws.caixas (
    empresa_id, qr_etiqueta_id, qr_code, produto_variante_id, local_id
  )
  values (
    v_empresa_id, v_etiqueta.id, p_qr_code, v_etiqueta.produto_variante_id, p_local_id
  )
  on conflict (empresa_id, qr_code) do update
    set local_id = coalesce(excluded.local_id, lws.caixas.local_id)
  returning id into v_caixa_id;

  update lws.qr_etiquetas
     set status = 'USADO',
         usado_em = coalesce(usado_em, now())
   where id = v_etiqueta.id;

  return v_caixa_id;
end;
$$;

grant execute on function lws.fn_bipar_qr(uuid, uuid) to authenticated;

-- ============================================
-- 4) CONTAGENS (abrir / bipar / fechar)
-- ============================================
create or replace function lws.fn_abrir_contagem(
  p_tipo lws.tipo_contagem
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_contagem_id uuid;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  if exists (
    select 1 from lws.contagens
     where empresa_id = v_empresa_id
       and status = 'ABERTA'
  ) then
    raise exception 'contagem_ja_aberta';
  end if;

  insert into lws.contagens (
    empresa_id, tipo, criada_por
  )
  values (
    v_empresa_id, p_tipo, auth.uid()
  )
  returning id into v_contagem_id;

  return v_contagem_id;
end;
$$;

grant execute on function lws.fn_abrir_contagem(lws.tipo_contagem) to authenticated;

create or replace function lws.fn_bipar_na_contagem(
  p_contagem_id uuid,
  p_qr_code uuid,
  p_local_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_caixa_id uuid;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  if p_local_id is null then
    raise exception 'local_obrigatorio';
  end if;

  select id into v_caixa_id
    from lws.caixas
   where empresa_id = v_empresa_id
     and qr_code = p_qr_code;

  if v_caixa_id is null then
    v_caixa_id := lws.fn_bipar_qr(p_qr_code, p_local_id);
  end if;

  insert into lws.contagem_itens (
    empresa_id, contagem_id, caixa_id, local_id
  )
  values (
    v_empresa_id, p_contagem_id, v_caixa_id, p_local_id
  )
  on conflict (contagem_id, caixa_id) do nothing;

  return v_caixa_id;
end;
$$;

grant execute on function lws.fn_bipar_na_contagem(uuid, uuid, uuid) to authenticated;

create or replace function lws.fn_fechar_contagem(
  p_contagem_id uuid
)
returns void
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_antes int;
  v_contado int;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  select count(*) into v_antes
    from lws.caixas
   where empresa_id = v_empresa_id
     and status_caixa = 'CONFERIDO_OK';

  select count(distinct caixa_id) into v_contado
    from lws.contagem_itens
   where contagem_id = p_contagem_id;

  update lws.caixas c
     set status_caixa = 'SAIDA'
   where c.empresa_id = v_empresa_id
     and c.id not in (
       select caixa_id from lws.contagem_itens where contagem_id = p_contagem_id
     );

  update lws.caixas c
     set status_caixa = 'CONFERIDO_OK',
         contagem_ultima_id = p_contagem_id
   where c.id in (
     select caixa_id from lws.contagem_itens where contagem_id = p_contagem_id
   );

  update lws.contagens
     set status = 'FECHADA',
         finalizada_em = now(),
         estoque_antes = v_antes,
         estoque_contado = v_contado,
         diferenca = v_contado - v_antes
   where id = p_contagem_id;
end;
$$;

grant execute on function lws.fn_fechar_contagem(uuid) to authenticated;

-- ============================================
-- 5) RECEBIMENTOS (criar / bipar / finalizar)
-- ============================================
create or replace function lws.fn_criar_recebimento(
  p_referencia text,
  p_tipo lws.tipo_conferencia
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_id uuid;
begin
  v_empresa_id := core.fn_empresa_id_atual();

  insert into lws.recebimentos (
    empresa_id, referencia, tipo_conferencia, criado_por
  )
  values (
    v_empresa_id, p_referencia, p_tipo, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function lws.fn_criar_recebimento(text, lws.tipo_conferencia) to authenticated;

create or replace function lws.fn_registrar_conferencia_recebimento(
  p_recebimento_id uuid,
  p_qr_code uuid,
  p_local_id uuid,
  p_resultado lws.status_recebimento_item
)
returns uuid
language plpgsql
security definer
set search_path = lws, core, public
as $$
declare
  v_empresa_id uuid;
  v_caixa_id uuid;
  v_variante_id uuid;
begin
  if p_local_id is null then
    raise exception 'local_obrigatorio';
  end if;

  v_empresa_id := core.fn_empresa_id_atual();

  v_caixa_id := lws.fn_bipar_qr(p_qr_code, p_local_id);

  select produto_variante_id into v_variante_id
    from lws.caixas
   where id = v_caixa_id;

  insert into lws.recebimento_itens (
    empresa_id, recebimento_id, produto_variante_id, status
  )
  values (
    v_empresa_id, p_recebimento_id, v_variante_id, p_resultado
  )
  on conflict (recebimento_id, produto_variante_id)
  do update set status = case
    when lws.recebimento_itens.status = 'DIVERGENTE'
      or excluded.status = 'DIVERGENTE'
    then 'DIVERGENTE'
    else 'OK'
  end;

  update lws.caixas
     set recebimento_id = p_recebimento_id,
         status_caixa = case
           when p_resultado = 'OK' then 'CONFERIDO_OK'
           else 'DIVERGENTE'
         end
   where id = v_caixa_id;

  return v_caixa_id;
end;
$$;

grant execute on function lws.fn_registrar_conferencia_recebimento(uuid, uuid, uuid, lws.status_recebimento_item) to authenticated;

create or replace function lws.fn_finalizar_recebimento(
  p_recebimento_id uuid,
  p_status lws.status_recebimento
)
returns void
language plpgsql
security definer
set search_path = lws, core, public
as $$
begin
  if p_status = 'ABERTO' then
    raise exception 'status_invalido';
  end if;

  update lws.recebimentos
     set status = p_status,
         aprovado_em = case when p_status = 'APROVADO' then now() else null end
   where id = p_recebimento_id;
end;
$$;

grant execute on function lws.fn_finalizar_recebimento(uuid, lws.status_recebimento) to authenticated;
