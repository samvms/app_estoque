'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    })

    setMsg(
      'Se existir uma conta com esse e-mail, enviamos instruções para redefinir a senha.'
    )
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1>Redefinir senha</h1>

      <form onSubmit={handleReset} style={{ display: 'grid', gap: 10 }}>
        <input
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
        />

        <button disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link'}
        </button>

        {msg && <p>{msg}</p>}
      </form>
    </div>
  )
}
