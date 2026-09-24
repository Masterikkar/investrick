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
