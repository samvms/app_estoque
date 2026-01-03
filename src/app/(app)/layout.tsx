// src/app/(app)/layout.tsx
import { AppShell } from '@/modules/shared/ui/app'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="Moura LWS">{children}</AppShell>
}
