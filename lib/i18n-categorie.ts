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
