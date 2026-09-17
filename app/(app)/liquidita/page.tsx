import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { GraficoLineaSemplice, type PuntoLineaSemplice } from '@/components/grafico-linea-semplice'
import { GraficoBarreMensili, type PuntoMensile } from '@/components/grafico-barre-mensili'

const COLONNE: ColonnaTabella[] = [
  { key: 'nome', label: 'Strumento', kind: 'link', linkPrefix: '/liquidita/', linkKey: 'strumentoId' },
  { key: 'tipo', label: 'Tipo', kind: 'text' },
  { key: 'provider', label: 'Provider', kind: 'text' },
  { key: 'valore', label: 'Valore', kind: 'euro' },
  { key: 'interesseLordo', label: 'Interesse lordo', kind: 'euro' },
  { key: 'interesseNetto', label: 'Interesse netto', kind: 'euro' },
  { key: 'tassaTrattenuta', label: 'Tassa trattenuta', kind: 'euro' },
  { key: 'costo', label: 'Costo', kind: 'euro' },
]

const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

type MovimentoInteresse = {
  data: string
  importo: number
  tassa_trattenuta: number
}

export default async function LiquiditaPage() {
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

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
      return {
        key: s.strumento_id ?? '—',
        strumentoId: s.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
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

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Contenitore</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>
        {liquidita?.nome ?? 'Liquidità'}
      </h1>
      <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 48, margin: 0, color: 'var(--text-primary)' }}>
        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valoreTotale)}
      </p>

      <h2 style={{ marginTop: 32, fontSize: 18, fontWeight: 500 }}>Interessi — {annoCorrente}</h2>
      <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 36, margin: 0, color: interesseNettoYtd >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {formatEuro(interesseNettoYtd)}
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Netto, da inizio anno</p>

      <div style={{ marginTop: 16, maxWidth: 1024 }}>
        <GraficoLineaSemplice punti={puntiCumulati} />
      </div>

      <div style={{ marginTop: 24, maxWidth: 1024 }}>
        <GraficoBarreMensili punti={puntiMensili} />
      </div>

      <h2 style={{ marginTop: 32, fontSize: 18, fontWeight: 500 }}>Storico interessi</h2>
      {righeStoricoAnni.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>Nessun interesse registrato finora.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, maxWidth: 480, color: 'var(--text-primary)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Anno</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Netto ricevuto</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tasse pagate</th>
            </tr>
          </thead>
          <tbody>
            {righeStoricoAnni.map((r) => (
              <tr key={r.anno} className="tabella-riga">
                <td style={{ padding: 8 }}>{r.anno}</td>
                <td style={{ padding: 8, color: r.netto >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEuro(r.netto)}</td>
                <td style={{ padding: 8 }}>{formatEuro(r.tasse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12, fontWeight: 500 }}>Strumenti</h2>
        <TabellaOrdinabile colonne={COLONNE} righe={righe} />
      </section>
    </div>
  )
}