'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button } from '@/modules/shared/ui/primitives'

type CtxBasico = {
  tem_perfil: boolean
  empresa_id: string | null
}

function slugCodigo(s: string) {
  return (s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24)
}

export default function CriarEmpresaClient() {
  const router = useRouter()

  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const disabled = useMemo(() => {
    if (carregando) return true
    if (!nomeEmpresa.trim()) return true
    // codigo pode ser gerado automaticamente se vazio
    return false
  }, [carregando, nomeEmpresa])

  // se já tiver perfil ativo, não deixa ficar aqui
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.schema('core').rpc('fn_contexto_sessao')
      if (!alive) return
      if (error) return
      const ctx = (Array.isArray(data) ? data[0] : data) as CtxBasico | undefined
      if (ctx?.tem_perfil) {
        router.replace('/home')
        router.refresh()
      }
    })()
    return () => {
      alive = false
    }
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return

    setErro(null)
    setCarregando(true)

    const codigoFinal = slugCodigo(codigo || nomeEmpresa)

    const { data, error } = await supabase.schema('core').rpc('fn_onboarding_criar_empresa', {
      p_codigo: codigoFinal,
      p_nome: nomeEmpresa.trim(),
      p_cnpj: cnpj.trim() ? cnpj.trim() : null,
    })


    setCarregando(false)

    if (error) {
      setErro(error.message ?? 'Erro ao criar empresa.')
      return
    }

    // data deve ser empresa_id (uuid), mas não precisamos usar aqui
    router.replace('/home')
    router.refresh()
  }

  return (
    <Card
      title="Configurar empresa"
      subtitle="Leva menos de 1 minuto para começar"
      className="max-w-md mx-auto"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Nome da empresa</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            type="text"
            required
            placeholder="Ex.: Mercadinho LTDA"
            disabled={carregando}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Código (opcional)</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            type="text"
            placeholder="Se vazio, será gerado do nome"
            disabled={carregando}
          />
          <div className="text-[11px] text-app-muted">
            Código final: <span className="font-semibold">{slugCodigo(codigo || nomeEmpresa) || '—'}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">CNPJ (opcional)</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            type="text"
            inputMode="numeric"
            placeholder="Somente números"
            disabled={carregando}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Seu nome (opcional)</label>
          <input
            className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none
                       focus:border-app-primary focus:ring-2 focus:ring-app-primary/20 transition"
            value={nomeUsuario}
            onChange={(e) => setNomeUsuario(e.target.value)}
            type="text"
            placeholder="Ex.: Mohammed"
            disabled={carregando}
          />
        </div>

        {erro ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-600">Não foi possível concluir</div>
            <div className="mt-0.5 text-xs text-red-700/80">{erro}</div>
          </div>
        ) : null}

        <div className="space-y-2 pt-2">
          <Button type="submit" className="w-full py-3 text-sm" disabled={disabled} loading={carregando}>
            Criar empresa e entrar
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="w-full py-3 text-sm"
            disabled={carregando}
            onClick={() => router.replace('/login')}
          >
            Voltar
          </Button>
        </div>
      </form>
    </Card>
  )
}
