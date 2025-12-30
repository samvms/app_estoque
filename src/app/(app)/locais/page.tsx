'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type Local = { id: string; nome: string; ativo: boolean }

export default function LocaisPage() {
  const router = useRouter()

  const [locais, setLocais] = useState<Local[]>([])
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const ativos = useMemo(() => locais.filter(l => l.ativo), [locais])
  const inativos = useMemo(() => locais.filter(l => !l.ativo), [locais])

  function mapErro(msg: string) {
    if (msg.includes('nome_obrigatorio')) return 'Nome é obrigatório.'
    if (msg.includes('local_invalido')) return 'Local inválido.'
    return msg
  }

  async function carregar() {
    setErr(null)
    setInfo(null)
    setLoading(true)

    const { data, error } = await supabase.schema('app_estoque').rpc('fn_listar_locais')

    setLoading(false)
    setBootLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    const list = (data ?? []) as any as Local[]
    setLocais(list)

    if (list.length === 0) setInfo('Nenhum local cadastrado.')
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function criar() {
    setErr(null)
    setInfo(null)

    const nomeOk = nome.trim()
    if (!nomeOk) {
      setErr('Nome é obrigatório.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.schema('app_estoque').rpc('fn_criar_local', { p_nome: nomeOk })
      if (error) throw error

      setNome('')
      await carregar()
    } catch (e: any) {
      setErr(mapErro(e?.message ?? 'erro_inesperado'))
    } finally {
      setLoading(false)
    }
  }

  async function setAtivo(localId: string, ativo: boolean) {
    setErr(null)
    setLoading(true)
    try {
      const { error } = await supabase
        .schema('app_estoque')
        .rpc('fn_definir_local_ativo', { p_local_id: localId, p_ativo: ativo })

      if (error) throw error
      await carregar()
    } catch (e: any) {
      setErr(mapErro(e?.message ?? 'erro_inesperado'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Locais"
        subtitle="Criar, ativar e desativar locais"
        rightSlot={
            <div className="flex gap-2">
            <Button onClick={carregar} variant="ghost">
                Atualizar
            </Button>
            <Button onClick={() => router.push('/qr')} variant="secondary">
                QR
            </Button>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
                Dashboard
            </Button>
            </div>
        }
    >

        {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}
        {info ? <div className="text-sm font-semibold text-slate-600">{info}</div> : null}

        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Ativos">{ativos.length}</StatCard>
              <StatCard title="Inativos">{inativos.length}</StatCard>
              <StatCard title="Total">{locais.length}</StatCard>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold">Novo local</div>
                  <div className="mt-1 text-sm text-slate-600">Ex.: Galpão A</div>
                </div>
                <Badge tone="info">MVP</Badge>
              </div>

              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <input
                  className="flex-1 rounded-2xl border bg-white px-3 py-3 text-sm"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do local"
                />
                <Button onClick={criar} disabled={loading} className="py-3 md:w-40">
                  {loading ? 'Criando...' : 'Criar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Ativos"
        subtitle="Locais disponíveis para bipagem"
        rightSlot={<Badge tone="info">{ativos.length}</Badge>}
      >
        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : ativos.length === 0 ? (
          <div className="opacity-70">Nenhum local ativo.</div>
        ) : (
          <div className="space-y-2">
            {ativos.map(l => (
              <div key={l.id} className="rounded-2xl border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{l.nome}</div>
                    <div className="mt-1 font-mono text-xs break-all text-slate-500">{l.id}</div>
                  </div>
                  <Button onClick={() => setAtivo(l.id, false)} disabled={loading} variant="ghost">
                    Desativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Inativos"
        subtitle="Locais desativados (não aparecem na operação)"
        rightSlot={<Badge tone="info">{inativos.length}</Badge>}
      >
        {bootLoading ? (
          <div className="opacity-70">Carregando...</div>
        ) : inativos.length === 0 ? (
          <div className="opacity-70">Nenhum local inativo.</div>
        ) : (
          <div className="space-y-2">
            {inativos.map(l => (
              <div key={l.id} className="rounded-2xl border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{l.nome}</div>
                    <div className="mt-1 font-mono text-xs break-all text-slate-500">{l.id}</div>
                  </div>
                  <Button onClick={() => setAtivo(l.id, true)} disabled={loading} variant="secondary">
                    Ativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
