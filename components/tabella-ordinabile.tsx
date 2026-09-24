'use client'

import { useState, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { RippleLink } from '@/components/ripple-link'
import { formatData, formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'

export type ColonnaTabella = {
  key: string
  label: string
  kind: 'text' | 'link' | 'euro' | 'euro-signed' | 'percent' | 'percent-signed' | 'date' | 'numero'
  linkPrefix?: string
  linkKey?: string
}

export type RigaTabella = Record<string, string | number | null> & { key: string }

export function TabellaOrdinabile({
  colonne,
  righe,
}: {
  colonne: ColonnaTabella[]
  righe: RigaTabella[]
}) {
  const locale = useLocale() as LocaleFormato
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

  const righeOrdinate = useMemo(() => {
    if (!sortKey) return righe
    const copia = [...righe]
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
  }, [righe, sortKey, sortAsc, locale])

  function renderCella(colonna: ColonnaTabella, riga: RigaTabella) {
    const valore = riga[colonna.key]

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
        return formatEuro(Number(valore) || 0, locale)
      case 'euro-signed': {
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEuroSigned(n, locale)}</span>
        )
      }
      case 'percent':
        return formatPercent(Number(valore) || 0, 2, false, locale)
      case 'percent-signed': {
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPercent(n, 2, true, locale)}</span>
        )
      }
      case 'date':
        return valore ? formatData(String(valore), locale) : '—'
      case 'numero':
        return valore === null || valore === undefined ? '—' : formatNumero(Number(valore), 2, false, locale)
      default:
        return valore ?? '—'
    }
  }

  return (
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
              {sortKey === c.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {righeOrdinate.length === 0 ? (
          <tr>
            <td colSpan={colonne.length} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
              Nessun dato.
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
}