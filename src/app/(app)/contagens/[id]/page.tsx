// src/app/(app)/contagens/[id]/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase/client'
import { ScannerQR } from '@/modules/inventory/ui/ScannerQR'
import { RetroWindow, RetroButton, RetroField, RetroSelect, RetroBadge } from '@/modules/shared/ui/retro'

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

export default function ContagemDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const contagemId = params?.id

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
    if (!contagemId) return
    setLoading(true)
    setErro(null)

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
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contagemId])

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
      <RetroWindow title="Contagem">
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

  if (!contagem) {
    return (
      <RetroWindow title="Contagem">
        <div className="space-y-3">
          <div className="text-sm">Contagem não encontrada.</div>
          <RetroButton className="w-full py-3" onClick={() => router.back()} disabled={busy}>
            Voltar
          </RetroButton>
        </div>
      </RetroWindow>
    )
  }

  return (
    <div className="space-y-3">
      {toast ? (
        <div className="fixed left-3 right-3 top-3 z-50 border-2 border-black bg-white p-3 text-sm font-bold md:left-auto md:right-6 md:top-6 md:w-[420px]">
          {toast}
        </div>
      ) : null}

      <RetroWindow
        title={`Contagem ${contagem.tipo}`}
        rightSlot={
          <RetroBadge tone={contagem.status === 'FECHADA' ? 'warn' : 'ok'}>{contagem.status}</RetroBadge>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="space-y-1">
            <div className="text-xs opacity-80">ID: …{shortId(contagem.id)}</div>
            <div className="text-sm opacity-80">
              Iniciada: {fmtDateTime(contagem.iniciada_em)} {contagem.finalizada_em ? `• Finalizada: ${fmtDateTime(contagem.finalizada_em)}` : ''}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <RetroButton className="w-full py-3 md:w-auto" onClick={() => router.back()} disabled={busy}>
              Voltar
            </RetroButton>

            {!modoLeitura ? (
              <RetroButton
                variant="danger"
                className="w-full py-3 md:w-auto"
                onClick={() => setModalFechar(true)}
                disabled={busy}
              >
                Fechar contagem
              </RetroButton>
            ) : null}
          </div>
        </div>
      </RetroWindow>

      {modoLeitura ? (
        <>
          <RetroWindow title="Resumo">
            <div className="grid gap-2 text-sm">
              <div>Estoque antes: <b>{contagem.estoque_antes ?? 0}</b></div>
              <div>Estoque contado: <b>{contagem.estoque_contado ?? 0}</b></div>
              <div>Diferença: <b>{contagem.diferenca ?? 0}</b></div>
            </div>
          </RetroWindow>

          <RetroWindow title="Bipagens">
            <div className="grid gap-2 text-sm">
              <div>Total bipado: <b>{stats?.total_bipado ?? 0}</b></div>
              <div>Último bipado em: <b>{fmtDateTime(stats?.ultimo_bipado_em ?? null)}</b></div>
            </div>
          </RetroWindow>
        </>
      ) : (
        <>
          <RetroWindow title="Local de estoque (obrigatório)">
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
              {!localId ? <div className="text-xs opacity-80">Selecione um local para bipar.</div> : null}
            </div>
          </RetroWindow>

          <RetroWindow
            title="Scanner"
            rightSlot={
              <RetroBadge tone={busy ? 'warn' : 'info'}>{busy ? 'Processando…' : 'Pronto'}</RetroBadge>
            }
          >
            <div className="space-y-3">
              <div className="relative">
                <ScannerQR
                  modo="continuous"
                  cooldownMs={1200}
                  aoLer={(valor) => {
                    void bipar(valor)
                  }}
                />

                {!localId ? (
                  <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-black bg-white/90 p-4 text-center font-black">
                    Selecione um local
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm">
                <div><b>Último QR:</b> {ultimoQr ? `…${shortId(ultimoQr, 8)}` : '-'}</div>
                <div><b>Total bipado:</b> {stats?.total_bipado ?? 0}</div>
                <div><b>Último:</b> {fmtDateTime(stats?.ultimo_bipado_em ?? null)}</div>
                <div>
                  <b>Local atual:</b>{' '}
                  {localId ? locais.find((l) => l.id === localId)?.nome ?? '-' : '-'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <RetroButton className="w-full py-3" onClick={refetchStats} disabled={busy}>
                  Atualizar total
                </RetroButton>
                <RetroButton className="w-full py-3" onClick={carregar} disabled={busy}>
                  Recarregar tela
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </>
      )}

      {modalFechar && !modoLeitura ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md border-2 border-black bg-white p-4">
            <div className="mb-2 text-base font-black">Fechar contagem</div>

            <div className="space-y-2 text-sm">
              <div>Ao fechar a contagem:</div>
              <ul className="list-disc pl-5">
                <li>Caixas não bipadas serão marcadas como SAÍDA</li>
                <li>O estoque será recalculado</li>
                <li>Essa ação não pode ser desfeita</li>
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              <RetroButton className="w-full py-3" onClick={() => setModalFechar(false)} disabled={busy}>
                Cancelar
              </RetroButton>
              <RetroButton
                variant="danger"
                className="w-full py-3"
                onClick={fecharContagem}
                disabled={busy}
              >
                Confirmar e fechar
              </RetroButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
