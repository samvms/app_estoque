'use client'

import React, { useEffect } from 'react'

type ToastTone = 'success' | 'error' | 'warn'
type ToastState = { open: boolean; tone: ToastTone; title: string; message?: string }

export function Toast(props: {
  state: ToastState
  onClose: () => void
  durationMs?: number
}) {
  const { state, onClose, durationMs = 3200 } = props

  useEffect(() => {
    if (!state.open) return
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [state.open, durationMs, onClose])

  if (!state.open) return null

  const border =
    state.tone === 'success'
      ? 'rgba(31,122,90,.30)'
      : state.tone === 'warn'
      ? 'rgba(194,65,12,.28)'
      : 'rgba(194,65,12,.35)'

  const bg =
    state.tone === 'success'
      ? 'rgba(31,122,90,.10)'
      : state.tone === 'warn'
      ? 'rgba(194,65,12,.10)'
      : 'rgba(194,65,12,.12)'

  return (
    <div className="fixed top-4 right-4 z-[9999] w-[min(420px,calc(100vw-24px))]">
      <div
        className="app-card px-4 py-3"
        style={{ borderColor: border, background: bg }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-app-fg">{state.title}</div>
            {state.message ? (
              <div className="mt-1 text-sm text-app-muted">{state.message}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="text-sm font-semibold"
            style={{ color: 'var(--app-fg)' }}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
