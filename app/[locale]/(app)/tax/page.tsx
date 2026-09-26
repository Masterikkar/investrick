import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { GraficoStoricoFiscale, type PuntoStoricoFiscale } from '@/components/grafico-storico-fiscale'
import { CardMetrica } from '@/components/card-metrica'
import { type VoceBarra } from '@/components/barre-divergenti'
import { Sezione } from '@/components/sezione'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { SezioneAnnoCorrente } from './sezione-anno-corrente'
import { StoricoPlusMinus, type RigaNonRealizzata, type RigaRealizzata } from './storico-plus-minus'
import { CATEGORIE_MERCATO } from '@/lib/categorie'

const CHIAVE_TRADUZIONE_CONTENITORE_MOVIMENTO: Record<string, string> = {
  PAC: 'pac',
  Polizze: 'polizze',
}

type RealizzatoAnno = {
  anno: number
  netto_vendite: number
  tasse_vendite: number
}
type RealizzatoAnnoStorico = {
  anno: number
  netto_vendite: number
}
// Una riga per vendita fuori polizza o per riscatto di polizza (tipo_riga).
type VerificaTrattenuta = {
  vendita_id: string | null
  data_vendita: string
  strumento_id: string | null
  contenitore_id: string | null
  tipo_riga: 'vendita' | 'riscatto_polizza'
  aliquota_attesa_pct: number
  plusvalenza_totale_vendita: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
  valore_lordo: number
  prezzo_stimato: boolean
  ritenuta_eccessiva: boolean | null
}
// base_fiscale: fuori polizza il costo dei lotti, in polizza la quota dei
// premi residui del contratto. incompleta (solo a inizio anno): la polizza
// ha fondi senza nessun prezzo a quella data.
type NonRealizzatoDettaglio = {
  strumento_id: string
  contenitore_id: string | null
  categoria: string
  contenitore_tipo: string | null
  valore: number | null
  base_fiscale: number | null
  incompleta?: boolean | null
}
type NonRealizzatoPerAnno = {
  anno: number
  valore: number | null
  base_fiscale: number | null
  polizze_incomplete: string[] | null
}
type MovimentoInteresse = {
  strumento_id: string
  data: string
  importo: number
  tassa_trattenuta: number
}
type Strumento = { id: string; nome: string; categoria: string }
type Contenitore = { id: string; nome: string; tipo: string }

// Plus/minusvalenze: esistono solo per gli strumenti di mercato, non per la liquidità.
const BUCKET_NON_REALIZZATO = ['Totali', 'PAC', 'Polizze', ...CATEGORIE_MERCATO]
const CATEGORIE_MOVIMENTO = CATEGORIE_MERCATO
const CONTENITORI_MOVIMENTO = ['PAC', 'Polizze'] as const

const chiaveRiga = (strumentoId: string, contenitoreId: string | null) => `${strumentoId}|${contenitoreId ?? ''}`

function aggregaNonRealizzato(righe: { categoria: string; contenitore_tipo: string | null; netto: number }[]) {
  const risultato: Record<string, number> = {}
  for (const b of BUCKET_NON_REALIZZATO) risultato[b] = 0

  for (const r of righe) {
    risultato.Totali += r.netto
    if (r.contenitore_tipo === 'PAC') risultato.PAC += r.netto
    if (r.contenitore_tipo === 'Polizza') risultato.Polizze += r.netto
    if (r.categoria in risultato) risultato[r.categoria] += r.netto
  }

  return risultato
}

