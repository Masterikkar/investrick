'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { formatEuro, formatPercent } from '@/lib/format'

export type FettaAnello = { nome: string; valore: number }

// Sfumatura di indaco: dalla fetta più grande (più satura/scura) alla più
// piccola (quasi bianca). Stessa tonalità (~235, il nostro indaco), sale
// solo la luminosità — non è un ciclo di colori diversi.
function generaSfumaturaIndaco(n: number): string[] {
  const hue = 235
  const sat = 68
  const lightStart = 59
  const lightEnd = 90
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1)
    const l = lightStart + t * (lightEnd - lightStart)
    return `hsl(${hue}, ${sat}%, ${l}%)`
  })
}

export function GraficoAnello({ fette }: { fette: FettaAnello[] }) {
  const [selezionato, setSelezionato] = useState<number | null>(null)

  // Ordinate dalla più grande alla più piccola: il colore comunica il peso
  // ("più scuro = più grande"), quindi l'ordine visivo deve rispecchiarlo —
  // non l'ordine canonico eventualmente passato dal chiamante.
  const fetteValide = fette.filter((f) => f.valore > 0).sort((a, b) => b.valore - a.valore)

  if (fetteValide.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>Nessun dato da mostrare.</p>
  }

  const totale = fetteValide.reduce((s, f) => s + f.valore, 0)
  const colori = generaSfumaturaIndaco(fetteValide.length)

  const centroNome = selezionato !== null ? fetteValide[selezionato].nome : 'Totale'
  const centroValore = selezionato !== null ? fetteValide[selezionato].valore : totale
  const centroPct = selezionato !== null ? (fetteValide[selezionato].valore / totale) * 100 : null

  return (
    <div style={{ position: 'relative' }} onClick={() => setSelezionato(null)}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={fetteValide}
            dataKey="valore"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius={66}
            outerRadius={96}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            onMouseEnter={(_, index) => setSelezionato(index)}
            onMouseLeave={() => setSelezionato(null)}
            onClick={(_, index, event) => {
              event.stopPropagation()
              setSelezionato((prev) => (prev === index ? null : index))
            }}
          >
            {fetteValide.map((_, i) => (
              <Cell key={i} fill={colori[i]} style={{ cursor: 'pointer' }} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
          padding: '0 40px',
        }}
      >
        <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{centroNome}</div>
        <div style={{ fontSize: 'var(--fs-card-value)', fontWeight: 500, color: 'var(--text-primary)', marginTop: 4 }}>
          {formatEuro(centroValore)}
        </div>
        {centroPct !== null && (
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)', marginTop: 2 }}>
            {formatPercent(centroPct, 2)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 }}>
        {fetteValide.map((f, i) => (
          <span
            key={f.nome}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-badge)', color: 'var(--text-secondary)' }}
          >
            <span style={{ width: 9, height: 9, background: colori[i], display: 'inline-block' }} />
            {f.nome}
          </span>
        ))}
      </div>
    </div>
  )
}