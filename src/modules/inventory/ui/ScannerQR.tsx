// src/modules/inventory/ui/ScannerQR.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button } from '@/modules/shared/ui/app'

type Props = {
  aoLer: (valor: string) => void
  modo?: 'single' | 'continuous'
  cooldownMs?: number

  // ROI central (0.35 a 0.85). Menor = mais rápido, maior = mais “tolerante”.
  roiRatio?: number

  beep?: boolean
  vibrate?: boolean

  resolverLabel?: (qr: string) => Promise<string | null>

  // Se true: em desktop não renderiza nada (nem aviso).
  esconderNoDesktop?: boolean
}

type Status = 'parado' | 'iniciando' | 'lendo' | 'bloqueado'

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ')
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function short(uuid: string) {
  return String(uuid ?? '').replaceAll('-', '').slice(-8).toUpperCase()
}

function isMobileUA() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod/i.test(ua)
}

function supportsCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function beepOk() {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.06
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.07)
    setTimeout(() => {
      try {
        ctx.close?.()
      } catch {}
    }, 200)
  } catch {}
}

/**
 * Scanner otimizado e mobile-first:
 * - Só mostra em mobile (viewport < md) por padrão.
 * - Lazy-load do jsQR (reduz bundle no resto do app).
 * - ROI central para acelerar.
 * - Throttle interno por cooldown + (opcional) frame skipping.
 * - Pausa quando a aba perde foco (visibilitychange).
 */
