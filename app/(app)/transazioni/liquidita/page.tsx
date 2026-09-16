import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from '../storico-movimenti-liquidita'

export default async function TransazioniLiquiditaPage() {
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: movimentiLiquiditaStoricoRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, categoria').order('nome'),
    supabase.from('contenitori').select('id, nome').order('nome'),
    supabase
      .from('movimenti_liquidita')
      .select('id, data, tipo_movimento, contenitore_id, importo, tassa_trattenuta, strumento_id')
      .order('data', { ascending: false }),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))

  const storicoMovimentiLiquidita: RigaStoricoMovimentoLiquidita[] = (movimentiLiquiditaStoricoRaw ?? []).map((m) => {
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

  return (
    <div>
      <Link href="/transazioni" style={{ fontSize: 13 }}>
        ← Nuova operazione
      </Link>
      <h1 style={{ marginTop: 12 }}>Transazioni Liquidità</h1>
      <StoricoMovimentiLiquidita movimenti={storicoMovimentiLiquidita} contenitori={contenitori ?? []} />
    </div>
  )
}