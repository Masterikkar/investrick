'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useNotifica } from '@/components/notifica'
import { LUNGHEZZA_MINIMA_PASSWORD } from '@/lib/profilo'
import { stileBottonePrimario, stileErroreCampo } from '../../data-management/transactions/nuova-transazione'
import { cambiaPassword } from './actions'
import { CampoPassword } from './campo-password'

export function FormPassword() {
  const t = useTranslations('PaginaAccount')
  const notifica = useNotifica()
  const [inCorso, startTransition] = useTransition()
  const [attuale, setAttuale] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  // Le due password si confrontano mentre si scrive, non solo all'invio.
  const confermaDiversa = conferma !== '' && nuova !== conferma

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrore(null)
    if (attuale === '') {
      setErrore(t('erroriPassword.passwordAttualeErrata'))
      return
    }
    if (nuova.length < LUNGHEZZA_MINIMA_PASSWORD) {
      setErrore(t('erroriPassword.passwordCorta', { minimo: LUNGHEZZA_MINIMA_PASSWORD }))
      return
    }
    if (nuova !== conferma) {
      setErrore(t('erroriPassword.confermaDiversa'))
      return
    }
    startTransition(async () => {
      const risultato = await cambiaPassword(attuale, nuova)
      if ('errore' in risultato) {
        setErrore(t(`erroriPassword.${risultato.errore}`, { minimo: LUNGHEZZA_MINIMA_PASSWORD }))
      } else {
        setAttuale('')
        setNuova('')
        setConferma('')
        notifica({ messaggio: t('notificaPasswordCambiata') })
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, color: 'var(--text-primary)' }}
    >
      <CampoPassword
        etichetta={t('labelPasswordAttuale')}
        valore={attuale}
        onCambia={setAttuale}
        autoComplete="current-password"
      />

      <CampoPassword
        etichetta={t('labelNuovaPassword')}
        valore={nuova}
        onCambia={setNuova}
        autoComplete="new-password"
        hint={t('hintPassword', { minimo: LUNGHEZZA_MINIMA_PASSWORD })}
      />

      <CampoPassword
        etichetta={t('labelConfermaPassword')}
        valore={conferma}
        onCambia={setConferma}
        autoComplete="new-password"
        errore={confermaDiversa ? t('erroriPassword.confermaDiversa') : undefined}
      />

      {errore && <p style={{ ...stileErroreCampo, margin: 0 }}>{errore}</p>}

      <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
        {t('bottoneCambiaPassword')}
      </button>
    </form>
  )
}
