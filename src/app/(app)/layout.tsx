import type { ReactNode } from 'react'
import AppShellClient from '@/modules/shared/ui/AppShellClient'

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShellClient>{children}</AppShellClient>
}
