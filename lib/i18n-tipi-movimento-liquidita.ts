// Mappa il valore italiano di movimenti_liquidita.tipo_movimento alla chiave
// camelCase del namespace i18n "TipiMovimentoLiquidita" — per il rendering a
// schermo e per la cella Tipo movimento dell'export Excel. Il valore originale
// resta invariato ovunque serva per confronti/filtri (es.
// .eq('tipo_movimento', 'Interesse')).
export const CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA: Record<string, string> = {
  Versamento: 'versamento',
  Prelievo: 'prelievo',
  Interesse: 'interesse',
  Costo: 'costo',
}

// Traduce un tipo movimento solo se è nella mappa: uno non mappato resta com'è
// scritto nel database invece di finire in t() come chiave (MISSING_MESSAGE).
// t è il traduttore del namespace "TipiMovimentoLiquidita".
export function traduciTipoMovimentoLiquidita(t: (chiave: string) => string, tipo: string): string {
  const chiave = CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA[tipo]
  return chiave ? t(chiave) : tipo
}
