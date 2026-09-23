// Mappa il valore italiano di movimenti_liquidita.tipo_movimento alla chiave
// camelCase del namespace i18n "TipiMovimentoLiquidita" — solo per il
// rendering. Il valore originale resta invariato ovunque serva per
// confronti/filtri (es. .eq('tipo_movimento', 'Interesse')).
export const CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA: Record<string, string> = {
  Versamento: 'versamento',
  Prelievo: 'prelievo',
  Interesse: 'interesse',
  Costo: 'costo',
}
