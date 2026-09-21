import { createClient } from '@/lib/supabase/server'
import { formatEuroSigned } from '@/lib/format'
import { GraficoStoricoFiscale, type PuntoStoricoFiscale } from '@/components/grafico-storico-fiscale'
import { CardMetrica } from '@/components/card-metrica'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { type VoceBarra } from '@/components/barre-divergenti'
import { Sezione } from '@/components/sezione'
import { SezioneAnnoCorrente } from './sezione-anno-corrente'
import { VerificaTrattenuteTabella, type RigaVerificaTrattenuta } from './verifica-trattenute'

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
  imponibile_vendite: number
  tasse_vendite: number
  netto_vendite: number
  imponibile_dividendi: number
  tasse_dividendi: number
  netto_dividendi: number
  netto_switch_polizze: number
  realizzato_netto_totale: number
  tasse_totali: number
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
type Strumento = { id: string; nome: string }
type Contenitore = { id: string; nome: string }

const BUCKET_NON_REALIZZATO = ['Totali', 'PAC', 'Polizze', 'Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto'] as const
const CATEGORIE_MOVIMENTO = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto'] as const
const CONTENITORI_MOVIMENTO = ['PAC', 'Polizze'] as const

const COLONNE_NON_REALIZZATE: ColonnaTabella[] = [
  { key: 'nome', label: 'Strumento', kind: 'text' },
  { key: 'contenitore', label: 'Contenitore', kind: 'text' },
  { key: 'plusMinus', label: 'Plus/minus', kind: 'euro-signed' },
  { key: 'rendimento', label: 'Rendimento', kind: 'percent' },
]

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
  ] = await Promise.all([
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore, rendimento_pct').returns<RiepilogoPosizione[]>(),
    supabase.from('v_realizzato_per_anno').select('*').eq('anno', annoCorrente).maybeSingle().returns<RealizzatoAnno>(),
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
    supabase.from('v_non_realizzato_dettaglio').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_non_realizzato_inizio_anno').select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito').returns<NonRealizzatoDettaglio[]>(),
    supabase.from('v_realizzato_per_anno').select('anno, realizzato_netto_totale').order('anno', { ascending: true }).returns<{ anno: number; realizzato_netto_totale: number }[]>(),
    supabase.from('v_storico_valorizzazioni_totale').select('data, valore_totale, capitale_investito_totale').order('data', { ascending: true }).returns<StoricoTotale[]>(),
    supabase.from('movimenti_liquidita').select('strumento_id, data, importo, tassa_trattenuta').eq('tipo_movimento', 'Interesse').returns<MovimentoInteresse[]>(),
  ])

  const riepilogo = (riepilogoRaw ?? []).filter((r) => r.quantita_posseduta > 0)
  const verifica = verificaRaw ?? []
  const strumentoMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))
  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))

  const r: RealizzatoAnno = realizzatoRaw ?? {
    anno: annoCorrente,
    imponibile_vendite: 0,
    tasse_vendite: 0,
    netto_vendite: 0,
    imponibile_dividendi: 0,
    tasse_dividendi: 0,
    netto_dividendi: 0,
    netto_switch_polizze: 0,
    realizzato_netto_totale: 0,
    tasse_totali: 0,
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

  const vociCategoria: VoceBarra[] = CATEGORIE_MOVIMENTO.map((cat) => ({ etichetta: cat, valore: bucketMovimento[cat] }))
  const vociContenitore: VoceBarra[] = CONTENITORI_MOVIMENTO.map((cont) => ({ etichetta: cont, valore: bucketMovimento[cont] }))

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
    (sum, rr) => sum + Number(rr.realizzato_netto_totale),
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
        realizzato: realizzatoAnno ? Number(realizzatoAnno.realizzato_netto_totale) : 0,
        nonRealizzato: snapshot ? snapshot.valore - snapshot.capitale : 0,
      }
    })

  const righeNonRealizzate: RigaTabella[] = riepilogo
    .filter((x) => x.valore != null)
    .map((x) => ({
      key: chiaveRiga(x.strumento_id, x.contenitore_id),
      nome: strumentoMap.get(x.strumento_id) ?? '—',
      contenitore: x.contenitore_id ? contenitoreMap.get(x.contenitore_id) ?? '—' : 'Diretto',
      plusMinus: Number(x.valore) - Number(x.capitale_investito),
      rendimento: x.rendimento_pct ?? 0,
    }))

  const righeVerifica: RigaVerificaTrattenuta[] = verifica.map((v) => ({
    vendita_id: v.vendita_id,
    data_vendita: v.data_vendita,
    strumento_id: v.strumento_id,
    strumento_nome: strumentoMap.get(v.strumento_id) ?? '—',
    plusvalenza_totale_vendita: Number(v.plusvalenza_totale_vendita),
    aliquota_attesa_pct: Number(v.aliquota_attesa_pct),
    tassa_attesa: Number(v.tassa_attesa),
    tassa_trattenuta_effettiva: Number(v.tassa_trattenuta_effettiva),
    differenza: Number(v.differenza),
  }))

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>Analisi</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>Fiscalità</h1>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Anno corrente — {annoCorrente}</h2>
        <SezioneAnnoCorrente
          annoCorrente={annoCorrente}
          realizzato={r}
          totaleMovimentoNonRealizzato={bucketMovimento.Totali}
          vociCategoria={vociCategoria}
          vociContenitore={vociContenitore}
          totaleInteressiNetti={totaleInteressiNetti}
          righeInteressi={righeInteressi}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Storico</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>Plus/minusvalenze</h3>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Storico delle plus/minusvalenze realizzate e non realizzate.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label="Totale realizzate nette" minWidth={220}>
              <span style={{ color: realizzatoTotaleDaSempre >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(realizzatoTotaleDaSempre)}
              </span>
            </CardMetrica>
            <CardMetrica label="Totale non realizzate" minWidth={220}>
              <span style={{ color: totaleNonRealizzato >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(totaleNonRealizzato)}
              </span>
            </CardMetrica>
          </div>

          <div style={{ marginTop: 24 }}>
            <GraficoStoricoFiscale punti={puntiStorico} />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Non realizzate (da sempre)</h2>
        <Sezione>
          <div
            style={{
              fontFamily: 'var(--font-zilla-slab)',
              fontWeight: 600,
              fontSize: 'var(--fs-hero-secondario)',
              marginBottom: 16,
              color: totaleNonRealizzato >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {formatEuroSigned(totaleNonRealizzato)}
          </div>
          <TabellaOrdinabile colonne={COLONNE_NON_REALIZZATE} righe={righeNonRealizzate} />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 4 }}>Verifica trattenute</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Aliquota attesa vs trattenuta effettiva, per ogni vendita imponibile.
        </p>
        <Sezione>
          {righeVerifica.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>
              Nessuna vendita imponibile registrata finora.
            </p>
          ) : (
            <VerificaTrattenuteTabella righe={righeVerifica} />
          )}
        </Sezione>
      </section>
    </div>
  )
}