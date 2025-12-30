'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type LinhaCsv = {
  nome_modelo?: string
  sku?: string
  cor?: string
}

type ItemImport = {
  nome_modelo: string
  sku: string
  cor: string
}

const MAX_BYTES = 1 * 1024 * 1024 // 1MB
const MAX_LINHAS = 5000

function normalize(s: any) {
  return String(s ?? '').trim()
}

function normalizeHeader(s: any) {
  // remove BOM + trim + lowercase
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

export default function ImportarProdutosPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ItemImport[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const preview = useMemo(() => rows.slice(0, 10), [rows])

  function validarObrigatorios(item: ItemImport, idx: number) {
    if (!item.nome_modelo) return `Linha ${idx + 2}: nome_modelo obrigatório`
    if (!item.sku) return `Linha ${idx + 2}: sku obrigatório`
    if (!item.cor) return `Linha ${idx + 2}: cor obrigatória`
    return null
  }

  function resetFile() {
    if (inputRef.current) inputRef.current.value = ''
    setFileName(null)
    setRows([])
  }

  async function onPickFile(file: File | null) {
    setErr(null)
    setInfo(null)
    setRows([])
    setFileName(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErr('Arquivo inválido. Envie um CSV.')
      return
    }

    if (file.size > MAX_BYTES) {
      setErr(`Arquivo muito grande. Máximo: ${Math.floor(MAX_BYTES / 1024)}KB.`)
      return
    }

    setFileName(file.name)

    const text = await file.text()

    Papa.parse<LinhaCsv>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => normalizeHeader(h),
      complete: (res) => {
        if (res.errors?.length) {
            const first = res.errors[0]
            const line =
                typeof first.row === 'number' ? first.row + 1 : 'desconhecida'

            setErr(`Falha ao ler CSV (${first.code}) na linha ${line}.`)
            return
        }


        const data = (res.data ?? []) as LinhaCsv[]

        if (data.length === 0) {
          setErr('CSV vazio.')
          return
        }

        if (data.length > MAX_LINHAS) {
          setErr(`Muitas linhas. Máximo: ${MAX_LINHAS}.`)
          return
        }

        const fields = (res.meta.fields ?? []).map(normalizeHeader)
        const required = ['nome_modelo', 'sku', 'cor']
        const missing = required.filter((k) => !fields.includes(k))

        if (missing.length) {
          setErr(`Cabeçalhos inválidos. Faltando: ${missing.join(', ')}. Obrigatório: nome_modelo, sku, cor.`)
          return
        }

        const normalized: ItemImport[] = data.map((r) => ({
          nome_modelo: normalize(r.nome_modelo),
          sku: normalize(r.sku).toUpperCase(),
          cor: normalize(r.cor),
        }))

        for (let i = 0; i < normalized.length; i++) {
          const v = validarObrigatorios(normalized[i], i)
          if (v) {
            setErr(v)
            return
          }
        }

        setRows(normalized)
        setInfo(`Arquivo pronto: ${normalized.length} linhas.`)
      },
      error: () => setErr('Falha ao ler CSV.'),
    })
  }

  async function importar() {
    setErr(null)
    setInfo(null)
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_importar_produtos_csv', { p_itens: rows })

      if (error) throw error

      const row = (Array.isArray(data) ? data[0] : null) as any
      const msg = row
        ? `Importação concluída. Linhas: ${row.total_linhas}. Variantes inseridas: ${row.variantes_inseridas}. SKUs ignorados: ${row.skus_ignorados}.`
        : 'Importação concluída.'

      setInfo(msg)
      resetFile()
    } catch (e: any) {
      setErr(e?.message ?? 'erro_inesperado')
    } finally {
      setLoading(false)
    }
  }

  const podeImportar = rows.length > 0 && !loading

  return (
    <div className="space-y-4">
      <Card
        title="Importar produtos (CSV)"
        subtitle="Upload local. O arquivo não é salvo."
        rightSlot={
          <div className="flex gap-2">
            <Button onClick={() => router.push('/produtos')} variant="secondary">
              Produtos
            </Button>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
              Dashboard
            </Button>
          </div>
        }
      >
        {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}
        {info ? <div className="text-sm font-semibold text-slate-600">{info}</div> : null}

        <div className="space-y-3">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">Arquivo CSV</div>
                <div className="mt-1 text-sm text-slate-600">
                  Colunas obrigatórias: <span className="font-mono">nome_modelo, sku, cor</span>
                </div>
              </div>
              <Badge tone="info">MVP</Badge>
            </div>

            {/* Upload no "novo brand": input escondido + botões reais */}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />

              <Button
                onClick={() => inputRef.current?.click()}
                variant="secondary"
                className="w-full py-3"
                disabled={loading}
              >
                Selecionar CSV
              </Button>

              <Button onClick={resetFile} variant="ghost" className="w-full py-3" disabled={loading && rows.length > 0}>
                Limpar
              </Button>

              <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {fileName ? (
                  <div className="truncate">
                    <span className="font-semibold">Selecionado:</span> <span className="font-mono">{fileName}</span>
                  </div>
                ) : (
                  <div className="opacity-70">Nenhum arquivo selecionado</div>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Linhas">{rows.length}</StatCard>
              <StatCard title="Limite linhas">{MAX_LINHAS}</StatCard>
              <StatCard title="Limite arquivo">{Math.floor(MAX_BYTES / 1024)}KB</StatCard>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Button onClick={importar} disabled={!podeImportar} className="w-full py-3">
                {loading ? 'Importando...' : 'Importar'}
              </Button>
              <Button onClick={() => router.push('/qr')} variant="secondary" className="w-full py-3">
                QR
              </Button>
            </div>
          </div>

          <Card title="Prévia" subtitle="Primeiras 10 linhas" rightSlot={<Badge tone="info">{preview.length}</Badge>}>
            {rows.length === 0 ? (
              <div className="opacity-70">Envie um CSV para ver a prévia.</div>
            ) : (
              <div className="space-y-2">
                {preview.map((r, i) => (
                  <div key={`${r.sku}-${i}`} className="rounded-2xl border bg-white p-3">
                    <div className="text-sm font-semibold">{r.nome_modelo}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {r.cor} • <span className="font-mono">{r.sku}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Card>
    </div>
  )
}
