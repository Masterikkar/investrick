import { read, utils } from 'xlsx'
import type { createAdminClient } from '@/lib/supabase/admin'
import { componiDataIso, giorniNelMese } from '@/lib/data-calendario'

// Aggiornamento automatico dell'esposizione degli ETF del PAC: distribuzione geografica e partecipazioni.
// Scarica i file delle holdings pubblicati dagli emittenti (iShares: CSV, Xtrackers: Excel),
// somma i pesi per paese contando solo i titoli (niente cash, derivati, valute), riporta il
// totale a 100 e sostituisce i dati dell'ETF con sostituisci_partecipazioni_etf() e
// sostituisci_geografia_etf(). Salva anche le prime partecipazioni, sulla stessa base dei pesi.
// Un file che non supera i controlli non tocca mai l'ultimo dato valido.
// Solo lato server: usa SheetJS e la chiave di servizio.

type ClienteAdmin = ReturnType<typeof createAdminClient>

// ───────────────────────── Tipi ─────────────────────────

export type PartecipazioneEstratta = {
  nome: string
  ticker: string | null
  /** ISIN del titolo, quando il file lo dichiara (Xtrackers). */
  isinTitolo: string | null
  /** Solo obbligazioni iShares. */
  cedolaPct: number | null
  /** Solo obbligazioni iShares (YYYY-MM-DD). */
  scadenza: string | null
  /** % sui soli titoli, sulla stessa base della geografia (la somma di tutti i titoli darebbe 100). */
  peso: number
}

export type GeografiaEstratta = {
  /** % per paese (paese come scritto dall'emittente), riportata a 100 sui soli titoli. */
  pesi: Record<string, number>
  /** Le posizioni più pesanti (al massimo MAX_PARTECIPAZIONI), dalla più pesante. */
  partecipazioni: PartecipazioneEstratta[]
  /** Data delle holdings dichiarata dal file (YYYY-MM-DD), null se il file non la dichiara. */
  dataFile: string | null
  /** Somma dei pesi dei titoli prima di riportarli a 100 (serve per i controlli). */
  sommaPesiGrezza: number
  righeTitoli: number
  /** Titoli con scadenza dichiarata ma illeggibile (restano senza scadenza): 0 se è tutto a posto. */
  scadenzeNonLette: number
  /** Righe escluse perché non sono titoli, per tipo (cash, derivati, valute...). */
  esclusi: { tipo: string; peso: number; righe: number }[]
}

export type EsitoFonte = {
  isin: string
  emittente: string
  esito: 'ok' | 'errore'
  /** true se il dato è stato scritto nel database (false in prova o in caso di errore). */
  scritto: boolean
  messaggio: string
  dataFile?: string | null
  sommaPesiGrezza?: number
  righeTitoli?: number
  paesiDistinti?: number
  /** I cinque paesi più pesanti, in % già riportata a 100. */
  principaliPaesi?: { paese: string; peso: number }[]
  /** Totali per macro-regione (i paesi non mappati stanno in "Altro"). */
  regioni?: { regione: string; peso: number }[]
  esclusi?: { tipo: string; peso: number; righe: number }[]
  /** Quante partecipazioni sono state (o sarebbero state) salvate. */
  partecipazioniSalvate?: number
  /** Le prime cinque partecipazioni, per controllare a colpo d'occhio che nomi e pesi abbiano senso. */
  primePartecipazioni?: PartecipazioneEstratta[]
}

// ───────────────────────── Utilità ─────────────────────────

const INTESTAZIONI_RICHIESTA = {
  'User-Agent': 'Mozilla/5.0 (compatible; Investrick/1.0)',
  Accept: 'text/csv,application/csv,application/vnd.ms-excel,application/octet-stream,*/*',
}
const TIMEOUT_RICHIESTA_MS = 20_000

const MESI_INGLESI = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MESI_INGLESI_ESTESI = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

