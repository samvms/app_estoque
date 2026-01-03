'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, Button, Badge } from '@/modules/shared/ui/app'

const LIMIT = 50
const TZ = 'America/Sao_Paulo'

function fmtBR(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

type Row = {
  id: string
  nome: string
  ativo: boolean
  next_cursor_nome: string | null
  next_cursor_id: string | null
}

export default function LocaisPage() {
  const [nomePrefix, setNomePrefix] = useState('')
  const [ativo, setAtivo] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS')

  const [novoNome, setNovoNome] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [cursorNome, setCursorNome] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const ativoParam = ativo === 'TODOS' ? null : ativo === 'ATIVO'

  async function fetchPage(reset: boolean) {
    if (loading) return
    setLoading(true)
    setErr(null)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_listar_locais_paginado', {
          p_limit: LIMIT,
          p_nome_prefix: nomePrefix.trim() || null,
          p_ativo: ativoParam,
          p_cursor_nome: reset ? null : cursorNome,
          p_cursor_id: reset ? null : cursorId,
        })

      if (error) throw error
      const list = (data ?? []) as Row[]
      setRows((prev) => (reset ? list : prev.concat(list)))

      const last = list.length ? list[list.length - 1] : null
      setCursorNome(last?.next_cursor_nome ?? null)
      setCursorId(last?.next_cursor_id ?? null)
      setHasMore(Boolean(last?.next_cursor_nome && last?.next_cursor_id && list.length === LIMIT))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  function aplicar() {
    setCursorNome(null); setCursorId(null); setHasMore(true)
    fetchPage(true)
  }

  function limpar() {
    setNomePrefix('')
    setAtivo('TODOS')
    setCursorNome(null); setCursorId(null); setHasMore(true)
    fetchPage(true)
  }

  async function criarLocal() {
    const nome = novoNome.trim()
    if (!nome) return
    setLoading(true); setErr(null)

    try {
      const { data, error } = await supabase
        .schema('app_estoque')
        .rpc('fn_criar_local', { p_nome: nome })

      if (error) throw error
      setNovoNome('')
      await fetchPage(true)
      return data
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao criar local.')
    } finally {
      setLoading(false)
    }
  }

  async function toggle(id: string, novoAtivo: boolean) {
    if (busyId) return
    setBusyId(id); setErr(null)

    try {
      const { error } = await supabase
        .schema('app_estoque')
        .rpc('fn_toggle_local', { p_local_id: id, p_ativo: novoAtivo })

      if (error) throw error
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ativo: novoAtivo } : r)))
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao atualizar.')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => { fetchPage(true) }, [])

  return (
    <div className="space-y-4">
      <Card
        title="Locais"
        subtitle="Gestão de locais usados na operação"
        rightSlot={<Badge tone="info">Operação</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={nomePrefix}
            onChange={(e) => setNomePrefix(e.target.value)}
            placeholder="Nome (prefixo)"
            className="app-card px-3 py-2 text-sm outline-none"
          />

          <select
            value={ativo}
            onChange={(e) => setAtivo(e.target.value as any)}
            className="app-card px-3 py-2 text-sm outline-none"
          >
            <option value="TODOS">Status: todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>

          <div className="flex gap-2">
            <Button variant="primary" onClick={aplicar} disabled={loading}>Aplicar</Button>
            <Button variant="ghost" onClick={limpar} disabled={loading}>Limpar</Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Novo local…"
            className="app-card px-3 py-2 text-sm outline-none"
          />
          <Button variant="secondary" onClick={criarLocal} disabled={loading || !novoNome.trim()}>
            Criar
          </Button>
        </div>

        {err ? <div className="mt-3 text-sm" style={{ color: 'var(--app-danger)' }}>{err}</div> : null}
      </Card>

      <Card
        title="Listagem"
        subtitle={`${rows.length} itens`}
        rightSlot={<Badge tone={loading ? 'warn' : 'ok'}>{loading ? 'Carregando' : 'OK'}</Badge>}
      >
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-2 pr-4">Local</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-app-muted">Sem resultados.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-app-border">
                  <td className="py-3 pr-4 font-semibold">{r.nome}</td>
                  <td className="py-3 pr-4">{r.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="py-3">
                    <Button
                      variant={r.ativo ? 'ghost' : 'secondary'}
                      onClick={() => toggle(r.id, !r.ativo)}
                      disabled={busyId === r.id}
                    >
                      {r.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => fetchPage(false)} disabled={loading || !hasMore}>
            {hasMore ? 'Carregar mais' : 'Fim'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
