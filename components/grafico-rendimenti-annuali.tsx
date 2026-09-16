'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

export type RendimentoAnnuale = { anno: number; rendimentoPct: number | null }

const VERDE = '#34C77B'
const ROSSO = '#E5484D'
const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'

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
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rendimento cumulato (da sempre)</span>
        <div
          style={{
            fontFamily: 'var(--font-zilla-slab)',
            fontWeight: 600,
            fontSize: 32,
            marginTop: 2,
            color: (rendimentoCumulato ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {rendimentoCumulato != null ? formatPercent(rendimentoCumulato) : '—'}
        </div>
      </div>

      {dati.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>Nessuno storico disponibile ancora.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dati}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRIGLIA} />
            <XAxis dataKey="anno" fontSize={12} tick={{ fill: TESTO_ASSI }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
            <YAxis tickFormatter={(v) => `${v}%`} fontSize={12} width={50} tick={{ fill: TESTO_ASSI }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
            <Tooltip
              formatter={(value) => [value != null ? formatPercent(Number(value)) : '—', 'Rendimento']}
              contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
              labelStyle={{ color: '#E8EBF2' }}
              itemStyle={{ color: '#E8EBF2' }}
            />
            <Bar dataKey="valore" radius={0} maxBarSize={48}>
              {dati.map((d, i) => (
                <Cell key={i} fill={(d.valore ?? 0) >= 0 ? VERDE : ROSSO} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}