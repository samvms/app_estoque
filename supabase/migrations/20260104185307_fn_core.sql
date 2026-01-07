CREATE OR REPLACE FUNCTION "core"."fn_criar_perfil_novo_usuario"() RETURNS "trigger" 
    LANGUAGE "plpgsql" SECURITY DEFINER 
    SET "search_path" TO '' 
    AS $$ 
declare 
  v_codigo text; 
  v_empresa_id uuid; 
  v_nome text; 
  v_telefone text; 
begin 
  -- empresa no cadastro (metadata). Se não vier, cai em SMARTWAY 
  v_codigo := coalesce(new.raw_user_meta_data->>'empresa_codigo', 'Default'); 
 
  select id into v_empresa_id 
  from core.empresas 
  where codigo = v_codigo 
  limit 1; 
 
  if v_empresa_id is null then 
    raise exception 'Empresa inválida (codigo=%). Cadastre a empresa primeiro.', v_codigo; 
  end if; 
 
  -- nome/telefone também vêm do metadata (pode ser null) 
  v_nome := coalesce(new.raw_user_meta_data->>'nome', split_part(coalesce(new.email,''), 
'@', 1)); 
  v_telefone := new.raw_user_meta_data->>'telefone'; 
 
  insert into core.perfis (id, nome, telefone, empresa_id) 
  values (new.id, v_nome, v_telefone, v_empresa_id) 
  on conflict (id) do update 
    set nome = excluded.nome, 
        telefone = excluded.telefone, 
        empresa_id = excluded.empresa_id; 
 
  return new; 
end; 
$$; 
 
 
ALTER FUNCTION "core"."fn_criar_perfil_novo_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."fn_empresa_id_atual"() RETURNS "uuid" 
    LANGUAGE "sql" STABLE SECURITY DEFINER 
    SET "search_path" TO 'core', 'public' 
    AS $$ 
  select p.empresa_id 
  from core.perfis p 
  where p.id = auth.uid(); 
$$; 
 
 
ALTER FUNCTION "core"."fn_empresa_id_atual"() OWNER TO "postgres";
