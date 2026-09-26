import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, CHIAVI_FILTRO_POSIZIONE, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'
import { CHIAVE_TRADUZIONE_TIPO_LIQUIDITA } from '@/lib/i18n-tipi-liquidita'
import { saldoRiportatoAllaData, serieSaldiPerConto } from '@/lib/saldi-riportati'
import { caricaRicompenseResidue, ricompensePosizione } from '@/lib/ricompense'
import { CapitaleInvestito } from '@/components/capitale-investito'

// Tutte le posizioni aperte di tutte e 7 le categorie insieme, Liquidità
// compresa, con la stessa struttura di PaginaCategoria: grafico del
// rendimento, card e tabella. Stesse colonne più la Categoria; il Peso è sul
// totale di questa tabella, non della categoria. Per la liquidità il capitale
// investito è il saldo stesso (rendimento 0), e NAV e prezzo medio non esistono.
export default async function TuttiAssetPage() {
  const locale = (await getLocale()) as LocaleFormato
  const tMenu = await getTranslations('Menu')
  const tContenitori = await getTranslations('Contenitori')
  const tDashboard = await getTranslations('Dashboard')
  const t = await getTranslations('PaginaCategoria')
  const tTuttiAsset = await getTranslations('PaginaTuttiAsset')
  const tContenitore = await getTranslations('PaginaContenitore')
  const tCategorie = await getTranslations('Categorie')
  const tTipiStrumento = await getTranslations('TipiStrumento')
  const tTipiLiquidita = await getTranslations('TipiLiquidita')

  const COLONNE: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
    { key: 'categoria', label: tContenitore('colonnaCategoria'), kind: 'text' },
    { key: 'tipo', label: t('colonnaTipo'), kind: 'text' },
    { key: 'rendimentoPct', label: t('colonnaRendimento'), kind: 'percent-signed' },
    { key: 'rendimentoAssoluto', label: t('colonnaRendimentoEuro'), kind: 'euro-signed' },
    { key: 'valore', label: t('colonnaValore'), kind: 'euro' },
    { key: 'peso', label: t('colonnaPeso'), kind: 'percent', tooltip: tTuttiAsset('tooltipPeso') },
    { key: 'nav', label: t('colonnaNav'), kind: 'euro' },
    { key: 'prezzoMedioUnitario', label: t('colonnaPrezzoMedio'), kind: 'euro' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'provenienza', label: tContenitori('colonnaGruppo'), kind: 'text' },
  ]

  const supabase = await createClient()
  const ricompense = await caricaRicompenseResidue(supabase)

  const { data: strumenti } = await supabase.from('strumenti').select('id, nome, tipo, categoria, ticker, isin')

  const strumentoIds = (strumenti ?? []).filter((s) => s.categoria !== 'Liquidita').map((s) => s.id)
  const idContiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita').map((s) => s.id)

  // Oltre 1000 righe (una per categoria e per giorno): va letta a blocchi.
  const { data: storicoRaw } = await tutteLeRighe((da, a) =>
    supabase
      .from('v_storico_valorizzazioni_per_categoria')
      .select('categoria, data, valore_totale, capitale_investito_totale')
      // La Liquidità è aggiunta sotto, conto per conto, con il riporto del saldo.
      .neq('categoria', 'Liquidita')
      .order('data', { ascending: true })
      .order('categoria', { ascending: true })
      .range(da, a)
  )

  // Serie storica delle sei categorie sommate per data. Una data entra solo se
  // ha lo snapshot di tutte le categorie la cui serie la copre (tra la prima e
  // l'ultima data di quella categoria): nei giorni in cui manca una categoria
  // (es. festivi senza prezzo per i fondi) la somma varrebbe su un sottoinsieme
  // e il rendimento % farebbe un salto finto. Come nelle pagine categoria, le
  // date senza capitale investito positivo sono escluse.
  const intervalloCategoria = new Map<string, { prima: string; ultima: string }>()
  const storicoPerData = new Map<string, { categorie: Set<string>; valore: number; capitale: number; capitaleMancante: boolean }>()
  for (const r of storicoRaw ?? []) {
    if (!r.data || !r.categoria) continue
    const intervallo = intervalloCategoria.get(r.categoria)
    if (!intervallo) intervalloCategoria.set(r.categoria, { prima: r.data, ultima: r.data })
    else intervallo.ultima = r.data
    const giorno = storicoPerData.get(r.data) ?? { categorie: new Set<string>(), valore: 0, capitale: 0, capitaleMancante: false }
    giorno.categorie.add(r.categoria)
    giorno.valore += Number(r.valore_totale)
    if (r.capitale_investito_totale == null) giorno.capitaleMancante = true
    else giorno.capitale += Number(r.capitale_investito_totale)
    storicoPerData.set(r.data, giorno)
  }

  // Liquidità: per ogni data del grafico, l'ultimo saldo noto di ciascun conto
  // (riporto in avanti, vedi lib/saldi-riportati.ts). Capitale investito =
  // saldo, quindi la liquidità contribuisce 0% al rendimento.
  const { data: storicoLiquiditaRaw } = idContiLiquidita.length
    ? await tutteLeRighe((da, a) =>
        supabase
          .from('v_storico_valorizzazioni_per_strumento')
          .select('strumento_id, data, valore_totale')
          .in('strumento_id', idContiLiquidita)
          .order('data', { ascending: true })
          .order('strumento_id', { ascending: true })
          .range(da, a)
      )
    : { data: null }
  const saldiPerConto = serieSaldiPerConto(storicoLiquiditaRaw ?? [])

  const puntiRendimento: PuntoStorico[] = Array.from(storicoPerData.entries())
    .filter(([data, giorno]) =>
      Array.from(intervalloCategoria.entries()).every(
        ([categoria, { prima, ultima }]) => data < prima || data > ultima || giorno.categorie.has(categoria)
      )
    )
    .map(([data, { valore, capitale, capitaleMancante }]) => {
      if (capitaleMancante) return null
      const liquidita = saldoRiportatoAllaData(saldiPerConto, data)
      const valoreTotale = valore + liquidita
      const capitaleTotale = capitale + liquidita
      if (capitaleTotale <= 0) return null
      return { data, valore: ((valoreTotale - capitaleTotale) / capitaleTotale) * 100 }
    })
    .filter((p): p is PuntoStorico => p !== null)
    .sort((a, b) => a.data.localeCompare(b.data))

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select('strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta')
        .in('strumento_id', strumentoIds)
        .gt('quantita_posseduta', 0)
    : { data: null }

  const { data: costi } = strumentoIds.length
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, contenitore_id, costo_totale')
        .in('strumento_id', strumentoIds)
    : { data: null }

  // Conti di liquidità: una riga per conto e contenitore con saldo diverso da 0.
  const [{ data: saldiLiquidita }, { data: costiLiquidita }] = idContiLiquidita.length
    ? await Promise.all([
        supabase.from('v_saldo_liquidita').select('strumento_id, contenitore_id, saldo_corrente').in('strumento_id', idContiLiquidita),
        supabase.from('v_costo_liquidita').select('strumento_id, contenitore_id, costo_totale').in('strumento_id', idContiLiquidita),
      ])
    : [{ data: null }, { data: null }]
  const saldiAperti = (saldiLiquidita ?? []).filter((s) => s.strumento_id && Number(s.saldo_corrente ?? 0) !== 0)

  const contenitoreIds = Array.from(
    new Set(
      [...(posizioni ?? []), ...saldiAperti].map((p) => p.contenitore_id).filter((id): id is string => id !== null)
    )
  )

  const { data: contenitori } = contenitoreIds.length
    ? await supabase.from('contenitori').select('id, nome').in('id', contenitoreIds)
    : { data: null }

  // Il Peso si calcola sulla somma dei valori delle righe mostrate qui, non
  // su v_valore_per_categoria (che è per singola categoria): così i pesi della
  // tabella sommano sempre a 100%.
  const valoreTotaleTabella =
    (posizioni ?? []).reduce((acc, p) => acc + (p.valore ?? 0), 0) +
    saldiAperti.reduce((acc, s) => acc + Number(s.saldo_corrente ?? 0), 0)

  function etichettaTipo(categoria: string, tipo: string): string {
    if (categoria === 'Liquidita') {
      const chiave = CHIAVE_TRADUZIONE_TIPO_LIQUIDITA[tipo]
      return chiave ? tTipiLiquidita(chiave) : tipo
    }
    return traduciTipoStrumento(tTipiStrumento, tipo)
  }

  const righeLiquidita: RigaTabella[] = saldiAperti.map((s) => {
    const strumento = strumenti?.find((x) => x.id === s.strumento_id)
    const saldo = Number(s.saldo_corrente ?? 0)
    const costo = (costiLiquidita ?? []).find((c) => c.strumento_id === s.strumento_id && c.contenitore_id === s.contenitore_id)
    const contenitore = s.contenitore_id ? contenitori?.find((c) => c.id === s.contenitore_id) : null
    return {
      key: `${s.strumento_id}-${s.contenitore_id ?? 'diretto'}`,
      strumentoId: s.strumento_id,
      nome: strumento?.nome ?? '—',
      ticker: strumento?.ticker ?? null,
      isin: strumento?.isin ?? null,
      categoria: traduciCategoria(tCategorie, 'Liquidita'),
      tipo: strumento ? etichettaTipo('Liquidita', strumento.tipo) : '—',
      rendimentoPct: 0,
      rendimentoAssoluto: 0,
      valore: saldo,
      capitaleInvestito: saldo,
      capitaleInvestitoNetto: saldo,
      ricompense: 0,
      peso: valoreTotaleTabella > 0 ? (saldo / valoreTotaleTabella) * 100 : 0,
      nav: null,
      prezzoMedioUnitario: null,
      costo: Number(costo?.costo_totale ?? 0),
      provenienza: contenitore?.nome ?? '—',
    }
  })

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p): RigaTabella => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id)
      const contenitore = p.contenitore_id ? contenitori?.find((c) => c.id === p.contenitore_id) : null
      return {
        key: `${p.strumento_id}-${p.contenitore_id ?? 'diretto'}`,
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        ticker: strumento?.ticker ?? null,
        isin: strumento?.isin ?? null,
        categoria: strumento?.categoria != null ? traduciCategoria(tCategorie, strumento.categoria) : '—',
        tipo: strumento?.tipo != null ? etichettaTipo(strumento.categoria, strumento.tipo) : '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        ricompense: ricompensePosizione(ricompense, p.strumento_id, p.contenitore_id),
        peso: valoreTotaleTabella > 0 ? ((p.valore ?? 0) / valoreTotaleTabella) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? '—',
      }
    })
    .concat(righeLiquidita)
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  // Card: stessi calcoli di PaginaCategoria, sulle righe della tabella.
  const costoTotale = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const ricompenseTotale = righe.reduce((acc, r) => acc + (r.ricompense as number), 0)
  const plusMinusNonRealizzata = valoreTotaleTabella - capitaleInvestitoTotale
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
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('portafoglio')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('tuttiAsset')}</h1>

      <section>
        <Sezione>
          <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotaleTabella} />
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardRendimento
              rendimentoPct={rendimentoPctTotale}
              variazioneOggi={variazioneDaUltimoSnapshot}
              label={tDashboard('titoloRendimentoLive')}
              etichettaOggi={tDashboard('etichettaOggi')}
              href="/rendimenti"
              linkLabel={t('linkRendimenti')}
              info={tTuttiAsset('tooltipRendimentoLive')}
            />

            <CardMetrica
              label={t('labelPlusMinusNonRealizzata')}
              href="/fiscalita"
              linkLabel={t('linkFiscalita')}
              info={tTuttiAsset('tooltipPlusMinusNonRealizzata')}
            >
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata, locale)}
              </span>
            </CardMetrica>

            <CardMetrica label={t('labelCapitaleInvestitoNetto')} href="/gestione/transazioni" linkLabel={t('linkTransazioni')}>
              <CapitaleInvestito capitale={capitaleInvestitoNettoTotale} ricompense={ricompenseTotale} />
            </CardMetrica>

            <CardMetrica label={t('labelCostoTotale')} href="/costi" linkLabel={t('linkCosti')}>
              {formatEuro(costoTotale, locale)}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 12, fontWeight: 500 }}>{t('titoloAsset')}</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} filtro={{ chiavi: CHIAVI_FILTRO_POSIZIONE }} />
        </Sezione>
      </section>
    </div>
  )
}
