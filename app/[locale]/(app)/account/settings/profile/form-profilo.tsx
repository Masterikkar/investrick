'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useNotifica } from '@/components/notifica'
import { dataIsoOggi } from '@/lib/data-calendario'
import { LUNGHEZZA_MASSIMA_CAMPO_PROFILO, type Profilo } from '@/lib/profilo'
import {
  stileBottonePrimario,
  stileCampo,
  stileErroreCampo,
  stileEtichetta,
} from '../../data-management/transactions/nuova-transazione'
import { salvaProfilo } from './actions'

export function FormProfilo({ iniziale }: { iniziale: Profilo }) {
  const t = useTranslations('PaginaProfilo')
  const notifica = useNotifica()
  const router = useRouter()
  const [inCorso, startTransition] = useTransition()
  const [valori, setValori] = useState<Profilo>(iniziale)
  const [erroreData, setErroreData] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false)

  function aggiorna(campo: keyof Profilo, valore: string) {
    setValori((prev) => ({ ...prev, [campo]: valore }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroreSalvataggio(false)
    const dataNelFuturo = valori.dataNascita !== '' && valori.dataNascita > dataIsoOggi()
    setErroreData(dataNelFuturo)
    if (dataNelFuturo) return

    startTransition(async () => {
      const risultato = await salvaProfilo(valori)
      if ('errore' in risultato) {
        setErroreSalvataggio(true)
      } else {
        notifica({ messaggio: t('notificaSalvato') })
        router.refresh()
      }
    })
  }

  function campoTesto(campo: Exclude<keyof Profilo, 'dataNascita'>, etichetta: string, autoComplete: string) {
    return (
      <label style={stileEtichetta}>
        {etichetta}
        <input
          type="text"
          value={valori[campo]}
          onChange={(e) => aggiorna(campo, e.target.value)}
          maxLength={LUNGHEZZA_MASSIMA_CAMPO_PROFILO}
          autoComplete={autoComplete}
          style={stileCampo}
        />
      </label>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, color: 'var(--text-primary)' }}
    >
      {campoTesto('nome', t('labelNome'), 'given-name')}
      {campoTesto('cognome', t('labelCognome'), 'family-name')}

      <label style={stileEtichetta}>
        {t('labelDataNascita')}
        <input
          type="date"
          value={valori.dataNascita}
          max={dataIsoOggi()}
          onChange={(e) => {
            aggiorna('dataNascita', e.target.value)
            setErroreData(false)
          }}
          autoComplete="bday"
          style={stileCampo}
        />
        {erroreData && <p style={stileErroreCampo}>{t('erroreDataNascita')}</p>}
      </label>

      {campoTesto('citta', t('labelCitta'), 'address-level2')}
      {campoTesto('provincia', t('labelProvincia'), 'address-level2')}
      {campoTesto('regione', t('labelRegione'), 'address-level1')}

      {erroreSalvataggio && <p style={{ ...stileErroreCampo, margin: 0 }}>{t('erroreSalvataggio')}</p>}

      <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
        {t('bottoneSalva')}
      </button>
    </form>
  )
}
