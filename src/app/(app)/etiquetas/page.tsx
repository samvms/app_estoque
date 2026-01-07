'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Badge, Button, Card } from '@/modules/shared/ui/app'

type Status = 'DISPONIVEL' | 'USADO' | 'DANIFICADO' | 'CANCELADO'

type Row = {
  id: string
  sku: string
  qr_code: string
  qr_short: string
  status: Status
  criado_em: string
  usado_em: string | null
  lote_id: string | null
  next_cursor_criado_em: string | null
  next_cursor_id: string | null
}

const LIMIT = 50
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

function toUuidOrNull(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return re.test(s) ? s : null
}

function mapStatusTone(s: Status) {
  if (s === 'DISPONIVEL') return 'ok'
  if (s === 'USADO') return 'info'
  return 'warn'
}

function mapStatusLabel(s: Status) {
  if (s === 'DISPONIVEL') return 'Disponível'
  if (s === 'USADO') return 'Usado'
  if (s === 'DANIFICADO') return 'Danificado'
  return 'Cancelado'
}

function mapErro(msg: string) {
  if (msg.includes('invalid input syntax for type uuid')) return 'QR inválido (UUID).'
  return msg
}

export default function EtiquetasPage() {
  const router = useRouter()

  const [status, setStatus] = useState<Status | 'TODOS'>('TODOS')
  const [skuPrefix, setSkuPrefix] = useState('')
  const [qr, setQr] = useState('')

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [cursorCriadoEm, setCursorCriadoEm] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const statusParam = status === 'TODOS' ? null : status
  const qrParam = useMemo(() => toUuidOrNull(qr), [qr])

  async function fetchPage(opts: { reset: boolean }) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const cursor_criado_em = opts.reset ? null : cursorCriadoEm
      const cursor_id = opts.reset ? null : cursorId

      const { data, error } = await supabase
        .schema('lws')
        .rpc('fn_listar_etiquetas', {
          p_limit: LIMIT,
          p_status: statusParam,
          p_sku_prefix: skuPrefix.trim() ? skuPrefix.trim() : null,
          p_qr_code: qrParam,
          p_lote_id: null,
          p_cursor_created_at: cursor_criado_em,
          p_cursor_id: cursor_id,
        })

      if (error) throw error

      const list = (data ?? []) as Row[]

      if (opts.reset) setRows(list)
      else setRows((prev) => prev.concat(list))

      const last = list.length ? list[list.length - 1] : null
      const nextCriado = last?.next_cursor_criado_em ?? null
      const nextId = last?.next_cursor_id ?? null

      setCursorCriadoEm(nextCriado)
      setCursorId(nextId)
      setHasMore(Boolean(nextCriado && nextId && list.length === LIMIT))
    } catch (e: any) {
      setErr(mapErro(e?.message ?? 'Erro ao carregar etiquetas.'))
    } finally {
      setLoading(false)
      setBootLoading(false)
    }
  }

  function aplicarFiltros() {
    setCursorCriadoEm(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage({ reset: true })
  }

  function limpar() {
    setStatus('TODOS')
    setSkuPrefix('')
    setQr('')
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
        title="Etiquetas"
        subtitle="Pesquisa e histórico de QRs • paginação real"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push('/qr/gerar')}>
              Gerar lote
            </Button>
            <Badge tone="info">QR</Badge>
          </div>
        }
      >
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {/* Filtros — Apple-like: campos limpos + ações claras */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-1 text-xs font-semibold text-app-muted">Status</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="TODOS">Todos</option>
              <option value="DISPONIVEL">Disponível</option>
              <option value="USADO">Usado</option>
              <option value="DANIFICADO">Danificado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <div className="mb-1 text-xs font-semibold text-app-muted">SKU (prefixo)</div>
            <input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="Ex.: 1801"
              className="w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold text-app-muted">QR (UUID completo)</div>
            <input
              value={qr}
              onChange={(e) => setQr(e.target.value)}
              placeholder="Filtro exato (UUID)"
              className="w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <div className="mt-1 text-xs text-app-muted">
              {qr.trim() && !qrParam ? 'UUID inválido — o filtro de QR será ignorado.' : ' '}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={aplicarFiltros} disabled={loading}>
            Aplicar
          </Button>
          <Button variant="ghost" onClick={limpar} disabled={loading}>
            Limpar
          </Button>
          <Button variant="secondary" onClick={() => fetchPage({ reset: true })} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </Card>

      <Card
        title="Resultados"
        subtitle="Mais recentes primeiro"
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        {bootLoading ? (
          <div className="py-8 text-sm text-app-muted">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-sm text-app-muted">Nenhuma etiqueta encontrada.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-2xl border border-app-border bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{r.sku}</div>
                    <Badge tone={mapStatusTone(r.status) as any}>{mapStatusLabel(r.status)}</Badge>
                    {r.lote_id ? (
                      <button
                        className="text-xs font-semibold text-app-muted underline-offset-4 hover:underline"
                        onClick={() => router.push(`/qr/lotes/${r.lote_id}`)}
                        type="button"
                      >
                        Ver lote
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{r.qr_short}</span>
                    <span className="truncate text-app-muted">{r.qr_code}</span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-app-muted md:grid-cols-2 md:gap-3">
                    <div>
                      <span className="font-semibold">Criado:</span> {fmtBR(r.criado_em)}
                    </div>
                    <div>
                      <span className="font-semibold">Usado:</span> {fmtBR(r.usado_em)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 md:shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(r.qr_code)
                    }}
                  >
                    Copiar QR
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(r.qr_short)
                    }}
                  >
                    Copiar short
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-app-muted">{rows.length} itens</div>

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
