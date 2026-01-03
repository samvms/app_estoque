import { Card } from '@/modules/shared/ui/app'

export default function FornecedoresPage() {
  return (
    <div className="space-y-4">
      <Card title="Fornecedores" subtitle="Cadastro">
        <div className="text-sm text-app-muted">
          Se estiver em uso no fluxo, a gente liga via RPC.
        </div>
      </Card>
    </div>
  )
}
