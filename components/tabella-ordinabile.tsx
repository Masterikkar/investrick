'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RippleLink } from '@/components/ripple-link'
import { InfoTooltip } from '@/components/info-tooltip'
import { formatData, formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'

export type ColonnaTabella = {
  key: string
  label: string
  kind: 'text' | 'link' | 'euro' | 'euro-signed' | 'percent' | 'percent-signed' | 'date' | 'numero'
  linkPrefix?: string
  linkKey?: string
  // Testo di un InfoTooltip accanto all'intestazione, per spiegare il
  // riferimento della colonna (es. su cosa è calcolato il Peso).
  tooltip?: string
}

export type RigaTabella = Record<string, string | number | null> & { key: string }

// Campi su cui cerca il filtro "Filtra per posizione...": nome, ticker e ISIN
// dello strumento. Le righe li devono contenere anche se non sono colonne.
export const CHIAVI_FILTRO_POSIZIONE: readonly string[] = ['nome', 'ticker', 'isin']

// Stesso campo dei filtri testuali di Storico e Fiscalità.
export const stileCampoFiltro: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  width: 260,
  maxWidth: '100%',
  fontSize: 'var(--fs-table)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
}

export function TabellaOrdinabile({
  colonne,
  righe,
  filtro,
}: {
  colonne: ColonnaTabella[]
  righe: RigaTabella[]
  // Con questa prop, sopra la tabella compare un campo che tiene solo le
  // righe in cui uno dei campi indicati contiene il testo cercato.
  filtro?: { chiavi: readonly string[]; placeholder?: string }
}) {
  const locale = useLocale() as LocaleFormato
  const t = useTranslations('TabellaOrdinabile')
  const tFiltro = useTranslations('FiltroTabellaStorico')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  function handleClickHeader(colonna: ColonnaTabella) {
    if (sortKey === colonna.key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(colonna.key)
      setSortAsc(colonna.kind === 'text' || colonna.kind === 'link')
    }
  }

  const righeFiltrate = useMemo(() => {
    const testo = query.trim().toLowerCase()
    if (!filtro || !testo) return righe
    return righe.filter((r) => filtro.chiavi.some((k) => String(r[k] ?? '').toLowerCase().includes(testo)))
  }, [righe, filtro, query])

  const righeOrdinate = useMemo(() => {
    if (!sortKey) return righeFiltrate
    const copia = [...righeFiltrate]
    copia.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      // I valori mancanti (mostrati come "—") vanno sempre in fondo, in
      // entrambe le direzioni, invece di essere ordinati come se valessero 0.
      const mancanteA = va === null || va === undefined
      const mancanteB = vb === null || vb === undefined
      if (mancanteA || mancanteB) return mancanteA === mancanteB ? 0 : mancanteA ? 1 : -1
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, locale)
      } else {
        cmp = (Number(va) || 0) - (Number(vb) || 0)
      }
      return sortAsc ? cmp : -cmp
    })
    return copia
  }, [righeFiltrate, sortKey, sortAsc, locale])

  function renderCella(colonna: ColonnaTabella, riga: RigaTabella) {
    const valore = riga[colonna.key]
    // Un valore mancante (null) si mostra sempre come "—", mai come un finto 0.
    const mancante = valore === null || valore === undefined

    switch (colonna.kind) {
      case 'link': {
        const id = colonna.linkKey ? riga[colonna.linkKey] : null
        if (id === null || id === undefined || id === '') {
          return valore ?? '—'
        }
        return (
          <RippleLink href={`${colonna.linkPrefix ?? ''}${id}`} className="link-interattivo">
            {valore ?? '—'}
          </RippleLink>
        )
      }
      case 'euro':
        return mancante ? '—' : formatEuro(Number(valore) || 0, locale)
      case 'euro-signed': {
        if (mancante) return '—'
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEuroSigned(n, locale)}</span>
        )
      }
      case 'percent':
        return mancante ? '—' : formatPercent(Number(valore) || 0, 2, false, locale)
      case 'percent-signed': {
        if (mancante) return '—'
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPercent(n, 2, true, locale)}</span>
        )
      }
      case 'date':
        return valore ? formatData(String(valore), locale) : '—'
      case 'numero':
        return mancante ? '—' : formatNumero(Number(valore), 2, false, locale)
      default:
        return valore ?? '—'
    }
  }

  const tabella = (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
          {colonne.map((c) => (
            <th
              key={c.key}
              onClick={() => handleClickHeader(c)}
              style={{ padding: '8px 12px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 500 }}
            >
              {c.label}
              {c.tooltip && (
                // Aprire il tooltip non deve ordinare la colonna.
                <span onClick={(e) => e.stopPropagation()}>
                  <InfoTooltip testo={c.tooltip} />
                </span>
              )}
              {sortKey === c.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {righeOrdinate.length === 0 ? (
          <tr>
            <td colSpan={colonne.length} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
              {t('alertNessunDato')}
            </td>
          </tr>
        ) : (
          righeOrdinate.map((r) => (
            <tr key={r.key} className="tabella-riga">
              {colonne.map((c) => (
                <td key={c.key} style={{ padding: '8px 12px' }}>
                  {renderCella(c, r)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  if (!filtro) return tabella

  return (
    <>
      <input
        type="text"
        placeholder={filtro.placeholder ?? tFiltro('placeholderFiltraPosizione')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ ...stileCampoFiltro, display: 'block', marginBottom: 12 }}
      />
      {tabella}
    </>
  )
}
