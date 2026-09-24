import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoLineaSemplice, type PuntoLineaSemplice } from '@/components/grafico-linea-semplice'
import { GraficoBarre, type PuntoBarra } from '@/components/grafico-barre'
import { Sezione } from '@/components/sezione'
import { CHIAVE_TRADUZIONE_TIPO_LIQUIDITA } from '@/lib/i18n-tipi-liquidita'

type MovimentoInteresse = {
  data: string
  importo: number
  tassa_trattenuta: number
}

export default async function LiquiditaPage() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaLiquidita')
  const tTipi = await getTranslations('TipiLiquidita')

  // Solo i tipi mappati hanno una traduzione; un tipo non mappato resta
  // com'è scritto nel database invece di finire in t() come chiave.
  function etichettaTipo(ti: string): string {
    const chiave = CHIAVE_TRADUZIONE_TIPO_LIQUIDITA[ti]
    return chiave ? tTipi(chiave) : ti
  }
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

  const COLONNE: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/liquidita/', linkKey: 'strumentoId' },
    { key: 'tipo', label: t('colonnaTipo'), kind: 'text' },
    { key: 'provider', label: t('colonnaProvider'), kind: 'text' },
    { key: 'valore', label: t('colonnaValore'), kind: 'euro' },
    { key: 'interesseLordo', label: t('colonnaInteresseLordo'), kind: 'euro' },
    { key: 'interesseNetto', label: t('colonnaInteresseNetto'), kind: 'euro' },
    { key: 'tassaTrattenuta', label: t('colonnaTassaTrattenuta'), kind: 'euro' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
  ]

  const COLONNE_STORICO_INTERESSI: ColonnaTabella[] = [
    { key: 'anno', label: t('colonnaAnno'), kind: 'text' },
    { key: 'netto', label: t('colonnaNettoRicevuto'), kind: 'euro-signed' },
    { key: 'tasse', label: t('colonnaTassePagate'), kind: 'euro' },
  ]

  const NOMI_MESI = Array.from({ length: 12 }, (_, i) => t(`mese${i + 1}`))

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
        .select('id, nome, tipo, provider')
        .in('id', strumentoIds)
    : { data: null }

  const { data: costi } = contenitoreId
    ? await supabase
        .from('v_costo_liquidita')
        .select('strumento_id, costo_totale')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: interessiAggregati } = contenitoreId
    ? await supabase
        .from('v_interessi_liquidita')
        .select('strumento_id, interessi_lordi, tasse_trattenute, interessi_totali')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: interessiRaw } = contenitoreId
    ? await supabase
        .from('movimenti_liquidita')
        .select('data, importo, tassa_trattenuta')
        .eq('contenitore_id', contenitoreId)
        .eq('tipo_movimento', 'Interesse')
        .order('data', { ascending: true })
        .returns<MovimentoInteresse[]>()
    : { data: null }

  const righe: RigaTabella[] = (saldi ?? [])
    .map((s) => {
      const strumento = strumenti?.find((str) => str.id === s.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === s.strumento_id)
      const interesse = interessiAggregati?.find((i) => i.strumento_id === s.strumento_id)
      const tipo = strumento?.tipo ?? '—'
      return {
        key: s.strumento_id ?? '—',
        strumentoId: s.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento ? etichettaTipo(tipo) : '—',
        provider: strumento?.provider ?? '',
        valore: s.saldo_corrente ?? 0,
        interesseLordo: interesse?.interessi_lordi ?? 0,
        interesseNetto: interesse?.interessi_totali ?? 0,
        tassaTrattenuta: interesse?.tasse_trattenute ?? 0,
        costo: costo?.costo_totale ?? 0,
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  // --- Interessi: YTD, cumulato anno corrente, mensile anno corrente, storico per anno ---
  const interessi = (interessiRaw ?? []).map((r) => ({
    data: r.data,
    netto: Number(r.importo) - Number(r.tassa_trattenuta),
    tassa: Number(r.tassa_trattenuta),
    anno: Number(r.data.slice(0, 4)),
  }))

  const interessiAnnoCorrente = interessi
    .filter((r) => r.anno === annoCorrente)
    .sort((a, b) => a.data.localeCompare(b.data))

  const interesseNettoYtd = interessiAnnoCorrente.reduce((sum, r) => sum + r.netto, 0)

  const puntiCumulati: PuntoLineaSemplice[] = []
  let cumulato = 0
  for (const r of interessiAnnoCorrente) {
    cumulato += r.netto
    puntiCumulati.push({ data: r.data, valore: cumulato })
  }

  const perMese = new Array(12).fill(0)
  for (const r of interessiAnnoCorrente) {
    const mese = Number(r.data.slice(5, 7)) - 1
    perMese[mese] += r.netto
  }
  const puntiMensili: PuntoBarra[] = perMese.map((valore, i) => ({ etichetta: NOMI_MESI[i], valore }))

  const perAnno = new Map<number, { netto: number; tasse: number }>()
  for (const r of interessi) {
    const esistente = perAnno.get(r.anno) ?? { netto: 0, tasse: 0 }
    esistente.netto += r.netto
    esistente.tasse += r.tassa
    perAnno.set(r.anno, esistente)
  }
  const righeStoricoAnni: RigaTabella[] = Array.from(perAnno.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([anno, v]) => ({ key: String(anno), anno, netto: v.netto, tasse: v.tasse }))

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('etichettaContenitore')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>
        {liquidita?.nome ?? tContenitori('liquidita')}
      </h1>

      <section>
        <Sezione>
          <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 48, margin: 0, color: 'var(--text-primary)' }}>
            {formatEuro(valoreTotale, locale)}
          </p>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloInteressiAnno', { anno: annoCorrente })}</h2>
        <Sezione>
          <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 36, margin: 0, color: interesseNettoYtd >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(interesseNettoYtd, locale)}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>{t('labelNettoDaInizioAnno')}</p>

          <div style={{ maxWidth: 1024 }}>
            <GraficoLineaSemplice punti={puntiCumulati} messaggioNessunDato={t('alertNessunDatoAnno')} />
          </div>

          <div style={{ marginTop: 24, maxWidth: 1024 }}>
            <GraficoBarre punti={puntiMensili} />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloStoricoInteressi')}</h2>
        <Sezione>
          {righeStoricoAnni.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunInteresse')}</p>
          ) : (
            <TabellaOrdinabile colonne={COLONNE_STORICO_INTERESSI} righe={righeStoricoAnni} />
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>{t('titoloStrumenti')}</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} />
        </Sezione>
      </section>
    </div>
  )
}
