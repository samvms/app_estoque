import { Card } from '@/modules/shared/ui/app'

export default function ConectoresPage() {
  return (
    <div className="space-y-4">
      <Card title="Conectores" subtitle="Configuração">
        <div className="text-sm text-app-muted">
          Próximo passo: modelar conectores (Bling e outros) e estado (ativo, credenciais, última execução).
        </div>
      </Card>
    </div>
  )
}
