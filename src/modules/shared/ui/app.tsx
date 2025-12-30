'use client'

import React from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function AppShell(props: { title?: string; children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-app px-3 py-4 md:px-6 md:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight text-app-fg">
              {props.title ?? ''}
            </div>
            <div className="text-sm text-app-muted">Operação • Estoque físico</div>
          </div>

          <div className="flex items-center gap-2">{props.rightSlot}</div>
        </header>

        <main>{props.children}</main>
      </div>
    </div>
  )
}

export function Card(props: { title?: string; subtitle?: string; rightSlot?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('app-card', props.className)}>
      {(props.title || props.subtitle || props.rightSlot) ? (
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
  }
) {
  const { className, variant = 'primary', ...rest } = props

  return (
    <button
      {...rest}
      className={cx(
        'app-btn',
        variant === 'primary' && 'app-btn--primary',
        variant === 'secondary' && 'app-btn--secondary',
        variant === 'ghost' && 'app-btn--ghost',
        variant === 'danger' && 'app-btn--danger',
        rest.disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    />
  )
}

export function Badge(props: { children: React.ReactNode; tone?: 'info' | 'ok' | 'warn' }) {
  const tone = props.tone ?? 'info'
  return (
    <span
      className={cx(
        'app-badge',
        tone === 'info' && 'app-badge--info',
        tone === 'ok' && 'app-badge--ok',
        tone === 'warn' && 'app-badge--warn'
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
