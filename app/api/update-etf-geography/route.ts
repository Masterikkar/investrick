import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggiornaGeografiaEtf } from '@/lib/etf-geography'

// Aggiornamento settimanale della distribuzione geografica degli ETF del PAC (cron in vercel.json).
// Parametri facoltativi, per le prove a mano:
//   ?isin=IE00B4L5Y983   aggiorna solo quell'ETF
//   ?dryRun=1            scarica e controlla, ma non scrive nulla nel database
// Non chiama EODHD.

export const maxDuration = 60

export async function GET(request: Request) {
  const segreto = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secretDaQuery = url.searchParams.get('secret')
  // Se CRON_SECRET non è impostato nessuno è autorizzato (evita il caso "Bearer undefined").
  const autorizzato = !!segreto && (authHeader === `Bearer ${segreto}` || secretDaQuery === segreto)

  if (!autorizzato) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const soloProva = url.searchParams.get('dryRun') === '1'
  const isin = url.searchParams.get('isin')

  try {
    const risultati = await aggiornaGeografiaEtf(createAdminClient(), { isin, soloProva })
    const errori = risultati.filter((r) => r.esito === 'errore').length
    return NextResponse.json(
      {
        oraUtc: new Date().toUTCString(),
        ambienteVercel: process.env.VERCEL_ENV ?? null,
        soloProva,
        etf: risultati.length,
        errori,
        risultati,
      },
      // Con almeno un errore il cron compare come fallito nei log di Vercel.
      { status: errori > 0 ? 500 : 200 },
    )
  } catch (errore) {
    return NextResponse.json(
      { errore: errore instanceof Error ? errore.message : String(errore) },
      { status: 500 },
    )
  }
}
