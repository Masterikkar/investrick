'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, type LocaleFormato } from '@/lib/format'

// Capitale investito di una posizione o di un aggregato. Se una parte viene da
// ricompense (lib/ricompense.ts), sotto il numero compaiono "di cui da
// ricompense" e, in evidenza, il capitale proprio investito (capitale − R).
// Sotto il mezzo centesimo le ricompense non si mostrano: sarebbero 0,00 €.
export function CapitaleInvestito({
  capitale,
  ricompense,
  compatto = false,
}: {
  capitale: number
  ricompense: number
  // Dentro una cella di tabella: righe secondarie più piccole e più strette.
  compatto?: boolean
}) {
  const t = useTranslations('CapitaleInvestito')
  const locale = useLocale() as LocaleFormato
  const conRicompense = ricompense >= 0.005
  const fontSecondario = compatto ? 12 : 'var(--fs-card-label)'

  return (
    <>
      {formatEuro(capitale, locale)}
      {conRicompense && (
        <>
          <div style={{ fontSize: fontSecondario, fontWeight: 400, color: 'var(--text-secondary)', marginTop: compatto ? 2 : 6 }}>
            {t('daRicompense', { valore: formatEuro(ricompense, locale) })}
          </div>
          <div style={{ fontSize: fontSecondario, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            {t('capitaleProprio', { valore: formatEuro(capitale - ricompense, locale) })}
          </div>
        </>
      )}
    </>
  )
}
