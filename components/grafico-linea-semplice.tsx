'use client'

import { useLocale } from 'next-intl'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatData, formatEuro, type LocaleFormato } from '@/lib/format'

export type PuntoLineaSemplice = { data: string; valore: number }

const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'
const LINEA = '#7C8CFF'

export function GraficoLineaSemplice({
  punti,
  messaggioNessunDato = "Non ci sono ancora dati per quest'anno.",
}: {
  punti: PuntoLineaSemplice[]
  messaggioNessunDato?: string
}) {
  const locale = useLocale() as LocaleFormato

  if (punti.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{messaggioNessunDato}</p>
  }

  // Se tutti i valori della serie sono identici (es. una linea piatta a 0),
  // il range automatico dell'asse Y può collassare in un intervallo
  // degenere (min = max) — Recharts in quel caso può non disegnare nulla,
  // silenziosamente. Forziamo un range esplicito solo in questo caso;
  // altrimenti lasciamo il calcolo automatico invariato.
  const valori = punti.map((p) => p.valore)
  const minValore = Math.min(...valori)
  const maxValore = Math.max(...valori)
  const dominioY: [number, number] | undefined =
    minValore === maxValore ? [minValore - 1, maxValore + 1] : undefined

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRIGLIA} />
        <XAxis
          dataKey="data"
          tickFormatter={(v) => formatData(v, locale, { day: '2-digit', month: '2-digit' })}
          tick={{ fill: TESTO_ASSI, fontSize: 11 }}
          axisLine={{ stroke: GRIGLIA }}
          tickLine={{ stroke: GRIGLIA }}
        />
        <YAxis
          domain={dominioY}
          tickFormatter={(v) => formatEuro(Number(v), locale)}
          width={80}
          tick={{ fill: TESTO_ASSI, fontSize: 11 }}
          axisLine={{ stroke: GRIGLIA }}
          tickLine={{ stroke: GRIGLIA }}
        />
        <Tooltip
          labelFormatter={(v) => formatData(v as string, locale)}
          formatter={(value) => formatEuro(Number(value), locale)}
          cursor={{ stroke: '#2B3350', strokeWidth: 1 }}
          contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
          labelStyle={{ color: '#E8EBF2' }}
          itemStyle={{ color: '#E8EBF2' }}
        />
        <Line type="monotone" dataKey="valore" stroke={LINEA} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}