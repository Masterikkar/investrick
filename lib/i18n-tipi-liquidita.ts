// Mappa il valore italiano di tipo strumento di liquidità (letto a runtime
// dalla tabella tipi_strumento, non un enum fisso nel codice) alla chiave
// camelCase del namespace i18n "TipiLiquidita" — usata solo per il rendering;
// il valore originale resta invariato ovunque serva per confronti/filtri.
export const CHIAVE_TRADUZIONE_TIPO_LIQUIDITA: Record<string, string> = {
  Contanti: 'contanti',
  'Conto bancario': 'contoBancario',
  'Conto deposito non vincolato': 'contoDepositoNonVincolato',
  'Conto deposito vincolato': 'contoDepositoVincolato',
  'Libretto postale': 'librettoPostale',
}
