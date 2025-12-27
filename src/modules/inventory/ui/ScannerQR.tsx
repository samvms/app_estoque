'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import jsQR from 'jsqr'

type Props = {
  aoLer: (valor: string) => void
}

export function ScannerQR({ aoLer }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [ativo, setAtivo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const podeUsarCamera = useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }, [])

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

        video.srcObject = stream
        await video.play()

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const lerFrame = () => {
          if (!videoRef.current || !canvasRef.current) return

          const v = videoRef.current
          const c = canvasRef.current

          if (v.readyState >= 2) {
            c.width = v.videoWidth
            c.height = v.videoHeight

            ctx.drawImage(v, 0, 0, c.width, c.height)

            const imageData = ctx.getImageData(0, 0, c.width, c.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            })

            if (code?.data) {
              // encontrou QR
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

      const video = videoRef.current
      if (video) video.srcObject = null
      setAtivo(false)
    }

    if (ativo) iniciar()

    return () => {
      parar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])

  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Leitura por câmera</div>
          <div className="text-sm opacity-80">
            Aponte para o QR da caixa para preencher automaticamente.
          </div>
        </div>

        <button
          className="rounded border px-3 py-2 text-sm font-medium"
          onClick={() => setAtivo((v) => !v)}
          disabled={!podeUsarCamera}
          type="button"
        >
          {ativo ? 'Parar' : 'Iniciar'}
        </button>
      </div>

      {!podeUsarCamera && (
        <p className="text-sm text-red-600">
          Este navegador não suporta câmera via Web.
        </p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {ativo && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            className="w-full rounded border"
            playsInline
            muted
          />
          {/* canvas invisível só para leitura */}
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-sm opacity-80">
            Lendo... (mantenha o QR dentro da imagem)
          </p>
        </div>
      )}
    </div>
  )
}
