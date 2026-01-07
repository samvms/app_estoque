// FILE: src/app/(app)/produtos/importar/page.tsx
'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge, StatCard } from '@/modules/shared/ui/app'

type LinhaCsv = {
  nome_modelo?: string
  sku?: string
  variacao?: string
}


type ItemImport = {
  nome_modelo: string
  sku: string
  variacao: string
}

type ToastTone = 'success' | 'error' | 'warn'
type ToastState = { open: boolean; tone: ToastTone; title: string; message?: string }

const MAX_BYTES = 1 * 1024 * 1024 // 1MB
const MAX_LINHAS = 5000
const RPC_IMPORT = 'fn_importar_produtos_csv' // Ctrl+F: RPC_IMPORT

function normalize(s: any) {
  return String(s ?? '').trim()
}

function normalizeHeader(s: any) {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

function bytesToKB(b: number) {
  return Math.floor(b / 1024)
}

function canonSku(s: any) {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function downloadTemplate() {
  const csv = ['nome_modelo,sku,variacao', 'Scooter 350,SC350PRETO,PRETO', 'Scooter 350,SC350AZUL,AZUL'].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-importacao-produtos.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Toast({ state, onClose }: { state: ToastState; onClose: () => void }) {
  if (!state.open) return null

  const border =
    state.tone === 'success'
      ? 'rgba(31,122,90,.30)'
      : state.tone === 'warn'
      ? 'rgba(194,65,12,.28)'
      : 'rgba(194,65,12,.35)'

  const bg =
    state.tone === 'success'
      ? 'rgba(31,122,90,.10)'
      : state.tone === 'warn'
      ? 'rgba(194,65,12,.10)'
      : 'rgba(194,65,12,.12)'

  return (
    <div className="fixed top-4 right-4 z-[9999] w-[min(420px,calc(100vw-24px))]">
      <div className="app-card px-4 py-3" style={{ borderColor: border, background: bg }} role="status" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-app-fg">{state.title}</div>
            {state.message ? <div className="mt-1 text-sm text-app-muted">{state.message}</div> : null}
          </div>
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }} aria-label="Fechar">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ImportarProdutosPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [toast, setToast] = useState<ToastState>({ open: false, tone: 'success', title: '', message: '' })
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ItemImport[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const preview = useMemo(() => rows.slice(0, 10), [rows])

  const duplicatedSkus = useMemo(() => {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const it of rows) {
      const k = canonSku(it.sku)
      if (!k) continue
      if (seen.has(k)) dup.add(k)
      else seen.add(k)
    }
    return Array.from(dup.values()).sort()
  }, [rows])

  function showToast(tone: ToastTone, title: string, message?: string) {
    setToast({ open: true, tone, title, message })
    window.setTimeout(() => setToast((s) => ({ ...s, open: false })), 3200)
  }

  function resetAll() {
    if (inputRef.current) inputRef.current.value = ''
    setFileName(null)
    setRows([])
    setErr(null)
    setInfo(null)
  }

  function baixarModeloCsv() {
  const csv =
    'nome_modelo,sku,variacao\n' +
    'Scooter 350,SC350PRETO,Preto\n' +
    'Camisa Polo,C-POLO,Branco\n'

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-import-produtos.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}


  function validarObrigatorios(item: ItemImport, idx: number) {
    if (!item.nome_modelo) return `Linha ${idx + 2}: nome_modelo obrigatório`
    if (!item.sku) return `Linha ${idx + 2}: sku obrigatório`
    if (!item.variacao) return `Linha ${idx + 2}: variacao obrigatória`
    return null
  }

  async function onPickFile(file: File | null) {
    setErr(null)
    setInfo(null)
    setRows([])
    setFileName(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErr('Arquivo inválido. Envie um CSV.')
      showToast('error', 'Arquivo inválido', 'Envie um CSV (.csv).')
      return
    }

    if (file.size > MAX_BYTES) {
      setErr(`Arquivo muito grande. Máximo: ${bytesToKB(MAX_BYTES)}KB.`)
      showToast('error', 'Arquivo muito grande', `Máximo: ${bytesToKB(MAX_BYTES)}KB.`)
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
          const line = typeof first.row === 'number' ? first.row + 1 : 'desconhecida'
          setErr(`Falha ao ler CSV (${first.code}) na linha ${line}.`)
          showToast('error', 'Falha ao ler CSV', `Erro ${first.code} na linha ${line}.`)
          return
        }

        const data = (res.data ?? []) as LinhaCsv[]

        if (data.length === 0) {
          setErr('CSV vazio.')
          showToast('error', 'CSV vazio')
          return
        }

        if (data.length > MAX_LINHAS) {
          setErr(`Muitas linhas. Máximo: ${MAX_LINHAS}.`)
          showToast('error', 'Muitas linhas', `Máximo: ${MAX_LINHAS}.`)
          return
        }

        const fields = (res.meta.fields ?? []).map(normalizeHeader)
        const required = ['nome_modelo', 'sku', 'variacao']
        const missing = required.filter((k) => !fields.includes(k))

        if (missing.length) {
          const m = `Cabeçalhos inválidos. Faltando: ${missing.join(', ')}.`
          setErr(`${m} Obrigatório: nome_modelo, sku, variacao.`)
          showToast('error', 'Cabeçalhos inválidos', m)
          return
        }

        const normalized: ItemImport[] = data.map((r) => ({
          nome_modelo: normalize(r.nome_modelo),
          sku: canonSku(r.sku),
          variacao: normalize(r.variacao),
        }))


        for (let i = 0; i < normalized.length; i++) {
          const v = validarObrigatorios(normalized[i], i)
          if (v) {
            setErr(v)
            showToast('error', 'CSV inválido', v)
            return
          }
        }

        setRows(normalized)
        setInfo(`Arquivo pronto: ${normalized.length} linhas.`)

        if (duplicatedSkus.length > 0) {
          showToast('warn', 'Arquivo com SKUs duplicados', `${duplicatedSkus.length} SKU(s) duplicado(s). Serão ignorados.`)
        } else {
          showToast('success', 'Arquivo carregado', `${normalized.length} linhas prontas para importar.`)
        }
      },
      error: () => {
        setErr('Falha ao ler CSV.')
        showToast('error', 'Falha ao ler CSV')
      },
    })
  }

  async function importar() {
    if (!rows.length) return

    setErr(null)
    setInfo(null)
    setLoading(true)

    try {
      // Ctrl+F: ".schema('lws').rpc(RPC_IMPORT"
      const { data, error } = await supabase.schema('lws').rpc(RPC_IMPORT, { p_itens: rows })
      if (error) throw error

      const row = (Array.isArray(data) ? data[0] : null) as any
      const msg = row
        ? `Importação concluída • Variantes: ${row.variantes_inseridas} • Ignorados: ${row.skus_ignorados}`
        : 'Importação concluída.'

      setInfo(msg)

      const vIns = Number(row?.variantes_inseridas ?? 0)
      const ign = Number(row?.skus_ignorados ?? 0)

      if (vIns > 0 && ign === 0) showToast('success', 'Importação concluída', `Variantes importadas: ${vIns}.`)
      else if (vIns > 0 && ign > 0) showToast('warn', 'Importação com repetidos', `Importadas: ${vIns}. Ignoradas: ${ign}.`)
      else if (vIns === 0 && ign > 0) showToast('warn', 'Nada importado', `SKUs repetidos/ignorados: ${ign}.`)
      else showToast('warn', 'Importação concluída', 'Sem alterações.')

      if (inputRef.current) inputRef.current.value = ''
      setFileName(null)
      setRows([])
    } catch (e: any) {
      setErr(e?.message ?? 'erro_inesperado')
      showToast('error', 'Falha na importação', e?.message ?? 'erro_inesperado')
    } finally {
      setLoading(false)
    }
  }

  const podeImportar = rows.length > 0 && !loading

  return (
    <div className="space-y-4">
      <Toast state={toast} onClose={() => setToast((s) => ({ ...s, open: false }))} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[20px] font-extrabold tracking-tight text-app-fg">Importar produtos</div>
          <div className="mt-1 text-sm text-app-muted">CSV local • sem fotos • sem anexos</div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => router.push('/produtos')}>
            Produtos
          </Button>
          <Button variant="secondary" onClick={() => router.push('/produtos/novo')}>
            Cadastro manual
          </Button>
        </div>
      </div>

      <Card
        title="Importação em massa"
        subtitle="Cabeçalhos obrigatórios: nome_modelo, sku, variacao"
        rightSlot={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={downloadTemplate} disabled={loading}>
              Baixar modelo CSV
            </Button>
            <Button variant="ghost" onClick={resetAll} disabled={loading}>
              Limpar
            </Button>
          </div>
        }
      >
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Erro</div>
            <div className="mt-0.5 text-xs text-red-700/80">{err}</div>
          </div>
        ) : null}

        {info ? <div className="mt-2 text-sm font-semibold text-app-muted">{info}</div> : null}

        {duplicatedSkus.length ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-semibold" style={{ color: 'rgb(146,64,14)' }}>
              Atenção: {duplicatedSkus.length} SKU(s) duplicado(s) no CSV
            </div>
            <div className="mt-0.5 text-xs" style={{ color: 'rgba(146,64,14,.85)' }}>
              Serão ignorados. Exemplos:{' '}
              <span className="font-mono">{duplicatedSkus.slice(0, 10).join(', ')}</span>
              {duplicatedSkus.length > 10 ? '…' : ''}
            </div>
          </div>
        ) : null}

        <div className="app-card mt-3">
          <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-app-fg">1) Selecionar CSV</div>
              <div className="mt-0.5 text-xs text-app-muted">
                Obrigatório: <span className="font-mono">nome_modelo, sku, variacao</span>
              </div>
            </div>
            <Badge tone={rows.length ? 'ok' : 'info'}>{rows.length ? 'Pronto' : 'CSV'}</Badge>
          </div>

          <div className="px-4 py-4 space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto,1fr] md:items-center">
              <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={loading} className="w-full md:w-auto">
                Selecionar CSV
              </Button>

              <div className="app-card px-3 py-2 text-sm">
                {fileName ? (
                  <div className="truncate">
                    <span className="text-app-muted">Selecionado: </span>
                    <span className="font-mono">{fileName}</span>
                  </div>
                ) : (
                  <div className="text-app-muted">Nenhum arquivo selecionado</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <StatCard title="Linhas">{rows.length}</StatCard>
              <StatCard title="Limite linhas">{MAX_LINHAS}</StatCard>
              <StatCard title="Limite arquivo">{bytesToKB(MAX_BYTES)}KB</StatCard>
            </div>
          </div>
        </div>

        <div className="app-card">
          <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-app-fg">2) Importar</div>
              <div className="mt-0.5 text-xs text-app-muted">Cria produtos e variantes (SKU) para a empresa atual.</div>
            </div>

            <Badge tone={duplicatedSkus.length ? 'warn' : podeImportar ? 'ok' : 'info'}>
              {duplicatedSkus.length ? 'Verificar' : podeImportar ? 'Liberado' : 'Aguardando'}
            </Badge>
          </div>

          <div className="px-4 py-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button variant="primary" onClick={importar} disabled={!podeImportar} className="w-full">
                {loading ? 'Importando...' : 'Importar agora'}
              </Button>

              <Button variant="secondary" onClick={() => router.push('/qr')} className="w-full" disabled={loading}>
                QR
              </Button>
            </div>
          </div>
        </div>

        <Card title="Prévia" subtitle="Primeiras 10 linhas" rightSlot={<Badge tone="info">{preview.length}</Badge>}>
          {rows.length === 0 ? (
            <div className="text-app-muted">Selecione um CSV para ver a prévia.</div>
          ) : (
            <div className="space-y-2">
              {preview.map((r, i) => (
                <div key={`${r.sku}-${i}`} className="app-card px-4 py-3">
                  <div className="text-sm font-semibold text-app-fg">{r.nome_modelo}</div>
                  <div className="mt-1 text-sm text-app-muted">
                    {r.variacao} • <span className="font-mono">{r.sku}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Card>
    </div>
  )
}
