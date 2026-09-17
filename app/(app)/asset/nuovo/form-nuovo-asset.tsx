'use client'

import { useState } from 'react'
import { creaAsset } from './actions'

type TipiPerCategoria = Record<string, string[]>

const ETICHETTA_CATEGORIA: Record<string, string> = {
  Liquidita: 'Liquidità',
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

export function FormNuovoAsset({ tipiPerCategoria }: { tipiPerCategoria: TipiPerCategoria }) {
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState(categorie[0] ?? '')
  const [tipo, setTipo] = useState(tipiPerCategoria[categorie[0]]?.[0] ?? '')

  const tipiDisponibili = tipiPerCategoria[categoria] ?? []
  const isLiquidita = categoria === 'Liquidita'
  const isObbligazioni = categoria === 'Obbligazioni'

  function handleCategoriaChange(nuovaCategoria: string) {
    setCategoria(nuovaCategoria)
    setTipo(tipiPerCategoria[nuovaCategoria]?.[0] ?? '')
  }

  return (
    <form
      action={creaAsset}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, color: 'var(--text-primary)' }}
    >
      <label>
        Categoria
        <select
          name="categoria"
          value={categoria}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          required
          style={stileCampo}
        >
          {categorie.map((c) => (
            <option key={c} value={c}>
              {ETICHETTA_CATEGORIA[c] ?? c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} required style={stileCampo}>
          {tipiDisponibili.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Nome
        <input type="text" name="nome" required style={stileCampo} />
      </label>

      <label>
        Ticker
        <input type="text" name="ticker" style={stileCampo} />
      </label>

      <label>
        ISIN
        <input type="text" name="isin" style={stileCampo} />
      </label>

      <label>
        Valuta
        <input type="text" name="valuta" defaultValue="EUR" required style={stileCampo} />
      </label>

      {!isLiquidita && (
        <label>
          Codice prezzo (EODHD)
          <input type="text" name="codice_prezzo" placeholder="es. EUNL.XETRA" style={stileCampo} />
          <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
            Lascia vuoto se non vuoi ancora attivare l&apos;aggiornamento automatico.
          </small>
        </label>
      )}

      {isObbligazioni && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="titolo_di_stato" style={{ accentColor: 'var(--primary)' }} />
            Titolo di Stato
          </label>
          <label>
            % titoli di Stato (whitelist)
            <input
              type="number"
              name="percentuale_titoli_stato"
              min="0"
              max="100"
              step="any"
              style={stileCampo}
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
              Lascia vuoto se non conosci ancora la percentuale ufficiale pubblicata dall&apos;emittente.
            </small>
          </label>
        </>
      )}

      {isLiquidita && (
        <>
          <label>
            Provider
            <input type="text" name="provider" style={stileCampo} />
          </label>
          <label>
            Tasso %
            <input type="number" name="tasso_percentuale" step="any" style={stileCampo} />
          </label>
        </>
      )}

      <label>
        Note
        <textarea name="note" rows={3} style={stileCampo} />
      </label>

      <button
        type="submit"
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          fontSize: 14,
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