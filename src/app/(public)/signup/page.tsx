'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton } from '@/modules/shared/ui/retro'

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
      setError(
        err?.message ||
          'Não foi possível criar sua conta. Verifique os dados e tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <RetroWindow title="Criar conta" subtitle="Cadastro para acessar o Estoque Operacional">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Nome</label>
            <input
              className="w-full rounded border px-3 py-3 text-base"
              value={form.nome}
              onChange={(e) => onChange('nome', e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Telefone (opcional)</label>
            <input
              className="w-full rounded border px-3 py-3 text-base"
              value={form.telefone}
              onChange={(e) => onChange('telefone', e.target.value)}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Código da empresa (opcional)</label>
            <input
              className="w-full rounded border px-3 py-3 text-base"
              value={form.empresaCodigo}
              onChange={(e) => onChange('empresaCodigo', e.target.value)}
              placeholder="SMARTWAY"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">E-mail</label>
            <input
              className="w-full rounded border px-3 py-3 text-base"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="voce@empresa.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Senha</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-3 text-base"
              value={form.senha}
              onChange={(e) => onChange('senha', e.target.value)}
              placeholder="mín. 8 caracteres"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Confirmar senha</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-3 text-base"
              value={form.confirmarSenha}
              onChange={(e) => onChange('confirmarSenha', e.target.value)}
              placeholder="repita a senha"
              autoComplete="new-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded border p-3 text-sm">
              <p className="font-semibold">Erro</p>
              <p className="opacity-80">{error}</p>
            </div>
          ) : success ? (
            <div className="rounded border p-3 text-sm">
              <p className="font-semibold">Ok</p>
              <p className="opacity-80">{success}</p>
            </div>
          ) : null}

          <RetroButton type="submit" className="w-full py-3" disabled={disabled}>
            {loading ? 'Criando...' : 'Criar conta'}
          </RetroButton>

          <div className="grid gap-2 md:grid-cols-2">
            <RetroButton
              type="button"
              className="w-full py-3"
              onClick={() => router.push('/reset-password')}
            >
              Esqueci minha senha
            </RetroButton>

            <RetroButton
              type="button"
              className="w-full py-3"
              onClick={() => router.push('/login')}
            >
              Já tenho conta
            </RetroButton>
          </div>
        </form>
      </RetroWindow>
    </div>
  )
}
