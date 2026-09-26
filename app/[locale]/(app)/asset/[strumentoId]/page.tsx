import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { formatData, formatEuro, formatEuroSigned, formatPercent, formatNumero, type LocaleFormato } from '@/lib/format'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { CapitaleInvestito } from '@/components/capitale-investito'
import { caricaRicompenseResidue, ricompensePosizione } from '@/lib/ricompense'
import { Sezione } from '@/components/sezione'
import { Breadcrumb } from '@/components/breadcrumb'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { CHIAVE_TRADUZIONE_OPERAZIONE } from '@/lib/i18n-tipi-operazione'

type Strumento = {
  id: string
  nome: string
  categoria: string
  ticker: string | null
  isin: string | null
  valuta: string
}

type Variazione = {
  data: string
  prezzo: number
  prezzo_precedente: number | null
  variazione_pct: number | null
}

type Riepilogo = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  prezzo_medio_unitario: number
  valore: number | null
  prezzo_attuale: number | null
  rendimento_pct: number | null
}

type Ricavi = {
  strumento_id: string
  contenitore_id: string | null
  quantita_venduta: number
  ricavo_totale: number
  plusvalenza_totale: number
  netto_dopo_tasse_stimato: number
}

type Transazione = {
  id: string
  data: string
  operazione: string
  contenitore_id: string | null
  quantita: number
  prezzo_unitario: number
  commissione: number
  tassa_trattenuta: number
}

type Contenitore = { id: string; nome: string; tipo: string }
type CostoPerStrumento = { contenitore_id: string | null; costo_totale: number }
type StoricoValorizzazione = {
  data: string | null
  valore_totale: number | null
  capitale_investito_totale: number | null
}

const ETICHETTE_OPERAZIONE: Record<string, string> = {
  Acquisto: 'Acquisto',
  Vendita: 'Vendita',
  Dividendo: 'Dividendo',
  Ricompensa: 'Ricompensa',
  Costo_quote: 'Costo (in quote)',
  Costo_contanti: 'Costo (in contanti)',
  Scambio_cessione: 'Scambio (cessione)',
  Scambio_acquisizione: 'Scambio (acquisizione)',
}

const chiaveContenitore = (id: string | null) => id ?? 'diretto'