// 1–12 per "Sep", "Sept" (come abbrevia settembre l'inglese britannico) o "September"; 0 se non è un mese.
function numeroMeseInglese(parola: string): number {
  const p = parola.toLowerCase()
  const breve = MESI_INGLESI.indexOf(p)
  if (breve >= 0) return breve + 1
  if (p === 'sept') return 9
  return MESI_INGLESI_ESTESI.indexOf(p) + 1
}

// Pesi dei titoli accettati prima della normalizzazione, in % (controllo di sanità sul file).
// Xtrackers è più largo: il file di DBXP somma oltre 108% già sulle sole obbligazioni (motivo non chiarito).
const SOMMA_TITOLI_ISHARES = { min: 90, max: 103 }
const SOMMA_TITOLI_XTRACKERS = { min: 90, max: 115 }
const RIGHE_TITOLI_MINIME = 10

// Quante posizioni per ETF si salvano: abbastanza perché la lista aggregata del PAC sia esatta
// (la 100ª posizione di un ETF globale pesa circa 0,1%), poche perché il dato resti leggero.
// Le obbligazioni dei tre ETF del PAC sono meno di 100, quindi si salvano tutte.
export const MAX_PARTECIPAZIONI = 100
// I pesi delle partecipazioni salvate non possono superare 100 (stessa tolleranza della funzione SQL).
const SOMMA_PARTECIPAZIONI_MAX = 100.5

// Tipi di riga che contano come titoli, in minuscolo. Tutto il resto è escluso e segnalato.
const TIPI_TITOLO_ISHARES = new Set(['equity', 'fixed income'])
const TIPI_TITOLO_XTRACKERS = new Set(['equity', 'bond'])

function arrotonda(valore: number, decimali: number): number {
  const fattore = 10 ** decimali
  return Math.round(valore * fattore) / fattore
}

function formatoMessaggio(valore: number): string {
  return arrotonda(valore, 2).toFixed(2).replace('.', ',')
}

