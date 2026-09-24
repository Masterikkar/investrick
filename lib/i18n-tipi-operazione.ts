// Mappa l'etichetta italiana di ETICHETTA_OPERAZIONE (lib/operazioni.ts) alla
// chiave camelCase del namespace i18n "TipiOperazione" — per il rendering a
// schermo e per la cella Operazione dell'export Excel. ETICHETTA_OPERAZIONE
// stessa e la sua mappa inversa (OPERAZIONE_DA_ETICHETTA, usata dall'import
// Excel) restano invariate: l'import legge ancora solo l'etichetta italiana.
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
