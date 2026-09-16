'use client'

import { useState, useMemo } from 'react'
import { RippleLink } from '@/components/ripple-link'
import { formatEuro } from '@/lib/format'

export type ColonnaTabella = {
  key: string
  label: string
  kind: 'text' | 'link' | 'euro' | 'euro-signed' | 'percent' | 'percent-signed' | 'date'
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
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'it')
      } else {
        cmp = (Number(va) || 0) - (Number(vb) || 0)
      }
      return sortAsc ? cmp : -cmp
    })
    return copia
  }, [righe, sortKey, sortAsc])

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
        return formatEuro(Number(valore) || 0)
      case 'euro-signed': {
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {n >= 0 ? '+' : ''}
            {formatEuro(n)}
          </span>
        )
      }
      case 'percent':
        return `${(Number(valore) || 0).toFixed(2)}%`
      case 'percent-signed': {
        const n = Number(valore) || 0
        return (
          <span style={{ color: n >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {n >= 0 ? '+' : ''}
            {n.toFixed(2)}%
          </span>
        )
      }
      case 'date':
        return valore ? new Date(String(valore)).toLocaleDateString('it-IT') : '—'
      default:
        return valore ?? '—'
    }
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
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
            <tr key={r.key} style={{ borderBottom: '1px solid var(--border-default)' }}>
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