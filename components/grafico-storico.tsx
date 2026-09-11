'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

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
  const oggi = new Date()
  let dataMinima: Date
  if (periodo === 'YTD') {
    dataMinima = new Date(oggi.getFullYear(), 0, 1)
  } else {
    const giorni = { '1G': 1, '1S': 7, '1M': 30, '1A': 365 }[periodo] ?? 0
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

export function GraficoStorico({ punti }: { punti: PuntoStorico[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('1M')
  const datiFiltrati = useMemo(() => filtraPerPeriodo(punti, periodo), [punti, periodo])

  if (punti.length === 0) {
    return <p style={{ color: '#666' }}>Nessuno storico disponibile ancora.</p>
  }

  return (
    <div>
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

      {datiFiltrati.length < 2 ? (
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
            <YAxis tickFormatter={(v) => formatEuroCompatto.format(v)} fontSize={12} width={70} />
            <Tooltip
              formatter={(value) => [formatEuroCompleto.format(Number(value)), 'Valore']}
              labelFormatter={(label) => (label ? new Date(String(label)).toLocaleDateString('it-IT') : '')}
            />
            <Line type="monotone" dataKey="valore" stroke="#111" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}