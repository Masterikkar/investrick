'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoLineaSemplice = { data: string; valore: number }

export function GraficoLineaSemplice({ punti }: { punti: PuntoLineaSemplice[] }) {
  if (punti.length === 0) {
    return <p style={{ color: '#666', marginTop: 12 }}>Non ci sono ancora dati per quest'anno.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="data"
          tickFormatter={(v) => new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
        />
        <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} />
        <Tooltip
          labelFormatter={(v) => new Date(v as string).toLocaleDateString('it-IT')}
          formatter={(value) => formatEuro(Number(value))}
        />
        <Line type="monotone" dataKey="valore" stroke="#171717" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}