'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoStorico = { data: string; valore: number }

type Periodo = '1G' | '1S' | '1M' | '1A' | 'YTD' | 'SEMPRE'

const PERIODI: { key: Periodo; label: string }[] = [
  { key: '1G', label: '1G' },
  { key: '1S', label: '1S' },
  { key: '1M', label: '1M' },
  { key: '1A', label: '1A' },
  { key: 'YTD', label: 'YTD' },
  { key: 'SEMPRE', label: 'Da sempre' },
]

function filtraPerPeriodo(punti: PuntoStorico[], periodo: Periodo): PuntoStorico[] {
  if (periodo === 'SEMPRE') return punti

  if (periodo === '1G') {
    // Un solo aggiornamento al giorno: "1G" confronta gli ultimi due punti disponibili
    // (oggi vs il giorno prima), non un vero arco di 24 ore — che con questa cadenza
    // non avrebbe mai abbastanza dati.
    return punti.slice(-2)
  }

  const oggi = new Date()
  let dataMinima: Date
  if (periodo === 'YTD') {
    dataMinima = new Date(oggi.getFullYear(), 0, 1)
  } else {
    const giorni = { '1S': 7, '1M': 30, '1A': 365 }[periodo] ?? 0
    dataMinima = new Date(oggi)
    dataMinima.setDate(dataMinima.getDate() - giorni)
  }
  return punti.filter((p) => new Date(p.data) >= dataMinima)
}

const formatEuroCompatto = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
})
const formatEuroCompleto = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function formatPercentAsse(v: number) {
  return `${v.toFixed(0)}%`
}
function formatPercentTooltip(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export function GraficoStorico({
  punti,
  formato = 'euro',
  valoreAttuale,
}: {
  punti: PuntoStorico[]
  formato?: 'euro' | 'percent'
  /** Il totale in € mostrato in grande. Se formato è 'percent', accanto compare anche un
   *  badge: per "Da sempre" è il rendimento totale attuale (identico alla card "Rendimento"
   *  sotto); per gli altri periodi è la variazione del rendimento durante quella finestra. */
  valoreAttuale?: number
}) {
  const [periodo, setPeriodo] = useState<Periodo>('1M')
  const datiFiltrati = useMemo(() => filtraPerPeriodo(punti, periodo), [punti, periodo])

  const rendimentoBadge = useMemo(() => {
    if (formato !== 'percent') return null
    if (periodo === 'SEMPRE') {
      return punti.length > 0 ? punti[punti.length - 1].valore : null
    }
    if (datiFiltrati.length < 2) return null
    return datiFiltrati[datiFiltrati.length - 1].valore - datiFiltrati[0].valore
  }, [formato, periodo, punti, datiFiltrati])

  const formatAsse = formato === 'percent' ? formatPercentAsse : (v: number) => formatEuroCompatto.format(v)
  const formatTooltip =
    formato === 'percent' ? (v: number) => formatPercentTooltip(v) : (v: number) => formatEuroCompleto.format(v)
  const etichettaTooltip = formato === 'percent' ? 'Rendimento' : 'Valore'

  return (
    <div>
      {valoreAttuale !== undefined && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>{formatEuro(valoreAttuale)}</p>
          {rendimentoBadge !== null && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: rendimentoBadge >= 0 ? '#0a7d2c' : '#c0392b',
              }}
            >
              {rendimentoBadge >= 0 ? '+' : ''}
              {rendimentoBadge.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {PERIODI.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #ddd',
              background: periodo === p.key ? '#111' : '#fff',
              color: periodo === p.key ? '#fff' : '#111',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {punti.length === 0 ? (
        <p style={{ color: '#666' }}>Nessuno storico disponibile ancora.</p>
      ) : datiFiltrati.length < 2 ? (
        <p style={{ color: '#666' }}>Non abbastanza dati per questo periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={datiFiltrati}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="data"
              tickFormatter={(d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
              fontSize={12}
            />
            <YAxis tickFormatter={(v) => formatAsse(Number(v))} fontSize={12} width={70} />
            <Tooltip
              formatter={(value) => [formatTooltip(Number(value)), etichettaTooltip]}
              labelFormatter={(label) => (label ? new Date(String(label)).toLocaleDateString('it-IT') : '')}
            />
            <Line type="monotone" dataKey="valore" stroke="#111" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}