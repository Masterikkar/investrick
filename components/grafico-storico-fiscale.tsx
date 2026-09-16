'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoStoricoFiscale = {
  anno: number
  realizzato: number
  nonRealizzato: number
}

const VERDE_SCURO = '#34C77B'
const ROSSO_SCURO = '#E5484D'
const VERDE_CHIARO = '#7DDBA8'
const ROSSO_CHIARO = '#F09A9D'
const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'

export function GraficoStoricoFiscale({ punti }: { punti: PuntoStoricoFiscale[] }) {
  if (punti.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>Non abbastanza storico per un grafico.</p>
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRIGLIA} />
          <XAxis dataKey="anno" tick={{ fill: TESTO_ASSI, fontSize: 12 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
          <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} tick={{ fill: TESTO_ASSI, fontSize: 12 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
          <Tooltip
            formatter={(value) => formatEuro(Number(value))}
            contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
            labelStyle={{ color: '#E8EBF2' }}
            itemStyle={{ color: '#E8EBF2' }}
          />
          <Bar dataKey="realizzato" name="Realizzate nette" maxBarSize={36}>
            {punti.map((p, i) => (
              <Cell key={`realizzato-${i}`} fill={p.realizzato >= 0 ? VERDE_SCURO : ROSSO_SCURO} />
            ))}
          </Bar>
          <Bar dataKey="nonRealizzato" name="Non realizzate" maxBarSize={36}>
            {punti.map((p, i) => (
              <Cell key={`nonrealizzato-${i}`} fill={p.nonRealizzato >= 0 ? VERDE_CHIARO : ROSSO_CHIARO} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        Scuro = realizzato · Chiaro = non realizzato · Verde = plusvalenza · Rosso = minusvalenza
      </p>
    </div>
  )
}