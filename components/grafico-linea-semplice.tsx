'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoLineaSemplice = { data: string; valore: number }

const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'
const LINEA = '#7C8CFF'

export function GraficoLineaSemplice({ punti }: { punti: PuntoLineaSemplice[] }) {
  if (punti.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>Non ci sono ancora dati per quest'anno.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRIGLIA} />
        <XAxis
          dataKey="data"
          tickFormatter={(v) => new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
          tick={{ fill: TESTO_ASSI, fontSize: 12 }}
          axisLine={{ stroke: GRIGLIA }}
          tickLine={{ stroke: GRIGLIA }}
        />
        <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} tick={{ fill: TESTO_ASSI, fontSize: 12 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
        <Tooltip
          labelFormatter={(v) => new Date(v as string).toLocaleDateString('it-IT')}
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
          labelStyle={{ color: '#E8EBF2' }}
          itemStyle={{ color: '#E8EBF2' }}
        />
        <Line type="monotone" dataKey="valore" stroke={LINEA} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}