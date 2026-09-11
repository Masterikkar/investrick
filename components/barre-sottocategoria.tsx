'use client'

import { useState } from 'react'

export type SottoTarget = {
  strumentoId: string
  nome: string
  ticker: string | null
  targetPct: number
  pesoAttualePct: number
  scostamentoPp: number
}

export function BarreSottocategoria({ items, soglia }: { items: SottoTarget[]; soglia: number }) {
  const [aperto, setAperto] = useState(false)
  if (items.length === 0) return null

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
            const fuoriSoglia = Math.abs(it.scostamentoPp) >= soglia
            const colore = fuoriSoglia ? '#e6a400' : '#0a7d2c'
            const pesoAttuale = Math.min(it.pesoAttualePct, 100)
            const target = Math.min(it.targetPct, 100)
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
                  <span>
                    {it.pesoAttualePct.toFixed(1)}% attuale · {it.targetPct}% target (
                    {it.scostamentoPp > 0 ? '+' : ''}
                    {it.scostamentoPp} pp)
                  </span>
                </div>
                <div style={{ position: 'relative', height: 7, background: '#eee', borderRadius: 3 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${pesoAttuale}%`,
                      background: colore,
                      borderRadius: 3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      left: `${target}%`,
                      width: 2,
                      height: 11,
                      background: '#333',
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