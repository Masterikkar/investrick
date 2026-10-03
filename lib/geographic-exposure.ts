import type { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { dataIsoOggi, partiDataIso } from '@/lib/data-calendario'
import type { LocaleFormato } from '@/lib/format'

// Esposizione degli ETF: lettura dei dati salvati da lib/etf-geography.ts (distribuzione geografica e
// partecipazioni) e loro aggregazione. Logica unica, usata dalla pagina del PAC (una vista per categoria,
// pesata sul valore delle posizioni) e dalla pagina del singolo asset.
// Funzioni pure tranne caricaGeografiaEtf e caricaPartecipazioniEtf, che leggono le tabelle condivise.

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

/** Macro-regione dei paesi che non sono nella mappa paesi_macro_regioni. */
export const REGIONE_ALTRO = 'Altro'

/** Oltre questi giorni dall'ultimo aggiornamento il dato di un ETF è "scaduto" e va segnalato. */
export const GIORNI_DATO_SCADUTO = 35

/** Quanti paesi stanno nell'elenco; gli altri vanno nel blocco "Altri paesi". */
export const PAESI_IN_ELENCO = 10

/** Quante partecipazioni si mostrano. */
export const PARTECIPAZIONI_IN_ELENCO = 15

// ───────────────────────── Tipi ─────────────────────────

/** Nome del paese come lo scrive l'emittente → codice ISO e macro-regione. */
export type MappaPaesi = Map<string, { codiceIso: string; macroRegione: string }>

export type PesoPaese = { paese: string; peso: number }

export type GeografiaEtf = {
  isin: string
  /** Data delle holdings (YYYY-MM-DD); per Xtrackers, che non la dichiara, il giorno dell'ultimo scarico riuscito. */
  dataAggiornamento: string | null
  scaduto: boolean
  /** % per paese, riportata a 100 sui soli titoli. */
  paesi: PesoPaese[]
}

export type VocePaese = { paese: string; codiceIso: string | null; peso: number }

export type VoceRegione = { regione: string; peso: number }

export type RiepilogoGeografico = {
  /** Peso per macro-regione, dalla più pesante ("Altro" sempre per ultima). */
  regioni: VoceRegione[]
  /** I paesi più pesanti (al massimo PAESI_IN_ELENCO), dal più pesante. */
  paesi: VocePaese[]
  /** Tutti gli altri paesi, dal più pesante: nella pagina stanno in "Altri paesi", espandibili. */
  altriPaesi: VocePaese[]
}

/** Una posizione di un ETF (azione o obbligazione), con il peso in % sui titoli. */
export type Partecipazione = {
  nome: string
  ticker: string | null
  /** ISIN del titolo, quando il file dell'emittente lo dichiara (Xtrackers). */
  isinTitolo: string | null
  /** Solo obbligazioni iShares. */
  cedolaPct: number | null
  /** Solo obbligazioni iShares (YYYY-MM-DD). */
  scadenza: string | null
  peso: number
}

/** Partecipazioni salvate di ogni ETF, per ISIN, dalla più pesante. */
export type PartecipazioniPerIsin = Map<string, Partecipazione[]>

export type ElencoPartecipazioni = {
  /** Le prime PARTECIPAZIONI_IN_ELENCO, dalla più pesante. */
  voci: Partecipazione[]
  /** Somma dei pesi delle voci mostrate, in % del totale dei titoli. */
  pesoVoci: number
}

export type FonteGeografia = {
  /** Ticker (o nome) dell'ETF; null quando la vista riguarda un solo ETF e l'etichetta sarebbe ridondante. */
  etichetta: string | null
  dataAggiornamento: string | null
  scaduto: boolean
}

export type PosizioneGeografica = {
  strumentoId: string
  nome: string
  ticker: string | null
  isin: string | null
  categoria: string
  valore: number
}

export type EsposizioneCategoria = {
  categoria: string
  geografia: RiepilogoGeografico
  /** null se nessun ETF della categoria ha partecipazioni salvate. */
  partecipazioni: ElencoPartecipazioni | null
  /** % del valore della categoria su cui è calcolata (le posizioni senza dati geografici restano fuori). */
  copertura: number
  fonti: FonteGeografia[]
}

export type EsposizioneEtf = {
  geografia: RiepilogoGeografico
  partecipazioni: ElencoPartecipazioni | null
  fonti: FonteGeografia[]
}

// ───────────────────────── Calcolo ─────────────────────────

/**
 * Media delle geografie di più ETF pesata sul loro valore: la % di ogni paese è
 * somma(valore_i × %paese_i) / somma(valore_i). Una geografia sola dà la stessa geografia.
 */
export function combinaGeografie(componenti: { peso: number; paesi: PesoPaese[] }[]): PesoPaese[] {
  const totale = componenti.reduce((somma, c) => somma + c.peso, 0)
  if (totale <= 0) return []
  const somme = new Map<string, number>()
  for (const c of componenti) {
    for (const p of c.paesi) {
      somme.set(p.paese, (somme.get(p.paese) ?? 0) + (c.peso / totale) * p.peso)
    }
  }
  return [...somme.entries()].map(([paese, peso]) => ({ paese, peso }))
}

/**
 * Riepilogo geografico: peso per macro-regione e elenco dei paesi.
 * I paesi che l'emittente scrive in modo diverso ma hanno lo stesso codice ISO (es. "Czech Republic" e
 * "Czechia") diventano una voce sola; quelli non nella mappa vanno nella regione "Altro", sempre ultima.
 * I paesi sono ordinati per peso (a pari peso per nome, così l'ordine non dipende dai dati in ingresso);
 * i primi `inElenco` stanno in `paesi`, il resto in `altriPaesi`.
 */
export function riepilogaGeografia(
  paesi: PesoPaese[],
  mappa: MappaPaesi,
  inElenco: number = PAESI_IN_ELENCO,
): RiepilogoGeografico {
  const pesiRegione = new Map<string, number>()
  const voci = new Map<string, VocePaese>()
  for (const { paese, peso } of paesi) {
    const m = mappa.get(paese)
    const regione = m?.macroRegione ?? REGIONE_ALTRO
    pesiRegione.set(regione, (pesiRegione.get(regione) ?? 0) + peso)
    const chiave = m?.codiceIso ?? `non mappato: ${paese}`
    const esistente = voci.get(chiave)
    if (esistente) esistente.peso += peso
    else voci.set(chiave, { paese, codiceIso: m?.codiceIso ?? null, peso })
  }

  const regioni = [...pesiRegione.entries()]
    .map(([regione, peso]) => ({ regione, peso }))
    .sort((a, b) => {
      if (a.regione === REGIONE_ALTRO) return 1
      if (b.regione === REGIONE_ALTRO) return -1
      return b.peso - a.peso || a.regione.localeCompare(b.regione)
    })

  const ordinati = [...voci.values()].sort((a, b) => b.peso - a.peso || a.paese.localeCompare(b.paese))
  return { regioni, paesi: ordinati.slice(0, inElenco), altriPaesi: ordinati.slice(inElenco) }
}

/**
 * Identità di una partecipazione per sommare lo stesso titolo presente in più ETF: l'ISIN del titolo se
 * il file lo dichiara, altrimenti nome, ticker, cedola e scadenza (due BTP con lo stesso nome ma scadenza
 * diversa sono titoli diversi).
 */
export function chiavePartecipazione(p: Partecipazione): string {
  if (p.isinTitolo) return `isin:${p.isinTitolo.trim().toUpperCase()}`
  return [
    'titolo',
    p.nome.replace(/\s+/g, ' ').trim().toUpperCase(),
    p.ticker?.trim().toUpperCase() ?? '',
    p.cedolaPct ?? '',
    p.scadenza ?? '',
  ].join('|')
}

/**
 * Media delle partecipazioni di più ETF pesata sul loro valore (come la geografia): il peso di ogni titolo
 * è somma(valore_i × %titolo_i) / somma(valore_i), con lo stesso titolo sommato tra gli ETF.
 * Restituisce le prime `quante`, dalla più pesante; null se non c'è nessun dato.
 * Gli ETF salvano solo le loro prime posizioni: un titolo molto piccolo in un ETF può mancare, con un
 * errore trascurabile sulle posizioni in cima.
 */
export function combinaPartecipazioni(
  componenti: { peso: number; partecipazioni: Partecipazione[] }[],
  quante: number = PARTECIPAZIONI_IN_ELENCO,
): ElencoPartecipazioni | null {
  const totale = componenti.reduce((somma, c) => somma + c.peso, 0)
  if (totale <= 0) return null
  const titoli = new Map<string, Partecipazione>()
  for (const c of componenti) {
    for (const p of c.partecipazioni) {
      const contributo = (c.peso / totale) * p.peso
      const chiave = chiavePartecipazione(p)
      const esistente = titoli.get(chiave)
      if (esistente) {
        esistente.peso += contributo
        esistente.ticker ??= p.ticker
        esistente.isinTitolo ??= p.isinTitolo
      } else {
        titoli.set(chiave, { ...p, peso: contributo })
      }
    }
  }
  const voci = [...titoli.values()]
    .sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome))
    .slice(0, quante)
  if (voci.length === 0) return null
  return { voci, pesoVoci: voci.reduce((somma, v) => somma + v.peso, 0) }
}

