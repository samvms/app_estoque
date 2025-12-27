import type { ReactNode } from 'react'

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full">{children}</div>
      </main>
    </div>
  )
}
