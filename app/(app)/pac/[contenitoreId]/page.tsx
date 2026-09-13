import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { BarreSottocategoria, type SottoTarget } from '@/components/barre-sottocategoria'
import { BarreSottocategoriaRendimento, type ContributoStrumento } from '@/components/barre-sottocategoria-rendimento'

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

  const composizione = (scostamenti ?? [])
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
  const contributoPerCategoria = ORDINE_CATEGORIE_PAC.filter((cat) => guadagnoPerCategoria[cat] !== undefined).map(
    (cat) => {
      const guadagno = guadagnoPerCategoria[cat]
      const contributoPct = plusMinusNonRealizzata !== 0 ? (guadagno / plusMinusNonRealizzata) * 100 : null
      const larghezzaPct = maxAbsGuadagno > 0 ? (Math.abs(guadagno) / maxAbsGuadagno) * 50 : 0
      return { categoria: cat, guadagno, contributoPct, larghezzaPct }
    }
  )

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
      <Link href="/pac" style={{ fontSize: 13 }}>
        ← Tutti i PAC
      </Link>

      <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>PAC</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>{pac.nome ?? '—'}</h1>

      <section>
        <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotalePac} />
      </section>

      <section style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Rendimento</div>
          <div
            style={{
              fontSize: 22,
              marginTop: 4,
              color: (rendimentoPctTotale ?? 0) >= 0 ? '#0a7d2c' : '#c0392b',
            }}
          >
            {rendimentoPctTotale != null
              ? `${rendimentoPctTotale >= 0 ? '+' : ''}${rendimentoPctTotale.toFixed(2)}%`
              : '—'}
          </div>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Plus/minusvalenza non realizzata</div>
          <div
            style={{
              fontSize: 22,
              marginTop: 4,
              color: plusMinusNonRealizzata >= 0 ? '#0a7d2c' : '#c0392b',
            }}
          >
            {plusMinusNonRealizzata >= 0 ? '+' : ''}
            {formatEuro(plusMinusNonRealizzata)}
          </div>
          <Link href="/fiscalita" style={{ fontSize: 13 }}>
            Vedi dettaglio fiscalità →
          </Link>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Capitale investito netto</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(capitaleInvestitoNettoTotale)}</div>
          <Link href="/transazioni" style={{ fontSize: 13 }}>
            Vedi transazioni →
          </Link>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Costo totale</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(costoTotalePac)}</div>
          <Link href="/costi" style={{ fontSize: 13 }}>
            Vedi dettaglio costi →
          </Link>
        </div>
      </section>

      <section style={{ marginTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Analisi rendimento</h2>
          {contributoPerCategoria.length === 0 || plusMinusNonRealizzata === 0 ? (
            <p style={{ color: '#666' }}>Nessun guadagno o perdita maturata ancora.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {contributoPerCategoria.map((c) => {
                const positivo = c.guadagno >= 0
                const colore = positivo ? '#0a7d2c' : '#c0392b'
                return (
                  <div key={c.categoria}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      <span>{c.categoria}</span>
                      <span style={{ color: colore, fontWeight: 600 }}>
                        {positivo ? '+' : ''}
                        {formatEuro(c.guadagno)}
                        {c.contributoPct != null && ` (${c.contributoPct >= 0 ? '+' : ''}${c.contributoPct.toFixed(1)}%)`}
                      </span>
                    </div>
                    <div style={{ position: 'relative', height: 10, background: '#eee', borderRadius: 4 }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#999' }} />
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          height: '100%',
                          background: colore,
                          borderRadius: 4,
                          ...(positivo
                            ? { left: '50%', width: `${c.larghezzaPct}%` }
                            : { right: '50%', width: `${c.larghezzaPct}%` }),
                        }}
                      />
                    </div>
                    <BarreSottocategoriaRendimento items={contributoStrumentoPerCategoria[c.categoria] ?? []} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Analisi composizione</h2>
            <Link href={`/target/${contenitoreId}`} style={{ fontSize: 13 }}>
              Modifica target →
            </Link>
          </div>
          {!contenitoreInfo?.target_attivo ? (
            <p style={{ color: '#666' }}>Target disattivato per questo contenitore.</p>
          ) : composizione.length === 0 ? (
            <p style={{ color: '#666' }}>Nessun target impostato.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {composizione.map((c) => {
                const fuoriSoglia = Math.abs(c.scostamento_pp ?? 0) >= soglia
                const colore = fuoriSoglia ? '#e6a400' : '#0a7d2c'
                const pesoAttuale = Math.min(c.peso_attuale_pct ?? 0, 100)
                const target = Math.min(c.target_percentuale ?? 0, 100)
                return (
                  <div key={c.categoria}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      <span>{c.categoria}</span>
                      <span>
                        {(c.peso_attuale_pct ?? 0).toFixed(1)}% attuale · {c.target_percentuale}% target (
                        {(c.scostamento_pp ?? 0) > 0 ? '+' : ''}
                        {c.scostamento_pp} pp)
                      </span>
                    </div>
                    <div style={{ position: 'relative', height: 10, background: '#eee', borderRadius: 4 }}>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${pesoAttuale}%`,
                          background: colore,
                          borderRadius: 4,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: -3,
                          left: `${target}%`,
                          width: 2,
                          height: 16,
                          background: '#333',
                        }}
                      />
                    </div>
                    <BarreSottocategoria items={sottoTargetPerCategoria[c.categoria ?? ''] ?? []} soglia={soglia} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Strumenti</h2>
        <TabellaOrdinabile colonne={COLONNE} righe={righe} />
      </section>
    </div>
  )
}