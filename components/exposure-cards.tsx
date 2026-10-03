import { getLocale, getTranslations } from 'next-intl/server'
import { formatData, type LocaleFormato } from '@/lib/format'
import type { ElencoPartecipazioni, FonteGeografia, RiepilogoGeografico } from '@/lib/geographic-exposure'
import { GeographicExposure } from '@/components/geographic-exposure'
import { EtfHoldings } from '@/components/etf-holdings'
import { Sezione } from '@/components/sezione'

// Le due card della sezione "Esposizione", affiancate quando c'è spazio: "Partecipazioni" a sinistra ed
// "Esposizione geografica" a destra. Sotto, la nota sui pesi e le date dei dati. Una coppia per categoria nella
// pagina del PAC, una sola nella pagina di un asset. Se non ci sono partecipazioni salvate resta la sola card geografica.

export async function ExposureCards({
  geografia,
  partecipazioni,
  copertura,
  fonti,
}: {
  geografia: RiepilogoGeografico
  partecipazioni: ElencoPartecipazioni | null
  /** % del valore della categoria su cui è calcolata la geografia; assente per un singolo asset. */
  copertura?: number
  fonti: FonteGeografia[]
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('Esposizione')

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {partecipazioni && (
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <Sezione>
              <EtfHoldings partecipazioni={partecipazioni} />
            </Sezione>
          </div>
        )}
        <div style={{ flex: '1 1 420px', minWidth: 0, maxWidth: partecipazioni ? undefined : 560 }}>
          <Sezione>
            <GeographicExposure geografia={geografia} copertura={copertura} />
          </Sezione>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-card-link)' }}>
        <div style={{ color: 'var(--text-muted)' }}>{t('notaSoloTitoli')}</div>
        {fonti.length > 0 && (
          <div style={{ color: 'var(--text-secondary)' }}>
            <span style={{ marginRight: 8 }}>{t('aggiornamento')}:</span>
            {fonti.map((fonte, i) => (
              <span key={i} style={{ marginRight: 12, color: fonte.scaduto ? 'var(--warning)' : undefined }}>
                {fonte.etichetta ? `${fonte.etichetta} ` : ''}
                {fonte.dataAggiornamento ? formatData(fonte.dataAggiornamento, locale) : '—'}
                {fonte.scaduto ? ` (${t('datoScaduto')})` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
