'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'
import { ScannerQR } from '@/modules/inventory/ui/ScannerQR'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

type Contagem = {
  id: string
  tipo: 'INICIAL' | 'PERIODICA'
  status: 'ABERTA' | 'FECHADA'
  iniciada_em: string | null
  finalizada_em: string | null
  criada_por: string | null
  estoque_antes: number | null
  estoque_contado: number | null
  diferenca: number | null
}

type ResumoVariacao = {
  produto_variante_id: string
  modelo: string
  variacao: string
  total_bipado: number
}

type UltimoBipado = {
  bipado_em: string
  qr_code: string
  modelo: string
  variacao: string
}

type LocalEstoque = {
  id: string
  nome: string
  ativo: boolean
}

type ContagemStats = {
  contagem_id: string
  total_bipado: number
  ultimo_bipado_em: string | null
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function toneStatus(status: Contagem['status']): 'info' | 'ok' | 'warn' {
  return status === 'ABERTA' ? 'info' : 'ok'
}

function normalizeParamId(id: unknown): string {
  if (typeof id === 'string') return id
  if (Array.isArray(id) && typeof id[0] === 'string') return id[0]
  return ''
}

function mapErroOperacional(msg: string) {
  const m = (msg || '').toLowerCase()
  if (m.includes('contagem_invalida') || m.includes('contagem inválida')) return 'Contagem inválida ou já fechada.'
  if (m.includes('local_obrigatorio') || m.includes('local obrigatório')) return 'Local é obrigatório.'
  return msg.length > 90 ? 'Erro ao bipar.' : msg
}

export default function ContagemDetalhePage() {
  const router = useRouter()
  const params = useParams()

  const contagemId = useMemo(() => normalizeParamId((params as any)?.id).trim(), [params])

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [contagem, setContagem] = useState<Contagem | null>(null)
  const [locais, setLocais] = useState<LocalEstoque[]>([])
  const [localId, setLocalId] = useState<string>('')

  const [stats, setStats] = useState<ContagemStats | null>(null)
  const [ultimoQr, setUltimoQr] = useState<string>('')

  // Resumos (novo)
  const [resumoVar, setResumoVar] = useState<ResumoVariacao[]>([])
  const [ultimos, setUltimos] = useState<UltimoBipado[]>([])
  const [loadingResumo, setLoadingResumo] = useState(false)

  // toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const [modalFechar, setModalFechar] = useState(false)
  const [busy, setBusy] = useState(false)

  const modoLeitura = contagem?.status === 'FECHADA'

  // formatter (perf)
  const dtf = useMemo(() => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), [])
  const fmtDateTime = useCallback((iso: string | null) => (iso ? dtf.format(new Date(iso)) : '-'), [dtf])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('lws').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  // --- Resumo: variação + últimos (novo)
  const carregarResumoBipagens = useCallback(async () => {
    if (!contagemId) return
    setLoadingResumo(true)
    try {
      const [a, b] = await Promise.all([
        rpc<ResumoVariacao[] | null>('fn_contagem_resumo_por_variacao', { p_contagem_id: contagemId }),
        rpc<UltimoBipado[] | null>('fn_contagem_ultimos_bipados', { p_contagem_id: contagemId, p_limit: 10 }),
      ])
      setResumoVar(Array.isArray(a) ? a : [])
      setUltimos(Array.isArray(b) ? b : [])
    } catch {
      // não trava operação
    } finally {
      setLoadingResumo(false)
    }
  }, [contagemId, rpc])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)

    if (!contagemId) {
      setContagem(null)
      setLocais([])
      setStats(null)
      setResumoVar([])
      setUltimos([])
      setLoading(false)
      return
    }

    try {
      const c = await rpc<Contagem[] | null>('fn_obter_contagem', { p_contagem_id: contagemId })
      const cont = Array.isArray(c) ? c[0] : null
      if (!cont) throw new Error('Contagem não encontrada ou sem permissão.')
      setContagem(cont)

      const ls = await rpc<LocalEstoque[] | null>('fn_listar_locais')
      setLocais(Array.isArray(ls) ? ls : [])

      const st = await rpc<ContagemStats[] | null>('fn_contagem_stats', { p_contagem_id: contagemId })
      const st0 = Array.isArray(st) ? st[0] : null
      setStats(st0 ?? { contagem_id: contagemId, total_bipado: 0, ultimo_bipado_em: null })

      // ✅ carrega resumos sem travar UX
      void carregarResumoBipagens()
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar contagem.')
    } finally {
      setLoading(false)
    }
  }, [carregarResumoBipagens, contagemId, rpc])

  const refetchStats = useCallback(async () => {
    if (!contagemId) return
    try {
      const st = await rpc<ContagemStats[] | null>('fn_contagem_stats', { p_contagem_id: contagemId })
      const st0 = Array.isArray(st) ? st[0] : null
      if (st0) setStats(st0)
    } catch {}
  }, [contagemId, rpc])

  useEffect(() => {
    if (!contagemId) {
      setLoading(false)
      return
    }
    carregar()
  }, [contagemId, carregar])

  // auto-seleciona local se existir só 1
  useEffect(() => {
    if (localId) return
    if (locais.length === 1) setLocalId(locais[0].id)
  }, [locais, localId])

  const localAtualNome = useMemo(() => {
    if (!localId) return '-'
    return locais.find((l) => l.id === localId)?.nome ?? '-'
  }, [locais, localId])

  // ✅ TABELA: modelo + variação (sempre tratar item)
  const resumoModeloVariacao = useMemo(() => {
    return (resumoVar ?? [])
      .map((r) => ({
        produto_variante_id: r.produto_variante_id,
        modelo: (r.modelo || '-').trim() || '-',
        variacao: (r.variacao || '-').trim() || '-',
        total_bipado: Number(r.total_bipado ?? 0),
      }))
      .sort((a, b) => {
        // total desc, modelo asc, variação asc
        if (b.total_bipado !== a.total_bipado) return b.total_bipado - a.total_bipado
        const am = a.modelo.localeCompare(b.modelo)
        if (am !== 0) return am
        return a.variacao.localeCompare(b.variacao)
      })
  }, [resumoVar])

  const scannerBloqueado = !localId || busy || !!modoLeitura

  const bipar = useCallback(
    async (valor: string) => {
      if (busy) return
      setErro(null)

      if (!localId) {
        showToast('Local é obrigatório para bipar.')
        return
      }
      if (!contagemId) return
      if (modoLeitura) {
        showToast('Contagem fechada. Apenas leitura.')
        return
      }

      const qr = String(valor || '').trim()
      if (!qr) {
        showToast('QR inválido.')
        return
      }

      setBusy(true)
      try {
        await rpc<any>('fn_bipar_na_contagem', {
          p_contagem_id: contagemId,
          p_qr_code: qr,
          p_local_id: localId,
        })

        setUltimoQr(qr)

        // ✅ atualiza stats + resumos (em paralelo, sem “otimismo”)
        void refetchStats()
        void carregarResumoBipagens()
      } catch (e: any) {
        showToast(mapErroOperacional(e?.message ?? 'Erro ao bipar.'))
      } finally {
        setBusy(false)
      }
    },
    [busy, carregarResumoBipagens, contagemId, localId, modoLeitura, refetchStats, rpc, showToast],
  )

  const fecharContagem = useCallback(async () => {
    if (!contagemId) return
    if (busy) return

    setBusy(true)
    setErro(null)

    try {
      await rpc<any>('fn_fechar_contagem', { p_contagem_id: contagemId })
      setModalFechar(false)
      await carregar()
      showToast('Contagem fechada.')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao fechar contagem.')
    } finally {
      setBusy(false)
    }
  }, [busy, carregar, contagemId, rpc, showToast])

  // ---------- UI estados ----------
  if (loading) {
    return (
      <Card title="Contagem" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar a contagem">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Button className="w-full py-3" variant="ghost" onClick={() => router.back()} disabled={busy}>
              Voltar
            </Button>
            <Button className="w-full py-3" onClick={carregar} disabled={busy}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!contagem) {
    return (
      <Card title="Contagem" subtitle="Não encontrada">
        <div className="space-y-3">
          <div className="text-sm text-app-muted">Contagem não encontrada.</div>
          <Button className="w-full py-3" variant="ghost" onClick={() => router.back()} disabled={busy}>
            Voltar
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast ? (
        <div className="fixed left-3 right-3 top-3 z-50 app-card px-4 py-3 text-sm font-semibold md:left-auto md:right-6 md:top-6 md:w-[420px]">
          {toast}
        </div>
      ) : null}

      {/* Header */}
      <Card
        title={`Contagem ${contagem.tipo}`}
        subtitle={`ID: …${shortId(contagem.id)} • Iniciada: ${fmtDateTime(contagem.iniciada_em)}${
          contagem.finalizada_em ? ` • Finalizada: ${fmtDateTime(contagem.finalizada_em)}` : ''
        }`}
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge tone={toneStatus(contagem.status)}>{contagem.status}</Badge>
            <Badge tone="info">{contagem.tipo}</Badge>
          </div>
        }
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-app-muted">
            {modoLeitura ? 'Modo leitura' : 'Modo operacional'} • {busy ? 'Processando…' : 'Pronto'}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button className="w-full py-3 md:w-auto" variant="ghost" onClick={() => router.back()} disabled={busy}>
              Voltar
            </Button>

            {!modoLeitura ? (
              <Button
                className="w-full py-3 md:w-auto"
                variant="danger"
                onClick={() => setModalFechar(true)}
                disabled={busy}
              >
                Fechar contagem
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Modo leitura */}
      {modoLeitura ? (
        <>
          <Card title="Resumo" subtitle="Valores finais da contagem">
            <div className="grid gap-2 text-sm">
              <div>
                Estoque antes: <b className="text-app-fg">{contagem.estoque_antes ?? 0}</b>
              </div>
              <div>
                Estoque contado: <b className="text-app-fg">{contagem.estoque_contado ?? 0}</b>
              </div>
              <div>
                Diferença: <b className="text-app-fg">{contagem.diferenca ?? 0}</b>
              </div>
            </div>
          </Card>

          <Card title="Bipagens" subtitle="Indicadores de operação">
            <div className="grid gap-2 text-sm">
              <div>
                Total bipado: <b className="text-app-fg">{stats?.total_bipado ?? 0}</b>
              </div>
              <div>
                Último bipado em: <b className="text-app-fg">{fmtDateTime(stats?.ultimo_bipado_em ?? null)}</b>
              </div>
            </div>
          </Card>

          {/* histórico em tabela (modelo + variação) */}
          <Card
            title="Modelos e variações bipados"
            subtitle="Quantidade por item (histórico desta contagem)"
            rightSlot={
              <Badge tone={loadingResumo ? 'warn' : 'info'}>
                {loadingResumo ? 'Atualizando…' : 'OK'}
              </Badge>
            }
          >
            {resumoModeloVariacao.length === 0 ? (
              <div className="text-sm text-app-muted">Ainda não há bipagens.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-app-border bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-app-border">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-semibold text-app-muted">Modelo</th>
                      <th className="px-4 py-2.5 font-semibold text-app-muted">Variação</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-app-muted">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoModeloVariacao.map((r) => (
                      <tr
                        key={r.produto_variante_id}
                        className="border-b border-app-border last:border-b-0"
                      >
                        <td className="px-4 py-2.5 font-medium text-app-fg">
                          {r.modelo}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-app-fg">
                          {r.variacao}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-app-fg">
                          {r.total_bipado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 🔹 ação única, discreta, Apple-like (botão real, não link cru) */}
            <div className="mt-2 flex justify-end">
              <button
                onClick={carregarResumoBipagens}
                disabled={busy || loadingResumo}
                className="
                  inline-flex items-center gap-1.5
                  rounded-lg
                  border border-app-border
                  bg-white
                  px-2.5 py-1
                  text-[11px] font-medium
                  text-app-muted
                  hover:bg-app-hover hover:text-app-fg
                  active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition
                "
              >
                Atualizar
              </button>
            </div>

          </Card>
        </>
      ) : (
        <>
          {/* Local */}
          <Card title="Local de estoque" subtitle="Obrigatório para bipar">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Local</label>
              <select
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none"
              >
                <option value="">Selecione…</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>

              {!localId ? <div className="text-xs text-app-muted">Selecione um local para liberar o scanner.</div> : null}
            </div>
          </Card>

          {/* Scanner + Painel */}
          <Card
            title="Scanner"
            subtitle="Leitura contínua (anti-loop)"
            rightSlot={
              <Badge tone={scannerBloqueado ? 'warn' : 'ok'}>{scannerBloqueado ? 'Bloqueado' : 'Ativo'}</Badge>
            }
          >
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-app-border bg-white">
                <ScannerQR
                  modo="continuous"
                  cooldownMs={1200}
                  disabled={scannerBloqueado}
                  aoLer={(valor) => void bipar(valor)}
                />

                {scannerBloqueado ? (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-white/92 p-5 text-center">
                    <div className="max-w-[320px]">
                      {!localId ? (
                        <>
                          <div className="text-sm font-semibold text-app-fg">Selecione um local</div>
                          <div className="mt-1 text-xs text-app-muted">
                            O scanner só libera após escolher o local (vinculado à bipagem).
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-app-fg">Processando</div>
                          <div className="mt-1 text-xs text-app-muted">Aguarde para evitar dupla bipagem.</div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="app-card px-4 py-3">
                  <div className="text-xs text-app-muted font-medium">Último QR</div>
                  <div className="mt-1 text-sm font-semibold text-app-fg">{ultimoQr ? `…${shortId(ultimoQr)}` : '-'}</div>
                </div>

                <div className="app-card px-4 py-3">
                  <div className="text-xs text-app-muted font-medium">Total bipado</div>
                  <div className="mt-1 text-sm font-semibold text-app-fg">{stats?.total_bipado ?? 0}</div>
                </div>

                <div className="app-card px-4 py-3">
                  <div className="text-xs text-app-muted font-medium">Último</div>
                  <div className="mt-1 text-sm font-semibold text-app-fg">{fmtDateTime(stats?.ultimo_bipado_em ?? null)}</div>
                </div>

                <div className="app-card px-4 py-3">
                  <div className="text-xs text-app-muted font-medium">Local</div>
                  <div className="mt-1 text-sm font-semibold text-app-fg">{localAtualNome}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Button className="w-full py-3" variant="ghost" onClick={refetchStats} disabled={busy}>
                  Atualizar total
                </Button>
                <Button className="w-full py-3" variant="secondary" onClick={carregar} disabled={busy}>
                  Recarregar tela
                </Button>
              </div>
            </div>
          </Card>

          {/* ✅ NOVO: histórico em tabela (modelo + variação) também no operacional */}
          <Card
            title="Modelos e variações bipados"
            subtitle="Quantidade por item (histórico desta contagem)"
            rightSlot={<Badge tone={loadingResumo ? 'warn' : 'info'}>{loadingResumo ? 'Atualizando…' : 'Live'}</Badge>}
          >
            {resumoModeloVariacao.length === 0 ? (
              <div className="text-sm text-app-muted">Ainda não há bipagens.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-app-border bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-app-border">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold text-app-muted">Modelo</th>
                      <th className="px-4 py-3 font-semibold text-app-muted">Variação</th>
                      <th className="px-4 py-3 text-right font-semibold text-app-muted">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoModeloVariacao.map((r) => (
                      <tr key={r.produto_variante_id} className="border-b border-app-border last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-app-fg">{r.modelo}</td>
                        <td className="px-4 py-3 font-semibold text-app-fg">{r.variacao}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-app-fg">{r.total_bipado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button
                className="w-full py-3"
                variant="ghost"
                onClick={carregarResumoBipagens}
                disabled={busy || loadingResumo}
              >
                Atualizar
              </Button>

              <Button
                className="w-full py-3"
                variant="secondary"
                onClick={() => router.push(`/contagens/${contagemId}/resumo`)}
                disabled={busy}
              >
                Ver detalhes
              </Button>
            </div>
          </Card>

          {/* Últimos bipados (novo) */}
          <Card title="Últimos bipados" subtitle="Auditoria rápida (últimos 10)">
            {ultimos.length === 0 ? (
              <div className="text-sm text-app-muted">Nenhum QR bípado ainda.</div>
            ) : (
              <div className="space-y-2">
                {ultimos.map((u, idx) => (
                  <div
                    key={`${u.qr_code}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-app-border bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-app-fg truncate">
                        {u.modelo} • {u.variacao || '-'}
                      </div>
                      <div className="mt-0.5 text-xs text-app-muted">
                        {fmtDateTime(u.bipado_em)} • QR: …{shortId(u.qr_code, 8)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal fechar */}
      {modalFechar && !modoLeitura ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md app-card px-5 py-5">
            <div className="text-base font-semibold text-app-fg">Fechar contagem</div>

            <div className="mt-2 space-y-2 text-sm text-app-fg">
              <div className="text-app-muted">Ao fechar a contagem:</div>
              <ul className="list-disc pl-5 text-app-fg">
                <li>Caixas não bipadas serão marcadas como SAÍDA</li>
                <li>O estoque será recalculado</li>
                <li>Essa ação não pode ser desfeita</li>
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button className="w-full py-3" variant="ghost" onClick={() => setModalFechar(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button className="w-full py-3" variant="danger" onClick={fecharContagem} disabled={busy}>
                Confirmar e fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
