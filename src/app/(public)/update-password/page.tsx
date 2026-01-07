// src/app/(public)/update-password/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button } from '@/modules/shared/ui/primitives'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const disabled = useMemo(() => loading || !senha || !confirmar, [loading, senha, confirmar])

  function validate(): string | null {
    if (!senha) return 'Informe a nova senha.'
    if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
    if (senha !== confirmar) return 'As senhas não conferem.'
    return null
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setError(null)

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error

      setMsg('Senha atualizada com sucesso. Faça login novamente.')
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar a senha. Abra o link do e-mail novamente e tente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Card
          title="Atualizar senha"
          subtitle="Defina sua nova senha"
          className="max-w-md mx-auto"
        >
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Nova senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mín. 8 caracteres"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Confirmar nova senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                           focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="repita a senha"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="text-sm font-semibold text-red-600">Erro</div>
                <div className="mt-0.5 text-xs text-red-700/80">{error}</div>
              </div>
            ) : msg ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-700">Ok</div>
                <div className="mt-0.5 text-xs text-emerald-800/80">{msg}</div>
              </div>
            ) : null}

            <div className="space-y-2 pt-2">
              <Button type="submit" className="w-full py-3 text-sm" disabled={disabled} loading={loading}>
                Salvar nova senha
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full py-2 text-xs"
                onClick={() => router.push('/login')}
                disabled={loading}
              >
                Voltar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
