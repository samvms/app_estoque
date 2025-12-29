// src/app/(app)/contagens/[id]/resumo/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton, RetroBadge } from '@/modules/shared/ui/retro'

type Contagem = {
  id: string
  tipo: 'INICIAL' | 'PERIODICA'
  status: 'ABERTA' | 'FECHADA'
  iniciada_em: string | null
  finalizada_em: string | null
  criada_por: string | null
  estoque_antes: number | null
  estoque_contado: number | null
  diferenca: number | null
}

type ContagemStats = {
  contagem_id: string
  total_bipado: number
  ultimo_bipado_em: string | null
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ContagemResumoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const contagemId = params?.id

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [contagem, setContagem] = useState<Contagem | null>(null)
  const [stats, setStats] = useState<ContagemStats | null>(null)

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('app_estoque').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  const carregar = useCallback(async () => {
    if (!contagemId) return
    setLoading(true)
    setErro(null)

    try {
      const c = await rpc<Contagem[] | null>('fn_obter_contagem', { p_contagem_id: contagemId })
      const cont = Array.isArray(c) ? c[0] : null
      if (!cont) throw new Error('Contagem não encontrada ou sem permissão.')
      setContagem(cont)

      const st = await rpc<ContagemStats[] | null>('fn_contagem_stats', { p_contagem_id: contagemId })
      const st0 = Array.isArray(st) ? st[0] : null
      setStats(st0 ?? { contagem_id: contagemId, total_bipado: 0, ultimo_bipado_em: null })
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar resumo.')
    } finally {
      setLoading(false)
    }
  }, [contagemId, rpc])

  useEffect(() => {
    carregar()
  }, [carregar])

  const isFechada = useMemo(() => contagem?.status === 'FECHADA', [contagem?.status])

  if (loading) {
    return (
      <RetroWindow title="Resumo da contagem">
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

  if (!contagem) return null

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Resumo — Contagem"
        rightSlot={
          <div className="flex items-center gap-2">
            <RetroBadge tone={contagem.status === 'FECHADA' ? 'warn' : 'ok'}>{contagem.status}</RetroBadge>
            <RetroBadge tone="info">{contagem.tipo}</RetroBadge>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1 text-xs opacity-80">
            <div>ID: …{shortId(contagem.id)}</div>
            <div>Iniciada: {fmtDateTime(contagem.iniciada_em)}</div>
            <div>Finalizada: {fmtDateTime(contagem.finalizada_em)}</div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex lg:justify-end">
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.back()}>
              Voltar
            </RetroButton>
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push(`/contagens/${contagem.id}`)}>
              Entrar na contagem
            </RetroButton>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="Bipagens" rightSlot={<RetroBadge tone="info">distinto</RetroBadge>}>
        <div className="grid gap-1 text-sm">
          <div>
            <b>Total bipado:</b> {stats?.total_bipado ?? 0}
          </div>
          <div>
            <b>Último bipado em:</b> {fmtDateTime(stats?.ultimo_bipado_em ?? null)}
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="Estoque">
        <div className="grid gap-1 text-sm">
          <div>
            <b>Antes:</b> {isFechada ? (contagem.estoque_antes ?? 0) : '-'}
          </div>
          <div>
            <b>Contado:</b> {isFechada ? (contagem.estoque_contado ?? 0) : '-'}
          </div>
          <div>
            <b>Diferença:</b> {isFechada ? (contagem.diferenca ?? 0) : '-'}
          </div>

          {!isFechada ? (
            <div className="mt-2 text-xs opacity-80">
              Contagem ainda <b>ABERTA</b>. Esses valores aparecem após o fechamento.
            </div>
          ) : null}
        </div>
      </RetroWindow>
    </div>
  )
}
