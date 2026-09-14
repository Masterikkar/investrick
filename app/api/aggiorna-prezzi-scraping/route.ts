import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Estrae il prezzo dallo span che Teleborsa usa per il valore corrente del fondo
// (id="ctl00_phContents_ctlHeader_lblPrice", lo stesso target della formula IMPORTXML già in uso).
// Prende solo il prefisso numerico: gestisce così anche i casi in cui lo span contiene
// testo extra dopo il numero (es. "INV." quando non c'è variazione percentuale).
function estraiPrezzo(html: string): number | null {
  const match = html.match(/id="ctl00_phContents_ctlHeader_lblPrice"[^>]*>([^<]*)</i)
  if (!match) return null

  const testoGrezzo = match[1].trim()
  const numeroMatch = testoGrezzo.match(/^[\d.,]+/)
  if (!numeroMatch) return null

  // Formato italiano: punto = migliaia, virgola = decimali
  const numeroPulito = numeroMatch[0].replace(/\./g, '').replace(',', '.')
  const valore = Number(numeroPulito)
  return Number.isFinite(valore) && valore > 0 ? valore : null
}

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

  const { data: fonti, error: erroreFonti } = await supabase
    .from('fonti_prezzo_scraping')
    .select('strumento_id, url')

  if (erroreFonti || !fonti) {
    return NextResponse.json({ errore: 'Impossibile leggere le fonti di scraping' }, { status: 500 })
  }

  const oggi = new Date().toISOString().slice(0, 10)
  const risultati: { strumento_id: string; esito: string }[] = []

  for (const fonte of fonti) {
    try {
      const risposta = await fetch(fonte.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Investrick/1.0)' },
      })

      if (!risposta.ok) {
        risultati.push({ strumento_id: fonte.strumento_id, esito: `errore HTTP ${risposta.status}` })
        continue
      }

      const html = await risposta.text()
      const prezzo = estraiPrezzo(html)

      if (prezzo === null) {
        risultati.push({ strumento_id: fonte.strumento_id, esito: 'prezzo non trovato nella pagina' })
        continue
      }

      const { error } = await supabase.from('prezzi_storici').upsert(
        {
          strumento_id: fonte.strumento_id,
          data: oggi,
          prezzo,
          valuta: 'EUR',
          fonte: 'teleborsa_scraping',
        },
        { onConflict: 'strumento_id,data' }
      )

      risultati.push({
        strumento_id: fonte.strumento_id,
        esito: error ? `errore: ${error.message}` : `ok (${prezzo})`,
      })
    } catch (e) {
      risultati.push({ strumento_id: fonte.strumento_id, esito: `errore di rete: ${e}` })
    }
  }

  return NextResponse.json({ data: oggi, risultati })
}