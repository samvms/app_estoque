'use client'

import { useRouter } from 'next/navigation'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

function ActionRow(props: {
  title: string
  desc: string
  onClick: () => void
  variant?: 'secondary'
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4">
      <div className="min-w-0">
        <div className="text-base font-semibold text-slate-900">{props.title}</div>
        <div className="mt-1 text-sm text-slate-600">{props.desc}</div>
      </div>

      <Button onClick={props.onClick} variant={props.variant} className="shrink-0">
        Abrir
      </Button>
    </div>
  )
}

export default function QrHomePage() {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <Card
        title="QR"
        subtitle="Gerar etiquetas e gerenciar locais"
        rightSlot={
            <div className="flex gap-2">
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
                Dashboard
            </Button>
            </div>
        }
    >

        <div className="space-y-3">
          <ActionRow
            title="Gerar etiquetas"
            desc="Criar lote e imprimir PDF A4"
            onClick={() => router.push('/qr/gerar')}
          />

          <ActionRow
            title="Locais"
            desc="Criar, ativar e desativar locais de estoque"
            onClick={() => router.push('/locais')}
            variant="secondary"
          />
        </div>
      </Card>
    </div>
  )
}