function testoErrore(errore: unknown): string {
  const base = errore instanceof Error ? errore.message : String(errore)
  const causa = errore instanceof Error && errore.cause instanceof Error ? ` (${errore.cause.message})` : ''
  return `${base}${causa}`.slice(0, 500)
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

// "01/Oct/2026" → "2026-10-01", senza passare da Date. null se non è una data reale (il file vuoto ha "-").
function dataIsoDaIshares(testo: string): string | null {
  const m = testo.trim().match(/^(\d{1,2})\/([A-Za-z]{3,9})\/(\d{4})$/)
  if (!m) return null
  const giorno = Number(m[1])
  const mese = numeroMeseInglese(m[2])
  const anno = Number(m[3])
  if (mese < 1 || giorno < 1 || giorno > giorniNelMese(anno, mese)) return null
  return componiDataIso(anno, mese, giorno)
}

// Cella facoltativa: vuota o "-" (come scrivono i file quando manca il dato) vale null.
function testoOpzionale(valore: unknown): string | null {
  const testo = String(valore ?? '').replace(/\s+/g, ' ').trim()
  return testo === '' || testo === '-' ? null : testo
}

// Numero facoltativo di un CSV ("4.00", "1,234.5"); null se assente o non numerico.
function numeroOpzionale(valore: unknown): number | null {
  const testo = testoOpzionale(valore)
  if (testo === null) return null
  const numero = Number(testo.replace(/,/g, ''))
  return Number.isFinite(numero) ? numero : null
}

type DettaglioTitolo = Omit<PartecipazioneEstratta, 'peso'>
type TitoloGrezzo = DettaglioTitolo & { peso: number }

type Accumulatori = {
  pesiGrezzi: Map<string, number>
  titoli: TitoloGrezzo[]
  esclusi: Map<string, { peso: number; righe: number }>
  righeTitoli: number
  /** Titoli con una scadenza scritta nel file ma in un formato che non si riesce a leggere. */
  scadenzeNonLette: number
}

function nuoviAccumulatori(): Accumulatori {
  return { pesiGrezzi: new Map(), titoli: [], esclusi: new Map(), righeTitoli: 0, scadenzeNonLette: 0 }
}

function aggiungiRiga(
  acc: Accumulatori,
  eTitolo: boolean,
  tipo: string,
  paese: string,
  peso: number,
  dettaglio: DettaglioTitolo,
) {
  if (eTitolo) {
    acc.righeTitoli++
    acc.pesiGrezzi.set(paese, (acc.pesiGrezzi.get(paese) ?? 0) + peso)
    acc.titoli.push({ ...dettaglio, peso })
  } else {
    const precedente = acc.esclusi.get(tipo) ?? { peso: 0, righe: 0 }
    acc.esclusi.set(tipo, { peso: precedente.peso + peso, righe: precedente.righe + 1 })
  }
}

// Controlla la somma, riporta a 100 sulla parte con peso positivo e arrotonda a 4 decimali.
function finalizza(
  acc: Accumulatori,
  dataFile: string | null,
  limiti: { min: number; max: number },
): GeografiaEstratta {
  if (acc.righeTitoli < RIGHE_TITOLI_MINIME) {
    throw new Error(`Poche righe di titoli nel file (${acc.righeTitoli})`)
  }
  const sommaGrezza = [...acc.pesiGrezzi.values()].reduce((a, b) => a + b, 0)
  if (sommaGrezza < limiti.min || sommaGrezza > limiti.max) {
    throw new Error(
      `Somma dei pesi dei titoli fuori range: ${formatoMessaggio(sommaGrezza)}% (attesa tra ${limiti.min} e ${limiti.max})`,
    )
  }

  const positivi = [...acc.pesiGrezzi.entries()].filter(([, peso]) => peso > 0)
  const sommaPositivi = positivi.reduce((somma, [, peso]) => somma + peso, 0)
  if (positivi.length === 0 || sommaPositivi <= 0) {
    throw new Error('Nessun paese con peso positivo')
  }

  const pesi: Record<string, number> = {}
  for (const [paese, peso] of positivi) {
    pesi[paese] = arrotonda((peso / sommaPositivi) * 100, 4)
  }

  // Le posizioni più pesanti, sulla stessa base dei paesi: così la lista e la geografia sono coerenti.
  // L'ordinamento è stabile: a pari peso resta l'ordine del file.
  const partecipazioni: PartecipazioneEstratta[] = acc.titoli
    .filter((titolo) => titolo.peso > 0)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, MAX_PARTECIPAZIONI)
    .map((titolo) => ({ ...titolo, peso: arrotonda((titolo.peso / sommaPositivi) * 100, 4) }))
  if (partecipazioni.length === 0) {
    throw new Error('Nessuna partecipazione con peso positivo')
  }
  const sommaPartecipazioni = partecipazioni.reduce((somma, p) => somma + p.peso, 0)
  if (sommaPartecipazioni > SOMMA_PARTECIPAZIONI_MAX) {
    throw new Error(`Le partecipazioni sommano ${formatoMessaggio(sommaPartecipazioni)}% (oltre 100)`)
  }

  return {
    pesi,
    partecipazioni,
    dataFile,
    sommaPesiGrezza: arrotonda(sommaGrezza, 4),
    righeTitoli: acc.righeTitoli,
    scadenzeNonLette: acc.scadenzeNonLette,
    esclusi: [...acc.esclusi.entries()]
      .map(([tipo, v]) => ({ tipo, peso: arrotonda(v.peso, 4), righe: v.righe }))
      .sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso)),
  }
}

// ───────────────────────── iShares (CSV) ─────────────────────────

const URL_ISHARES = 'https://www.blackrock.com/varnish-api/uk-retail01-product-data/product-data/api/v1/get-fund-document'

