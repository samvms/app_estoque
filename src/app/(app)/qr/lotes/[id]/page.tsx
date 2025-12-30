'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
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
  status: string // DISPONIVEL, USADO, DANIFICADO, CANCELADO
  criado_em: string
  usado_em: string | null
}

function fmt(dt: string | null) {
  if (!dt) return '-'
  const d = new Date(dt)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function normalize(s: any) {
  return String(s ?? '').trim()
}

export default function QrLotePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const loteId = params.id

  const [lote, setLote] = useState<Lote | null>(null)
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // UX: filtros + paginação
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'DISPONIVEL' | 'USADO' | 'DANIFICADO' | 'CANCELADO'>(
    'TODAS',
  )
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)

  const short = (uuid: string) => uuid.replaceAll('-', '').slice(-8).toUpperCase()

  async function carregar() {
    setErr(null)
    setLoading(true)

    const [r1, r2] = await Promise.all([
      supabase.schema('app_estoque').rpc('fn_obter_lote_qr', { p_lote_id: loteId }),
      supabase.schema('app_estoque').rpc('fn_listar_etiquetas_lote', { p_lote_id: loteId }),
    ])

    setLoading(false)
    setBootLoading(false)

    if (r1.error) {
      setErr(r1.error.message)
      return
    }

    const row = Array.isArray(r1.data) ? (r1.data[0] as Lote | undefined) : undefined
    setLote(row ?? null)

    if (r2.error) {
      setErr((prev) => (prev ? `${prev}\n${r2.error!.message}` : r2.error!.message))
      return
    }

    setEtiquetas((r2.data ?? []) as any)

    // reset UX ao recarregar
    setPage(1)
    setStatusFilter('TODAS')
    setQ('')
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
      // busca por UUID inteiro ou pelo short
      const uuid = e.qr_code.toUpperCase()
      const s = short(e.qr_code)
      return uuid.includes(term) || s.includes(term)
    })
  }, [etiquetas, statusFilter, q])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / pageSize))
  }, [filtered.length, pageSize])

  // garante page válida quando muda filtro/pageSize
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
    if (page < 1) setPage(1)
  }, [page, totalPages])

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return {
      start,
      end,
      rows: filtered.slice(start, end),
    }
  }, [filtered, page, pageSize])

  async function gerarPdfA4() {
    setErr(null)

    // PDF SEMPRE usa todas as DISPONIVEIS (não paginadas)
    const imprimiveis = etiquetas.filter((e) => e.status === 'DISPONIVEL')
    if (imprimiveis.length === 0) {
      setErr('Nenhuma etiqueta DISPONÍVEL para imprimir.')
      return
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    const cols = 3
    const rowsGrid = 8

    const pageW = 210
    const pageH = 297
    const margin = 8

    const cellW = (pageW - margin * 2) / cols
    const cellH = (pageH - margin * 2) / rowsGrid
    const qrSize = Math.min(cellW, cellH) * 0.62

    for (let i = 0; i < imprimiveis.length; i++) {
      const idxInPage = i % (cols * rowsGrid)
      if (i > 0 && idxInPage === 0) doc.addPage()

      const col = idxInPage % cols
      const row = Math.floor(idxInPage / cols)

      const x0 = margin + col * cellW
      const y0 = margin + row * cellH

      const qr = imprimiveis[i].qr_code
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, scale: 6 })

      doc.setDrawColor(220)
      doc.rect(x0, y0, cellW, cellH)

      const qrX = x0 + (cellW - qrSize) / 2
      const qrY = y0 + 3
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      doc.setFontSize(9)
      doc.text(`QR: ${short(qr)}`, x0 + 2, y0 + qrSize + 9)

      doc.setFontSize(7)
      doc.text(qr, x0 + 2, y0 + qrSize + 13)

      if (lote?.lote_texto) {
        doc.setFontSize(8)
        doc.text(`Lote: ${lote.lote_texto}`, x0 + 2, y0 + qrSize + 17)
      }
    }

    doc.save(`etiquetas-lote-${loteId}.pdf`)
  }

  return (
    <div className="space-y-4">
      <Card
        title="Lote de QR"
        subtitle="Impressão e conferência do lote"
        rightSlot={
          <div className="flex gap-2">
            <Button onClick={carregar} variant="ghost" disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button onClick={() => router.push('/qr')} variant="secondary">
              QR
            </Button>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
              Dashboard
            </Button>
          </div>
        }
      >
        {err ? <div className="text-sm font-semibold text-red-600 whitespace-pre-wrap">{err}</div> : null}

        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : !lote ? (
          <div className="opacity-70">Lote não encontrado.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Lote ID</div>
                <div className="mt-1 font-mono text-xs break-all">{lote.id}</div>
              </div>
              <Badge tone="info">{stats.disp} DISP.</Badge>
            </div>

            {lote.lote_texto ? (
              <div className="rounded-2xl border bg-white p-3">
                <div className="text-xs text-slate-500">Lote (texto)</div>
                <div className="mt-1 font-semibold">{lote.lote_texto}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Quantidade">{lote.quantidade}</StatCard>
              <StatCard title="Criado em">{fmt(lote.criado_em)}</StatCard>
              <StatCard title="Imprimíveis">{stats.disp}</StatCard>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Button onClick={gerarPdfA4} disabled={stats.disp === 0} className="w-full py-3">
                Imprimir PDF A4 (DISPONÍVEL)
              </Button>
              <Button onClick={() => router.push('/qr/gerar')} variant="secondary" className="w-full py-3">
                Gerar novo lote
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Etiquetas"
        subtitle="Filtre e pagine para ver rápido (o PDF imprime todas as DISPONÍVEIS)"
        rightSlot={<Badge tone="info">{filtered.length}/{etiquetas.length}</Badge>}
      >
        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : etiquetas.length === 0 ? (
          <div className="opacity-70">Nenhuma etiqueta encontrada.</div>
        ) : (
          <div className="space-y-3">
            {/* Controles */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <div className="text-sm font-semibold text-slate-900">Buscar</div>
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPage(1)
                    }}
                    placeholder="UUID ou código curto…"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Status</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant={statusFilter === 'TODAS' ? 'secondary' : 'ghost'}
                      onClick={() => {
                        setStatusFilter('TODAS')
                        setPage(1)
                      }}
                      className="py-3"
                    >
                      Todas
                    </Button>
                    <Button
                      variant={statusFilter === 'DISPONIVEL' ? 'secondary' : 'ghost'}
                      onClick={() => {
                        setStatusFilter('DISPONIVEL')
                        setPage(1)
                      }}
                      className="py-3"
                    >
                      Disp.
                    </Button>
                    <Button
                      variant={statusFilter === 'USADO' ? 'secondary' : 'ghost'}
                      onClick={() => {
                        setStatusFilter('USADO')
                        setPage(1)
                      }}
                      className="py-3"
                    >
                      Usado
                    </Button>
                    <Button
                      variant={statusFilter === 'DANIFICADO' ? 'secondary' : 'ghost'}
                      onClick={() => {
                        setStatusFilter('DANIFICADO')
                        setPage(1)
                      }}
                      className="py-3"
                    >
                      Danif.
                    </Button>
                    <Button
                      variant={statusFilter === 'CANCELADO' ? 'secondary' : 'ghost'}
                      onClick={() => {
                        setStatusFilter('CANCELADO')
                        setPage(1)
                      }}
                      className="py-3"
                    >
                      Canc.
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Página</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="py-3"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="py-3"
                    >
                      Próxima
                    </Button>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    Página <b>{page}</b> de <b>{totalPages}</b>
                  </div>

                  <div className="mt-2">
                    <div className="text-xs text-slate-500">Itens por página</div>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {[30, 60, 120].map((n) => (
                        <Button
                          key={n}
                          variant={pageSize === n ? 'secondary' : 'ghost'}
                          onClick={() => {
                            setPageSize(n)
                            setPage(1)
                          }}
                          className="py-2"
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Mostrando <b>{filtered.length === 0 ? 0 : pageSlice.start + 1}</b>–<b>{Math.min(pageSlice.end, filtered.length)}</b> de{' '}
                <b>{filtered.length}</b> (total do lote: <b>{etiquetas.length}</b>)
              </div>
            </div>

            {/* Lista paginada */}
            {filtered.length === 0 ? (
              <div className="opacity-70">Nenhuma etiqueta com esse filtro.</div>
            ) : (
              <div className="space-y-2">
                {pageSlice.rows.map((e) => (
                  <div key={e.id} className="rounded-2xl border bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-sm">{short(e.qr_code)}</div>
                      <Badge tone="info">{e.status}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs break-all text-slate-500">{e.qr_code}</div>
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
