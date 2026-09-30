'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useNotifica } from '@/components/notifica'
import {
  stileBottonePrimario,
  stileCampo,
  stileErroreCampo,
  stileEtichetta,
} from '../../data-management/transactions/nuova-transazione'
import { LUNGHEZZA_MINIMA_PASSWORD } from '@/lib/profilo'
import { cambiaPassword } from './actions'

export function FormPassword() {
  const t = useTranslations('PaginaAccount')
  const notifica = useNotifica()
  const [inCorso, startTransition] = useTransition()
  const [attuale, setAttuale] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrore(null)
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
      <label style={stileEtichetta}>
        {t('labelPasswordAttuale')}
        <input
          type="password"
          required
          value={attuale}
          onChange={(e) => setAttuale(e.target.value)}
          autoComplete="current-password"
          style={stileCampo}
        />
      </label>

      <label style={stileEtichetta}>
        {t('labelNuovaPassword')}
        <input
          type="password"
          required
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          autoComplete="new-password"
          style={stileCampo}
        />
        <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
          {t('hintPassword', { minimo: LUNGHEZZA_MINIMA_PASSWORD })}
        </small>
      </label>

      <label style={stileEtichetta}>
        {t('labelConfermaPassword')}
        <input
          type="password"
          required
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          autoComplete="new-password"
          style={stileCampo}
        />
      </label>

      {errore && <p style={{ ...stileErroreCampo, margin: 0 }}>{errore}</p>}

      <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
        {t('bottoneCambiaPassword')}
      </button>
    </form>
  )
}
