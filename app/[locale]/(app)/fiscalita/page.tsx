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

type RiepilogoPosizione = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  valore: number | null
  rendimento_pct: number | null
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
type VerificaTrattenuta = {
  vendita_id: string
  data_vendita: string
  strumento_id: string
  contenitore_id: string | null
  titolo_di_stato: boolean
  aliquota_attesa_pct: number
  plusvalenza_totale_vendita: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
}
type NonRealizzatoDettaglio = {
  strumento_id: string
  contenitore_id: string | null
  categoria: string
  contenitore_tipo: string | null
  valore: number | null
  capitale_investito: number
}
type StoricoTotale = {
  data: string | null
  valore_totale: number | null
  capitale_investito_totale: number | null
}
type MovimentoInteresse = {
  strumento_id: string
  data: string
  importo: number
  tassa_trattenuta: number
}
type TransazioneVendita = {
  id: string
  quantita: number
  prezzo_unitario: number
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
    { data: riepilogoRaw },
    { data: realizzatoRaw },
    { data: verificaRaw },
    { data: strumentiRaw },
    { data: contenitoriRaw },
    { data: nonRealizzatoRaw },
    { data: inizioAnnoRaw },
    { data: realizzatoTuttiAnniRaw },
    { data: storicoTotaleRaw },
    { data: interessiRaw },
    { data: venditeGrezzeRaw },
  ] = await Promise.all([
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore, rendimento_pct').returns<RiepilogoPosizione[]>(),
    supabase.from('v_realizzato_per_anno').select('anno, netto_vendite, tasse_vendite').eq('anno', annoCorrente).maybeSingle().returns<RealizzatoAnno>(),
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome, categoria').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome, tipo').returns<Contenitore[]>(),
    supabase.from('v_non_realizzato_dettaglio').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_non_realizzato_inizio_anno').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_realizzato_per_anno').select('anno, netto_vendite').order('anno', { ascending: true }).returns<RealizzatoAnnoStorico[]>(),
    supabase.from('v_storico_valorizzazioni_totale').select('data, valore_totale, capitale_investito_totale').order('data', { ascending: true }).returns<StoricoTotale[]>(),
    supabase.from('movimenti_liquidita').select('strumento_id, data, importo, tassa_trattenuta').eq('tipo_movimento', 'Interesse').returns<MovimentoInteresse[]>(),
    // v_verifica_trattenute.vendita_id coincide con l'id della transazione
    // di vendita in "transazioni" — recuperiamo qui quantità e prezzo per
    // calcolare il "Valore" (ricavo lordo) di ogni vendita, dato assente
    // dalla vista.
    supabase.from('transazioni').select('id, quantita, prezzo_unitario').in('operazione', ['Vendita', 'Scambio_cessione']).returns<TransazioneVendita[]>(),
  ])

  const riepilogo = (riepilogoRaw ?? []).filter((r) => r.quantita_posseduta > 0)
  const verifica = verificaRaw ?? []
  const strumentoMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))
  const strumentoCategoriaMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.categoria]))
  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))
  const contenitoreTipoMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.tipo]))
  const valoreVenditaMap = new Map(
    (venditeGrezzeRaw ?? []).map((t) => [t.id, Number(t.quantita) * Number(t.prezzo_unitario)])
  )

  const r: RealizzatoAnno = realizzatoRaw ?? {
    anno: annoCorrente,
    netto_vendite: 0,
    tasse_vendite: 0,
  }

  const totaleNonRealizzato = riepilogo.reduce(
    (sum, x) => sum + (x.valore != null ? Number(x.valore) - Number(x.capitale_investito) : 0),
    0
  )

  const inizioAnnoMap = new Map(
    (inizioAnnoRaw ?? []).map((x) => [chiaveRiga(x.strumento_id, x.contenitore_id), x])
  )

  const righeMovimento = (nonRealizzatoRaw ?? [])
    .filter((x) => x.valore != null)
    .map((x) => {
      const oggi = Number(x.valore) - Number(x.capitale_investito)
      const baseline = inizioAnnoMap.get(chiaveRiga(x.strumento_id, x.contenitore_id))
      const nettoInizioAnno = baseline ? Number(baseline.valore) - Number(baseline.capitale_investito) : 0
      return {
        categoria: x.categoria,
        contenitore_tipo: x.contenitore_tipo,
        netto: oggi - nettoInizioAnno,
      }
    })

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

  const righeRealizzatoMovimento = venditeAnnoCorrente.map((v) => ({
    categoria: strumentoCategoriaMap.get(v.strumento_id) ?? '',
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

  const ultimoPerAnno = new Map<number, { data: string; valore: number; capitale: number }>()
  for (const s of storicoTotaleRaw ?? []) {
    if (!s.data) continue
    const anno = Number(s.data.slice(0, 4))
    const esistente = ultimoPerAnno.get(anno)
    if (!esistente || s.data > esistente.data) {
      ultimoPerAnno.set(anno, {
        data: s.data,
        valore: Number(s.valore_totale ?? 0),
        capitale: Number(s.capitale_investito_totale ?? 0),
      })
    }
  }

  const anniStorico = new Set<number>()
  for (const rr of realizzatoTuttiAnniRaw ?? []) anniStorico.add(rr.anno)
  for (const anno of ultimoPerAnno.keys()) anniStorico.add(anno)

  const puntiStorico: PuntoStoricoFiscale[] = Array.from(anniStorico)
    .sort((a, b) => a - b)
    .map((anno) => {
      const realizzatoAnno = (realizzatoTuttiAnniRaw ?? []).find((rr) => rr.anno === anno)
      const snapshot = ultimoPerAnno.get(anno)
      return {
        anno,
        realizzato: realizzatoAnno ? Number(realizzatoAnno.netto_vendite) : 0,
        nonRealizzato: snapshot ? snapshot.valore - snapshot.capitale : 0,
      }
    })

  const righeVerifica: RigaRealizzata[] = verifica.map((v) => ({
    vendita_id: v.vendita_id,
    data_vendita: v.data_vendita,
    strumento_id: v.strumento_id,
    strumento_nome: strumentoMap.get(v.strumento_id) ?? '—',
    valore: valoreVenditaMap.get(v.vendita_id) ?? 0,
    plusvalenza_totale_vendita: Number(v.plusvalenza_totale_vendita),
    aliquota_attesa_pct: Number(v.aliquota_attesa_pct),
    tassa_attesa: Number(v.tassa_attesa),
    tassa_trattenuta_effettiva: Number(v.tassa_trattenuta_effettiva),
    differenza: Number(v.differenza),
  }))

  const righeStoricoNonRealizzate: RigaNonRealizzata[] = riepilogo
    .filter((x) => x.valore != null)
    .map((x) => ({
      key: chiaveRiga(x.strumento_id, x.contenitore_id),
      strumento_id: x.strumento_id,
      strumento_nome: strumentoMap.get(x.strumento_id) ?? '—',
      contenitore_nome: x.contenitore_id ? contenitoreMap.get(x.contenitore_id) ?? '—' : '—',
      plus_minus: Number(x.valore) - Number(x.capitale_investito),
      rendimento_pct: x.rendimento_pct ?? 0,
    }))

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

          <div style={{ marginTop: 24 }}>
            <StoricoPlusMinus righeRealizzate={righeVerifica} righeNonRealizzate={righeStoricoNonRealizzate} />
          </div>
        </Sezione>
      </section>
    </div>
  )
}