'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

type TipoContagem = 'INICIAL' | 'PERIODICA'

export default function AbrirContagemPage() {
  const router = useRouter()

  const [tipo, setTipo] = useState<TipoContagem>('PERIODICA')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const subtitle = useMemo(() => {
    return tipo === 'PERIODICA'
      ? 'Recontagem para atualizar o estoque físico.'
      : 'Define a base confiável do estoque (primeira contagem).'
  }, [tipo])

  async function abrir() {
    setLoading(true)
    setErro(null)

    const { data, error } = await supabase.schema('app_estoque').rpc('fn_abrir_contagem', {
      p_tipo: tipo,
      p_local_padrao_id: null,
    })

    if (error) {
      setErro(error.message)
      setLoading(false)
      return
    }

    const contagemId = data as unknown as string
    router.push(`/contagens/${contagemId}`)
  }

  return (
    <div className="space-y-4">
      <Card title="Tipo" subtitle={subtitle}>
        <div className="space-y-3">
          <label className="app-card px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="PERIODICA"
              checked={tipo === 'PERIODICA'}
              onChange={() => setTipo('PERIODICA')}
              disabled={loading}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-app-fg">Periódica</div>
              <div className="text-xs text-app-muted">Padrão operacional.</div>
            </div>
          </label>

          <label className="app-card px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="INICIAL"
              checked={tipo === 'INICIAL'}
              onChange={() => setTipo('INICIAL')}
              disabled={loading}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-app-fg">Inicial</div>
              <div className="text-xs text-app-muted">Usar apenas na primeira contagem.</div>
            </div>
          </label>

          <Button className="w-full py-3" onClick={abrir} disabled={loading}>
            {loading ? 'Abrindo…' : 'Abrir contagem'}
          </Button>

          {erro ? (
            <div className="app-card px-4 py-3">
              <div className="text-sm font-semibold text-app-fg">Erro</div>
              <div className="mt-1 text-sm text-red-600">{erro}</div>
            </div>
          ) : null}

          <div className="text-xs text-app-muted">Observação: local padrão será definido na bipagem.</div>
        </div>
      </Card>
    </div>
  )
}
