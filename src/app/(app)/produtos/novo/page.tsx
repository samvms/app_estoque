'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button } from '@/modules/shared/ui/primitives'

function toNumOrNull(v: string): number | null {
  const s = (v ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

function canonSku(s: string) {
  return (s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_.]/g, '')
}

export default function ProdutoNovoPage() {
  const router = useRouter()

  // base
  const [nomeModelo, setNomeModelo] = useState('')
  const [sku, setSku] = useState('')
  const [variacao, setVariacao] = useState('')

  // logística (opcional)
  const [pesoBrutoKg, setPesoBrutoKg] = useState('')
  const [pesoLiquidoKg, setPesoLiquidoKg] = useState('')
  const [comprimentoCm, setComprimentoCm] = useState('')
  const [larguraCm, setLarguraCm] = useState('')
  const [alturaCm, setAlturaCm] = useState('')
  const [valorDeclarado, setValorDeclarado] = useState('')

  // fiscal/barcode (opcional)
  const [gtin, setGtin] = useState('')
  const [ncm, setNcm] = useState('')
  const [uom, setUom] = useState('UN')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const skuCanon = useMemo(() => canonSku(sku), [sku])

  const disabled = useMemo(() => {
    if (loading) return true
    if (!nomeModelo.trim()) return true
    if (!skuCanon) return true
    if (!variacao.trim()) return true

    // validações leves (se preenchido, precisa ser número > 0)
    const pb = toNumOrNull(pesoBrutoKg)
    if (pesoBrutoKg.trim() && (!pb || pb <= 0)) return true

    const pl = toNumOrNull(pesoLiquidoKg)
    if (pesoLiquidoKg.trim() && (!pl || pl <= 0)) return true

    const c = toNumOrNull(comprimentoCm)
    if (comprimentoCm.trim() && (!c || c <= 0)) return true

    const l = toNumOrNull(larguraCm)
    if (larguraCm.trim() && (!l || l <= 0)) return true

    const a = toNumOrNull(alturaCm)
    if (alturaCm.trim() && (!a || a <= 0)) return true

    const vd = toNumOrNull(valorDeclarado)
    if (valorDeclarado.trim() && (vd === null || vd < 0)) return true

    if (uom.trim() && uom.trim().length > 8) return true

    return false
  }, [
    loading,
    nomeModelo,
    skuCanon,
    variacao,
    pesoBrutoKg,
    pesoLiquidoKg,
    comprimentoCm,
    larguraCm,
    alturaCm,
    valorDeclarado,
    uom,
  ])

  const cubagemPreview = useMemo(() => {
    const c = toNumOrNull(comprimentoCm)
    const l = toNumOrNull(larguraCm)
    const a = toNumOrNull(alturaCm)
    if (!c || !l || !a) return null
    const m3 = (c * l * a) / 1_000_000
    return m3
  }, [comprimentoCm, larguraCm, alturaCm])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return

    setErro(null)
    setLoading(true)

    const args = {
      p_nome_modelo: nomeModelo.trim(),
      p_sku: skuCanon,
      p_variacao: variacao.trim(),

      p_peso_bruto_kg: toNumOrNull(pesoBrutoKg),
      p_peso_liquido_kg: toNumOrNull(pesoLiquidoKg),
      p_comprimento_cm: toNumOrNull(comprimentoCm),
      p_largura_cm: toNumOrNull(larguraCm),
      p_altura_cm: toNumOrNull(alturaCm),
      p_valor_declarado: toNumOrNull(valorDeclarado),

      p_gtin: gtin.trim() ? gtin.trim() : null,
      p_ncm: ncm.trim() ? ncm.trim() : null,
      p_uom: uom.trim() ? uom.trim().toUpperCase() : 'UN',
    }

    const { error } = await supabase.schema('lws').rpc('fn_criar_produto_e_variante', args)

    setLoading(false)

    if (error) {
      setErro(error.message ?? 'erro_ao_criar')
      return
    }

    router.replace('/produtos')
    router.refresh()
  }

  return (
    <Card title="Cadastrar produto" subtitle="Modelo + SKU (com dados mínimos para frete)" className="max-w-md mx-auto">
      <form onSubmit={salvar} className="space-y-5">
        {/* Básico */}
        <div className="space-y-3">
          <div className="text-xs font-extrabold text-app-muted tracking-wide">Básico</div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">Nome do modelo</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              placeholder="Ex.: Scooter 350"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">SKU</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ex.: SC350PRETO"
              disabled={loading}
              required
            />
            <div className="text-[11px] text-app-muted">
              SKU final: <span className="font-mono font-semibold">{skuCanon || '—'}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">Variação</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={variacao}
              onChange={(e) => setVariacao(e.target.value)}
              placeholder="Ex.: Preto"
              disabled={loading}
              required
            />
          </div>
        </div>

        {/* Logística */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-app-muted tracking-wide">Logística (frete)</div>
            {cubagemPreview !== null ? (
              <div className="text-[11px] font-semibold text-app-muted">
                Cubagem: <span className="font-mono">{cubagemPreview.toFixed(6)} m³</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Peso bruto (kg)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={pesoBrutoKg}
                onChange={(e) => setPesoBrutoKg(e.target.value)}
                placeholder="Ex.: 18.500"
                inputMode="decimal"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Peso líquido (kg) (opcional)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={pesoLiquidoKg}
                onChange={(e) => setPesoLiquidoKg(e.target.value)}
                placeholder="Ex.: 16.800"
                inputMode="decimal"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Comprimento (cm)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={comprimentoCm}
                onChange={(e) => setComprimentoCm(e.target.value)}
                placeholder="Ex.: 120"
                inputMode="decimal"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Largura (cm)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={larguraCm}
                onChange={(e) => setLarguraCm(e.target.value)}
                placeholder="Ex.: 28"
                inputMode="decimal"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Altura (cm)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={alturaCm}
                onChange={(e) => setAlturaCm(e.target.value)}
                placeholder="Ex.: 55"
                inputMode="decimal"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">Valor declarado (R$) (opcional)</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={valorDeclarado}
              onChange={(e) => setValorDeclarado(e.target.value)}
              placeholder="Ex.: 3499.90"
              inputMode="decimal"
              disabled={loading}
            />
            <div className="text-[11px] text-app-muted">
              Usado para seguro/indenização e taxas por valor em algumas transportadoras.
            </div>
          </div>
        </div>

        {/* Fiscal / Barcode */}
        <div className="space-y-3">
          <div className="text-xs font-extrabold text-app-muted tracking-wide">Fiscal / Código de barras (opcional)</div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">GTIN/EAN</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                placeholder="Ex.: 7891234567890"
                inputMode="numeric"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">NCM</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="Ex.: 87116000"
                inputMode="numeric"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">Unidade (UOM)</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="UN"
              disabled={loading}
            />
          </div>
        </div>

        {erro ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Erro</div>
            <div className="mt-0.5 text-xs text-red-700/80">{erro}</div>
          </div>
        ) : null}

        <div className="space-y-2 pt-2">
          <Button type="submit" className="w-full py-3 text-sm" disabled={disabled} loading={loading}>
            Salvar
          </Button>

          <Button type="button" variant="secondary" className="w-full py-3 text-sm" disabled={loading} onClick={() => router.back()}>
            Voltar
          </Button>
        </div>
      </form>
    </Card>
  )
}
