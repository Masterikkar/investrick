'use client'

import { useState } from 'react'
import { creaContenitore } from './actions-contenitore'
import { MenuSelect } from '@/components/menu-select'
import { LARGHEZZA_STANDARD, GAP_CAMPI, LARGHEZZA_RIGA_QUATTRO_CAMPI, LARGHEZZA_NOME } from './layout-campi'

const TIPI_CONTENITORE = [
  { value: 'PAC', label: 'PAC' },
  { value: 'Polizza', label: 'Polizza vita' },
  { value: 'Liquidita', label: 'Liquidità' },
]

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

export function FormNuovoContenitore() {
  const [tipo, setTipo] = useState('')
  const [erroreTipo, setErroreTipo] = useState<string | null>(null)

  const opzioniTipo = [{ value: '', label: 'Seleziona...' }, ...TIPI_CONTENITORE]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!tipo) {
      e.preventDefault()
      setErroreTipo('Seleziona un tipo.')
      return
    }
    setErroreTipo(null)
  }

  return (
    <form
      action={creaContenitore}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, color: 'var(--text-primary)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
        <div style={{ width: '100%', maxWidth: LARGHEZZA_NOME }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Nome
            <input type="text" name="nome" required style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Tipo
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
            Data di attivazione
            <input type="date" name="data_attivazione" style={stileCampo} />
          </label>
        </div>
      </div>

      <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
        Data di attivazione facoltativa, utile soprattutto per le polizze.
      </small>

      <div style={{ width: '100%', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          Note
          <textarea name="note" rows={3} style={stileCampo} />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input type="checkbox" name="target_attivo" defaultChecked style={{ accentColor: 'var(--primary)' }} />
        Target attivo
      </label>

      <button
        type="submit"
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          fontSize: 'var(--fs-button)',
          fontWeight: 500,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Crea contenitore
      </button>
    </form>
  )
}