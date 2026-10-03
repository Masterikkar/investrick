import type { createClient } from '@/lib/supabase/server'
import { CATEGORIE } from '@/lib/categorie'
import { leggiMembriPersonalizzati } from '@/lib/gruppi'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

// Categorie su cui si imposta il target di un gruppo. PAC e Polizze contengono
// solo posizioni di mercato: le 6 categorie di mercato, nell'ordine di sempre
// di questa pagina. Un gruppo Personalizzato può contenere anche conti di
// liquidità, quindi ha tutte e 7 le categorie, Liquidità compresa.
const CATEGORIE_GRUPPI_REALI: readonly string[] = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Crypto', 'Multiasset']

export function categorieTarget(tipoContenitore: string): readonly string[] {
  return tipoContenitore === 'Personalizzato' ? CATEGORIE : CATEGORIE_GRUPPI_REALI
}

// Gli strumenti tra cui si può ripartire il target di una categoria: per PAC
// e Polizze quelli posseduti nel contenitore, per un gruppo Personalizzato i
// suoi membri (da lib/gruppi.ts).
export async function strumentiDelGruppo(
  supabase: ClientSupabase,
  contenitoreId: string,
  tipoContenitore: string
): Promise<{ id: string; nome: string; ticker: string | null; categoria: string }[]> {
  if (tipoContenitore === 'Personalizzato') {
    return (await leggiMembriPersonalizzati(supabase, [contenitoreId])).strumenti
  }

  const { data: posizioni } = await supabase
    .from('v_riepilogo_posizione')
    .select('strumento_id, quantita_posseduta')
    .eq('contenitore_id', contenitoreId)

  const strumentoIdsPosseduti = (posizioni ?? [])
    .filter((p) => Number(p.quantita_posseduta) > 0)
    .map((p) => p.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumenti } = strumentoIdsPosseduti.length
    ? await supabase.from('strumenti').select('id, nome, ticker, categoria').in('id', strumentoIdsPosseduti)
    : { data: null }
  return strumenti ?? []
}
