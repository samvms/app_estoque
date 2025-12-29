// src/app/(app)/contagens/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton, RetroBadge } from '@/modules/shared/ui/retro'

type Contagem = {
  id: string
  tipo: 'INICIAL' | 'PERIODICA'
  status: 'ABERTA' | 'FECHADA'
  iniciada_em: string | null
  finalizada_em: string | null
  estoque_antes: number | null
  estoque_contado: number | null
  diferenca: number | null
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ContagensPage() {
  const router = useRouter()

  const [contagens, setContagens] = useState<Contagem[]>([])
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
      const data = await rpc<Contagem[] | null>('fn_listar_contagens')
      setContagens(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar contagens.')
      setContagens([])
    } finally {
      setLoading(false)
    }
  }, [rpc])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abertas = useMemo(() => contagens.filter((c) => c.status === 'ABERTA'), [contagens])
  const fechadas = useMemo(() => contagens.filter((c) => c.status === 'FECHADA'), [contagens])
  const contagemAberta = useMemo(() => abertas[0] ?? null, [abertas])

  if (loading) {
    return (
      <RetroWindow title="Contagens">
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
        title="Contagens"
        rightSlot={
          <RetroButton onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </RetroButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1">
            <div className="text-xs opacity-80">
              Abertas: <b>{abertas.length}</b> • Fechadas: <b>{fechadas.length}</b>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:justify-end lg:flex lg:justify-end">
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.back()}>
              Voltar
            </RetroButton>

            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push('/contagens/abrir')}>
              Abrir nova contagem
            </RetroButton>

            {contagemAberta ? (
              <RetroButton
                className="w-full py-3 lg:w-auto"
                onClick={() => router.push(`/contagens/${contagemAberta.id}`)}
                title="Atalho para a contagem ABERTA"
              >
                Entrar na ABERTA
              </RetroButton>
            ) : null}
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="Abertas" rightSlot={<RetroBadge tone="info">{abertas.length} item(ns)</RetroBadge>}>
        {abertas.length === 0 ? (
          <div className="text-sm opacity-80">Nenhuma contagem aberta.</div>
        ) : (
          <div className="grid gap-3">
            {abertas.map((c) => (
              <div key={c.id} className="retro-panel">
                <div className="retro-panel__title">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-black">
                      {c.tipo}{' '}
                      <span className="font-normal opacity-80">({c.status})</span>
                    </div>
                    <div className="text-xs opacity-80">ID: …{shortId(c.id)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs opacity-80">Iniciada: {fmtDateTime(c.iniciada_em)}</div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex">
                  <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push(`/contagens/${c.id}`)}>
                    Entrar
                  </RetroButton>
                  <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.push(`/contagens/${c.id}/resumo`)}>
                    Ver resumo
                  </RetroButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </RetroWindow>

      <RetroWindow title="Fechadas" rightSlot={<RetroBadge tone="info">{fechadas.length} item(ns)</RetroBadge>}>
        {fechadas.length === 0 ? (
          <div className="text-sm opacity-80">Nenhuma contagem fechada.</div>
        ) : (
          <div className="grid gap-3">
            {fechadas.map((c) => (
              <div key={c.id} className="retro-panel">
                <div className="retro-panel__title">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-black">
                      {c.tipo}{' '}
                      <span className="font-normal opacity-80">({c.status})</span>
                    </div>
                    <div className="text-xs opacity-80">ID: …{shortId(c.id)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs opacity-80">
                  Iniciada: {fmtDateTime(c.iniciada_em)} • Finalizada: {fmtDateTime(c.finalizada_em)}
                </div>

                <div className="mt-1 text-xs opacity-80">
                  Antes: <b>{c.estoque_antes ?? 0}</b> • Contado: <b>{c.estoque_contado ?? 0}</b> • Dif:{' '}
                  <b>{c.diferenca ?? 0}</b>
                </div>

                <div className="mt-3">
                  <RetroButton className="w-full py-3 md:w-auto" onClick={() => router.push(`/contagens/${c.id}/resumo`)}>
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
