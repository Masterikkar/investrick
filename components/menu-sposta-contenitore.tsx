'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { IconaSposta } from '@/components/icone'

type Contenitore = { id: string; nome: string }

// Stesso idioma <details>/.menu-toggle/.menu-panel/.menu-row del menu di
// navigazione principale (vedi app/[locale]/(app)/layout.tsx e le classi
// .menu-* in globals.css), non un <select> nativo: quest'ultimo si affida
// allo stile del browser/OS, non al tema scuro dell'app. La chiusura al
// click fuori e al cambio pagina è già gestita da ChiudiTendineAutomaticamente
// per qualunque <details> della pagina — qui basta chiudersi da soli alla
// selezione di una voce (removeAttribute('open'), stesso approccio usato lì).
// Condiviso tra storico-transazioni.tsx e storico-movimenti-liquidita.tsx,
// che hanno esattamente lo stesso "Sposta in un altro gruppo" (vedi CLAUDE.md:
// la logica condivisa vive in un solo punto, mai duplicata).
export function MenuSpostaContenitore({
  contenitoreIdAttuale,
  contenitori,
  disabled = false,
  onSposta,
}: {
  contenitoreIdAttuale: string | null
  contenitori: Contenitore[]
  disabled?: boolean
  onSposta: (valoreSelezionato: string) => void
}) {
  const t = useTranslations('PaginaStorico')
  const tContenitori = useTranslations('Contenitori')
  const dettaglioRef = useRef<HTMLDetailsElement>(null)

  const opzioni = [
    ...(contenitoreIdAttuale !== null ? [{ value: 'diretto', label: tContenitori('nessunGruppo') }] : []),
    ...contenitori.filter((c) => c.id !== contenitoreIdAttuale).map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSeleziona(valore: string) {
    // <details> non ha un modo nativo per chiudersi al click su una voce
    // interna (a differenza del click fuori, già coperto globalmente): lo fa
    // da solo, stesso removeAttribute('open') di ChiudiTendineAutomaticamente.
    dettaglioRef.current?.removeAttribute('open')
    onSposta(valore)
  }

  // <summary> non supporta l'attributo disabled: niente <details> quando
  // l'operazione è in corso, stessa icona spenta di prima.
  if (disabled) {
    return (
      <span
        title={t('titleSpostaContenitore')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 4px',
          color: 'var(--text-secondary)',
          opacity: 0.4,
        }}
      >
        <IconaSposta />
      </span>
    )
  }

  return (
    <details ref={dettaglioRef} style={{ position: 'relative', display: 'inline-block' }}>
      <summary
        className="menu-toggle menu-toggle-bar"
        title={t('titleSpostaContenitore')}
        aria-label={t('titleSpostaContenitore')}
        style={{ height: 'auto', padding: '2px 4px', color: 'var(--text-secondary)' }}
      >
        <IconaSposta />
      </summary>
      <div className="menu-panel" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20 }}>
        {opzioni.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => handleSeleziona(o.value)}
            className="menu-row link-interattivo"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  )
}
