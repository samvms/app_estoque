// FormSignup.tsx (mantém confirmação de e-mail ON)
// - Se confirmação ON: mostra aviso e NÃO redireciona (não existe session).
// - Se confirmação OFF: redireciona direto pro onboarding.

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button } from '@/modules/shared/ui/primitives'

export function FormSignup() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null)

  const senhaMinOk = senha.length >= 8
  const senhasIguais = senha === confirmar

  const disabled = useMemo(() => {
    if (carregando) return true
    if (!email.trim() || !senha || !confirmar) return true
    if (!senhaMinOk || !senhasIguais) return true
    return false
  }, [carregando, email, senha, confirmar, senhaMinOk, senhasIguais])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return

    setErro(null)
    setSucessoMsg(null)
    setCarregando(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/criar-empresa`,
        },
      })

      if (error) {
        setErro(error.message ?? 'Erro ao criar conta.')
        return
      }

      // Confirmação ON → sem session → não pode redirecionar.
      if (!data.session) {
        setSucessoMsg('Conta criada. Verifique seu e-mail para confirmar o cadastro e depois faça login.')
        return
      }

      // Confirmação OFF → já logado → onboarding direto
      router.replace('/onboarding/criar-empresa')
      router.refresh()
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao criar conta.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Card title="Criar conta" subtitle="Use seu e-mail corporativo" className="max-w-md mx-auto">
      {sucessoMsg ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-sm font-semibold text-emerald-700">Conta criada</div>
            <div className="mt-0.5 text-xs text-emerald-800/80">{sucessoMsg}</div>
          </div>

          <Button className="w-full py-3 text-sm" onClick={() => router.replace('/login')}>
            Ir para o login
          </Button>
        </div>
      ) : (
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
              autoComplete="new-password"
              required
              placeholder="mín. 8 caracteres"
              disabled={carregando}
            />
            {senha && !senhaMinOk ? <div className="text-[11px] text-app-muted">A senha precisa ter pelo menos 8 caracteres.</div> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted">Confirmar senha</label>
            <input
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                         focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
              placeholder="repita a senha"
              disabled={carregando}
            />
            {confirmar && !senhasIguais ? <div className="text-[11px] text-app-muted">As senhas não conferem.</div> : null}
          </div>

          {erro ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-sm font-semibold text-red-600">Não foi possível criar a conta</div>
              <div className="mt-0.5 text-xs text-red-700/80">{erro}</div>
            </div>
          ) : null}

          <div className="space-y-2 pt-2">
            <Button type="submit" className="w-full py-3 text-sm" disabled={disabled} loading={carregando}>
              Criar conta
            </Button>

            <Button type="button" variant="secondary" className="w-full py-3 text-sm" disabled={carregando} onClick={() => router.push('/login')}>
              Já tenho conta
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
