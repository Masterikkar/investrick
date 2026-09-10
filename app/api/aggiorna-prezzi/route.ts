import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secretDaQuery = url.searchParams.get('secret')

  // --- Blocco diagnostico TEMPORANEO: nessun segreto viene mai mostrato, solo presenza/lunghezza ---
  if (url.searchParams.get('diag') === '1') {
    return NextResponse.json({
      cronSecretImpostatoSuVercel: Boolean(process.env.CRON_SECRET),
      cronSecretLunghezza: process.env.CRON_SECRET?.length ?? 0,
      secretRicevutoNellUrlLunghezza: secretDaQuery?.length ?? 0,
      combaciano: secretDaQuery === process.env.CRON_SECRET,
    })
  }
  // --- Fine blocco diagnostico ---

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

  return NextResponse.json({ data: oggi, risultati, tassoEurUsd })
}