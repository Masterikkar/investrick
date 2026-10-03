// Normalizza un testo per la ricerca: minuscolo, senza accenti, apostrofi,
// trattini e barre come spazi. Deve restare identica alla normalizzazione con
// cui è stata riempita la colonna comuni.nome_ricerca (sql/applicati/
// 2026-09-30-comuni.sql).
export function normalizzaTestoRicerca(testo: string): string {
  return testo
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`\-/.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
