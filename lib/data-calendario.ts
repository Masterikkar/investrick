// Date "di calendario" (solo giorno, senza orario) come le salva il database:
// stringhe YYYY-MM-DD. Una data così non deve mai passare da un istante
// (Date + fuso orario): new Date('YYYY-MM-DD') è la mezzanotte UTC, e letta in
// ora locale, o riconvertita con toISOString, sposta il giorno di ±1 a seconda
// del fuso del browser o del server. Nessuna dipendenza: si usa ovunque.

export function componiDataIso(anno: number, mese: number, giorno: number): string {
  return `${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

export function giorniNelMese(anno: number, mese: number): number {
  if (mese === 2) return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(mese) ? 30 : 31
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Scompone una stringa YYYY-MM-DD, o null se non è una data valida. */
export function partiDataIso(iso: string): { anno: number; mese: number; giorno: number } | null {
  const m = iso.match(DATA_ISO)
  if (!m) return null
  const anno = Number(m[1])
  const mese = Number(m[2])
  const giorno = Number(m[3])
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > giorniNelMese(anno, mese)) return null
  return { anno, mese, giorno }
}

/**
 * YYYY-MM-DD → Date alla mezzanotte locale, solo per mostrarla o confrontarla
 * con altre date locali. new Date('YYYY-MM-DD') invece è la mezzanotte UTC,
 * che a ovest di Greenwich è ancora il giorno prima.
 */
export function dataLocaleDaIso(iso: string): Date | null {
  const parti = partiDataIso(iso)
  return parti ? new Date(parti.anno, parti.mese - 1, parti.giorno) : null
}

/** La data di oggi nel fuso di chi usa l'app, come YYYY-MM-DD. */
export function dataIsoOggi(): string {
  const oggi = new Date()
  return componiDataIso(oggi.getFullYear(), oggi.getMonth() + 1, oggi.getDate())
}
