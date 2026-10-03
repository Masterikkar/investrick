'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { creaContenitore, aggiornaContenitore } from './actions-contenitore'
import { MenuSelect } from '@/components/menu-select'
import { LARGHEZZA_STANDARD, GAP_CAMPI, LARGHEZZA_RIGA_QUATTRO_CAMPI, LARGHEZZA_NOME } from '../layout-campi'

// Valori correnti di un gruppo da modificare.
export type ContenitoreModificabile = {
  id: string
  nome: string
  tipo: string
  data_attivazione: string | null
  note: string | null
  target_attivo: boolean
}

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const stileErroreCampo: React.CSSProperties = {
  color: 'var(--danger)',
  fontSize: 'var(--fs-form-hint)',
  margin: '4px 0 0',
}

const stileBottone: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
}

// Form gruppo in due modalità. Senza contenitore crea un gruppo nuovo (azione
// creaContenitore, che poi reindirizza a Gruppi). Con contenitore lo
// modifica: campi precompilati coi valori correnti, azione
// aggiornaContenitore, nessun redirect — onSalvato chiude il modale e
// aggiorna la pagina.
export function FormContenitore({
  contenitore,
  onSalvato,
  onAnnulla,
}: {
  contenitore?: ContenitoreModificabile
  onSalvato?: () => void
  onAnnulla?: () => void
}) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const [tipo, setTipo] = useState(contenitore?.tipo ?? '')
  const [erroreTipo, setErroreTipo] = useState<string | null>(null)
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const inModifica = contenitore !== undefined

  const tipiContenitore = [
    { value: 'PAC', label: 'PAC' },
    { value: 'Polizza', label: tPaginaContenitore('etichettaPolizza') },
    { value: 'Personalizzato', label: tPaginaContenitore('etichettaPersonalizzato') },
  ]

  const opzioniTipo = [{ value: '', label: tPaginaRibilanciamento('optionSeleziona') }, ...tipiContenitore]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!tipo) {
      e.preventDefault()
      setErroreTipo(t('erroreSelezionaTipo'))
      return
    }
    setErroreTipo(null)
  }

  async function salvaModifica(formData: FormData) {
    if (!contenitore) return
    setErroreSalvataggio(null)
    setSalvataggio(true)
    const risultato = await aggiornaContenitore(contenitore.id, formData)
    setSalvataggio(false)
    if ('errore' in risultato) setErroreSalvataggio(t('erroreGenerico'))
    else onSalvato?.()
  }

  // Campi non controllati precompilati con defaultValue: bastano per partire
  // dai valori correnti.
  const valore = (v: string | null | undefined) => (v == null ? undefined : v)

  return (
    <form
      action={inModifica ? salvaModifica : creaContenitore}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, color: 'var(--text-primary)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
        <div style={{ width: '100%', maxWidth: LARGHEZZA_NOME }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelNome')}
            <input type="text" name="nome" required defaultValue={valore(contenitore?.nome)} style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelTipo')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="tipo"
                value={tipo}
                onChange={(v) => {
                  setTipo(v)
                  if (v) setErroreTipo(null)
                }}
                options={opzioniTipo}
              />
            </div>
          </label>
          {erroreTipo && <p style={stileErroreCampo}>{erroreTipo}</p>}
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelDataAttivazione')}
            <input type="date" name="data_attivazione" defaultValue={valore(contenitore?.data_attivazione)} style={stileCampo} />
          </label>
        </div>
      </div>

      <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
        {t('hintDataAttivazione')}
      </small>

      <div style={{ width: '100%', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          {t('labelNote')}
          <textarea name="note" rows={3} defaultValue={valore(contenitore?.note)} style={stileCampo} />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input
          type="checkbox"
          name="target_attivo"
          defaultChecked={contenitore?.target_attivo ?? true}
          style={{ accentColor: 'var(--primary)' }}
        />
        {t('checkboxTargetAttivo')}
      </label>

      {erroreSalvataggio && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', margin: 0 }}>{erroreSalvataggio}</p>}

      {inModifica ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onAnnulla}
            style={{ ...stileBottone, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          >
            {tPaginaRibilanciamento('bottoneAnnulla')}
          </button>
          <button type="submit" disabled={salvataggio} style={{ ...stileBottone, ...stileBottonePrimario, opacity: salvataggio ? 0.6 : 1 }}>
            {tPaginaRibilanciamento('bottoneSalva')}
          </button>
        </div>
      ) : (
        <button type="submit" style={{ ...stileBottone, ...stileBottonePrimario, alignSelf: 'flex-start' }}>
          {t('bottoneCreaContenitore')}
        </button>
      )}
    </form>
  )
}
