import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

type CostoPerContenitore = { contenitore_id: string; costo_totale: number }
type CostoPerStrumento = { strumento_id: string; contenitore_id: string | null; categoria: string; costo_totale: number }
type CostoLiquidita = { strumento_id: string; contenitore_id: string | null; costo_totale: number }
type InteressiLiquidita = { strumento_id: string; contenitore_id: string | null; interessi_totali: number }
type SaldoLiquidita = { strumento_id: string; contenitore_id: string | null; saldo_corrente: number }
type RiepilogoPosizione = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  valore: number | null
}
type Strumento = { id: string; nome: string; categoria: string; tipo: string; provider: string | null }
type Contenitore = { id: string; nome: string }

function costoPerEuro(costo: number, guadagno: number): string {
  return guadagno > 0 ? (costo / guadagno).toFixed(2) : '—'
}

export default async function CostiPage() {
  const supabase = await createClient()

  const [
    { data: costoContenitoreRaw },
    { data: costoStrumentoRaw },
    { data: costoLiquiditaRaw },
    { data: interessiLiquiditaRaw },
    { data: saldoLiquiditaRaw },
    { data: riepilogoRaw },
    { data: strumentiRaw },
    { data: contenitoriRaw },
  ] = await Promise.all([
    supabase.from('v_costo_per_contenitore').select('contenitore_id, costo_totale').returns<CostoPerContenitore[]>(),
    supabase.from('v_costo_per_strumento').select('strumento_id, contenitore_id, categoria, costo_totale').returns<CostoPerStrumento[]>(),
    supabase.from('v_costo_liquidita').select('strumento_id, contenitore_id, costo_totale').returns<CostoLiquidita[]>(),
    supabase.from('v_interessi_liquidita').select('strumento_id, contenitore_id, interessi_totali').returns<InteressiLiquidita[]>(),
    supabase.from('v_saldo_liquidita').select('strumento_id, contenitore_id, saldo_corrente').returns<SaldoLiquidita[]>(),
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore').returns<RiepilogoPosizione[]>(),
    supabase.from('strumenti').select('id, nome, categoria, tipo, provider').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const costoContenitore = costoContenitoreRaw ?? []
  const costoStrumento = costoStrumentoRaw ?? []
  const costoLiquidita = costoLiquiditaRaw ?? []
  const interessiLiquidita = interessiLiquiditaRaw ?? []
  const saldoLiquidita = saldoLiquiditaRaw ?? []
  const riepilogo = riepilogoRaw ?? []
  const strumenti = strumentiRaw ?? []
  const contenitori = contenitoriRaw ?? []

  const strumentoMap = new Map(strumenti.map((s) => [s.id, s]))
  const contenitoreMap = new Map(contenitori.map((c) => [c.id, c.nome]))

  // --- Totale costi: mercato (Diretto incluso) + liquidità (Diretto incluso) ---
  const totaleCostiMercato = costoStrumento.reduce((sum, c) => sum + Number(c.costo_totale), 0)
  const totaleCostiLiquidita = costoLiquidita.reduce((sum, c) => sum + Number(c.costo_totale), 0)
  const totaleCosti = totaleCostiMercato + totaleCostiLiquidita

  // --- Costo + guadagno per contenitore (chiave: id contenitore, o 'diretto') ---
  const perContenitore = new Map<string, { nome: string; costo: number; guadagno: number }>()

  const getRiga = (id: string | null) => {
    const chiave = id ?? 'diretto'
    if (!perContenitore.has(chiave)) {
      perContenitore.set(chiave, { nome: id ? contenitoreMap.get(id) ?? '—' : 'Diretto', costo: 0, guadagno: 0 })
    }
    return perContenitore.get(chiave)!
  }

  for (const c of costoContenitore) getRiga(c.contenitore_id).costo += Number(c.costo_totale)
  // v_costo_per_contenitore esclude "Diretto" per definizione: lo recupero da v_costo_per_strumento
  for (const c of costoStrumento.filter((c) => c.contenitore_id === null)) getRiga(null).costo += Number(c.costo_totale)
  for (const c of costoLiquidita) getRiga(c.contenitore_id).costo += Number(c.costo_totale)

  for (const r of riepilogo) {
    if (r.valore == null) continue
    getRiga(r.contenitore_id).guadagno += Number(r.valore) - Number(r.capitale_investito)
  }
  for (const i of interessiLiquidita) getRiga(i.contenitore_id).guadagno += Number(i.interessi_totali)

  const righeContenitore = Array.from(perContenitore.values())
    .filter((r) => r.costo > 0 || r.guadagno !== 0)
    .sort((a, b) => b.costo - a.costo)

  // --- Elenco asset di mercato (quote ancora possedute) ---
  const costoStrumentoMap = new Map<string, number>()
  for (const c of costoStrumento) costoStrumentoMap.set(`${c.strumento_id}|${c.contenitore_id ?? ''}`, Number(c.costo_totale))

  const assetMercato = riepilogo
    .filter((r) => r.quantita_posseduta > 0)
    .map((r) => {
      const info = strumentoMap.get(r.strumento_id)
      const costo = costoStrumentoMap.get(`${r.strumento_id}|${r.contenitore_id ?? ''}`) ?? 0
      const guadagno = r.valore != null ? Number(r.valore) - Number(r.capitale_investito) : 0
      return {
        nome: info?.nome ?? '—',
        categoria: info?.categoria ?? '—',
        contenitore: r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '—' : 'Diretto',
        costo,
        guadagno,
      }
    })

  // --- Elenco asset di liquidità ---
  const saldoMap = new Map<string, number>()
  for (const s of saldoLiquidita) saldoMap.set(`${s.strumento_id}|${s.contenitore_id ?? ''}`, Number(s.saldo_corrente))
  const costoLiquiditaMap = new Map<string, number>()
  for (const c of costoLiquidita) costoLiquiditaMap.set(`${c.strumento_id}|${c.contenitore_id ?? ''}`, Number(c.costo_totale))
  const interessiMap = new Map<string, number>()
  for (const i of interessiLiquidita) interessiMap.set(`${i.strumento_id}|${i.contenitore_id ?? ''}`, Number(i.interessi_totali))

  const chiaviLiquidita = new Set([
    ...saldoLiquidita.map((s) => `${s.strumento_id}|${s.contenitore_id ?? ''}`),
    ...costoLiquidita.map((c) => `${c.strumento_id}|${c.contenitore_id ?? ''}`),
    ...interessiLiquidita.map((i) => `${i.strumento_id}|${i.contenitore_id ?? ''}`),
  ])

  const assetLiquidita = Array.from(chiaviLiquidita).map((chiave) => {
    const [strumentoId, contenitoreId] = chiave.split('|')
    const info = strumentoMap.get(strumentoId)
    return {
      nome: info?.nome ?? '—',
      provider: info?.provider ?? '—',
      contenitore: contenitoreId ? contenitoreMap.get(contenitoreId) ?? '—' : 'Diretto',
      costo: costoLiquiditaMap.get(chiave) ?? 0,
      guadagno: interessiMap.get(chiave) ?? 0,
    }
  })

  const tuttiGliAsset = [
    ...assetMercato.map((a) => ({ ...a, tipo: 'mercato' as const, provider: null as string | null })),
    ...assetLiquidita.map((a) => ({ ...a, tipo: 'liquidita' as const, categoria: 'Liquidita' })),
  ]

  return (
    <div>
      <h1>Costi</h1>

      <div style={{ marginTop: 16 }}>
        <span style={{ color: '#666' }}>Totale costi</span>
        <div style={{ fontSize: 28 }}>{formatEuro(totaleCosti)}</div>
      </div>

      <h2 style={{ marginTop: 32 }}>Per contenitore</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Contenitore</th>
            <th style={{ padding: 8 }}>Costo</th>
            <th style={{ padding: 8 }}>Costo / € guadagnato</th>
          </tr>
        </thead>
        <tbody>
          {righeContenitore.map((r) => (
            <tr key={r.nome} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{r.nome}</td>
              <td style={{ padding: 8 }}>{formatEuro(r.costo)}</td>
              <td style={{ padding: 8 }}>{costoPerEuro(r.costo, r.guadagno)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Tutti gli asset</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Strumento</th>
            <th style={{ padding: 8 }}>Categoria</th>
            <th style={{ padding: 8 }}>Contenitore</th>
            <th style={{ padding: 8 }}>Costo</th>
            <th style={{ padding: 8 }}>Costo / € guadagnato</th>
          </tr>
        </thead>
        <tbody>
          {tuttiGliAsset.map((a, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{a.nome}{a.provider ? ` (${a.provider})` : ''}</td>
              <td style={{ padding: 8 }}>{a.categoria}</td>
              <td style={{ padding: 8 }}>{a.contenitore}</td>
              <td style={{ padding: 8 }}>{formatEuro(a.costo)}</td>
              <td style={{ padding: 8 }}>{costoPerEuro(a.costo, a.guadagno)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}