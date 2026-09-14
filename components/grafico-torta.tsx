'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type FettaTorta = { nome: string; valore: number }

const COLORI = ['#171717', '#2563eb', '#16a34a', '#e6a400', '#b91c1c', '#7c3aed', '#0891b2', '#db2777']

export function GraficoTorta({ fette }: { fette: FettaTorta[] }) {
  const fetteValide = fette.filter((f) => f.valore > 0)

  if (fetteValide.length === 0) {
    return <p style={{ color: '#666' }}>Nessun dato da mostrare.</p>
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
        <Tooltip formatter={(value) => formatEuro(Number(value))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}