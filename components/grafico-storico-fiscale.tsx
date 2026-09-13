'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro } from '@/lib/format'

export type PuntoStoricoFiscale = {
  anno: number
  realizzato: number
  nonRealizzato: number
}

const VERDE_SCURO = '#16a34a'
const ROSSO_SCURO = '#b91c1c'
const VERDE_CHIARO = '#86efac'
const ROSSO_CHIARO = '#fca5a5'

export function GraficoStoricoFiscale({ punti }: { punti: PuntoStoricoFiscale[] }) {
  if (punti.length === 0) {
    return <p style={{ color: '#666', marginTop: 12 }}>Non abbastanza storico per un grafico.</p>
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="anno" />
          <YAxis tickFormatter={(v) => formatEuro(Number(v))} width={80} />
          <Tooltip formatter={(value) => formatEuro(Number(value))} />
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
      <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        Scuro = realizzato · Chiaro = non realizzato · Verde = plusvalenza · Rosso = minusvalenza
      </p>
    </div>
  )
}