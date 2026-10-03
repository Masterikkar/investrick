// Saldi di liquidità nel tempo. Lo storico ha una riga per conto solo nei
// giorni in cui il saldo è stato registrato (movimenti, e oggi); un saldo però
// vale finché non cambia. saldoRiportatoAllaData somma, per ogni conto,
// l'ultimo saldo noto alla data indicata (riporto in avanti), anche dopo
// l'ultima registrazione. Il riporto è per conto: due conti registrati in
// giorni diversi si sommano ciascuno col proprio ultimo saldo. Un conto senza
// registrazioni fino a quella data vale 0.
export type RigaSaldoStorico = { strumento_id: string | null; data: string | null; valore_totale: number | null }

export function serieSaldiPerConto(righe: RigaSaldoStorico[]): Map<string, { data: string; saldo: number }[]> {
  const perConto = new Map<string, { data: string; saldo: number }[]>()
  for (const r of righe) {
    if (!r.strumento_id || !r.data) continue
    const serie = perConto.get(r.strumento_id) ?? []
    serie.push({ data: r.data, saldo: Number(r.valore_totale ?? 0) })
    perConto.set(r.strumento_id, serie)
  }
  for (const serie of perConto.values()) serie.sort((a, b) => a.data.localeCompare(b.data))
  return perConto
}

export function saldoRiportatoAllaData(perConto: Map<string, { data: string; saldo: number }[]>, data: string): number {
  let totale = 0
  for (const serie of perConto.values()) {
    let ultimo = 0
    for (const punto of serie) {
      if (punto.data > data) break
      ultimo = punto.saldo
    }
    totale += ultimo
  }
  return totale
}
