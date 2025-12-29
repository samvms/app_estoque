'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AbrirRecebimentoPage() {
  const router = useRouter();

  const [referencia, setReferencia] = useState('');
  const [tipo, setTipo] = useState<'AMOSTRA' | 'TOTAL'>('AMOSTRA');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCallback(async () => {
    setErro(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_criar_recebimento', {
          p_referencia: referencia || null,
          p_tipo_conferencia: tipo,
        });

      if (error) throw error;

      const id = data as string;
      router.push(`/recebimentos/${id}`);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao criar recebimento.');
    } finally {
      setLoading(false);
    }
  }, [referencia, tipo, router]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Criar recebimento</div>
        <button className="retro-btn" onClick={() => router.back()} disabled={loading}>
          Voltar
        </button>
      </div>

      {erro && (
        <div style={{ padding: 12, border: '1px solid #000', background: '#fff' }}>
          <b>Erro:</b> {erro}
        </div>
      )}

      {/* Form */}
      <div style={{ padding: 12, border: '1px solid #000', background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontWeight: 800 }}>Referência (opcional)</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="NF, pedido, container, etc."
            disabled={loading}
            style={{ height: 34 }}
          />
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontWeight: 800 }}>Tipo de conferência</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'AMOSTRA' | 'TOTAL')}
            disabled={loading}
            style={{ height: 34, fontWeight: 700 }}
          >
            <option value="AMOSTRA">AMOSTRA</option>
            <option value="TOTAL">TOTAL</option>
          </select>
        </div>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          className="retro-btn retro-btn--primary"
          onClick={criar}
          disabled={loading}
        >
          Criar recebimento
        </button>
      </div>
    </div>
  );
}
