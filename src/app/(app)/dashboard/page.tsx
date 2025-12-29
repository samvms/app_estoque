'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton, RetroBadge } from '@/modules/shared/ui/retro'

type StatusOperacional = {
  contagem_aberta_id: string | null
  contagem_aberta_tipo: 'INICIAL' | 'PERIODICA' | null
  contagem_aberta_iniciada_em: string | null

  recebimento_aberto_id: string | null
  recebimento_aberto_referencia: string | null
  recebimento_aberto_tipo: 'AMOSTRA' | 'TOTAL' | null
  recebimento_aberto_criado_em: string | null

  ultimo_evento_origem: 'CONTAGEM' | 'RECEBIMENTO' | null
  ultimo_evento_em: string | null
}

function fmt(dt: string | null) {
  if (!dt) return '-'
  const d = new Date(dt)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusOperacional | null>(null)

  async function carregar() {
    setErr(null)
    setLoading(true)

    const { data, error } = await supabase
      .schema('app_estoque')
      .rpc('fn_status_operacional')

    setLoading(false)
    setBootLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    const row = Array.isArray(data) ? (data[0] as StatusOperacional | undefined) : undefined
    setStatus(row ?? null)
  }

  useEffect(() => {
    carregar()

    // Recarrega leve quando o usuário volta pro app (muito comum em PWA no celular)
    const onVis = () => {
      if (document.visibilityState === 'visible') carregar()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const temContagemAberta = !!status?.contagem_aberta_id
  const temRecebimentoAberto = !!status?.recebimento_aberto_id

  return (
    <div className="space-y-4">
      <RetroWindow title="Atalhos operacionais" rightSlot={<RetroBadge tone="info">MVP</RetroBadge>}>
        {/* Mobile first: 1 coluna; em md vira 2 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link href="/contagens" prefetch={false}>
            <RetroButton className="w-full py-3">Contagens</RetroButton>
          </Link>
          <Link href="/recebimentos" prefetch={false}>
            <RetroButton className="w-full py-3">Recebimentos</RetroButton>
          </Link>
        </div>
      </RetroWindow>

      <RetroWindow
        title="Status"
        rightSlot={
          <RetroButton onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </RetroButton>
        }
      >
        {err ? <div className="text-sm font-bold text-red-700">{err}</div> : null}

        {/* Mobile first: 1 coluna; em md 2; em lg 3 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="retro-panel">
            <div className="retro-panel__title">Contagem</div>
            <div className="mt-2 text-sm">
              {bootLoading ? (
                <div className="opacity-80">Carregando...</div>
              ) : !temContagemAberta ? (
                <div className="opacity-80">Nenhuma contagem aberta.</div>
              ) : (
                <>
                  <div><b>Status:</b> ABERTA</div>
                  <div><b>Tipo:</b> {status?.contagem_aberta_tipo}</div>
                  <div><b>Iniciada:</b> {fmt(status?.contagem_aberta_iniciada_em)}</div>

                  <div className="mt-2">
                    <Link href={`/contagens/${status!.contagem_aberta_id}`} prefetch={false}>
                      <RetroButton className="w-full py-3">Entrar</RetroButton>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="retro-panel">
            <div className="retro-panel__title">Recebimento</div>
            <div className="mt-2 text-sm">
              {bootLoading ? (
                <div className="opacity-80">Carregando...</div>
              ) : !temRecebimentoAberto ? (
                <div className="opacity-80">Nenhum recebimento aberto.</div>
              ) : (
                <>
                  <div><b>Status:</b> ABERTO</div>
                  <div><b>Tipo:</b> {status?.recebimento_aberto_tipo}</div>
                  <div><b>Ref:</b> {status?.recebimento_aberto_referencia || '-'}</div>
                  <div><b>Criado:</b> {fmt(status?.recebimento_aberto_criado_em)}</div>

                  <div className="mt-2">
                    <Link href={`/recebimentos/${status!.recebimento_aberto_id}`} prefetch={false}>
                      <RetroButton className="w-full py-3">Entrar</RetroButton>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="retro-panel">
            <div className="retro-panel__title">Última bipagem</div>
            <div className="mt-2 text-sm">
              {bootLoading ? (
                <div className="opacity-80">Carregando...</div>
              ) : !status?.ultimo_evento_em ? (
                <div className="opacity-80">Sem registros ainda.</div>
              ) : (
                <>
                  <div><b>Origem:</b> {status?.ultimo_evento_origem}</div>
                  <div><b>Quando:</b> {fmt(status?.ultimo_evento_em)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  )
}
