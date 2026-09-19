import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, formatNumero, formatPercent } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { SogliaRibilanciamento } from '@/components/soglia-ribilanciamento'
import { FormSimulazione } from './form-simulazione'
import {
  calcolaRibilanciamentoConVersamento,
  distribuisciAcquisto,
  simulaVenditaStrumento,
  aliquotaPerStrumento,
  type CompartoTarget,
  type RigaAllocazione,
  type EsitoVenditaStrumento,
} from '@/lib/ribilanciamento'

type Scostamento = {
  target_id: string
  contenitore_id: string
  contenitore_nome: string
  contenitore_tipo: string
  categoria: string
  target_percentuale: number
  valore_categoria: number
  valore_contenitore_totale: number
  peso_attuale_pct: number
  scostamento_pp: number
}

type PosizioneVendibile = {
  strumento_id: string
  categoria: string
  valore_attuale: number
  prezzo_attuale: number
}

type StrumentoInfo = {
  id: string
  nome: string
  ticker: string | null
  titolo_di_stato: boolean
  percentuale_titoli_stato: number | null
}

type LottoRaw = {
  strumento_id: string
  quantita_residua: number
  prezzo_acquisto: number
  commissione_residua: number
}

type SubTargetRaw = {
  strumento_id: string
  target_percentuale_categoria: number
}

