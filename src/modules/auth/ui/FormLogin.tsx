// src/modules/auth/ui/FormLogin.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginComEmailSenha } from '@/modules/auth'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

export function FormLogin() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const disabled = useMemo(() => carregando || !email.trim() || !senha, [carregando, email, senha])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)

    const res = await loginComEmailSenha(email.trim(), senha)

    setCarregando(false)

    if (!res.ok) {
      setErro(res.erro)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card
      title="Acesso"
      subtitle="Entre para continuar"
      rightSlot={<Badge tone="info">Estoque</Badge>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-app-fg">E-mail</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="seu@email.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-app-fg">Senha</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        {erro ? (
          <div className="app-card px-4 py-3">
            <p className="text-sm font-semibold text-red-600">Não foi possível entrar</p>
            <p className="mt-1 text-sm text-app-muted">{erro}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2">
          <Button type="submit" className="w-full py-3" disabled={disabled}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </Button>

          <Button type="button" variant="secondary" className="w-full py-3" onClick={() => router.push('/signup')}>
            Criar conta
          </Button>

          <Button type="button" variant="ghost" className="w-full py-3" onClick={() => router.push('/reset-password')}>
            Esqueci minha senha
          </Button>
        </div>
      </form>
    </Card>
  )
}
