'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  // novos (opcionais — se a RPC ainda não retorna, vai cair no "-")
  peso_bruto_kg?: number | null
  comprimento_cm?: number | null
  largura_cm?: number | null
  altura_cm?: number | null
  valor_declarado?: number | null
  gtin?: string | null
  ncm?: string | null

  next_cursor_sku: string | null
  next_cursor_id: string | null
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function canonSku(s: string) {
  return (s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_.]/g, '')
}

function fmtKg(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(3).replace('.', ',')} kg`
}

function fmtCm(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(0)} cm`
}

function fmtBRL(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dimsLabel(r: Row) {
  const c = r.comprimento_cm
  const l = r.largura_cm
  const a = r.altura_cm
  if (c == null || l == null || a == null) return '-'
  return `${fmtCm(c)} × ${fmtCm(l)} × ${fmtCm(a)}`
}

function cubagemM3(r: Row) {
  const c = Number(r.comprimento_cm)
  const l = Number(r.largura_cm)
  const a = Number(r.altura_cm)
  if (!Number.isFinite(c) || !Number.isFinite(l) || !Number.isFinite(a)) return null
  return (c * l * a) / 1_000_000
}

export default function VariantesPage() {
  const router = useRouter()

  const [skuPrefix, setSkuPrefix] = useState('')
  const [ativo, setAtivo] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS')

  // UX: modo de visualização
  const [view, setView] = useState<'CARDS' | 'TABELA'>('CARDS')

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [cursorSku, setCursorSku] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const ativoParam = ativo === 'TODOS' ? null : ativo === 'ATIVO' ? true : false
  const skuCanon = useMemo(() => canonSku(skuPrefix), [skuPrefix])

  async function fetchPage(reset: boolean) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase.schema('lws').rpc('fn_listar_variantes_paginado', {
        p_limit: LIMIT,
        p_sku_prefix: skuCanon || null,
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

  const totalAtivos = useMemo(() => rows.filter((r) => r.ativo).length, [rows])
  const totalInativos = useMemo(() => rows.filter((r) => !r.ativo).length, [rows])

  return (
    <div className="space-y-4">
      <Card
        title="Variantes"
        subtitle="SKU • Produto • Frete"
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge tone="info">Cadastro</Badge>
            <Button variant="secondary" onClick={() => router.push('/produtos/novo')} disabled={loading}>
              + Cadastrar produto
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="app-card px-3 py-2">
            <div className="text-[11px] font-semibold text-app-muted">SKU (prefixo)</div>
            <input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="Ex.: SC350"
              className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
            />
            <div className="mt-1 text-[11px] text-app-muted">
              Normalizado: <span className="font-mono">{skuCanon || '—'}</span>
            </div>
          </div>

          <div className="app-card px-3 py-2">
            <div className="text-[11px] font-semibold text-app-muted">Status</div>
            <select
              value={ativo}
              onChange={(e) => setAtivo(e.target.value as any)}
              className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
            <div className="mt-1 text-[11px] text-app-muted">
              Ativos: <span className="font-semibold">{totalAtivos}</span> • Inativos:{' '}
              <span className="font-semibold">{totalInativos}</span>
            </div>
          </div>

          <div className="app-card px-3 py-2">
            <div className="text-[11px] font-semibold text-app-muted">Visualização</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={cx(
                  'app-btn app-btn--secondary !px-3 !py-2',
                  view === 'CARDS' && 'ring-2 ring-app-primary/20'
                )}
                onClick={() => setView('CARDS')}
                disabled={loading}
              >
                Cards
              </button>
              <button
                type="button"
                className={cx(
                  'app-btn app-btn--secondary !px-3 !py-2',
                  view === 'TABELA' && 'ring-2 ring-app-primary/20'
                )}
                onClick={() => setView('TABELA')}
                disabled={loading}
              >
                Tabela
              </button>
            </div>
          </div>

          <div className="flex gap-2 md:justify-end">
            <Button variant="primary" onClick={aplicar} disabled={loading}>
              Aplicar
            </Button>
            <Button variant="ghost" onClick={limpar} disabled={loading}>
              Limpar
            </Button>
          </div>
        </div>

        {err ? (
          <div className="mt-3 text-sm font-semibold" style={{ color: 'var(--app-danger)' }}>
            {err}
          </div>
        ) : null}
      </Card>

      <Card
        title="Listagem"
        subtitle={`${rows.length} itens`}
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        {rows.length === 0 ? (
          <div className="text-sm text-app-muted py-6">Sem resultados.</div>
        ) : view === 'TABELA' ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-app-muted">
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Variação</th>
                  <th className="py-2 pr-4">Frete (kg / cm)</th>
                  <th className="py-2 pr-4">Valor decl.</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-app-border">
                    <td className="py-3 pr-4 font-semibold">{r.sku}</td>
                    <td className="py-3 pr-4">{r.produto_nome}</td>
                    <td className="py-3 pr-4">{r.cor ?? '-'}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{r.peso_bruto_kg != null ? fmtKg(r.peso_bruto_kg) : '-'}</div>
                      <div className="text-[12px] text-app-muted">{dimsLabel(r)}</div>
                    </td>
                    <td className="py-3 pr-4">{r.valor_declarado != null ? fmtBRL(r.valor_declarado) : '-'}</td>
                    <td className="py-3">{r.ativo ? 'Ativo' : 'Inativo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {rows.map((r) => {
              const m3 = cubagemM3(r)
              return (
                <div key={r.id} className="app-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-extrabold text-[14px] truncate">{r.produto_nome}</div>
                        <span className={cx('app-badge', r.ativo ? 'app-badge--ok' : 'app-badge--warn')}>
                          {r.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div className="mt-1 text-sm text-app-muted">
                        <span className="font-mono font-semibold text-app-fg">{r.sku}</span>
                        <span className="mx-2">•</span>
                        <span className="font-semibold">{r.cor ?? '—'}</span>
                        {r.nome_exibicao ? (
                          <>
                            <span className="mx-2">•</span>
                            <span>{r.nome_exibicao}</span>
                          </>
                        ) : null}
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="app-card px-3 py-2">
                          <div className="text-[11px] font-semibold text-app-muted">Peso bruto</div>
                          <div className="mt-1 text-sm font-extrabold">{r.peso_bruto_kg != null ? fmtKg(r.peso_bruto_kg) : '-'}</div>
                        </div>

                        <div className="app-card px-3 py-2">
                          <div className="text-[11px] font-semibold text-app-muted">Dimensões</div>
                          <div className="mt-1 text-sm font-extrabold">{dimsLabel(r)}</div>
                          <div className="mt-0.5 text-[11px] text-app-muted">
                            Cubagem: <span className="font-mono">{m3 != null ? m3.toFixed(6) : '—'} m³</span>
                          </div>
                        </div>

                        <div className="app-card px-3 py-2">
                          <div className="text-[11px] font-semibold text-app-muted">Valor declarado</div>
                          <div className="mt-1 text-sm font-extrabold">{r.valor_declarado != null ? fmtBRL(r.valor_declarado) : '-'}</div>
                        </div>
                      </div>

                      {(r.gtin || r.ncm) ? (
                        <div className="mt-2 text-[12px] text-app-muted">
                          {r.gtin ? (
                            <>
                              GTIN: <span className="font-mono font-semibold">{r.gtin}</span>
                            </>
                          ) : null}
                          {r.gtin && r.ncm ? <span className="mx-2">•</span> : null}
                          {r.ncm ? (
                            <>
                              NCM: <span className="font-mono font-semibold">{r.ncm}</span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 flex flex-col gap-2">
                      <Button
                        variant="secondary"
                        className="!px-3 !py-2 text-sm"
                        onClick={() => router.push(`/variantes/${r.id}`)}
                        disabled={loading}
                      >
                        Abrir
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => fetchPage(false)} disabled={loading || !hasMore}>
            {hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
