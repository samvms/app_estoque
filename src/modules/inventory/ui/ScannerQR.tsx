'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

type Props = {
  aoLer: (valor: string) => void
}

export function ScannerQR({ aoLer }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [ativo, setAtivo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let rafId: number | null = null

    async function iniciar() {
      setErro(null)

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })

        const video = videoRef.current
        if (!video) return

        // 🔴 CRÍTICO PARA iOS
        video.setAttribute('playsinline', 'true')
        video.setAttribute('muted', 'true')
        video.setAttribute('autoplay', 'true')
        video.muted = true
        video.playsInline = true
        video.autoplay = true

        video.srcObject = stream
        await video.play()

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const lerFrame = () => {
          if (!videoRef.current || !canvasRef.current) return

          if (video.readyState >= 2) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            })

            if (code?.data) {
              aoLer(code.data)
              parar()
              return
            }
          }

          rafId = requestAnimationFrame(lerFrame)
        }

        rafId = requestAnimationFrame(lerFrame)
      } catch (e: any) {
        setErro(`Falha ao acessar câmera: ${e?.name || 'erro_desconhecido'}`)
        setAtivo(false)
      }
    }

    function parar() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null

      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        stream = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      setAtivo(false)
    }

    if (ativo) iniciar()

    return () => parar()
  }, [ativo, aoLer])

  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Leitura por câmera</div>
          <div className="text-sm opacity-80">
            Aponte para o QR da caixa
          </div>
        </div>

        <button
          type="button"
          className="rounded border px-3 py-2 text-sm font-medium"
          onClick={() => setAtivo((v) => !v)}
        >
          {ativo ? 'Parar' : 'Iniciar'}
        </button>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {ativo && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            className="w-full rounded border"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-sm opacity-80">Lendo QR…</p>
        </div>
      )}
    </div>
  )
}
