// src/app/(app)/recebimentos/[id]/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'
import { ScannerQR } from '@/modules/inventory/ui/ScannerQR'
import { RetroWindow, RetroButton, RetroField, RetroSelect, RetroBadge } from '@/modules/shared/ui/retro'

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

  if (loading) {
    return (
      <RetroWindow title="Recebimento">
        <div className="text-sm opacity-80">Carregando…</div>
      </RetroWindow>
    )
  }

  if (erro) {
    return (
      <RetroWindow title="Erro">
        <div className="space-y-3">
          <div className="text-sm font-bold text-red-700">{erro}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <RetroButton className="w-full py-3" onClick={() => router.back()} disabled={busy}>
              Voltar
            </RetroButton>
            <RetroButton className="w-full py-3" onClick={carregar} disabled={busy}>
              Tentar novamente
            </RetroButton>
          </div>
        </div>
      </RetroWindow>
    )
  }

  if (!recebimento) return null

  return (
    <div className="space-y-3">
      {toast ? (
        <div className="fixed left-3 right-3 top-3 z-50 border-2 border-black bg-white p-3 text-sm font-bold md:left-auto md:right-6 md:top-6 md:w-[420px]">
          {toast}
        </div>
      ) : null}

      <RetroWindow
        title="Recebimento"
        rightSlot={
          <div className="flex items-center gap-2">
            <RetroBadge tone={recebimento.status === 'ABERTO' ? 'ok' : 'warn'}>{recebimento.status}</RetroBadge>
            <RetroBadge tone="info">{recebimento.tipo_conferencia}</RetroBadge>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1 text-sm">
            <div className="text-xs opacity-80">
              Ref: {recebimento.referencia || '(sem referência)'} • ID: …{shortId(recebimento.id)}
            </div>
            <div className="text-xs opacity-80">
              Criado: {fmtDateTime(recebimento.criado_em)} • Aprovado: {fmtDateTime(recebimento.aprovado_em)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:flex lg:justify-end">
            <RetroButton className="w-full py-3 lg:w-auto" onClick={() => router.back()} disabled={busy}>
              Voltar
            </RetroButton>

            {isOperacional ? (
              <>
                <RetroButton className="w-full py-3 lg:w-auto" onClick={() => setModalFinalizar('APROVADO')} disabled={busy}>
                  Aprovar
                </RetroButton>
                <RetroButton
                  variant="danger"
                  className="w-full py-3 lg:w-auto"
                  onClick={() => setModalFinalizar('REPROVADO')}
                  disabled={busy}
                >
                  Reprovar
                </RetroButton>
              </>
            ) : null}

            <RetroButton className="w-full py-3 lg:w-auto" onClick={refetchResumo} disabled={busy}>
              Atualizar
            </RetroButton>

            <RetroButton
              className="w-full py-3 lg:w-auto"
              onClick={() => router.push(`/recebimentos/${recebimento.id}/resumo`)}
              disabled={busy}
            >
              Ver resumo
            </RetroButton>
          </div>
        </div>
      </RetroWindow>

      {isOperacional ? (
        <>
          <RetroWindow title="Local (obrigatório)">
            <div className="space-y-2">
              <RetroField label="Local">
                <RetroSelect
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  disabled={busy}
                  className="py-3"
                >
                  <option value="">Selecione…</option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </RetroSelect>
              </RetroField>

              {!localId ? <div className="text-xs opacity-80">Selecione um local antes de bipar.</div> : null}
            </div>
          </RetroWindow>

          <RetroWindow
            title="Scanner"
            rightSlot={<RetroBadge tone={busy ? 'warn' : 'info'}>{busy ? 'Processando…' : 'OK padrão'}</RetroBadge>}
          >
            <div className="space-y-3">
              <div className="relative">
                <ScannerQR modo="continuous" cooldownMs={1200} aoLer={(valor) => void registrar(valor, 'OK')} />

                {!localId ? (
                  <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-black bg-white/90 p-4 text-center font-black">
                    Selecione um local
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm">
                <div><b>Último QR:</b> {ultimoQr ? `…${shortId(ultimoQr, 8)}` : '-'}</div>
              </div>

              <RetroButton
                variant="danger"
                className="w-full py-3"
                disabled={busy || !localId}
                onClick={() => {
                  const v = ultimoQr
                  if (!v) return showToast('Nenhum QR para marcar como divergente.')
                  void registrar(v, 'DIVERGENTE')
                }}
                title="Marca o último QR como divergente (caso tenha sido bipada como OK)"
              >
                Marcar último como DIVERGENTE
              </RetroButton>
            </div>
          </RetroWindow>
        </>
      ) : null}

      <RetroWindow
        title="Resumo (modo escala por variante)"
        rightSlot={<div className="text-xs opacity-80">{isOperacional ? 'Atualiza após bipagens' : 'Somente leitura'}</div>}
      >
        {resumo.length === 0 ? (
          <div className="text-sm opacity-80">Nenhuma conferência registrada ainda.</div>
        ) : (
          <div className="grid gap-2">
            {resumo.map((x) => (
              <div key={x.produto_variante_id} className="border-2 border-black bg-white p-3">
                <div className="text-xs font-black">Variante: …{shortId(x.produto_variante_id)}</div>
                <div className="mt-1 text-sm">
                  Status: <b>{x.status_item}</b> • OK: <b>{x.qtd_ok}</b> • Divergente: <b>{x.qtd_divergente}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </RetroWindow>

      {modalFinalizar ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md border-2 border-black bg-white p-4">
            <div className="mb-2 text-base font-black">Finalizar recebimento: {modalFinalizar}</div>

            <div className="space-y-2 text-sm">
              <div>
                Confirma finalizar o recebimento como <b>{modalFinalizar}</b>?
              </div>
              <div className="text-xs opacity-80">Essa ação encerra o recebimento e bloqueia novas conferências.</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              <RetroButton className="w-full py-3" onClick={() => setModalFinalizar(null)} disabled={busy}>
                Cancelar
              </RetroButton>

              <RetroButton
                variant={modalFinalizar === 'REPROVADO' ? 'danger' : 'default'}
                className="w-full py-3"
                onClick={() => finalizar(modalFinalizar)}
                disabled={busy}
              >
                Confirmar
              </RetroButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
