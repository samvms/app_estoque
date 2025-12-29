'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginComEmailSenha } from '@/modules/auth'
import { RetroWindow, RetroButton } from '@/modules/shared/ui/retro'

export function FormLogin() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const disabled = useMemo(() => {
    return carregando || !email.trim() || !senha
  }, [carregando, email, senha])

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
    <RetroWindow title="Acesso" subtitle="Entre para continuar">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm">E-mail</label>
          <input
            className="w-full rounded border px-3 py-3 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Senha</label>
          <input
            className="w-full rounded border px-3 py-3 text-base"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {erro && (
          <div className="rounded border p-3 text-sm">
            <p className="font-semibold">Não foi possível entrar</p>
            <p className="opacity-80">{erro}</p>
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          <RetroButton type="submit" className="w-full py-3" disabled={disabled}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </RetroButton>

          <RetroButton
            type="button"
            className="w-full py-3"
            onClick={() => router.push('/signup')}
          >
            Criar conta
          </RetroButton>
        </div>

        <RetroButton
          type="button"
          className="w-full py-3"
          onClick={() => router.push('/reset-password')}
        >
          Esqueci minha senha
        </RetroButton>
      </form>
    </RetroWindow>
  )
}
