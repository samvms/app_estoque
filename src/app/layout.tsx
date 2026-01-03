import './globals.css'
import type { Metadata, Viewport } from 'next'
import { PwaRegister } from '@/modules/shared/pwa/PwaRegister'

export const viewport: Viewport = {
  themeColor: '#0A2F38',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  applicationName: 'Moura LWS',
  title: { default: 'Moura LWS', template: '%s · Moura LWS' },
  description: 'Warehouse Management System',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'LWS' },
  icons: {
    icon: [
      { url: '/brand/favicon/lws-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon/lws-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/favicon/lws-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [{ url: '/brand/icon/lws-app-icon-1024.png', sizes: '1024x1024', type: 'image/png' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