export function ScannerQR({
  aoLer,
  modo = 'continuous',
  cooldownMs = 1200,
  roiRatio = 0.58,
  beep = true,
  vibrate = true,
  resolverLabel,
  esconderNoDesktop = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // anti-loop
  const bloqueadoAteRef = useRef(0)
  const ultimoValorRef = useRef<string | null>(null)

  // feedback
  const flashTimerRef = useRef<number | null>(null)
  const feedbackSeqRef = useRef(0)

  // performance
  const frameSkipRef = useRef(0) // simples (pula frames)
  const jsqrRef = useRef<any>(null)

  const [status, setStatus] = useState<Status>('parado')
  const [erro, setErro] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(false)

  const [ultimoLido, setUltimoLido] = useState<string | null>(null)
  const [ultimoLabel, setUltimoLabel] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia?.('(max-width: 767px)').matches ?? true
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  function clearFlashTimer() {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = null
  }

  async function triggerFeedback(valor: string) {
    const seq = ++feedbackSeqRef.current

    setUltimoLido(valor)
    setUltimoLabel(null)
    setFlash(true)

    clearFlashTimer()
    flashTimerRef.current = window.setTimeout(() => setFlash(false), 650)

    if (beep) beepOk()
    if (vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        ;(navigator as any).vibrate?.(40)
      } catch {}
    }

    if (resolverLabel) {
      try {
        const label = await resolverLabel(valor)
        if (feedbackSeqRef.current === seq && label) setUltimoLabel(label)
      } catch {}
    }
  }

  function stopLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  function parar() {
    stopLoop()
    clearFlashTimer()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const v = videoRef.current
    if (v) {
      try {
        v.pause()
      } catch {}
      v.srcObject = null
    }

    bloqueadoAteRef.current = 0
    ultimoValorRef.current = null
    frameSkipRef.current = 0

    setAtivo(false)
    setStatus('parado')
  }

  async function ensureJsQR() {
    if (jsqrRef.current) return jsqrRef.current
    // lazy-load
    const mod: any = await import('jsqr')
    jsqrRef.current = mod.default ?? mod
    return jsqrRef.current
  }

  async function iniciar() {
    setErro(null)

    if (!supportsCamera()) {
      setErro('Este dispositivo/navegador não suporta câmera.')
      return
    }

    // mobile-only gate (além do CSS)
    if (!isMobile && esconderNoDesktop) return

    setStatus('iniciando')

    try {
      await ensureJsQR()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          // resolução “boa o suficiente” pra QR e mais leve que 1280x720 em alguns aparelhos
          width: { ideal: 960 },
          height: { ideal: 540 },
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
      video.muted = true
      video.playsInline = true

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

      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as
        | CanvasRenderingContext2D
        | null
      if (!ctx) return

      const lerFrame = () => {
        const v = videoRef.current
        const c = canvasRef.current
        const jsQR = jsqrRef.current
        if (!v || !c || !jsQR) return

        // frame skipping simples (melhora em aparelhos fracos)
        frameSkipRef.current = (frameSkipRef.current + 1) % 2 // lê 1, pula 1
        if (frameSkipRef.current !== 0) {
          rafRef.current = requestAnimationFrame(lerFrame)
          return
        }

        if (v.readyState >= 2 && v.videoWidth && v.videoHeight) {
          // reduz trabalho: captura em resolução menor (downscale no canvas)
          const targetW = 720
          const scale = targetW / v.videoWidth
          const w = Math.floor(v.videoWidth * scale)
          const h = Math.floor(v.videoHeight * scale)

          c.width = w
          c.height = h
          ctx.drawImage(v, 0, 0, w, h)

          const ratio = clamp(roiRatio, 0.35, 0.85)
          const roiW = Math.floor(w * ratio)
          const roiH = Math.floor(h * ratio)
          const roiX = Math.floor((w - roiW) / 2)
          const roiY = Math.floor((h - roiH) / 2)

          const imageData = ctx.getImageData(roiX, roiY, roiW, roiH)
          const code = jsQR(imageData.data, roiW, roiH, { inversionAttempts: 'dontInvert' })

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

            triggerFeedback(code.data)
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
          ? 'A câmera foi autorizada, mas o vídeo não inicializou.'
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

  // pausa automática quando perde foco
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') {
        if (ativo) parar()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])

  // cleanup
  useEffect(() => {
    return () => parar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tone = status === 'lendo' ? 'ok' : status === 'iniciando' ? 'info' : 'warn'

  // desktop: não renderiza (ou mostra aviso) — conforme pedido
  if (!isMobile) {
    if (esconderNoDesktop) return null
    return (
      <div className="app-card p-4">
        <div className="text-sm font-semibold text-app-fg">Scanner (mobile)</div>
        <div className="mt-1 text-sm text-app-muted">
          Leitura por câmera disponível apenas no celular.
        </div>
      </div>
    )
  }

  const overlayText = useMemo(() => {
    if (!ativo) return 'Toque em “Iniciar” para abrir a câmera.'
    return 'Aponte o QR no centro…'
  }, [ativo])

  return (
    <div className="app-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-app-fg">Scanner</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-app-muted">
            <span>Status:</span>
            <Badge tone={tone}>
              {status === 'parado' ? 'Parado' : status === 'iniciando' ? 'Iniciando' : 'Lendo'}
              {modo === 'continuous' ? ' • Contínuo' : ''}
            </Badge>
          </div>
        </div>

        <Button type="button" variant={ativo ? 'secondary' : 'primary'} onClick={alternar} className="px-4 py-3">
          {ativo ? 'Parar' : 'Iniciar'}
        </Button>
      </div>

      {erro ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {/* viewport otimizado */}
        <div className="relative overflow-hidden rounded-2xl border border-app-border bg-black">
          <video ref={videoRef} className="w-full h-[58vh] object-cover" playsInline muted autoPlay />

          {/* máscara (ROI) */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              className="rounded-2xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]"
              style={{
                width: '72vw',
                maxWidth: 280,
                height: '72vw',
                maxHeight: 280,
              }}
            />
          </div>

          {/* overlay texto */}
          <div className="pointer-events-none absolute left-0 right-0 bottom-0 p-3">
            <div className="rounded-2xl bg-white/90 backdrop-blur px-3 py-2 text-center text-sm font-semibold text-app-fg">
              {overlayText}
            </div>
          </div>

          {/* feedback */}
          {flash && ultimoLido ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl bg-emerald-600/92 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">
                <div>OK • {short(ultimoLido)}</div>
                {ultimoLabel ? (
                  <div className="mt-1 text-xs font-medium text-white/95">{ultimoLabel}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="text-xs text-app-muted">
          Dica: luz boa melhora a leitura. Se estiver “piscando”, aumente o cooldown.
        </div>
      </div>
    </div>
  )
}
