import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, formatPercent } from '@/lib/format'
import { GraficoStoricoFiscale, type PuntoStoricoFiscale } from '@/components/grafico-storico-fiscale'
import { CardMetrica } from '@/components/card-metrica'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { Sezione } from '@/components/sezione'

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

  const righeNonRealizzate: RigaTabella[] = riepilogo
    .filter((x) => x.valore != null)
    .map((x) => ({
      key: chiaveRiga(x.strumento_id, x.contenitore_id),
      nome: strumentoMap.get(x.strumento_id) ?? '—',
      contenitore: x.contenitore_id ? contenitoreMap.get(x.contenitore_id) ?? '—' : 'Diretto',
      plusMinus: Number(x.valore) - Number(x.capitale_investito),
      rendimento: x.rendimento_pct ?? 0,
    }))

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>Analisi</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>Fiscalità</h1>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Anno corrente — {annoCorrente}</h2>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label="Plus/minusvalenze realizzate nette" minWidth={220}>
              <span style={{ color: Number(r.realizzato_netto_totale) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(Number(r.realizzato_netto_totale))}
              </span>
            </CardMetrica>
            <CardMetrica label="Tasse trattenute" minWidth={220}>
              {formatEuro(Number(r.tasse_totali))}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 16 }}>
        <Sezione>
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 480, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, color: 'var(--text-secondary)' }}>Imponibile vendite</td>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.imponibile_vendite))}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, color: 'var(--text-secondary)' }}>Tasse vendite</td>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.tasse_vendite))}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 500 }}>Netto vendite</td>
                <td
                  style={{
                    ...RIGA_DETTAGLIO_STYLE,
                    textAlign: 'right',
                    fontWeight: 500,
                    color: Number(r.netto_vendite) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {formatEuroSigned(Number(r.netto_vendite))}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, color: 'var(--text-secondary)' }}>Imponibile dividendi</td>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.imponibile_dividendi))}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, color: 'var(--text-secondary)' }}>Tasse dividendi</td>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, textAlign: 'right' }}>{formatEuro(Number(r.tasse_dividendi))}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 500 }}>Netto dividendi</td>
                <td
                  style={{
                    ...RIGA_DETTAGLIO_STYLE,
                    textAlign: 'right',
                    fontWeight: 500,
                    color: Number(r.netto_dividendi) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {formatEuroSigned(Number(r.netto_dividendi))}
                </td>
              </tr>
              <tr>
                <td style={{ ...RIGA_DETTAGLIO_STYLE, fontWeight: 500 }}>Netto switch (Polizze)</td>
                <td
                  style={{
                    ...RIGA_DETTAGLIO_STYLE,
                    textAlign: 'right',
                    fontWeight: 500,
                    color: Number(r.netto_switch_polizze) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {formatEuroSigned(Number(r.netto_switch_polizze))}
                </td>
              </tr>
            </tbody>
          </table>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 4 }}>Non realizzate — movimento {annoCorrente}</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Variazione della plus/minusvalenza non realizzata da inizio anno a oggi.
        </p>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {BUCKET_NON_REALIZZATO.map((chiave) => (
              <CardMetrica key={chiave} label={chiave} minWidth={160}>
                <span style={{ color: bucketMovimento[chiave] >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatEuroSigned(bucketMovimento[chiave])}
                </span>
              </CardMetrica>
            ))}
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Storico</h2>
        <Sezione>
          <GraficoStoricoFiscale punti={puntiStorico} />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Non realizzate (stato attuale)</h2>
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
          {verifica.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>
              Nessuna vendita imponibile registrata finora.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Data</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Plusvalenza</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Aliquota attesa</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa attesa</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa trattenuta</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Differenza</th>
                </tr>
              </thead>
              <tbody>
                {verifica.map((v) => {
                  const scostamentoRilevante = Math.abs(Number(v.differenza)) > 0.01
                  return (
                    <tr key={v.vendita_id} className="tabella-riga">
                      <td style={{ padding: 8 }}>{new Date(v.data_vendita).toLocaleDateString('it-IT')}</td>
                      <td style={{ padding: 8 }}>{strumentoMap.get(v.strumento_id) ?? '—'}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(v.plusvalenza_totale_vendita))}</td>
                      <td style={{ padding: 8 }}>{formatPercent(Number(v.aliquota_attesa_pct), 2)}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_attesa))}</td>
                      <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_trattenuta_effettiva))}</td>
                      <td
                        style={{
                          padding: 8,
                          color: scostamentoRilevante ? 'var(--warning)' : undefined,
                          fontWeight: scostamentoRilevante ? 500 : undefined,
                        }}
                      >
                        {formatEuro(Number(v.differenza))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Sezione>
      </section>
    </div>
  )
}