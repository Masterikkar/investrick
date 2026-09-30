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
import { SelettoreComune } from './selettore-comune'

// Provincia e regione si compilano da sole scegliendo la città.
const stileCampoSolaLettura: React.CSSProperties = { ...stileCampo, opacity: 0.7, cursor: 'default' }

export function FormProfilo({ iniziale }: { iniziale: Profilo }) {
  const t = useTranslations('PaginaProfilo')
  const notifica = useNotifica()
  const router = useRouter()
  const [inCorso, startTransition] = useTransition()
  const [valori, setValori] = useState<Profilo>(iniziale)
  const [erroreData, setErroreData] = useState(false)
  const [erroreCitta, setErroreCitta] = useState<string | null>(null)
  const [mancanti, setMancanti] = useState<Record<string, boolean>>({})
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false)

  function aggiorna(campo: keyof Profilo, valore: string) {
    setValori((prev) => ({ ...prev, [campo]: valore }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroreSalvataggio(false)
    // Tutti i campi sono obbligatori.
    const nuoviMancanti = {
      nome: valori.nome.trim() === '',
      cognome: valori.cognome.trim() === '',
      dataNascita: valori.dataNascita === '',
    }
    setMancanti(nuoviMancanti)
    const dataNelFuturo = valori.dataNascita !== '' && valori.dataNascita > dataIsoOggi()
    setErroreData(dataNelFuturo)
    // La città va scelta dall'elenco: solo così ha provincia e regione.
    const cittaNonScelta = valori.codiceIstat === ''
    const messaggioCitta = cittaNonScelta
      ? valori.citta.trim() === ''
        ? t('erroreCampoObbligatorio')
        : t('erroreCittaDaElenco')
      : null
    setErroreCitta(messaggioCitta)
    if (Object.values(nuoviMancanti).some(Boolean) || dataNelFuturo || cittaNonScelta) return

    startTransition(async () => {
      const risultato = await salvaProfilo({
        nome: valori.nome,
        cognome: valori.cognome,
        dataNascita: valori.dataNascita,
        codiceIstat: valori.codiceIstat,
      })
      if ('errore' in risultato) {
        setErroreSalvataggio(true)
      } else {
        notifica({ messaggio: t('notificaSalvato') })
        router.refresh()
      }
    })
  }

  function campoTesto(campo: 'nome' | 'cognome', etichetta: string, autoComplete: string) {
    return (
      <label style={stileEtichetta}>
        {etichetta}
        <input
          type="text"
          value={valori[campo]}
          onChange={(e) => {
            aggiorna(campo, e.target.value)
            setMancanti((prev) => ({ ...prev, [campo]: false }))
          }}
          maxLength={LUNGHEZZA_MASSIMA_CAMPO_PROFILO}
          autoComplete={autoComplete}
          style={stileCampo}
        />
        {mancanti[campo] && <p style={stileErroreCampo}>{t('erroreCampoObbligatorio')}</p>}
      </label>
    )
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, color: 'var(--text-primary)' }}
    >
      <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>{t('hintCampiObbligatori')}</small>

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
            setMancanti((prev) => ({ ...prev, dataNascita: false }))
          }}
          autoComplete="bday"
          style={stileCampo}
        />
        {erroreData && <p style={stileErroreCampo}>{t('erroreDataNascita')}</p>}
        {mancanti.dataNascita && <p style={stileErroreCampo}>{t('erroreCampoObbligatorio')}</p>}
      </label>

      <SelettoreComune
        testo={valori.citta}
        onCambiaTesto={(testo) => {
          // Cambiare il testo annulla il comune scelto e quindi provincia e regione.
          setValori((prev) => ({ ...prev, citta: testo, codiceIstat: '', provincia: '', regione: '' }))
          setErroreCitta(null)
        }}
        onSeleziona={(c) => {
          setValori((prev) => ({
            ...prev,
            citta: c.nome,
            codiceIstat: c.codice_istat,
            provincia: c.provincia,
            regione: c.regione,
          }))
          setErroreCitta(null)
        }}
        errore={erroreCitta ?? undefined}
      />

      <label style={stileEtichetta}>
        {t('labelProvincia')}
        <input type="text" readOnly tabIndex={-1} value={valori.provincia} style={stileCampoSolaLettura} />
      </label>

      <label style={stileEtichetta}>
        {t('labelRegione')}
        <input type="text" readOnly tabIndex={-1} value={valori.regione} style={stileCampoSolaLettura} />
      </label>

      <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>{t('hintProvinciaRegione')}</small>

      {erroreSalvataggio && <p style={{ ...stileErroreCampo, margin: 0 }}>{t('erroreSalvataggio')}</p>}

      <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
        {t('bottoneSalva')}
      </button>
    </form>
  )
}
