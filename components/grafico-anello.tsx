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

// Unica funzione di ordinamento/colorazione, richiamata sia dall'anello sia
// dall'elenco: garantisce che le due visualizzazioni usino esattamente gli
// stessi colori nello stesso ordine, non due sfumature solo simili.
function ordinaEColora(fette: FettaAnello[]) {
  const fetteValide = fette.filter((f) => f.valore > 0).sort((a, b) => b.valore - a.valore)
  const totale = fetteValide.reduce((s, f) => s + f.valore, 0)
  const colori = generaSfumaturaIndaco(fetteValide.length)
  return { fetteValide, totale, colori }
}

const ALTEZZA_GRAFICO = 280

export function GraficoAnello({ fette }: { fette: FettaAnello[] }) {
  const [selezionato, setSelezionato] = useState<number | null>(null)
  const { fetteValide, totale, colori } = ordinaEColora(fette)

  if (fetteValide.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>Nessun dato da mostrare.</p>
  }

  const centroNome = selezionato !== null ? fetteValide[selezionato].nome : 'Totale'
  const centroValore = selezionato !== null ? fetteValide[selezionato].valore : totale
  const centroPct = selezionato !== null ? (fetteValide[selezionato].valore / totale) * 100 : null

  return (
    <div
      // Contenitore del solo grafico, altezza fissa: l'overlay del testo si
      // centra rispetto a QUESTO div, non rispetto a un'eventuale legenda
      // sotto — altrimenti la legenda sposterebbe il centro visivo in basso.
      style={{ position: 'relative', height: ALTEZZA_GRAFICO }}
      onClick={() => setSelezionato(null)}
    >
      <ResponsiveContainer width="100%" height={ALTEZZA_GRAFICO}>
        <PieChart>
          <Pie
            data={fetteValide}
            dataKey="valore"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="85%"
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
    </div>
  )
}

// Elenco a righe, colori identici (stessa funzione, stesso ordine) a quelli
// dell'anello. Due livelli per riga: il bordo appartiene a un contenitore a
// piena larghezza (arriva fino al bordo del box), mentre il contenuto vero
// e proprio (pallino, nome, euro, percentuale) sta in un blocco interno con
// larghezza massima propria — così resta compatto anche se il box è largo.
export function ElencoAllocazione({ fette }: { fette: FettaAnello[] }) {
  const { fetteValide, totale, colori } = ordinaEColora(fette)

  if (fetteValide.length === 0) {
    return null
  }

  return (
    <div>
      {fetteValide.map((f, i) => (
        <div
          key={f.nome}
          style={{
            borderBottom: i < fetteValide.length - 1 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          <div
            style={{
              maxWidth: 440,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>
              <span style={{ width: 9, height: 9, background: colori[i], display: 'inline-block', flexShrink: 0 }} />
              {f.nome}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>{formatEuro(f.valore)}</span>
              <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', minWidth: 44, textAlign: 'right' }}>
                {formatPercent((f.valore / totale) * 100, 2)}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}