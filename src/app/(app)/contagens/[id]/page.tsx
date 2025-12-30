// src/app/(app)/contagens/[id]/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function mapErroOperacional(msg: string) {
  const m = (msg || '').toLowerCase()
  if (m.includes('contagem_invalida') || m.includes('contagem inválida')) return 'Contagem inválida ou já fechada.'
  if (m.includes('local_obrigatorio') || m.includes('local obrigatório')) return 'Local é obrigatório.'
  return msg.length > 90 ? 'Erro ao bipar.' : msg
}

function toneStatus(status: Contagem['status']): 'info' | 'ok' | 'warn' {
  return status === 'ABERTA' ? 'info' : 'ok'
}

function normalizeParamId(id: unknown): string {
  if (typeof id === 'string') return id
  if (Array.isArray(id) && typeof id[0] === 'string') return id[0]
  return ''
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

  const [toast, setToast] = useState<string | null>(null)
  const [modalFechar, setModalFechar] = useState(false)
  const [busy, setBusy] = useState(false)

  const modoLeitura = useMemo(() => contagem?.status === 'FECHADA', [contagem?.status])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout((showToast as any)._t)
    ;(showToast as any)._t = window.setTimeout(() => setToast(null), 2200)
  }, [])

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.schema('app_estoque').rpc(fn, args ?? {})
    if (error) throw error
    return data as T
  }, [])

  const carregar = useCallback(async () => {
    // ✅ nunca retorna antes de desligar o loading
    setLoading(true)
    setErro(null)

    if (!contagemId) {
      setContagem(null)
      setLocais([])
      setStats(null)
      setLoading(false)
      return
    }

    try {
      const c = await rpc<Contagem[] | null>('fn_obter_contagem', { p_contagem_id: contagemId })
      const cont = Array.isArray(c) ? c[0] : null
      if (!cont) throw new Error('Contagem não encontrada ou sem permissão.')
      setContagem(cont)

      const ls = await rpc<LocalEstoque[]>('fn_listar_locais')
      setLocais(ls ?? [])

      const st = await rpc<ContagemStats[] | null>('fn_contagem_stats', { p_contagem_id: contagemId })
      const st0 = Array.isArray(st) ? st[0] : null
      setStats(st0 ?? { contagem_id: contagemId, total_bipado: 0, ultimo_bipado_em: null })

      if (!localId && (ls?.length ?? 0) === 1) setLocalId(ls[0].id)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar contagem.')
    } finally {
      setLoading(false)
    }
  }, [contagemId, localId, rpc])

  const refetchStats = useCallback(async () => {
    if (!contagemId) return
    try {
      const st = await rpc<ContagemStats[] | null>('fn_contagem_stats', { p_contagem_id: contagemId })
      const st0 = Array.isArray(st) ? st[0] : null
      if (st0) setStats(st0)
    } catch {}
  }, [contagemId, rpc])

  useEffect(() => {
    // ✅ evita ficar preso em loading se id vier vazio no primeiro render
    if (!contagemId) {
      setLoading(false)
      return
    }
    carregar()
  }, [contagemId, carregar])

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

      setBusy(true)
      try {
        const qr = String(valor || '').trim()
        if (!qr) {
          showToast('QR inválido.')
          return
        }

        await rpc<any>('fn_bipar_na_contagem', {
          p_contagem_id: contagemId,
          p_qr_code: qr,
          p_local_id: localId,
        })

        setUltimoQr(qr)
        void refetchStats()
      } catch (e: any) {
        showToast(mapErroOperacional(e?.message ?? 'Erro ao bipar.'))
      } finally {
        setBusy(false)
      }
    },
    [busy, contagemId, localId, modoLeitura, refetchStats, rpc, showToast]
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
      {toast ? (
        <div className="fixed left-3 right-3 top-3 z-50 app-card px-4 py-3 text-sm font-semibold md:left-auto md:right-6 md:top-6 md:w-[420px]">
          {toast}
        </div>
      ) : null}

      <Card
        title={`Contagem ${contagem.tipo}`}
        subtitle={`ID: …${shortId(contagem.id)} • Iniciada: ${fmtDateTime(contagem.iniciada_em)}${
          contagem.finalizada_em ? ` • Finalizada: ${fmtDateTime(contagem.finalizada_em)}` : ''
        }`}
        rightSlot={<Badge tone={toneStatus(contagem.status)}>{contagem.status}</Badge>}
      >
        <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
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
        </>
      ) : (
        <>
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

              {!localId ? <div className="text-xs text-app-muted">Selecione um local para bipar.</div> : null}
            </div>
          </Card>

          <Card
            title="Scanner"
            subtitle="Leitura contínua (anti-loop)"
            rightSlot={<Badge tone={busy ? 'warn' : 'info'}>{busy ? 'Processando…' : 'Pronto'}</Badge>}
          >
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-app-border bg-white">
                <ScannerQR
                  modo="continuous"
                  cooldownMs={1200}
                  aoLer={(valor) => {
                    void bipar(valor)
                  }}
                />

                {!localId ? (
                  <div className="absolute inset-0 grid place-items-center bg-white/90 p-4 text-center">
                    <div className="max-w-[260px]">
                      <div className="text-sm font-semibold text-app-fg">Selecione um local</div>
                      <div className="mt-1 text-xs text-app-muted">O scanner fica bloqueado até escolher.</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm">
                <div>
                  <b>Último QR:</b> {ultimoQr ? `…${shortId(ultimoQr, 8)}` : '-'}
                </div>
                <div>
                  <b>Total bipado:</b> {stats?.total_bipado ?? 0}
                </div>
                <div>
                  <b>Último:</b> {fmtDateTime(stats?.ultimo_bipado_em ?? null)}
                </div>
                <div>
                  <b>Local atual:</b> {localId ? locais.find((l) => l.id === localId)?.nome ?? '-' : '-'}
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
        </>
      )}

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
