'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconaInfo } from '@/components/icone'

// Distanza minima tra il fumetto e il bordo della finestra.
const MARGINE_FINESTRA = 8

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

  // Il fumetto nasce allineato a sinistra dell'icona. Se così uscirebbe dallo
  // schermo (tipico su telefono, con l'icona a metà riga) lo spostiamo quanto
  // basta per tenerlo dentro. Callback ref: la misura avviene appena il fumetto
  // compare, prima che il browser disegni, quindi non si vede nessun salto;
  // niente stato, quindi nessun render in più.
  const tieniDentroLaFinestra = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return
    el.style.transform = ''
    const rect = el.getBoundingClientRect()
    const larghezzaFinestra = document.documentElement.clientWidth
    const sinistraMassima = larghezzaFinestra - MARGINE_FINESTRA - rect.width
    const sinistra = Math.max(MARGINE_FINESTRA, Math.min(rect.left, sinistraMassima))
    const spostamento = sinistra - rect.left
    if (spostamento !== 0) el.style.transform = `translateX(${spostamento}px)`
  }, [])

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
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <IconaInfo />
      </button>

      {aperto && (
        <span
          ref={tieniDentroLaFinestra}
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