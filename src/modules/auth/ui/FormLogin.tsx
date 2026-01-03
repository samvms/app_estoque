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

  const disabled = useMemo(
    () => carregando || !email.trim() || !senha,
    [carregando, email, senha],
  )

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

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <Card
      title="Entrar"
      subtitle="Acesse sua conta para continuar"
      rightSlot={<Badge tone="info">AppStock</Badge>}
      className="max-w-md mx-auto"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">E-mail</label>
          <input
            className="
              w-full rounded-xl border border-app-border
              bg-white px-3 py-3 text-sm font-medium text-app-fg
              outline-none
              focus:border-app-primary
              focus:ring-2 focus:ring-app-primary/20
              transition
            "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="seu@email.com"
          />
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Senha</label>
          <input
            className="
              w-full rounded-xl border border-app-border
              bg-white px-3 py-3 text-sm font-medium text-app-fg
              outline-none
              focus:border-app-primary
              focus:ring-2 focus:ring-app-primary/20
              transition
            "
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        {/* Erro */}
        {erro ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">
              Não foi possível entrar
            </div>
            <div className="mt-0.5 text-xs text-red-700/80">
              {erro}
            </div>
          </div>
        ) : null}

        {/* Ações */}
        <div className="space-y-2 pt-2">
          <Button
            type="submit"
            className="w-full py-3 text-sm"
            disabled={disabled}
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="w-full py-3 text-sm"
            onClick={() => router.push('/signup')}
          >
            Criar conta
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full py-2 text-xs"
            onClick={() => router.push('/reset-password')}
          >
            Esqueci minha senha
          </Button>
        </div>
      </form>
    </Card>
  )
}
