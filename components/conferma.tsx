'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'

// Conferma on-theme al posto di window.confirm, con la stessa ergonomia ma
// asincrona: const conferma = useConferma(); if (!(await conferma({...}))) return
// Il provider è montato una volta nel layout dell'app. Chiudere il modale
// (Annulla, ×, Esc, clic fuori) equivale a rispondere "no".
export type OpzioniConferma = {
  titolo: string
  messaggio: string
  // Testo del pulsante di conferma; se assente "Conferma".
  etichettaConferma?: string
  // Azione distruttiva: pulsante di conferma in rosso.
  pericoloso?: boolean
}

type FunzioneConferma = (opzioni: OpzioniConferma) => Promise<boolean>

const ContestoConferma = createContext<FunzioneConferma | null>(null)

export function useConferma(): FunzioneConferma {
  const conferma = useContext(ContestoConferma)
  if (!conferma) throw new Error('useConferma va usato dentro ConfermaProvider')
  return conferma
}

const stileBottone: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

export function ConfermaProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('DialogoConferma')
  const [opzioni, setOpzioni] = useState<OpzioniConferma | null>(null)
  const risolvi = useRef<((risposta: boolean) => void) | null>(null)

  const chiudi = useCallback((risposta: boolean) => {
    risolvi.current?.(risposta)
    risolvi.current = null
    setOpzioni(null)
  }, [])

  const annulla = useCallback(() => chiudi(false), [chiudi])

  const conferma = useCallback<FunzioneConferma>((nuoveOpzioni) => {
    // Una conferma ancora aperta viene chiusa come "no" prima della nuova.
    risolvi.current?.(false)
    return new Promise<boolean>((resolve) => {
      risolvi.current = resolve
      setOpzioni(nuoveOpzioni)
    })
  }, [])

  return (
    <ContestoConferma.Provider value={conferma}>
      {children}
      <Modale aperto={opzioni !== null} onChiudi={annulla} titolo={opzioni?.titolo ?? ''} mostraChiusura={false}>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
          {opzioni?.messaggio}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button
            type="button"
            onClick={annulla}
            autoFocus
            style={{ ...stileBottone, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          >
            {t('bottoneAnnulla')}
          </button>
          <button
            type="button"
            onClick={() => chiudi(true)}
            style={{
              ...stileBottone,
              background: opzioni?.pericoloso ? 'var(--danger)' : 'var(--primary)',
              color: '#fff',
              border: 'none',
            }}
          >
            {opzioni?.etichettaConferma ?? t('bottoneConferma')}
          </button>
        </div>
      </Modale>
    </ContestoConferma.Provider>
  )
}