// portfolioId = il numero nell'indirizzo della pagina prodotto su ishares.com/uk.
// Senza asOfDate si ottiene l'ultimo file disponibile (con una data senza dati il file arriva vuoto).
export function urlHoldingsIshares(portfolioId: string): string {
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

/**
 * Legge il CSV delle holdings iShares: riga "Fund Holdings as of,<data>", riga vuota, intestazione
 * con Asset Class, Weight (%) e Location, poi una riga per titolo (campi tra virgolette).
 * Conta le righe il cui Asset Class è un titolo (Equity, Fixed Income); il resto è escluso e segnalato.
 */
export function estraiGeografiaIshares(testoGrezzo: string): GeografiaEstratta {
  const testo = testoGrezzo.replace(/^﻿/, '')
  if (/^\s*</.test(testo)) throw new Error('Risposta HTML invece del CSV')
  const righe = testo.split(/\r?\n/)

  const rigaData = righe.slice(0, 5).find((riga) => riga.startsWith('Fund Holdings as of'))
  const testoData = rigaData ? (dividiRigaCsv(rigaData)[1] ?? '').trim() : ''
  const dataFile = dataIsoDaIshares(testoData)
  if (!dataFile) throw new Error(`Data delle holdings assente o non valida ("${testoData || 'riga mancante'}")`)

  const indiceIntestazione = righe
    .slice(0, 20)
    .findIndex((riga) => riga.includes('Weight (%)') && riga.includes('Location') && riga.includes('Asset Class'))
  if (indiceIntestazione === -1) throw new Error('Intestazione con Asset Class, Weight (%) e Location non trovata')

  const colonne = dividiRigaCsv(righe[indiceIntestazione]).map((c) => c.trim())
  const indiceTipo = colonne.indexOf('Asset Class')
  const indicePeso = colonne.indexOf('Weight (%)')
  const indicePaese = colonne.indexOf('Location')
  const indiceNome = colonne.indexOf('Name')
  if (indiceNome === -1) throw new Error('Colonna Name non trovata')
  // Facoltative: Ticker esiste per le azioni, Coupon (%) e Maturity solo per le obbligazioni.
  const indiceTicker = colonne.indexOf('Ticker')
  const indiceCedola = colonne.indexOf('Coupon (%)')
  const indiceScadenza = colonne.indexOf('Maturity')

  const acc = nuoviAccumulatori()
  for (const riga of righe.slice(indiceIntestazione + 1)) {
    if (riga.trim() === '') continue
    const campi = dividiRigaCsv(riga)
    if (campi.length < colonne.length) continue // note a fondo file, non dati
    const peso = Number(campi[indicePeso].replace(/,/g, '').trim())
    if (!Number.isFinite(peso)) continue
    const tipo = campi[indiceTipo].trim() || '(senza tipo)'
    const paese = campi[indicePaese].trim() || '-'
    const ticker = indiceTicker >= 0 ? testoOpzionale(campi[indiceTicker]) : null
    const eTitolo = TIPI_TITOLO_ISHARES.has(tipo.toLowerCase())
    const scadenzaScritta = indiceScadenza >= 0 ? testoOpzionale(campi[indiceScadenza]) : null
    const scadenza = scadenzaScritta ? dataIsoDaIshares(scadenzaScritta) : null
    if (eTitolo && scadenzaScritta && !scadenza) acc.scadenzeNonLette++
    aggiungiRiga(acc, eTitolo, tipo, paese, peso, {
      nome: testoOpzionale(campi[indiceNome]) ?? ticker ?? '(senza nome)',
      ticker,
      isinTitolo: null,
      cedolaPct: indiceCedola >= 0 ? numeroOpzionale(campi[indiceCedola]) : null,
      scadenza,
    })
  }

  return finalizza(acc, dataFile, SOMMA_TITOLI_ISHARES)
}

async function scaricaTestoIshares(portfolioId: string): Promise<string> {
  const risposta = await fetch(urlHoldingsIshares(portfolioId), {
    headers: INTESTAZIONI_RICHIESTA,
    signal: AbortSignal.timeout(TIMEOUT_RICHIESTA_MS),
  })
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status} da iShares`)
  return new TextDecoder('utf-8').decode(await risposta.arrayBuffer())
}

// ───────────────────────── Xtrackers (Excel) ─────────────────────────

export function urlHoldingsXtrackers(isin: string): string {
  return `https://etf.dws.com/etfdata/export/GBR/ENG/excel/product/constituent/${isin}/`
}

