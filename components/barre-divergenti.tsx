import { formatEuroSigned } from '@/lib/format'

export type VoceBarra = { etichetta: string; valore: number }

const LARGHEZZA_MINIMA_VISIBILE = 4

export function BarreDivergenti({ voci }: { voci: VoceBarra[] }) {
  const maxAssoluto = Math.max(...voci.map((v) => Math.abs(v.valore)), 1)

  return (
    <div style={{ maxWidth: 560 }}>
      {voci.map((v) => {
        const positivo = v.valore >= 0
        const percentuale = (Math.abs(v.valore) / maxAssoluto) * 50
        const colore = positivo ? 'var(--success)' : 'var(--danger)'

        return (
          <div key={v.etichetta} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{ width: 90, fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', flexShrink: 0 }}>
              {v.etichetta}
            </div>
            <div style={{ flex: 1, minWidth: 60, position: 'relative', height: 14, background: 'var(--bg-surface)' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -3,
                  bottom: -3,
                  width: 1,
                  background: 'var(--border-default)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: v.valore === 0 ? 0 : `${percentuale}%`,
                  minWidth: v.valore === 0 ? 0 : LARGHEZZA_MINIMA_VISIBILE,
                  background: colore,
                  ...(positivo ? { left: '50%' } : { right: '50%' }),
                }}
              />
            </div>
            <div style={{ width: 90, textAlign: 'right', fontSize: 'var(--fs-card-link)', color: colore, flexShrink: 0 }}>
              {formatEuroSigned(v.valore)}
            </div>
          </div>
        )
      })}
    </div>
  )
}