'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

const LIMIT = 50

type Row = {
  id: string
  produto_id: string
  produto_nome: string
  sku: string
  cor: string | null
  nome_exibicao: string | null
  ativo: boolean
  next_cursor_sku: string | null
  next_cursor_id: string | null
}

export default function VariantesPage() {
  const [skuPrefix, setSkuPrefix] = useState('')
  const [ativo, setAtivo] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS')

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [cursorSku, setCursorSku] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const ativoParam =
    ativo === 'TODOS' ? null : ativo === 'ATIVO' ? true : false

  async function fetchPage(reset: boolean) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_listar_variantes_paginado', {
          p_limit: LIMIT,
          p_sku_prefix: skuPrefix.trim() || null,
          p_ativo: ativoParam,
          p_produto_id: null,
          p_cursor_sku: reset ? null : cursorSku,
          p_cursor_id: reset ? null : cursorId,
        })

      if (error) throw error
      const list = (data ?? []) as Row[]

      setRows((prev) => (reset ? list : prev.concat(list)))

      const last = list.length ? list[list.length - 1] : null
      setCursorSku(last?.next_cursor_sku ?? null)
      setCursorId(last?.next_cursor_id ?? null)

      setHasMore(Boolean(last?.next_cursor_sku && last?.next_cursor_id && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  function aplicar() {
    setCursorSku(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage(true)
  }

  function limpar() {
    setSkuPrefix('')
    setAtivo('TODOS')
    setCursorSku(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage(true)
  }

  useEffect(() => {
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <Card
        title="Variantes"
        subtitle="SKU • Produto • Status"
        rightSlot={<Badge tone="info">Cadastro</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value)}
            placeholder="SKU (prefixo)"
            className="app-card px-3 py-2 text-sm outline-none"
          />

          <select
            value={ativo}
            onChange={(e) => setAtivo(e.target.value as any)}
            className="app-card px-3 py-2 text-sm outline-none"
          >
            <option value="TODOS">Status: todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>

          <div className="flex gap-2">
            <Button variant="primary" onClick={aplicar} disabled={loading}>
              Aplicar
            </Button>
            <Button variant="ghost" onClick={limpar} disabled={loading}>
              Limpar
            </Button>
          </div>
        </div>

        {err ? <div className="mt-3 text-sm" style={{ color: 'var(--app-danger)' }}>{err}</div> : null}
      </Card>

      <Card
        title="Listagem"
        subtitle={`${rows.length} itens`}
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Produto</th>
                <th className="py-2 pr-4">Variação</th>
                <th className="py-2 pr-4">Descrição</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-app-muted">
                    Sem resultados.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-app-border">
                    <td className="py-3 pr-4 font-semibold">{r.sku}</td>
                    <td className="py-3 pr-4">{r.produto_nome}</td>
                    <td className="py-3 pr-4">{r.cor ?? '-'}</td>
                    <td className="py-3 pr-4">{r.nome_exibicao ?? '-'}</td>
                    <td className="py-3">{r.ativo ? 'Ativo' : 'Inativo'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => fetchPage(false)}
            disabled={loading || !hasMore}
          >
            {hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
