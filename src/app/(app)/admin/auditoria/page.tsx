import { Card } from '@/modules/shared/ui/app'

export default function AdminAuditoriaPage() {
  return (
    <div className="space-y-4">
      <Card title="Auditoria" subtitle="Rastreabilidade">
        <div className="text-sm text-app-muted">
          Próximo passo: listar auditorias_estoque por período/origem via RPC.
        </div>
      </Card>
    </div>
  )
}
