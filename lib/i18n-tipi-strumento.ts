// Mappa il valore di tipo strumento delle categorie di investimento (letto a
// runtime dalla tabella tipi_strumento, non un enum fisso nel codice) alla
// chiave camelCase del namespace i18n "TipiStrumento" — usata solo per il
// rendering; il valore originale resta invariato ovunque serva per
// confronti/filtri. I tipi della Liquidità hanno la loro mappa in
// lib/i18n-tipi-liquidita.ts.
export const CHIAVE_TRADUZIONE_TIPO_STRUMENTO: Record<string, string> = {
  Altcoin: 'altcoin',
  Bond: 'bond',
  BTC: 'btc',
  ETC: 'etc',
  ETF: 'etf',
  Fondo: 'fondo',
  Gestito: 'gestito',
  Share: 'share',
  Stablecoin: 'stablecoin',
  Token: 'token',
}

// Traduce un tipo solo se è nella mappa: un valore non mappato resta com'è
// scritto nel database invece di finire in t() come chiave (MISSING_MESSAGE).
// t è il traduttore del namespace "TipiStrumento".
export function traduciTipoStrumento(t: (chiave: string) => string, tipo: string): string {
  const chiave = CHIAVE_TRADUZIONE_TIPO_STRUMENTO[tipo]
  return chiave ? t(chiave) : tipo
}
