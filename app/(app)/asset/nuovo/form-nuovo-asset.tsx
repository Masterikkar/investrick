'use client'

import { useState } from 'react'
import { creaAsset } from './actions'

type TipiPerCategoria = Record<string, string[]>

const ETICHETTA_CATEGORIA: Record<string, string> = {
  Liquidita: 'Liquidità',
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
      style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}
    >
      <label>
        Categoria
        <select
          name="categoria"
          value={categoria}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          required
          style={{ width: '100%' }}
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
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          required
          style={{ width: '100%' }}
        >
          {tipiDisponibili.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Nome
        <input type="text" name="nome" required style={{ width: '100%' }} />
      </label>

      <label>
        Ticker
        <input type="text" name="ticker" style={{ width: '100%' }} />
      </label>

      <label>
        ISIN
        <input type="text" name="isin" style={{ width: '100%' }} />
      </label>

      <label>
        Valuta
        <input type="text" name="valuta" defaultValue="EUR" required style={{ width: '100%' }} />
      </label>

      {!isLiquidita && (
        <label>
          Codice prezzo (EODHD)
          <input type="text" name="codice_prezzo" placeholder="es. EUNL.XETRA" style={{ width: '100%' }} />
          <small style={{ color: '#666' }}>Lascia vuoto se non vuoi ancora attivare l&apos;aggiornamento automatico.</small>
        </label>
      )}

      {isObbligazioni && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="titolo_di_stato" />
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
              style={{ width: '100%' }}
            />
            <small style={{ color: '#666' }}>
              Lascia vuoto se non conosci ancora la percentuale ufficiale pubblicata dall&apos;emittente.
            </small>
          </label>
        </>
      )}

      {isLiquidita && (
        <>
          <label>
            Provider
            <input type="text" name="provider" style={{ width: '100%' }} />
          </label>
          <label>
            Tasso %
            <input type="number" name="tasso_percentuale" step="any" style={{ width: '100%' }} />
          </label>
        </>
      )}

      <label>
        Note
        <textarea name="note" rows={3} style={{ width: '100%' }} />
      </label>

      <button type="submit">Crea asset</button>
    </form>
  )
}