import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { RippleLink } from '@/components/ripple-link'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import type { SottoTarget } from '@/components/barre-sottocategoria'
import type { ContributoStrumento } from '@/components/barre-sottocategoria-rendimento'
import { AnalisiRendimento, type ContributoCategoria } from '@/components/analisi-rendimento'
import { AnalisiComposizione, type ScostamentoCategoria } from '@/components/analisi-composizione'

const COLONNE: ColonnaTabella[] = [
  { key: 'nome', label: 'Strumento', kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
  { key: 'tipo', label: 'Tipo', kind: 'text' },
  { key: 'categoria', label: 'Categoria', kind: 'text' },
  { key: 'rendimentoPct', label: 'Rendimento', kind: 'percent-signed' },
  { key: 'rendimentoAssoluto', label: 'Rendimento (€)', kind: 'euro-signed' },
  { key: 'valore', label: 'Valore', kind: 'euro' },
  { key: 'peso', label: 'Peso', kind: 'percent' },
  { key: 'nav', label: 'NAV', kind: 'euro' },
  { key: 'prezzoMedioUnitario', label: 'Prezzo medio', kind: 'euro' },
  { key: 'costo', label: 'Costo', kind: 'euro' },
]

const ORDINE_CATEGORIE_PAC = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto']

export default async function PacDettaglioPage({
  params,
}: {
  params: Promise<{ contenitoreId: string }>
}) {
  const { contenitoreId } = await params
  const supabase = await createClient()

  const { data: pac } = await supabase
    .from('v_valore_per_contenitore')
    .select('contenitore_id, nome, valore_totale')
    .eq('contenitore_id', contenitoreId)
    .maybeSingle()

  if (!pac) {
    return <div>Contenitore non trovato.</div>
  }

  const valoreTotalePac = pac.valore_totale ?? 0

  const { data: storicoRaw } = await supabase
    .from('v_storico_valorizzazioni_per_contenitore')
    .select('data, valore_totale, capitale_investito_totale')
    .eq('contenitore_id', contenitoreId)
    .order('data', { ascending: true })

  const storicoValoreMap = new Map<string, number>()
  const storicoCapitaleMap = new Map<string, number>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    storicoValoreMap.set(r.data, (storicoValoreMap.get(r.data) ?? 0) + Number(r.valore_totale))
    if (r.capitale_investito_totale != null) {
      storicoCapitaleMap.set(r.data, (storicoCapitaleMap.get(r.data) ?? 0) + Number(r.capitale_investito_totale))
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

  const { data: posizioni } = await supabase
    .from('v_riepilogo_posizione')
    .select(
      'strumento_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta'
    )
    .eq('contenitore_id', contenitoreId)

  const strumentoIds = (posizioni ?? [])
    .map((p) => p.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumenti } = strumentoIds.length
    ? await supabase.from('strumenti').select('id, nome, ticker, tipo, categoria').in('id', strumentoIds)
    : { data: null }

  const { data: costi } = await supabase
    .from('v_costo_per_strumento')
    .select('strumento_id, costo_totale')
    .eq('contenitore_id', contenitoreId)

  const { data: contenitoreInfo } = await supabase
    .from('contenitori')
    .select('target_attivo')
    .eq('id', contenitoreId)
    .maybeSingle()

  const { data: scostamenti } = contenitoreInfo?.target_attivo
    ? await supabase.from('v_scostamento_target').select('*').eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: subTargetRaw } = await supabase
    .from('target_allocazioni_strumento')
    .select('strumento_id, target_percentuale_categoria')
    .eq('contenitore_id', contenitoreId)

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const composizione: ScostamentoCategoria[] = (scostamenti ?? [])
    .slice()
    .sort(
      (a, b) =>
        ORDINE_CATEGORIE_PAC.indexOf(a.categoria ?? '') - ORDINE_CATEGORIE_PAC.indexOf(b.categoria ?? '')
    )

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p) => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === p.strumento_id)
      return {
        key: p.strumento_id ?? '—',
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        categoria: strumento?.categoria ?? '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        peso: valoreTotalePac > 0 ? ((p.valore ?? 0) / valoreTotalePac) * 100 : 0,
        costo: costo?.costo_totale ?? 0,
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  const costoTotalePac = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + (r.valore as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const plusMinusNonRealizzata = valoreTotalePosizioni - capitaleInvestitoTotale
  const rendimentoPctTotale = capitaleInvestitoTotale > 0 ? (plusMinusNonRealizzata / capitaleInvestitoTotale) * 100 : null

  const valorePerCategoria: Record<string, number> = {}
  for (const r of righe) {
    const cat = r.categoria as string
    valorePerCategoria[cat] = (valorePerCategoria[cat] ?? 0) + (r.valore as number)
  }

  const sottoTargetPerCategoria: Record<string, SottoTarget[]> = {}
  for (const st of subTargetRaw ?? []) {
    const strumento = strumenti?.find((s) => s.id === st.strumento_id)
    if (!strumento) continue
    const cat = strumento.categoria
    const rigaStrumento = righe.find((r) => r.strumentoId === st.strumento_id)
    const valoreStrumento = (rigaStrumento?.valore as number) ?? 0
    const totaleCategoria = valorePerCategoria[cat] ?? 0
    const pesoAttualePct = totaleCategoria > 0 ? (valoreStrumento / totaleCategoria) * 100 : 0
    const targetPct = Number(st.target_percentuale_categoria)

    if (!sottoTargetPerCategoria[cat]) sottoTargetPerCategoria[cat] = []
    sottoTargetPerCategoria[cat].push({
      strumentoId: st.strumento_id,
      nome: strumento.nome,
      ticker: strumento.ticker,
      targetPct,
      pesoAttualePct: Math.round(pesoAttualePct * 100) / 100,
      scostamentoPp: Math.round((pesoAttualePct - targetPct) * 100) / 100,
    })
  }
  for (const cat of Object.keys(sottoTargetPerCategoria)) {
    sottoTargetPerCategoria[cat].sort((a, b) => b.targetPct - a.targetPct)
  }

  const guadagnoPerCategoria: Record<string, number> = {}
  for (const r of righe) {
    const cat = r.categoria as string
    guadagnoPerCategoria[cat] = (guadagnoPerCategoria[cat] ?? 0) + (r.rendimentoAssoluto as number)
  }
  const maxAbsGuadagno = Math.max(0, ...Object.values(guadagnoPerCategoria).map((g) => Math.abs(g)))
  const contributoPerCategoria: ContributoCategoria[] = ORDINE_CATEGORIE_PAC.filter(
    (cat) => guadagnoPerCategoria[cat] !== undefined
  ).map((cat) => {
    const guadagno = guadagnoPerCategoria[cat]
    const contributoPct = plusMinusNonRealizzata !== 0 ? (guadagno / plusMinusNonRealizzata) * 100 : null
    const larghezzaPct = maxAbsGuadagno > 0 ? (Math.abs(guadagno) / maxAbsGuadagno) * 50 : 0
    return { categoria: cat, guadagno, contributoPct, larghezzaPct }
  })

  const contributoStrumentoPerCategoria: Record<string, ContributoStrumento[]> = {}
  for (const r of righe) {
    const cat = r.categoria as string
    const guadagnoCategoria = guadagnoPerCategoria[cat] ?? 0
    const strumento = strumenti?.find((s) => s.id === r.strumentoId)
    if (!contributoStrumentoPerCategoria[cat]) contributoStrumentoPerCategoria[cat] = []
    contributoStrumentoPerCategoria[cat].push({
      strumentoId: r.strumentoId as string,
      nome: r.nome as string,
      ticker: strumento?.ticker ?? null,
      guadagno: r.rendimentoAssoluto as number,
      contributoPctCategoria:
        guadagnoCategoria !== 0 ? ((r.rendimentoAssoluto as number) / guadagnoCategoria) * 100 : null,
    })
  }
  for (const cat of Object.keys(contributoStrumentoPerCategoria)) {
    if (contributoStrumentoPerCategoria[cat].length <= 1) delete contributoStrumentoPerCategoria[cat]
    else contributoStrumentoPerCategoria[cat].sort((a, b) => b.guadagno - a.guadagno)
  }

  return (
    <div>
      <RippleLink href="/pac" className="link-interattivo" style={{ fontSize: 13 }}>
        ← Tutti i PAC
      </RippleLink>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>PAC</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{pac.nome ?? '—'}</h1>

      <section>
        <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotalePac} />
      </section>

      <section style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardRendimento rendimentoPct={rendimentoPctTotale} label="Rendimento" />

        <CardMetrica label="Plus/minusvalenza non realizzata" href="/fiscalita" linkLabel="Vedi dettaglio fiscalità →">
          <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(plusMinusNonRealizzata)}
          </span>
        </CardMetrica>

        <CardMetrica label="Capitale investito netto" href="/transazioni" linkLabel="Vedi transazioni →">
          {formatEuro(capitaleInvestitoNettoTotale)}
        </CardMetrica>

        <CardMetrica label="Costo totale" href="/costi" linkLabel="Vedi dettaglio costi →">
          {formatEuro(costoTotalePac)}
        </CardMetrica>
      </section>

      <section style={{ marginTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Analisi rendimento</h2>
          <AnalisiRendimento
            contributoPerCategoria={contributoPerCategoria}
            contributoStrumentoPerCategoria={contributoStrumentoPerCategoria}
            plusMinusNonRealizzata={plusMinusNonRealizzata}
          />
        </div>

        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 500 }}>Analisi composizione</h2>
            <RippleLink href={`/target/${contenitoreId}`} className="link-interattivo" style={{ fontSize: 13 }}>
              Modifica target →
            </RippleLink>
          </div>
          <AnalisiComposizione
            composizione={composizione}
            sottoTargetPerCategoria={sottoTargetPerCategoria}
            soglia={soglia}
            targetAttivo={contenitoreInfo?.target_attivo ?? false}
          />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Strumenti</h2>
        <TabellaOrdinabile colonne={COLONNE} righe={righe} />
      </section>
    </div>
  )
}