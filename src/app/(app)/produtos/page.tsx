'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type ProdutoRow = {
  id: string
  nome_modelo: string
  ativo: boolean
  total_variantes: number
  total_ativas: number
}

type VarianteRow = {
  id: string
  produto_id: string
  sku: string
  cor: string
  nome_exibicao: string
  ativo: boolean
}

type VariantesState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: VarianteRow[]
  err?: string
}

function normalize(s: any) {
  return String(s ?? '').trim()
}

export default function ProdutosPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<ProdutoRow[]>([])

  const [q, setQ] = useState('')
  const [onlyAtivos, setOnlyAtivos] = useState(false)

  // controle de expansão + cache de variantes por produto
  const [openId, setOpenId] = useState<string | null>(null)
  const [variantesByProduto, setVariantesByProduto] = useState<Record<string, VariantesState>>({})

  async function carregar() {
    setErr(null)
    setLoading(true)

    const { data, error } = await supabase.schema('app_estoque').rpc('fn_listar_produtos_resumo')

    setLoading(false)
    setBootLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    setRows((data ?? []) as any)
  }

  async function carregarVariantes(produtoId: string) {
    // cache: se já carregou, não chama de novo
    const current = variantesByProduto[produtoId]
    if (current?.status === 'ready' || current?.status === 'loading') return

    setVariantesByProduto((prev) => ({
      ...prev,
      [produtoId]: { status: 'loading', data: [] },
    }))

    const { data, error } = await supabase
      .schema('app_estoque')
      .rpc('fn_listar_variantes_por_produto', { p_produto_id: produtoId })

    if (error) {
      setVariantesByProduto((prev) => ({
        ...prev,
        [produtoId]: { status: 'error', data: [], err: error.message },
      }))
      return
    }

    setVariantesByProduto((prev) => ({
      ...prev,
      [produtoId]: { status: 'ready', data: (data ?? []) as any },
    }))
  }

  function toggleOpen(produtoId: string) {
    const next = openId === produtoId ? null : produtoId
    setOpenId(next)
    if (next) carregarVariantes(next)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const term = normalize(q).toLowerCase()
    let base = rows
    if (onlyAtivos) base = base.filter((r) => r.ativo)
    if (!term) return base
    return base.filter((r) => r.nome_modelo.toLowerCase().includes(term) || r.id.toLowerCase().includes(term))
  }, [rows, q, onlyAtivos])

  const totals = useMemo(() => {
    const produtos = rows.length
    const variantes = rows.reduce((acc, r) => acc + (r.total_variantes ?? 0), 0)
    const ativas = rows.reduce((acc, r) => acc + (r.total_ativas ?? 0), 0)
    return { produtos, variantes, ativas }
  }, [rows])

  return (
    <div className="space-y-4">
      <Card
        title="Produtos"
        subtitle="Modelos + variantes (expanda um modelo para ver)"
        rightSlot={
          <div className="flex gap-2">
            <Button onClick={carregar} disabled={loading} variant="ghost">
              {loading ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button onClick={() => router.push('/produtos/importar')} variant="secondary">
              Importar
            </Button>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
              Dashboard
            </Button>
          </div>
        }
      >
        {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Modelos">{totals.produtos}</StatCard>
              <StatCard title="Variantes">{totals.variantes}</StatCard>
              <StatCard title="Ativas">{totals.ativas}</StatCard>
            </div>

            {/* Busca / filtros */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="text-sm font-semibold text-slate-900">Buscar</div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Digite o nome do modelo…"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Filtro</div>
                  <Button
                    onClick={() => setOnlyAtivos((v) => !v)}
                    variant={onlyAtivos ? 'secondary' : 'ghost'}
                    className="mt-2 w-full py-3"
                  >
                    {onlyAtivos ? 'Somente ativos' : 'Todos'}
                  </Button>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Exibindo <b>{filtered.length}</b> de <b>{rows.length}</b> modelos
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                Nenhum produto encontrado. Use <b>Importar</b> para cadastrar via CSV.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => {
                  const isOpen = openId === r.id
                  const vstate = variantesByProduto[r.id]
                  const variantes = vstate?.data ?? []

                  return (
                    <div key={r.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-slate-900">{r.nome_modelo}</div>
                            <Badge tone="info">{r.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            Variantes: <b>{r.total_variantes}</b> • Ativas: <b>{r.total_ativas}</b>
                          </div>

                          <div className="mt-2 font-mono text-xs break-all text-slate-500">{r.id}</div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => toggleOpen(r.id)}
                            variant="secondary"
                            className="px-4"
                            disabled={loading}
                          >
                            {isOpen ? 'Fechar' : 'Ver variantes'}
                          </Button>
                        </div>
                      </div>

                      {/* Variantes (lazy) */}
                      {isOpen ? (
                        <div className="mt-4 rounded-2xl border bg-slate-50 p-3">
                          {vstate?.status === 'loading' ? (
                            <div className="text-sm text-slate-600">Carregando variantes…</div>
                          ) : vstate?.status === 'error' ? (
                            <div className="text-sm font-semibold text-red-600">{vstate.err ?? 'erro_inesperado'}</div>
                          ) : variantes.length === 0 ? (
                            <div className="text-sm text-slate-600">Nenhuma variante encontrada.</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-900">Variantes</div>
                                <Badge tone="info">{variantes.length}</Badge>
                              </div>

                              {variantes.map((v) => (
                                <div key={v.id} className="rounded-2xl border bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-slate-900 truncate">
                                        {v.nome_exibicao || `${v.cor}`}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-700">
                                        <span className="font-mono">{v.sku}</span> • {v.cor}
                                      </div>
                                      <div className="mt-2 font-mono text-xs break-all text-slate-500">{v.id}</div>
                                    </div>
                                    <Badge tone="info">{v.ativo ? 'Ativa' : 'Inativa'}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
