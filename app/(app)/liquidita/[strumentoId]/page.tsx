import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'
import { GraficoLineaSemplice, type PuntoLineaSemplice } from '@/components/grafico-linea-semplice'
import { GraficoBarreMensili, type PuntoMensile } from '@/components/grafico-barre-mensili'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from '../../transazioni/storico-movimenti-liquidita'

const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

type SaldoRiga = { contenitore_id: string | null; saldo_corrente: number }
type CostoRiga = { contenitore_id: string | null; costo_totale: number }
type InteressiRiga = {
  contenitore_id: string | null
  interessi_lordi: number
  tasse_trattenute: number
  interessi_totali: number
}
type StoricoRiga = { contenitore_id: string | null; data: string; prezzo: number }
type MovimentoRaw = {
  id: string
  data: string
  tipo_movimento: string
  contenitore_id: string | null
  importo: number
  tassa_trattenuta: number
}

export default async function LiquiditaStrumentoPage({
  params,
}: {
  params: Promise<{ strumentoId: string }>
}) {
  const { strumentoId } = await params
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

  const [
    { data: strumento },
    { data: saldiRaw },
    { data: costiRaw },
    { data: interessiRaw },
    { data: storicoRaw },
    { data: movimentiRaw },
    { data: contenitori },
  ] = await Promise.all([
    supabase.from('strumenti').select('id, nome, tipo, provider').eq('id', strumentoId).maybeSingle(),
    supabase
      .from('v_saldo_liquidita')
      .select('contenitore_id, saldo_corrente')
      .eq('strumento_id', strumentoId)
      .returns<SaldoRiga[]>(),
    supabase
      .from('v_costo_liquidita')
      .select('contenitore_id, costo_totale')
      .eq('strumento_id', strumentoId)
      .returns<CostoRiga[]>(),
    supabase
      .from('v_interessi_liquidita')
      .select('contenitore_id, interessi_lordi, tasse_trattenute, interessi_totali')
      .eq('strumento_id', strumentoId)
      .returns<InteressiRiga[]>(),
    supabase
      .from('storico_valorizzazioni')
      .select('contenitore_id, data, prezzo')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: true })
      .returns<StoricoRiga[]>(),
    supabase
      .from('movimenti_liquidita')
      .select('id, data, tipo_movimento, contenitore_id, importo, tassa_trattenuta')
      .eq('strumento_id', strumentoId)
      .order('data', { ascending: false })
      .returns<MovimentoRaw[]>(),
    supabase.from('contenitori').select('id, nome').order('nome'),
  ])

  if (!strumento) {
    return <div>Strumento non trovato.</div>
  }

  const saldoAttuale = (saldiRaw ?? []).reduce((s, r) => s + Number(r.saldo_corrente ?? 0), 0)
  const costoTotale = (costiRaw ?? []).reduce((s, r) => s + Number(r.costo_totale ?? 0), 0)
  const interessiLordi = (interessiRaw ?? []).reduce((s, r) => s + Number(r.interessi_lordi ?? 0), 0)
  const interessiNetti = (interessiRaw ?? []).reduce((s, r) => s + Number(r.interessi_totali ?? 0), 0)
  const tasseTrattenute = (interessiRaw ?? []).reduce((s, r) => s + Number(r.tasse_trattenute ?? 0), 0)

  // --- Saldo nel tempo (somma per data, nel caso lo strumento sia in più contenitori) ---
  const saldoPerData = new Map<string, number>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    saldoPerData.set(r.data, (saldoPerData.get(r.data) ?? 0) + Number(r.prezzo))
  }
  const puntiSaldo: PuntoLineaSemplice[] = Array.from(saldoPerData.entries())
    .map(([data, valore]) => ({ data, valore }))
    .sort((a, b) => a.data.localeCompare(b.data))

  // --- Interessi: YTD, cumulato anno corrente, mensile anno corrente, storico per anno ---
  const interessi = (movimentiRaw ?? [])
    .filter((m) => m.tipo_movimento === 'Interesse')
    .map((m) => ({
      data: m.data,
      netto: Number(m.importo) - Number(m.tassa_trattenuta),
      tassa: Number(m.tassa_trattenuta),
      anno: Number(m.data.slice(0, 4)),
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
  const puntiMensili: PuntoMensile[] = perMese.map((valore, i) => ({ mese: NOMI_MESI[i], valore }))

  const perAnno = new Map<number, { netto: number; tasse: number }>()
  for (const r of interessi) {
    const esistente = perAnno.get(r.anno) ?? { netto: 0, tasse: 0 }
    esistente.netto += r.netto
    esistente.tasse += r.tassa
    perAnno.set(r.anno, esistente)
  }
  const righeStoricoAnni = Array.from(perAnno.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([anno, v]) => ({ anno, netto: v.netto, tasse: v.tasse }))

  // --- Storico movimenti (tutti i tipi, per la tabella in fondo) ---
  const storicoMovimenti: RigaStoricoMovimentoLiquidita[] = (movimentiRaw ?? []).map((m) => ({
    id: m.id,
    data: m.data,
    tipo_movimento: m.tipo_movimento,
    contenitore_id: m.contenitore_id,
    importo: Number(m.importo),
    tassa_trattenuta: Number(m.tassa_trattenuta),
    strumento_id: strumentoId,
    strumento_nome: strumento.nome,
  }))

  return (
    <div>
      <Link href="/liquidita" style={{ fontSize: 13 }}>
        ← Liquidità
      </Link>

      <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>
        {[strumento.tipo, strumento.provider].filter(Boolean).join(' · ')}
      </div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>{strumento.nome}</h1>

      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>{formatEuro(saldoAttuale)}</p>

      <div style={{ marginTop: 16, maxWidth: 520 }}>
        <GraficoLineaSemplice punti={puntiSaldo} />
      </div>

      <section style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Interesse lordo</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(interessiLordi)}</div>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Interesse netto</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(interessiNetti)}</div>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Tassa trattenuta</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(tasseTrattenute)}</div>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Costo totale</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(costoTotale)}</div>
          <Link href="/costi" style={{ fontSize: 13 }}>
            Vedi dettaglio costi →
          </Link>
        </div>
      </section>

      <h2 style={{ marginTop: 32 }}>Interessi — {annoCorrente}</h2>
      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 36,
          margin: 0,
          color: interesseNettoYtd >= 0 ? '#0a7d2c' : '#c0392b',
        }}
      >
        {formatEuro(interesseNettoYtd)}
      </p>
      <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>Netto, da inizio anno</p>

      <div style={{ marginTop: 16, maxWidth: 520 }}>
        <GraficoLineaSemplice punti={puntiCumulati} />
      </div>

      <div style={{ marginTop: 24, maxWidth: 520 }}>
        <GraficoBarreMensili punti={puntiMensili} />
      </div>

      <h2 style={{ marginTop: 32 }}>Storico interessi</h2>
      {righeStoricoAnni.length === 0 ? (
        <p style={{ color: '#666' }}>Nessun interesse registrato finora.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, maxWidth: 480 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Anno</th>
              <th style={{ padding: 8 }}>Netto ricevuto</th>
              <th style={{ padding: 8 }}>Tasse pagate</th>
            </tr>
          </thead>
          <tbody>
            {righeStoricoAnni.map((r) => (
              <tr key={r.anno} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.anno}</td>
                <td style={{ padding: 8, color: r.netto >= 0 ? 'green' : '#b91c1c' }}>{formatEuro(r.netto)}</td>
                <td style={{ padding: 8 }}>{formatEuro(r.tasse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 32 }}>Storico movimenti</h2>
      <StoricoMovimentiLiquidita movimenti={storicoMovimenti} contenitori={contenitori ?? []} />
    </div>
  )
}