/**
 * Una vista per categoria, nell'ordine dato: per ogni categoria con almeno una posizione che ha dati
 * geografici, la media pesata sul valore delle posizioni coperte. Le categorie senza dati non compaiono.
 * La copertura dice su che parte del valore della categoria è calcolata la geografia; le partecipazioni
 * sono calcolate sulle posizioni che hanno partecipazioni salvate.
 */
export function esposizionePerCategoria(
  posizioni: PosizioneGeografica[],
  geografie: Map<string, GeografiaEtf>,
  partecipazioni: PartecipazioniPerIsin,
  mappa: MappaPaesi,
  ordineCategorie: readonly string[],
): EsposizioneCategoria[] {
  const risultato: EsposizioneCategoria[] = []
  for (const categoria of ordineCategorie) {
    const dellaCategoria = posizioni.filter((p) => p.categoria === categoria && p.valore > 0)
    const valoreCategoria = dellaCategoria.reduce((somma, p) => somma + p.valore, 0)
    const coperte = dellaCategoria.filter((p) => p.isin !== null && geografie.has(p.isin))
    const valoreCoperto = coperte.reduce((somma, p) => somma + p.valore, 0)
    if (valoreCoperto <= 0) continue

    const paesi = combinaGeografie(coperte.map((p) => ({ peso: p.valore, paesi: geografie.get(p.isin!)!.paesi })))
    const conPartecipazioni = dellaCategoria.filter((p) => p.isin !== null && partecipazioni.has(p.isin))
    risultato.push({
      categoria,
      geografia: riepilogaGeografia(paesi, mappa),
      partecipazioni: combinaPartecipazioni(
        conPartecipazioni.map((p) => ({ peso: p.valore, partecipazioni: partecipazioni.get(p.isin!)! })),
      ),
      copertura: (valoreCoperto / valoreCategoria) * 100,
      fonti: coperte
        .slice()
        .sort((a, b) => b.valore - a.valore)
        .map((p) => {
          const g = geografie.get(p.isin!)!
          return { etichetta: p.ticker ?? p.nome, dataAggiornamento: g.dataAggiornamento, scaduto: g.scaduto }
        }),
    })
  }
  return risultato
}

