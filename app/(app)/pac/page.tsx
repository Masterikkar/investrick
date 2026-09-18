import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { RippleLink } from '@/components/ripple-link'
import { CardMetrica, stileCardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
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
  { key: 'provenienza', label: 'Provenienza', kind: 'text' },
]

const ORDINE_CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto']

export default async function PacPage() {
  const supabase = await createClient()

  const { data: pacs } = await supabase
    .from('contenitori')
    .select('id, nome, target_attivo')
    .eq('tipo', 'PAC')
    .order('nome')

  const pacIds = (pacs ?? []).map((p) => p.id)
  const nomePac = new Map((pacs ?? []).map((p) => [p.id, p.nome]))

  const { data: valoriContenitore } = pacIds.length
    ? await supabase
        .from('v_valore_per_contenitore')
        .select('contenitore_id, valore_totale')
        .in('contenitore_id', pacIds)
    : { data: null }

  const valoreContainerMap = new Map<string, number>(
    (valoriContenitore ?? [])
      .filter((v): v is { contenitore_id: string; valore_totale: number | null } => v.contenitore_id !== null)
      .map((v) => [v.contenitore_id, v.valore_totale ?? 0])
  )
  const valoreTotalePac = (valoriContenitore ?? []).reduce((acc, v) => acc + (v.valore_totale ?? 0), 0)

  const { data: storicoRaw } = pacIds.length
    ? await supabase
        .from('v_storico_valorizzazioni_per_contenitore')
        .select('data, valore_totale, capitale_investito_totale')
        .in('contenitore_id', pacIds)
        .order('data', { ascending: true })
    : { data: null }

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

  const rendimentoUltimoSnapshot =
    puntiRendimento.length > 0 ? puntiRendimento[puntiRendimento.length - 1].valore : null

  const { data: posizioni } = pacIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta'
        )
        .in('contenitore_id', pacIds)
    : { data: null }

  const strumentoIds = (posizioni ?? [])
    .map((p) => p.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumenti } = strumentoIds.length
    ? await supabase.from('strumenti').select('id, nome, ticker, tipo, categoria').in('id', strumentoIds)
    : { data: null }

  const { data: costi } = pacIds.length
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, contenitore_id, costo_totale')
        .in('contenitore_id', pacIds)
    : { data: null }

  const pacConTargetAttivo = (pacs ?? []).filter((p) => p.target_attivo)
  const idsConTargetAttivo = pacConTargetAttivo.map((p) => p.id)

  const { data: targetAllocazioniRaw } = idsConTargetAttivo.length
    ? await supabase
        .from('target_allocazioni')
        .select('contenitore_id, categoria, target_percentuale')
        .in('contenitore_id', idsConTargetAttivo)
        .eq('attivo', true)
    : { data: null }

  const { data: subTargetRaw } = idsConTargetAttivo.length
    ? await supabase
        .from('target_allocazioni_strumento')
        .select('contenitore_id, strumento_id, target_percentuale_categoria')
        .in('contenitore_id', idsConTargetAttivo)
    : { data: null }

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p) => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find(
        (c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id
      )
      return {
        key: `${p.contenitore_id ?? 'diretto'}-${p.strumento_id ?? '—'}`,
        strumentoId: p.strumento_id,
        contenitoreId: p.contenitore_id,
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
        provenienza: p.contenitore_id ? nomePac.get(p.contenitore_id) ?? '—' : 'Diretto',
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  const costoTotalePac = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + (r.valore as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const plusMinusNonRealizzata = valoreTotalePosizioni - capitaleInvestitoTotale
  const rendimentoPctTotale =
    capitaleInvestitoTotale > 0 ? (plusMinusNonRealizzata / capitaleInvestitoTotale) * 100 : null

  const variazioneDaUltimoSnapshot =
    rendimentoPctTotale != null && rendimentoUltimoSnapshot != null
      ? rendimentoPctTotale - rendimentoUltimoSnapshot
      : null

  const valorePerCategoria: Record<string, number> = {}
  for (const r of righe) {
    const cat = r.categoria as string
    valorePerCategoria[cat] = (valorePerCategoria[cat] ?? 0) + (r.valore as number)
  }

  const valoreTotaleConTarget = idsConTargetAttivo.reduce((acc, id) => acc + (valoreContainerMap.get(id) ?? 0), 0)

  const valorePerCategoriaConTarget: Record<string, number> = {}
  const valoreCategoriaPerContenitore: Record<string, Record<string, number>> = {}
  for (const r of righe) {
    const cId = r.contenitoreId as string | null
    if (!cId || !idsConTargetAttivo.includes(cId)) continue
    const cat = r.categoria as string
    valorePerCategoriaConTarget[cat] = (valorePerCategoriaConTarget[cat] ?? 0) + (r.valore as number)
    if (!valoreCategoriaPerContenitore[cat]) valoreCategoriaPerContenitore[cat] = {}
    valoreCategoriaPerContenitore[cat][cId] = (valoreCategoriaPerContenitore[cat][cId] ?? 0) + (r.valore as number)
  }

  const targetPerCategoriaEContenitore: Record<string, Record<string, number>> = {}
  for (const t of targetAllocazioniRaw ?? []) {
    if (!t.contenitore_id) continue
    if (!targetPerCategoriaEContenitore[t.categoria]) targetPerCategoriaEContenitore[t.categoria] = {}
    targetPerCategoriaEContenitore[t.categoria][t.contenitore_id] = Number(t.target_percentuale)
  }

  const categorieConTarget = ORDINE_CATEGORIE.filter((cat) =>
    idsConTargetAttivo.some((id) => targetPerCategoriaEContenitore[cat]?.[id] !== undefined)
  )

  const composizioneAggregata: ScostamentoCategoria[] = categorieConTarget.map((cat) => {
    const valoreCategoria = valorePerCategoriaConTarget[cat] ?? 0
    const pesoAttualePct = valoreTotaleConTarget > 0 ? (valoreCategoria / valoreTotaleConTarget) * 100 : 0

    let targetPesato = 0
    for (const id of idsConTargetAttivo) {
      const targetContenitore = targetPerCategoriaEContenitore[cat]?.[id] ?? 0
      targetPesato += targetContenitore * (valoreContainerMap.get(id) ?? 0)
    }
    const targetPercentuale = valoreTotaleConTarget > 0 ? targetPesato / valoreTotaleConTarget : 0

    return {
      categoria: cat,
      peso_attuale_pct: Math.round(pesoAttualePct * 100) / 100,
      target_percentuale: Math.round(targetPercentuale * 100) / 100,
      scostamento_pp: Math.round((pesoAttualePct - targetPercentuale) * 100) / 100,
    }
  })

  const subTargetPerStrumento: Record<string, { contenitoreId: string; targetPct: number }[]> = {}
  for (const st of subTargetRaw ?? []) {
    if (!subTargetPerStrumento[st.strumento_id]) subTargetPerStrumento[st.strumento_id] = []
    subTargetPerStrumento[st.strumento_id].push({
      contenitoreId: st.contenitore_id,
      targetPct: Number(st.target_percentuale_categoria),
    })
  }

  const sottoTargetPerCategoria: Record<string, SottoTarget[]> = {}
  for (const [strumentoId, voci] of Object.entries(subTargetPerStrumento)) {
    const strumento = strumenti?.find((s) => s.id === strumentoId)
    if (!strumento) continue
    const cat = strumento.categoria

    let pesoTotale = 0
    let targetPesato = 0
    for (const voce of voci) {
      const peso = valoreCategoriaPerContenitore[cat]?.[voce.contenitoreId] ?? 0
      pesoTotale += peso
      targetPesato += voce.targetPct * peso
    }
    const targetPct =
      pesoTotale > 0 ? targetPesato / pesoTotale : voci.reduce((s, v) => s + v.targetPct, 0) / voci.length

    const valoreStrumento = righe
      .filter((r) => r.strumentoId === strumentoId && idsConTargetAttivo.includes(r.contenitoreId as string))
      .reduce((acc, r) => acc + (r.valore as number), 0)
    const totaleCategoria = valorePerCategoriaConTarget[cat] ?? 0
    const pesoAttualePct = totaleCategoria > 0 ? (valoreStrumento / totaleCategoria) * 100 : 0

    if (!sottoTargetPerCategoria[cat]) sottoTargetPerCategoria[cat] = []
    sottoTargetPerCategoria[cat].push({
      strumentoId,
      nome: strumento.nome,
      ticker: strumento.ticker,
      targetPct: Math.round(targetPct * 100) / 100,
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
  const contributoPerCategoria: ContributoCategoria[] = ORDINE_CATEGORIE.filter(
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
      strumentoId: r.key,
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

  const righePac = (pacs ?? []).map((p) => {
    const valore = valoreContainerMap.get(p.id) ?? 0
    const costo = righe
      .filter((r) => r.contenitoreId === p.id)
      .reduce((acc, r) => acc + (r.costo as number), 0)
    const posizioniPac = (posizioni ?? []).filter((pos) => pos.contenitore_id === p.id)
    const capitaleInvestito = posizioniPac.reduce((acc, pos) => acc + (pos.capitale_investito ?? 0), 0)
    const valorePosizioni = posizioniPac.reduce((acc, pos) => acc + (pos.valore ?? 0), 0)
    const plusMinus = valorePosizioni - capitaleInvestito
    return {
      id: p.id,
      nome: p.nome,
      valore,
      costo,
      plusMinus,
    }
  })

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PAC</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>PAC</h1>

      <section>
        <Sezione>
          <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotalePac} />
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardRendimento
              rendimentoPct={rendimentoPctTotale}
              variazioneOggi={variazioneDaUltimoSnapshot}
              href="/rendimenti"
              linkLabel="→ Rendimenti"
            />

            <CardMetrica label="Plus/minusvalenza non realizzata" href="/fiscalita" linkLabel="→ Fiscalità">
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata)}
              </span>
            </CardMetrica>

            <CardMetrica label="Capitale investito netto" href="/transazioni" linkLabel="→ Transazioni">
              {formatEuro(capitaleInvestitoNettoTotale)}
            </CardMetrica>

            <CardMetrica label="Costo totale" href="/costi" linkLabel="→ Costi">
              {formatEuro(costoTotalePac)}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Analisi rendimento</h2>
          <Sezione>
            <AnalisiRendimento
              contributoPerCategoria={contributoPerCategoria}
              contributoStrumentoPerCategoria={contributoStrumentoPerCategoria}
              plusMinusNonRealizzata={plusMinusNonRealizzata}
            />
          </Sezione>
        </div>

        <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 500 }}>Analisi composizione</h2>
            {idsConTargetAttivo.length === 1 && (
              <RippleLink href={`/target/${idsConTargetAttivo[0]}`} className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
                → Modifica target
              </RippleLink>
            )}
          </div>
          <Sezione>
            <AnalisiComposizione
              composizione={composizioneAggregata}
              sottoTargetPerCategoria={sottoTargetPerCategoria}
              soglia={soglia}
              targetAttivo={idsConTargetAttivo.length > 0}
              messaggioTargetDisattivato="Nessun PAC ha un target attivo."
            />
          </Sezione>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>I tuoi PAC</h2>
        <Sezione>
          {righePac.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nessun PAC registrato.</p>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {righePac.map((r) => (
                <RippleLink
                  key={r.id}
                  href={`/pac/${r.id}`}
                  className="riga-interattiva"
                  style={{ ...stileCardMetrica, minWidth: 220, display: 'block' }}
                >
                  <div style={{ fontWeight: 500 }}>{r.nome}</div>
                  <div style={{ marginTop: 12, fontSize: 20 }}>{formatEuro(r.valore)}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Costo: {formatEuro(r.costo)}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: r.plusMinus >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    Plus/minus: {formatEuroSigned(r.plusMinus)}
                  </div>
                </RippleLink>
              ))}
            </div>
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Strumenti</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} />
        </Sezione>
      </section>
    </div>
  )
}