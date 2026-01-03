import { FormLogin } from '@/modules/auth/ui/FormLogin'

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] bg-app-muted/30">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
        {/* Header leve (opcional, mas ajuda muito no “Apple-like”) */}
        <div className="mb-5">
          <div className="text-lg font-semibold text-app-fg">AppStock</div>
          <div className="mt-0.5 text-sm text-app-muted">
            Controle operacional de estoque
          </div>
        </div>

        <FormLogin />

        {/* Rodapé discreto */}
        <div className="mt-4 text-center text-xs text-app-muted">
          Use um celular para bipagem por câmera.
        </div>
      </div>
    </div>
  )
}