/** Vista del singolo ETF (pagina dell'asset): la sua geografia, le sue partecipazioni e l'unica fonte, senza etichetta. */
export function esposizioneSingoloEtf(
  geografia: GeografiaEtf,
  partecipazioni: Partecipazione[] | undefined,
  mappa: MappaPaesi,
): EsposizioneEtf {
  return {
    geografia: riepilogaGeografia(geografia.paesi, mappa),
    partecipazioni: partecipazioni ? combinaPartecipazioni([{ peso: 1, partecipazioni }]) : null,
    fonti: [{ etichetta: null, dataAggiornamento: geografia.dataAggiornamento, scaduto: geografia.scaduto }],
  }
}

// ───────────────────────── Nomi ─────────────────────────

/**
 * Nome di un titolo con la prima lettera maiuscola di ogni parola (i file degli emittenti lo scrivono
 * tutto in maiuscolo): "ALPHABET INC CLASS A" → "Alphabet Inc Class A". La maiuscola segue anche - / ( & . ,
 * ("COCA-COLA" → "Coca-Cola", "S.A." → "S.A."), una sigla come "3M" resta "3M" e una lettera con
 * apostrofo ("L'OREAL") dà "L'Oreal"; "MCDONALD'S" resta "Mcdonald's".
 * Le sigle ("ASML", "NV") diventano "Asml", "Nv": la regola non le riconosce.
 */
