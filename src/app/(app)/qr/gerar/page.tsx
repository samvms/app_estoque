'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type Variante = {
  id: string
  sku: string
  nome_exibicao: string
  cor: string
  produto_nome_modelo: string
}

export default function QrGerarPage() {
  const router = useRouter()

  const [variantes, setVariantes] = useState<Variante[]>([])
  const [varianteId, setVarianteId] = useState('')
  const [quantidade, setQuantidade] = useState<number>(24)
  const [loteTexto, setLoteTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const varianteSelecionada = useMemo(
    () => variantes.find(v => v.id === varianteId) ?? null,
    [variantes, varianteId]
  )

  async function carregarVariantes() {
    setErr(null)
    setInfo(null)
    setLoading(true)

    const { data, error } = await supabase.schema('app_estoque').rpc('fn_listar_variantes_ativas')

    setLoading(false)
    setBootLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    const list = (data ?? []) as Variante[]
    setVariantes(list)

    if (list.length === 0) setInfo('Nenhuma variante ativa encontrada.')
  }

  useEffect(() => {
    carregarVariantes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function mapErro(msg: string) {
    if (msg.includes('quantidade_invalida')) return 'Quantidade inválida.'
    if (msg.includes('produto_variante_invalido_ou_inativo')) return 'Variante inválida ou inativa.'
    return msg
  }

  async function gerar() {
    setErr(null)
    setInfo(null)
    setLoading(true)

    try {
      const payload = {
        p_produto_variante_id: varianteId,
        p_quantidade: quantidade,
        p_lote_texto: loteTexto.trim() ? loteTexto.trim() : null,
      }

      const { data, error } = await supabase.schema('app_estoque').rpc('fn_criar_lote_qr', payload)

      if (error) throw error

      const loteId = data as string | null
      if (!loteId) throw new Error('lote_nao_criado')

      router.push(`/qr/lotes/${loteId}`)
    } catch (e: any) {
      setErr(mapErro(e?.message ?? 'erro_inesperado'))
    } finally {
      setLoading(false)
    }
  }

  const podeGerar = !!varianteId && Number.isFinite(quantidade) && quantidade > 0 && !loading

  return (
    <div className="space-y-4">
      <Card
        title="Gerar etiquetas"
        subtitle="Criar lote e imprimir PDF A4"
        rightSlot={
            <div className="flex gap-2">
            <Button onClick={carregarVariantes} variant="ghost">
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Variante</div>
                <select
                  className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                  value={varianteId}
                  onChange={(e) => setVarianteId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {variantes.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.produto_nome_modelo} — {v.nome_exibicao} ({v.sku})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500">Carregado via RPC.</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Quantidade</div>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Lote (texto livre)</div>
                  <input
                    className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                    value={loteTexto}
                    onChange={(e) => setLoteTexto(e.target.value)}
                    placeholder="Ex.: CHINA JAN/2026"
                  />
                </div>
              </div>
            </div>

            {varianteSelecionada ? (
              <Card
                title="Resumo"
                subtitle="Confirme antes de gerar"
                rightSlot={<Badge tone="info">Pronto</Badge>}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StatCard title="Modelo">{varianteSelecionada.produto_nome_modelo}</StatCard>
                  <StatCard title="Variante">{varianteSelecionada.nome_exibicao}</StatCard>
                  <StatCard title="SKU">{varianteSelecionada.sku}</StatCard>
                </div>
              </Card>
            ) : (
              <div className="rounded-2xl border bg-white p-3 text-sm text-slate-600">
                Selecione uma variante para ver o resumo.
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Button onClick={gerar} disabled={!podeGerar} className="w-full py-3">
                {loading ? 'Gerando...' : 'Gerar lote'}
              </Button>
              <Button onClick={() => router.push('/locais')} variant="secondary" className="w-full py-3">
                Ir para Locais
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
