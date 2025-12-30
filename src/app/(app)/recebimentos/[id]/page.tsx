// src/app/(app)/recebimentos/[id]/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'
import { ScannerQR } from '@/modules/inventory/ui/ScannerQR'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

type Recebimento = {
  id: string
  referencia: string | null
  status: 'ABERTO' | 'APROVADO' | 'REPROVADO'
  tipo_conferencia: 'AMOSTRA' | 'TOTAL'
  criado_em: string | null
  aprovado_em: string | null
  criado_por: string | null
}

type LocalEstoque = { id: string; nome: string; ativo: boolean }

type ResumoLinha = {
  produto_variante_id: string
  status_item: 'ABERTO' | 'OK' | 'DIVERGENTE'
  qtd_ok: number
  qtd_divergente: number
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function shortId(id: string, n = 8) {
  return (id || '').replace(/-/g, '').slice(-n).toUpperCase()
}

function mapErroOperacao(msg: string) {
  const m = (msg || '').toLowerCase()

  if (m.includes('local_obrigatorio')) return 'Local é obrigatório.'
  if (m.includes('local_invalido_ou_inativo')) return 'Local inválido ou inativo.'
  if (m.includes('recebimento_invalido_ou_fechado')) return 'Recebimento inválido ou fechado.'
  if (m.includes('recebimento_invalido_ou_ja_fechado')) return 'Recebimento inválido ou já fechado.'
  if (m.includes('resultado_invalido_para_conferencia')) return 'Resultado inválido para conferência.'
  if (m.includes('status_final_invalido')) return 'Status final inválido.'
  if (m.includes('caixa_sem_variante')) return 'Caixa sem variante vinculada.'

  return msg.length > 80 ? 'Erro na operação.' : msg
}

function toneReceb(status: Recebimento['status']): 'info' | 'ok' | 'warn' {
  if (status === 'ABERTO') return 'info'
  if (status === 'APROVADO') return 'ok'
  return 'warn'
}

function toneItem(status: ResumoLinha['status_item']): 'info' | 'ok' | 'warn' {
  if (status === 'DIVERGENTE') return 'warn'
  if (status === 'OK') return 'ok'
  return 'info'
}

export default function RecebimentoDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const recebimentoId = params?.id

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [recebimento, setRecebimento] = useState<Recebimento | null>(null)
  const [locais, setLocais] = useState<LocalEstoque[]>([])
  const [localId, setLocalId] = useState<string>('')

  const [toast, setToast] = useState<string | null>(null)
  const [ultimoQr, setUltimoQr] = useState<string>('')

  const [resumo, setResumo] = useState<ResumoLinha[]>([])
  const [modalFinalizar, setModalFinalizar] = useState<null | 'APROVADO' | 'REPROVADO'>(null)

  const isOperacional = useMemo(() => recebimento?.status === 'ABERTO', [recebimento?.status])

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
    if (!recebimentoId) return
    setLoading(true)
    setErro(null)

    try {
      const r = await rpc<Recebimento[] | null>('fn_obter_recebimento', { p_recebimento_id: recebimentoId })
      const r0 = Array.isArray(r) ? r[0] : null
      if (!r0) throw new Error('Recebimento não encontrado ou sem permissão.')
      setRecebimento(r0)

      const ls = await rpc<LocalEstoque[]>('fn_listar_locais')
      setLocais(ls ?? [])
      if (!localId && (ls?.length ?? 0) === 1) setLocalId(ls[0].id)

      const resumo0 = await rpc<ResumoLinha[]>('fn_resumo_recebimento', { p_recebimento_id: recebimentoId })
      setResumo(resumo0 ?? [])
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar recebimento.')
    } finally {
      setLoading(false)
    }
  }, [localId, recebimentoId, rpc])

  const refetchResumo = useCallback(async () => {
    if (!recebimentoId) return
    try {
      const resumo0 = await rpc<ResumoLinha[]>('fn_resumo_recebimento', { p_recebimento_id: recebimentoId })
      setResumo(resumo0 ?? [])
    } catch {
      // silencioso
    }
  }, [recebimentoId, rpc])

  useEffect(() => {
    carregar()
  }, [carregar])

  const registrar = useCallback(
    async (valor: string, resultado: 'OK' | 'DIVERGENTE') => {
      if (busy) return
      if (!recebimentoId) return

      if (!isOperacional) {
        showToast('Recebimento finalizado. Apenas leitura.')
        return
      }

      setBusy(true)
      try {
        const qr = String(valor || '').trim()
        if (!qr) {
          showToast('QR inválido.')
          return
        }

        await rpc<string>('fn_registrar_conferencia_recebimento', {
          p_recebimento_id: recebimentoId,
          p_qr_code: qr,
          p_local_id: localId || null, // backend já exige local_obrigatorio
          p_resultado: resultado,
        })

        setUltimoQr(qr)
        await refetchResumo()
      } catch (e: any) {
        showToast(mapErroOperacao(e?.message ?? 'Erro ao registrar conferência.'))
      } finally {
        setBusy(false)
      }
    },
    [busy, isOperacional, localId, recebimentoId, refetchResumo, rpc, showToast]
  )

  const finalizar = useCallback(
    async (novoStatus: 'APROVADO' | 'REPROVADO') => {
      if (!recebimentoId) return
      if (busy) return

      setBusy(true)
      setErro(null)

      try {
        await rpc<any>('fn_finalizar_recebimento', {
          p_recebimento_id: recebimentoId,
          p_novo_status: novoStatus,
        })

        setModalFinalizar(null)
        await carregar()
        showToast(`Recebimento ${novoStatus}.`)
      } catch (e: any) {
        setErro(mapErroOperacao(e?.message ?? 'Erro ao finalizar recebimento.'))
      } finally {
        setBusy(false)
      }
    },
    [busy, carregar, recebimentoId, rpc, showToast]
  )

  // Ordena: DIVERGENTE primeiro, depois OK, depois ABERTO
  const resumoOrdenado = useMemo(() => {
    const w = (s: ResumoLinha['status_item']) => (s === 'DIVERGENTE' ? 0 : s === 'OK' ? 1 : 2)
    return [...resumo].sort((a, b) => w(a.status_item) - w(b.status_item))
  }, [resumo])

  if (loading) {
    return (
      <Card title="Recebimento" subtitle="Carregando…">
        <div className="text-sm text-app-muted">Carregando…</div>
      </Card>
    )
  }

  if (erro) {
    return (
      <Card title="Erro" subtitle="Não foi possível carregar o recebimento">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
          <div className="grid grid-cols-1 gap-2">
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

  if (!recebimento) return null

  return (
    <div className="space-y-3">
      {toast ? (
        <div className="fixed left-3 right-3 top-3 z-50 app-card px-4 py-3 text-sm font-semibold md:left-auto md:right-6 md:top-6 md:w-[420px]">
          {toast}
        </div>
      ) : null}

      <Card
        title="Recebimento"
        subtitle={`Ref: ${recebimento.referencia || '(sem referência)'} • ID: …${shortId(recebimento.id)}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge tone={toneReceb(recebimento.status)}>{recebimento.status}</Badge>
            <Badge tone="info">{recebimento.tipo_conferencia}</Badge>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="text-xs text-app-muted">
            Criado: <span className="font-semibold text-app-fg">{fmtDateTime(recebimento.criado_em)}</span> • Finalizado:{' '}
            <span className="font-semibold text-app-fg">{fmtDateTime(recebimento.aprovado_em)}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button className="w-full py-3" variant="ghost" onClick={() => router.back()} disabled={busy}>
              Voltar
            </Button>

            {isOperacional ? (
              <>
                <Button className="w-full py-3" onClick={() => setModalFinalizar('APROVADO')} disabled={busy}>
                  Aprovar
                </Button>
                <Button className="w-full py-3" variant="danger" onClick={() => setModalFinalizar('REPROVADO')} disabled={busy}>
                  Reprovar
                </Button>
              </>
            ) : null}

            <Button className="w-full py-3" variant="ghost" onClick={refetchResumo} disabled={busy}>
              Atualizar
            </Button>

            <Button
              className="w-full py-3"
              variant="secondary"
              onClick={() => router.push(`/recebimentos/${recebimento.id}/resumo`)}
              disabled={busy}
            >
              Ver resumo
            </Button>
          </div>
        </div>
      </Card>

      {isOperacional ? (
        <>
          <Card title="Local" subtitle="Obrigatório antes de bipar">
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

              {!localId ? <div className="text-xs text-app-muted">Selecione um local antes de bipar.</div> : null}
            </div>
          </Card>

          <Card
            title="Scanner"
            subtitle="OK é o padrão (marque divergência no último QR se necessário)"
            rightSlot={<Badge tone={busy ? 'warn' : 'info'}>{busy ? 'Processando…' : 'OK padrão'}</Badge>}
          >
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-app-border bg-white">
                <ScannerQR modo="continuous" cooldownMs={1200} aoLer={(valor) => void registrar(valor, 'OK')} />

                {!localId ? (
                  <div className="absolute inset-0 grid place-items-center bg-white/90 p-4 text-center">
                    <div className="max-w-[260px]">
                      <div className="text-sm font-semibold text-app-fg">Selecione um local</div>
                      <div className="mt-1 text-xs text-app-muted">O scanner fica bloqueado até escolher.</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="text-sm">
                <b>Último QR:</b> {ultimoQr ? `…${shortId(ultimoQr, 8)}` : '-'}
              </div>

              <Button
                className="w-full py-3"
                variant="danger"
                disabled={busy || !localId}
                onClick={() => {
                  const v = ultimoQr
                  if (!v) return showToast('Nenhum QR para marcar como divergente.')
                  void registrar(v, 'DIVERGENTE')
                }}
                title="Marca o último QR como divergente (caso tenha sido bipada como OK)"
              >
                Marcar último como DIVERGENTE
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      <Card
        title="Resumo"
        subtitle={isOperacional ? 'Atualiza após bipagens' : 'Somente leitura'}
        rightSlot={<span className="text-xs text-app-muted">{resumo.length} item(ns)</span>}
      >
        {resumoOrdenado.length === 0 ? (
          <div className="text-sm text-app-muted">Nenhuma conferência registrada ainda.</div>
        ) : (
          <div className="grid gap-2">
            {resumoOrdenado.map((x) => (
              <div key={x.produto_variante_id} className="app-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-app-muted">Variante</div>
                    <div className="text-sm font-semibold text-app-fg">…{shortId(x.produto_variante_id)}</div>
                  </div>

                  <Badge tone={toneItem(x.status_item)}>{x.status_item}</Badge>
                </div>

                <div className="mt-2 text-sm text-app-muted">
                  OK: <b className="text-app-fg">{x.qtd_ok}</b> • Divergente:{' '}
                  <b className="text-app-fg">{x.qtd_divergente}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modalFinalizar ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md app-card px-5 py-5">
            <div className="text-base font-semibold text-app-fg">Finalizar recebimento</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={modalFinalizar === 'APROVADO' ? 'ok' : 'warn'}>{modalFinalizar}</Badge>
            </div>

            <div className="mt-3 space-y-2 text-sm text-app-fg">
              <div>
                Confirma finalizar o recebimento como <b>{modalFinalizar}</b>?
              </div>
              <div className="text-xs text-app-muted">Essa ação encerra o recebimento e bloqueia novas conferências.</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <Button className="w-full py-3" variant="ghost" onClick={() => setModalFinalizar(null)} disabled={busy}>
                Cancelar
              </Button>

              <Button
                className="w-full py-3"
                variant={modalFinalizar === 'REPROVADO' ? 'danger' : 'secondary'}
                onClick={() => finalizar(modalFinalizar)}
                disabled={busy}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
