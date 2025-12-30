// src/modules/inventory/ScannerQR.tsx
'use client'

import { useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Button, Badge } from '@/modules/shared/ui/app'

type Props = {
  aoLer: (valor: string) => void
  modo?: 'single' | 'continuous'
  cooldownMs?: number

  framePx?: number
  roiRatio?: number

  beep?: boolean
  vibrate?: boolean

  // NOVO: resolve label (modelo+cor) a partir do QR
  resolverLabel?: (qr: string) => Promise<string | null>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function short(uuid: string) {
  return String(uuid ?? '').replaceAll('-', '').slice(-8).toUpperCase()
}

function beepOk() {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.08

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.08)

    setTimeout(() => {
      try {
        ctx.close?.()
      } catch {}
    }, 200)
  } catch {}
}

export function ScannerQR({
  aoLer,
  modo = 'single',
  cooldownMs = 1200,
  framePx = 220,
  roiRatio = 0.55,
  beep = true,
  vibrate = true,
  resolverLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // anti-loop
  const bloqueadoAteRef = useRef<number>(0)
  const ultimoValorRef = useRef<string | null>(null)

  // feedback visual
  const flashTimerRef = useRef<number | null>(null)
  const feedbackSeqRef = useRef<number>(0)

  const [ultimoLido, setUltimoLido] = useState<string | null>(null)
  const [ultimoLabel, setUltimoLabel] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const [ativo, setAtivo] = useState(false)
  const [status, setStatus] = useState<'parado' | 'iniciando' | 'lendo'>('parado')
  const [erro, setErro] = useState<string | null>(null)

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
        ;(navigator as any).vibrate?.(50)
      } catch {}
    }

    // resolve label em background (não bloqueia a operação)
    if (resolverLabel) {
      try {
        const label = await resolverLabel(valor)
        // evita race: só aplica se for o feedback mais recente
        if (feedbackSeqRef.current === seq && label) {
          setUltimoLabel(label)
        }
      } catch {
        // silencioso: não atrapalha operação
      }
    }
  }

  function parar() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    clearFlashTimer()

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

      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
      if (!ctx) return

      const lerFrame = () => {
        const v = videoRef.current
        const c = canvasRef.current
        if (!v || !c) return

        if (v.readyState >= 2 && v.videoWidth && v.videoHeight) {
          c.width = v.videoWidth
          c.height = v.videoHeight

          ctx.drawImage(v, 0, 0, c.width, c.height)

          // ROI central menor
          const w = c.width
          const h = c.height
          const ratio = clamp(roiRatio, 0.3, 0.8)
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

            // feedback imediato (com label async)
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
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative overflow-hidden rounded-2xl border border-app-border bg-black">
          <video ref={videoRef} className="w-full object-cover" playsInline muted autoPlay />

          {/* frame menor + máscara */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              className="rounded-2xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{ width: framePx, height: framePx }}
            />
          </div>

          {/* feedback visual (agora com label) */}
          {flash && ultimoLido ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl bg-emerald-600/90 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">
                <div>QR lido • {short(ultimoLido)}</div>
                {ultimoLabel ? <div className="mt-1 text-xs font-medium text-white/95">{ultimoLabel}</div> : null}
              </div>
            </div>
          ) : null}

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
          {ativo ? 'Aponte o QR dentro do quadrado…' : 'Dica: boa luz = leitura mais rápida.'}
        </p>
      </div>
    </div>
  )
}
