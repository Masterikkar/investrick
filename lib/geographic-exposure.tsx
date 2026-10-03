import { getLocale, getTranslations } from 'next-intl/server'
import { InfoTooltip } from '@/components/info-tooltip'
import { formatPercent, type LocaleFormato } from '@/lib/format'
import { nomePaese, type RiepilogoGeografico, type VocePaese } from '@/lib/geographic-exposure'
import { traduciRegione } from '@/lib/i18n-regions'

// Card "Esposizione geografica": in alto il peso per macro-regione, sotto i paesi più pesanti e, separato da una
// linea e in un blocco che si apre con un clic, tutti gli altri. Per il PAC, la base di calcolo (% del valore della
// categoria coperta dai dati) sta in un tooltip accanto al titolo. Presentazionale: i numeri arrivano già calcolati da
// lib/geographic-exposure.ts, così la stessa card serve per una categoria del PAC (copertura valorizzata)
// e per un singolo asset (nessuna copertura). Va dentro una <Sezione>, vedi components/exposure-cards.tsx.

export async function GeographicExposure({
  geografia,
  copertura,
}: {
  geografia: RiepilogoGeografico
  /** % del valore della categoria su cui è calcolata; assente per un singolo asset. */
  copertura?: number
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('Esposizione')
  const tRegioni = await getTranslations('Regioni')

  // Sotto 0,05% la cifra arrotondata sarebbe 0,0%: si scrive "<0,1%".
  const pct = (valore: number) =>
    valore > 0 && valore < 0.05 ? `<${formatPercent(0.1, 1, false, locale)}` : formatPercent(valore, 1, false, locale)

  const rigaPaese = (voce: VocePaese) => (
    <div
      key={voce.codiceIso ?? voce.paese}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 'var(--fs-table)',
        padding: '3px 0',
      }}
    >
      <span>{nomePaese(voce.codiceIso, voce.paese, locale)}</span>
      <span>{pct(voce.peso)}</span>
    </div>
  )

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, margin: '0 0 12px' }}>
        {t('titoloGeografia')}
        {copertura != null && (
          <InfoTooltip
            testo={t('calcolataSu', { percentuale: formatPercent(copertura, copertura >= 99.95 ? 0 : 1, false, locale) })}
          />
        )}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {geografia.regioni.map((voce) => (
          <div key={voce.regione}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-table)', marginBottom: 4 }}>
              <span>{traduciRegione(tRegioni, voce.regione)}</span>
              <span style={{ fontWeight: 500 }}>{pct(voce.peso)}</span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'var(--border-default)', borderRadius: 0 }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${Math.min(voce.peso, 100)}%`,
                  background: 'var(--primary)',
                  borderRadius: 0,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 16, paddingTop: 10 }}>
        {geografia.paesi.map(rigaPaese)}
      </div>

      {geografia.altriPaesi.length > 0 && (
        <details style={{ borderTop: '1px solid var(--border-default)', marginTop: 14, paddingTop: 7 }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-table)', color: 'var(--text-secondary)', padding: '3px 0' }}>
            <span>{t('altriPaesi')}</span>
            <span style={{ float: 'right' }}>{pct(geografia.altriPaesi.reduce((somma, v) => somma + v.peso, 0))}</span>
          </summary>
          <div style={{ color: 'var(--text-secondary)' }}>{geografia.altriPaesi.map(rigaPaese)}</div>
        </details>
      )}
    </div>
  )
}