export function nomeTitoloLeggibile(nome: string): string {
  return nome
    .toLocaleLowerCase('it')
    .replace(/(^|[\s\-/(&.,])(\d+)?(\p{L})/gu, (_, separatore: string, cifre: string | undefined, lettera: string) =>
      `${separatore}${cifre ?? ''}${lettera.toLocaleUpperCase('it')}`,
    )
    .replace(/\b(\p{L})'(\p{L})/gu, (_, prima: string, dopo: string) => `${prima}'${dopo.toLocaleUpperCase('it')}`)
}

/** Nome del paese nella lingua dell'interfaccia, dal codice ISO; se non c'è, il nome scritto dall'emittente. */
export function nomePaese(codiceIso: string | null, nomeNelFile: string, locale: LocaleFormato): string {
  if (!codiceIso) return nomeNelFile
  try {
    return new Intl.DisplayNames([locale === 'en' ? 'en-GB' : 'it-IT'], { type: 'region', fallback: 'none' }).of(codiceIso) ?? nomeNelFile
  } catch {
    return nomeNelFile
  }
}

// ───────────────────────── Lettura ─────────────────────────

function giorniTra(daIso: string, aIso: string): number {
  const da = partiDataIso(daIso)
  const a = partiDataIso(aIso)
  if (!da || !a) return 0
  return Math.round((Date.UTC(a.anno, a.mese - 1, a.giorno) - Date.UTC(da.anno, da.mese - 1, da.giorno)) / 86_400_000)
}

/**
 * Legge le geografie salvate degli ETF indicati (per ISIN) e la mappa dei paesi.
 * Gli ISIN senza dati (fondi, oro, ETF senza fonte) semplicemente non compaiono nel risultato.
 * Le tre tabelle sono condivise e in sola lettura per gli utenti autenticati.
 */
export async function caricaGeografiaEtf(
  supabase: ClientSupabase,
  isins: string[],
): Promise<{ perIsin: Map<string, GeografiaEtf>; mappa: MappaPaesi }> {
  const perIsin = new Map<string, GeografiaEtf>()
  const mappa: MappaPaesi = new Map()
  const richiesti = Array.from(new Set(isins.filter((isin) => isin.length > 0)))
  if (richiesti.length === 0) return { perIsin, mappa }

  const [{ data: fonti }, { data: righe }, { data: paesiMappati }] = await Promise.all([
    supabase
      .from('geografia_fonti')
      .select('isin, data_file, ultimo_successo')
      .in('isin', richiesti)
      .not('ultimo_successo', 'is', null),
    tutteLeRighe((da, a) =>
      supabase
        .from('geografia_etf')
        .select('isin, paese, peso_pct')
        .in('isin', richiesti)
        .order('isin', { ascending: true })
        .order('paese', { ascending: true })
        .range(da, a)
    ),
    tutteLeRighe((da, a) =>
      supabase
        .from('paesi_macro_regioni')
        .select('nome_nel_file, codice_iso, macro_regione')
        .order('nome_nel_file', { ascending: true })
        .range(da, a)
    ),
  ])

  for (const p of paesiMappati ?? []) {
    mappa.set(p.nome_nel_file, { codiceIso: p.codice_iso, macroRegione: p.macro_regione })
  }

  const paesiPerIsin = new Map<string, PesoPaese[]>()
  for (const r of righe ?? []) {
    const lista = paesiPerIsin.get(r.isin) ?? []
    lista.push({ paese: r.paese, peso: Number(r.peso_pct) })
    paesiPerIsin.set(r.isin, lista)
  }

  const oggi = dataIsoOggi()
  for (const f of fonti ?? []) {
    const paesi = paesiPerIsin.get(f.isin)
    if (!paesi || paesi.length === 0) continue
    // Xtrackers non dichiara la data delle holdings: vale il giorno dell'ultimo scarico riuscito (UTC).
    const dataAggiornamento = f.data_file ?? f.ultimo_successo?.slice(0, 10) ?? null
    perIsin.set(f.isin, {
      isin: f.isin,
      dataAggiornamento,
      scaduto: dataAggiornamento !== null && giorniTra(dataAggiornamento, oggi) > GIORNI_DATO_SCADUTO,
      paesi,
    })
  }
  return { perIsin, mappa }
}

/**
 * Legge le partecipazioni salvate degli ETF indicati (per ISIN), dalla più pesante.
 * Gli ISIN senza dati semplicemente non compaiono nel risultato. Tabella condivisa, in sola lettura.
 */
export async function caricaPartecipazioniEtf(
  supabase: ClientSupabase,
  isins: string[],
): Promise<PartecipazioniPerIsin> {
  const perIsin: PartecipazioniPerIsin = new Map()
  const richiesti = Array.from(new Set(isins.filter((isin) => isin.length > 0)))
  if (richiesti.length === 0) return perIsin

  const { data: righe } = await tutteLeRighe((da, a) =>
    supabase
      .from('partecipazioni_etf')
      .select('isin, posizione, nome, ticker, isin_titolo, cedola_pct, scadenza, peso_pct')
      .in('isin', richiesti)
      .order('isin', { ascending: true })
      .order('posizione', { ascending: true })
      .range(da, a)
  )

  for (const r of righe ?? []) {
    const lista = perIsin.get(r.isin) ?? []
    lista.push({
      nome: r.nome,
      ticker: r.ticker,
      isinTitolo: r.isin_titolo,
      cedolaPct: r.cedola_pct === null ? null : Number(r.cedola_pct),
      scadenza: r.scadenza,
      peso: Number(r.peso_pct),
    })
    perIsin.set(r.isin, lista)
  }
  return perIsin
}
