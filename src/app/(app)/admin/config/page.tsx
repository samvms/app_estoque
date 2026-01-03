import { Card } from '@/modules/shared/ui/app'

export default function AdminConfigPage() {
  return (
    <div className="space-y-4">
      <Card title="Configurações" subtitle="Sistema">
        <div className="text-sm text-app-muted">
          Preferências e parâmetros operacionais do Moura LWS.
        </div>
      </Card>
    </div>
  )
}
