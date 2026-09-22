import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { StoricoTransazioni, type RigaStoricoTransazione } from '../storico-transazioni'

export default async function TransazioniAssetPage() {
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: transazioniStoricoRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, ticker, categoria').order('categoria').order('nome'),
    supabase.from('contenitori').select('id, nome').order('nome'),
    supabase
      .from('transazioni')
      .select(
        'id, data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta, strumento_id'
      )
      .order('data', { ascending: false }),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))

  const storicoTransazioni: RigaStoricoTransazione[] = (transazioniStoricoRaw ?? []).map((t) => {
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

  return (
    <div>
      <RippleLink href="/gestione/transazioni" className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
        → Nuova transazione
      </RippleLink>

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>Analisi</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>Transazioni finanziarie</h1>

      <Sezione>
        <StoricoTransazioni transazioni={storicoTransazioni} contenitori={contenitori ?? []} />
      </Sezione>
    </div>
  )
}