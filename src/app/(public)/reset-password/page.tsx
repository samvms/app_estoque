'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton } from '@/modules/shared/ui/retro'

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
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <RetroWindow title="Redefinir senha" subtitle="Você receberá um link por e-mail">
        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">E-mail</label>
            <input
              type="email"
              className="w-full rounded border px-3 py-3 text-base"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {msg && <div className="rounded border p-3 text-sm">{msg}</div>}

          <div className="grid gap-2 md:grid-cols-2">
            <RetroButton type="submit" className="w-full py-3" disabled={loading || !email.trim()}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </RetroButton>

            <RetroButton
              type="button"
              className="w-full py-3"
              onClick={() => router.push('/login')}
            >
              Voltar
            </RetroButton>
          </div>
        </form>
      </RetroWindow>
    </div>
  )
}
