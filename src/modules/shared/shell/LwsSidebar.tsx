// src/modules/shared/shell/LwsSidebar.tsx
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

export function LwsSidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="lws-sidebar hidden md:flex md:flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-app-border">
        <BrandLogo variant="wordmark" size="md" mode="light" priority />
      </div>

      <div className="lws-sidebar-scroll px-2 py-2">
        {children}
      </div>
    </aside>
  )
}
