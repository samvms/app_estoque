// src/app/(public)/update-password/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

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
      router.push('/login')
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
          rightSlot={<Badge tone="info">Acesso</Badge>}
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Nova senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mín. 8 caracteres"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Confirmar nova senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="repita a senha"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            {error ? (
              <div className="app-card px-4 py-3">
                <p className="text-sm font-semibold text-red-600">Erro</p>
                <p className="mt-1 text-sm text-app-muted">{error}</p>
              </div>
            ) : msg ? (
              <div className="app-card px-4 py-3">
                <p className="text-sm font-semibold text-app-fg">Ok</p>
                <p className="mt-1 text-sm text-app-muted">{msg}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2">
              <Button type="submit" className="w-full py-3" disabled={disabled}>
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </Button>

              <Button type="button" variant="ghost" className="w-full py-3" onClick={() => router.push('/login')} disabled={loading}>
                Voltar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
