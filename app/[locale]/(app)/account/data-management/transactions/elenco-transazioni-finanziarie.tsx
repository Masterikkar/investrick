import { createClient } from '@/lib/supabase/server'
import { StoricoTransazioni, type RigaStoricoTransazione } from './storico-transazioni'

type Strumento = { id: string; nome: string; ticker: string | null }
type Gruppo = { id: string; nome: string; tipo: string }

// Tabella delle transazioni finanziarie (le righe le legge qui: la pagina
// carica solo la tabella scelta nel selettore).
export async function ElencoTransazioniFinanziarie({
  strumenti,
  contenitori,
}: {
  strumenti: Strumento[]
  contenitori: Gruppo[]
}) {
  const supabase = await createClient()

  const { data: transazioniRaw } = await supabase
    .from('transazioni')
    .select('id, data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta, strumento_id')
    .order('data', { ascending: false })

  const strumentoMap = new Map(strumenti.map((s) => [s.id, s]))

  const righe: RigaStoricoTransazione[] = (transazioniRaw ?? []).map((t) => {
    const strumento = t.strumento_id ? strumentoMap.get(t.strumento_id) : undefined
    return {
      id: t.id,
      data: t.data,
      operazione: t.operazione,
      contenitore_id: t.contenitore_id,
      quantita: Number(t.quantita),
      prezzo_unitario: Number(t.prezzo_unitario),
      commissione: Number(t.commissione),
      tassa_trattenuta: Number(t.tassa_trattenuta),
      strumento_id: t.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
      strumento_ticker: strumento?.ticker ?? null,
    }
  })

  return <StoricoTransazioni transazioni={righe} contenitori={contenitori} />
}
