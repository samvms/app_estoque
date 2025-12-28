'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'


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

      // Se email confirmation estiver ligada, session pode vir null
      if (!data.session) {
        setSuccess('Se o cadastro for possível, enviamos um e-mail de confirmação. Se você já tiver conta, use "Esqueci minha senha".')
        return
      }

      // Se não precisar confirmar email, já loga e segue
      router.push('/')
    } catch (err: any) {
      const msg =
        err?.message ||
        'Não foi possível criar sua conta. Verifique os dados e tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Criar conta</h1>
      <p style={{ marginBottom: 16, opacity: 0.8 }}>
        Cadastro para acessar o Estoque Operacional.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label>
          Nome
          <input
            value={form.nome}
            onChange={(e) => onChange('nome', e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            required
            style={inputStyle}
          />
        </label>

        <label>
          Telefone (opcional)
          <input
            value={form.telefone}
            onChange={(e) => onChange('telefone', e.target.value)}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            style={inputStyle}
          />
        </label>

        <label>
          Código da empresa (opcional)
          <input
            value={form.empresaCodigo}
            onChange={(e) => onChange('empresaCodigo', e.target.value)}
            placeholder="SMARTWAY"
            style={inputStyle}
          />
        </label>

        <label>
          E-mail
          <input
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={form.senha}
            onChange={(e) => onChange('senha', e.target.value)}
            placeholder="mín. 8 caracteres"
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>

        <label>
          Confirmar senha
          <input
            type="password"
            value={form.confirmarSenha}
            onChange={(e) => onChange('confirmarSenha', e.target.value)}
            placeholder="repita a senha"
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>

        {error ? (
          <div style={alertErrorStyle}>{error}</div>
        ) : success ? (
          <div style={alertSuccessStyle}>{success}</div>
        ) : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Criando...' : 'Criar conta'}
        </button>

        <button
        type="button"
        onClick={() => router.push('/reset-password')}
        style={linkButtonStyle}
        >
        Esqueci minha senha
        </button>

        <button
          type="button"
          onClick={() => router.push('/login')}
          style={linkButtonStyle}
        >
          Já tenho conta → Login
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  marginTop: 6,
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 0,
  cursor: 'pointer',
  fontWeight: 700,
}

const linkButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  cursor: 'pointer',
  background: 'transparent',
}

const alertErrorStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: '1px solid #f3b4b4',
}

const alertSuccessStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: '1px solid #b7e3b7',
}
