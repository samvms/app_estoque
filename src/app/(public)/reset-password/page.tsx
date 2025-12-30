// src/app/(public)/reset-password/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/update-password`,
    })

    setMsg('Se existir uma conta com esse e-mail, enviamos instruções para redefinir a senha.')
    setLoading(false)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Card
          title="Redefinir senha"
          subtitle="Você receberá um link por e-mail"
          rightSlot={<Badge tone="info">Acesso</Badge>}
        >
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">E-mail</label>
              <input
                type="email"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <div className="text-xs text-app-muted">
                Enviaremos um link para você criar uma nova senha.
              </div>
            </div>

            {msg ? (
              <div className="app-card px-4 py-3">
                <div className="text-sm text-app-fg">{msg}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2">
              <Button type="submit" className="w-full py-3" disabled={loading || !email.trim()}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </Button>

              <Button type="button" variant="ghost" className="w-full py-3" onClick={() => router.push('/login')}>
                Voltar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
