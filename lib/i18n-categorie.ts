// Mappa il valore italiano di categoria (quello usato per interrogare il
// database, es. strumenti.categoria) alla chiave camelCase del namespace i18n
// "Categorie" — usata ovunque un nome categoria vada mostrato a schermo mentre
// il valore sorgente resta dinamico (non un CATEGORIA costante di pagina).
export const CHIAVE_TRADUZIONE_CATEGORIA: Record<string, string> = {
  Azioni: 'azioni',
  Obbligazioni: 'obbligazioni',
  'Materie prime': 'materiePrime',
  Monetario: 'monetario',
  Multiasset: 'multiasset',
  Crypto: 'crypto',
}

// Traduce una categoria solo se è nella mappa: un valore non mappato resta
// com'è scritto nel database invece di finire in t() come chiave
// (MISSING_MESSAGE). t è il traduttore del namespace "Categorie".
export function traduciCategoria(t: (chiave: string) => string, categoria: string): string {
  const chiave = CHIAVE_TRADUZIONE_CATEGORIA[categoria]
  return chiave ? t(chiave) : categoria
}
