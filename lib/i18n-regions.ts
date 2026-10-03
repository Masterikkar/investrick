// Mappa il nome italiano della macro-regione (quello salvato in paesi_macro_regioni.macro_regione,
// più "Altro" per i paesi non mappati) alla chiave camelCase del namespace i18n "Regioni" —
// stesso schema di lib/i18n-categorie.ts.
export const CHIAVE_TRADUZIONE_REGIONE: Record<string, string> = {
  'Nord America': 'nordAmerica',
  'America Latina': 'americaLatina',
  Europa: 'europa',
  'Asia-Pacifico': 'asiaPacifico',
  'Medio Oriente e Africa': 'medioOrienteAfrica',
  Altro: 'altro',
}

// Traduce una regione solo se è nella mappa: un valore non mappato resta com'è scritto
// invece di finire in t() come chiave (MISSING_MESSAGE). t è il traduttore del namespace "Regioni".
export function traduciRegione(t: (chiave: string) => string, regione: string): string {
  const chiave = CHIAVE_TRADUZIONE_REGIONE[regione]
  return chiave ? t(chiave) : regione
}
