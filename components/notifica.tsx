'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'

// Notifica a popup, sorella di components/conferma.tsx ma più semplice: un
// messaggio e un solo pulsante OK, niente risposta da attendere.
//   const notifica = useNotifica(); notifica({ messaggio: '...' })
// Il provider è montato una volta nel layout dell'app. OK, Esc e clic fuori
// chiudono.
export type OpzioniNotifica = {
  messaggio: string
  titolo?: string
}

type FunzioneNotifica = (opzioni: OpzioniNotifica) => void

const ContestoNotifica = createContext<FunzioneNotifica | null>(null)

export function useNotifica(): FunzioneNotifica {
  const notifica = useContext(ContestoNotifica)
  if (!notifica) throw new Error('useNotifica va usato dentro NotificaProvider')
  return notifica
}

export function NotificaProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('DialogoConferma')
  const [opzioni, setOpzioni] = useState<OpzioniNotifica | null>(null)

  const chiudi = useCallback(() => setOpzioni(null), [])
  const notifica = useCallback<FunzioneNotifica>((nuoveOpzioni) => setOpzioni(nuoveOpzioni), [])

  return (
    <ContestoNotifica.Provider value={notifica}>
      {children}
      <Modale aperto={opzioni !== null} onChiudi={chiudi} titolo={opzioni?.titolo} mostraChiusura={false} larghezzaMassima={400}>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
          {opzioni?.messaggio}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            onClick={chiudi}
            autoFocus
            style={{
              padding: '8px 16px',
              fontSize: 'var(--fs-button)',
              fontWeight: 500,
              cursor: 'pointer',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
            }}
          >
            {t('bottoneOk')}
          </button>
        </div>
      </Modale>
    </ContestoNotifica.Provider>
  )
}
