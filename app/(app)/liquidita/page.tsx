import { createClient } from '@/lib/supabase/server'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'

const COLONNE: ColonnaTabella[] = [
  { key: 'nome', label: 'Strumento', kind: 'text' },
  { key: 'tipo', label: 'Tipo', kind: 'text' },
  { key: 'provider', label: 'Provider', kind: 'text' },
  { key: 'valore', label: 'Valore', kind: 'euro' },
  { key: 'tasso', label: 'Tasso', kind: 'percent' },
  { key: 'interessi', label: 'Interessi', kind: 'euro' },
  { key: 'costo', label: 'Costo', kind: 'euro' },
]

export default async function LiquiditaPage() {
  const supabase = await createClient()

  const { data: liquidita } = await supabase
    .from('v_valore_per_contenitore')
    .select('contenitore_id, nome, valore_totale')
    .eq('tipo', 'Liquidita')
    .maybeSingle()

  const contenitoreId = liquidita?.contenitore_id
  const valoreTotale = liquidita?.valore_totale ?? 0

  const { data: saldi } = contenitoreId
    ? await supabase
        .from('v_saldo_liquidita')
        .select('strumento_id, saldo_corrente')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const strumentoIds = (saldi ?? [])
    .map((s) => s.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumenti } = strumentoIds.length
    ? await supabase
        .from('strumenti')
        .select('id, nome, tipo, provider, tasso_percentuale')
        .in('id', strumentoIds)
    : { data: null }

  const { data: costi } = contenitoreId
    ? await supabase
        .from('v_costo_liquidita')
        .select('strumento_id, costo_totale')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: interessi } = contenitoreId
    ? await supabase
        .from('v_interessi_liquidita')
        .select('strumento_id, interessi_totali')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const righe: RigaTabella[] = (saldi ?? [])
    .map((s) => {
      const strumento = strumenti?.find((str) => str.id === s.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === s.strumento_id)
      const interesse = interessi?.find((i) => i.strumento_id === s.strumento_id)
      return {
        key: s.strumento_id ?? '—',
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        provider: strumento?.provider ?? '',
        valore: s.saldo_corrente ?? 0,
        tasso: strumento?.tasso_percentuale ?? 0,
        interessi: interesse?.interessi_totali ?? 0,
        costo: costo?.costo_totale ?? 0,
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Contenitore</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>
        {liquidita?.nome ?? 'Liquidità'}
      </h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valoreTotale)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Strumenti</h2>
        <TabellaOrdinabile colonne={COLONNE} righe={righe} />
      </section>
    </div>
  )
}