'use client'

import React from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function RetroAppShell(props: { title?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-retro-surface p-3 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {props.title ? (
          <div className="retro-window">
            <div className="retro-titlebar">
              <div className="retro-titlebar__title">{props.title}</div>
              <div className="flex gap-1">
                <div className="retro-titlebtn" aria-hidden />
                <div className="retro-titlebtn" aria-hidden />
                <div className="retro-titlebtn" aria-hidden />
              </div>
            </div>
            <div className="p-3 md:p-4">{props.children}</div>
          </div>
        ) : (
          props.children
        )}
      </div>
    </div>
  )
}

export function RetroWindow(props: {
  title: string
  children: React.ReactNode
  className?: string
  rightSlot?: React.ReactNode
}) {
  return (
    <section className={cx('retro-window', props.className)}>
      <div className="retro-titlebar">
        <div className="flex items-center gap-2">
          <span className="retro-dot" />
          <div className="retro-titlebar__title">{props.title}</div>
        </div>
        <div className="flex items-center gap-2">
          {props.rightSlot}
          <div className="flex gap-1">
            <div className="retro-titlebtn" aria-hidden />
            <div className="retro-titlebtn" aria-hidden />
            <div className="retro-titlebtn" aria-hidden />
          </div>
        </div>
      </div>
      <div className="p-3 md:p-4">{props.children}</div>
    </section>
  )
}

export function RetroButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'danger' }) {
  const { className, variant = 'default', ...rest } = props
  return (
    <button
      {...rest}
      className={cx(
        'retro-btn',
        variant === 'danger' && 'retro-btn--danger',
        rest.disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    />
  )
}

export function RetroField(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="retro-label">{props.label}</label>
      {props.children}
      {props.hint ? <div className="retro-hint">{props.hint}</div> : null}
    </div>
  )
}

export function RetroInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return <input {...rest} className={cx('retro-input', className)} />
}

export function RetroSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return <select {...rest} className={cx('retro-input', className)} />
}

export function RetroTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return <textarea {...rest} className={cx('retro-input', className)} />
}

export function RetroBadge(props: { children: React.ReactNode; tone?: 'ok' | 'warn' | 'info' }) {
  const tone = props.tone ?? 'info'
  return (
    <span
      className={cx(
        'inline-flex items-center px-2 py-0.5 text-xs font-bold border',
        'bg-white',
        tone === 'ok' && 'border-green-600 text-green-700',
        tone === 'warn' && 'border-red-600 text-red-700',
        tone === 'info' && 'border-blue-700 text-blue-800'
      )}
    >
      {props.children}
    </span>
  )
}

export function RetroDivider() {
  return <div className="retro-divider" />
}

export function RetroLog(props: { lines: string[] }) {
  return (
    <div className="retro-panel">
      <div className="retro-panel__title">Log</div>
      <ul className="list-disc pl-5 text-sm">
        {props.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

export function RetroListBox(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="retro-panel">
      <div className="retro-panel__title">{props.title}</div>
      <div className="mt-2">{props.children}</div>
    </div>
  )
}
