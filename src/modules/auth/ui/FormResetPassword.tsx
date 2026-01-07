'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'
import { BrandLogo } from '@/modules/shared/brand/BrandLogo'

export function FormResetPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setOk(null)

    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/update-password`,
      })
      if (error) throw error
      setOk('Email enviado. Verifique sua caixa de entrada.')
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao enviar email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="md:hidden">
            <BrandLogo variant="icon" size="md" priority />
          </div>
          <div className="hidden md:block">
            <BrandLogo variant="wordmark" size="md" mode="light" priority />
          </div>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-app-fg">Recuperar senha</h1>
          <p className="text-sm text-app-muted">
            Informe seu email para receber o link.
          </p>
        </div>

        {erro && <Badge tone="danger">{erro}</Badge>}
        {ok && <Badge tone="ok">{ok}</Badge>}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
            <input
              type="email"
              className="w-full rounded-xl border border-app-border bg-white px-10 py-3 text-base text-app-fg outline-none"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !email}>
            Enviar link
          </Button>
        </form>

        <div className="text-center text-sm text-app-muted">
          <Link href="/login" className="font-medium text-app-fg hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    </Card>
  )
}