/**
 * Legge le righe del foglio Excel delle holdings Xtrackers (array di array, come da sheet_to_json con header: 1):
 * righe di avvertenza, intestazione con Country, Type of Security e Weighting, poi un titolo per riga.
 * I pesi sono frazioni (0,0897 = 8,97%). Il file non dichiara la data delle holdings.
 */
export function estraiGeografiaXtrackers(righe: unknown[][]): GeografiaEstratta {
  const indiceIntestazione = righe.slice(0, 20).findIndex((riga) => {
    const celle = riga.map((c) => String(c ?? '').trim())
    return celle.includes('Weighting') && celle.includes('Country') && celle.includes('Type of Security')
  })
  if (indiceIntestazione === -1) throw new Error('Intestazione con Country, Type of Security e Weighting non trovata')

  const colonne = righe[indiceIntestazione].map((c) => String(c ?? '').trim())
  const indicePeso = colonne.indexOf('Weighting')
  const indicePaese = colonne.indexOf('Country')
  const indiceTipo = colonne.indexOf('Type of Security')
  const indiceNome = colonne.indexOf('Name')
  if (indiceNome === -1) throw new Error('Colonna Name non trovata')
  const indiceIsin = colonne.indexOf('ISIN') // facoltativa

  const acc = nuoviAccumulatori()
  for (const riga of righe.slice(indiceIntestazione + 1)) {
    const grezzo = riga[indicePeso]
    if (typeof grezzo !== 'number' || !Number.isFinite(grezzo)) continue
    const peso = grezzo * 100
    const tipo = String(riga[indiceTipo] ?? '').trim() || '(senza tipo)'
    const paese = String(riga[indicePaese] ?? '').trim() || '-'
    const isinTitolo = indiceIsin >= 0 ? testoOpzionale(riga[indiceIsin]) : null
    aggiungiRiga(acc, TIPI_TITOLO_XTRACKERS.has(tipo.toLowerCase()), tipo, paese, peso, {
      nome: testoOpzionale(riga[indiceNome]) ?? isinTitolo ?? '(senza nome)',
      ticker: null,
      isinTitolo,
      cedolaPct: null,
      scadenza: null,
    })
  }

  return finalizza(acc, null, SOMMA_TITOLI_XTRACKERS)
}

