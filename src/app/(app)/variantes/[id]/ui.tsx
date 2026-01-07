'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

type Form = {
  id: string
  produto_id: string
  produto_nome: string
  sku: string
  variacao: string
  nome_exibicao: string | null
  ativo: boolean

  gtin: string | null
  ncm: string | null
  uom: string
  peso_liquido_kg: number | null
  peso_bruto_kg: number | null
  comprimento_cm: number | null
  largura_cm: number | null
  altura_cm: number | null
  cubagem_m3: number | null
  valor_declarado: number | null
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v ?? '')
}

function toNumOrNull(v: string) {
  const t = (v ?? '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function cleanText(v: any) {
  const t = String(v ?? '').trim()
  return t ? t : null
}

function friendlyError(msg?: string) {
  const m = (msg ?? '').toLowerCase()
  if (m.includes('peso_bruto_menor_que_liquido')) return 'Peso bruto não pode ser menor que o peso líquido.'
  if (m.includes('variacao_obrigatoria')) return 'Variação é obrigatória.'
  if (m.includes('variante_nao_encontrada')) return 'Variante não encontrada.'
  if (m.includes('empresa_nao_definida')) return 'Empresa não definida na sessão (contexto).'
  if (m.includes('nao_autenticado')) return 'Sessão expirada. Faça login novamente.'
  return msg ?? 'Erro.'
}

export default function VariantesDetalheClient({ id }: { id: string }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)

  async function carregar() {
    setLoading(true)
    setErr(null)

    if (!isUuid(id)) {
      setLoading(false)
      setForm(null)
      setErr('ID da variante inválido.')
      return
    }

    const { data, error } = await supabase.schema('lws').rpc('fn_obter_variante', { p_variante_id: id })

    if (error) {
      setLoading(false)
      setForm(null)
      setErr(friendlyError(error.message ?? 'Erro ao carregar.'))
      return
    }

    const row = (Array.isArray(data) ? data[0] : data) as any
    if (!row?.id) {
      setLoading(false)
      setForm(null)
      setErr('Variante não encontrada.')
      return
    }

    setForm({
      id: row.id,
      produto_id: row.produto_id,
      produto_nome: row.produto_nome,
      sku: row.sku ?? '',
      variacao: row.variacao ?? '',
      nome_exibicao: row.nome_exibicao ?? null,
      ativo: Boolean(row.ativo),

      gtin: row.gtin ?? null,
      ncm: row.ncm ?? null,
      uom: row.uom ?? 'UN',
      peso_liquido_kg: row.peso_liquido_kg ?? null,
      peso_bruto_kg: row.peso_bruto_kg ?? null,
      comprimento_cm: row.comprimento_cm ?? null,
      largura_cm: row.largura_cm ?? null,
      altura_cm: row.altura_cm ?? null,
      cubagem_m3: row.cubagem_m3 ?? null,
      valor_declarado: row.valor_declarado ?? null,
    })

    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const disabled = useMemo(() => {
    if (!form) return true
    if (saving) return true
    if (!String(form.variacao ?? '').trim()) return true
    if (!String(form.uom ?? '').trim()) return true
    if (form.peso_bruto_kg != null && form.peso_liquido_kg != null && form.peso_bruto_kg < form.peso_liquido_kg) {
      return true
    }
    return false
  }, [form, saving])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form || disabled) return

    setSaving(true)
    setErr(null)

    const { error } = await supabase.schema('lws').rpc('fn_atualizar_variante', {
      p_variante_id: form.id,
      p_variacao: form.variacao.trim(),
      p_nome_exibicao: cleanText(form.nome_exibicao),
      p_ativo: form.ativo,
      p_gtin: cleanText(form.gtin),
      p_ncm: cleanText(form.ncm),
      p_uom: cleanText(form.uom) ?? 'UN',
      p_peso_liquido_kg: form.peso_liquido_kg,
      p_peso_bruto_kg: form.peso_bruto_kg,
      p_comprimento_cm: form.comprimento_cm,
      p_largura_cm: form.largura_cm,
      p_altura_cm: form.altura_cm,
      p_valor_declarado: form.valor_declarado,
    })

    setSaving(false)

    if (error) {
      setErr(friendlyError(error.message ?? 'Erro ao salvar.'))
      return
    }

    await carregar()
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="app-card px-5 py-4 text-sm text-app-muted">Carregando…</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card
        title="Variante"
        subtitle={form ? `${form.produto_nome} • ${form.sku}` : ''}
        rightSlot={<Badge tone={form?.ativo ? 'ok' : 'warn'}>{form?.ativo ? 'Ativo' : 'Inativo'}</Badge>}
      >
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
            <div className="text-sm font-semibold text-red-600">Erro</div>
            <div className="mt-0.5 text-xs text-red-700/80">{err}</div>
          </div>
        ) : null}

        {!form ? (
          <div className="text-sm text-app-muted">Variante não encontrada.</div>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="app-card px-3 py-2">
                <div className="text-[11px] font-semibold text-app-muted">SKU (somente leitura)</div>
                <div className="mt-1 w-full text-sm font-extrabold">
                  <span className="font-mono">{form.sku}</span>
                </div>
              </div>

              <div className="app-card px-3 py-2">
                <div className="text-[11px] font-semibold text-app-muted">Variação</div>
                <input
                  value={form.variacao}
                  onChange={(e) => setForm((s) => (s ? { ...s, variacao: e.target.value } : s))}
                  className="mt-1 w-full bg-transparent text-sm font-extrabold outline-none"
                  placeholder="Ex.: Preto"
                />
              </div>

              <div className="app-card px-3 py-2 md:col-span-2">
                <div className="text-[11px] font-semibold text-app-muted">Descrição (opcional)</div>
                <input
                  value={form.nome_exibicao ?? ''}
                  onChange={(e) => setForm((s) => (s ? { ...s, nome_exibicao: e.target.value } : s))}
                  className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                  placeholder="Ex.: Scooter 350 • Preto Fosco"
                />
              </div>
            </div>

            <div className="app-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Frete e fiscal</div>
                  <div className="text-xs text-app-muted mt-0.5">Campos opcionais para TMS/cotação.</div>
                </div>

                <label className="text-sm font-semibold flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm((s) => (s ? { ...s, ativo: e.target.checked } : s))}
                  />
                  Ativo
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">Unidade (UOM)</div>
                  <select
                    value={form.uom}
                    onChange={(e) => setForm((s) => (s ? { ...s, uom: e.target.value } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                  >
                    <option value="UN">UN</option>
                    <option value="PC">PC</option>
                    <option value="CX">CX</option>
                    <option value="KG">KG</option>
                    <option value="LT">LT</option>
                    <option value="M">M</option>
                    <option value="M2">M2</option>
                    <option value="M3">M3</option>
                  </select>
                </div>

                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">GTIN/EAN (opcional)</div>
                  <input
                    value={form.gtin ?? ''}
                    onChange={(e) => setForm((s) => (s ? { ...s, gtin: e.target.value } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                    placeholder="Ex.: 789..."
                    inputMode="numeric"
                  />
                </div>

                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">NCM (opcional)</div>
                  <input
                    value={form.ncm ?? ''}
                    onChange={(e) => setForm((s) => (s ? { ...s, ncm: e.target.value } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                    placeholder="Ex.: 87116000"
                  />
                </div>

                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">Valor declarado (R$)</div>
                  <input
                    value={form.valor_declarado ?? ''}
                    onChange={(e) => setForm((s) => (s ? { ...s, valor_declarado: toNumOrNull(e.target.value) } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                    placeholder="Ex.: 3499,90"
                    inputMode="decimal"
                  />
                </div>

                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">Peso líquido (kg)</div>
                  <input
                    value={form.peso_liquido_kg ?? ''}
                    onChange={(e) => setForm((s) => (s ? { ...s, peso_liquido_kg: toNumOrNull(e.target.value) } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                    placeholder="Ex.: 18,500"
                    inputMode="decimal"
                  />
                </div>

                <div className="app-card px-3 py-2">
                  <div className="text-[11px] font-semibold text-app-muted">Peso bruto (kg)</div>
                  <input
                    value={form.peso_bruto_kg ?? ''}
                    onChange={(e) => setForm((s) => (s ? { ...s, peso_bruto_kg: toNumOrNull(e.target.value) } : s))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                    placeholder="Ex.: 22,300"
                    inputMode="decimal"
                  />
                  {form.peso_bruto_kg != null &&
                  form.peso_liquido_kg != null &&
                  form.peso_bruto_kg < form.peso_liquido_kg ? (
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--app-danger)' }}>
                      Peso bruto não pode ser menor que líquido.
                    </div>
                  ) : null}
                </div>

                <div className="app-card px-3 py-2 md:col-span-2">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-app-muted">Dimensões (cm)</div>
                      <div className="text-[11px] text-app-muted mt-0.5">C × L × A</div>
                    </div>

                    <div className="text-[11px] font-semibold text-app-muted">
                      Cubagem (m³): <span className="font-mono">{form.cubagem_m3 ?? '—'}</span>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      value={form.comprimento_cm ?? ''}
                      onChange={(e) => setForm((s) => (s ? { ...s, comprimento_cm: toNumOrNull(e.target.value) } : s))}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      placeholder="C"
                      inputMode="decimal"
                    />
                    <input
                      value={form.largura_cm ?? ''}
                      onChange={(e) => setForm((s) => (s ? { ...s, largura_cm: toNumOrNull(e.target.value) } : s))}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      placeholder="L"
                      inputMode="decimal"
                    />
                    <input
                      value={form.altura_cm ?? ''}
                      onChange={(e) => setForm((s) => (s ? { ...s, altura_cm: toNumOrNull(e.target.value) } : s))}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      placeholder="A"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2 md:justify-end">
              <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
                Voltar
              </Button>
              <Button type="submit" variant="primary" disabled={disabled} loading={saving}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
