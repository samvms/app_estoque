// src/modules/inventory/ui/ScannerQR.tsx
'use client'

import { useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Button, Badge } from '@/modules/shared/ui/app'

type Props = {
  aoLer: (valor: string) => void
  modo?: 'single' | 'continuous'
  cooldownMs?: number
}

export function ScannerQR({ aoLer, modo = 'single', cooldownMs = 1200 }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // anti-loop
  const bloqueadoAteRef = useRef<number>(0)
  const ultimoValorRef = useRef<string | null>(null)

  const [ativo, setAtivo] = useState(false)
  const [status, setStatus] = useState<'parado' | 'iniciando' | 'lendo'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  function parar() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const video = videoRef.current
    if (video) {
      try {
        video.pause()
      } catch {}
      video.srcObject = null
    }

    bloqueadoAteRef.current = 0
    ultimoValorRef.current = null

    setAtivo(false)
    setStatus('parado')
  }

  async function iniciar() {
    setErro(null)
    setStatus('iniciando')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) {
        parar()
        return
      }

      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.setAttribute('muted', 'true')
      video.setAttribute('autoplay', 'true')
      video.muted = true
      video.playsInline = true
      video.autoplay = true

      setAtivo(true)

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout_loadedmetadata')), 3500)
        const handler = () => {
          clearTimeout(timeout)
          video.removeEventListener('loadedmetadata', handler)
          resolve()
        }
        video.addEventListener('loadedmetadata', handler)
      })

      try {
        await video.play()
      } catch (e: any) {
        throw new Error(`play_failed_${e?.name || 'erro'}`)
      }

      setStatus('lendo')

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const lerFrame = () => {
        const v = videoRef.current
        const c = canvasRef.current
        if (!v || !c) return

        if (v.readyState >= 2 && v.videoWidth && v.videoHeight) {
          c.width = v.videoWidth
          c.height = v.videoHeight

          ctx.drawImage(v, 0, 0, c.width, c.height)

          const imageData = ctx.getImageData(0, 0, c.width, c.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          })

          if (code?.data) {
            const agora = Date.now()

            if (agora < bloqueadoAteRef.current) {
              rafRef.current = requestAnimationFrame(lerFrame)
              return
            }

            if (ultimoValorRef.current === code.data) {
              bloqueadoAteRef.current = agora + cooldownMs
              rafRef.current = requestAnimationFrame(lerFrame)
              return
            }

            ultimoValorRef.current = code.data
            bloqueadoAteRef.current = agora + cooldownMs

            aoLer(code.data)

            if (modo === 'single') {
              parar()
              return
            }
          }
        }

        rafRef.current = requestAnimationFrame(lerFrame)
      }

      rafRef.current = requestAnimationFrame(lerFrame)
    } catch (e: any) {
      const msg =
        e?.message === 'timeout_loadedmetadata'
          ? 'A câmera foi autorizada, mas o vídeo não inicializou (timeout).'
          : String(e?.message || e?.name || 'erro_desconhecido')

      setErro(`Erro câmera: ${msg}`)
      parar()
    }
  }

  async function alternar() {
    if (ativo) {
      parar()
      return
    }
    await iniciar()
  }

  const tone = status === 'lendo' ? 'ok' : status === 'iniciando' ? 'info' : 'warn'

  return (
    <div className="app-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-app-fg">Leitura por câmera</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-app-muted">
            <span>Status:</span>
            <Badge tone={tone}>
              {status === 'parado' ? 'Parado' : status === 'iniciando' ? 'Iniciando' : 'Lendo'}
              {modo === 'continuous' ? ' • Contínuo' : ''}
            </Badge>
          </div>
        </div>

        <Button type="button" variant={ativo ? 'secondary' : 'primary'} className="px-4 py-3" onClick={alternar}>
          {ativo ? 'Parar' : 'Iniciar'}
        </Button>
      </div>

      {erro ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative overflow-hidden rounded-2xl border border-app-border bg-black">
          <video
            ref={videoRef}
            className="w-full min-h-[240px] object-cover"
            playsInline
            muted
            autoPlay
          />
          {!ativo ? (
            <div className="absolute inset-0 grid place-items-center bg-black/35 p-4 text-center">
              <div className="rounded-2xl bg-white/95 px-4 py-3 text-sm font-semibold text-app-fg">
                Clique em <b>Iniciar</b> para abrir a câmera.
              </div>
            </div>
          ) : null}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <p className="text-xs text-app-muted">
          {ativo ? 'Aponte para o QR…' : 'Dica: use boa iluminação para leitura mais rápida.'}
        </p>
      </div>
    </div>
  )
}
