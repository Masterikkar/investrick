// Mappa canonica tra i valori salvati nel database (transazioni.operazione)
// e le etichette mostrate/lette nell'interfaccia e nei file Excel.

export const ETICHETTA_OPERAZIONE: Record<string, string> = {
  Acquisto: 'Acquisto',
  Vendita: 'Vendita',
  Dividendo: 'Dividendo',
  Ricompensa: 'Ricompensa',
  Costo_quote: 'Costo (in quote)',
  Costo_contanti: 'Costo (in contanti)',
  Scambio_cessione: 'Scambio (cessione)',
  Scambio_acquisizione: 'Scambio (acquisizione)',
}

// Direzione inversa, per il parsing dell'import Excel. "Costo (in contanti)"
// è volutamente assente: quell'operazione si inserisce solo a mano, non è
// mai stata supportata dal file Excel.
export const OPERAZIONE_DA_ETICHETTA: Record<string, string> = {
  Acquisto: 'Acquisto',
  Vendita: 'Vendita',
  Dividendo: 'Dividendo',
  Ricompensa: 'Ricompensa',
  'Costo (in quote)': 'Costo_quote',
  'Scambio (cessione)': 'Scambio_cessione',
  'Scambio (acquisizione)': 'Scambio_acquisizione',
}