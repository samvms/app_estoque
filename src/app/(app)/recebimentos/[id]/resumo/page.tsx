// src/app/(app)/recebimentos/[id]/resumo/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

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

function toneReceb(status: Recebimento['status']): 'info' | 'ok' | 'warn' {
  if (status === 'ABERTO') return 'info'
  if (status === 'APROVADO') return 'ok'
  return 'warn'
}

function toneItem(status: ResumoItem['status_item']): 'info' | 'ok' | 'warn' {
  if (status === 'DIVERGENTE') return 'warn'
  if (status === 'OK') return 'ok'
  return 'info'
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
    const { data, error } = await supabase.schema('lws').rpc(fn, args ?? {})
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

      // DIVERGENTE primeiro, depois OK, depois ABERTO
      const peso = (s: ResumoItem['status_item']) => (s === 'DIVERGENTE' ? 0 : s === 'OK' ? 1 : 2)
      lista.sort((a, b) => {
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
      <Card title="Resumo do recebimento" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar o resumo">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
          <div className="grid grid-cols-1 gap-2">
            <Button className="w-full py-3" variant="ghost" onClick={() => router.back()}>
              Voltar
            </Button>
            <Button className="w-full py-3" onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!recebimento) return null

  return (
    <div className="space-y-4">
      <Card
        title="Resumo — Recebimento"
        subtitle={`ID: …${shortId(recebimento.id)}${recebimento.referencia ? ` • Ref: ${recebimento.referencia}` : ''}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge tone={toneReceb(recebimento.status)}>{recebimento.status}</Badge>
            <Badge tone="info">{recebimento.tipo_conferencia}</Badge>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="text-xs text-app-muted">
            Criado: <span className="font-semibold text-app-fg">{fmtDateTime(recebimento.criado_em)}</span> • Finalizado:{' '}
            <span className="font-semibold text-app-fg">{fmtDateTime(recebimento.aprovado_em)}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button className="w-full py-3" variant="ghost" onClick={() => router.back()}>
              Voltar
            </Button>
            <Button className="w-full py-3" variant="secondary" onClick={() => router.push(`/recebimentos/${recebimento.id}`)}>
              Entrar no recebimento
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Bipagens" subtitle="Estatísticas do recebimento">
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
      </Card>

      <Card
        title="Resumo"
        subtitle={isFechado ? 'Recebimento finalizado' : 'Recebimento em andamento'}
        rightSlot={
          totals.temDivergencia ? (
            <Badge tone="warn">DIVERGÊNCIA</Badge>
          ) : (
            <Badge tone="ok">OK</Badge>
          )
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
            <div className="mt-2 text-xs text-app-muted">
              Recebimento ainda <b className="text-app-fg">ABERTO</b>. Se existir divergência, a recomendação operacional é{' '}
              <b className="text-app-fg">REPROVAR</b>.
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Itens por variante" subtitle="Ordenado: divergente → ok → aberto">
        {itens.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhum item ainda.</div>
        ) : (
          <div className="grid gap-2">
            {itens.map((x) => (
              <div key={x.produto_variante_id} className="app-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-app-muted">Variante</div>
                    <div className="text-sm font-semibold text-app-fg">…{shortId(x.produto_variante_id)}</div>
                  </div>

                  <Badge tone={toneItem(x.status_item)}>{x.status_item}</Badge>
                </div>

                <div className="mt-2 text-sm text-app-muted">
                  OK: <b className="text-app-fg">{Number(x.qtd_ok) || 0}</b> • Divergente:{' '}
                  <b className="text-app-fg">{Number(x.qtd_divergente) || 0}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!isFechado && totals.temDivergencia ? (
        <Card title="Atenção" subtitle="Ação recomendada" rightSlot={<Badge tone="warn">ação</Badge>}>
          <div className="text-sm text-app-fg">
            Existe divergência no resumo. Pelo modo escala, o item permanece <b>DIVERGENTE</b>.
          </div>
        </Card>
      ) : null}
    </div>
  )
}
