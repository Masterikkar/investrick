import { useLocale } from 'next-intl'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'

export type VoceBarra = { etichetta: string; valore: number }

const LARGHEZZA_MINIMA_VISIBILE = 4

// 'divergente' (default): valori con segno, barre verdi a destra dello zero e
// rosse a sinistra (plus/minusvalenze). 'positivo': solo valori >= 0 (es. i
// costi), barre dal bordo sinistro, colore neutro, senza segno.
export function BarreDivergenti({
  voci,
  variante = 'divergente',
}: {
  voci: VoceBarra[]
  variante?: 'divergente' | 'positivo'
}) {
  const locale = useLocale() as LocaleFormato
  const maxAssoluto = Math.max(...voci.map((v) => Math.abs(v.valore)), 1)
  const soloPositivo = variante === 'positivo'

  return (
    <div style={{ maxWidth: 560 }}>
      {voci.map((v) => {
        const positivo = v.valore >= 0
        const percentuale = (Math.abs(v.valore) / maxAssoluto) * (soloPositivo ? 100 : 50)
        const colore = soloPositivo ? 'var(--primary)' : positivo ? 'var(--success)' : 'var(--danger)'
        const coloreTesto = soloPositivo ? 'var(--text-primary)' : colore

        return (
          <div key={v.etichetta} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{ width: 90, fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', flexShrink: 0 }}>
              {v.etichetta}
            </div>
            <div style={{ flex: 1, minWidth: 60, position: 'relative', height: 14, background: 'var(--bg-surface)' }}>
              {!soloPositivo && (
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
              )}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: v.valore === 0 ? 0 : `${percentuale}%`,
                  minWidth: v.valore === 0 ? 0 : LARGHEZZA_MINIMA_VISIBILE,
                  background: colore,
                  ...(soloPositivo ? { left: 0 } : positivo ? { left: '50%' } : { right: '50%' }),
                }}
              />
            </div>
            <div style={{ width: 90, textAlign: 'right', fontSize: 'var(--fs-card-link)', color: coloreTesto, flexShrink: 0 }}>
              {soloPositivo ? formatEuro(v.valore, locale) : formatEuroSigned(v.valore, locale)}
            </div>
          </div>
        )
      })}
    </div>
  )
}