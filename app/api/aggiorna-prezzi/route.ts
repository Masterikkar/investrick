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
    .select('id, codice_prezzo')
    .not('codice_prezzo', 'is', null)

  if (erroreStrumenti || !strumenti) {
    return NextResponse.json({ errore: 'Impossibile leggere gli strumenti' }, { status: 500 })
  }

  const oggi = new Date().toISOString().slice(0, 10)
  const risultati: { strumento: string; esito: string }[] = []

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

      const { error } = await supabase.from('prezzi_storici').upsert(
        {
          strumento_id: strumento.id,
          data: oggi,
          prezzo: dati.close,
          valuta: 'EUR',
          fonte: 'eodhd',
        },
        { onConflict: 'strumento_id,data' }
      )

      risultati.push({
        strumento: strumento.codice_prezzo!,
        esito: error ? `errore: ${error.message}` : 'ok',
      })
    } catch {
      risultati.push({ strumento: strumento.codice_prezzo!, esito: 'errore di rete' })
    }
  }

  return NextResponse.json({ data: oggi, risultati })
}