'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type ContagemStats = {
  contagem_id: string
  total_bipado: number
  ultimo_bipado_em: string | null
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function toneStatus(status: Contagem['status']): 'info' | 'ok' | 'warn' {
  return status === 'ABERTA' ? 'info' : 'ok'
}

export default function ContagemResumoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const contagemId = params?.id

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [contagem, setContagem] = useState<Contagem | null>(null)
  const [stats, setStats] = useState<ContagemStats | null>(null)

  const dtf = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }, [])

  const fmt = useCallback(
    (iso: string | null) => {
      if (!iso) return '-'
      return dtf.format(new Date(iso))
    },
    [dtf],
  )

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('lws').rpc(fn, args ?? {})
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

  const isFechada = contagem?.status === 'FECHADA'

  if (loading) {
    return (
      <Card title="Resumo da contagem" subtitle="Carregando…">
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

  if (!contagem) return null

  return (
    <div className="space-y-4">
      <Card
        title="Resumo — Contagem"
        subtitle={`ID: …${shortId(contagem.id)} • Iniciada: ${fmt(contagem.iniciada_em)}${
          contagem.finalizada_em ? ` • Finalizada: ${fmt(contagem.finalizada_em)}` : ''
        }`}
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge tone={toneStatus(contagem.status)}>{contagem.status}</Badge>
            <Badge tone="info">{contagem.tipo}</Badge>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Button className="w-full py-3" variant="ghost" onClick={() => router.back()}>
            Voltar
          </Button>
          <Button className="w-full py-3" variant="secondary" onClick={() => router.push(`/contagens/${contagem.id}`)}>
            Entrar na contagem
          </Button>
        </div>
      </Card>

      <Card title="Bipagens" subtitle="Contagem distinta (idempotente)">
        <div className="grid gap-1 text-sm">
          <div>
            <b>Total bipado:</b> {stats?.total_bipado ?? 0}
          </div>
          <div>
            <b>Último bipado em:</b> {fmt(stats?.ultimo_bipado_em ?? null)}
          </div>
        </div>
      </Card>

      <Card title="Estoque" subtitle={isFechada ? 'Valores finais' : 'Aguardando fechamento'}>
        <div className="grid gap-1 text-sm">
          <div>
            <b>Antes:</b> {isFechada ? contagem.estoque_antes ?? 0 : '-'}
          </div>
          <div>
            <b>Contado:</b> {isFechada ? contagem.estoque_contado ?? 0 : '-'}
          </div>
          <div>
            <b>Diferença:</b> {isFechada ? contagem.diferenca ?? 0 : '-'}
          </div>

          {!isFechada ? (
            <div className="mt-2 text-xs text-app-muted">
              Contagem ainda <b className="text-app-fg">ABERTA</b>. Esses valores aparecem após o fechamento.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
