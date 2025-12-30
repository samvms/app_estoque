// src/app/(app)/recebimentos/abrir/page.tsx
'use client'

import React, { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

export default function AbrirRecebimentoPage() {
  const router = useRouter()

  const [referencia, setReferencia] = useState('')
  const [tipo, setTipo] = useState<'AMOSTRA' | 'TOTAL'>('AMOSTRA')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const criar = useCallback(async () => {
    setErro(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.schema('app_estoque').rpc('fn_criar_recebimento', {
        p_referencia: referencia || null,
        p_tipo_conferencia: tipo,
      })

      if (error) throw error

      const id = data as string
      router.push(`/recebimentos/${id}`)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao criar recebimento.')
    } finally {
      setLoading(false)
    }
  }, [referencia, tipo, router])

  return (
    <div className="space-y-4">
      <Card
        title="Criar recebimento"
        subtitle="Defina a referência e o tipo de conferência"
        rightSlot={<Badge tone="info">Recebimentos</Badge>}
      >
        <div className="grid grid-cols-1 gap-2">
          <Button className="w-full py-3" variant="ghost" onClick={() => router.back()} disabled={loading}>
            Voltar
          </Button>
        </div>
      </Card>

      {erro ? (
        <Card title="Erro" subtitle="Não foi possível criar o recebimento">
          <div className="text-sm font-semibold text-red-600">{erro}</div>
        </Card>
      ) : null}

      <Card title="Dados" subtitle="Preencha para iniciar o recebimento">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-app-fg">Referência (opcional)</label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="NF, pedido, container, etc."
              disabled={loading}
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none"
            />
            <div className="text-xs text-app-muted">Use algo que ajude a operação a identificar rápido.</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-app-fg">Tipo de conferência</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'AMOSTRA' | 'TOTAL')}
              disabled={loading}
              className="w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm font-medium text-app-fg outline-none"
            >
              <option value="AMOSTRA">AMOSTRA</option>
              <option value="TOTAL">TOTAL</option>
            </select>
          </div>

          <Button className="w-full py-3" onClick={criar} disabled={loading}>
            {loading ? 'Criando…' : 'Criar recebimento'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
