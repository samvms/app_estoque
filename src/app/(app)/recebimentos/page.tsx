// src/app/(app)/recebimentos/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function toneStatus(status: Recebimento['status']): 'info' | 'ok' | 'warn' {
  if (status === 'ABERTO') return 'info'
  if (status === 'APROVADO') return 'ok'
  return 'warn'
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
      <Card title="Recebimentos" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar recebimentos">
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

  return (
    <div className="space-y-4">
      <Card
        title="Recebimentos"
        subtitle={`Abertos: ${abertos.length} • Finalizados: ${finalizados.length}`}
        rightSlot={
          <Button onClick={carregar} disabled={loading} variant="ghost">
            {loading ? 'Atualizando…' : 'Atualizar'}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-2">
          <Button className="w-full py-3" variant="ghost" onClick={() => router.back()}>
            Voltar
          </Button>

          <Button className="w-full py-3" onClick={() => router.push('/recebimentos/abrir')}>
            Criar recebimento
          </Button>

          {recebimentoAberto ? (
            <Button
              className="w-full py-3"
              variant="secondary"
              onClick={() => router.push(`/recebimentos/${recebimentoAberto.id}`)}
              title="Atalho para o recebimento ABERTO"
            >
              Entrar no ABERTO
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Abertos" rightSlot={<Badge tone="info">{abertos.length} item(ns)</Badge>}>
        {abertos.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhum recebimento aberto.</div>
        ) : (
          <div className="grid gap-3">
            {abertos.map((r) => (
              <div key={r.id} className="app-card">
                <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-app-fg">{r.tipo_conferencia}</div>
                      <Badge tone={toneStatus(r.status)}>{r.status}</Badge>
                      {r.referencia ? (
                        <span className="text-xs text-app-muted">• {r.referencia}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-app-muted">ID: …{shortId(r.id)}</div>
                  </div>

                  <div className="text-xs text-app-muted">
                    Criado:{' '}
                    <span className="font-semibold text-app-fg">{fmtDateTime(r.criado_em)}</span>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <div className="grid grid-cols-1 gap-2">
                    <Button className="w-full py-3" onClick={() => router.push(`/recebimentos/${r.id}`)}>
                      Entrar
                    </Button>
                    <Button className="w-full py-3" variant="ghost" onClick={() => router.push(`/recebimentos/${r.id}/resumo`)}>
                      Ver resumo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Finalizados" rightSlot={<Badge tone="info">{finalizados.length} item(ns)</Badge>}>
        {finalizados.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhum recebimento finalizado.</div>
        ) : (
          <div className="grid gap-3">
            {finalizados.map((r) => (
              <div key={r.id} className="app-card">
                <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-app-fg">{r.tipo_conferencia}</div>
                      <Badge tone={toneStatus(r.status)}>{r.status}</Badge>
                      {r.referencia ? (
                        <span className="text-xs text-app-muted">• {r.referencia}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-app-muted">ID: …{shortId(r.id)}</div>
                  </div>

                  <div className="text-xs text-app-muted">
                    Finalizado:{' '}
                    <span className="font-semibold text-app-fg">{fmtDateTime(r.aprovado_em)}</span>
                  </div>
                </div>

                <div className="px-4 py-4 space-y-1">
                  <div className="text-xs text-app-muted">
                    Criado: <span className="font-semibold text-app-fg">{fmtDateTime(r.criado_em)}</span>
                  </div>

                  <Button
                    className="w-full py-3"
                    variant="ghost"
                    onClick={() => router.push(`/recebimentos/${r.id}/resumo`)}
                  >
                    Ver resumo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
