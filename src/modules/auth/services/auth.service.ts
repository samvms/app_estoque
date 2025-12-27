import { supabase } from '@/lib/supabase/client'

export type ResultadoAuth<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string }

export async function loginComEmailSenha(
  email: string,
  senha: string
): Promise<ResultadoAuth<null>> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) return { ok: false, erro: error.message }
  return { ok: true, dados: null }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function sessaoAtual() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session
}

export async function usuarioAtual() {
  const session = await sessaoAtual()
  return session?.user ?? null
}
