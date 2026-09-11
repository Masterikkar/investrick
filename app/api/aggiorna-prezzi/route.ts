import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secretDaQuery = url.searchParams.get('secret')
  const autorizzato =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretDaQuery === process.env.CRON_SECRET

  if (!autorizzato) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: strumenti, error: erroreStrumenti } = await supabase
    .from('strumenti')
    .select('id, codice_prezzo, valuta')
    .not('codice_prezzo', 'is', null)

  if (erroreStrumenti || !strumenti) {
    return NextResponse.json({ errore: 'Impossibile leggere gli strumenti' }, { status: 500 })
  }

  const oggi = new Date().toISOString().slice(0, 10)
  const risultati: { strumento: string; esito: string }[] = []

  const serveConversioneUsd = strumenti.some((s) => s.valuta && s.valuta !== 'EUR')
  let tassoEurUsd: number | null = null

  if (serveConversioneUsd) {
    try {
      const rispostaForex = await fetch(
        `https://eodhistoricaldata.com/api/real-time/EURUSD.FOREX?api_token=${process.env.EODHD_API_KEY}&fmt=json`
      )
      const datiForex = await rispostaForex.json()
      if (typeof datiForex.close === 'number' && datiForex.close > 0) {
        tassoEurUsd = datiForex.close
      }
    } catch {
      tassoEurUsd = null
    }
  }

  for (const strumento of strumenti) {
    try {
      const risposta = await fetch(
        `https://eodhistoricaldata.com/api/real-time/${strumento.codice_prezzo}?api_token=${process.env.EODHD_API_KEY}&fmt=json`
      )
      const dati = await risposta.json()

      if (!dati.close) {
        risultati.push({ strumento: strumento.codice_prezzo!, esito: 'nessun prezzo ricevuto' })
        continue
      }

      let prezzoFinale = dati.close
      let notaConversione = ''

      if (strumento.valuta && strumento.valuta !== 'EUR') {
        if (!tassoEurUsd) {
          risultati.push({
            strumento: strumento.codice_prezzo!,
            esito: 'saltato: tasso di cambio EUR/USD non disponibile',
          })
          continue
        }
        prezzoFinale = dati.close / tassoEurUsd
        notaConversione = ` (convertito da ${strumento.valuta}, tasso EUR/USD ${tassoEurUsd})`
      }

      const { error } = await supabase.from('prezzi_storici').upsert(
        {
          strumento_id: strumento.id,
          data: oggi,
          prezzo: prezzoFinale,
          valuta: 'EUR',
          fonte: 'eodhd',
        },
        { onConflict: 'strumento_id,data' }
      )

      risultati.push({
        strumento: strumento.codice_prezzo!,
        esito: error ? `errore: ${error.message}` : `ok${notaConversione}`,
      })
    } catch {
      risultati.push({ strumento: strumento.codice_prezzo!, esito: 'errore di rete' })
    }
  }

  // --- Snapshot giornaliero di valorizzazione: mercato + liquidità, incluso "Diretto" ---
  const risultatiSnapshot: { tipo: string; esito: string }[] = []

  try {
    const { data: posizioniMercato } = await supabase
      .from('v_valore_posizioni_attuale')
      .select('strumento_id, contenitore_id, quantita_corrente, prezzo_attuale, valore_attuale')

    const posizioniValide = (posizioniMercato ?? []).filter(
      (p) => p.strumento_id !== null && p.quantita_corrente !== null && p.prezzo_attuale !== null
    )
    const posizioniScartate = (posizioniMercato?.length ?? 0) - posizioniValide.length

    if (posizioniValide.length > 0) {
      const righeMercato = posizioniValide.map((p) => ({
        strumento_id: p.strumento_id as string,
        contenitore_id: p.contenitore_id,
        data: oggi,
        quantita: p.quantita_corrente as number,
        prezzo: p.prezzo_attuale as number,
        valore: (p.valore_attuale as number | null) ?? (p.quantita_corrente as number) * (p.prezzo_attuale as number),
      }))

      const { error: erroreMercato } = await supabase
        .from('storico_valorizzazioni')
        .upsert(righeMercato, { onConflict: 'strumento_id,contenitore_id,data', ignoreDuplicates: false })

      risultatiSnapshot.push({
        tipo: 'mercato',
        esito: erroreMercato
          ? `errore: ${erroreMercato.message}`
          : `ok (${righeMercato.length} posizioni${posizioniScartate > 0 ? `, ${posizioniScartate} scartate per dati mancanti` : ''})`,
      })
    } else {
      risultatiSnapshot.push({ tipo: 'mercato', esito: 'nessuna posizione valida da salvare' })
    }

    const { data: saldiLiquidita } = await supabase
      .from('v_saldo_liquidita')
      .select('strumento_id, contenitore_id, saldo_corrente')

    const saldiValidi = (saldiLiquidita ?? []).filter(
      (s) => s.strumento_id !== null && s.saldo_corrente !== null
    )
    const saldiScartati = (saldiLiquidita?.length ?? 0) - saldiValidi.length

    if (saldiValidi.length > 0) {
      const righeLiquidita = saldiValidi.map((s) => ({
        strumento_id: s.strumento_id as string,
        contenitore_id: s.contenitore_id,
        data: oggi,
        quantita: 1,
        prezzo: s.saldo_corrente as number,
        valore: s.saldo_corrente as number,
      }))

      const { error: erroreLiquidita } = await supabase
        .from('storico_valorizzazioni')
        .upsert(righeLiquidita, { onConflict: 'strumento_id,contenitore_id,data', ignoreDuplicates: false })

      risultatiSnapshot.push({
        tipo: 'liquidita',
        esito: erroreLiquidita
          ? `errore: ${erroreLiquidita.message}`
          : `ok (${righeLiquidita.length} conti${saldiScartati > 0 ? `, ${saldiScartati} scartati per dati mancanti` : ''})`,
      })
    } else {
      risultatiSnapshot.push({ tipo: 'liquidita', esito: 'nessun conto valido da salvare' })
    }
  } catch (e) {
    risultatiSnapshot.push({ tipo: 'snapshot', esito: `errore imprevisto: ${e}` })
  }

  return NextResponse.json({ data: oggi, risultati, risultatiSnapshot, tassoEurUsd })
}