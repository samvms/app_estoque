// FormLogin.tsx
// Pós-login: chama core.fn_contexto_sessao()
// - sem perfil -> /onboarding/criar-empresa
// - com perfil -> /home
// Sempre mostra erro se a RPC falhar.

'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginComEmailSenha } from '@/modules/auth'
import { supabase } from '@/lib/supabase/client'
import { Card, Button } from '@/modules/shared/ui/primitives'

type CtxSessao = {
  tem_sessao: boolean
  tem_perfil: boolean
  empresa_id: string | null
}

export function FormLogin() {
  const router = useRouter()
  const sp = useSearchParams()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const disabled = useMemo(() => carregando || !email.trim() || !senha, [carregando, email, senha])

  // se você quiser respeitar returnTo quando TEM perfil:
  const returnTo = sp.get('returnTo')
  const destinoComPerfil = returnTo && returnTo.startsWith('/') ? returnTo : '/home'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return

    setErro(null)
    setCarregando(true)

    const res = await loginComEmailSenha(email.trim(), senha)
    if (!res.ok) {
      setCarregando(false)
      setErro(res.erro)
      return
    }

    const { data, error } = await supabase.schema('core').rpc('fn_contexto_sessao')
    setCarregando(false)

    if (error) {
      setErro(error.message ?? 'Erro ao validar acesso.')
      return
    }

    const ctx = (Array.isArray(data) ? data[0] : data) as CtxSessao | undefined
    const temPerfil = Boolean(ctx?.tem_perfil)

    if (!temPerfil) {
      router.replace('/onboarding/criar-empresa')
      router.refresh()
      return
    }

    router.replace(destinoComPerfil)
    router.refresh()
  }

  return (
    <Card title="Entrar" subtitle="Use seu e-mail corporativo" className="max-w-md mx-auto">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">E-mail</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="seu@email.com"
            disabled={carregando}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Senha</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            disabled={carregando}
          />
        </div>

        {erro ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Não foi possível entrar</div>
            <div className="mt-0.5 text-xs text-red-700/80">{erro}</div>
          </div>
        ) : null}

        <div className="space-y-2 pt-2">
          <Button type="submit" className="w-full py-3 text-sm" disabled={disabled} loading={carregando}>
            Entrar
          </Button>

          <Button type="button" variant="secondary" className="w-full py-3 text-sm" disabled={carregando} onClick={() => router.push('/signup')}>
            Criar conta
          </Button>

          <Button type="button" variant="ghost" className="w-full py-2 text-xs" disabled={carregando} onClick={() => router.push('/reset-password')}>
            Esqueci minha senha
          </Button>
        </div>
      </form>
    </Card>
  )
}
