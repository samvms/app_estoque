// src/app/(public)/signup/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

type FormState = {
  nome: string
  telefone: string
  empresaCodigo: string
  email: string
  senha: string
  confirmarSenha: string
}

export default function SignupPage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    nome: '',
    telefone: '',
    empresaCodigo: 'SMARTWAY',
    email: '',
    senha: '',
    confirmarSenha: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const disabled = useMemo(() => loading, [loading])

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (!form.nome.trim()) return 'Informe seu nome.'
    if (!form.email.trim()) return 'Informe seu e-mail.'
    if (!form.senha) return 'Informe sua senha.'
    if (form.senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
    if (form.senha !== form.confirmarSenha) return 'As senhas não conferem.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.senha,
        options: {
          data: {
            nome: form.nome.trim(),
            telefone: form.telefone.trim() || null,
            empresa_codigo: form.empresaCodigo.trim() || 'SMARTWAY',
          },
        },
      })

      if (error) throw error

      if (!data.session) {
        setSuccess(
          'Se o cadastro for possível, enviamos um e-mail de confirmação. Se você já tiver conta, use "Esqueci minha senha".'
        )
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar sua conta. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Card
          title="Criar conta"
          subtitle="Cadastro para acessar o Estoque Operacional"
          rightSlot={<Badge tone="info">Acesso</Badge>}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Nome</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.nome}
                onChange={(e) => onChange('nome', e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Telefone (opcional)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.telefone}
                onChange={(e) => onChange('telefone', e.target.value)}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Código da empresa (opcional)</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.empresaCodigo}
                onChange={(e) => onChange('empresaCodigo', e.target.value)}
                placeholder="SMARTWAY"
                disabled={loading}
              />
              <div className="text-xs text-app-muted">Se vazio, usamos <b className="text-app-fg">SMARTWAY</b>.</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">E-mail</label>
              <input
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.email}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.senha}
                onChange={(e) => onChange('senha', e.target.value)}
                placeholder="mín. 8 caracteres"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-app-fg">Confirmar senha</label>
              <input
                type="password"
                className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-base font-medium text-app-fg outline-none"
                value={form.confirmarSenha}
                onChange={(e) => onChange('confirmarSenha', e.target.value)}
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
            ) : success ? (
              <div className="app-card px-4 py-3">
                <p className="text-sm font-semibold text-app-fg">Ok</p>
                <p className="mt-1 text-sm text-app-muted">{success}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full py-3" disabled={disabled}>
              {loading ? 'Criando…' : 'Criar conta'}
            </Button>

            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="secondary" className="w-full py-3" onClick={() => router.push('/reset-password')} disabled={loading}>
                Esqueci minha senha
              </Button>

              <Button type="button" variant="ghost" className="w-full py-3" onClick={() => router.push('/login')} disabled={loading}>
                Já tenho conta
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
