import messaggiIt from '@/messages/it.json'
import messaggiEn from '@/messages/en.json'
import { OPERAZIONE_DA_ETICHETTA } from './operazioni'

// Mappa l'etichetta italiana di ETICHETTA_OPERAZIONE (lib/operazioni.ts) alla
// chiave camelCase del namespace i18n "TipiOperazione" — per il rendering a
// schermo, per la cella Operazione dell'export Excel e, al contrario, per
// riconoscere l'etichetta tradotta nell'import (operazioneDaEtichettaExcel).
export const CHIAVE_TRADUZIONE_OPERAZIONE: Record<string, string> = {
  Acquisto: 'acquisto',
  Vendita: 'vendita',
  Dividendo: 'dividendo',
  Ricompensa: 'ricompensa',
  'Costo (in quote)': 'costoInQuote',
  'Costo (in contanti)': 'costoInContanti',
  'Scambio (cessione)': 'scambioCessione',
  'Scambio (acquisizione)': 'scambioAcquisizione',
}

// Traduce un'etichetta solo se è nella mappa: una non mappata resta com'è
// invece di finire in t() come chiave (MISSING_MESSAGE). t è il traduttore
// del namespace "TipiOperazione".
export function traduciOperazione(t: (chiave: string) => string, etichetta: string): string {
  const chiave = CHIAVE_TRADUZIONE_OPERAZIONE[etichetta]
  return chiave ? t(chiave) : etichetta
}

// Import Excel: etichetta in qualunque lingua (italiano o traduzione di
// TipiOperazione in messages/*.json, senza distinzione di maiuscole) → codice
// database. Tutte le lingue insieme, non solo quella dell'interfaccia, perché
// un file può essere stato esportato in un'altra lingua. Il codice si ricava
// sempre da OPERAZIONE_DA_ETICHETTA, quindi resta escluso ciò che l'import non
// ha mai accettato ("Costo (in contanti)").
const TIPI_OPERAZIONE_PER_LINGUA: Record<string, string>[] = [messaggiIt.TipiOperazione, messaggiEn.TipiOperazione]

const ETICHETTA_ITALIANA_DA_ETICHETTA = new Map<string, string>(
  Object.entries(CHIAVE_TRADUZIONE_OPERAZIONE).flatMap(([etichettaItaliana, chiave]) =>
    [etichettaItaliana, ...TIPI_OPERAZIONE_PER_LINGUA.map((messaggi) => messaggi[chiave])]
      .filter((etichetta): etichetta is string => !!etichetta)
      .map((etichetta) => [etichetta.toLowerCase(), etichettaItaliana] as const),
  ),
)

export function operazioneDaEtichettaExcel(etichetta: string): string | undefined {
  const etichettaItaliana = ETICHETTA_ITALIANA_DA_ETICHETTA.get(etichetta.trim().toLowerCase())
  return etichettaItaliana ? OPERAZIONE_DA_ETICHETTA[etichettaItaliana] : undefined
}
