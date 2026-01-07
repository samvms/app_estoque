// src/app/(app)/contagens/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

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

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function toneStatus(status: Contagem['status']): 'info' | 'ok' | 'warn' {
  return status === 'ABERTA' ? 'info' : 'ok'
}

function ContagemCard(props: {
  c: Contagem
  onEnter: () => void
  onResumo: () => void
  fmt: (iso: string | null) => string
}) {
  const { c, onEnter, onResumo, fmt } = props

  return (
    <div className="app-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-app-fg">
            {c.tipo} • ID: …{shortId(c.id)}
          </div>

          {c.status === 'ABERTA' ? (
            <div className="mt-1 text-xs text-app-muted">
              Iniciada: {fmt(c.iniciada_em)} • Criada por: {c.criada_por ? `…${shortId(c.criada_por)}` : '-'}
            </div>
          ) : (
            <div className="mt-1 text-xs text-app-muted">
              Finalizada: {fmt(c.finalizada_em)} • Diferença: {c.diferenca ?? 0}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={toneStatus(c.status)}>{c.status}</Badge>
            <Badge tone="info">{c.tipo}</Badge>
          </div>

          <div className="flex gap-2">
            {c.status === 'ABERTA' ? (
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

export default function ContagensPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rows, setRows] = useState<Contagem[]>([])

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
      const data = await rpc<Contagem[] | null>('fn_listar_contagens')
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar contagens.')
    } finally {
      setLoading(false)
    }
  }, [rpc])

  useEffect(() => {
    // prefetch rotas comuns
    router.prefetch('/contagens/abrir')
    carregar()
  }, [carregar, router])

  const abertas = useMemo(() => rows.filter((r) => r.status === 'ABERTA'), [rows])
  const fechadas = useMemo(() => rows.filter((r) => r.status === 'FECHADA'), [rows])

  if (loading) {
    return (
      <Card title="Contagens" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar as contagens">
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
        title="Contagens"
        subtitle={`${abertas.length} aberta(s) • ${fechadas.length} fechada(s) • Total: ${rows.length}`}
        rightSlot={
          <div className="hidden md:flex items-center gap-2">
            <Button variant="secondary" onClick={carregar}>
              Atualizar
            </Button>
            <Button onClick={() => router.push('/contagens/abrir')}>Abrir contagem</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:hidden">
          <Button className="w-full py-3" variant="secondary" onClick={carregar}>
            Atualizar
          </Button>
          <Button className="w-full py-3" onClick={() => router.push('/contagens/abrir')}>
            Abrir contagem
          </Button>
        </div>
      </Card>

      <Card title="Abertas" subtitle="Operação">
        {abertas.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhuma contagem aberta.</div>
        ) : (
          <div className="space-y-2">
            {abertas.map((c) => (
              <ContagemCard
                key={c.id}
                c={c}
                fmt={fmt}
                onEnter={() => router.push(`/contagens/${c.id}`)}
                onResumo={() => router.push(`/contagens/${c.id}/resumo`)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Fechadas" subtitle="Leitura">
        {fechadas.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhuma contagem fechada.</div>
        ) : (
          <div className="space-y-2">
            {fechadas.map((c) => (
              <ContagemCard
                key={c.id}
                c={c}
                fmt={fmt}
                onEnter={() => router.push(`/contagens/${c.id}`)}
                onResumo={() => router.push(`/contagens/${c.id}/resumo`)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
