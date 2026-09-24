import { getLocale, getTranslations } from 'next-intl/server'
import { formatEuroSigned, formatPercent, type LocaleFormato } from '@/lib/format'
import { CHIAVE_TRADUZIONE_CATEGORIA } from '@/lib/i18n-categorie'
import { BarreSottocategoriaRendimento, type ContributoStrumento } from '@/components/barre-sottocategoria-rendimento'

export type ContributoCategoria = {
  categoria: string
  guadagno: number
  contributoPct: number | null
  larghezzaPct: number
}

export async function AnalisiRendimento({
  contributoPerCategoria,
  contributoStrumentoPerCategoria,
  plusMinusNonRealizzata,
}: {
  contributoPerCategoria: ContributoCategoria[]
  contributoStrumentoPerCategoria: Record<string, ContributoStrumento[]>
  plusMinusNonRealizzata: number
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaContenitore')
  const tCategorie = await getTranslations('Categorie')

  if (contributoPerCategoria.length === 0 || plusMinusNonRealizzata === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>{t('alertNessunGuadagnoPerdita')}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {contributoPerCategoria.map((c) => {
        const positivo = c.guadagno >= 0
        const colore = positivo ? 'var(--success)' : 'var(--danger)'
        return (
          <div key={c.categoria}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-table)', marginBottom: 4 }}>
              <span>{tCategorie(CHIAVE_TRADUZIONE_CATEGORIA[c.categoria] ?? c.categoria)}</span>
              <span style={{ color: colore, fontWeight: 500 }}>
                {formatEuroSigned(c.guadagno, locale)}
                {c.contributoPct != null && ` (${formatPercent(c.contributoPct, 1, true, locale)})`}
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