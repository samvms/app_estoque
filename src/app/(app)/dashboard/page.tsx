'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

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
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusOperacional | null>(null)

  async function carregar() {
    setErr(null)
    setLoading(true)

    const { data, error } = await supabase.schema('app_estoque').rpc('fn_status_operacional')

    setLoading(false)
    setBootLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    const row = Array.isArray(data) ? (data[0] as StatusOperacional | undefined) : undefined
    setStatus(row ?? null)
  }

  async function logout() {
    setErr(null)
    setLoading(true)

    const { error } = await supabase.auth.signOut()

    setLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    carregar()
    const onVis = () => {
      if (document.visibilityState === 'visible') carregar()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const temContagemAberta = !!status?.contagem_aberta_id
  const temRecebimentoAberto = !!status?.recebimento_aberto_id

  return (
    <div className="space-y-4">
      <Card title="Atalhos operacionais" subtitle="Acesso rápido às operações" rightSlot={<Badge tone="info">MVP</Badge>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link href="/contagens" prefetch={false}>
            <Button className="w-full py-3">Contagens</Button>
          </Link>

          <Link href="/recebimentos" prefetch={false}>
            <Button className="w-full py-3" variant="secondary">
              Recebimentos
            </Button>
          </Link>

          {/* NOVO */}
          <Link href="/produtos" prefetch={false}>
            <Button className="w-full py-3" variant="secondary">
              Estoque
            </Button>
          </Link>

          <Link href="/qr/gerar" prefetch={false}>
            <Button className="w-full py-3" variant="ghost">
              Gerar QR (lote)
            </Button>
          </Link>

          <Link href="/locais" prefetch={false}>
            <Button className="w-full py-3" variant="ghost">
              Locais
            </Button>
          </Link>
        </div>
      </Card>

      <Card
        title="Status"
        subtitle="Situação operacional atual"
        rightSlot={
          <div className="flex gap-2">
            <Button onClick={carregar} disabled={loading} variant="ghost">
              {loading ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button onClick={logout} disabled={loading} variant="danger">
              Sair
            </Button>
          </div>
        }
      >
        {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Contagem">
            {bootLoading ? (
              <div className="opacity-70">Carregando...</div>
            ) : !temContagemAberta ? (
              <div className="opacity-70">Nenhuma contagem aberta.</div>
            ) : (
              <div className="space-y-1">
                <div>
                  <b>Status:</b> ABERTA
                </div>
                <div>
                  <b>Tipo:</b> {status?.contagem_aberta_tipo}
                </div>
                <div>
                  <b>Iniciada:</b> {fmt(status?.contagem_aberta_iniciada_em)}
                </div>

                <div className="pt-2">
                  <Link href={`/contagens/${status!.contagem_aberta_id}`} prefetch={false}>
                    <Button className="w-full py-3">Entrar</Button>
                  </Link>
                </div>
              </div>
            )}
          </StatCard>

          <StatCard title="Recebimento">
            {bootLoading ? (
              <div className="opacity-70">Carregando...</div>
            ) : !temRecebimentoAberto ? (
              <div className="opacity-70">Nenhum recebimento aberto.</div>
            ) : (
              <div className="space-y-1">
                <div>
                  <b>Status:</b> ABERTO
                </div>
                <div>
                  <b>Tipo:</b> {status?.recebimento_aberto_tipo}
                </div>
                <div>
                  <b>Ref:</b> {status?.recebimento_aberto_referencia || '-'}
                </div>
                <div>
                  <b>Criado:</b> {fmt(status?.recebimento_aberto_criado_em)}
                </div>

                <div className="pt-2">
                  <Link href={`/recebimentos/${status!.recebimento_aberto_id}`} prefetch={false}>
                    <Button className="w-full py-3" variant="secondary">
                      Entrar
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </StatCard>

          <StatCard title="Última bipagem">
            {bootLoading ? (
              <div className="opacity-70">Carregando...</div>
            ) : !status?.ultimo_evento_em ? (
              <div className="opacity-70">Sem registros ainda.</div>
            ) : (
              <div className="space-y-1">
                <div>
                  <b>Origem:</b> {status?.ultimo_evento_origem}
                </div>
                <div>
                  <b>Quando:</b> {fmt(status?.ultimo_evento_em)}
                </div>
              </div>
            )}
          </StatCard>
        </div>
      </Card>
    </div>
  )
}
