'use client'

import { useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'

type Cerchio = { id: number; x: number; y: number; size: number }

export function RippleLink({
  href,
  children,
  style,
  className,
  onClick,
}: {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  onClick?: () => void
}) {
  const [cerchi, setCerchi] = useState<Cerchio[]>([])
  const ref = useRef<HTMLAnchorElement>(null)
  const idRef = useRef(0)

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const id = idRef.current++
      setCerchi((prev) => [
        ...prev,
        { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
      ])
      setTimeout(() => {
        setCerchi((prev) => prev.filter((c) => c.id !== id))
      }, 500)
    }
    onClick?.()
  }

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
      {cerchi.map((c) => (
        <span
          key={c.id}
          style={{
            position: 'absolute',
            left: c.x,
            top: c.y,
            width: c.size,
            height: c.size,
            borderRadius: '50%',
            background: 'var(--primary-vivid)',
            opacity: 0.35,
            pointerEvents: 'none',
            animation: 'ripple-espandi 500ms ease-out',
          }}
        />
      ))}
    </Link>
  )
}