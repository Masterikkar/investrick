import { getLocale, getTranslations } from 'next-intl/server'
import { formatPercent, formatNumero, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { BarreSottocategoria, type SottoTarget } from '@/components/barre-sottocategoria'

export type ScostamentoCategoria = {
  categoria: string | null
  peso_attuale_pct: number | null
  target_percentuale: number | null
  scostamento_pp: number | null
}

export async function AnalisiComposizione({
  composizione,
  sottoTargetPerCategoria,
  soglia,
  targetAttivo,
  messaggioTargetDisattivato,
  messaggioNessunTarget,
}: {
  composizione: ScostamentoCategoria[]
  sottoTargetPerCategoria: Record<string, SottoTarget[]>
  soglia: number
  targetAttivo: boolean
  messaggioTargetDisattivato?: string
  messaggioNessunTarget?: string
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaContenitore')
  const tCategorie = await getTranslations('Categorie')

  if (!targetAttivo) {
    return <p style={{ color: 'var(--text-secondary)' }}>{messaggioTargetDisattivato ?? t('alertTargetDisattivato')}</p>
  }
  if (composizione.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>{messaggioNessunTarget ?? t('alertNessunTarget')}</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-table)', marginBottom: 4 }}>
              <span>{traduciCategoria(tCategorie, c.categoria ?? '')}</span>
              <span>
                {t('barraComposizione', {
                  pesoAttuale: formatPercent(c.peso_attuale_pct ?? 0, 1, false, locale),
                  target: formatPercent(c.target_percentuale ?? 0, 1, false, locale),
                  scostamento: formatNumero(c.scostamento_pp ?? 0, 2, true, locale),
                })}
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