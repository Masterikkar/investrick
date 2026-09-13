'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

export type RendimentoAnnuale = { anno: number; rendimentoPct: number | null }

function formatPercent(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export function GraficoRendimentiAnnuali({
  rendimentoCumulato,
  rendimentiAnnuali,
}: {
  rendimentoCumulato: number | null
  rendimentiAnnuali: RendimentoAnnuale[]
}) {
  const dati = rendimentiAnnuali.map((r) => ({
    anno: String(r.anno),
    valore: r.rendimentoPct,
  }))

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#666' }}>Rendimento cumulato (da sempre)</span>
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 32,
            marginTop: 2,
            color: (rendimentoCumulato ?? 0) >= 0 ? '#0a7d2c' : '#c0392b',
          }}
        >
          {rendimentoCumulato != null ? formatPercent(rendimentoCumulato) : '—'}
        </div>
      </div>

      {dati.length === 0 ? (
        <p style={{ color: '#666' }}>Nessuno storico disponibile ancora.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dati}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="anno" fontSize={12} />
            <YAxis tickFormatter={(v) => `${v}%`} fontSize={12} width={50} />
            <Tooltip
              formatter={(value) => [value != null ? formatPercent(Number(value)) : '—', 'Rendimento']}
            />
            <Bar dataKey="valore" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {dati.map((d, i) => (
                <Cell key={i} fill={(d.valore ?? 0) >= 0 ? '#0a7d2c' : '#c0392b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}