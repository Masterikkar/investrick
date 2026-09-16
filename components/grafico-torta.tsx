'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type FettaTorta = { nome: string; valore: number }

const COLORI = ['#D9922E', '#2AC6B8', '#4FA0E0', '#C65FC9', '#E85D8A', '#8B93A8']

export function GraficoTorta({ fette }: { fette: FettaTorta[] }) {
  const fetteValide = fette.filter((f) => f.valore > 0)

  if (fetteValide.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>Nessun dato da mostrare.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={fetteValide}
          dataKey="valore"
          nameKey="nome"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(props: any) => (props.percent >= 0.04 ? `${props.nome} ${(props.percent * 100).toFixed(0)}%` : null)}
        >
          {fetteValide.map((_, i) => (
            <Cell key={i} fill={COLORI[i % COLORI.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
          labelStyle={{ color: '#E8EBF2' }}
          itemStyle={{ color: '#E8EBF2' }}
        />
        <Legend wrapperStyle={{ color: '#9198AD', fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}