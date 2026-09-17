import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'

const CATEGORIA = 'Monetario'

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

export default async function MonetarioPage() {
  const supabase = await createClient()

  const { data: categoriaValore } = await supabase
    .from('v_valore_per_categoria')
    .select('categoria, valore_totale')
    .eq('categoria', CATEGORIA)
    .maybeSingle()

  const valoreTotaleCategoria = categoriaValore?.valore_totale ?? 0

  const { data: storicoRaw } = await supabase
    .from('v_storico_valorizzazioni_per_categoria')
    .select('data, valore_totale, capitale_investito_totale')
    .eq('categoria', CATEGORIA)
    .order('data', { ascending: true })

  const storicoValoreMap = new Map<string, number>()
  const storicoCapitaleMap = new Map<string, number>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    storicoValoreMap.set(r.data, Number(r.valore_totale))
    if (r.capitale_investito_totale != null) {
      storicoCapitaleMap.set(r.data, Number(r.capitale_investito_totale))
    }
  }

  const puntiRendimento: PuntoStorico[] = Array.from(storicoValoreMap.entries())
    .map(([data, valore]) => {
      const capitale = storicoCapitaleMap.get(data)
      if (!capitale || capitale <= 0) return null
      return { data, valore: ((valore - capitale) / capitale) * 100 }
    })
    .filter((p): p is PuntoStorico => p !== null)
    .sort((a, b) => a.data.localeCompare(b.data))

  const { data: strumentiCategoria } = await supabase
    .from('strumenti')
    .select('id, nome, tipo')
    .eq('categoria', CATEGORIA)

  const strumentoIds = strumentiCategoria?.map((s) => s.id) ?? []

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta'
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
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        peso: valoreTotaleCategoria > 0 ? ((p.valore ?? 0) / valoreTotaleCategoria) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? 'Diretto',
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  const costoTotaleCategoria = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + (r.valore as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const plusMinusNonRealizzata = valoreTotalePosizioni - capitaleInvestitoTotale
  const rendimentoPctTotale =
    capitaleInvestitoTotale > 0 ? (plusMinusNonRealizzata / capitaleInvestitoTotale) * 100 : null

  const rendimentoUltimoSnapshot =
    puntiRendimento.length > 0 ? puntiRendimento[puntiRendimento.length - 1].valore : null

  const variazioneDaUltimoSnapshot =
    rendimentoPctTotale != null && rendimentoUltimoSnapshot != null
      ? rendimentoPctTotale - rendimentoUltimoSnapshot
      : null

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Categoria</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{CATEGORIA}</h1>

      <section>
        <Sezione>
          <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotaleCategoria} />
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardRendimento
              rendimentoPct={rendimentoPctTotale}
              variazioneOggi={variazioneDaUltimoSnapshot}
              href="/rendimenti"
              linkLabel="Vedi dettaglio rendimenti →"
            />

            <CardMetrica label="Plus/minusvalenza non realizzata" href="/fiscalita" linkLabel="Vedi dettaglio fiscalità →">
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata)}
              </span>
            </CardMetrica>

            <CardMetrica label="Capitale investito netto" href="/transazioni" linkLabel="Vedi transazioni →">
              {formatEuro(capitaleInvestitoNettoTotale)}
            </CardMetrica>

            <CardMetrica label="Costo totale" href="/costi" linkLabel="Vedi dettaglio costi →">
              {formatEuro(costoTotaleCategoria)}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Asset</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} />
        </Sezione>
      </section>
    </div>
  )
}