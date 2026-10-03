import { NextResponse } from 'next/server'

// ROUTE DI PROVA TEMPORANEA — da eliminare dopo il test.
// Scopo: capire se un server Vercel riesce a scaricare il file holdings iShares (EUNL)
// senza sessione né cookie. Non legge né scrive il database e non chiama EODHD.

export const maxDuration = 60

const URL_BASE =
  'https://www.blackrock.com/varnish-api/uk-retail01-product-data/product-data/api/v1/get-fund-document'

// Stesso indirizzo che il browser chiama al click su "Download Holdings" (EUNL, portfolioId 251882).
// L'ordine dei parametri è quello originale; asOfDate è facoltativo per poter provare anche senza.
function costruisciUrl(asOfDate: string | null): string {
  const parametri = new URLSearchParams({
    appType: 'PRODUCT_PAGE',
    appSubType: 'ISHARES',
    targetSite: 'ishares-uk',
    locale: 'en_GB',
    portfolioId: '251882',
    userType: 'individual',
  })
  if (asOfDate) parametri.set('asOfDate', asOfDate)
  parametri.set('component', 'holdings')
  return `${URL_BASE}?${parametri.toString()}`
}

// Ultimo giorno lavorativo prima di oggi, formato AAAAMMGG. Data UTC voluta, come nelle route dei cron prezzi.
function ultimoGiornoLavorativo(): string {
  const d = new Date()
  do {
    d.setUTCDate(d.getUTCDate() - 1)
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  const anno = d.getUTCFullYear()
  const mese = String(d.getUTCMonth() + 1).padStart(2, '0')
  const giorno = String(d.getUTCDate()).padStart(2, '0')
  return `${anno}${mese}${giorno}`
}

async function provaScarico(etichetta: string, url: string) {
  const inizio = Date.now()
  try {
    const risposta = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Investrick/1.0)',
        Accept: 'text/csv,application/csv,*/*',
      },
      signal: AbortSignal.timeout(15000),
    })

    const buffer = await risposta.arrayBuffer()
    const testo = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '')
    const righe = testo.split(/\r?\n/)
    const sembraHtml = /^\s*</.test(testo)
    // Nel file reale l'intestazione delle colonne non è sulla prima riga: guardo le prime 15.
    const intestazioneTrovata = righe
      .slice(0, 15)
      .some((riga) => riga.includes('Location') && riga.includes('Weight (%)'))
    const sembraCsv = risposta.ok && !sembraHtml && intestazioneTrovata

    return {
      etichetta,
      url,
      esito: sembraCsv ? 'OK: sembra il CSV delle holdings' : 'NON è il CSV atteso',
      statoHttp: risposta.status,
      contentType: risposta.headers.get('content-type'),
      contentDisposition: risposta.headers.get('content-disposition'),
      byte: buffer.byteLength,
      righeNonVuote: righe.filter((riga) => riga.trim() !== '').length,
      intestazioneTrovata,
      // Se non è il CSV mostro l'inizio del corpo: serve a riconoscere una pagina di blocco ("Access Denied", ecc.).
      anteprima: sembraCsv
        ? righe.slice(0, 4).map((riga) => riga.slice(0, 160))
        : [testo.slice(0, 300)],
      millisecondi: Date.now() - inizio,
    }
  } catch (errore) {
    const causa = errore instanceof Error && errore.cause instanceof Error ? errore.cause.message : null
    return {
      etichetta,
      url,
      esito: 'ERRORE di rete',
      errore: errore instanceof Error ? errore.message : String(errore),
      causa,
      millisecondi: Date.now() - inizio,
    }
  }
}

export async function GET(request: Request) {
  const segreto = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const secretDaQuery = new URL(request.url).searchParams.get('secret')
  const autorizzato =
    !!segreto && (authHeader === `Bearer ${segreto}` || secretDaQuery === segreto)

  if (!autorizzato) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const dataLavorativa = ultimoGiornoLavorativo()

  // Una dopo l'altra, non in parallelo: poche richieste, e se c'è un blocco si vede subito su tutte.
  const prove = [
    await provaScarico('1. link originale (asOfDate=20261001)', costruisciUrl('20261001')),
    await provaScarico('2. senza asOfDate', costruisciUrl(null)),
    await provaScarico(
      `3. asOfDate=${dataLavorativa} (ultimo giorno lavorativo prima di oggi)`,
      costruisciUrl(dataLavorativa)
    ),
  ]

  return NextResponse.json({
    regioneVercel: process.env.VERCEL_REGION ?? null,
    ambienteVercel: process.env.VERCEL_ENV ?? null,
    oraUtc: new Date().toUTCString(),
    prove,
  })
}