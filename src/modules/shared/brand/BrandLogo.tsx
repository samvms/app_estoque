// src/modules/shared/brand/BrandLogo.tsx
import Image from 'next/image'

type Props = {
  variant?: 'wordmark' | 'icon'
  mode?: 'auto' | 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  priority?: boolean
}

const SIZES = {
  sm: { h: 20, wWord: 140, wIcon: 28 },
  md: { h: 24, wWord: 170, wIcon: 34 },
  lg: { h: 28, wWord: 200, wIcon: 40 },
} as const

export function BrandLogo({
  variant = 'wordmark',
  mode = 'auto',
  size = 'md',
  className = '',
  priority = false,
}: Props) {
  const s = SIZES[size]

  // paths (ajuste se seus nomes estiverem diferentes)
  const wordLight = '/brand/logo/moura-lws-horizontal.png'
  const wordDark = '/brand/logo/moura-lws-horizontal-white.png'
  const icon = '/brand/icon/lws-app-icon-1024.png'

  if (variant === 'icon') {
    return (
      <Image
        src={icon}
        alt="LWS"
        width={s.wIcon}
        height={s.wIcon}
        className={className}
        priority={priority}
      />
    )
  }

  // auto: usa CSS para alternar (dark mode)
  if (mode === 'auto') {
    return (
      <span className={className}>
        {/* Light */}
        <span className="block dark:hidden">
          <Image
            src={wordLight}
            alt="Moura LWS"
            width={s.wWord}
            height={s.h}
            priority={priority}
          />
        </span>

        {/* Dark */}
        <span className="hidden dark:block">
          <Image
            src={wordDark}
            alt="Moura LWS"
            width={s.wWord}
            height={s.h}
            priority={priority}
          />
        </span>
      </span>
    )
  }

  const src = mode === 'dark' ? wordDark : wordLight
  return (
    <Image
      src={src}
      alt="Moura LWS"
      width={s.wWord}
      height={s.h}
      className={className}
      priority={priority}
    />
  )
}
