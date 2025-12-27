'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { logout, sessaoAtual } from '@/modules/auth'

export default function LayoutApp({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function validarSessao() {
      const session = await sessaoAtual()

      if (!ativo) return

      if (!session) {
        window.location.href = '/login'
        return
      }

      setCarregando(false)
    }

    validarSessao()

    return () => {
      ativo = false
    }
  }, [])

  async function sair() {
    await logout()
    window.location.href = '/login'
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="opacity-70">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="font-semibold">Estoque PWA</div>

          <nav className="flex items-center gap-4 text-sm">
            <a className="opacity-80 hover:underline" href="/home">
              Home
            </a>

            <button onClick={sair} className="text-red-600 hover:underline">
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
