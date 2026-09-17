import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned } from '@/lib/format'
import { GraficoLineaSemplice, type PuntoLineaSemplice } from '@/components/grafico-linea-semplice'
import { GraficoBarre, type PuntoBarra } from '@/components/grafico-barre'
import { RippleLink } from '@/components/ripple-link'
import { CardMetrica } from '@/components/card-metrica'
import { Sezione } from '@/components/sezione'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from '../../transazioni/storico-movimenti-liquidita'

const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const COLONNE_STORICO_INTERESSI: ColonnaTabella[] = [
  { key: 'anno', label: 'Anno', kind: 'text' },
  { key: 'netto', label: 'Netto ricevuto', kind: 'euro-signed' },
  { key: 'tasse', label: 'Tasse pagate', kind: 'euro' },
]

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
      <RippleLink href="/liquidita" className="link-interattivo" style={{ fontSize: 13 }}>
        ← Liquidità
      </RippleLink>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>
        {[strumento.tipo, strumento.provider].filter(Boolean).join(' · ')}
      </div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{strumento.nome}</h1>

      <section>
        <Sezione>
          <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 48, margin: 0, color: 'var(--text-primary)' }}>
            {formatEuro(saldoAttuale)}
          </p>
          <div style={{ marginTop: 16, maxWidth: 1024 }}>
            <GraficoLineaSemplice punti={puntiSaldo} />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label="Interesse lordo">{formatEuro(interessiLordi)}</CardMetrica>
            <CardMetrica label="Interesse netto">{formatEuro(interessiNetti)}</CardMetrica>
            <CardMetrica label="Tassa trattenuta">{formatEuro(tasseTrattenute)}</CardMetrica>
            <CardMetrica label="Costo totale" href="/costi" linkLabel="Vedi dettaglio costi →">
              {formatEuro(costoTotale)}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Interessi — {annoCorrente}</h2>
        <Sezione>
          <p
            style={{
              fontFamily: 'var(--font-zilla-slab)',
              fontWeight: 600,
              fontSize: 36,
              margin: 0,
              color: interesseNettoYtd >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {formatEuroSigned(interesseNettoYtd)}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>Netto, da inizio anno</p>

          <div style={{ maxWidth: 1024 }}>
            <GraficoLineaSemplice punti={puntiCumulati} />
          </div>

          <div style={{ marginTop: 24, maxWidth: 1024 }}>
            <GraficoBarre punti={puntiMensili} />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Storico interessi</h2>
        <Sezione>
          {righeStoricoAnni.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nessun interesse registrato finora.</p>
          ) : (
            <TabellaOrdinabile colonne={COLONNE_STORICO_INTERESSI} righe={righeStoricoAnni} />
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Storico movimenti</h2>
        <Sezione>
          <StoricoMovimentiLiquidita movimenti={storicoMovimenti} contenitori={contenitori ?? []} />
        </Sezione>
      </section>
    </div>
  )
}