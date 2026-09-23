'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatEuroSigned, formatPercent } from '@/lib/format'

export type ContributoStrumento = {
  strumentoId: string
  nome: string
  ticker: string | null
  guadagno: number
  contributoPctCategoria: number | null
}

export function BarreSottocategoriaRendimento({ items }: { items: ContributoStrumento[] }) {
  const t = useTranslations('PaginaContenitore')
  const [aperto, setAperto] = useState(false)
  if (items.length === 0) return null

  const maxAbs = Math.max(0, ...items.map((it) => Math.abs(it.guadagno)))

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
            const positivo = it.guadagno >= 0
            const colore = positivo ? 'var(--success)' : 'var(--danger)'
            const larghezza = maxAbs > 0 ? (Math.abs(it.guadagno) / maxAbs) * 50 : 0
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
                  <span style={{ color: colore, fontWeight: 500 }}>
                    {formatEuroSigned(it.guadagno)}
                    {it.contributoPctCategoria != null && ` (${formatPercent(it.contributoPctCategoria, 1, true)})`}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 7, background: 'var(--border-default)', borderRadius: 0 }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--text-muted)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      background: colore,
                      borderRadius: 0,
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