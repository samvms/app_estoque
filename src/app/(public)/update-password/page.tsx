'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      // Quando o usuário chega aqui pelo link do e-mail, o Supabase
      // já estabelece a sessão no browser. Aí updateUser funciona.
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error

      setMsg('Senha atualizada com sucesso. Faça login novamente.')
      // opcional: desloga para forçar login limpo
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err: any) {
      setError(
        err?.message ||
          'Não foi possível atualizar a senha. Abra o link do e-mail novamente e tente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Atualizar senha
      </h1>

      <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 10 }}>
        <label>
          Nova senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mín. 8 caracteres"
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>

        <label>
          Confirmar nova senha
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="repita a senha"
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>

        {error ? (
          <div style={alertErrorStyle}>{error}</div>
        ) : msg ? (
          <div style={alertSuccessStyle}>{msg}</div>
        ) : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/login')}
          style={linkButtonStyle}
        >
          Voltar para login
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
