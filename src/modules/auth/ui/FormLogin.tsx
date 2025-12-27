'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginComEmailSenha } from '@/modules/auth'

export function FormLogin() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)

    const res = await loginComEmailSenha(email, senha)

    setCarregando(false)

    if (!res.ok) {
      setErro(res.erro)
      return
    }

    router.push('/home')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm">E-mail</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm">Senha</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="password"
          required
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        className="w-full rounded border px-3 py-2 font-medium"
        disabled={carregando}
        type="submit"
      >
        {carregando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
