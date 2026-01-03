import Link from 'next/link'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

export default function HomePage() {
  return (
    <div className="space-y-4">
      <Card
        title="Home"
        subtitle="Moura LWS • Operação"
        rightSlot={<Badge tone="info">Operação</Badge>}
      >
        <div className="text-sm text-app-muted">
          Painel operacional (pendências, atalhos e alertas).
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/contagens"><Button variant="secondary">Contagens</Button></Link>
          <Link href="/recebimentos"><Button variant="secondary">Recebimentos</Button></Link>
          <Link href="/estoques"><Button variant="secondary">Estoques</Button></Link>
          <Link href="/etiquetas"><Button variant="secondary">Etiquetas (QR)</Button></Link>
          <Link href="/integracoes"><Button variant="ghost">Integrações</Button></Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Operação" subtitle="Foco em performance">
          <div className="text-sm text-app-muted">
            Pendências de contagens/recebimentos abertos e divergências.
          </div>
        </Card>

        <Card title="Qualidade" subtitle="Dados e consistência">
          <div className="text-sm text-app-muted">
            QR sem variante, local inválido, status inconsistentes.
          </div>
        </Card>

        <Card title="Integrações" subtitle="ERPs e outros softwares">
          <div className="text-sm text-app-muted">
            Logs e execução de jobs.
          </div>
        </Card>
      </div>
    </div>
  )
}
