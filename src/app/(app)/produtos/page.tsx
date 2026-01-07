'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/primitives'

const LIMIT = 40

type ProdutoResumo = {
  id: string
  nome_modelo: string
  ativo: boolean
  total_variantes: number
  total_ativas: number
  next_cursor_nome: string | null
  next_cursor_id: string | null
}

export default function ProdutosPage() {
  const router = useRouter()

  const [q, setQ] = useState('')
  const [items, setItems] = useState<ProdutoResumo[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [cursorNome, setCursorNome] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const total = useMemo(() => items.length, [items])

  async function carregar(reset: boolean) {
    setErro(null)
    setLoading(true)

    const cursor_nome = reset ? null : cursorNome
    const cursor_id = reset ? null : cursorId

    const { data, error } = await supabase.schema('lws').rpc('fn_listar_produtos_resumo_paginado', {
      p_limit: LIMIT,
      p_nome_prefix: q.trim() ? q.trim() : null,
      p_cursor_nome: cursor_nome,
      p_cursor_id: cursor_id,
    })

    setLoading(false)

    if (error) {
      setErro(error.message ?? 'erro_ao_listar')
      return
    }

    const rows = (Array.isArray(data) ? data : []) as ProdutoResumo[]
    if (reset) setItems(rows)
    else setItems((prev) => [...prev, ...rows])

    if (!rows.length) {
      setHasMore(false)
      return
    }

    const nextNome = rows[0]?.next_cursor_nome ?? null
    const nextId = rows[0]?.next_cursor_id ?? null

    setCursorNome(nextNome)
    setCursorId(nextId)

    // se veio menos que LIMIT, acabou
    setHasMore(rows.length >= LIMIT && !!nextNome && !!nextId)
  }

  useEffect(() => {
    carregar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <Card
        title="Produtos"
        subtitle="Cadastro por modelo (produto) e variações (SKU)"
        rightSlot={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/produtos/importar')}>
              Importar CSV
            </Button>
            <Button onClick={() => router.push('/produtos/novo')}>Cadastrar produto</Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-center">
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            placeholder="Buscar por prefixo do nome do modelo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex gap-2">
            <Button variant="secondary" disabled={loading} onClick={() => carregar(true)}>
              Buscar
            </Button>
            <Button variant="ghost" disabled={loading} onClick={() => { setQ(''); setCursorNome(null); setCursorId(null); setHasMore(true); setItems([]); setTimeout(() => carregar(true), 0) }}>
              Limpar
            </Button>
          </div>
        </div>

        {erro ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Erro</div>
            <div className="mt-0.5 text-xs text-red-700/80">{erro}</div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard title="Mostrando">{total}</StatCard>
          <StatCard title="Página">{LIMIT}</StatCard>
          <StatCard title="Filtro">{q.trim() ? 'Ativo' : '—'}</StatCard>
          <StatCard title="Status">{loading ? 'Carregando' : 'OK'}</StatCard>
        </div>
      </Card>

      <div className="space-y-2">
        {items.length === 0 ? (
          <Card title="Nenhum produto" subtitle="Cadastre manualmente ou importe um CSV.">
            <div className="flex gap-2">
              <Button onClick={() => router.push('/produtos/novo')}>Cadastrar produto</Button>
              <Button variant="secondary" onClick={() => router.push('/produtos/importar')}>
                Importar CSV
              </Button>
            </div>
          </Card>
        ) : (
          items.map((r) => (
            <Card
              key={r.id}
              title={r.nome_modelo}
              subtitle={`Variantes: ${Number(r.total_variantes)} • Ativas: ${Number(r.total_ativas)}`}
              rightSlot={<Badge tone={r.ativo ? 'ok' : 'warn'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge>}
            >
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => router.push(`/variantes?produto=${r.id}`)}>
                  Ver variantes
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-center">
        <Button
          variant="secondary"
          disabled={loading || !hasMore}
          onClick={() => carregar(false)}
          className="min-w-[220px]"
        >
          {hasMore ? (loading ? 'Carregando…' : 'Carregar mais') : 'Fim'}
        </Button>
      </div>
    </div>
  )
}
