// src/app/(app)/recebimentos/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function RecebimentosPage() {
  const router = useRouter()

  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('app_estoque').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)

    try {
      const data = await rpc<Recebimento[] | null>('fn_listar_recebimentos')
      setRecebimentos(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar recebimentos.')
      setRecebimentos([])
    } finally {
      setLoading(false)
    }
  }, [rpc])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abertos = useMemo(() => recebimentos.filter((r) => r.status === 'ABERTO'), [recebimentos])
  const finalizados = useMemo(() => recebimentos.filter((r) => r.status !== 'ABERTO'), [recebimentos])

  const recebimentoAberto = useMemo(() => abertos[0] ?? null, [abertos])

  if (loading) {
    return (
      <RetroWindow title="Recebimentos">
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

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Recebimentos"
        rightSlot={
          <RetroButton onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </RetroButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1">
            <div className="text-xs opacity-80">
              Abertos: <b>{abertos.length}</b> • Finalizados: <b>{finalizados.length}</b>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:justify-end lg:flex lg:justify-end">
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.back()}>
              Voltar
            </RetroButton>

            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push('/recebimentos/abrir')}>
              Criar recebimento
            </RetroButton>

            {recebimentoAberto ? (
              <RetroButton
                className="w-full py-3 lg:w-auto"
                onClick={() => router.push(`/recebimentos/${recebimentoAberto.id}`)}
                title="Atalho para o recebimento ABERTO"
              >
                Entrar no ABERTO
              </RetroButton>
            ) : null}
          </div>
        </div>
      </RetroWindow>

      <RetroWindow
        title="Abertos"
        rightSlot={<RetroBadge tone="info">{abertos.length} item(ns)</RetroBadge>}
      >
        {abertos.length === 0 ? (
          <div className="text-sm opacity-80">Nenhum recebimento aberto.</div>
        ) : (
          <div className="grid gap-3">
            {abertos.map((r) => (
              <div key={r.id} className="retro-panel">
                <div className="retro-panel__title">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-black">
                      {r.tipo_conferencia}{' '}
                      <span className="font-normal opacity-80">({r.status})</span>
                      {r.referencia ? <span className="font-normal opacity-80"> • {r.referencia}</span> : null}
                    </div>
                    <div className="text-xs opacity-80">ID: …{shortId(r.id)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs opacity-80">Criado em: {fmtDateTime(r.criado_em)}</div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex">
                  <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push(`/recebimentos/${r.id}`)}>
                    Entrar
                  </RetroButton>

                  <RetroButton
                    className="w-full py-3 lg:w-auto"
                    onClick={() => router.push(`/recebimentos/${r.id}/resumo`)}
                  >
                    Ver resumo
                  </RetroButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </RetroWindow>

      <RetroWindow
        title="Finalizados"
        rightSlot={<RetroBadge tone="info">{finalizados.length} item(ns)</RetroBadge>}
      >
        {finalizados.length === 0 ? (
          <div className="text-sm opacity-80">Nenhum recebimento finalizado.</div>
        ) : (
          <div className="grid gap-3">
            {finalizados.map((r) => (
              <div key={r.id} className="retro-panel">
                <div className="retro-panel__title">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-black">
                      {r.tipo_conferencia}{' '}
                      <span className="font-normal opacity-80">({r.status})</span>
                      {r.referencia ? <span className="font-normal opacity-80"> • {r.referencia}</span> : null}
                    </div>
                    <div className="text-xs opacity-80">ID: …{shortId(r.id)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs opacity-80">
                  Criado: {fmtDateTime(r.criado_em)} • Finalizado: {fmtDateTime(r.aprovado_em)}
                </div>

                <div className="mt-3">
                  <RetroButton
                    className="w-full py-3 md:w-auto"
                    onClick={() => router.push(`/recebimentos/${r.id}/resumo`)}
                  >
                    Ver resumo
                  </RetroButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </RetroWindow>
    </div>
  )
}
