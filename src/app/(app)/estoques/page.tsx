'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

const LIMIT = 50

type Row = {
  produto_nome: string
  sku: string
  variacao: string | null
  estoque_fisico: number
  estoque_erp: number | null
  saldo: number | null
  next_cursor_sku: string | null
  next_cursor_variante_id: string | null
}

export default function EstoquesPage() {
  const [skuPrefix, setSkuPrefix] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [cursorSku, setCursorSku] = useState<string | null>(null)
  const [cursorVarId, setCursorVarId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  async function fetchPage(reset: boolean) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_listar_estoques_paginado', {
          p_limit: LIMIT,
          p_sku_prefix: skuPrefix.trim() || null,
          p_cursor_sku: reset ? null : cursorSku,
          p_cursor_variante_id: reset ? null : cursorVarId,
        })

      if (error) throw error
      const list = (data ?? []) as Row[]

      setRows((prev) => (reset ? list : prev.concat(list)))

      const last = list.length ? list[list.length - 1] : null
      setCursorSku(last?.next_cursor_sku ?? null)
      setCursorVarId(last?.next_cursor_variante_id ?? null)

      setHasMore(Boolean(last?.next_cursor_sku && last?.next_cursor_variante_id && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  function aplicar() {
    setCursorSku(null)
    setCursorVarId(null)
    setHasMore(true)
    fetchPage(true)
  }

  function limpar() {
    setSkuPrefix('')
    setCursorSku(null)
    setCursorVarId(null)
    setHasMore(true)
    fetchPage(true)
  }

  useEffect(() => { fetchPage(true) }, [])

  return (
    <div className="space-y-4">
      <Card
        title="Estoques"
        subtitle="Físico (contagens/recebimentos) • ERP e saldo entram na aba Integrações"
        rightSlot={<Badge tone="info">Estoque físico</Badge>}
      >
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <input
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value)}
            placeholder="SKU (prefixo)"
            className="app-card px-3 py-2 text-sm outline-none md:w-[320px]"
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={aplicar} disabled={loading}>Aplicar</Button>
            <Button variant="ghost" onClick={limpar} disabled={loading}>Limpar</Button>
          </div>
        </div>
        {err ? <div className="mt-3 text-sm" style={{ color: 'var(--app-danger)' }}>{err}</div> : null}
      </Card>

      <Card
        title="Tabela"
        subtitle={`${rows.length} itens`}
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-2 pr-4">Produto</th>
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Variação</th>
                <th className="py-2 pr-4">Físico</th>
                <th className="py-2 pr-4">ERP</th>
                <th className="py-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-app-muted">Sem resultados.</td></tr>
              ) : rows.map((r) => (
                <tr key={`${r.sku}-${r.next_cursor_variante_id ?? ''}`} className="border-t border-app-border">
                  <td className="py-3 pr-4">{r.produto_nome}</td>
                  <td className="py-3 pr-4 font-semibold">{r.sku}</td>
                  <td className="py-3 pr-4">{r.variacao ?? '-'}</td>
                  <td className="py-3 pr-4">{r.estoque_fisico}</td>
                  <td className="py-3 pr-4">{r.estoque_erp ?? '-'}</td>
                  <td className="py-3">{r.saldo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => fetchPage(false)} disabled={loading || !hasMore}>
            {hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
