import { NextResponse } from 'next/server'

// ROUTE DI PROVA TEMPORANEA — da eliminare dopo il test.
// Scopo: capire se un server Vercel riesce a scaricare i file holdings degli ETF del PAC
// senza sessione né cookie, e che cosa conterrebbe la geografia di ciascuno.
// Non legge né scrive il database e non chiama EODHD.

export const maxDuration = 60

const URL_ISHARES =
  'https://www.blackrock.com/varnish-api/uk-retail01-product-data/product-data/api/v1/get-fund-document'

// Senza asOfDate: la prova precedente ha mostrato che così si ottiene l'ultimo file disponibile
// (con una data senza dati il file arriva vuoto, solo l'intestazione).
function urlIshares(portfolioId: string): string {
  const parametri = new URLSearchParams({
    appType: 'PRODUCT_PAGE',
    appSubType: 'ISHARES',
    targetSite: 'ishares-uk',
    locale: 'en_GB',
    portfolioId,
    userType: 'individual',
    component: 'holdings',
  })
  return `${URL_ISHARES}?${parametri.toString()}`
}

// portfolioId = il numero nell'indirizzo della pagina prodotto su ishares.com/uk.
// Ogni identificativo è stato abbinato all'ISIN presente nel database di Investrick.
const ETF_ISHARES = [
  { ticker: 'EUNL', portfolioId: '251882', nota: 'controllo, già provato' },
  { ticker: 'IS3N', portfolioId: '264659', nota: 'Core MSCI EM IMI' },
  { ticker: 'IS3S', portfolioId: '270048', nota: 'MSCI World Value Factor' },
  { ticker: 'IXUA', portfolioId: '340748', nota: 'MSCI World ex-USA' },
  { ticker: 'SXRQ', portfolioId: '253461', nota: 'Euro Govt Bond 7-10yr' },
  { ticker: 'IBCI', portfolioId: '251739', nota: 'Euro Inflation Linked Govt Bond' },
]

// Xtrackers (DBXP, ISIN LU0290356871): questo indirizzo NON è verificato, è ricordato a memoria.
// Serve solo a vedere se risponde; se non funziona va ricavato dal browser come per iShares.
const URL_XTRACKERS_DBXP =
  'https://etf.dws.com/etfdata/export/GBR/ENG/excel/product/constituent/LU0290356871/'

const INTESTAZIONI_RICHIESTA = {
  'User-Agent': 'Mozilla/5.0 (compatible; Investrick/1.0)',
  Accept: 'text/csv,application/csv,application/vnd.ms-excel,*/*',
}

// Divide una riga CSV rispettando i campi tra virgolette (che possono contenere virgole).
function dividiRigaCsv(riga: string): string[] {
  const campi: string[] = []
  let corrente = ''
  let traVirgolette = false
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i]
    if (c === '"') {
      if (traVirgolette && riga[i + 1] === '"') {
        corrente += '"'
        i++
      } else {
        traVirgolette = !traVirgolette
      }
    } else if (c === ',' && !traVirgolette) {
      campi.push(corrente)
      corrente = ''
    } else {
      corrente += c
    }
  }
  campi.push(corrente)
  return campi
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}

// Legge il CSV iShares e riassume: data del file, righe di dati, somma dei pesi, paesi (colonna Location).
function analizzaCsvIshares(testo: string) {
  const righe = testo.split(/\r?\n/)
  const rigaData = righe.slice(0, 5).find((riga) => riga.startsWith('Fund Holdings as of'))
  const dataFile = rigaData ? (dividiRigaCsv(rigaData)[1] ?? '').trim() : null
  const indiceIntestazione = righe
    .slice(0, 15)
    .findIndex((riga) => riga.includes('Weight (%)') && riga.includes('Location'))

  if (indiceIntestazione === -1) {
    return { dataFile, intestazioneTrovata: false as const }
  }

  const colonne = dividiRigaCsv(righe[indiceIntestazione]).map((c) => c.trim())
  const indicePeso = colonne.indexOf('Weight (%)')
  const indicePaese = colonne.indexOf('Location')
  const pesiPerPaese = new Map<string, number>()
  let righeDati = 0
  let sommaPesi = 0

  for (const riga of righe.slice(indiceIntestazione + 1)) {
    if (riga.trim() === '') continue
    const campi = dividiRigaCsv(riga)
    if (campi.length < colonne.length) continue // note a fondo file, non dati
    const peso = Number(campi[indicePeso].replace(/,/g, ''))
    if (!Number.isFinite(peso)) continue
    righeDati++
    sommaPesi += peso
    const paese = campi[indicePaese].trim() || '(vuoto)'
    pesiPerPaese.set(paese, (pesiPerPaese.get(paese) ?? 0) + peso)
  }

  const primiPaesi = [...pesiPerPaese.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([paese, peso]) => ({ paese, peso: arrotonda(peso) }))

  return {
    dataFile,
    intestazioneTrovata: true as const,
    colonne,
    righeDati,
    sommaPesi: arrotonda(sommaPesi),
    paesiDistinti: pesiPerPaese.size,
    primiPaesi,
  }
}

