'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

export function InfoTooltip({ testo }: { testo: string }) {
  const t = useTranslations('PaginaFiscalita')
  const [aperto, setAperto] = useState(false)
  const contenitoreRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aperto) return
    function handleClickFuori(e: MouseEvent) {
      if (contenitoreRef.current && !contenitoreRef.current.contains(e.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuori)
    return () => document.removeEventListener('mousedown', handleClickFuori)
  }, [aperto])

  return (
    <span
      ref={contenitoreRef}
      style={{ position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}
      onMouseEnter={() => setAperto(true)}
      onMouseLeave={() => setAperto(false)}
    >
      <button
        type="button"
        onClick={() => setAperto((a) => !a)}
        aria-label={t('ariaLabelInfoTooltip')}
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1px solid var(--text-secondary)',
          background: 'none',
          color: 'var(--text-secondary)',
          fontSize: 10,
          lineHeight: '14px',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        i
      </button>

      {aperto && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            // Larghezza sul contenuto ma mai oltre 300px; white-space va
            // ripristinato perché il tooltip può stare in un'intestazione di
            // tabella con nowrap, che altrimenti impedirebbe di andare a capo.
            width: 'max-content',
            maxWidth: 300,
            whiteSpace: 'normal',
            overflowWrap: 'break-word',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            padding: '10px 12px',
            fontSize: 'var(--fs-form-hint)',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            zIndex: 20,
          }}
        >
          {testo}
        </span>
      )}
    </span>
  )
}