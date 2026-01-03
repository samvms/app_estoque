import { Card } from '@/modules/shared/ui/app'

export default function AdminUsuariosPage() {
  return (
    <div className="space-y-4">
      <Card title="Usuários" subtitle="Administração">
        <div className="text-sm text-app-muted">
          Próximo passo: gestão de roles (ADMIN/OPERACAO/GERENCIA) via RPC.
        </div>
      </Card>
    </div>
  )
}
