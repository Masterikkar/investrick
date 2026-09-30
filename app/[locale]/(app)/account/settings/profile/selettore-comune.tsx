'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { normalizzaTestoRicerca } from '@/lib/testo-ricerca'
import {
  stileCampo,
  stileErroreCampo,
  stileEtichetta,
} from '../../data-management/transactions/nuova-transazione'
import { cercaComuni, type Comune } from './actions'

const PAUSA_DIGITAZIONE_MS = 150

// Campo di testo con suggerimenti dall'elenco dei comuni italiani. Chi lo usa
// riceve il comune solo quando l'utente lo sceglie dall'elenco; ogni modifica
// del testo dopo la scelta la annulla (onCambiaTesto).
export function SelettoreComune({
  testo,
  onCambiaTesto,
  onSeleziona,
  errore,
}: {
  testo: string
  onCambiaTesto: (testo: string) => void
  onSeleziona: (comune: Comune) => void
  errore?: string
}) {
  const t = useTranslations('PaginaProfilo')
  const idLista = useId()
  const contenitore = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const numeroRichiesta = useRef(0)
  const [suggerimenti, setSuggerimenti] = useState<Comune[]>([])
  const [aperto, setAperto] = useState(false)
  const [attivo, setAttivo] = useState(-1)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Un clic fuori dal campo chiude l'elenco.
  useEffect(() => {
    if (!aperto) return
    function handleMouseDown(e: MouseEvent) {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) setAperto(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [aperto])

  function handleChange(valore: string) {
    onCambiaTesto(valore)
    clearTimeout(timer.current)
    const richiesta = ++numeroRichiesta.current
    if (normalizzaTestoRicerca(valore).length < 2) {
      setSuggerimenti([])
      setAperto(false)
      return
    }
    timer.current = setTimeout(async () => {
      const risultati = await cercaComuni(valore)
      // Risposta di una ricerca superata da una più recente: si ignora.
      if (richiesta !== numeroRichiesta.current) return
      setSuggerimenti(risultati)
      setAttivo(-1)
      setAperto(true)
    }, PAUSA_DIGITAZIONE_MS)
  }

  function seleziona(comune: Comune) {
    clearTimeout(timer.current)
    numeroRichiesta.current++
    setAperto(false)
    setSuggerimenti([])
    onSeleziona(comune)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aperto) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAttivo((i) => (suggerimenti.length === 0 ? -1 : (i + 1) % suggerimenti.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAttivo((i) => (suggerimenti.length === 0 ? -1 : (i <= 0 ? suggerimenti.length - 1 : i - 1)))
    } else if (e.key === 'Enter' && attivo >= 0) {
      e.preventDefault()
      seleziona(suggerimenti[attivo])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setAperto(false)
    }
  }

  return (
    <div>
      <div ref={contenitore} style={{ position: 'relative' }}>
        <label style={stileEtichetta}>
          {t('labelCitta')}
          <input
            type="text"
            role="combobox"
            aria-expanded={aperto}
            aria-controls={idLista}
            aria-autocomplete="list"
            autoComplete="off"
            value={testo}
            placeholder={t('placeholderCitta')}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={stileCampo}
          />
        </label>

        {aperto && (
          <ul
            id={idLista}
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 20,
              margin: 0,
              padding: 4,
              listStyle: 'none',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {suggerimenti.length === 0 && (
              <li style={{ padding: '8px 10px', fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)' }}>
                {t('nessunComune')}
              </li>
            )}
            {suggerimenti.map((c, i) => (
              <li
                key={c.codice_istat}
                role="option"
                aria-selected={i === attivo}
                // mousedown e non click: il campo non deve perdere il focus prima della scelta.
                onMouseDown={(e) => {
                  e.preventDefault()
                  seleziona(c)
                }}
                onMouseEnter={() => setAttivo(i)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-form-label)',
                  background: i === attivo ? 'var(--border-default)' : 'transparent',
                }}
              >
                {c.nome_straniero ? `${c.nome}/${c.nome_straniero}` : c.nome}
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
                  {' '}
                  · {c.sigla_provincia} · {c.regione}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errore && <p style={stileErroreCampo}>{errore}</p>}
    </div>
  )
}
