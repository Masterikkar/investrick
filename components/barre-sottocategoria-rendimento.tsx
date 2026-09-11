'use client'

import { useState } from 'react'
import { formatEuro } from '@/lib/format'

export type ContributoStrumento = {
  strumentoId: string
  nome: string
  ticker: string | null
  guadagno: number
  contributoPctCategoria: number | null
}

export function BarreSottocategoriaRendimento({ items }: { items: ContributoStrumento[] }) {
  const [aperto, setAperto] = useState(false)
  if (items.length === 0) return null

  const maxAbs = Math.max(0, ...items.map((it) => Math.abs(it.guadagno)))

  return (
    <div style={{ marginTop: 8, marginLeft: 16 }}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        style={{
          fontSize: 12,
          background: 'none',
          border: '1px solid #ddd',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          color: '#666',
        }}
      >
        {aperto ? '▾' : '▸'} Dettaglio per strumento
      </button>

      {aperto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => {
            const positivo = it.guadagno >= 0
            const colore = positivo ? '#0a7d2c' : '#c0392b'
            const larghezza = maxAbs > 0 ? (Math.abs(it.guadagno) / maxAbs) * 50 : 0
            return (
              <div key={it.strumentoId}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 3,
                    color: '#444',
                  }}
                >
                  <span>
                    {it.nome} {it.ticker ? `(${it.ticker})` : ''}
                  </span>
                  <span style={{ color: colore, fontWeight: 600 }}>
                    {positivo ? '+' : ''}
                    {formatEuro(it.guadagno)}
                    {it.contributoPctCategoria != null &&
                      ` (${it.contributoPctCategoria >= 0 ? '+' : ''}${it.contributoPctCategoria.toFixed(1)}%)`}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 7, background: '#eee', borderRadius: 3 }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#999' }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      background: colore,
                      borderRadius: 3,
                      ...(positivo
                        ? { left: '50%', width: `${larghezza}%` }
                        : { right: '50%', width: `${larghezza}%` }),
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}