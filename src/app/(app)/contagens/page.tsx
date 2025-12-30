// src/app/(app)/contagens/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

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

function toneForStatus(status: Contagem['status']): 'info' | 'ok' | 'warn' {
  return status === 'ABERTA' ? 'info' : 'ok'
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
      <Card title="Contagens" subtitle="Carregando dados…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar contagens">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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

  return (
    <div className="space-y-4">
      <Card
        title="Contagens"
        subtitle={`Abertas: ${abertas.length} • Fechadas: ${fechadas.length}`}
        rightSlot={
          <Button onClick={carregar} disabled={loading} variant="ghost">
            {loading ? 'Atualizando…' : 'Atualizar'}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-center">
          <Button className="w-full py-3" variant="ghost" onClick={() => router.back()}>
            Voltar
          </Button>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:justify-end lg:flex lg:justify-end">
            <Button className="w-full py-3 lg:w-auto" onClick={() => router.push('/contagens/abrir')}>
              Abrir nova contagem
            </Button>

            {contagemAberta ? (
              <Button
                className="w-full py-3 lg:w-auto"
                variant="secondary"
                onClick={() => router.push(`/contagens/${contagemAberta.id}`)}
                title="Atalho para a contagem ABERTA"
              >
                Entrar na ABERTA
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card title="Abertas" rightSlot={<Badge tone="info">{abertas.length} item(ns)</Badge>}>
        {abertas.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhuma contagem aberta.</div>
        ) : (
          <div className="grid gap-3">
            {abertas.map((c) => (
              <div key={c.id} className="app-card">
                <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-app-fg">{c.tipo}</div>
                      <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-app-muted">ID: …{shortId(c.id)}</div>
                  </div>

                  <div className="text-xs text-app-muted">
                    Iniciada: <span className="font-semibold text-app-fg">{fmtDateTime(c.iniciada_em)}</span>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex">
                    <Button className="w-full py-3 lg:w-auto" onClick={() => router.push(`/contagens/${c.id}`)}>
                      Entrar
                    </Button>
                    <Button
                      className="w-full py-3 lg:w-auto"
                      variant="ghost"
                      onClick={() => router.push(`/contagens/${c.id}/resumo`)}
                    >
                      Ver resumo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Fechadas" rightSlot={<Badge tone="info">{fechadas.length} item(ns)</Badge>}>
        {fechadas.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhuma contagem fechada.</div>
        ) : (
          <div className="grid gap-3">
            {fechadas.map((c) => (
              <div key={c.id} className="app-card">
                <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-app-fg">{c.tipo}</div>
                      <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-app-muted">ID: …{shortId(c.id)}</div>
                  </div>

                  <div className="text-xs text-app-muted">
                    Finalizada:{' '}
                    <span className="font-semibold text-app-fg">{fmtDateTime(c.finalizada_em)}</span>
                  </div>
                </div>

                <div className="px-4 py-4 space-y-2">
                  <div className="text-xs text-app-muted">
                    Iniciada: <span className="font-semibold text-app-fg">{fmtDateTime(c.iniciada_em)}</span> •{' '}
                    Finalizada: <span className="font-semibold text-app-fg">{fmtDateTime(c.finalizada_em)}</span>
                  </div>

                  <div className="text-xs text-app-muted">
                    Antes: <b className="text-app-fg">{c.estoque_antes ?? 0}</b> • Contado:{' '}
                    <b className="text-app-fg">{c.estoque_contado ?? 0}</b> • Dif:{' '}
                    <b className="text-app-fg">{c.diferenca ?? 0}</b>
                  </div>

                  <div>
                    <Button className="w-full py-3 md:w-auto" variant="ghost" onClick={() => router.push(`/contagens/${c.id}/resumo`)}>
                      Ver resumo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
