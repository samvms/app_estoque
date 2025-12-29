import { RetroAppShell } from '@/modules/shared/ui/retro'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RetroAppShell title="Estoque Operacional">{children}</RetroAppShell>
}
