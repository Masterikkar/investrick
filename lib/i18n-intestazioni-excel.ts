import type { LocaleFormato } from './format'

// Intestazioni delle colonne dei file Excel di transazioni, nell'ordine in cui
// vengono scritte. Il nome italiano è quello canonico: è la chiave delle righe
// restituite da esportaTransazioniFinanziarie/esportaTransazioniLiquidita ed è
// ciò che l'import legge oggi.
export const COLONNE_EXCEL_FINANZIARIE = [
  'Data',
  'ISIN',
  'Ticker',
  'Strumento',
  'Operazione',
  'Quantità',
  'Prezzo unitario',
  'Commissione',
  'Tassa trattenuta',
  'Contenitore',
] as const

export const COLONNE_EXCEL_LIQUIDITA = [
  'Data',
  'Strumento',
  'Tipo movimento',
  'Importo',
  'Tassa trattenuta',
  'Contenitore',
] as const

export type ColonnaExcelFinanziaria = (typeof COLONNE_EXCEL_FINANZIARIE)[number]
export type ColonnaExcelLiquidita = (typeof COLONNE_EXCEL_LIQUIDITA)[number]
export type ColonnaExcel = ColonnaExcelFinanziaria | ColonnaExcelLiquidita

// Le traduzioni stanno qui e non in messages/*.json perché servono in entrambe
// le direzioni e per tutte le lingue insieme: l'export scrive l'intestazione
// della lingua corrente, l'import dovrà riconoscere un file scritto in
// qualunque lingua, anche diversa da quella dell'interfaccia.
export const INTESTAZIONI_EXCEL: Record<ColonnaExcel, Record<LocaleFormato, string>> = {
  Data: { it: 'Data', en: 'Date' },
  ISIN: { it: 'ISIN', en: 'ISIN' },
  Ticker: { it: 'Ticker', en: 'Ticker' },
  Strumento: { it: 'Strumento', en: 'Instrument' },
  Operazione: { it: 'Operazione', en: 'Operation' },
  Quantità: { it: 'Quantità', en: 'Quantity' },
  'Prezzo unitario': { it: 'Prezzo unitario', en: 'Unit price' },
  Commissione: { it: 'Commissione', en: 'Fee' },
  'Tassa trattenuta': { it: 'Tassa trattenuta', en: 'Withheld tax' },
  Contenitore: { it: 'Contenitore', en: 'Container' },
  'Tipo movimento': { it: 'Tipo movimento', en: 'Movement type' },
  Importo: { it: 'Importo', en: 'Amount' },
}

// Colonna canonica → intestazione nella lingua indicata.
export function intestazioneExcel(colonna: ColonnaExcel, locale: LocaleFormato): string {
  return INTESTAZIONI_EXCEL[colonna][locale]
}

// Direzione inversa: intestazione letta da un file (in qualunque lingua,
// senza distinzione di maiuscole e spazi ai bordi) → colonna canonica, o null
// se non corrisponde a nessuna colonna nota.
const COLONNA_DA_INTESTAZIONE = new Map<string, ColonnaExcel>(
  (Object.entries(INTESTAZIONI_EXCEL) as [ColonnaExcel, Record<LocaleFormato, string>][]).flatMap(([colonna, traduzioni]) =>
    Object.values(traduzioni).map((intestazione) => [intestazione.toLowerCase(), colonna] as const),
  ),
)

export function colonnaDaIntestazioneExcel(intestazione: string): ColonnaExcel | null {
  return COLONNA_DA_INTESTAZIONE.get(intestazione.trim().toLowerCase()) ?? null
}

// Risolve la riga di intestazione di un file importato. Per ogni colonna
// riconosciuta restituisce l'intestazione così com'è scritta nel file (la
// chiave delle righe di XLSX.utils.sheet_to_json). Le celle di intestazione
// vuote sono ignorate; sono invece segnalate le intestazioni che non
// corrispondono a nessuna colonna di questo tipo di file (in nessuna lingua)
// e le colonne presenti più di una volta (es. "Data" e "Date").
export function risolviIntestazioniExcel<C extends ColonnaExcel>(
  intestazioni: unknown[],
  colonneAmmesse: readonly C[],
): { intestazionePerColonna: Map<C, string>; sconosciute: string[]; duplicate: string[] } {
  const intestazionePerColonna = new Map<C, string>()
  const sconosciute: string[] = []
  const duplicate: string[] = []
  for (const cella of intestazioni) {
    const intestazione = String(cella ?? '')
    if (intestazione.trim() === '') continue
    const colonna = colonnaDaIntestazioneExcel(intestazione)
    if (!colonna || !(colonneAmmesse as readonly ColonnaExcel[]).includes(colonna)) sconosciute.push(intestazione.trim())
    else if (intestazionePerColonna.has(colonna as C)) duplicate.push(intestazione.trim())
    else intestazionePerColonna.set(colonna as C, intestazione)
  }
  return { intestazionePerColonna, sconosciute, duplicate }
}

// Valore della colonna Contenitore per le posizioni senza contenitore. L'export
// scrive ancora sempre la forma italiana; l'import le accetta tutte.
export const CONTENITORE_DIRETTO_EXCEL: Record<LocaleFormato, string> = { it: 'Diretto', en: 'Direct' }

const VALORI_CONTENITORE_DIRETTO = new Set(Object.values(CONTENITORE_DIRETTO_EXCEL).map((v) => v.toLowerCase()))

export function isContenitoreDirettoExcel(valore: string): boolean {
  return VALORI_CONTENITORE_DIRETTO.has(valore.trim().toLowerCase())
}

// Template vuoti scaricabili dalla pagina Importa, uno per lingua. Le versioni
// non italiane sono generate da scripts/genera-template-excel.mjs a partire da
// quella italiana, con le intestazioni di INTESTAZIONI_EXCEL.
export const TEMPLATE_EXCEL: Record<'finanziarie' | 'liquidita', Record<LocaleFormato, string>> = {
  finanziarie: { it: '/template-transazioni.xlsx', en: '/template-transazioni-en.xlsx' },
  liquidita: { it: '/template-transazioni-liquidita.xlsx', en: '/template-transazioni-liquidita-en.xlsx' },
}