async function provaIshares(ticker: string, portfolioId: string, nota: string) {
  const inizio = Date.now()
  const etichetta = `${ticker} (portfolioId ${portfolioId}, ${nota})`
  try {
    const risposta = await fetch(urlIshares(portfolioId), {
      headers: INTESTAZIONI_RICHIESTA,
      signal: AbortSignal.timeout(8000),
    })
    const buffer = await risposta.arrayBuffer()
    const testo = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '')
    const sembraHtml = /^\s*</.test(testo)
    const analisi = analizzaCsvIshares(testo)

    // Un file è buono solo se ha una data reale, abbastanza righe e pesi che sommano a circa 100.
    const problemi: string[] = []
    if (!risposta.ok) problemi.push(`HTTP ${risposta.status}`)
    if (sembraHtml) problemi.push('risposta HTML invece di CSV')
    if (!analisi.intestazioneTrovata) problemi.push('intestazione con Weight (%) e Location non trovata')
    if (!analisi.dataFile || analisi.dataFile === '-') problemi.push('data del file assente o "-"')
    if (analisi.intestazioneTrovata) {
      if (analisi.righeDati < 10) problemi.push(`poche righe di dati (${analisi.righeDati})`)
      if (analisi.sommaPesi < 97 || analisi.sommaPesi > 103)
        problemi.push(`somma dei pesi anomala (${analisi.sommaPesi})`)
    }

    return {
      etichetta,
      esito: problemi.length === 0 ? 'OK' : 'DA CONTROLLARE',
      problemi,
      statoHttp: risposta.status,
      nomeFile: risposta.headers.get('content-disposition'),
      byte: buffer.byteLength,
      ...analisi,
      // Se qualcosa non va mostro l'inizio del file, per riconoscere ad esempio una pagina di blocco.
      ...(problemi.length > 0 ? { anteprima: testo.slice(0, 300) } : {}),
      millisecondi: Date.now() - inizio,
    }
  } catch (errore) {
    const causa = errore instanceof Error && errore.cause instanceof Error ? errore.cause.message : null
    return {
      etichetta,
      esito: 'ERRORE di rete',
      errore: errore instanceof Error ? errore.message : String(errore),
      causa,
      millisecondi: Date.now() - inizio,
    }
  }
}

// Xtrackers: qui non so ancora che formato abbia il file (probabilmente Excel), quindi descrivo soltanto la risposta.
async function provaXtrackers() {
  const inizio = Date.now()
  const etichetta = 'DBXP Xtrackers (indirizzo NON verificato)'
  try {
    const risposta = await fetch(URL_XTRACKERS_DBXP, {
      headers: INTESTAZIONI_RICHIESTA,
      signal: AbortSignal.timeout(8000),
    })
    const buffer = await risposta.arrayBuffer()
    const byte = new Uint8Array(buffer)
    const sembraExcelXlsx = byte.length > 4 && byte[0] === 0x50 && byte[1] === 0x4b // "PK": file zip, quindi .xlsx
    const testo = new TextDecoder('utf-8').decode(byte.slice(0, 300))
    return {
      etichetta,
      statoHttp: risposta.status,
      contentType: risposta.headers.get('content-type'),
      nomeFile: risposta.headers.get('content-disposition'),
      byte: buffer.byteLength,
      sembraExcelXlsx,
      anteprima: sembraExcelXlsx ? null : testo,
      millisecondi: Date.now() - inizio,
    }
  } catch (errore) {
    const causa = errore instanceof Error && errore.cause instanceof Error ? errore.cause.message : null
    return {
      etichetta,
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

  // Una dopo l'altra, non in parallelo: poche richieste, e se c'è un blocco si vede subito su tutte.
  const ishares = []
  for (const etf of ETF_ISHARES) {
    ishares.push(await provaIshares(etf.ticker, etf.portfolioId, etf.nota))
  }
  const xtrackers = await provaXtrackers()

  return NextResponse.json({
    regioneVercel: process.env.VERCEL_REGION ?? null,
    ambienteVercel: process.env.VERCEL_ENV ?? null,
    oraUtc: new Date().toUTCString(),
    ishares,
    xtrackers,
  })
}