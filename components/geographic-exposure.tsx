import { getLocale, getTranslations } from 'next-intl/server'
import { formatData, formatPercent, type LocaleFormato } from '@/lib/format'
import { nomePaese, type FonteGeografia, type GruppoRegione, type VocePaese } from '@/lib/geographic-exposure'
import { traduciRegione } from '@/lib/i18n-regions'

// Distribuzione geografica: macro-regioni con la loro barra e i paesi sotto. I paesi piccoli di ogni
// regione stanno in una voce "Altri paesi" che si apre con un clic. Presentazionale: i numeri arrivano
// già calcolati da lib/geographic-exposure.ts, così la stessa vista serve per una categoria del PAC
// (copertura valorizzata) e per un singolo asset (nessuna copertura).

export async function GeographicExposure({
  regioni,
  copertura,
  fonti,
}: {
  regioni: GruppoRegione[]
  /** % del valore della categoria su cui è calcolata; assente per un singolo asset. */
  copertura?: number
  fonti: FonteGeografia[]
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('EsposizioneGeografica')
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
        fontSize: 'var(--fs-card-link)',
        color: 'var(--text-secondary)',
        padding: '2px 0',
      }}
    >
      <span>{nomePaese(voce.codiceIso, voce.paese, locale)}</span>
      <span>{pct(voce.peso)}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {copertura != null && (
        <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
          {t('calcolataSu', { percentuale: formatPercent(copertura, copertura >= 99.95 ? 0 : 1, false, locale) })}
        </div>
      )}

      {regioni.map((gruppo) => (
        <div key={gruppo.regione}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-table)', marginBottom: 4 }}>
            <span>{traduciRegione(tRegioni, gruppo.regione)}</span>
            <span style={{ fontWeight: 500 }}>{pct(gruppo.peso)}</span>
          </div>
          <div style={{ position: 'relative', height: 10, background: 'var(--border-default)', borderRadius: 0 }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${Math.min(gruppo.peso, 100)}%`,
                background: 'var(--primary)',
                borderRadius: 0,
              }}
            />
          </div>

          <div style={{ marginTop: 6, marginLeft: 12 }}>
            {gruppo.paesi.map(rigaPaese)}
            {gruppo.altriPaesi.length > 0 && (
              <details style={{ marginTop: 2 }}>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', padding: '2px 0' }}>
                  {t('altriPaesi', {
                    n: gruppo.altriPaesi.length,
                    percentuale: pct(gruppo.altriPaesi.reduce((somma, v) => somma + v.peso, 0)),
                  })}
                </summary>
                <div style={{ marginLeft: 12 }}>{gruppo.altriPaesi.map(rigaPaese)}</div>
              </details>
            )}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-muted)' }}>{t('notaSoloTitoli')}</div>

      {fonti.length > 0 && (
        <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
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
  )
}
