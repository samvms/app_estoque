'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Badge } from '@/modules/shared/ui/app'
import { QrCode, Layers, Tag, MapPin } from 'lucide-react'

function ActionRow(props: {
  title: string
  desc: string
  hint?: string
  icon?: React.ReactNode
  onClick: () => void
  cta?: string
  tone?: 'info' | 'ok' | 'warn'
}) {
  return (
    <div
      onClick={props.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onClick()
      }}
      className="
        w-full cursor-pointer
        rounded-2xl border border-app-border bg-white
        p-4 transition
        hover:bg-app-muted/40
        active:scale-[0.99]
        focus:outline-none focus:ring-2 focus:ring-app-primary/30
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {props.icon ? (
              <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-white">
                {props.icon}
              </span>
            ) : null}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-app-fg">{props.title}</div>
              </div>
              <div className="mt-1 text-sm text-app-muted">{props.desc}</div>
              {props.hint ? <div className="mt-1 text-xs text-app-muted">{props.hint}</div> : null}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            props.onClick()
          }}
          className="shrink-0"
        >
          Abrir
        </Button>
      </div>
    </div>
  )
}

export default function QrHomePage() {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <Card title="QR" subtitle="Gerar lotes, reimprimir e consultar histórico">
        <div className="space-y-3">
          <ActionRow
            title="Gerar etiquetas"
            desc="Criar lote e seguir direto para impressão PDF A4"
            hint="Use quando estiver criando QRs novos para colar nas caixas."
            tone="ok"
            icon={<QrCode size={18} className="opacity-80" />}
            onClick={() => router.push('/qr/gerar')}
          />

          <ActionRow
            title="Lotes"
            desc="Ver lotes gerados e reimprimir PDF"
            hint="Acesse o lote para ver status e reimprimir apenas as disponíveis."
            icon={<Layers size={18} className="opacity-80" />}
            onClick={() => router.push('/qr/lotes')}
          />

          <ActionRow
            title="Etiquetas"
            desc="Histórico geral"
            hint="Use para auditoria e consulta por QR."
            tone="info"
            cta="Histórico"
            icon={<Tag size={18} className="opacity-80" />}
            onClick={() => router.push('/etiquetas')}
          />

          <ActionRow
            title="Locais"
            desc="Criar, ativar e desativar locais de estoque"
            hint="Local é obrigatório nas bipagens (contagem e recebimento)."
            icon={<MapPin size={18} className="opacity-80" />}
            onClick={() => router.push('/locais')}
          />
        </div>
      </Card>
    </div>
  )
}
