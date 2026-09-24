import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'

// Tutte le posizioni aperte delle sei categorie di investimento insieme (la
// Liquidità ha la sua pagina), con la stessa struttura di PaginaCategoria:
// grafico del rendimento, card e tabella. Stesse colonne più la Categoria; il
// Peso è sul totale di questa tabella, non della categoria.
export default async function TuttiAssetPage() {
  const locale = (await getLocale()) as LocaleFormato
  const tMenu = await getTranslations('Menu')
  const tDashboard = await getTranslations('Dashboard')
  const t = await getTranslations('PaginaCategoria')
  const tTuttiAsset = await getTranslations('PaginaTuttiAsset')
  const tContenitore = await getTranslations('PaginaContenitore')
  const tCategorie = await getTranslations('Categorie')
  const tTipiStrumento = await getTranslations('TipiStrumento')

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
    { key: 'provenienza', label: t('colonnaProvenienza'), kind: 'text' },
  ]

  const supabase = await createClient()

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, tipo, categoria')
    .neq('categoria', 'Liquidita')

  const strumentoIds = strumenti?.map((s) => s.id) ?? []

  // Oltre 1000 righe (una per categoria e per giorno): va letta a blocchi.
  const { data: storicoRaw } = await tutteLeRighe((da, a) =>
    supabase
      .from('v_storico_valorizzazioni_per_categoria')
      .select('categoria, data, valore_totale, capitale_investito_totale')
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

  const puntiRendimento: PuntoStorico[] = Array.from(storicoPerData.entries())
    .filter(([data, giorno]) =>
      Array.from(intervalloCategoria.entries()).every(
        ([categoria, { prima, ultima }]) => data < prima || data > ultima || giorno.categorie.has(categoria)
      )
    )
    .map(([data, { valore, capitale, capitaleMancante }]) => {
      if (capitaleMancante || capitale <= 0) return null
      return { data, valore: ((valore - capitale) / capitale) * 100 }
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

  const contenitoreIds = Array.from(
    new Set((posizioni ?? []).map((p) => p.contenitore_id).filter((id): id is string => id !== null))
  )

  const { data: contenitori } = contenitoreIds.length
    ? await supabase.from('contenitori').select('id, nome').in('id', contenitoreIds)
    : { data: null }

  // Il Peso si calcola sulla somma dei valori delle righe mostrate qui, non
  // su v_valore_per_categoria (che è per singola categoria): così i pesi della
  // tabella sommano sempre a 100%.
  const valoreTotaleTabella = (posizioni ?? []).reduce((acc, p) => acc + (p.valore ?? 0), 0)

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p) => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id)
      const contenitore = p.contenitore_id ? contenitori?.find((c) => c.id === p.contenitore_id) : null
      return {
        key: `${p.strumento_id}-${p.contenitore_id ?? 'diretto'}`,
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        categoria: strumento?.categoria != null ? traduciCategoria(tCategorie, strumento.categoria) : '—',
        tipo: strumento?.tipo != null ? traduciTipoStrumento(tTipiStrumento, strumento.tipo) : '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        peso: valoreTotaleTabella > 0 ? ((p.valore ?? 0) / valoreTotaleTabella) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? t('provenienzaDiretto'),
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  // Card: stessi calcoli di PaginaCategoria, sulle righe della tabella.
  const costoTotale = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
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
            />

            <CardMetrica label={t('labelPlusMinusNonRealizzata')} href="/fiscalita" linkLabel={t('linkFiscalita')}>
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata, locale)}
              </span>
            </CardMetrica>

            <CardMetrica label={t('labelCapitaleInvestitoNetto')} href="/gestione/transazioni" linkLabel={t('linkTransazioni')}>
              {formatEuro(capitaleInvestitoNettoTotale, locale)}
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
          <TabellaOrdinabile colonne={COLONNE} righe={righe} />
        </Sezione>
      </section>
    </div>
  )
}
