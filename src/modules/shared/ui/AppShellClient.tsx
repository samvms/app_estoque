'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

const AppShellNoSSR = dynamic(
  () => import('@/modules/shared/ui/app').then((m) => m.AppShell),
  { ssr: false }
)

export default function AppShellClient(props: { children: ReactNode; rightSlot?: ReactNode }) {
  return (
    <AppShellNoSSR
      brand={<BrandLogo variant="wordmark" size="md" mode="light" priority />}
      brandIcon={<BrandLogo variant="icon" size="md" priority />}
      rightSlot={props.rightSlot}
    >
      {props.children}
    </AppShellNoSSR>
  )
}
