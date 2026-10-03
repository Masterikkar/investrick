// Le categorie degli strumenti, nell'ordine canonico in cui l'app le mostra.
// Valori come in strumenti.categoria.
//
// - CATEGORIE: tutte e 7, Liquidità compresa — per visualizzazione, totali e
//   grafici, dove la liquidità è una categoria come le altre.
// - CATEGORIE_MERCATO: le 6 categorie di investimento, senza Liquidità — dove
//   conta solo il mercato: le transazioni finanziarie (la liquidità ha i suoi
//   movimenti, non transazioni) e le plus/minusvalenze.
export const CATEGORIE_MERCATO: readonly string[] = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto']

export const CATEGORIE: readonly string[] = [...CATEGORIE_MERCATO, 'Liquidita']