export default async function FiscalitaPage() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaFiscalita')
  const tMenu = await getTranslations('Menu')
  const tCategorie = await getTranslations('Categorie')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

  const [
    { data: realizzatoRaw },
    { data: verificaRaw },
    { data: strumentiRaw },
    { data: contenitoriRaw },
    { data: nonRealizzatoRaw },
    { data: inizioAnnoRaw },
    { data: realizzatoTuttiAnniRaw },
    { data: nonRealizzatoPerAnnoRaw },
    { data: interessiRaw },
  ] = await Promise.all([
    supabase.from('v_realizzato_per_anno').select('anno, netto_vendite, tasse_vendite').eq('anno', annoCorrente).maybeSingle().returns<RealizzatoAnno>(),
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome, categoria').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome, tipo').returns<Contenitore[]>(),
    supabase.from('v_non_realizzato_dettaglio').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, base_fiscale').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_non_realizzato_inizio_anno').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, base_fiscale, incompleta').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_realizzato_per_anno').select('anno, netto_vendite').order('anno', { ascending: true }).returns<RealizzatoAnnoStorico[]>(),
    supabase.from('v_non_realizzato_fiscale_per_anno').select('anno, valore, base_fiscale, polizze_incomplete').order('anno', { ascending: true }).returns<NonRealizzatoPerAnno[]>(),
    supabase.from('movimenti_liquidita').select('strumento_id, data, importo, tassa_trattenuta').eq('tipo_movimento', 'Interesse').returns<MovimentoInteresse[]>(),
  ])

  // Non realizzato fiscale: valore − base fiscale. Per un fondo in polizza la
  // base è la sua quota dei premi residui del contratto, non il costo dei lotti.
  const nonRealizzatoFiscale = (x: NonRealizzatoDettaglio) => Number(x.valore) - Number(x.base_fiscale ?? 0)
  const posizioniAperte = (nonRealizzatoRaw ?? []).filter((x) => x.valore != null)
  const verifica = verificaRaw ?? []
  const strumentoMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))
  const strumentoCategoriaMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.categoria]))
  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))
  const contenitoreTipoMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.tipo]))

  const r: RealizzatoAnno = realizzatoRaw ?? {
    anno: annoCorrente,
    netto_vendite: 0,
    tasse_vendite: 0,
  }

  const totaleNonRealizzato = posizioniAperte.reduce((sum, x) => sum + nonRealizzatoFiscale(x), 0)

  // Polizze incomplete a inizio anno (fondi senza nessun prezzo a quella
  // data): fuori dal confronto da inizio anno, su entrambi i lati.
  const polizzeIncompleteInizioAnno = new Set(
    (inizioAnnoRaw ?? []).filter((x) => x.incompleta && x.contenitore_id).map((x) => x.contenitore_id as string)
  )
  const nelConfronto = (x: NonRealizzatoDettaglio) => !x.contenitore_id || !polizzeIncompleteInizioAnno.has(x.contenitore_id)

  const inizioAnno = (inizioAnnoRaw ?? []).filter(nelConfronto)
  const inizioAnnoMap = new Map(inizioAnno.map((x) => [chiaveRiga(x.strumento_id, x.contenitore_id), x]))
  const oggiMap = new Map(posizioniAperte.map((x) => [chiaveRiga(x.strumento_id, x.contenitore_id), x]))

  const righeMovimento = [
    ...posizioniAperte.filter(nelConfronto).map((x) => {
      const baseline = inizioAnnoMap.get(chiaveRiga(x.strumento_id, x.contenitore_id))
      return {
        categoria: x.categoria,
        contenitore_tipo: x.contenitore_tipo,
        netto: nonRealizzatoFiscale(x) - (baseline ? nonRealizzatoFiscale(baseline) : 0),
      }
    }),
    // In una polizza un fondo uscito con uno switch durante l'anno conta con la
    // sua baseline: così il totale del contratto è oggi − inizio anno. Fuori
    // polizza una posizione chiusa è già nel realizzato.
    ...inizioAnno
      .filter((x) => x.contenitore_tipo === 'Polizza' && !oggiMap.has(chiaveRiga(x.strumento_id, x.contenitore_id)))
      .map((x) => ({ categoria: x.categoria, contenitore_tipo: x.contenitore_tipo, netto: -nonRealizzatoFiscale(x) })),
  ]

  const bucketMovimento = aggregaNonRealizzato(righeMovimento)

  // Come traduciCategoria: t() solo se la chiave è nella mappa.
  function etichettaContenitore(cont: string): string {
    const chiave = CHIAVE_TRADUZIONE_CONTENITORE_MOVIMENTO[cont]
    return chiave ? tContenitori(chiave) : cont
  }

  const vociCategoria: VoceBarra[] = CATEGORIE_MOVIMENTO.map((cat) => ({
    etichetta: traduciCategoria(tCategorie, cat),
    valore: bucketMovimento[cat],
  }))
  const vociContenitore: VoceBarra[] = CONTENITORI_MOVIMENTO.map((cont) => ({
    etichetta: etichettaContenitore(cont),
    valore: bucketMovimento[cont],
  }))

  const venditeAnnoCorrente = verifica.filter((v) => Number(v.data_vendita.slice(0, 4)) === annoCorrente)

  // Un riscatto riguarda il contratto intero: conta nel totale e nelle
  // polizze, non in una categoria.
  const righeRealizzatoMovimento = venditeAnnoCorrente.map((v) => ({
    categoria: v.strumento_id ? strumentoCategoriaMap.get(v.strumento_id) ?? '' : '',
    contenitore_tipo: v.contenitore_id ? contenitoreTipoMap.get(v.contenitore_id) ?? null : null,
    netto: Number(v.plusvalenza_totale_vendita) - Number(v.tassa_trattenuta_effettiva),
  }))

  const bucketRealizzato = aggregaNonRealizzato(righeRealizzatoMovimento)

  const vociCategoriaRealizzate: VoceBarra[] = CATEGORIE_MOVIMENTO.map((cat) => ({
    etichetta: traduciCategoria(tCategorie, cat),
    valore: bucketRealizzato[cat],
  }))
  const vociContenitoreRealizzate: VoceBarra[] = CONTENITORI_MOVIMENTO.map((cont) => ({
    etichetta: etichettaContenitore(cont),
    valore: bucketRealizzato[cont],
  }))

  const interessiAnnoCorrente = (interessiRaw ?? []).filter((m) => Number(m.data.slice(0, 4)) === annoCorrente)

  const interessiPerStrumento = new Map<string, { lordo: number; tassa: number }>()
  for (const m of interessiAnnoCorrente) {
    const esistente = interessiPerStrumento.get(m.strumento_id) ?? { lordo: 0, tassa: 0 }
    esistente.lordo += Number(m.importo)
    esistente.tassa += Number(m.tassa_trattenuta)
    interessiPerStrumento.set(m.strumento_id, esistente)
  }

  const righeInteressi = Array.from(interessiPerStrumento.entries()).map(([strumentoId, v]) => ({
    strumentoId,
    nome: strumentoMap.get(strumentoId) ?? '—',
    lordo: v.lordo,
    tassa: v.tassa,
    netto: v.lordo - v.tassa,
  }))

  const totaleInteressiNetti = righeInteressi.reduce((sum, riga) => sum + riga.netto, 0)

  const realizzatoTotaleDaSempre = (realizzatoTuttiAnniRaw ?? []).reduce(
    (sum, rr) => sum + Number(rr.netto_vendite),
    0
  )

  // Grafico: non realizzato fiscale a fine anno (v_non_realizzato_fiscale_per_anno).
  // Le polizze incomplete a quella data sono già escluse dalla vista.
  const nonRealizzatoPerAnno = new Map((nonRealizzatoPerAnnoRaw ?? []).map((x) => [x.anno, x]))

  const anniStorico = new Set<number>()
  for (const rr of realizzatoTuttiAnniRaw ?? []) anniStorico.add(rr.anno)
  for (const anno of nonRealizzatoPerAnno.keys()) anniStorico.add(anno)

  const puntiStorico: PuntoStoricoFiscale[] = Array.from(anniStorico)
    .sort((a, b) => a - b)
    .map((anno) => {
      const realizzatoAnno = (realizzatoTuttiAnniRaw ?? []).find((rr) => rr.anno === anno)
      const fineAnno = nonRealizzatoPerAnno.get(anno)
      return {
        anno,
        realizzato: realizzatoAnno ? Number(realizzatoAnno.netto_vendite) : 0,
        nonRealizzato: fineAnno ? Number(fineAnno.valore ?? 0) - Number(fineAnno.base_fiscale ?? 0) : 0,
      }
    })

  const nomiPolizze = (ids: Iterable<string>) =>
    Array.from(ids)
      .map((id) => contenitoreMap.get(id) ?? '—')
      .join(', ')

  const avvisoNonRealizzatoAnno =
    polizzeIncompleteInizioAnno.size > 0
      ? t('avvisoPolizzeIncompleteInizioAnno', { elenco: nomiPolizze(polizzeIncompleteInizioAnno) })
      : null

  const anniConPolizzeIncomplete = (nonRealizzatoPerAnnoRaw ?? []).filter((x) => (x.polizze_incomplete ?? []).length > 0)
  const avvisoGrafico =
    anniConPolizzeIncomplete.length > 0
      ? t('avvisoPolizzeIncompleteGrafico', {
          elenco: anniConPolizzeIncomplete.map((x) => `${x.anno}: ${nomiPolizze(x.polizze_incomplete ?? [])}`).join('; '),
        })
      : null

  const righeVerifica: RigaRealizzata[] = verifica.map((v) => {
    const riscatto = v.tipo_riga === 'riscatto_polizza'
    return {
      key: v.vendita_id ?? `${v.contenitore_id}|${v.data_vendita}`,
      tipo_riga: v.tipo_riga,
      data_vendita: v.data_vendita,
      strumento_id: v.strumento_id,
      contenitore_id: v.contenitore_id,
      // Un riscatto riguarda la polizza intera: al posto del fondo, il suo nome.
      strumento_nome: riscatto
        ? (v.contenitore_id ? contenitoreMap.get(v.contenitore_id) : null) ?? '—'
        : (v.strumento_id ? strumentoMap.get(v.strumento_id) : null) ?? '—',
      valore: Number(v.valore_lordo),
      plusvalenza_totale_vendita: Number(v.plusvalenza_totale_vendita),
      aliquota_attesa_pct: Number(v.aliquota_attesa_pct),
      tassa_attesa: Number(v.tassa_attesa),
      tassa_trattenuta_effettiva: Number(v.tassa_trattenuta_effettiva),
      differenza: Number(v.differenza),
      prezzo_stimato: Boolean(v.prezzo_stimato),
      ritenuta_eccessiva: Boolean(v.ritenuta_eccessiva),
    }
  })

  const righeStoricoNonRealizzate: RigaNonRealizzata[] = posizioniAperte.map((x) => {
    const base = Number(x.base_fiscale ?? 0)
    return {
      key: chiaveRiga(x.strumento_id, x.contenitore_id),
      strumento_id: x.strumento_id,
      strumento_nome: strumentoMap.get(x.strumento_id) ?? '—',
      contenitore_nome: x.contenitore_id ? contenitoreMap.get(x.contenitore_id) ?? '—' : '—',
      plus_minus: nonRealizzatoFiscale(x),
      rendimento_pct: base > 0 ? Math.round((nonRealizzatoFiscale(x) / base) * 10000) / 100 : 0,
    }
  })

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('fiscalita')}</h1>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloAnnoCorrente', { anno: annoCorrente })}</h2>
        <SezioneAnnoCorrente
          annoCorrente={annoCorrente}
          realizzato={r}
          vociCategoriaRealizzate={vociCategoriaRealizzate}
          vociContenitoreRealizzate={vociContenitoreRealizzate}
          totaleMovimentoNonRealizzato={bucketMovimento.Totali}
          vociCategoria={vociCategoria}
          vociContenitore={vociContenitore}
          totaleInteressiNetti={totaleInteressiNetti}
          righeInteressi={righeInteressi}
          avvisoNonRealizzato={avvisoNonRealizzatoAnno}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloStorico')}</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>{t('titoloPlusMinusvalenze')}</h3>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
            {t('paragrafoStoricoPlusMinus')}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label={t('labelTotaleRealizzateNette')} minWidth={220}>
              <span style={{ color: realizzatoTotaleDaSempre >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(realizzatoTotaleDaSempre, locale)}
              </span>
            </CardMetrica>
            <CardMetrica label={t('labelTotaleNonRealizzate')} minWidth={220}>
              <span style={{ color: totaleNonRealizzato >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(totaleNonRealizzato, locale)}
              </span>
            </CardMetrica>
          </div>

          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 24, marginBottom: 4 }}>{t('labelAndamento')}</p>
          <GraficoStoricoFiscale punti={puntiStorico} />
          {avvisoGrafico && (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', marginTop: 8, marginBottom: 0 }}>{avvisoGrafico}</p>
          )}

          <div style={{ marginTop: 24 }}>
            <StoricoPlusMinus righeRealizzate={righeVerifica} righeNonRealizzate={righeStoricoNonRealizzate} />
          </div>
        </Sezione>
      </section>
    </div>
  )
}