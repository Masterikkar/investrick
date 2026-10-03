import messaggiIt from '@/messages/it.json'
import messaggiEn from '@/messages/en.json'

// Mappa il valore italiano di movimenti_liquidita.tipo_movimento alla chiave
// camelCase del namespace i18n "TipiMovimentoLiquidita" — per il rendering a
// schermo e per la cella Tipo movimento dell'export Excel. Le sue chiavi sono
// anche l'elenco dei tipi accettati dall'import Excel. Il valore originale
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

// Import Excel: etichetta in qualunque lingua (valore italiano o traduzione di
// TipiMovimentoLiquidita in messages/*.json, senza distinzione di maiuscole) →
// valore database. Tutte le lingue insieme, non solo quella dell'interfaccia.
const TIPI_MOVIMENTO_PER_LINGUA: Record<string, string>[] = [messaggiIt.TipiMovimentoLiquidita, messaggiEn.TipiMovimentoLiquidita]

const TIPO_MOVIMENTO_DA_ETICHETTA = new Map<string, string>(
  Object.entries(CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA).flatMap(([tipo, chiave]) =>
    [tipo, ...TIPI_MOVIMENTO_PER_LINGUA.map((messaggi) => messaggi[chiave])]
      .filter((etichetta): etichetta is string => !!etichetta)
      .map((etichetta) => [etichetta.toLowerCase(), tipo] as const),
  ),
)

export function tipoMovimentoLiquiditaDaEtichettaExcel(etichetta: string): string | undefined {
  return TIPO_MOVIMENTO_DA_ETICHETTA.get(etichetta.trim().toLowerCase())
}
