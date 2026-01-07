'use client'

import React from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Card/Buttons/Badge/StatCard (somente primitives) */
export function Card(props: {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cx('app-card', props.className)}>
      {props.title || props.subtitle || props.rightSlot ? (
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
          <div className="min-w-0">
            {props.title ? <div className="text-sm font-semibold text-app-fg">{props.title}</div> : null}
            {props.subtitle ? <div className="mt-0.5 text-xs text-app-muted">{props.subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2">{props.rightSlot}</div>
        </div>
      ) : null}

      <div className="px-4 py-4">{props.children}</div>
    </section>
  )
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    loading?: boolean
  }
) {
  const { className, variant = 'primary', children, loading, ...rest } = props

  return (
    <button
      {...rest}
      className={cx(
        'app-btn',
        'flex items-center justify-center gap-2',
        variant === 'primary' && 'app-btn--primary',
        variant === 'secondary' && 'app-btn--secondary',
        variant === 'ghost' && 'app-btn--ghost',
        variant === 'danger' && 'app-btn--danger',
        rest.disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      disabled={rest.disabled || !!loading}
    >
      {loading ? 'Carregando…' : children}
    </button>
  )
}

export function Badge(props: { children: React.ReactNode; tone?: 'info' | 'ok' | 'warn' | 'danger' }) {
  const tone = props.tone ?? 'info'
  return (
    <span
      className={cx(
        'app-badge',
        tone === 'info' && 'app-badge--info',
        tone === 'ok' && 'app-badge--ok',
        tone === 'warn' && 'app-badge--warn',
        tone === 'danger' && 'app-badge--warn'
      )}
    >
      {props.children}
    </span>
  )
}

export function StatCard(props: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('app-stat', props.className)}>
      <div className="text-xs font-medium text-app-muted">{props.title}</div>
      <div className="mt-2 text-sm text-app-fg">{props.children}</div>
    </div>
  )
}
