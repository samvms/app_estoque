'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type Lote = {
  id: string
  produto_variante_id: string
  quantidade: number
  lote_texto: string | null
  criado_em: string
  criado_por: string
}

type Etiqueta = {
  id: string
  qr_code: string
  status: 'DISPONIVEL' | 'USADO' | 'DANIFICADO' | 'CANCELADO'
  criado_em: string
  usado_em: string | null
}

type VarianteInfo = {
  nome_modelo: string
  variacao: string
  sku: string
  nome_exibicao: string | null
}

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

function short(uuid: string) {
  return String(uuid ?? '').replaceAll('-', '').slice(-8).toUpperCase()
}

function statusTone(s: Etiqueta['status']) {
  if (s === 'DISPONIVEL') return 'ok'
  if (s === 'USADO') return 'info'
  return 'warn'
}

function statusLabel(s: Etiqueta['status']) {
  if (s === 'DISPONIVEL') return 'Disponível'
  if (s === 'USADO') return 'Usado'
  if (s === 'DANIFICADO') return 'Danificado'
  return 'Cancelado'
}

function labelVariante(v: VarianteInfo) {
  const desc = v.nome_exibicao?.trim() ? v.nome_exibicao.trim() : v.variacao
  return `${v.nome_modelo} — ${desc}`
}

