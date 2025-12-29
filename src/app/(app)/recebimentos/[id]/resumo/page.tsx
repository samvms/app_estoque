// src/app/(app)/recebimentos/[id]/resumo/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton, RetroBadge } from '@/modules/shared/ui/retro'

type Recebimento = {
  id: string
  referencia: string | null
  status: 'ABERTO' | 'APROVADO' | 'REPROVADO'
  tipo_conferencia: 'AMOSTRA' | 'TOTAL'
  criado_em: string | null
  aprovado_em: string | null
  criado_por: string | null
}

type ResumoItem = {
  produto_variante_id: string
  status_item: 'ABERTO' | 'OK' | 'DIVERGENTE'
  qtd_ok: number
  qtd_divergente: number
}

type RecebimentoStats = {
  recebimento_id: string
  total_bipado: number
  ultimo_bipado_em: string | null
  total_ok: number
  total_divergente: number
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function RecebimentoResumoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const recebimentoId = params?.id

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [recebimento, setRecebimento] = useState<Recebimento | null>(null)
  const [stats, setStats] = useState<RecebimentoStats | null>(null)
  const [itens, setItens] = useState<ResumoItem[]>([])

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('app_estoque').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  const carregar = useCallback(async () => {
    if (!recebimentoId) return
    setLoading(true)
    setErro(null)

    try {
      const r = await rpc<Recebimento[] | null>('fn_obter_recebimento', { p_recebimento_id: recebimentoId })
      const rec = Array.isArray(r) ? r[0] : null
      if (!rec) throw new Error('Recebimento não encontrado ou sem permissão.')
      setRecebimento(rec)

      const st = await rpc<RecebimentoStats[] | null>('fn_recebimento_stats', { p_recebimento_id: recebimentoId })
      setStats(Array.isArray(st) ? st[0] ?? null : null)

      const res = await rpc<ResumoItem[] | null>('fn_resumo_recebimento', { p_recebimento_id: recebimentoId })
      const lista = Array.isArray(res) ? res : []

      lista.sort((a, b) => {
        const peso = (s: ResumoItem['status_item']) => (s === 'DIVERGENTE' ? 0 : s === 'OK' ? 1 : 2)
        const pa = peso(a.status_item)
        const pb = peso(b.status_item)
        if (pa !== pb) return pa - pb
        return a.produto_variante_id.localeCompare(b.produto_variante_id)
      })

      setItens(lista)
    } catch (e: any) {
      const msg = e?.message ?? 'Erro ao carregar resumo.'
      if (String(msg).toLowerCase().includes('recebimento_invalido')) {
        setErro('Recebimento inválido (não pertence à empresa).')
      } else {
        setErro(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [recebimentoId, rpc])

  useEffect(() => {
    carregar()
  }, [carregar])

  const isFechado = useMemo(() => recebimento?.status !== 'ABERTO', [recebimento?.status])

  const totals = useMemo(() => {
    const ok = itens.reduce((acc, x) => acc + (Number(x.qtd_ok) || 0), 0)
    const div = itens.reduce((acc, x) => acc + (Number(x.qtd_divergente) || 0), 0)
    const variantes = itens.length
    const variantesDiv = itens.filter((x) => x.status_item === 'DIVERGENTE' || (Number(x.qtd_divergente) || 0) > 0).length
    const temDivergencia = variantesDiv > 0 || div > 0
    return { ok, div, variantes, variantesDiv, temDivergencia }
  }, [itens])

  if (loading) {
    return (
      <RetroWindow title="Resumo do recebimento">
        <div className="text-sm opacity-80">Carregando…</div>
      </RetroWindow>
    )
  }

  if (erro) {
    return (
      <RetroWindow title="Erro">
        <div className="space-y-3">
          <div className="text-sm font-bold text-red-700">{erro}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <RetroButton className="w-full py-3" onClick={() => router.back()}>
              Voltar
            </RetroButton>
            <RetroButton className="w-full py-3" onClick={carregar}>
              Tentar novamente
            </RetroButton>
          </div>
        </div>
      </RetroWindow>
    )
  }

  if (!recebimento) return null

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Resumo — Recebimento"
        rightSlot={
          <div className="flex items-center gap-2">
            <RetroBadge tone={recebimento.status === 'ABERTO' ? 'ok' : 'warn'}>{recebimento.status}</RetroBadge>
            <RetroBadge tone="info">{recebimento.tipo_conferencia}</RetroBadge>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1 text-xs opacity-80">
            <div>
              ID: …{shortId(recebimento.id)}
              {recebimento.referencia ? ` • Ref: ${recebimento.referencia}` : ''}
            </div>
            <div>Criado: {fmtDateTime(recebimento.criado_em)}</div>
            <div>Finalizado: {fmtDateTime(recebimento.aprovado_em)}</div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex lg:justify-end">
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.back()}>
              Voltar
            </RetroButton>
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push(`/recebimentos/${recebimento.id}`)}>
              Entrar no recebimento
            </RetroButton>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="Bipagens">
        <div className="grid gap-1 text-sm">
          <div>
            <b>Total bipado:</b> {stats?.total_bipado ?? 0}
          </div>
          <div>
            <b>Último bipado em:</b> {fmtDateTime(stats?.ultimo_bipado_em ?? null)}
          </div>
          <div>
            <b>Total OK:</b> {stats?.total_ok ?? 0}
          </div>
          <div>
            <b>Total divergente:</b> {stats?.total_divergente ?? 0}
          </div>
        </div>
      </RetroWindow>

      <RetroWindow
        title="Resumo (modo escala)"
        rightSlot={
          totals.temDivergencia ? <RetroBadge tone="warn">DIVERGÊNCIA</RetroBadge> : <RetroBadge tone="ok">OK</RetroBadge>
        }
      >
        <div className="grid gap-1 text-sm">
          <div>
            <b>Variantes:</b> {totals.variantes}
          </div>
          <div>
            <b>Variantes com divergência:</b> {totals.variantesDiv}
          </div>
          <div>
            <b>Total OK (caixas):</b> {totals.ok}
          </div>
          <div>
            <b>Total divergente (caixas):</b> {totals.div}
          </div>

          {!isFechado ? (
            <div className="mt-2 text-xs opacity-80">
              Recebimento ainda <b>ABERTO</b>. Se existir divergência, a recomendação operacional é <b>REPROVAR</b>.
            </div>
          ) : null}
        </div>
      </RetroWindow>

      <RetroWindow title="Itens por variante">
        {itens.length === 0 ? (
          <div className="text-sm opacity-80">Nenhum item ainda.</div>
        ) : (
          <div className="grid gap-2">
            {itens.map((x) => {
              const danger = x.status_item === 'DIVERGENTE' || (Number(x.qtd_divergente) || 0) > 0
              return (
                <div
                  key={x.produto_variante_id}
                  className={`border-2 border-black bg-white p-3 ${danger ? 'bg-red-50' : ''}`}
                >
                  <div className="text-xs font-black">Variante: …{shortId(x.produto_variante_id)}</div>
                  <div className="mt-1 text-sm">
                    Status: <b>{x.status_item}</b> • OK: <b>{Number(x.qtd_ok) || 0}</b> • Divergente:{' '}
                    <b>{Number(x.qtd_divergente) || 0}</b>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </RetroWindow>

      {!isFechado && totals.temDivergencia ? (
        <RetroWindow title="Atenção" rightSlot={<RetroBadge tone="warn">ação</RetroBadge>}>
          <div className="text-sm">
            Existe divergência no resumo. Pelo modo escala, o item permanece <b>DIVERGENTE</b>.
          </div>
        </RetroWindow>
      ) : null}
    </div>
  )
}
