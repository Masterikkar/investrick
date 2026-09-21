'use client'

import { useState } from 'react'
import { creaAsset } from './actions'
import { MenuSelect } from '@/components/menu-select'
import { LARGHEZZA_STANDARD, GAP_CAMPI, LARGHEZZA_RIGA_QUATTRO_CAMPI, LARGHEZZA_NOME } from './layout-campi'

type TipiPerCategoria = Record<string, string[]>

const ETICHETTA_CATEGORIA: Record<string, string> = {
  Liquidita: 'Liquidità',
}

const OPZIONI_FREQUENZA_CEDOLA = [
  { value: '', label: 'Seleziona...' },
  { value: 'Annuale', label: 'Annuale' },
  { value: 'Semestrale', label: 'Semestrale' },
  { value: 'Trimestrale', label: 'Trimestrale' },
  { value: 'Mensile', label: 'Mensile' },
  { value: 'Zero coupon', label: 'Zero coupon' },
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

export function FormNuovoAsset({ tipiPerCategoria }: { tipiPerCategoria: TipiPerCategoria }) {
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState('')
  const [tipo, setTipo] = useState('')
  const [frequenzaCedola, setFrequenzaCedola] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const tipiDisponibili = categoria ? tipiPerCategoria[categoria] ?? [] : []
  const isLiquidita = categoria === 'Liquidita'
  const isObbligazioni = categoria === 'Obbligazioni'

  const opzioniCategoria = [
    { value: '', label: 'Seleziona...' },
    ...categorie.map((c) => ({ value: c, label: ETICHETTA_CATEGORIA[c] ?? c })),
  ]
  const opzioniTipo = [{ value: '', label: 'Seleziona...' }, ...tipiDisponibili.map((t) => ({ value: t, label: t }))]

  function handleCategoriaChange(nuovaCategoria: string) {
    setCategoria(nuovaCategoria)
    setTipo('')
    if (nuovaCategoria) setErroriCampo((prev) => ({ ...prev, categoria: '' }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}
    if (!categoria) nuoviErrori.categoria = 'Seleziona una categoria.'
    if (!tipo) nuoviErrori.tipo = 'Seleziona un tipo.'

    if (Object.keys(nuoviErrori).length > 0) {
      e.preventDefault()
      setErroriCampo(nuoviErrori)
      return
    }
    setErroriCampo({})
  }

  return (
    <form
      action={creaAsset}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, color: 'var(--text-primary)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Categoria
            <div style={{ marginTop: 4 }}>
              <MenuSelect name="categoria" value={categoria} onChange={handleCategoriaChange} options={opzioniCategoria} />
            </div>
          </label>
          {erroriCampo.categoria && <p style={stileErroreCampo}>{erroriCampo.categoria}</p>}
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
                  if (v) setErroriCampo((prev) => ({ ...prev, tipo: '' }))
                }}
                options={opzioniTipo}
                disabled={!categoria}
              />
            </div>
          </label>
          {erroriCampo.tipo && <p style={stileErroreCampo}>{erroriCampo.tipo}</p>}
        </div>

        <div style={{ width: '100%', maxWidth: LARGHEZZA_NOME }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Nome
            <input type="text" name="nome" required style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Ticker
            <input type="text" name="ticker" style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            ISIN
            <input type="text" name="isin" style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            Valuta
            <input type="text" name="valuta" defaultValue="EUR" required style={stileCampo} />
          </label>
        </div>

        {!isLiquidita && (
          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              Codice prezzo (EODHD)
              <input type="text" name="codice_prezzo" placeholder="es. EUNL.XETRA" style={stileCampo} />
            </label>
          </div>
        )}

        {isLiquidita && (
          <>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                Provider
                <input type="text" name="provider" style={stileCampo} />
              </label>
            </div>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                Tasso %
                <input type="number" name="tasso_percentuale" step="any" style={stileCampo} />
              </label>
            </div>
          </>
        )}
      </div>

      {!isLiquidita && (
        <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
          Codice prezzo: lascia vuoto se non vuoi ancora attivare l&apos;aggiornamento automatico.
        </small>
      )}

      {isObbligazioni && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
            <input type="checkbox" name="titolo_di_stato" style={{ accentColor: 'var(--primary)' }} />
            Titolo di Stato
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                % titoli di Stato (whitelist)
                <input type="number" name="percentuale_titoli_stato" min="0" max="100" step="any" style={stileCampo} />
              </label>
            </div>

            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                Scadenza
                <input type="date" name="data_scadenza" style={stileCampo} />
              </label>
            </div>

            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                Cedola %
                <input type="number" name="cedola_percentuale" min="0" step="any" style={stileCampo} />
              </label>
            </div>

            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                Frequenza cedola
                <div style={{ marginTop: 4 }}>
                  <MenuSelect
                    name="frequenza_cedola"
                    value={frequenzaCedola}
                    onChange={setFrequenzaCedola}
                    options={OPZIONI_FREQUENZA_CEDOLA}
                  />
                </div>
              </label>
            </div>
          </div>

          <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
            Lascia vuoto se non conosci ancora la percentuale ufficiale pubblicata dall&apos;emittente.
          </small>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          Note
          <textarea name="note" rows={3} style={stileCampo} />
        </label>
      </div>

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
        Crea asset
      </button>
    </form>
  )
}