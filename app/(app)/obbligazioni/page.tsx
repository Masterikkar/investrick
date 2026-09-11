import { createClient } from '@/lib/supabase/server'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'

const CATEGORIA = 'Obbligazioni'

const COLONNE: ColonnaTabella[] = [
  { key: 'nome', label: 'Strumento', kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
  { key: 'tipo', label: 'Tipo', kind: 'text' },
  { key: 'rendimentoPct', label: 'Rendimento', kind: 'percent-signed' },
  { key: 'rendimentoAssoluto', label: 'Rendimento (€)', kind: 'euro-signed' },
  { key: 'valore', label: 'Valore', kind: 'euro' },
  { key: 'peso', label: 'Peso', kind: 'percent' },
  { key: 'nav', label: 'NAV', kind: 'euro' },
  { key: 'prezzoMedioUnitario', label: 'Prezzo medio', kind: 'euro' },
  { key: 'costo', label: 'Costo', kind: 'euro' },
  { key: 'provenienza', label: 'Provenienza', kind: 'text' },
]

export default async function ObbligazioniPage() {
  const supabase = await createClient()

  const { data: categoriaValore } = await supabase
    .from('v_valore_per_categoria')
    .select('categoria, valore_totale')
    .eq('categoria', CATEGORIA)
    .maybeSingle()

  const valoreTotaleCategoria = categoriaValore?.valore_totale ?? 0

  const { data: strumentiCategoria } = await supabase
    .from('strumenti')
    .select('id, nome, tipo')
    .eq('categoria', CATEGORIA)

  const strumentoIds = strumentiCategoria?.map((s) => s.id) ?? []

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale'
        )
        .in('strumento_id', strumentoIds)
    : { data: null }

  const { data: costi } = strumentoIds.length
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, contenitore_id, costo_totale')
        .in('strumento_id', strumentoIds)
    : { data: null }

  const contenitoreIds = Array.from(
    new Set(
      (posizioni ?? [])
        .map((p) => p.contenitore_id)
        .filter((id): id is string => id !== null)
    )
  )

  const { data: contenitori } = contenitoreIds.length
    ? await supabase.from('contenitori').select('id, nome').in('id', contenitoreIds)
    : { data: null }

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p) => {
      const strumento = strumentiCategoria?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find(
        (c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id
      )
      const contenitore = p.contenitore_id
        ? contenitori?.find((c) => c.id === p.contenitore_id)
        : null
      return {
        key: `${p.strumento_id}-${p.contenitore_id ?? 'diretto'}`,
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        peso: valoreTotaleCategoria > 0 ? ((p.valore ?? 0) / valoreTotaleCategoria) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? 'Diretto',
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Categoria</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>{CATEGORIA}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valoreTotaleCategoria)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Asset</h2>
        <TabellaOrdinabile colonne={COLONNE} righe={righe} />
      </section>
    </div>
  )
}