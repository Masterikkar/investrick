import type { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'

// Parte del capitale investito che viene da ricompense (cashback in quote):
// per ogni posizione, i lotti FIFO residui nati da una transazione Ricompensa,
// valutati al prezzo registrato (quote residue × prezzo del lotto). È la R di
// "di cui da ricompense" e di "Capitale proprio investito = capitale − R".
// Stessi lotti di v_capitale_investito, quindi R è sempre una parte del
// capitale investito della posizione.

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

export type RicompensaResidua = { strumentoId: string; contenitoreId: string | null; importo: number }

export async function caricaRicompenseResidue(supabase: ClientSupabase): Promise<RicompensaResidua[]> {
  const { data: transazioni } = await tutteLeRighe((da, a) =>
    supabase
      .from('transazioni')
      .select('id, strumento_id')
      .eq('operazione', 'Ricompensa')
      .order('id', { ascending: true })
      .range(da, a)
  )
  const idsRicompense = new Set((transazioni ?? []).map((t) => t.id))
  const strumentoIds = Array.from(new Set((transazioni ?? []).map((t) => t.strumento_id)))
  if (strumentoIds.length === 0) return []

  // Lotti residui degli strumenti con ricompense; si tengono solo quelli nati
  // da una Ricompensa.
  const { data: lotti } = await tutteLeRighe((da, a) =>
    supabase
      .from('v_lotti_residui')
      .select('acquisto_id, strumento_id, contenitore_id, quantita_residua, prezzo_acquisto')
      .in('strumento_id', strumentoIds)
      .order('acquisto_id', { ascending: true })
      .range(da, a)
  )

  const perPosizione = new Map<string, RicompensaResidua>()
  for (const l of lotti ?? []) {
    if (!l.acquisto_id || !l.strumento_id || !idsRicompense.has(l.acquisto_id)) continue
    const importo = Number(l.quantita_residua ?? 0) * Number(l.prezzo_acquisto ?? 0)
    const chiave = `${l.strumento_id}|${l.contenitore_id ?? ''}`
    const voce = perPosizione.get(chiave) ?? { strumentoId: l.strumento_id, contenitoreId: l.contenitore_id, importo: 0 }
    voce.importo += importo
    perPosizione.set(chiave, voce)
  }
  return Array.from(perPosizione.values())
}

// R di una posizione (strumento + contenitore; contenitore null = diretta).
export function ricompensePosizione(
  ricompense: RicompensaResidua[],
  strumentoId: string | null,
  contenitoreId: string | null
): number {
  return ricompense
    .filter((r) => r.strumentoId === strumentoId && r.contenitoreId === contenitoreId)
    .reduce((s, r) => s + r.importo, 0)
}

// R di uno strumento su tutti i suoi contenitori.
export function ricompenseStrumento(ricompense: RicompensaResidua[], strumentoId: string): number {
  return ricompense.filter((r) => r.strumentoId === strumentoId).reduce((s, r) => s + r.importo, 0)
}
