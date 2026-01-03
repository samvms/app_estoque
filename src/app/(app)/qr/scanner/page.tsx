'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Badge, Button } from '@/modules/shared/ui/app'

const ScannerQR = dynamic(
  () => import('@/modules/inventory/ui/ScannerQR').then((m) => m.ScannerQR),
  {
    ssr: false,
    loading: () => (
      <div className="app-card p-4">
        <div className="text-sm font-semibold text-app-fg">Carregando scanner…</div>
        <div className="mt-1 text-sm text-app-muted">Abrindo câmera no mobile.</div>
      </div>
    ),
  }
)

function isMobileByUA() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export default function QrScannerPage() {
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [lastQr, setLastQr] = useState<string | null>(null)
  const [lastLabel, setLastLabel] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)

    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(mq.matches || isMobileByUA())

    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  const resolverLabel = useMemo(() => {
    return async (qr: string) => {
      try {
        const { data, error } = await supabase
          .schema('app_estoque')
          .rpc('fn_resolver_qr_label', { p_qr_code: qr })

        if (error) return null

        // pode vir como linha única ou array (dependendo de como a RPC foi escrita)
        const row = Array.isArray(data) ? data?.[0] : data
        const nome = row?.nome_modelo ?? row?.nome_modelo_produto ?? null
        const variacao = row?.cor ?? null

        if (!nome && !variacao) return null
        if (nome && variacao) return `${nome} • ${variacao}`
        return nome ?? variacao
      } catch {
        return null
      }
    }
  }, [])

  // Evita hydration: no primeiro render (server + primeiro client) mantém estável
  if (!mounted) {
    return (
      <div className="space-y-4">
        <Card title="Scanner" subtitle="Abrindo…" rightSlot={<Badge tone="info">QR</Badge>}>
          <div className="opacity-70">Carregando…</div>
        </Card>
      </div>
    )
  }

  // PC / desktop: trava com aviso grande
  if (!isMobile) {
    return (
      <div className="space-y-4">
        <Card title="Scanner" subtitle="Disponível apenas no celular" rightSlot={<Badge tone="warn">Mobile only</Badge>}>
          <div className="app-card p-4 border border-app-border bg-white">
            <div className="text-[16px] font-extrabold text-app-fg">Este scanner funciona somente no mobile.</div>
            <div className="mt-2 text-sm text-app-muted">
              Abra esta mesma URL no seu celular para usar a câmera.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(window.location.href)
                  } catch {}
                }}
                className="w-full py-3"
              >
                Copiar link
              </Button>

              <Button
                variant="ghost"
                onClick={() => window.location.reload()}
                className="w-full py-3"
              >
                Revalidar dispositivo
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Mobile: liberado normal
  return (
    <div className="space-y-4">
      <Card
        title="Scanner"
        subtitle="Leitura contínua • melhor em boa iluminação"
        rightSlot={<Badge tone="ok">Mobile</Badge>}
      >
        {lastQr ? (
          <div className="mb-3 rounded-2xl border border-app-border bg-white p-3">
            <div className="text-xs text-app-muted">Último QR</div>
            <div className="mt-1 font-mono text-sm">{lastQr}</div>
            {lastLabel ? <div className="mt-1 text-sm font-semibold text-app-fg">{lastLabel}</div> : null}
          </div>
        ) : null}

        <ScannerQR
          modo="continuous"
          cooldownMs={900}
          beep
          vibrate
          resolverLabel={async (qr: string) => {
            const label = await resolverLabel(qr)
            setLastLabel(label)
            return label
          }}
          aoLer={(valor: string) => {
            setLastQr(valor)
            // não faz branch por window no render; só ações aqui
            try {
              navigator.clipboard?.writeText(valor)
            } catch {}
          }}
        />
      </Card>
    </div>
  )
}
