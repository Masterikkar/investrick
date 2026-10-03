import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatData, formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, CHIAVI_FILTRO_POSIZIONE, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { RippleLink } from '@/components/ripple-link'
import { CardMetrica, stileCardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
import { traduciCategoria } from '@/lib/i18n-categorie'
import type { SottoTarget } from '@/components/barre-sottocategoria'
import type { ContributoStrumento } from '@/components/barre-sottocategoria-rendimento'
import { AnalisiRendimento, type ContributoCategoria } from '@/components/analisi-rendimento'
import { AnalisiComposizione, type ScostamentoCategoria } from '@/components/analisi-composizione'
import { CATEGORIE } from '@/lib/categorie'
import type { DatiGruppi } from '@/lib/gruppi'
import { CapitaleInvestito } from '@/components/capitale-investito'

// Pagina elenco di un tipo di gruppo (PAC, Polizze, Personalizzati): grafico
// del rendimento, card riassuntive, analisi di rendimento e composizione, una
// card per gruppo e la tabella degli strumenti. I dati arrivano già pronti da
// lib/gruppi.ts; qui cambiano solo i testi e il link di ogni card.
//
// mostraTotaleAggregato = false nasconde grafico, card riassuntive e analisi,
// che sommano tutti i gruppi: per i Personalizzati uno strumento può stare in
// più gruppi, quindi quella somma non è un totale reale. Per lo stesso motivo
// il Peso di ogni riga si calcola allora sul totale del suo gruppo.
export async function PaginaGruppi({
  dati,
  titolo,
  titoloElenco,
  alertNessunGruppo,
  alertNessunGruppoConTarget,
  hrefGruppo,
  mostraDataAttivazione = false,
  mostraTotaleAggregato = true,
}: {
  dati: DatiGruppi
  titolo: string
  titoloElenco: string
  alertNessunGruppo: string
  alertNessunGruppoConTarget: string
  hrefGruppo: (id: string) => string
  mostraDataAttivazione?: boolean
  mostraTotaleAggregato?: boolean
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaContenitore')
  const tDashboard = await getTranslations('Dashboard')
  const tContenitori = await getTranslations('Contenitori')
  const tCategorie = await getTranslations('Categorie')

  const COLONNE: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
    { key: 'tipo', label: t('colonnaTipo'), kind: 'text' },
    { key: 'categoriaVisualizzata', label: t('colonnaCategoria'), kind: 'text' },
    { key: 'rendimentoPct', label: t('colonnaRendimento'), kind: 'percent-signed' },
    { key: 'rendimentoAssoluto', label: t('colonnaRendimentoEuro'), kind: 'euro-signed' },
    { key: 'valore', label: t('colonnaValore'), kind: 'euro' },
    { key: 'peso', label: t('colonnaPeso'), kind: 'percent' },
    { key: 'nav', label: t('colonnaNav'), kind: 'euro' },
    { key: 'prezzoMedioUnitario', label: t('colonnaPrezzoMedio'), kind: 'euro' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'provenienza', label: tContenitori('colonnaGruppo'), kind: 'text' },
  ]

  const supabase = await createClient()
  const { gruppi, posizioni, strumenti, storico } = dati

  const nomeGruppo = new Map(gruppi.map((g) => [g.id, g.nome]))
  const valoreGruppo = new Map(gruppi.map((g) => [g.id, g.valore]))
  const valoreTotale = gruppi.reduce((acc, g) => acc + g.valore, 0)

  const puntiRendimento: PuntoStorico[] = storico
    .map(({ data, valore, capitale }) => {
      if (!capitale || capitale <= 0) return null
      return { data, valore: ((valore - capitale) / capitale) * 100 }
    })
    .filter((p): p is PuntoStorico => p !== null)

  const rendimentoUltimoSnapshot =
    puntiRendimento.length > 0 ? puntiRendimento[puntiRendimento.length - 1].valore : null

  const idsConTargetAttivo = gruppi.filter((g) => g.targetAttivo).map((g) => g.id)

  const [{ data: targetAllocazioniRaw }, { data: subTargetRaw }, { data: impostazioni }] = await Promise.all([
    idsConTargetAttivo.length
      ? supabase
          .from('target_allocazioni')
          .select('contenitore_id, categoria, target_percentuale')
          .in('contenitore_id', idsConTargetAttivo)
          .eq('attivo', true)
      : Promise.resolve({ data: null }),
    idsConTargetAttivo.length
      ? supabase
          .from('target_allocazioni_strumento')
          .select('contenitore_id, strumento_id, target_percentuale_categoria')
          .in('contenitore_id', idsConTargetAttivo)
      : Promise.resolve({ data: null }),
    supabase.from('impostazioni_utente').select('soglia_ribilanciamento_pp').maybeSingle(),
  ])

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const pesoSu = (valore: number, totale: number) => (totale > 0 ? (valore / totale) * 100 : 0)

  const righe: RigaTabella[] = posizioni
    .map((p) => {
      const strumento = strumenti.find((s) => s.id === p.strumentoId)
      const categoria = strumento?.categoria ?? '—'
      return {
        key: `${p.contenitoreId}-${p.strumentoId}`,
        strumentoId: p.strumentoId,
        contenitoreId: p.contenitoreId,
        nome: strumento?.nome ?? '—',
        ticker: strumento?.ticker ?? null,
        isin: strumento?.isin ?? null,
        tipo: strumento?.tipo ?? '—',
        categoria,
        categoriaVisualizzata: traduciCategoria(tCategorie, categoria),
        rendimentoPct: p.rendimentoPct,
        rendimentoAssoluto: p.valore - p.capitaleInvestito,
        valore: p.valore,
        capitaleInvestito: p.capitaleInvestito,
        capitaleInvestitoNetto: p.capitaleInvestitoNetto,
        ricompense: p.ricompense,
        nav: p.prezzoAttuale,
        prezzoMedioUnitario: p.prezzoMedioUnitario,
        peso: pesoSu(p.valore, mostraTotaleAggregato ? valoreTotale : valoreGruppo.get(p.contenitoreId) ?? 0),
        costo: p.costo,
        provenienza: nomeGruppo.get(p.contenitoreId) ?? '—',
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  const costoTotale = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + (r.valore as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const ricompenseTotale = righe.reduce((acc, r) => acc + (r.ricompense as number), 0)
  // Performance sui lotti, fondo per fondo (analisi del rendimento, tabella).
  const plusMinusLotti = valoreTotalePosizioni - capitaleInvestitoTotale

  // Polizze: il contratto si tassa intero, quindi plus/minus e rendimento %
  // della pagina sono valore − premi residui e (valore − premi) / premi.
  const baseFiscaleTotale = gruppi.length > 0 && gruppi.every((g) => g.baseFiscale !== null)
    ? gruppi.reduce((acc, g) => acc + (g.baseFiscale ?? 0), 0)
    : null
  const plusMinusNonRealizzata = baseFiscaleTotale !== null ? valoreTotalePosizioni - baseFiscaleTotale : plusMinusLotti
  const baseRendimento = baseFiscaleTotale ?? capitaleInvestitoTotale
  const rendimentoPctTotale = baseRendimento > 0 ? (plusMinusNonRealizzata / baseRendimento) * 100 : null

  // Lo storico è sui lotti: il confronto con l'ultima valorizzazione non ha
  // senso per il rendimento fiscale delle polizze.
  const variazioneDaUltimoSnapshot =
    baseFiscaleTotale === null && rendimentoPctTotale != null && rendimentoUltimoSnapshot != null
      ? rendimentoPctTotale - rendimentoUltimoSnapshot
      : null

  const valoreTotaleConTarget = idsConTargetAttivo.reduce((acc, id) => acc + (valoreGruppo.get(id) ?? 0), 0)

  const valorePerCategoriaConTarget: Record<string, number> = {}
  const valoreCategoriaPerContenitore: Record<string, Record<string, number>> = {}
  for (const r of righe) {
    const cId = r.contenitoreId as string
    if (!idsConTargetAttivo.includes(cId)) continue
    const cat = r.categoria as string
    valorePerCategoriaConTarget[cat] = (valorePerCategoriaConTarget[cat] ?? 0) + (r.valore as number)
    if (!valoreCategoriaPerContenitore[cat]) valoreCategoriaPerContenitore[cat] = {}
    valoreCategoriaPerContenitore[cat][cId] = (valoreCategoriaPerContenitore[cat][cId] ?? 0) + (r.valore as number)
  }

  const targetPerCategoriaEContenitore: Record<string, Record<string, number>> = {}
  for (const ta of targetAllocazioniRaw ?? []) {
    if (!ta.contenitore_id) continue
    if (!targetPerCategoriaEContenitore[ta.categoria]) targetPerCategoriaEContenitore[ta.categoria] = {}
    targetPerCategoriaEContenitore[ta.categoria][ta.contenitore_id] = Number(ta.target_percentuale)
  }

  const categorieConTarget = CATEGORIE.filter((cat) =>
    idsConTargetAttivo.some((id) => targetPerCategoriaEContenitore[cat]?.[id] !== undefined)
  )

  const composizioneAggregata: ScostamentoCategoria[] = categorieConTarget.map((cat) => {
    const valoreCategoria = valorePerCategoriaConTarget[cat] ?? 0
    const pesoAttualePct = valoreTotaleConTarget > 0 ? (valoreCategoria / valoreTotaleConTarget) * 100 : 0

    let targetPesato = 0
    for (const id of idsConTargetAttivo) {
      const targetContenitore = targetPerCategoriaEContenitore[cat]?.[id] ?? 0
      targetPesato += targetContenitore * (valoreGruppo.get(id) ?? 0)
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
    const strumento = strumenti.find((s) => s.id === strumentoId)
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
  const contributoPerCategoria: ContributoCategoria[] = CATEGORIE.filter(
    (cat) => guadagnoPerCategoria[cat] !== undefined
  ).map((cat) => {
    const guadagno = guadagnoPerCategoria[cat]
    const contributoPct = plusMinusLotti !== 0 ? (guadagno / plusMinusLotti) * 100 : null
    const larghezzaPct = maxAbsGuadagno > 0 ? (Math.abs(guadagno) / maxAbsGuadagno) * 50 : 0
    return { categoria: cat, guadagno, contributoPct, larghezzaPct }
  })

  const contributoStrumentoPerCategoria: Record<string, ContributoStrumento[]> = {}
  for (const r of righe) {
    const cat = r.categoria as string
    const guadagnoCategoria = guadagnoPerCategoria[cat] ?? 0
    const strumento = strumenti.find((s) => s.id === r.strumentoId)
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

  const righeGruppi = gruppi.map((g) => {
    const posizioniGruppo = posizioni.filter((p) => p.contenitoreId === g.id)
    const costo = posizioniGruppo.reduce((acc, p) => acc + p.costo, 0)
    const capitaleInvestito = posizioniGruppo.reduce((acc, p) => acc + p.capitaleInvestito, 0)
    const valorePosizioni = posizioniGruppo.reduce((acc, p) => acc + p.valore, 0)
    return {
      id: g.id,
      nome: g.nome,
      valore: g.valore,
      costo,
      plusMinus: valorePosizioni - (g.baseFiscale ?? capitaleInvestito),
      dataAttivazione: g.dataAttivazione,
    }
  })

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{titolo}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{titolo}</h1>

      {mostraTotaleAggregato && (
        <>
          <section>
            <Sezione>
              <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotale} />
            </Sezione>
          </section>

          <section style={{ marginTop: 24 }}>
            <Sezione>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <CardRendimento
                  rendimentoPct={rendimentoPctTotale}
                  variazioneOggi={variazioneDaUltimoSnapshot}
                  label={t('labelRendimento')}
                  etichettaOggi={tDashboard('etichettaOggi')}
                  href="/returns"
                  linkLabel={t('linkRendimenti')}
                />

                <CardMetrica label={t('labelPlusMinusNonRealizzata')} href="/tax" linkLabel={t('linkFiscalita')}>
                  <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatEuroSigned(plusMinusNonRealizzata, locale)}
                  </span>
                </CardMetrica>

                <CardMetrica label={t('labelCapitaleInvestitoNetto')} href="/account/data-management/transactions" linkLabel={t('linkTransazioni')}>
                  <CapitaleInvestito capitale={capitaleInvestitoNettoTotale} ricompense={ricompenseTotale} />
                </CardMetrica>

                <CardMetrica label={t('labelCostoTotale')} href="/costs" linkLabel={t('linkCosti')}>
                  {formatEuro(costoTotale, locale)}
                </CardMetrica>
              </div>
            </Sezione>
          </section>

          <section style={{ marginTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
              <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 12, fontWeight: 500 }}>{t('titoloAnalisiRendimento')}</h2>
              <Sezione>
                <AnalisiRendimento
                  contributoPerCategoria={contributoPerCategoria}
                  contributoStrumentoPerCategoria={contributoStrumentoPerCategoria}
                  plusMinusNonRealizzata={plusMinusLotti}
                />
              </Sezione>
            </div>

            <div style={{ flex: '1 1 480px', maxWidth: 520 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 'var(--fs-h2)', margin: 0, fontWeight: 500 }}>{t('titoloAnalisiComposizione')}</h2>
                {idsConTargetAttivo.length === 1 && (
                  <RippleLink href={`/target/${idsConTargetAttivo[0]}`} className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
                    {t('linkModificaTarget')}
                  </RippleLink>
                )}
              </div>
              <Sezione>
                <AnalisiComposizione
                  composizione={composizioneAggregata}
                  sottoTargetPerCategoria={sottoTargetPerCategoria}
                  soglia={soglia}
                  targetAttivo={idsConTargetAttivo.length > 0}
                  messaggioTargetDisattivato={alertNessunGruppoConTarget}
                />
              </Sezione>
            </div>
          </section>
        </>
      )}

      <section style={{ marginTop: mostraTotaleAggregato ? 32 : 0 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 12, fontWeight: 500 }}>{titoloElenco}</h2>
        <Sezione>
          {righeGruppi.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{alertNessunGruppo}</p>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {righeGruppi.map((r) => (
                <RippleLink
                  key={r.id}
                  href={hrefGruppo(r.id)}
                  className="riga-interattiva"
                  style={{ ...stileCardMetrica, minWidth: 220, display: 'block' }}
                >
                  <div style={{ fontWeight: 500 }}>{r.nome}</div>
                  {mostraDataAttivazione && (
                    <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {r.dataAttivazione
                        ? t('dataAttivazioneAttiva', { data: formatData(r.dataAttivazione, locale) })
                        : t('dataAttivazioneNonImpostata')}
                    </div>
                  )}
                  <div style={{ marginTop: 12, fontSize: 'var(--fs-card-value)' }}>{formatEuro(r.valore, locale)}</div>
                  <div style={{ marginTop: 8, fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
                    {t('rigaCosto', { valore: formatEuro(r.costo, locale) })}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 'var(--fs-card-link)', color: r.plusMinus >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {t('rigaPlusMinus', { valore: formatEuroSigned(r.plusMinus, locale) })}
                  </div>
                </RippleLink>
              ))}
            </div>
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 12, fontWeight: 500 }}>{t('titoloStrumenti')}</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} filtro={{ chiavi: CHIAVI_FILTRO_POSIZIONE }} />
        </Sezione>
      </section>
    </div>
  )
}
