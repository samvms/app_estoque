import { Card } from '@/modules/shared/ui/app'

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <Card title="Logs" subtitle="Execuções, falhas e diagnósticos">
        <div className="text-sm text-app-muted">
          Próximo passo: tabela de logs (job, status, duração, erro) + filtros. Isso alimenta o sininho.
        </div>
      </Card>
    </div>
  )
}
