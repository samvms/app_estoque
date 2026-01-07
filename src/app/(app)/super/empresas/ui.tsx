'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type EmpresaRow = {
  empresa_id: string
  codigo: string
  nome: string
  cnpj: string | null
  created_at: string | null

  assinatura_id: string | null
  plano_codigo: 'ESSENCIAL' | 'PROFISSIONAL' | 'ENTERPRISE' | null
  status: 'ativa' | 'suspensa' | 'cancelada' | null
  is_trial: boolean | null
  trial_termina_em: string | null
  renova_em: string | null

  next_cursor_nome: string | null
  next_cursor_id: string | null
}

const LIMIT = 30
const TZ = 'America/Sao_Paulo'
const PLANOS: Array<NonNullable<EmpresaRow['plano_codigo']>> = ['ESSENCIAL', 'PROFISSIONAL', 'ENTERPRISE']
const DIAS_OPCOES = [30, 60, 90, 180, 365]

function normalize(s: any) {
  return String(s ?? '').trim()
}

function fmtDT(iso: string | null) {
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

function badgePlanoTone(plano: EmpresaRow['plano_codigo']) {
  if (plano === 'ENTERPRISE') return 'info'
  if (plano === 'PROFISSIONAL') return 'ok'
  return 'warn'
}

function badgeStatusTone(status: EmpresaRow['status']) {
  if (status === 'ativa') return 'ok'
  if (status === 'suspensa') return 'warn'
  return 'warn'
}

function labelStatus(r: EmpresaRow) {
  if (!r.status) return 'Sem assinatura'
  if (r.status !== 'ativa') return r.status === 'suspensa' ? 'Suspensa' : 'Cancelada'
  if (r.is_trial) return 'Trial ativo'
  return 'Ativa'
}

export default function SuperEmpresasClient() {
  const router = useRouter()

  const [boot, setBoot] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const qNorm = useMemo(() => normalize(q), [q])

  const [rows, setRows] = useState<EmpresaRow[]>([])
  const [cursorNome, setCursorNome] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const inflight = useRef(false)

  // picks por empresa
  const [planPick, setPlanPick] = useState<Record<string, NonNullable<EmpresaRow['plano_codigo']>>>({})
  const [diasPick, setDiasPick] = useState<Record<string, number>>({})
  const [savingEmpresaId, setSavingEmpresaId] = useState<string | null>(null)

  async function checkSuper() {
    // passe {} para funções sem params (evita “schema cache sem parâmetros”)
    const { data, error } = await supabase.schema('core').rpc('fn_is_super_admin', {})
    if (error) throw error

    const v: any = Array.isArray(data) ? data[0] : data
    const ok = typeof v === 'boolean' ? v : Boolean(v?.fn_is_super_admin ?? v?.ok ?? v)

    if (!ok) {
      router.replace('/home')
      router.refresh()
      return false
    }

    return true
  }

  async function fetchPage(reset: boolean) {
    if (inflight.current) return
    inflight.current = true
    setLoading(true)
    setErr(null)

    try {
      const ok = await checkSuper()
      if (!ok) return

      const { data, error } = await supabase.schema('core').rpc('fn_super_listar_empresas', {
        p_q: qNorm || null,
        p_limit: LIMIT,
        p_cursor_nome: reset ? null : cursorNome,
        p_cursor_id: reset ? null : cursorId,
      })
      if (error) throw error

      const list = (data ?? []) as EmpresaRow[]
      setRows((prev) => (reset ? list : prev.concat(list)))

      // inicializa picks
      setPlanPick((prev) => {
        const next = { ...prev }
        for (const r of list) {
          if (!next[r.empresa_id]) next[r.empresa_id] = (r.plano_codigo ?? 'ESSENCIAL') as any
        }
        return next
      })

      setDiasPick((prev) => {
        const next = { ...prev }
        for (const r of list) {
          if (!next[r.empresa_id]) next[r.empresa_id] = 30
        }
        return next
      })

      const last = list.length ? list[list.length - 1] : null
      setCursorNome(last?.next_cursor_nome ?? null)
      setCursorId(last?.next_cursor_id ?? null)
      setHasMore(Boolean(last?.next_cursor_nome && last?.next_cursor_id && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar.')
    } finally {
      setLoading(false)
      setBoot(false)
      inflight.current = false
    }
  }

  function aplicarFiltro() {
    setCursorNome(null)
    setCursorId(null)
    setHasMore(true)
    fetchPage(true)
  }

  async function definirPlano(empresaId: string) {
    const plano = planPick[empresaId] ?? 'ESSENCIAL'
    const dias = diasPick[empresaId] ?? 30

    setSavingEmpresaId(empresaId)
    setErr(null)

    try {
      const { error } = await supabase.schema('core').rpc('fn_admin_set_plano_empresa', {
        p_empresa_id: empresaId,
        p_plano_codigo: plano,
        p_dias: dias,
      })
      if (error) throw error

      // recarrega do zero
      setCursorNome(null)
      setCursorId(null)
      setHasMore(true)
      await fetchPage(true)
      router.refresh()
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao definir plano.')
    } finally {
      setSavingEmpresaId(null)
    }
  }

  useEffect(() => {
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    const total = rows.length
    const ativas = rows.filter((r) => r.status === 'ativa' && !r.is_trial).length
    const trials = rows.filter((r) => r.status === 'ativa' && r.is_trial).length
    const susp = rows.filter((r) => r.status === 'suspensa').length
    return { total, ativas, trials, susp }
  }, [rows])

  return (
    <div className="space-y-4">
      <Card
        title="Super Admin • Empresas"
        subtitle="Upgrade manual (Pix/boleto) e auditoria rápida"
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard title="Listadas">{stats.total}</StatCard>
          <StatCard title="Ativas (pagas)">{stats.ativas}</StatCard>
          <StatCard title="Trials">{stats.trials}</StatCard>
          <StatCard title="Suspensas">{stats.susp}</StatCard>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="app-card px-3 py-2 md:col-span-2">
            <div className="text-[11px] font-semibold text-app-muted">Busca (nome/código/CNPJ)</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
              placeholder="Ex.: SMARTWAY ou 12345678000199"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 md:justify-end">
            <Button variant="primary" onClick={aplicarFiltro} disabled={loading}>
              Aplicar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setQ('')
                setCursorNome(null)
                setCursorId(null)
                setHasMore(true)
                fetchPage(true)
              }}
              disabled={loading}
            >
              Limpar
            </Button>
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Erro</div>
            <div className="mt-0.5 text-xs text-red-700/80 whitespace-pre-wrap">{err}</div>
          </div>
        ) : null}
      </Card>

      <Card title="Lista" subtitle={boot ? 'Carregando…' : `${rows.length} empresas`}>
        {boot ? (
          <div className="py-8 text-sm text-app-muted">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-sm text-app-muted">Sem resultados.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {rows.map((r) => {
              const plano = r.plano_codigo ?? null
              const pickPlano = planPick[r.empresa_id] ?? (plano ?? 'ESSENCIAL')
              const pickDias = diasPick[r.empresa_id] ?? 30

              return (
                <div key={r.empresa_id} className="app-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold text-[14px] truncate">{r.nome}</div>
                        <span className="app-badge app-badge--secondary">{r.codigo}</span>
                        {plano ? (
                          <Badge tone={badgePlanoTone(plano)}>{plano}</Badge>
                        ) : (
                          <Badge tone="warn">Sem plano</Badge>
                        )}
                        <Badge tone={badgeStatusTone(r.status)}>{labelStatus(r)}</Badge>
                      </div>

                      <div className="mt-1 text-xs text-app-muted">
                        CNPJ: <span className="font-mono font-semibold">{r.cnpj ?? '—'}</span>
                        <span className="mx-2">•</span>
                        Criada em: <span className="font-semibold">{fmtDT(r.created_at)}</span>
                      </div>

                      <div className="mt-1 text-xs text-app-muted">
                        Trial termina: <span className="font-semibold">{fmtDT(r.trial_termina_em)}</span>
                        <span className="mx-2">•</span>
                        Renova em: <span className="font-semibold">{fmtDT(r.renova_em)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col gap-2 min-w-[300px]">
                      <div className="app-card px-3 py-2">
                        <div className="text-[11px] font-semibold text-app-muted">Definir plano (manual)</div>

                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <select
                            className="w-full bg-transparent text-sm font-semibold outline-none"
                            value={pickPlano}
                            onChange={(e) =>
                              setPlanPick((s) => ({ ...s, [r.empresa_id]: e.target.value as any }))
                            }
                            disabled={savingEmpresaId === r.empresa_id}
                          >
                            {PLANOS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>

                          <select
                            className="w-full bg-transparent text-sm font-semibold outline-none"
                            value={pickDias}
                            onChange={(e) =>
                              setDiasPick((s) => ({ ...s, [r.empresa_id]: Number(e.target.value) }))
                            }
                            disabled={savingEmpresaId === r.empresa_id}
                          >
                            {DIAS_OPCOES.map((d) => (
                              <option key={d} value={d}>
                                {d} dias
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="primary"
                            className="!px-3 !py-2"
                            disabled={savingEmpresaId === r.empresa_id}
                            loading={savingEmpresaId === r.empresa_id}
                            onClick={() => definirPlano(r.empresa_id)}
                          >
                            Aplicar
                          </Button>
                        </div>

                        <div className="mt-1 text-[11px] text-app-muted">
                          Regra: converte a assinatura atual (trial → paga) ou cria uma nova se não existir.
                        </div>
                      </div>
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