async function scaricaRigheXtrackers(isin: string): Promise<unknown[][]> {
  const risposta = await fetch(urlHoldingsXtrackers(isin), {
    headers: INTESTAZIONI_RICHIESTA,
    signal: AbortSignal.timeout(TIMEOUT_RICHIESTA_MS),
  })
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status} da Xtrackers`)
  const byte = new Uint8Array(await risposta.arrayBuffer())
  // Un .xlsx è un archivio zip: inizia con "PK". Altrimenti è una pagina di errore.
  if (byte.length < 4 || byte[0] !== 0x50 || byte[1] !== 0x4b) {
    throw new Error('La risposta di Xtrackers non è un file Excel')
  }
  const cartella = read(byte, { type: 'array' })
  const nomeFoglio = cartella.SheetNames[0]
  if (!nomeFoglio) throw new Error('File Excel senza fogli')
  return utils.sheet_to_json<unknown[]>(cartella.Sheets[nomeFoglio], { header: 1, raw: true, defval: null })
}

// ───────────────────────── Aggiornamento ─────────────────────────

function riepilogaMessaggio(
  estratto: GeografiaEstratta,
  nonRiconosciuti: { paese: string; peso: number }[],
  senzaPaese: number,
): string {
  const parti = [
    `ok: ${Object.keys(estratto.pesi).length} paesi da ${estratto.righeTitoli} titoli, somma grezza ${formatoMessaggio(estratto.sommaPesiGrezza)}%`,
    `partecipazioni: ${estratto.partecipazioni.length}`,
  ]
  if (estratto.scadenzeNonLette > 0) parti.push(`scadenze non lette: ${estratto.scadenzeNonLette}`)
  if (estratto.esclusi.length > 0) {
    parti.push(`esclusi: ${estratto.esclusi.map((e) => `${e.tipo} ${formatoMessaggio(e.peso)}%`).join(', ')}`)
  }
  if (nonRiconosciuti.length > 0) {
    parti.push(
      `paesi non riconosciuti (in "Altro", da aggiungere a paesi_macro_regioni): ${nonRiconosciuti
        .map((n) => `${n.paese} ${formatoMessaggio(n.peso)}%`)
        .join(', ')}`,
    )
  }
  if (senzaPaese > 0) parti.push(`senza paese: ${formatoMessaggio(senzaPaese)}%`)
  return parti.join('; ')
}

type Fonte = { isin: string; emittente: string; parametro: string | null; data_file: string | null }

async function estraiDaFonte(fonte: Fonte): Promise<GeografiaEstratta> {
  if (fonte.emittente === 'ishares') {
    if (!fonte.parametro) throw new Error('portfolioId mancante per una fonte iShares')
    return estraiGeografiaIshares(await scaricaTestoIshares(fonte.parametro))
  }
  if (fonte.emittente === 'xtrackers') {
    return estraiGeografiaXtrackers(await scaricaRigheXtrackers(fonte.isin))
  }
  throw new Error(`Emittente non gestito: ${fonte.emittente}`)
}

/**
 * Aggiorna la geografia degli ETF attivi in geografia_fonti, uno alla volta.
 * - soloProva: scarica e controlla ma non scrive nulla (serve a confrontare i numeri prima di accendere il cron).
 * - isin: aggiorna solo quell'ETF.
 * Un errore (rete, formato, controlli) lascia l'ultimo dato valido e registra l'esito in geografia_fonti.
 */
export async function aggiornaGeografiaEtf(
  supabase: ClienteAdmin,
  opzioni: { isin?: string | null; soloProva?: boolean } = {},
): Promise<EsitoFonte[]> {
  const soloProva = opzioni.soloProva === true

  let interrogazione = supabase
    .from('geografia_fonti')
    .select('isin, emittente, parametro, data_file')
    .eq('attiva', true)
  if (opzioni.isin) interrogazione = interrogazione.eq('isin', opzioni.isin)
  const { data: fonti, error: erroreFonti } = await interrogazione.order('isin')
  if (erroreFonti || !fonti) {
    throw new Error(`Impossibile leggere geografia_fonti: ${erroreFonti?.message ?? 'nessun dato'}`)
  }

  const { data: paesiMappati, error: erroreMappa } = await supabase
    .from('paesi_macro_regioni')
    .select('nome_nel_file, macro_regione')
  if (erroreMappa || !paesiMappati) {
    throw new Error(`Impossibile leggere paesi_macro_regioni: ${erroreMappa?.message ?? 'nessun dato'}`)
  }
  const regionePerPaese = new Map(paesiMappati.map((p) => [p.nome_nel_file, p.macro_regione]))

  const esiti: EsitoFonte[] = []
  for (const fonte of fonti) {
    try {
      const estratto = await estraiDaFonte(fonte)

      // Mai tornare indietro nel tempo: un file con data più vecchia di quello già salvato è sospetto.
      if (fonte.data_file && estratto.dataFile && estratto.dataFile < fonte.data_file) {
        throw new Error(`Il file (${estratto.dataFile}) è più vecchio di quello già salvato (${fonte.data_file})`)
      }

      const voci = Object.entries(estratto.pesi).sort((a, b) => b[1] - a[1])
      const nonRiconosciuti = voci
        .filter(([paese]) => paese !== '-' && !regionePerPaese.has(paese))
        .map(([paese, peso]) => ({ paese, peso }))
      const senzaPaese = estratto.pesi['-'] ?? 0
      const messaggio = riepilogaMessaggio(estratto, nonRiconosciuti, senzaPaese)

      const pesiPerRegione = new Map<string, number>()
      for (const [paese, peso] of voci) {
        const regione = regionePerPaese.get(paese) ?? 'Altro'
        pesiPerRegione.set(regione, (pesiPerRegione.get(regione) ?? 0) + peso)
      }

      if (!soloProva) {
        // Prima le partecipazioni, poi la geografia (che registra anche l'esito e la data): se la prima
        // scrittura fallisce non cambia nulla, e se fallisse la seconda resterebbe solo una lista più nuova.
        const { error: errorePartecipazioni } = await supabase.rpc('sostituisci_partecipazioni_etf', {
          p_isin: fonte.isin,
          p_partecipazioni: estratto.partecipazioni.map((p) => ({
            nome: p.nome,
            ticker: p.ticker,
            isin_titolo: p.isinTitolo,
            cedola_pct: p.cedolaPct,
            scadenza: p.scadenza,
            peso_pct: p.peso,
          })),
        })
        if (errorePartecipazioni) {
          throw new Error(`Scrittura delle partecipazioni rifiutata dal database: ${errorePartecipazioni.message}`)
        }

        const { error } = await supabase.rpc('sostituisci_geografia_etf', {
          p_isin: fonte.isin,
          // Xtrackers non dichiara la data: il database accetta null, il tipo generato non lo sa.
          p_data_file: estratto.dataFile as string,
          p_somma_pesi_grezza: estratto.sommaPesiGrezza,
          p_messaggio: messaggio,
          p_pesi: estratto.pesi,
        })
        if (error) throw new Error(`Scrittura rifiutata dal database: ${error.message}`)
      }

      esiti.push({
        isin: fonte.isin,
        emittente: fonte.emittente,
        esito: 'ok',
        scritto: !soloProva,
        messaggio,
        dataFile: estratto.dataFile,
        sommaPesiGrezza: estratto.sommaPesiGrezza,
        righeTitoli: estratto.righeTitoli,
        paesiDistinti: voci.length,
        principaliPaesi: voci.slice(0, 5).map(([paese, peso]) => ({ paese, peso: arrotonda(peso, 2) })),
        regioni: [...pesiPerRegione.entries()]
          .map(([regione, peso]) => ({ regione, peso: arrotonda(peso, 2) }))
          .sort((a, b) => b.peso - a.peso),
        esclusi: estratto.esclusi,
        partecipazioniSalvate: estratto.partecipazioni.length,
        primePartecipazioni: estratto.partecipazioni.slice(0, 5).map((p) => ({ ...p, peso: arrotonda(p.peso, 2) })),
      })
    } catch (errore) {
      const messaggio = `errore: ${testoErrore(errore)}`
      if (!soloProva) {
        const { error } = await supabase
          .from('geografia_fonti')
          .update({ ultimo_tentativo: new Date().toISOString(), esito: 'errore', messaggio })
          .eq('isin', fonte.isin)
        if (error) console.error(`geografia_fonti: impossibile registrare l'errore di ${fonte.isin}`, error.message)
      }
      esiti.push({ isin: fonte.isin, emittente: fonte.emittente, esito: 'errore', scritto: false, messaggio })
    }
  }
  return esiti
}
