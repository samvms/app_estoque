'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type TipoContagem = 'INICIAL' | 'PERIODICA';

export default function AbrirContagemPage() {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoContagem>('PERIODICA');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_abrir_contagem', {
            p_tipo: tipo, // 'INICIAL' | 'PERIODICA'
            p_local_padrao_id: null,
        });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    // data é UUID da contagem criada
    const contagemId = data as unknown as string;
    router.push(`/contagens/${contagemId}`);
  }

  return (
    <div className="retro-window">
      <div className="retro-titlebar">
        <button className="retro-btn" onClick={() => router.back()} aria-label="Voltar">
          ←
        </button>
        <span>Abrir contagem</span>
      </div>

      <div className="retro-content">
        <div className="retro-card">
          <div style={{ marginBottom: 8 }}>
            <strong>Tipo de contagem</strong>
          </div>

          <div className="retro-actions">
            <label className="retro-card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="tipo"
                value="PERIODICA"
                checked={tipo === 'PERIODICA'}
                onChange={() => setTipo('PERIODICA')}
                disabled={loading}
              />
              <span>Periódica</span>
            </label>

            <label className="retro-card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="tipo"
                value="INICIAL"
                checked={tipo === 'INICIAL'}
                onChange={() => setTipo('INICIAL')}
                disabled={loading}
              />
              <span>Inicial</span>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="retro-btn primary" onClick={abrir} disabled={loading}>
              {loading ? 'Abrindo...' : 'Abrir contagem'}
            </button>
          </div>

          {erro && (
            <div className="retro-card" style={{ marginTop: 12 }}>
              <strong>Erro</strong>
              <div className="retro-muted">{erro}</div>
            </div>
          )}

          <div className="retro-muted" style={{ marginTop: 12 }}>
            Observação: local padrão será definido depois (na bipagem).
          </div>
        </div>
      </div>
    </div>
  );
}
