// src/modules/shared/shell/LwsHeader.tsx
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

export function LwsHeader() {
  return (
    <header className="lws-header-glass">
      <div className="mx-auto max-w-6xl px-4 h-full flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Mobile: icon */}
          <div className="md:hidden">
            <BrandLogo variant="icon" size="md" priority />
          </div>

          {/* Desktop: wordmark */}
          <div className="hidden md:block">
            <BrandLogo variant="wordmark" size="md" mode="light" priority />
          </div>

          {/* Mobile title */}
          <div className="md:hidden">
            <div className="text-sm font-extrabold tracking-[0.14em] text-app-fg">
              LWS
            </div>
            <div className="text-[11px] font-semibold text-app-muted -mt-0.5">
              Moura
            </div>
          </div>
        </div>

        {/* Right slot (actions futuramente) */}
        <div className="flex items-center gap-2" />
      </div>
    </header>
  )
}
