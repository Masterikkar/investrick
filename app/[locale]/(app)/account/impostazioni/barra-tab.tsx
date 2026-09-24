'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/navigation'

export function BarraTab({ tab }: { tab: { href: string; label: string; icona: ReactNode }[] }) {
  const pathname = usePathname()
  const ref = useRef<HTMLElement>(null)
  const [altezzaMinima, setAltezzaMinima] = useState<number>()

  // La barra deve arrivare in fondo alla finestra. Lo spazio sopra (header,
  // titolo) e il padding inferiore del <main> non sono noti a priori, quindi
  // si misurano: altezza finestra - posizione della barra nel documento -
  // padding-bottom del <main>, ricalcolato a ogni resize.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    function aggiorna() {
      const offsetTop = el!.getBoundingClientRect().top + window.scrollY
      const main = el!.closest('main')
      const paddingFondo = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0
      setAltezzaMinima(window.innerHeight - offsetTop - paddingFondo)
    }
    aggiorna()
    window.addEventListener('resize', aggiorna)
    return () => window.removeEventListener('resize', aggiorna)
  }, [])

  return (
    <nav
      ref={ref}
      style={{
        minHeight: altezzaMinima,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: 240,
        flexShrink: 0,
        padding: 8,
        background: 'var(--bg-section)',
        border: '1px solid var(--border-section)',
        borderRadius: 0,
      }}
    >
      {tab.map(({ href, label, icona }) => {
        const attiva = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={attiva ? 'page' : undefined}
            className={attiva ? undefined : 'link-interattivo'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 0,
              background: attiva ? 'var(--bg-surface)' : 'transparent',
              color: attiva ? 'var(--text-primary)' : undefined,
              fontSize: 'var(--fs-menu)',
              textDecoration: 'none',
            }}
          >
            {icona}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