export default function QrLotePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const loteId = params.id

  const [lote, setLote] = useState<Lote | null>(null)
  const [variante, setVariante] = useState<VarianteInfo | null>(null)
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])

  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // UX: filtros + paginação local
  const [statusFilter, setStatusFilter] = useState<
    'TODAS' | 'DISPONIVEL' | 'USADO' | 'DANIFICADO' | 'CANCELADO'
  >('TODAS')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)

  async function carregar() {
    setErr(null)
    setLoading(true)

    try {
      const [r1, r2] = await Promise.all([
        supabase.schema('lws').rpc('fn_obter_lote_qr', { p_lote_id: loteId }),
        supabase.schema('lws').rpc('fn_listar_etiquetas_lote', { p_lote_id: loteId }),
      ])

      if (r1.error) throw r1.error
      if (r2.error) throw r2.error

      const row = Array.isArray(r1.data) ? (r1.data[0] as Lote | undefined) : undefined
      const loteRow = row ?? null
      setLote(loteRow)

      setEtiquetas((r2.data ?? []) as any)

      // ✅ aqui é o conserto: usar a RPC correta (fn_obter_variante_info)
      if (loteRow?.produto_variante_id) {
        const rv = await supabase.schema('lws').rpc('fn_obter_variante_info', {
          p_produto_variante_id: loteRow.produto_variante_id,
        })

        if (!rv.error) {
          const vrow = Array.isArray(rv.data) ? (rv.data[0] as VarianteInfo | undefined) : undefined
          setVariante(vrow ?? null)
        } else {
          setVariante(null)
        }
      } else {
        setVariante(null)
      }

      // reset UX ao recarregar
      setPage(1)
      setStatusFilter('TODAS')
      setQ('')
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar lote.')
    } finally {
      setLoading(false)
      setBootLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteId])

  const stats = useMemo(() => {
    const total = etiquetas.length
    const disp = etiquetas.filter((e) => e.status === 'DISPONIVEL').length
    const usado = etiquetas.filter((e) => e.status === 'USADO').length
    const dan = etiquetas.filter((e) => e.status === 'DANIFICADO').length
    const canc = etiquetas.filter((e) => e.status === 'CANCELADO').length
    return { total, disp, usado, dan, canc }
  }, [etiquetas])

  const filtered = useMemo(() => {
    const term = normalize(q).toUpperCase()
    return etiquetas.filter((e) => {
      if (statusFilter !== 'TODAS' && e.status !== statusFilter) return false
      if (!term) return true
      const uuid = e.qr_code.toUpperCase()
      const s = short(e.qr_code)
      return uuid.includes(term) || s.includes(term)
    })
  }, [etiquetas, statusFilter, q])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize)),
    [filtered.length, pageSize]
  )

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
    if (page < 1) setPage(1)
  }, [page, totalPages])

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return { start, end, rows: filtered.slice(start, end) }
  }, [filtered, page, pageSize])

  async function gerarPdfA4() {
    setErr(null)

    const imprimiveis = etiquetas.filter((e) => e.status === 'DISPONIVEL')
    if (imprimiveis.length === 0) {
      setErr('Nenhuma etiqueta disponível para imprimir.')
      return
    }

    setPdfLoading(true)

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      const cols = 3
      const rowsGrid = 8
      const pageW = 210
      const pageH = 297
      const margin = 8

      const cellW = (pageW - margin * 2) / cols
      const cellH = (pageH - margin * 2) / rowsGrid
      const qrSize = Math.min(cellW, cellH) * 0.62

      const lt = lote?.lote_texto ? String(lote.lote_texto).trim() : ''
      const varLine = variante ? `${labelVariante(variante)} (${variante.sku})` : ''

      for (let i = 0; i < imprimiveis.length; i++) {
        const idxInPage = i % (cols * rowsGrid)
        if (i > 0 && idxInPage === 0) doc.addPage()

        const col = idxInPage % cols
        const row = Math.floor(idxInPage / cols)

        const x0 = margin + col * cellW
        const y0 = margin + row * cellH

        const qr = imprimiveis[i].qr_code
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, scale: 6 })

        doc.setDrawColor(225)
        doc.rect(x0, y0, cellW, cellH)

        const qrX = x0 + (cellW - qrSize) / 2
        const qrY = y0 + 3
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

        doc.setFontSize(9)
        doc.text(`QR: ${short(qr)}`, x0 + 2, y0 + qrSize + 9)

        doc.setFontSize(7)
        doc.text(qr, x0 + 2, y0 + qrSize + 13)

        if (lt) {
          doc.setFontSize(8)
          doc.text(`Lote: ${lt}`, x0 + 2, y0 + qrSize + 17)
        }
        if (varLine) {
          doc.setFontSize(7)
          doc.text(varLine, x0 + 2, y0 + qrSize + 21)
        }
      }

      doc.save(`etiquetas-lote-${loteId}.pdf`)
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao gerar PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title={variante ? labelVariante(variante) : 'Lote'}
        subtitle={variante ? `SKU ${variante.sku} • Reimpressão e conferência` : 'Reimpressão e conferência'}
        rightSlot={
          <Button onClick={carregar} variant="ghost" disabled={loading || pdfLoading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </Button>
        }
      >
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        {bootLoading ? (
          <div className="py-8 text-sm text-app-muted">Carregando…</div>
        ) : !lote ? (
          <div className="py-8 text-sm text-app-muted">Lote não encontrado.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-app-border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-app-muted">Lote ID</div>
                  <div className="mt-1 font-mono text-xs break-all text-slate-800">{lote.id}</div>

                  {lote.lote_texto ? <div className="mt-2 text-sm font-semibold text-slate-900">{lote.lote_texto}</div> : null}

                  {variante ? (
                    <div className="mt-2 text-xs text-app-muted">
                      <b>{variante.nome_modelo}</b> • {variante.nome_exibicao?.trim() ? variante.nome_exibicao : variante.variacao} • SKU{' '}
                      <b>{variante.sku}</b>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ok">Disp. {stats.disp}</Badge>
                  <Badge tone="info">Usado {stats.usado}</Badge>
                  <Badge tone="warn">Danif. {stats.dan}</Badge>
                  <Badge tone="warn">Canc. {stats.canc}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Quantidade">{stats.total}</StatCard>
              <StatCard title="Imprimíveis">{stats.disp}</StatCard>
              <StatCard title="Criado em">{fmtBR(lote.criado_em)}</StatCard>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Button onClick={gerarPdfA4} disabled={stats.disp === 0 || pdfLoading || loading} className="w-full py-3">
                {pdfLoading ? 'Gerando PDF…' : 'Imprimir PDF A4 (Disponíveis)'}
              </Button>

              <Button onClick={() => router.push('/qr/gerar')} variant="secondary" className="w-full py-3">
                Gerar novo lote
              </Button>
            </div>

            <div className="text-xs text-app-muted">
              O PDF imprime todas as etiquetas <b>Disponíveis</b>, independentemente dos filtros/página abaixo.
            </div>
          </div>
        )}
      </Card>

      <Card title="Etiquetas do lote" subtitle="Filtro e navegação rápida" rightSlot={<Badge tone="info">{filtered.length}/{etiquetas.length}</Badge>}>
        {bootLoading ? (
          <div className="py-8 text-sm text-app-muted">Carregando…</div>
        ) : etiquetas.length === 0 ? (
          <div className="py-8 text-sm text-app-muted">Nenhuma etiqueta encontrada.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-app-border bg-white p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold text-app-muted">Buscar</div>
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPage(1)
                    }}
                    placeholder="UUID ou código curto…"
                    className="mt-2 w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-app-muted">Status</div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as any)
                      setPage(1)
                    }}
                    className="mt-2 w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="TODAS">Todas</option>
                    <option value="DISPONIVEL">Disponível</option>
                    <option value="USADO">Usado</option>
                    <option value="DANIFICADO">Danificado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-app-muted">Itens/página</div>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="mt-2 w-full rounded-2xl border border-app-border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {[30, 60, 120].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="w-full">
                      Anterior
                    </Button>
                    <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-full">
                      Próxima
                    </Button>
                  </div>

                  <div className="mt-2 text-xs text-app-muted">
                    Página <b>{page}</b> de <b>{totalPages}</b>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-app-muted">
                Mostrando <b>{filtered.length === 0 ? 0 : pageSlice.start + 1}</b>–<b>{Math.min(pageSlice.end, filtered.length)}</b> de{' '}
                <b>{filtered.length}</b> (total do lote: <b>{etiquetas.length}</b>)
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-6 text-sm text-app-muted">Nenhuma etiqueta com esse filtro.</div>
            ) : (
              <div className="space-y-2">
                {pageSlice.rows.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-app-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-mono text-sm font-semibold text-slate-900">{short(e.qr_code)}</div>
                          <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge>
                        </div>
                        <div className="mt-1 font-mono text-xs break-all text-app-muted">{e.qr_code}</div>

                        <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-app-muted md:grid-cols-2 md:gap-3">
                          <div>
                            <span className="font-semibold">Criado:</span> {fmtBR(e.criado_em)}
                          </div>
                          <div>
                            <span className="font-semibold">Usado:</span> {fmtBR(e.usado_em)}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(e.qr_code)}>
                          Copiar QR
                        </Button>
                        <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(short(e.qr_code))}>
                          Copiar short
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
