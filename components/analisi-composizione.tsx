import { formatPercent, formatNumero } from '@/lib/format'
import { BarreSottocategoria, type SottoTarget } from '@/components/barre-sottocategoria'

export type ScostamentoCategoria = {
  categoria: string | null
  peso_attuale_pct: number | null
  target_percentuale: number | null
  scostamento_pp: number | null
}

export function AnalisiComposizione({
  composizione,
  sottoTargetPerCategoria,
  soglia,
  targetAttivo,
  messaggioTargetDisattivato = 'Target disattivato per questo contenitore.',
  messaggioNessunTarget = 'Nessun target impostato.',
}: {
  composizione: ScostamentoCategoria[]
  sottoTargetPerCategoria: Record<string, SottoTarget[]>
  soglia: number
  targetAttivo: boolean
  messaggioTargetDisattivato?: string
  messaggioNessunTarget?: string
}) {
  if (!targetAttivo) {
    return <p style={{ color: 'var(--text-secondary)' }}>{messaggioTargetDisattivato}</p>
  }
  if (composizione.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>{messaggioNessunTarget}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {composizione.map((c) => {
        const fuoriSoglia = Math.abs(c.scostamento_pp ?? 0) >= soglia
        const colore = fuoriSoglia ? 'var(--warning)' : 'var(--success)'
        const pesoAttuale = Math.min(c.peso_attuale_pct ?? 0, 100)
        const target = Math.min(c.target_percentuale ?? 0, 100)
        return (
          <div key={c.categoria}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>{c.categoria}</span>
              <span>
                {formatPercent(c.peso_attuale_pct ?? 0, 1)} attuale · {formatPercent(c.target_percentuale ?? 0, 1)} target (
                {formatNumero(c.scostamento_pp ?? 0, 2, true)} pp)
              </span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'var(--border-default)', borderRadius: 0 }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${pesoAttuale}%`,
                  background: colore,
                  borderRadius: 0,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -3,
                  left: `${target}%`,
                  width: 2,
                  height: 16,
                  background: 'var(--primary-vivid)',
                }}
              />
            </div>
            <BarreSottocategoria items={sottoTargetPerCategoria[c.categoria ?? ''] ?? []} soglia={soglia} />
          </div>
        )
      })}
    </div>
  )
}