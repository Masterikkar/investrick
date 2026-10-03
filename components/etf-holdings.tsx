import { getLocale, getTranslations } from 'next-intl/server'
import { formatData, formatPercent, type LocaleFormato } from '@/lib/format'
import {
  chiavePartecipazione,
  nomeTitoloLeggibile,
  type ElencoPartecipazioni,
  type Partecipazione,
} from '@/lib/geographic-exposure'

// Card "Partecipazioni": le prime 5 posizioni con peso e barra (come le regioni nella card geografica), poi le altre
// in un elenco semplice.
// Presentazionale: l'elenco arriva già calcolato da lib/geographic-exposure.ts (per il PAC, somma pesata sul
// valore degli ETF). Va dentro una <Sezione>, vedi components/exposure-cards.tsx.

// Il dettaglio accanto al nome aiuta a riconoscere il titolo: cedola e scadenza per le obbligazioni iShares,
// l'ISIN per quelle Xtrackers, il ticker per le azioni.
function dettaglioPartecipazione(p: Partecipazione, locale: LocaleFormato): string | null {
  if (p.cedolaPct !== null || p.scadenza !== null) {
    const parti: string[] = []
    if (p.cedolaPct !== null) parti.push(formatPercent(p.cedolaPct, 2, false, locale))
    if (p.scadenza !== null) parti.push(formatData(p.scadenza, locale))
    return parti.join(' · ')
  }
  return p.isinTitolo ?? p.ticker
}

// Solo le prime partecipazioni hanno la barra; le altre stanno in un elenco semplice.
const PARTECIPAZIONI_CON_BARRA = 5

export async function EtfHoldings({ partecipazioni }: { partecipazioni: ElencoPartecipazioni }) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('Esposizione')

  // Le barre sono in scala sulla partecipazione più pesante (pesi di pochi punti percentuali su una scala
  // 0-100 sarebbero quasi invisibili): la prima occupa tutta la larghezza.
  const massimo = Math.max(...partecipazioni.voci.map((v) => v.peso))
  const conBarra = partecipazioni.voci.slice(0, PARTECIPAZIONI_CON_BARRA)
  const senzaBarra = partecipazioni.voci.slice(PARTECIPAZIONI_CON_BARRA)

  const intestazioneRiga = (voce: Partecipazione, posizione: number, evidenziata: boolean) => {
    const dettaglio = dettaglioPartecipazione(voce, locale)
    return (
      <div style={{ display: 'flex', gap: 10, fontSize: 'var(--fs-table)' }}>
        <span style={{ width: 20, flexShrink: 0, textAlign: 'right', color: 'var(--text-muted)' }}>{posizione}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {nomeTitoloLeggibile(voce.nome)}
          {dettaglio && (
            <span style={{ marginLeft: 8, fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>{dettaglio}</span>
          )}
        </span>
        <span style={{ flexShrink: 0, fontWeight: evidenziata ? 500 : undefined }}>
          {formatPercent(voce.peso, 2, false, locale)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, margin: '0 0 12px' }}>{t('titoloPartecipazioni')}</h3>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {conBarra.map((voce, i) => (
          <li key={chiavePartecipazione(voce)}>
            <div style={{ marginBottom: 4 }}>{intestazioneRiga(voce, i + 1, true)}</div>
            <div style={{ position: 'relative', height: 10, background: 'var(--border-default)', borderRadius: 0 }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${massimo > 0 ? Math.min((voce.peso / massimo) * 100, 100) : 0}%`,
                  background: 'var(--primary)',
                  borderRadius: 0,
                }}
              />
            </div>
          </li>
        ))}
      </ol>

      {senzaBarra.length > 0 && (
        <ol style={{ listStyle: 'none', margin: '16px 0 0', padding: '10px 0 0', borderTop: '1px solid var(--border-default)' }}>
          {senzaBarra.map((voce, i) => (
            <li key={chiavePartecipazione(voce)} style={{ padding: '3px 0' }}>
              {intestazioneRiga(voce, PARTECIPAZIONI_CON_BARRA + i + 1, false)}
            </li>
          ))}
        </ol>
      )}

      <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 14, paddingTop: 10, fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
        {t('primePartecipazioni', {
          n: partecipazioni.voci.length,
          percentuale: formatPercent(partecipazioni.pesoVoci, 1, false, locale),
        })}
      </div>
    </div>
  )
}
