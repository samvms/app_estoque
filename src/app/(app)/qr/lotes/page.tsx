'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Badge, Button, Card } from '@/modules/shared/ui/app'

type Row = {
  id: string
  quantidade: number
  lote_texto: string | null
  criado_em: string
  criado_por: string

  produto_nome_modelo: string
  nome_exibicao: string
  sku: string

  next_cursor_criado_em: string | null
  next_cursor_id: string | null
}

const LIMIT = 30
const TZ = 'America/Sao_Paulo'

function fmtBR(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function normalize(s: any) {
  return String(s ?? '').trim()
}

function isUuid(v: string) {
  const s = v.trim()
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return re.test(s)
}

export default function QrLotesPage() {
  const router = useRouter()

  // filtros
  const [q, setQ] = useState('')

  // abrir por id
  const [loteId, setLoteId] = useState('')

  const qParam = useMemo(() => {
    const t = normalize(q)
    return t ? t : null
  }, [q])

  const loteOk = useMemo(() => isUuid(loteId), [loteId])

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [cursorCriadoEm, setCursorCriadoEm] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  async function fetchPage(opts: { reset: boolean }) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_listar_lotes_qr', {
          p_limit: LIMIT,
          p_q: qParam,
          p_cursor_criado_em: opts.reset ? null : cursorCriadoEm,
          p_cursor_id: opts.reset ? null : cursorId,
        })

      if (error) throw error

      const list = (data ?? []) as Row[]
      setRows((prev) => (opts.reset ? list : prev.concat(list)))

      const last = list.length ? list[list.length - 1] : null
      const nextCriado = last?.next_cursor_criado_em ?? null
      const nextId = last?.next_cursor_id ?? null

      setCursorCriadoEm(nextCriado)
      setCursorId(nextId)

      setHasMore(Boolean(nextCriado && nextId && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar lotes.')
    } finally {
      setLoading(false)
      setBootLoading(false)
    }
  }

  function aplicar() {
    setCursorCriadoEm(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage({ reset: true })
  }

  function limpar() {
    setQ('')
    setCursorCriadoEm(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage({ reset: true })
  }

  useEffect(() => {
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <Card
        title="Lotes"
        subtitle="Mais recentes primeiro • reimpressão rápida"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push('/qr/gerar')}>
              Gerar lote
            </Button>
          </div>
        }
      >
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        {/* Abrir por ID */}
        <div className="rounded-2xl border border-app-border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Abrir lote por ID</div>
            <Badge tone="info">Atalho</Badge>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
              placeholder="Cole o UUID do lote…"
              className="md:col-span-2 w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <Button
              variant="primary"
              onClick={() => router.push(`/qr/lotes/${loteId.trim()}`)}
              disabled={!loteOk}
              className="py-3"
            >
              Abrir
            </Button>
          </div>

          {!loteId.trim() ? null : (
            <div className="mt-2 text-xs text-app-muted">
              {loteOk ? 'OK.' : 'UUID inválido.'}
            </div>
          )}
        </div>

        {/* Busca */}
        <div className="mt-3 rounded-2xl border border-app-border bg-white p-4">
          <div className="text-xs font-semibold text-app-muted">Buscar</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="SKU, modelo, variante ou texto do lote…"
            className="mt-2 w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={aplicar} disabled={loading}>
              Aplicar
            </Button>
            <Button variant="ghost" onClick={limpar} disabled={loading}>
              Limpar
            </Button>
            <Button variant="secondary" onClick={() => fetchPage({ reset: true })} disabled={loading}>
              Atualizar
            </Button>
          </div>
        </div>

        {/* Lista */}
        {bootLoading ? (
          <div className="py-8 text-sm text-app-muted">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-sm text-app-muted">Nenhum lote encontrado.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-2xl border border-app-border bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {r.produto_nome_modelo} — {r.nome_exibicao}
                    </div>
                    <Badge tone="info">{r.sku}</Badge>
                    <Badge tone="ok">{r.quantidade} un</Badge>
                    {r.lote_texto ? <Badge tone="warn">{r.lote_texto}</Badge> : null}
                  </div>

                  <div className="mt-2 text-xs text-app-muted">
                    Criado em <b>{fmtBR(r.criado_em)}</b>
                  </div>
                </div>

                <div className="flex gap-2 md:shrink-0">
                  <Button variant="secondary" onClick={() => router.push(`/qr/lotes/${r.id}`)}>
                    Abrir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-app-muted">{rows.length} lotes carregados</div>
          <Button
            variant="secondary"
            onClick={() => fetchPage({ reset: false })}
            disabled={loading || !hasMore}
          >
            {hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
