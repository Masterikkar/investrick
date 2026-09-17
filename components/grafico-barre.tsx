'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoBarra = { etichetta: string; valore: number }

const VERDE = '#34C77B'
const ROSSO = '#E5484D'
const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'

export function GraficoBarre({ punti }: { punti: PuntoBarra[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRIGLIA} />
        <XAxis dataKey="etichetta" tick={{ fill: TESTO_ASSI, fontSize: 11 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
        <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} tick={{ fill: TESTO_ASSI, fontSize: 11 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
        <Tooltip
          formatter={(value) => formatEuro(Number(value))}
          cursor={{ fill: '#1A2036', fillOpacity: 0.5 }}
          contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
          labelStyle={{ color: '#E8EBF2' }}
          itemStyle={{ color: '#E8EBF2' }}
        />
        <Bar dataKey="valore" maxBarSize={36}>
          {punti.map((p, i) => (
            <Cell key={i} fill={p.valore >= 0 ? VERDE : ROSSO} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}