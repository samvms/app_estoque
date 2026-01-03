// src/modules/shared/ui/app.tsx
'use client'

import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Boxes,
  ClipboardList,
  Home,
  LayoutGrid,
  QrCode,
  Truck,
  Package,
  MapPin,
  Users,
  Shield,
  Settings,
  Plug,
  FileText,
  Menu,
  ChevronLeft,
  Search,
  X,
} from 'lucide-react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type NavItem = { label: string; href: string; icon: any }
type NavSection = { title: string; items: NavItem[] }

type NotifType = 'INTEGRACAO' | 'OPERACAO' | 'QUALIDADE'
type Notif = {
  id: string
  type: NotifType
  title: string
  detail?: string
  href?: string
  createdAt: string
  priority: 1 | 2 | 3
}

const NAV: NavSection[] = [
  {
    title: 'Operação',
    items: [
      { label: 'Home', href: '/home', icon: Home },
      { label: 'QR', href: '/qr', icon: QrCode },
      { label: 'Estoques', href: '/estoques', icon: Boxes },
      { label: 'Contagens', href: '/contagens', icon: ClipboardList },
      { label: 'Recebimentos', href: '/recebimentos', icon: Truck },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { label: 'Produtos', href: '/produtos', icon: Package },
      { label: 'Variantes', href: '/variantes', icon: LayoutGrid },
      { label: 'Locais', href: '/locais', icon: MapPin },
      { label: 'Fornecedores', href: '/fornecedores', icon: FileText },
    ],
  },
  {
    title: 'Integrações',
    items: [
      { label: 'Visão geral', href: '/integracoes', icon: Plug },
      { label: 'Conectores', href: '/integracoes/conectores', icon: Plug },
      { label: 'Logs', href: '/integracoes/logs', icon: FileText },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Usuários', href: '/admin/usuarios', icon: Users },
      { label: 'Auditoria', href: '/admin/auditoria', icon: Shield },
      { label: 'Configurações', href: '/admin/config', icon: Settings },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/home') return pathname === '/home' || pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function labelFromPath(pathname: string) {
  const map: Record<string, string> = {
    '/home': 'Home',
    '/qr': 'QR',
    '/estoques': 'Estoques',
    '/contagens': 'Contagens',
    '/recebimentos': 'Recebimentos',
    '/produtos': 'Produtos',
    '/variantes': 'Variantes',
    '/locais': 'Locais',
    '/fornecedores': 'Fornecedores',
    '/integracoes': 'Integrações',
    '/integracoes/conectores': 'Conectores',
    '/integracoes/logs': 'Logs',
    '/admin/usuarios': 'Usuários',
    '/admin/auditoria': 'Auditoria',
    '/admin/config': 'Configurações',
  }

  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  const found = keys.find((k) => pathname === k || pathname.startsWith(k + '/'))
  return found ? map[found] : 'App'
}

function badgeToneByType(t: NotifType): 'info' | 'warn' {
  if (t === 'INTEGRACAO') return 'info'
  return 'warn'
}

// MVP mock
function useMockNotifications(): Notif[] {
  return [
    {
      id: 'n1',
      type: 'OPERACAO',
      title: 'Recebimento ABERTO há 2 dias',
      detail: 'Verificar divergências e finalizar.',
      href: '/recebimentos',
      createdAt: '2026-01-01T00:00:00.000Z', // ✅ fixo (sem Date)
      priority: 1,
    },
    {
      id: 'n2',
      type: 'INTEGRACAO',
      title: 'Job de integração atrasado',
      detail: 'Última execução há 6h.',
      href: '/integracoes/logs',
      createdAt: '2026-01-01T00:00:00.000Z', // ✅ fixo (sem Date)
      priority: 2,
    },
  ]
}


export function AppShell(props: {
  /** Wordmark (desktop header + sidebar expandido) */
  brand?: ReactNode
  /** Ícone (sidebar colapsado + mobile header) */
  brandIcon?: ReactNode
  children: ReactNode
  rightSlot?: ReactNode
}) {
  const pathname = usePathname()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const notifs = useMockNotifications()
  const notifCount = useMemo(() => notifs.filter((n) => n.priority <= 2).length, [notifs])

  const currentLabel = labelFromPath(pathname)

  const brand = props.brand ?? <span className="text-sm font-extrabold tracking-tight">App</span>

  // ✅ Default: usa favicon (transparente) para colapsado/mobile
  const brandIcon =
    props.brandIcon ?? (
      <img src="/brand/favicon/lws-48.png" alt="LWS" className="block w-9 h-9" draggable={false} />
    )

  useEffect(() => {
    try {
      const v = localStorage.getItem('lws_sidebar_collapsed')
      if (v === '1') setSidebarCollapsed(true)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('lws_sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch {}
  }, [sidebarCollapsed])

  useEffect(() => {
    setSidebarOpenMobile(false)
  }, [pathname])

  useEffect(() => {
  const open = sidebarOpenMobile || notifOpen
  const html = document.documentElement
  const body = document.body

  if (open) {
    html.classList.add('lws-scroll-lock')
    body.classList.add('lws-scroll-lock')
  } else {
    html.classList.remove('lws-scroll-lock')
    body.classList.remove('lws-scroll-lock')
  }

  return () => {
    html.classList.remove('lws-scroll-lock')
    body.classList.remove('lws-scroll-lock')
  }
}, [sidebarOpenMobile, notifOpen])


  return (
    <div className="lws-shell">
      <div className="flex">
        {/* Sidebar desktop */}
        <aside
          className={cx(
            'lws-sidebar hidden md:flex flex-col',
            // ✅ um pouco mais largo no colapsado para ficar premium + dar respiro no ícone
            sidebarCollapsed ? 'w-[76px]' : 'w-[248px]'
          )}
          style={{ minHeight: 0 }}
        >
          {/* Top area */}
          <div className={cx('px-3 py-3 flex items-center', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
            {/* Brand area */}
            {sidebarCollapsed ? (
              <div
                className="flex items-center justify-center rounded-2xl"
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(15,76,92,.08)',
                }}
                title="Moura LWS"
              >
                <div className="[&_img]:bg-transparent [&_img]:block">{brandIcon}</div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 [&_img]:block [&_img]:bg-transparent">{brand}</div>
              </div>
            )}

            {/* Collapse/Expand */}
            {!sidebarCollapsed ? (
              <button
                className="app-btn app-btn--ghost !px-2 !py-2 !border-0"
                style={{ background: 'transparent' }}
                onClick={() => setSidebarCollapsed(true)}
                title="Recolher menu"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <button
                className="app-btn app-btn--ghost !px-2 !py-2 !border-0 mt-2"
                style={{ background: 'transparent' }}
                onClick={() => setSidebarCollapsed(false)}
                title="Expandir menu"
              >
                <ChevronLeft className="rotate-180" size={18} />
              </button>
            )}
          </div>

          <nav className="lws-sidebar-scroll px-2 pb-3" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {NAV.map((sec) => (
              <div key={sec.title} className="mb-3">
                {!sidebarCollapsed && <div className="lws-section-title">{sec.title}</div>}
                <div className="flex flex-col gap-1">
                  {sec.items.map((it) => {
                    const active = isActive(pathname, it.href)
                    const Icon = it.icon
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={cx('lws-nav-item', active && 'lws-nav-item--active', sidebarCollapsed && 'justify-center')}
                        title={sidebarCollapsed ? it.label : undefined}
                      >
                        <Icon size={16} className="opacity-80" />
                        {!sidebarCollapsed && <span className="font-semibold">{it.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Sidebar mobile (drawer) */}
        {sidebarOpenMobile && (
          <>
            {/* backdrop acima do header pra bloquear clique no sininho */}
            <div
              className="fixed inset-0 md:hidden"
              style={{ background: 'rgba(11,18,32,.35)', zIndex: 75 }}
              onClick={() => setSidebarOpenMobile(false)}
            />

            <aside
              className="fixed left-0 top-0 md:hidden flex flex-col"
              style={{
                width: 280,
                height: '100dvh',
                zIndex: 80,
                background: 'rgba(255,255,255,.72)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRight: '1px solid var(--app-border)',
                minHeight: 0,
              }}
            >
              {/* header do drawer */}
              <div className="px-3 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center min-w-0 gap-2">
                  <div className="[&_img]:bg-transparent shrink-0">{brandIcon}</div>
                  <div className="min-w-0 [&_img]:block [&_img]:bg-transparent">{brand}</div>
                </div>

                <button className="app-btn app-btn--ghost !px-2 !py-2" onClick={() => setSidebarOpenMobile(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* ✅ scroll 100% garantido no mobile */}
              <nav
                className="lws-sidebar-scroll px-2 pb-3"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
                  overscrollBehavior: 'contain',
                  touchAction: 'pan-y',

                }}
              >
                {NAV.map((sec) => (
                  <div key={sec.title} className="mb-3">
                    <div className="lws-section-title">{sec.title}</div>
                    <div className="flex flex-col gap-1">
                      {sec.items.map((it) => {
                        const active = isActive(pathname, it.href)
                        const Icon = it.icon
                        return (
                          <Link key={it.href} href={it.href} className={cx('lws-nav-item', active && 'lws-nav-item--active')}>
                            <Icon size={16} className="opacity-80" />
                            <span className="font-semibold">{it.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>
          </>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Glass Header */}
          <header className="lws-header-glass">
            <div className="h-full px-3 md:px-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="app-btn app-btn--ghost !px-2 !py-2 md:hidden"
                  onClick={() => setSidebarOpenMobile(true)}
                  title="Menu"
                >
                  <Menu size={18} />
                </button>

                {/* Mobile: icon | Desktop: wordmark */}
                <div className="md:hidden shrink-0 [&_img]:bg-transparent">{brandIcon}</div>
                <div className="hidden md:block shrink-0 [&_img]:bg-transparent">{brand}</div>

                <div className="flex flex-col leading-tight min-w-0">
                  <div className="text-[12px] text-app-muted font-extrabold">Smartway</div>
                  <div className="text-[14px] font-extrabold tracking-tight truncate">{currentLabel}</div>
                </div>
              </div>

              {/* Centro: busca global */}
              <div className="hidden lg:flex items-center gap-2 w-[420px]">
                <div className="app-card flex items-center gap-2 px-3 py-2 w-full">
                  <Search size={16} className="opacity-70" />
                  <input className="w-full bg-transparent outline-none text-[14px]" placeholder="Buscar (SKU, produto, QR)..." />
                </div>
              </div>

              {/* Direita */}
              <div className="flex items-center gap-2">
                {props.rightSlot ? <div className="hidden md:flex items-center gap-2">{props.rightSlot}</div> : null}

                <button className="app-btn app-btn--ghost !px-2 !py-2 relative" onClick={() => setNotifOpen(true)} title="Notificações">
                  <Bell size={18} />
                  {notifCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'var(--app-accent)',
                        color: '#fff',
                        boxShadow: '0 8px 18px rgba(42,157,143,.22)',
                      }}
                    >
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </button>

                <button className="app-btn app-btn--ghost !px-3 !py-2" title="Conta">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                      style={{ background: 'rgba(15,76,92,.10)', color: 'var(--app-primary)', fontWeight: 900 }}
                    >
                      SA
                    </span>
                    <span className="hidden sm:inline text-[14px] font-extrabold">Sam</span>
                  </span>
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="px-3 md:px-5 py-4 bg-app min-h-[calc(100vh-60px)]">{props.children}</main>
        </div>
      </div>

      {/* Notifications Drawer */}
      {notifOpen && (
        <>
          <div className="lws-drawer-backdrop" onClick={() => setNotifOpen(false)} />
          <aside className="lws-drawer">
            <div className="p-4 lws-drawer-head">
              <div className="flex items-center justify-between">
                <div className="text-[16px] font-semibold tracking-tight">Notificações</div>
                <button className="app-btn app-btn--ghost !px-2 !py-2" onClick={() => setNotifOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="text-[13px] text-app-muted mt-1">Sinal operacional (integrações, operação travada, qualidade de dados).</div>
            </div>

            <div className="p-4 flex flex-col gap-3 lws-drawer-scroll h-[calc(100vh-76px)]">
              {notifs.length === 0 ? (
                <div className="app-card p-4 text-app-muted">Sem notificações.</div>
              ) : (
                notifs
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((n) => (
                    <div key={n.id} className="app-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={badgeToneByType(n.type)}>
                              {n.type === 'INTEGRACAO' ? 'Integração' : n.type === 'OPERACAO' ? 'Operação' : 'Qualidade'}
                            </Badge>
                            <span className="text-[12px] text-app-muted font-semibold">P{n.priority}</span>
                          </div>

                          <div className="mt-2 font-semibold">{n.title}</div>
                          {n.detail ? <div className="mt-1 text-[13px] text-app-muted">{n.detail}</div> : null}
                        </div>

                        {n.href ? (
                          <Link className="app-btn app-btn--secondary !py-2 !px-3" href={n.href}>
                            Ver
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

/** Card/Buttons/Badge/StatCard */
export function Card(props: { title?: string; subtitle?: string; rightSlot?: React.ReactNode; children: React.ReactNode; className?: string }) {
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
  }
) {
  const { className, variant = 'primary', children, ...rest } = props

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
    >
      {children}
    </button>
  )
}

export function Badge(props: { children: React.ReactNode; tone?: 'info' | 'ok' | 'warn' }) {
  const tone = props.tone ?? 'info'
  return <span className={cx('app-badge', tone === 'info' && 'app-badge--info', tone === 'ok' && 'app-badge--ok', tone === 'warn' && 'app-badge--warn')}>{props.children}</span>
}

export function StatCard(props: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('app-stat', props.className)}>
      <div className="text-xs font-medium text-app-muted">{props.title}</div>
      <div className="mt-2 text-sm text-app-fg">{props.children}</div>
    </div>
  )
}
