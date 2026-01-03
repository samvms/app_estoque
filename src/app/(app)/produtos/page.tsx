'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'
import { useRouter } from 'next/navigation'

const LIMIT = 50

type Row = {
  id: string
  nome_modelo: string
  ativo: boolean
  total_variantes: number
  total_ativas: number
  next_cursor_nome: string | null
  next_cursor_id: string | null
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={[
        'w-full rounded-2xl border border-app-border bg-white px-3 py-2 text-sm outline-none',
        'focus:ring-2 focus:ring-[rgba(15,76,92,.18)]',
        className ?? '',
      ].join(' ')}
    />
  )
}

export default function ProdutosPage() {
  const router = useRouter()
  const [prefix, setPrefix] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [cursorNome, setCursorNome] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const totalItens = rows.length
  const totalVariantes = useMemo(() => rows.reduce((acc, r) => acc + (r.total_variantes ?? 0), 0), [rows])
  const totalAtivas = useMemo(() => rows.reduce((acc, r) => acc + (r.total_ativas ?? 0), 0), [rows])

  async function fetchPage(reset: boolean) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase.schema('app_estoque').rpc('fn_listar_produtos_resumo_paginado', {
        p_limit: LIMIT,
        p_nome_prefix: prefix.trim() || null,
        p_cursor_nome: reset ? null : cursorNome,
        p_cursor_id: reset ? null : cursorId,
      })

      if (error) throw error
      const list = (data ?? []) as Row[]

      setRows(reset ? list : rows.concat(list))

      const last = list.length ? list[list.length - 1] : null
      setCursorNome(last?.next_cursor_nome ?? null)
      setCursorId(last?.next_cursor_id ?? null)
      setHasMore(Boolean(last?.next_cursor_nome && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function limpar() {
    setPrefix('')
    setCursorNome(null)
    setCursorId(null)
    fetchPage(true)
  }

  return (
    <div className="space-y-4">
      {/* CARD “APPLE-LIKE” DE AÇÕES + FILTRO */}
      <Card
        title="Produtos"
        subtitle="Resumo dos produtos pai"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push('/produtos/importar')}>
              Importar CSV
            </Button>
            <Badge tone="info">Cadastro</Badge>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,auto] md:items-end">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-app-muted">Filtro</div>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Buscar por nome (prefixo)…"
              inputMode="search"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={() => fetchPage(true)} disabled={loading}>
              Buscar
            </Button>
            <Button variant="ghost" onClick={limpar} disabled={loading && !prefix}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <StatCard title="Produtos (na lista)">{totalItens}</StatCard>
          <StatCard title="Variantes (total)">{totalVariantes}</StatCard>
          <StatCard title="Ativas (total)">{totalAtivas}</StatCard>
        </div>

        {err ? (
          <div className="mt-3 text-sm font-semibold" style={{ color: 'var(--app-danger)' }}>
            {err}
          </div>
        ) : null}
      </Card>

      {/* LISTAGEM */}
      <Card title="Listagem" subtitle="Produto • Variantes • Ativas • Status">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-2 pr-4">Produto</th>
                <th className="py-2 pr-4">Variantes</th>
                <th className="py-2 pr-4">Ativas</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-app-muted">
                    {loading ? 'Carregando…' : 'Sem dados.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-app-border">
                    <td className="py-3 pr-4 font-semibold text-app-fg">{r.nome_modelo}</td>
                    <td className="py-3 pr-4 text-app-fg">{r.total_variantes}</td>
                    <td className="py-3 pr-4 text-app-fg">{r.total_ativas}</td>
                    <td className="py-3">
                      <Badge tone={r.ativo ? 'ok' : 'warn'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-app-muted">{rows.length} itens</div>
          <Button variant="secondary" onClick={() => fetchPage(false)} disabled={loading || !hasMore}>
            {loading ? 'Carregando…' : hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
