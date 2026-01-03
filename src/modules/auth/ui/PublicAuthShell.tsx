// src/modules/auth/ui/PublicAuthShell.tsx
'use client'

import { ReactNode } from 'react'

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-app px-4 py-10 grid place-items-center">
      <div className="w-full max-w-[440px]">
        {/* Brand strip */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl border border-app-border bg-white/70 backdrop-blur px-4 py-2">
            <div className="text-xs font-extrabold tracking-[0.18em] text-app-muted">
              MOURA
            </div>
            <div className="mx-2 h-4 w-px bg-black/10" />
            <div className="text-sm font-black tracking-[0.14em] text-app-fg">
              LWS
            </div>
          </div>

          <div className="mt-3 text-[13px] font-semibold text-app-muted">
            Acesse para continuar
          </div>
        </div>

        {children}

        <div className="mt-6 text-center text-[11px] font-semibold text-app-muted">
          © {new Date().getFullYear()} Moura LWS
        </div>
      </div>
    </div>
  )
}
