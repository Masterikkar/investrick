import { formatEuroSigned, formatPercent } from '@/lib/format'
import { BarreSottocategoriaRendimento, type ContributoStrumento } from '@/components/barre-sottocategoria-rendimento'

export type ContributoCategoria = {
  categoria: string
  guadagno: number
  contributoPct: number | null
  larghezzaPct: number
}

export function AnalisiRendimento({
  contributoPerCategoria,
  contributoStrumentoPerCategoria,
  plusMinusNonRealizzata,
}: {
  contributoPerCategoria: ContributoCategoria[]
  contributoStrumentoPerCategoria: Record<string, ContributoStrumento[]>
  plusMinusNonRealizzata: number
}) {
  if (contributoPerCategoria.length === 0 || plusMinusNonRealizzata === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>Nessun guadagno o perdita maturata ancora.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {contributoPerCategoria.map((c) => {
        const positivo = c.guadagno >= 0
        const colore = positivo ? 'var(--success)' : 'var(--danger)'
        return (
          <div key={c.categoria}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-table)', marginBottom: 4 }}>
              <span>{c.categoria}</span>
              <span style={{ color: colore, fontWeight: 500 }}>
                {formatEuroSigned(c.guadagno)}
                {c.contributoPct != null && ` (${formatPercent(c.contributoPct, 1, true)})`}
              </span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'var(--border-default)', borderRadius: 0 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--text-muted)' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  background: colore,
                  borderRadius: 0,
                  ...(positivo
                    ? { left: '50%', width: `${c.larghezzaPct}%` }
                    : { right: '50%', width: `${c.larghezzaPct}%` }),
                }}
              />
            </div>
            <BarreSottocategoriaRendimento items={contributoStrumentoPerCategoria[c.categoria] ?? []} />
          </div>
        )
      })}
    </div>
  )
}