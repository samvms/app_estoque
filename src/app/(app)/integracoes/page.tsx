import Link from 'next/link'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

export default function IntegracoesPage() {
  return (
    <div className="space-y-4">
      <Card
        title="Integrações"
        subtitle="ERPs e outros softwares"
        rightSlot={<Badge tone="info">Base do sininho</Badge>}
      >
        <div className="text-sm text-app-muted">
          Aqui entra o status: conectores ativos, última execução, falhas e fila.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/integracoes/conectores"><Button variant="secondary">Conectores</Button></Link>
          <Link href="/integracoes/logs"><Button variant="secondary">Logs</Button></Link>
        </div>
      </Card>
    </div>
  )
}
