// src/app/(app)/layout.tsx
import { AppShell } from '@/modules/shared/ui/app'
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      brand={<BrandLogo variant="wordmark" size="md" mode="light" priority />}
      brandIcon={<BrandLogo variant="icon" size="md" priority />}
    >
      {children}
    </AppShell>
  )
}
