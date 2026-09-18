import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, formatPercent, formatNumero } from '@/lib/format'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { Sezione } from '@/components/sezione'
import { Breadcrumb } from '@/components/breadcrumb'

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

type Contenitore = { id: string; nome: string }
type ValorePerContenitore = { contenitore_id: string; valore_totale: number }
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
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
    supabase.from('v_costo_per_strumento').select('contenitore_id, costo_totale').eq('strumento_id', strumentoId).returns<CostoPerStrumento[]>(),
    supabase
      .from('v_storico_valorizzazioni_per_strumento')
      .select('data, valore_totale, capitale_investito_totale')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: true })
      .returns<StoricoValorizzazione[]>(),
  ])

  const strumento = strumentoRaw as Strumento | null
  const variazione = variazioneRaw as Variazione | null

  if (!strumento) {
    return <div>Strumento non trovato.</div>
  }

  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))
  const nomeContenitore = (id: string | null) => (id ? contenitoreMap.get(id) ?? '—' : 'Diretto')

  const riepilogo = riepilogoRaw ?? []
  const posizioniAttuali = riepilogo.filter((r) => Number(r.quantita_posseduta) > 0)
  const ricavi = ricaviRaw ?? []
  const transazioni = transazioniRaw ?? []

  const costoMap = new Map<string, number>()
  for (const c of costoStrumentoRaw ?? []) costoMap.set(chiaveContenitore(c.contenitore_id), Number(c.costo_totale))

  // --- Storico rendimento % per il grafico ---
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

  // --- Totale valore per contenitore (denominatore del Peso) ---
  const idsContenitoriReali = [...new Set(posizioniAttuali.map((r) => r.contenitore_id).filter((id): id is string => id !== null))]
  const haDiretto = posizioniAttuali.some((r) => r.contenitore_id === null)

  const totaleContenitoreMap = new Map<string, number>()

  if (idsContenitoriReali.length > 0) {
    const { data: valorePerContenitoreRaw } = await supabase
      .from('v_valore_per_contenitore')
      .select('contenitore_id, valore_totale')
      .in('contenitore_id', idsContenitoriReali)
      .returns<ValorePerContenitore[]>()

    for (const v of valorePerContenitoreRaw ?? []) totaleContenitoreMap.set(v.contenitore_id, Number(v.valore_totale))
  }

  if (haDiretto) {
    const [{ data: mercatoDirettoRaw }, { data: liquiditaDirettaRaw }] = await Promise.all([
      supabase.from('v_valore_posizioni_attuale').select('valore_attuale').is('contenitore_id', null),
      supabase.from('v_saldo_liquidita').select('saldo_corrente').is('contenitore_id', null),
    ])
    const totaleMercatoDiretto = (mercatoDirettoRaw ?? []).reduce((s, r) => s + Number(r.valore_attuale), 0)
    const totaleLiquiditaDiretta = (liquiditaDirettaRaw ?? []).reduce((s, r) => s + Number(r.saldo_corrente), 0)
    totaleContenitoreMap.set('diretto', totaleMercatoDiretto + totaleLiquiditaDiretta)
  }

  // --- Aggregati su tutti i contenitori, solo posizioni ancora aperte ---
  const quantitaTotale = posizioniAttuali.reduce((s, r) => s + Number(r.quantita_posseduta), 0)
  const capitaleInvestitoTotale = posizioniAttuali.reduce((s, r) => s + Number(r.capitale_investito), 0)
  const valoreTotale = posizioniAttuali.reduce((s, r) => s + (r.valore != null ? Number(r.valore) : 0), 0)
  const prezzoMedioPonderato = quantitaTotale > 0 ? capitaleInvestitoTotale / quantitaTotale : null
  const rendimentoTotalePct =
    capitaleInvestitoTotale > 0 ? ((valoreTotale - capitaleInvestitoTotale) / capitaleInvestitoTotale) * 100 : null

  const ricaviTotali = {
    quantita: ricavi.reduce((s, r) => s + Number(r.quantita_venduta), 0),
    ricavo: ricavi.reduce((s, r) => s + Number(r.ricavo_totale), 0),
    plusvalenza: ricavi.reduce((s, r) => s + Number(r.plusvalenza_totale), 0),
    netto: ricavi.reduce((s, r) => s + Number(r.netto_dopo_tasse_stimato), 0),
  }

  return (
    <div>
      <Breadcrumb />

      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Asset</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 4, fontWeight: 500 }}>{strumento.nome}</h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        {strumento.categoria}
        {strumento.isin ? ` · ${strumento.isin}` : ''}
        {strumento.ticker ? ` · ${strumento.ticker}` : ''}
        {` · ${strumento.valuta}`}
      </p>

      {posizioniAttuali.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {posizioniAttuali.map((r) => (
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
            <CardMetrica label="Rendimento">
              <span style={{ color: (rendimentoTotalePct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {rendimentoTotalePct != null ? formatPercent(rendimentoTotalePct, 2, true) : '—'}
              </span>
            </CardMetrica>

            <CardMetrica
              label={`NAV${
                variazione
                  ? ` (${new Date(variazione.data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })})`
                  : ''
              }`}
            >
              {variazione ? formatEuro(Number(variazione.prezzo)) : '—'}
              {variazione?.variazione_pct != null && (
                <span
                  style={{
                    fontSize: 14,
                    marginLeft: 6,
                    color: Number(variazione.variazione_pct) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {formatPercent(Number(variazione.variazione_pct), 2, true)}
                </span>
              )}
            </CardMetrica>

            <CardMetrica label="Prezzo medio unitario">
              {prezzoMedioPonderato != null ? formatEuro(prezzoMedioPonderato) : '—'}
            </CardMetrica>

            <CardMetrica label="Capitale investito">{formatEuro(capitaleInvestitoTotale)}</CardMetrica>
          </div>
        </Sezione>
      </section>

      {posizioniAttuali.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Posizioni per contenitore</h2>
          <Sezione>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Provenienza</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Peso</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Quantità</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Rendimento</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Rendimento (€)</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Valore</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Capitale investito</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Costo</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>NAV</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Prezzo medio</th>
                </tr>
              </thead>
              <tbody>
                {posizioniAttuali.map((r) => {
                  const chiave = chiaveContenitore(r.contenitore_id)
                  const totaleContenitore = totaleContenitoreMap.get(chiave) ?? 0
                  const peso = r.valore != null && totaleContenitore > 0 ? (Number(r.valore) / totaleContenitore) * 100 : null
                  const rendimentoEuro = r.valore != null ? Number(r.valore) - Number(r.capitale_investito) : null
                  const costo = costoMap.get(chiave) ?? 0

                  return (
                    <tr key={chiave} className="tabella-riga">
                      <td style={{ padding: 8 }}>{nomeContenitore(r.contenitore_id)}</td>
                      <td style={{ padding: 8 }}>{peso != null ? formatPercent(peso, 2) : '—'}</td>
                      <td style={{ padding: 8 }}>{formatNumero(Number(r.quantita_posseduta), 6)}</td>
                      <td style={{ padding: 8 }}>
                        {r.rendimento_pct != null ? formatPercent(Number(r.rendimento_pct), 2, true) : '—'}
                      </td>
                      <td style={{ padding: 8, color: rendimentoEuro != null && rendimentoEuro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {rendimentoEuro != null ? formatEuroSigned(rendimentoEuro) : '—'}
                      </td>
                      <td style={{ padding: 8 }}>{r.valore != null ? formatEuro(Number(r.valore)) : '—'}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(r.capitale_investito))}</td>
                      <td style={{ padding: 8 }}>{formatEuro(costo)}</td>
                      <td style={{ padding: 8 }}>{r.prezzo_attuale != null ? formatEuro(Number(r.prezzo_attuale)) : '—'}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(r.prezzo_medio_unitario))}</td>
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
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Ricavi da vendite</h2>
          <Sezione>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <CardMetrica label="Quantità venduta">{formatNumero(ricaviTotali.quantita, 6)}</CardMetrica>
              <CardMetrica label="Ricavo totale">{formatEuro(ricaviTotali.ricavo)}</CardMetrica>
              <CardMetrica label="Plusvalenza">
                <span style={{ color: ricaviTotali.plusvalenza >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatEuroSigned(ricaviTotali.plusvalenza)}
                </span>
              </CardMetrica>
              <CardMetrica label="Netto dopo tasse">{formatEuro(ricaviTotali.netto)}</CardMetrica>
            </div>

            {ricavi.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Contenitore</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Quantità</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Ricavo</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Plusvalenza</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ricavi.map((r) => (
                      <tr key={chiaveContenitore(r.contenitore_id)} className="tabella-riga">
                        <td style={{ padding: 8 }}>{nomeContenitore(r.contenitore_id)}</td>
                        <td style={{ padding: 8 }}>{formatNumero(Number(r.quantita_venduta), 6)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(Number(r.ricavo_totale))}</td>
                        <td style={{ padding: 8 }}>{formatEuro(Number(r.plusvalenza_totale))}</td>
                        <td style={{ padding: 8 }}>{formatEuro(Number(r.netto_dopo_tasse_stimato))}</td>
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
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Storico transazioni</h2>
        <Sezione>
          {transazioni.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nessuna transazione registrata per questo strumento.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Data</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Operazione</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Contenitore</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Quantità</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Prezzo unitario</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Commissione</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa trattenuta</th>
                </tr>
              </thead>
              <tbody>
                {transazioni.map((t) => (
                  <tr key={t.id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{new Date(t.data).toLocaleDateString('it-IT')}</td>
                    <td style={{ padding: 8 }}>{ETICHETTE_OPERAZIONE[t.operazione] ?? t.operazione}</td>
                    <td style={{ padding: 8 }}>{nomeContenitore(t.contenitore_id)}</td>
                    <td style={{ padding: 8 }}>{formatNumero(Number(t.quantita), 6)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(t.prezzo_unitario))}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(t.commissione))}</td>
                    <td style={{ padding: 8 }}>{formatEuro(Number(t.tassa_trattenuta))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sezione>
      </section>
    </div>
  )
}