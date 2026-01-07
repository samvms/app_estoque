import { ReactNode } from 'react'
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-app px-4 py-10 grid place-items-center">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl border border-app-border bg-white/70 backdrop-blur px-5 py-3 shadow-sm">
            <BrandLogo variant="wordmark" size="md" mode="light" priority />
          </div>

          <div className="mt-3 text-[13px] font-semibold text-app-muted">
            Acesse para continuar
          </div>
        </div>

        {children}

        <div className="mt-6 text-center text-[11px] font-semibold text-app-muted">
          © Moura LWS
        </div>
      </div>
    </div>
  )
}
