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
import { cambiaEmail } from './actions'

export function FormEmail({ emailAttuale, emailInAttesa }: { emailAttuale: string; emailInAttesa: string | null }) {
  const t = useTranslations('PaginaAccount')
  const notifica = useNotifica()
  const [inCorso, startTransition] = useTransition()
  const [nuovaEmail, setNuovaEmail] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inviata, setInviata] = useState<string | null>(emailInAttesa)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrore(null)
    startTransition(async () => {
      const risultato = await cambiaEmail(nuovaEmail)
      if ('errore' in risultato) {
        setErrore(t(`erroriEmail.${risultato.errore}`))
      } else {
        setInviata(nuovaEmail.trim().toLowerCase())
        setNuovaEmail('')
        notifica({ messaggio: t('notificaEmailInviata') })
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, color: 'var(--text-primary)' }}
    >
      <div style={stileEtichetta}>
        {t('labelEmailAttuale')}
        <div style={{ marginTop: 4, color: 'var(--text-primary)' }}>{emailAttuale}</div>
      </div>

      {inviata && (
        <p style={{ margin: 0, fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)' }}>
          {t('avvisoEmailInAttesa', { email: inviata })}
        </p>
      )}

      <label style={stileEtichetta}>
        {t('labelNuovaEmail')}
        <input
          type="email"
          required
          value={nuovaEmail}
          onChange={(e) => setNuovaEmail(e.target.value)}
          autoComplete="email"
          style={stileCampo}
        />
      </label>

      {errore && <p style={{ ...stileErroreCampo, margin: 0 }}>{errore}</p>}

      <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
        {t('bottoneCambiaEmail')}
      </button>
    </form>
  )
}
