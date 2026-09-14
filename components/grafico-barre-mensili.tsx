'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoMensile = { mese: string; valore: number }

const VERDE = '#16a34a'
const ROSSO = '#b91c1c'

export function GraficoBarreMensili({ punti }: { punti: PuntoMensile[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mese" />
        <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} />
        <Tooltip formatter={(value) => formatEuro(Number(value))} />
        <Bar dataKey="valore" maxBarSize={36}>
          {punti.map((p, i) => (
            <Cell key={i} fill={p.valore >= 0 ? VERDE : ROSSO} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}