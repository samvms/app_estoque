'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RetroWindow, RetroButton } from '@/modules/shared/ui/retro'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const disabled = useMemo(() => {
    return loading || !senha || !confirmar
  }, [loading, senha, confirmar])

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
      setError(
        err?.message ||
          'Não foi possível atualizar a senha. Abra o link do e-mail novamente e tente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <RetroWindow title="Atualizar senha" subtitle="Defina sua nova senha">
        <form onSubmit={handleUpdate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Nova senha</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-3 text-base"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mín. 8 caracteres"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Confirmar nova senha</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-3 text-base"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
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
          ) : msg ? (
            <div className="rounded border p-3 text-sm">
              <p className="font-semibold">Ok</p>
              <p className="opacity-80">{msg}</p>
            </div>
          ) : null}

          <div className="grid gap-2 md:grid-cols-2">
            <RetroButton type="submit" className="w-full py-3" disabled={disabled}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
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
