import { createClient } from '@/lib/supabase/server'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from './storico-movimenti-liquidita'

type Strumento = { id: string; nome: string }
type Gruppo = { id: string; nome: string; tipo: string }

// Tabella dei movimenti di liquidità (le righe le legge qui: la pagina carica
// solo la tabella scelta nel selettore).
export async function ElencoMovimentiLiquidita({
  strumenti,
  contenitori,
}: {
  strumenti: Strumento[]
  contenitori: Gruppo[]
}) {
  const supabase = await createClient()

  const { data: movimentiRaw } = await supabase
    .from('movimenti_liquidita')
    .select('id, data, tipo_movimento, contenitore_id, importo, tassa_trattenuta, strumento_id')
    .order('data', { ascending: false })

  const strumentoMap = new Map(strumenti.map((s) => [s.id, s]))

  const righe: RigaStoricoMovimentoLiquidita[] = (movimentiRaw ?? []).map((m) => {
    const strumento = strumentoMap.get(m.strumento_id)
    return {
      id: m.id,
      data: m.data,
      tipo_movimento: m.tipo_movimento,
      contenitore_id: m.contenitore_id,
      importo: Number(m.importo),
      tassa_trattenuta: Number(m.tassa_trattenuta),
      strumento_id: m.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
    }
  })

  return <StoricoMovimentiLiquidita movimenti={righe} contenitori={contenitori} />
}
