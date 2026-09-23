'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatPercent, formatNumero } from '@/lib/format'

export type SottoTarget = {
  strumentoId: string
  nome: string
  ticker: string | null
  targetPct: number
  pesoAttualePct: number
  scostamentoPp: number
}

export function BarreSottocategoria({ items, soglia }: { items: SottoTarget[]; soglia: number }) {
  const t = useTranslations('PaginaContenitore')
  const [aperto, setAperto] = useState(false)
  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 8, marginLeft: 16 }}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        style={{
          fontSize: 'var(--fs-card-link)',
          background: 'none',
          border: '1px solid var(--border-default)',
          borderRadius: 0,
          padding: '2px 8px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        {aperto ? '▾' : '▸'} {t('linkDettaglioPerStrumento')}
      </button>

      {aperto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => {
            const fuoriSoglia = Math.abs(it.scostamentoPp) >= soglia
            const colore = fuoriSoglia ? 'var(--warning)' : 'var(--success)'
            const pesoAttuale = Math.min(it.pesoAttualePct, 100)
            const target = Math.min(it.targetPct, 100)
            return (
              <div key={it.strumentoId}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--fs-card-link)',
                    marginBottom: 3,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>
                    {it.nome} {it.ticker ? `(${it.ticker})` : ''}
                  </span>
                  <span>
                    {t('barraComposizione', {
                      pesoAttuale: formatPercent(it.pesoAttualePct, 1),
                      target: formatPercent(it.targetPct, 1),
                      scostamento: formatNumero(it.scostamentoPp, 2, true),
                    })}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 7, background: 'var(--border-default)', borderRadius: 0 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${pesoAttuale}%`,
                      background: colore,
                      borderRadius: 0,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      left: `${target}%`,
                      width: 2,
                      height: 11,
                      background: 'var(--primary-vivid)',
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