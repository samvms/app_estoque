'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'
import { RefreshCcw, Sparkles, ArrowLeft, Hash, Tag, Layers } from 'lucide-react'

type Variante = {
  id: string
  sku: string
  nome_exibicao: string
  cor: string
  produto_nome_modelo: string
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ')
}

function normalize(s: any) {
  return String(s ?? '').trim()
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
    () => variantes.find((v) => v.id === varianteId) ?? null,
    [variantes, varianteId]
  )

  async function carregarVariantes() {
    if (loading) return
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
    if (msg.includes('lote_nao_criado')) return 'Não foi possível criar o lote.'
    return msg
  }

  async function gerar() {
    if (!podeGerar) return

    setErr(null)
    setInfo(null)
    setLoading(true)

    try {
      const payload = {
        p_produto_variante_id: varianteId,
        p_quantidade: quantidade,
        p_lote_texto: normalize(loteTexto) ? normalize(loteTexto) : null,
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

  const podeGerar =
    !!varianteId && Number.isFinite(quantidade) && quantidade > 0 && !loading && !bootLoading

  const quantidadeHint = useMemo(() => {
    if (!Number.isFinite(quantidade) || quantidade <= 0) return 'Informe um número maior que zero.'
    if (quantidade > 5000) return 'Quantidade alta. Considere gerar em lotes menores para impressão.'
    return 'Sugestão comum: 24 por folha (3x8).'
  }, [quantidade])

  return (
    <div className="space-y-4">
      <Card
        title="Gerar etiquetas"
        subtitle="Crie um lote e siga direto para impressão (PDF A4)."
        rightSlot={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={carregarVariantes} disabled={loading}>
              <RefreshCcw size={16} className={cx('mr-2', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        }
      >
        {/* Alerts */}
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {err}
          </div>
        ) : null}

        {info ? (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {info}
          </div>
        ) : null}

        {bootLoading ? (
          <div className="opacity-70">Carregando…</div>
        ) : (
          <div className="space-y-4">
            {/* Form card */}
            <div className="rounded-2xl border border-app-border bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Variante */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Variante</div>

                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-2xl border border-app-border bg-white px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      value={varianteId}
                      onChange={(e) => setVarianteId(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {variantes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.produto_nome_modelo} — {v.nome_exibicao} ({v.sku})
                        </option>
                      ))}
                    </select>

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60">
                      <Layers size={16} />
                    </span>
                  </div>

                  <div className="text-xs text-slate-500">Carregado via RPC.</div>
                </div>

                {/* Quantidade + Lote */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Hash size={16} className="opacity-70" />
                      Quantidade
                    </div>

                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-app-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      value={quantidade}
                      onChange={(e) => setQuantidade(Number(e.target.value))}
                    />

                    <div className="text-xs text-slate-500">{quantidadeHint}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Tag size={16} className="opacity-70" />
                      Lote (texto)
                    </div>

                    <input
                      className="w-full rounded-2xl border border-app-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      value={loteTexto}
                      onChange={(e) => setLoteTexto(e.target.value)}
                      placeholder="Ex.: CHINA JAN/2026"
                    />

                    <div className="text-xs text-slate-500">Obrigatório. Ajuda na operação e auditoria.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            {varianteSelecionada ? (
              <Card
                title="Prévia"
                subtitle="Confira antes de gerar."
                rightSlot={<Badge tone="ok">Pronto</Badge>}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <StatCard title="Modelo">{varianteSelecionada.produto_nome_modelo}</StatCard>
                  <StatCard title="Variação">{varianteSelecionada.cor}</StatCard>
                  <StatCard title="SKU">{varianteSelecionada.sku}</StatCard>
                  <StatCard title="Qtde">{quantidade}</StatCard>
                </div>

                {normalize(loteTexto) ? (
                  <div className="mt-3 rounded-2xl border border-app-border bg-white px-4 py-3">
                    <div className="text-xs text-slate-500">Lote</div>
                    <div className="mt-1 font-semibold">{normalize(loteTexto)}</div>
                  </div>
                ) : null}
              </Card>
            ) : (
              <div className="rounded-2xl border border-app-border bg-white px-4 py-3 text-sm text-slate-600">
                Selecione uma variante para ver a prévia.
              </div>
            )}

            {/* Actions */}
            <div className="rounded-2xl border border-app-border bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600">
                  Ao gerar, você será direcionado para o lote para imprimir o PDF.
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => router.push('/qr/lotes')} disabled={loading}>
                    Ver lotes
                  </Button>

                  <Button
                    onClick={gerar}
                    disabled={!podeGerar}
                    className="min-w-[180px] flex items-center justify-center gap-2"
                  >
                    
                    {loading ? 'Gerando…' : 'Gerar etiquetas'}
                  </Button>

                </div>
              </div>
            </div>

            {/* Footnote */}
            <div className="text-xs text-slate-500">
              Regra: geração cria um lote + N etiquetas (UUID) com status <b>DISPONÍVEL</b>.
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
