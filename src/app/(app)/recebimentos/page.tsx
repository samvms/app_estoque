// src/app/(app)/recebimentos/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

function toneStatus(status: Recebimento['status']): 'info' | 'ok' | 'warn' {
  if (status === 'ABERTO') return 'info'
  if (status === 'APROVADO') return 'ok'
  return 'warn'
}

function RecebimentoCard(props: {
  r: Recebimento
  onEnter: () => void
  onResumo: () => void
  fmt: (iso: string | null) => string
}) {
  const { r, onEnter, onResumo, fmt } = props

  const titleExtra = r.referencia ? ` • ${r.referencia}` : ''

  return (
    <div className="app-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-app-fg">
            {r.tipo_conferencia} • ID: …{shortId(r.id)}
            {titleExtra ? <span className="text-app-muted"> {titleExtra}</span> : null}
          </div>

          {r.status === 'ABERTO' ? (
            <div className="mt-1 text-xs text-app-muted">
              Criado: {fmt(r.criado_em)} • Criado por: {r.criado_por ? `…${shortId(r.criado_por)}` : '-'}
            </div>
          ) : (
            <div className="mt-1 text-xs text-app-muted">
              Finalizado: {fmt(r.aprovado_em)} • Status: {r.status}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={toneStatus(r.status)}>{r.status}</Badge>
            <Badge tone="info">{r.tipo_conferencia}</Badge>
          </div>

          <div className="flex gap-2">
            {r.status === 'ABERTO' ? (
              <Button className="py-2" variant="secondary" onClick={onEnter}>
                Entrar
              </Button>
            ) : null}
            <Button className="py-2" variant="ghost" onClick={onResumo}>
              Ver resumo
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecebimentosPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rows, setRows] = useState<Recebimento[]>([])

  const dtf = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }, [])

  const fmt = useCallback(
    (iso: string | null) => {
      if (!iso) return '-'
      const d = new Date(iso)
      return dtf.format(d)
    },
    [dtf],
  )

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('lws').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await rpc<Recebimento[] | null>('fn_listar_recebimentos')
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar recebimentos.')
    } finally {
      setLoading(false)
    }
  }, [rpc])

  useEffect(() => {
    // prefetch rotas comuns (igual contagens)
    router.prefetch('/recebimentos/abrir')
    carregar()
  }, [carregar, router])

  const abertos = useMemo(() => rows.filter((r) => r.status === 'ABERTO'), [rows])
  const finalizados = useMemo(() => rows.filter((r) => r.status !== 'ABERTO'), [rows])

  if (loading) {
    return (
      <Card title="Recebimentos" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar os recebimentos">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Button className="w-full py-3" onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card
        title="Recebimentos"
        subtitle={`${abertos.length} aberto(s) • ${finalizados.length} finalizado(s) • Total: ${rows.length}`}
        rightSlot={
          <div className="hidden md:flex items-center gap-2">
            <Button variant="secondary" onClick={carregar}>
              Atualizar
            </Button>
            <Button onClick={() => router.push('/recebimentos/abrir')}>Criar recebimento</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:hidden">
          <Button className="w-full py-3" variant="secondary" onClick={carregar}>
            Atualizar
          </Button>
          <Button className="w-full py-3" onClick={() => router.push('/recebimentos/abrir')}>
            Criar recebimento
          </Button>
        </div>
      </Card>

      <Card title="Abertos" subtitle="Operação">
        {abertos.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhum recebimento aberto.</div>
        ) : (
          <div className="space-y-2">
            {abertos.map((r) => (
              <RecebimentoCard
                key={r.id}
                r={r}
                fmt={fmt}
                onEnter={() => router.push(`/recebimentos/${r.id}`)}
                onResumo={() => router.push(`/recebimentos/${r.id}/resumo`)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Finalizados" subtitle="Leitura">
        {finalizados.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhum recebimento finalizado.</div>
        ) : (
          <div className="space-y-2">
            {finalizados.map((r) => (
              <RecebimentoCard
                key={r.id}
                r={r}
                fmt={fmt}
                onEnter={() => router.push(`/recebimentos/${r.id}`)}
                onResumo={() => router.push(`/recebimentos/${r.id}/resumo`)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
