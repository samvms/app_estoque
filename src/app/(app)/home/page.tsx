'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ScannerQR } from '@/modules/inventory/ui/ScannerQR'


type TipoConferencia = 'AMOSTRAGEM' | 'TOTAL'
type ResultadoConferencia = 'OK' | 'DIVERGENTE'
type TipoEvidencia = 'FOTO' | 'VIDEO'

type Evidencia = {
  id: string
  tipo: TipoEvidencia
  storage_path: string
  criado_em: string
}

export default function HomePage() {
  // Conferência
  const [qr, setQr] = useState('')
  const [tipo, setTipo] = useState<TipoConferencia>('TOTAL')
  const [resultado, setResultado] = useState<ResultadoConferencia>('OK')
  const [divergencia, setDivergencia] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [carregandoConferencia, setCarregandoConferencia] = useState(false)
  const [erroConferencia, setErroConferencia] = useState<string | null>(null)
  const [conferenciaId, setConferenciaId] = useState<string | null>(null)

  // Evidências
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>('FOTO')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [carregandoEvidencias, setCarregandoEvidencias] = useState(false)
  const [erroEvidencias, setErroEvidencias] = useState<string | null>(null)
  const [logEnvio, setLogEnvio] = useState<string[]>([])

  // Listagem
  const [listaEvidencias, setListaEvidencias] = useState<Evidencia[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const podeEnviarEvidencias = useMemo(() => {
    return Boolean(conferenciaId && arquivos.length > 0 && !carregandoEvidencias)
  }, [conferenciaId, arquivos.length, carregandoEvidencias])

  async function registrarConferencia() {
    setErroConferencia(null)
    setConferenciaId(null)

    // reset evidências quando cria nova conferência
    setArquivos([])
    setErroEvidencias(null)
    setLogEnvio([])
    setListaEvidencias([])
    setErroLista(null)

    setCarregandoConferencia(true)

    const { data, error } = await supabase
      .schema('app_estoque')
      .rpc('fn_registrar_conferencia', {
        p_qr_codigo: qr.trim(),
        p_tipo: tipo,
        p_resultado: resultado,
        p_divergencia_descricao: resultado === 'DIVERGENTE' ? divergencia : null,
        p_observacoes: observacoes || null,
      })

    setCarregandoConferencia(false)

    if (error) {
      setErroConferencia(error.message)
      return
    }

    const id = String(data)
    setConferenciaId(id)

    setQr('')
    setDivergencia('')
    setObservacoes('')
  }

  async function carregarEvidencias(conferencia: string) {
    setCarregandoLista(true)
    setErroLista(null)

    const { data, error } = await supabase
      .schema('app_estoque')
      .from('evidencias')
      .select('id,tipo,storage_path,criado_em')
      .eq('conferencia_id', conferencia)
      .order('criado_em', { ascending: false })

    setCarregandoLista(false)

    if (error) {
      setErroLista(error.message)
      return
    }

    setListaEvidencias((data || []) as Evidencia[])
  }

  useEffect(() => {
    if (conferenciaId) carregarEvidencias(conferenciaId)
  }, [conferenciaId])

  async function enviarEvidencias() {
    if (!conferenciaId || arquivos.length === 0) return

    setErroEvidencias(null)
    setLogEnvio([])
    setCarregandoEvidencias(true)

    const logs: string[] = []

    for (const arquivo of arquivos) {
      // 1) pedir pro BANCO gerar o storage_path (ano/mês/modelo/id/arquivo)
      const { data: path, error: erroPath } = await supabase
        .schema('app_estoque')
        .rpc('fn_gerar_storage_path_evidencia', {
          p_conferencia_id: conferenciaId,
          p_nome_arquivo: arquivo.name,
        })

      if (erroPath) {
        logs.push(`❌ ${arquivo.name}: falha ao gerar path (${erroPath.message})`)
        continue
      }

      const storagePath = String(path)

      // 2) upload no Storage usando o path gerado
      const { error: erroUpload } = await supabase.storage
        .from('evidencias')
        .upload(storagePath, arquivo, {
          upsert: false,
          contentType: arquivo.type || undefined,
        })

      if (erroUpload) {
        logs.push(`❌ ${arquivo.name}: falha no upload (${erroUpload.message})`)
        continue
      }

      // 3) registrar no banco (vínculo)
      const { data: evidId, error: erroReg } = await supabase
        .schema('app_estoque')
        .rpc('fn_registrar_evidencia', {
          p_conferencia_id: conferenciaId,
          p_tipo: tipoEvidencia,
          p_storage_path: storagePath,
        })

      if (erroReg) {
        logs.push(`⚠️ ${arquivo.name}: upload OK, mas falhou no banco (${erroReg.message})`)
        continue
      }

      logs.push(`✅ ${arquivo.name}: evidência registrada (${String(evidId)})`)
    }

    setLogEnvio(logs)
    setCarregandoEvidencias(false)

    // limpar seleção e recarregar lista
    setArquivos([])
    await carregarEvidencias(conferenciaId)
  }

  async function obterUrlAssinada(storagePath: string) {
    // bucket privado: gerar URL assinada (MVP)
    const { data, error } = await supabase.storage
      .from('evidencias')
      .createSignedUrl(storagePath, 60 * 5) // 5 minutos

    if (error) return null
    return data.signedUrl
  }

  async function abrirEvidencia(storagePath: string) {
    const url = await obterUrlAssinada(storagePath)
    if (!url) {
      alert('Não foi possível gerar link temporário para a evidência.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Conferência (MVP)</h1>
        <p className="opacity-80">
          1) Registre a conferência via QR. 2) Anexe múltiplas evidências (foto/vídeo).
        </p>
      </div>

      {/* BLOCO CONFERÊNCIA */}
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">1) Registrar conferência</h2>

        <ScannerQR aoLer={(valor) => setQr(valor)} />
        <div className="space-y-1">
          <label className="text-sm">QR Code da caixa</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            placeholder="ex: 3f2a...-...."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm">Tipo</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoConferencia)}
            >
              <option value="TOTAL">TOTAL</option>
              <option value="AMOSTRAGEM">AMOSTRAGEM</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">Resultado</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={resultado}
              onChange={(e) => setResultado(e.target.value as ResultadoConferencia)}
            >
              <option value="OK">OK</option>
              <option value="DIVERGENTE">DIVERGENTE</option>
            </select>
          </div>
        </div>

        {resultado === 'DIVERGENTE' && (
          <div className="space-y-1">
            <label className="text-sm">Descrição da divergência</label>
            <textarea
              className="w-full rounded border px-3 py-2"
              value={divergencia}
              onChange={(e) => setDivergencia(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm">Observações (opcional)</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
          />
        </div>

        {erroConferencia && <p className="text-sm text-red-600">{erroConferencia}</p>}

        {conferenciaId && (
          <div className="rounded border p-3">
            <p className="text-sm opacity-80">Conferência registrada (ID):</p>
            <p className="font-mono text-sm">{conferenciaId}</p>
          </div>
        )}

        <button
          onClick={registrarConferencia}
          disabled={carregandoConferencia || !qr.trim()}
          className="rounded border px-3 py-2 font-medium"
        >
          {carregandoConferencia ? 'Registrando...' : 'Registrar conferência'}
        </button>
      </section>

      {/* BLOCO EVIDÊNCIAS */}
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">2) Anexar evidências</h2>

        {!conferenciaId && (
          <p className="text-sm opacity-80">
            Registre uma conferência primeiro para liberar o envio de evidências.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm">Tipo de evidência</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={tipoEvidencia}
              onChange={(e) => setTipoEvidencia(e.target.value as TipoEvidencia)}
              disabled={!conferenciaId}
            >
              <option value="FOTO">FOTO</option>
              <option value="VIDEO">VIDEO</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">Arquivos</label>
            <input
              className="w-full rounded border px-3 py-2"
              type="file"
              multiple
              accept={tipoEvidencia === 'FOTO' ? 'image/*' : 'video/*'}
              disabled={!conferenciaId}
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                setArquivos(files)
              }}
            />
          </div>
        </div>

        {arquivos.length > 0 && (
          <div className="rounded border p-3">
            <p className="text-sm opacity-80">Selecionados:</p>
            <ul className="list-disc pl-5 text-sm">
              {arquivos.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          </div>
        )}

        {erroEvidencias && <p className="text-sm text-red-600">{erroEvidencias}</p>}

        {logEnvio.length > 0 && (
          <div className="rounded border p-3">
            <p className="text-sm opacity-80">Log do envio:</p>
            <ul className="list-disc pl-5 text-sm">
              {logEnvio.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={enviarEvidencias}
          disabled={!podeEnviarEvidencias}
          className="rounded border px-3 py-2 font-medium"
        >
          {carregandoEvidencias ? 'Enviando...' : 'Enviar evidências'}
        </button>

        <hr />

        <div className="space-y-2">
          <h3 className="font-semibold">Evidências anexadas</h3>

          {carregandoLista && <p className="text-sm opacity-80">Carregando lista...</p>}
          {erroLista && <p className="text-sm text-red-600">{erroLista}</p>}

          {!carregandoLista && !erroLista && listaEvidencias.length === 0 && (
            <p className="text-sm opacity-80">Nenhuma evidência anexada ainda.</p>
          )}

          {listaEvidencias.length > 0 && (
            <div className="space-y-2">
              {listaEvidencias.map((ev) => (
                <div key={ev.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono">{ev.id}</div>
                      <div className="opacity-80">
                        {ev.tipo} • {new Date(ev.criado_em).toLocaleString('pt-BR')}
                      </div>
                      <div className="break-all font-mono text-xs opacity-70">
                        {ev.storage_path}
                      </div>
                    </div>

                    <button
                      className="rounded border px-3 py-2 font-medium"
                      onClick={() => abrirEvidencia(ev.storage_path)}
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
