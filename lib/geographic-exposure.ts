import type { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { dataIsoOggi, partiDataIso } from '@/lib/data-calendario'
import type { LocaleFormato } from '@/lib/format'

// Esposizione geografica degli ETF: lettura dei dati salvati da lib/etf-geography.ts e loro
// aggregazione per macro-regione e paese. Logica unica, usata dalla pagina del PAC (una vista per
// categoria, pesata sul valore delle posizioni) e dalla pagina del singolo asset.
// Funzioni pure tranne caricaGeografiaEtf, che legge le tre tabelle condivise.

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

/** Macro-regione dei paesi che non sono nella mappa paesi_macro_regioni. */
export const REGIONE_ALTRO = 'Altro'

/** Oltre questi giorni dall'ultimo aggiornamento il dato di un ETF è "scaduto" e va segnalato. */
export const GIORNI_DATO_SCADUTO = 35

/** I paesi sotto questa % (sul totale mostrato) finiscono nella voce "Altri paesi" di ogni regione. */
export const SOGLIA_PAESE_PRINCIPALE_PCT = 0.5

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

export type GruppoRegione = {
  regione: string
  peso: number
  /** Paesi con peso almeno pari alla soglia, dal più pesante. */
  paesi: VocePaese[]
  /** Paesi sotto la soglia, dal più pesante: nella pagina stanno in "Altri paesi", espandibili. */
  altriPaesi: VocePaese[]
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
  regioni: GruppoRegione[]
  /** % del valore della categoria su cui è calcolata (le posizioni senza dati geografici restano fuori). */
  copertura: number
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
 * Raggruppa i paesi per macro-regione. I paesi che l'emittente scrive in modo diverso ma hanno lo
 * stesso codice ISO (es. "Czech Republic" e "Czechia") diventano una voce sola; quelli non nella mappa
 * vanno in "Altro". Regioni dalla più pesante ("Altro" sempre per ultima), paesi dal più pesante.
 */
export function raggruppaPerRegione(
  paesi: PesoPaese[],
  mappa: MappaPaesi,
  soglia: number = SOGLIA_PAESE_PRINCIPALE_PCT,
): GruppoRegione[] {
  const regioni = new Map<string, Map<string, VocePaese>>()
  for (const { paese, peso } of paesi) {
    const m = mappa.get(paese)
    const regione = m?.macroRegione ?? REGIONE_ALTRO
    const chiave = m?.codiceIso ?? `non mappato: ${paese}`
    const voci = regioni.get(regione) ?? new Map<string, VocePaese>()
    const esistente = voci.get(chiave)
    if (esistente) esistente.peso += peso
    else voci.set(chiave, { paese, codiceIso: m?.codiceIso ?? null, peso })
    regioni.set(regione, voci)
  }

  const gruppi: GruppoRegione[] = [...regioni.entries()].map(([regione, voci]) => {
    const ordinate = [...voci.values()].sort((a, b) => b.peso - a.peso)
    const principali = ordinate.filter((v) => v.peso >= soglia)
    const altri = ordinate.filter((v) => v.peso < soglia)
    // Una sola voce sotto soglia non fa risparmiare spazio: si mostra normalmente.
    if (altri.length === 1) principali.push(altri.pop()!)
    return {
      regione,
      peso: ordinate.reduce((somma, v) => somma + v.peso, 0),
      paesi: principali,
      altriPaesi: altri,
    }
  })

  return gruppi.sort((a, b) => {
    if (a.regione === REGIONE_ALTRO) return 1
    if (b.regione === REGIONE_ALTRO) return -1
    return b.peso - a.peso
  })
}

/**
 * Una vista per categoria, nell'ordine dato: per ogni categoria con almeno una posizione che ha dati
 * geografici, la media pesata sul valore delle posizioni coperte. Le categorie senza dati non compaiono.
 * La copertura dice su che parte del valore della categoria è calcolata.
 */
export function esposizionePerCategoria(
  posizioni: PosizioneGeografica[],
  geografie: Map<string, GeografiaEtf>,
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
    risultato.push({
      categoria,
      regioni: raggruppaPerRegione(paesi, mappa),
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

/** Vista del singolo ETF (pagina dell'asset): le sue regioni e l'unica fonte, senza etichetta. */
export function esposizioneSingoloEtf(
  geografia: GeografiaEtf,
  mappa: MappaPaesi,
): { regioni: GruppoRegione[]; fonti: FonteGeografia[] } {
  return {
    regioni: raggruppaPerRegione(geografia.paesi, mappa),
    fonti: [{ etichetta: null, dataAggiornamento: geografia.dataAggiornamento, scaduto: geografia.scaduto }],
  }
}

// ───────────────────────── Nomi ─────────────────────────

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
