import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'
import { GraficoStoricoFiscale, type PuntoStoricoFiscale } from '@/components/grafico-storico-fiscale'

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
type Strumento = { id: string; nome: string }
type Contenitore = { id: string; nome: string }

const RIGA_DETTAGLIO_STYLE: React.CSSProperties = { padding: 8 }

const BUCKET_NON_REALIZZATO = ['Totali', 'PAC', 'Polizze', 'Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto'] as const

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

  return (
    <div>
      <h1>Fiscalità</h1>
      <p style={{ color: '#666', maxWidth: 640 }}>
        Sei in regime amministrato: l'intermediario calcola e versa le imposte. Questa sezione serve a
        verificare, non sostituisce il commercialista.
      </p>

      <h2 style={{ marginTop: 32 }}>Anno corrente — {annoCorrente}</h2>
      <section style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 220 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Plus/minusvalenze realizzate nette</div>
          <div
            style={{
              fontSize: 24,
              marginTop: 4,
              color: Number(r.realizzato_netto_totale) >= 0 ? 'green' : '#b91c1c',
            }}
          >
            {formatEuro(Number(r.realizzato_netto_totale))}
          </div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 220 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Tasse trattenute</div>
          <div style={{ fontSize: 24, marginTop: 4 }}>{formatEuro(Number(r.tasse_totali))}</div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 480 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, color: '#666' }}>Imponibile vendite</td>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.imponibile_vendite))}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, color: '#666' }}>Tasse vendite</td>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.tasse_vendite))}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 600 }}>Netto vendite</td>
              <td
                style={{
                  ...RIGA_DETTAGLIO_STYLE,
                  textAlign: 'right',
                  fontWeight: 600,
                  color: Number(r.netto_vendite) >= 0 ? 'green' : '#b91c1c',
                }}
              >
                {formatEuro(Number(r.netto_vendite))}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, color: '#666' }}>Imponibile dividendi</td>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.imponibile_dividendi))}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, color: '#666' }}>Tasse dividendi</td>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.tasse_dividendi))}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 600 }}>Netto dividendi</td>
              <td
                style={{
                  ...RIGA_DETTAGLIO_STYLE,
                  textAlign: 'right',
                  fontWeight: 600,
                  color: Number(r.netto_dividendi) >= 0 ? 'green' : '#b91c1c',
                }}
              >
                {formatEuro(Number(r.netto_dividendi))}
              </td>
            </tr>
            <tr>
              <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 600 }}>Netto switch (Polizze)</td>
              <td
                style={{
                  ...RIGA_DETTAGLIO_STYLE,
                  textAlign: 'right',
                  fontWeight: 600,
                  color: Number(r.netto_switch_polizze) >= 0 ? 'green' : '#b91c1c',
                }}
              >
                {formatEuro(Number(r.netto_switch_polizze))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <h2 style={{ marginTop: 32 }}>Non realizzate — movimento {annoCorrente}</h2>
      <p style={{ color: '#666' }}>Variazione della plus/minusvalenza non realizzata da inizio anno a oggi.</p>
      <section style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {BUCKET_NON_REALIZZATO.map((chiave) => (
          <div key={chiave} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 160 }}>
            <div style={{ fontSize: 13, color: '#666' }}>{chiave}</div>
            <div style={{ fontSize: 18, marginTop: 4, color: bucketMovimento[chiave] >= 0 ? 'green' : '#b91c1c' }}>
              {formatEuro(bucketMovimento[chiave])}
            </div>
          </div>
        ))}
      </section>

      <h2 style={{ marginTop: 32 }}>Storico</h2>
      <GraficoStoricoFiscale punti={puntiStorico} />

      <h2 style={{ marginTop: 32 }}>Non realizzate (stato attuale)</h2>
      <div style={{ fontSize: 28, color: totaleNonRealizzato >= 0 ? 'green' : '#b91c1c' }}>
        {formatEuro(totaleNonRealizzato)}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Strumento</th>
            <th style={{ padding: 8 }}>Contenitore</th>
            <th style={{ padding: 8 }}>Plus/minus</th>
            <th style={{ padding: 8 }}>Rendimento</th>
          </tr>
        </thead>
        <tbody>
          {riepilogo.filter((x) => x.valore != null).map((x) => {
            const guadagno = Number(x.valore) - Number(x.capitale_investito)
            return (
              <tr key={`${x.strumento_id}|${x.contenitore_id ?? ''}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{strumentoMap.get(x.strumento_id) ?? '—'}</td>
                <td style={{ padding: 8 }}>{x.contenitore_id ? contenitoreMap.get(x.contenitore_id) ?? '—' : 'Diretto'}</td>
                <td style={{ padding: 8, color: guadagno >= 0 ? 'green' : '#b91c1c' }}>{formatEuro(guadagno)}</td>
                <td style={{ padding: 8 }}>{x.rendimento_pct != null ? `${x.rendimento_pct.toFixed(2)}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Verifica trattenute</h2>
      <p style={{ color: '#666' }}>Aliquota attesa vs trattenuta effettiva, per ogni vendita imponibile.</p>
      {verifica.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nessuna vendita imponibile registrata finora.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Data</th>
              <th style={{ padding: 8 }}>Strumento</th>
              <th style={{ padding: 8 }}>Plusvalenza</th>
              <th style={{ padding: 8 }}>Aliquota attesa</th>
              <th style={{ padding: 8 }}>Tassa attesa</th>
              <th style={{ padding: 8 }}>Tassa trattenuta</th>
              <th style={{ padding: 8 }}>Differenza</th>
            </tr>
          </thead>
          <tbody>
            {verifica.map((v) => {
              const scostamentoRilevante = Math.abs(Number(v.differenza)) > 0.01
              return (
                <tr key={v.vendita_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{new Date(v.data_vendita).toLocaleDateString('it-IT')}</td>
                  <td style={{ padding: 8 }}>{strumentoMap.get(v.strumento_id) ?? '—'}</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.plusvalenza_totale_vendita))}</td>
                  <td style={{ padding: 8 }}>{Number(v.aliquota_attesa_pct).toFixed(2)}%</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_attesa))}</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_trattenuta_effettiva))}</td>
                  <td style={{ padding: 8, color: scostamentoRilevante ? '#b45309' : undefined, fontWeight: scostamentoRilevante ? 600 : undefined }}>
                    {formatEuro(Number(v.differenza))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}