export default async function RibilanciamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    contenitore_id?: string
    versamento?: string
    forza?: string
    commissione_vendita?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: scostamenti } = await supabase
    .from('v_scostamento_target')
    .select('*')
    .returns<Scostamento[]>()

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const fuoriSoglia = (scostamenti ?? [])
    .filter((s) => Math.abs(s.scostamento_pp) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp) - Math.abs(a.scostamento_pp))

  const contenitoriMap = new Map<string, string>()
  for (const s of scostamenti ?? []) contenitoriMap.set(s.contenitore_id, s.contenitore_nome)
  const contenitoriDisponibili = Array.from(contenitoriMap.entries())

  const contenitoreSelezionato = params.contenitore_id
  const versamento = params.versamento ? Number(params.versamento) : 0
  const forzaVendita = params.forza === '1'
  const commissioneVenditaStimata = params.commissione_vendita ? Number(params.commissione_vendita) : 0

  let necessario: number | null = null
  let sufficiente = false
  let allocazioneAcquisto: RigaAllocazione[] = []
  let venditeProposte: EsitoVenditaStrumento[] = []
  let poolTotale = 0
  const allocazioneStrumenti: {
    categoria: string
    usaTarget: boolean
    strumenti: { nome: string; ticker: string | null; importo: number }[]
  }[] = []

  if (contenitoreSelezionato) {
    const comparti = (scostamenti ?? []).filter((s) => s.contenitore_id === contenitoreSelezionato)

    if (comparti.length > 0) {
      const contenitoreTipo = comparti[0].contenitore_tipo
      const valoreTotaleAttuale = comparti[0].valore_contenitore_totale

      const compartiInput: CompartoTarget[] = comparti.map((c) => ({
        categoria: c.categoria,
        valoreAttuale: c.valore_categoria,
        targetPct: c.target_percentuale / 100,
      }))

      const risultatoPuro = calcolaRibilanciamentoConVersamento(
        compartiInput,
        valoreTotaleAttuale,
        soglia,
        Math.max(versamento, valoreTotaleAttuale * 20, 1000)
      )
      necessario = risultatoPuro.budgetNecessario
      sufficiente = versamento >= necessario

      if (sufficiente) {
        allocazioneAcquisto = distribuisciAcquisto(compartiInput, valoreTotaleAttuale, versamento)
        poolTotale = versamento
      } else {
        const comportiSovrappesati = comparti.filter(
          (c) => c.valore_categoria > (c.target_percentuale / 100) * valoreTotaleAttuale
        )

        const idealeSellPerCategoria = new Map<string, number>()
        for (const c of comportiSovrappesati) {
          idealeSellPerCategoria.set(
            c.categoria,
            c.valore_categoria - (c.target_percentuale / 100) * valoreTotaleAttuale
          )
        }

        const vendutoPerCategoria = new Map<string, number>()

        if (comportiSovrappesati.length > 0) {
          const { data: posizioniRaw } = await supabase
            .from('v_valore_posizioni_attuale')
            .select('strumento_id, categoria, valore_attuale, prezzo_attuale')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('categoria', comportiSovrappesati.map((c) => c.categoria))
            .returns<PosizioneVendibile[]>()

          const posizioni = posizioniRaw ?? []
          const strumentoIds = posizioni.map((p) => p.strumento_id)

          const { data: strumentiInfo } = await supabase
            .from('strumenti')
            .select('id, nome, ticker, titolo_di_stato, percentuale_titoli_stato')
            .in('id', strumentoIds)
            .returns<StrumentoInfo[]>()

          const { data: lottiRaw } = await supabase
            .from('v_lotti_residui')
            .select('strumento_id, quantita_residua, prezzo_acquisto, commissione_residua, data_acquisto')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('strumento_id', strumentoIds)
            .order('data_acquisto', { ascending: true })
            .returns<LottoRaw[]>()

          const imponibile = contenitoreTipo !== 'Polizza'

          for (const c of comportiSovrappesati) {
            const idealeCategoria = idealeSellPerCategoria.get(c.categoria) ?? 0
            const posizioniCategoria = posizioni.filter((p) => p.categoria === c.categoria)
            const totaleCategoria = posizioniCategoria.reduce((sum, p) => sum + Number(p.valore_attuale), 0)
            if (totaleCategoria <= 0) continue

            let vendutoCategoria = 0

            for (const p of posizioniCategoria) {
              const info = strumentiInfo?.find((si) => si.id === p.strumento_id)
              if (!info) continue

              const idealeStrumento = idealeCategoria * (Number(p.valore_attuale) / totaleCategoria)
              const quantitaIdeale = idealeStrumento / Number(p.prezzo_attuale)
              if (quantitaIdeale <= 0) continue

              const lottiStrumento = (lottiRaw ?? [])
                .filter((l) => l.strumento_id === p.strumento_id)
                .map((l) => ({
                  quantitaResidua: Number(l.quantita_residua),
                  prezzoAcquisto: Number(l.prezzo_acquisto),
                  commissioneResidua: Number(l.commissione_residua),
                }))

              const aliquota = aliquotaPerStrumento({
                titoloDiStato: info.titolo_di_stato,
                percentualeTitoliStato: info.percentuale_titoli_stato,
              })

              const esito = simulaVenditaStrumento(
                p.strumento_id,
                info.nome,
                lottiStrumento,
                quantitaIdeale,
                Number(p.prezzo_attuale),
                commissioneVenditaStimata,
                imponibile,
                aliquota,
                forzaVendita
              )

              venditeProposte.push(esito)
              vendutoCategoria += esito.valoreVenduto
            }

            vendutoPerCategoria.set(c.categoria, vendutoCategoria)
          }
        }

        const proventoNettoTotale = venditeProposte.reduce((s, v) => s + v.proventoNetto, 0)
        poolTotale = versamento + proventoNettoTotale

        const compartiPostVendita: CompartoTarget[] = compartiInput.map((c) => ({
          categoria: c.categoria,
          valoreAttuale: c.valoreAttuale - (vendutoPerCategoria.get(c.categoria) ?? 0),
          targetPct: c.targetPct,
        }))
        const totaleAttualePostVendita =
          valoreTotaleAttuale - Array.from(vendutoPerCategoria.values()).reduce((a, b) => a + b, 0)

        allocazioneAcquisto = distribuisciAcquisto(compartiPostVendita, totaleAttualePostVendita, poolTotale)
      }

      for (const a of allocazioneAcquisto.filter((r) => r.importo > 0)) {
        const { data: posizioni } = await supabase
          .from('v_valore_posizioni_attuale')
          .select('strumento_id, valore_attuale')
          .eq('contenitore_id', contenitoreSelezionato)
          .eq('categoria', a.categoria)
          .returns<{ strumento_id: string; valore_attuale: number }[]>()

        const righe = posizioni ?? []
        const totaleCategoria = righe.reduce((sum, r) => sum + Number(r.valore_attuale), 0)

        if (totaleCategoria > 0) {
          const { data: strumentiInfo } = await supabase
            .from('strumenti')
            .select('id, nome, ticker')
            .in('id', righe.map((r) => r.strumento_id))

          const { data: subTargetRaw } = await supabase
            .from('target_allocazioni_strumento')
            .select('strumento_id, target_percentuale_categoria')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('strumento_id', righe.map((r) => r.strumento_id))
            .returns<SubTargetRaw[]>()

          const subTargetMap = new Map(
            (subTargetRaw ?? []).map((t) => [t.strumento_id, Number(t.target_percentuale_categoria)])
          )
          const sommaSubTarget = righe.reduce((sum, r) => sum + (subTargetMap.get(r.strumento_id) ?? 0), 0)
          const subTargetValidi =
            righe.length > 1 &&
            righe.every((r) => subTargetMap.has(r.strumento_id)) &&
            Math.abs(sommaSubTarget - 100) < 0.01

          let importiPerStrumento: Map<string, number>

          if (subTargetValidi) {
            const compartiStrumento: CompartoTarget[] = righe.map((r) => ({
              categoria: r.strumento_id,
              valoreAttuale: Number(r.valore_attuale),
              targetPct: (subTargetMap.get(r.strumento_id) ?? 0) / 100,
            }))
            const allocazione = distribuisciAcquisto(compartiStrumento, totaleCategoria, a.importo)
            importiPerStrumento = new Map(allocazione.map((al) => [al.categoria, al.importo]))
          } else {
            importiPerStrumento = new Map(
              righe.map((r) => [
                r.strumento_id,
                Math.round((Number(r.valore_attuale) / totaleCategoria) * a.importo * 100) / 100,
              ])
            )
          }

          allocazioneStrumenti.push({
            categoria: a.categoria,
            usaTarget: subTargetValidi,
            strumenti: righe.map((r) => {
              const info = strumentiInfo?.find((si) => si.id === r.strumento_id)
              return {
                nome: info?.nome ?? '—',
                ticker: info?.ticker ?? null,
                importo: importiPerStrumento.get(r.strumento_id) ?? 0,
              }
            }),
          })
        } else {
          allocazioneStrumenti.push({ categoria: a.categoria, usaTarget: false, strumenti: [] })
        }
      }
    }
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>Analisi</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>Ribilanciamento</h1>
      <SogliaRibilanciamento sogliaIniziale={soglia} />

      {fuoriSoglia.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', marginTop: 16, color: 'var(--text-secondary)' }}>
          Tutto in linea con i target. Nessuno scostamento fuori soglia.
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <Sezione>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Contenitore</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Categoria</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Target</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Attuale</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Scostamento</th>
                </tr>
              </thead>
              <tbody>
                {fuoriSoglia.map((s) => {
                  const sovrappeso = s.scostamento_pp > 0
                  return (
                    <tr key={s.target_id} className="tabella-riga">
                      <td style={{ padding: 8 }}>{s.contenitore_nome}</td>
                      <td style={{ padding: 8 }}>{s.categoria}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.target_percentuale, 2)}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.peso_attuale_pct, 2)}</td>
                      <td style={{ padding: 8, color: sovrappeso ? 'var(--warning)' : 'var(--primary-vivid)', fontWeight: 500 }}>
                        {formatNumero(s.scostamento_pp, 2, true)} pp ({sovrappeso ? 'sovrappeso' : 'sottopeso'})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Sezione>
        </div>
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>Simulazione</h2>

      <Sezione>
        <FormSimulazione
          contenitoriDisponibili={contenitoriDisponibili}
          contenitoreSelezionato={contenitoreSelezionato}
          versamentoIniziale={params.versamento}
          commissioneIniziale={params.commissione_vendita}
          forzaIniziale={forzaVendita}
        />
      </Sezione>

      {contenitoreSelezionato && necessario !== null && (
        <div style={{ marginTop: 24 }}>
          <Sezione>
            <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
              Per bilanciare comprando soltanto servirebbero circa <strong>{formatEuro(necessario)}</strong>.
            </p>

            {sufficiente ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--success)', fontWeight: 500 }}>
                Il versamento di {formatEuro(versamento)} basta.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500 }}>
                  Il versamento di {formatEuro(versamento)} non basta. Proposta di vendita per coprire la differenza:
                </p>

                {venditeProposte.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                    Nessun comparto sovrappesato da cui vendere in questo contenitore.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Quantità</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Valore</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Plus/minus lorda</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Aliquota</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venditeProposte.map((v) => (
                        <tr key={v.strumentoId} className="tabella-riga">
                          <td style={{ padding: 8 }}>{v.nome}</td>
                          <td style={{ padding: 8 }}>
                            {formatNumero(v.quantitaVenduta, 6)}
                            {!v.vincoloRispettato && (
                              <div style={{ color: 'var(--warning)', fontSize: 'var(--fs-card-link)' }}>
                                ridotta da {formatNumero(v.quantitaIdeale, 6)} per evitare minusvalenza netta
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 8 }}>{formatEuro(v.valoreVenduto)}</td>
                          <td style={{ padding: 8, color: v.plusvalenzaLorda >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatEuroSigned(v.plusvalenzaLorda)}
                          </td>
                          <td style={{ padding: 8 }}>{v.imponibile ? formatPercent(v.aliquota * 100, 1) : 'esente (Polizza)'}</td>
                          <td style={{ padding: 8 }}>{formatEuro(v.tassa)}</td>
                          <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(v.proventoNetto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p style={{ fontSize: 'var(--fs-body)', marginTop: 12 }}>
                  Versamento + proventi netti disponibili da reinvestire: <strong>{formatEuro(poolTotale)}</strong>
                </p>
              </>
            )}

            {allocazioneAcquisto.length > 0 && (
              <>
                <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Acquisti proposti</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Categoria</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Da versare</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Peso finale</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Scostamento finale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocazioneAcquisto.map((a) => (
                      <tr key={a.categoria} className="tabella-riga">
                        <td style={{ padding: 8 }}>{a.categoria}</td>
                        <td style={{ padding: 8 }}>{formatEuro(a.importo)}</td>
                        <td style={{ padding: 8 }}>{formatPercent(a.pesoFinalePct, 2)}</td>
                        <td style={{ padding: 8 }}>{formatNumero(a.scostamentoFinalePp, 2, true)} pp</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {allocazioneStrumenti.map((c) => (
                  <div key={c.categoria} style={{ marginTop: 16, fontSize: 'var(--fs-body)' }}>
                    <strong>{c.categoria}</strong>{' '}
                    <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
                      ({c.usaTarget ? 'secondo target per strumento' : 'secondo pesi attuali — nessun target per strumento impostato'})
                    </span>
                    {c.strumenti.length === 0 ? (
                      <p style={{ color: 'var(--warning)' }}>
                        Nessuno strumento posseduto qui: scegli manualmente cosa comprare.
                      </p>
                    ) : (
                      <ul>
                        {c.strumenti.map((s) => (
                          <li key={s.nome}>{s.nome} {s.ticker ? `(${s.ticker})` : ''}: {formatEuro(s.importo)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
          </Sezione>
        </div>
      )}
    </div>
  )
}