import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, CHIAVI_FILTRO_POSIZIONE, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { caricaRicompenseResidue, ricompensePosizione } from '@/lib/ricompense'
import { CapitaleInvestito } from '@/components/capitale-investito'

// Pagina di una categoria di investimento (Azioni, Obbligazioni, …), condivisa
// dalle sei route di categoria. categoria è il valore usato per interrogare il
// database (strumenti.categoria), chiaveTraduzione la chiave del namespace
// "Categorie" per il titolo.
export async function PaginaCategoria({ categoria, chiaveTraduzione }: { categoria: string; chiaveTraduzione: string }) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaCategoria')
  const tContenitori = await getTranslations('Contenitori')
  const tCategorie = await getTranslations('Categorie')
  const tDashboard = await getTranslations('Dashboard')
  const tTipiStrumento = await getTranslations('TipiStrumento')

  const COLONNE: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
    { key: 'tipo', label: t('colonnaTipo'), kind: 'text' },
    { key: 'rendimentoPct', label: t('colonnaRendimento'), kind: 'percent-signed' },
    { key: 'rendimentoAssoluto', label: t('colonnaRendimentoEuro'), kind: 'euro-signed' },
    { key: 'valore', label: t('colonnaValore'), kind: 'euro' },
    { key: 'peso', label: t('colonnaPeso'), kind: 'percent', tooltip: t('tooltipPeso') },
    { key: 'nav', label: t('colonnaNav'), kind: 'euro' },
    { key: 'prezzoMedioUnitario', label: t('colonnaPrezzoMedio'), kind: 'euro' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'provenienza', label: tContenitori('colonnaGruppo'), kind: 'text' },
  ]

  const supabase = await createClient()
  const ricompense = await caricaRicompenseResidue(supabase)

  const { data: categoriaValore } = await supabase
    .from('v_valore_per_categoria')
    .select('categoria, valore_totale')
    .eq('categoria', categoria)
    .maybeSingle()

  const valoreTotaleCategoria = categoriaValore?.valore_totale ?? 0

  // Una riga per giorno: letta a blocchi per non fermarsi a 1000 righe.
  const { data: storicoRaw } = await tutteLeRighe((da, a) =>
    supabase
      .from('v_storico_valorizzazioni_per_categoria')
      .select('data, valore_totale, capitale_investito_totale')
      .eq('categoria', categoria)
      .order('data', { ascending: true })
      .range(da, a)
  )

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
    .select('id, nome, tipo, ticker, isin')
    .eq('categoria', categoria)

  const strumentoIds = strumentiCategoria?.map((s) => s.id) ?? []

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta'
        )
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
        ticker: strumento?.ticker ?? null,
        isin: strumento?.isin ?? null,
        tipo: strumento?.tipo != null ? traduciTipoStrumento(tTipiStrumento, strumento.tipo) : '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        ricompense: ricompensePosizione(ricompense, p.strumento_id, p.contenitore_id),
        peso: valoreTotaleCategoria > 0 ? ((p.valore ?? 0) / valoreTotaleCategoria) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? '—',
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  const costoTotaleCategoria = righe.reduce((acc, r) => acc + (r.costo as number), 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + (r.valore as number), 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestito as number), 0)
  const capitaleInvestitoNettoTotale = righe.reduce((acc, r) => acc + (r.capitaleInvestitoNetto as number), 0)
  const ricompenseTotale = righe.reduce((acc, r) => acc + (r.ricompense as number), 0)
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
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{t('etichettaAsset')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tCategorie(chiaveTraduzione)}</h1>

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
              label={tDashboard('titoloRendimentoLive')}
              etichettaOggi={tDashboard('etichettaOggi')}
              href="/returns"
              linkLabel={t('linkRendimenti')}
              info={t('tooltipRendimentoLive')}
            />

            <CardMetrica
              label={t('labelPlusMinusNonRealizzata')}
              href="/tax"
              linkLabel={t('linkFiscalita')}
              info={t('tooltipPlusMinusNonRealizzata')}
            >
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata, locale)}
              </span>
            </CardMetrica>

            <CardMetrica label={t('labelCapitaleInvestitoNetto')} href="/gestione/transazioni" linkLabel={t('linkTransazioni')}>
              <CapitaleInvestito capitale={capitaleInvestitoNettoTotale} ricompense={ricompenseTotale} />
            </CardMetrica>

            <CardMetrica label={t('labelCostoTotale')} href="/costs" linkLabel={t('linkCosti')}>
              {formatEuro(costoTotaleCategoria, locale)}
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
