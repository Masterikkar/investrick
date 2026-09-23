// Mappa l'etichetta italiana di ETICHETTA_OPERAZIONE (lib/operazioni.ts) alla
// chiave camelCase del namespace i18n "TipiOperazione" — solo per il
// rendering. ETICHETTA_OPERAZIONE stessa e la sua mappa inversa
// (OPERAZIONE_DA_ETICHETTA, usata per l'import/export Excel) restano
// invariate: il valore italiano è ancora quello scritto/letto nei file Excel.
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