export default async function AssetPage({
  params,
}: {
  params: Promise<{ strumentoId: string }>
}) {
  const { strumentoId } = await params
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaAsset')
  const tContenitori = await getTranslations('Contenitori')
  const tCategorie = await getTranslations('Categorie')
  const tTipiOperazione = await getTranslations('TipiOperazione')
  const tPaginaCategoria = await getTranslations('PaginaCategoria')
  const tPaginaFiscalita = await getTranslations('PaginaFiscalita')
  const tPaginaStorico = await getTranslations('PaginaStorico')
  const tPaginaRibilanciamento = await getTranslations('PaginaRibilanciamento')
  const tPaginaLiquidita = await getTranslations('PaginaLiquidita')
  const supabase = await createClient()

  const [
    { data: strumentoRaw },
    { data: variazioneRaw },
    { data: riepilogoRaw },
    { data: ricaviRaw },
    { data: transazioniRaw },
    { data: contenitoriRaw },
    { data: costoStrumentoRaw },
    { data: storicoRaw },
    ricompense,
  ] = await Promise.all([
    supabase.from('strumenti').select('id, nome, categoria, ticker, isin, valuta').eq('id', strumentoId).single(),
    supabase
      .from('v_variazione_giornaliera')
      .select('data, prezzo, prezzo_precedente, variazione_pct')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('v_riepilogo_posizione').select('*').eq('strumento_id', strumentoId).returns<Riepilogo[]>(),
    supabase.from('v_ricavi_da_vendite').select('*').eq('strumento_id', strumentoId).returns<Ricavi[]>(),
    supabase
      .from('transazioni')
      .select('id, data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: false })
      .returns<Transazione[]>(),
    supabase.from('contenitori').select('id, nome, tipo').returns<Contenitore[]>(),
    supabase.from('v_costo_per_strumento').select('contenitore_id, costo_totale').eq('strumento_id', strumentoId).returns<CostoPerStrumento[]>(),
    supabase
      .from('v_storico_valorizzazioni_per_strumento')
      .select('data, valore_totale, capitale_investito_totale')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: true })
      .returns<StoricoValorizzazione[]>(),
    caricaRicompenseResidue(supabase),
  ])

  const strumento = strumentoRaw as Strumento | null
  const variazione = variazioneRaw as Variazione | null

  if (!strumento) {
    return <div>{tPaginaLiquidita('strumentoNonTrovato')}</div>
  }

  // Un conto di liquidità ha la sua pagina di dettaglio: copre link diretti o salvati.
  if (strumento.categoria === 'Liquidita') {
    redirect({ href: `/liquidita/${strumento.id}`, locale })
  }

  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))
  const nomeContenitore = (id: string | null) => (id ? contenitoreMap.get(id) ?? '—' : '—')

  const riepilogo = riepilogoRaw ?? []
  const posizioniAttuali = riepilogo.filter((r) => Number(r.quantita_posseduta) > 0)
  const ricavi = ricaviRaw ?? []
  const transazioni = transazioniRaw ?? []

  const costoMap = new Map<string, number>()
  for (const c of costoStrumentoRaw ?? []) costoMap.set(chiaveContenitore(c.contenitore_id), Number(c.costo_totale))

  const storicoValoreMap = new Map<string, number>()
  const storicoCapitaleMap = new Map<string, number>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    storicoValoreMap.set(r.data, Number(r.valore_totale))
    if (r.capitale_investito_totale != null) {
      storicoCapitaleMap.set(r.data, Number(r.capitale_investito_totale))
    }
  }

  const puntiRendimento: PuntoStorico[] = Array.from(storicoValoreMap.entries())
    .map(([data, valore]) => {
      const capitale = storicoCapitaleMap.get(data)
      if (!capitale || capitale <= 0) return null
      return { data, valore: ((valore - capitale) / capitale) * 100 }
    })
    .filter((p): p is PuntoStorico => p !== null)
    .sort((a, b) => a.data.localeCompare(b.data))

  // Peso di ogni posizione sul totale della categoria dello strumento, lo
  // stesso denominatore della sua pagina categoria (non il contenitore, non
  // l'intero portafoglio).
  const { data: valoreCategoriaRaw } = await supabase
    .from('v_valore_per_categoria')
    .select('valore_totale')
    .eq('categoria', strumento.categoria)
    .maybeSingle()
  const totaleCategoria = Number(valoreCategoriaRaw?.valore_totale ?? 0)

  const quantitaTotale = posizioniAttuali.reduce((s, r) => s + Number(r.quantita_posseduta), 0)
  const capitaleInvestitoTotale = posizioniAttuali.reduce((s, r) => s + Number(r.capitale_investito), 0)
  const ricompenseTotale = posizioniAttuali.reduce((s, r) => s + ricompensePosizione(ricompense, strumentoId, r.contenitore_id), 0)
  const valoreTotale = posizioniAttuali.reduce((s, r) => s + (r.valore != null ? Number(r.valore) : 0), 0)
  const prezzoMedioPonderato = quantitaTotale > 0 ? capitaleInvestitoTotale / quantitaTotale : null
  const rendimentoTotalePct =
    capitaleInvestitoTotale > 0 ? ((valoreTotale - capitaleInvestitoTotale) / capitaleInvestitoTotale) * 100 : null

  const polizzeIds = new Set((contenitoriRaw ?? []).filter((c) => c.tipo === 'Polizza').map((c) => c.id))
  const inPolizza = (contenitoreId: string | null) => contenitoreId !== null && polizzeIds.has(contenitoreId)
  const ricaviSoloInPolizza = ricavi.length > 0 && ricavi.every((r) => inPolizza(r.contenitore_id))
  const ricaviAncheInPolizza = ricavi.some((r) => inPolizza(r.contenitore_id))

  const ricaviTotali = {
    quantita: ricavi.reduce((s, r) => s + Number(r.quantita_venduta), 0),
    ricavo: ricavi.reduce((s, r) => s + Number(r.ricavo_totale), 0),
    plusvalenza: ricavi.reduce((s, r) => s + Number(r.plusvalenza_totale), 0),
    // Le vendite dentro una polizza non si tassano per fondo ma al riscatto del
    // contratto: il netto stimato conta solo le vendite fuori polizza.
    netto: ricavi.filter((r) => !inPolizza(r.contenitore_id)).reduce((s, r) => s + Number(r.netto_dopo_tasse_stimato), 0),
  }

  return (
    <div>
      <Breadcrumb />

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>{t('eyebrowAsset')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 4, fontWeight: 500 }}>{strumento.nome}</h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        {traduciCategoria(tCategorie, strumento.categoria)}
        {strumento.isin ? ` · ${strumento.isin}` : ''}
        {strumento.ticker ? ` · ${strumento.ticker}` : ''}
        {` · ${strumento.valuta}`}
      </p>

      {/* Etichette dei contenitori che contengono lo strumento; nessuna per le posizioni senza contenitore. */}
      {posizioniAttuali.some((r) => r.contenitore_id !== null) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {posizioniAttuali.filter((r) => r.contenitore_id !== null).map((r) => (
            <span
              key={chiaveContenitore(r.contenitore_id)}
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', padding: '2px 10px', fontSize: 13 }}
            >
              {nomeContenitore(r.contenitore_id)}
            </span>
          ))}
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotale} />
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label={t('labelRendimento')}>
              <span style={{ color: (rendimentoTotalePct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {rendimentoTotalePct != null ? formatPercent(rendimentoTotalePct, 2, true, locale) : '—'}
              </span>
            </CardMetrica>

            <CardMetrica
              label={
                variazione
                  ? t('labelNavConData', {
                      data: formatData(variazione.data, locale, { day: '2-digit', month: '2-digit' }),
                    })
                  : tPaginaCategoria('colonnaNav')
              }
            >
              {variazione ? formatEuro(Number(variazione.prezzo), locale) : '—'}
              {variazione?.variazione_pct != null && (
                <span
                  style={{
                    fontSize: 14,
                    marginLeft: 6,
                    color: Number(variazione.variazione_pct) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {formatPercent(Number(variazione.variazione_pct), 2, true, locale)}
                </span>
              )}
            </CardMetrica>

            <CardMetrica label={t('labelPrezzoMedioUnitario')}>
              {prezzoMedioPonderato != null ? formatEuro(prezzoMedioPonderato, locale) : '—'}
            </CardMetrica>

            <CardMetrica label={t('capitaleInvestito')}>
              <CapitaleInvestito capitale={capitaleInvestitoTotale} ricompense={ricompenseTotale} />
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      {posizioniAttuali.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloPosizioniPerContenitore')}</h2>
          <Sezione>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaGruppo')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaPeso')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaRendimento')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaRendimentoEuro')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaValore')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('capitaleInvestito')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaCosto')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaNav')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCategoria('colonnaPrezzoMedio')}</th>
                </tr>
              </thead>
              <tbody>
                {posizioniAttuali.map((r) => {
                  const chiave = chiaveContenitore(r.contenitore_id)
                  const peso = r.valore != null && totaleCategoria > 0 ? (Number(r.valore) / totaleCategoria) * 100 : null
                  const rendimentoEuro = r.valore != null ? Number(r.valore) - Number(r.capitale_investito) : null
                  const costo = costoMap.get(chiave) ?? 0

                  return (
                    <tr key={chiave} className="tabella-riga">
                      <td style={{ padding: 8 }}>{nomeContenitore(r.contenitore_id)}</td>
                      <td style={{ padding: 8 }}>{peso != null ? formatPercent(peso, 2, false, locale) : '—'}</td>
                      <td style={{ padding: 8 }}>{formatNumero(Number(r.quantita_posseduta), 6, false, locale)}</td>
                      <td style={{ padding: 8 }}>
                        {r.rendimento_pct != null ? formatPercent(Number(r.rendimento_pct), 2, true, locale) : '—'}
                      </td>
                      <td style={{ padding: 8, color: rendimentoEuro != null && rendimentoEuro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {rendimentoEuro != null ? formatEuroSigned(rendimentoEuro, locale) : '—'}
                      </td>
                      <td style={{ padding: 8 }}>{r.valore != null ? formatEuro(Number(r.valore), locale) : '—'}</td>
                      <td style={{ padding: 8 }}>
                        <CapitaleInvestito
                          capitale={Number(r.capitale_investito)}
                          ricompense={ricompensePosizione(ricompense, strumentoId, r.contenitore_id)}
                          compatto
                        />
                      </td>
                      <td style={{ padding: 8 }}>{formatEuro(costo, locale)}</td>
                      <td style={{ padding: 8 }}>{r.prezzo_attuale != null ? formatEuro(Number(r.prezzo_attuale), locale) : '—'}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(r.prezzo_medio_unitario), locale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Sezione>
        </section>
      )}

      {ricavi.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloRicaviDaVendite')}</h2>
          <Sezione>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <CardMetrica label={t('labelQuantitaVenduta')}>{formatNumero(ricaviTotali.quantita, 6, false, locale)}</CardMetrica>
              <CardMetrica label={t('labelRicavoTotale')}>{formatEuro(ricaviTotali.ricavo, locale)}</CardMetrica>
              <CardMetrica label={t('labelPlusvalenza')}>
                <span style={{ color: ricaviTotali.plusvalenza >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatEuroSigned(ricaviTotali.plusvalenza, locale)}
                </span>
              </CardMetrica>
              <CardMetrica label={t('labelNettoDopoTasse')}>
                {ricaviSoloInPolizza ? (
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                    {t('notaTassatoAlRiscatto')}
                  </span>
                ) : (
                  <>
                    {formatEuro(ricaviTotali.netto, locale)}
                    {ricaviAncheInPolizza && (
                      <div style={{ fontSize: 'var(--fs-card-link)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {t('notaNettoSoloFuoriPolizza')}
                      </div>
                    )}
                  </>
                )}
              </CardMetrica>
            </div>

            {ricavi.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaGruppo')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaRicavo')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('labelPlusvalenza')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaRibilanciamento('colonnaNetto')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ricavi.map((r) => (
                      <tr key={chiaveContenitore(r.contenitore_id)} className="tabella-riga">
                        <td style={{ padding: 8 }}>{nomeContenitore(r.contenitore_id)}</td>
                        <td style={{ padding: 8 }}>{formatNumero(Number(r.quantita_venduta), 6, false, locale)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(Number(r.ricavo_totale), locale)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(Number(r.plusvalenza_totale), locale)}</td>
                        <td style={{ padding: 8, color: inPolizza(r.contenitore_id) ? 'var(--text-secondary)' : undefined }}>
                          {inPolizza(r.contenitore_id)
                            ? t('notaTassatoAlRiscatto')
                            : formatEuro(Number(r.netto_dopo_tasse_stimato), locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Sezione>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloStoricoTransazioni')}</h2>
        <Sezione>
          {transazioni.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunaTransazione')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaData')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaOperazione')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaGruppo')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaPrezzoUnitario')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaCommissione')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaTassaTrattenuta')}</th>
                </tr>
              </thead>
              <tbody>
                {transazioni.map((riga) => {
                  const etichettaItaliana = ETICHETTE_OPERAZIONE[riga.operazione] ?? riga.operazione
                  const chiaveOperazione = CHIAVE_TRADUZIONE_OPERAZIONE[etichettaItaliana]
                  return (
                    <tr key={riga.id} className="tabella-riga">
                      <td style={{ padding: 8 }}>{formatData(riga.data, locale)}</td>
                      <td style={{ padding: 8 }}>{chiaveOperazione ? tTipiOperazione(chiaveOperazione) : etichettaItaliana}</td>
                      <td style={{ padding: 8 }}>{nomeContenitore(riga.contenitore_id)}</td>
                      <td style={{ padding: 8 }}>{formatNumero(Number(riga.quantita), 6, false, locale)}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(riga.prezzo_unitario), locale)}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(riga.commissione), locale)}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(riga.tassa_trattenuta), locale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Sezione>
      </section>
    </div>
  )
}