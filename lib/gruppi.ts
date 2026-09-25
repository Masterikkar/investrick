import type { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { saldoRiportatoAllaData, serieSaldiPerConto } from '@/lib/saldi-riportati'

// Dati della pagina elenco di un tipo di gruppo (PAC, Polizze, Personalizzati),
// già nella forma che components/pagina-gruppi.tsx impagina. Cambia solo da
// dove arrivano:
// - un gruppo reale (PAC, Polizza) contiene le posizioni registrate con il suo
//   contenitore_id;
// - un gruppo Personalizzato contiene strumenti interi, scelti in
//   gruppi_personalizzati_strumenti: il valore di uno strumento è la somma su
//   tutti i suoi contenitori reali, come nella pagina Asset.

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

export type GruppoRiepilogo = {
  id: string
  nome: string
  targetAttivo: boolean
  dataAttivazione: string | null
  valore: number
}

// Una riga per strumento dentro un gruppo. I campi a null (conti di
// liquidità: niente prezzo né prezzo medio) si mostrano come "—".
export type PosizioneGruppo = {
  strumentoId: string
  contenitoreId: string
  valore: number
  capitaleInvestito: number
  capitaleInvestitoNetto: number
  rendimentoPct: number | null
  prezzoAttuale: number | null
  prezzoMedioUnitario: number | null
  costo: number
}

export type StrumentoGruppo = {
  id: string
  nome: string
  ticker: string | null
  isin: string | null
  tipo: string
  categoria: string
}

// Somma di tutti i gruppi del tipo, per giorno. capitale è null se quel
// giorno non ha nessun capitale investito noto.
export type PuntoStoricoGruppi = { data: string; valore: number; capitale: number | null }

export type DatiGruppi = {
  gruppi: GruppoRiepilogo[]
  posizioni: PosizioneGruppo[]
  strumenti: StrumentoGruppo[]
  storico: PuntoStoricoGruppi[]
}

// Accumula valore e capitale per data; il capitale resta null finché non ne
// arriva uno noto.
function aggiungiAlGiorno(
  perData: Map<string, { valore: number; capitale: number | null }>,
  data: string,
  valore: number,
  capitale: number | null
) {
  const giorno = perData.get(data) ?? { valore: 0, capitale: null }
  giorno.valore += valore
  if (capitale !== null) giorno.capitale = (giorno.capitale ?? 0) + capitale
  perData.set(data, giorno)
}

function daMappaAStorico(perData: Map<string, { valore: number; capitale: number | null }>): PuntoStoricoGruppi[] {
  return Array.from(perData.entries())
    .map(([data, g]) => ({ data, valore: g.valore, capitale: g.capitale }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

export async function caricaGruppiReali(
  supabase: ClientSupabase,
  tipo: 'PAC' | 'Polizza',
  ordine: 'nome' | 'data_attivazione'
): Promise<DatiGruppi> {
  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome, data_attivazione, target_attivo')
    .eq('tipo', tipo)
    .order(ordine)

  const ids = (contenitori ?? []).map((c) => c.id)
  if (ids.length === 0) return { gruppi: [], posizioni: [], strumenti: [], storico: [] }

  const [{ data: valori }, { data: storicoRaw }, { data: riepilogo }, { data: costi }] = await Promise.all([
    supabase.from('v_valore_per_contenitore').select('contenitore_id, valore_totale').in('contenitore_id', ids),
    // Una riga per gruppo e per giorno: letta a blocchi per non fermarsi a 1000
    // righe, con un ordinamento univoco (data, contenitore).
    tutteLeRighe((da, a) =>
      supabase
        .from('v_storico_valorizzazioni_per_contenitore')
        .select('data, valore_totale, capitale_investito_totale')
        .in('contenitore_id', ids)
        .order('data', { ascending: true })
        .order('contenitore_id', { ascending: true })
        .range(da, a)
    ),
    supabase
      .from('v_riepilogo_posizione')
      .select(
        'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta'
      )
      .in('contenitore_id', ids),
    supabase.from('v_costo_per_strumento').select('strumento_id, contenitore_id, costo_totale').in('contenitore_id', ids),
  ])

  const valorePerGruppo = new Map(
    (valori ?? []).filter((v) => v.contenitore_id !== null).map((v) => [v.contenitore_id as string, v.valore_totale ?? 0])
  )

  const perData = new Map<string, { valore: number; capitale: number | null }>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    aggiungiAlGiorno(
      perData,
      r.data,
      Number(r.valore_totale),
      r.capitale_investito_totale != null ? Number(r.capitale_investito_totale) : null
    )
  }

  const posizioni: PosizioneGruppo[] = (riepilogo ?? [])
    .filter((p) => p.strumento_id !== null && p.contenitore_id !== null)
    .map((p) => {
      const costo = (costi ?? []).find(
        (c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id
      )
      return {
        strumentoId: p.strumento_id as string,
        contenitoreId: p.contenitore_id as string,
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        capitaleInvestitoNetto: (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
        rendimentoPct: p.rendimento_pct ?? 0,
        prezzoAttuale: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
      }
    })

  const strumentoIds = Array.from(new Set(posizioni.map((p) => p.strumentoId)))
  const { data: strumenti } = strumentoIds.length
    ? await supabase.from('strumenti').select('id, nome, ticker, isin, tipo, categoria').in('id', strumentoIds)
    : { data: null }

  return {
    gruppi: (contenitori ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      targetAttivo: c.target_attivo,
      dataAttivazione: c.data_attivazione,
      valore: valorePerGruppo.get(c.id) ?? 0,
    })),
    posizioni,
    strumenti: strumenti ?? [],
    storico: daMappaAStorico(perData),
  }
}

// Valore di ogni strumento sommato su tutti i suoi contenitori reali, come
// nella pagina Asset: le posizioni aperte da v_riepilogo_posizione, e per i
// conti di liquidità il saldo (capitale investito = saldo, rendimento 0).
export type StrumentoAggregato = {
  valore: number
  capitaleInvestito: number
  capitaleInvestitoNetto: number
  quantita: number
  prezzoAttuale: number | null
  costo: number
}

export async function aggregaStrumenti(
  supabase: ClientSupabase,
  strumenti: { id: string; categoria: string }[]
): Promise<Map<string, StrumentoAggregato>> {
  const idsMercato = strumenti.filter((s) => s.categoria !== 'Liquidita').map((s) => s.id)
  const idsLiquidita = strumenti.filter((s) => s.categoria === 'Liquidita').map((s) => s.id)

  const [{ data: riepilogo }, { data: costiMercato }, { data: saldi }, { data: costiLiquidita }] = await Promise.all([
    idsMercato.length
      ? supabase
          .from('v_riepilogo_posizione')
          .select('strumento_id, valore, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta')
          .in('strumento_id', idsMercato)
          .gt('quantita_posseduta', 0)
      : Promise.resolve({ data: null }),
    idsMercato.length
      ? supabase.from('v_costo_per_strumento').select('strumento_id, costo_totale').in('strumento_id', idsMercato)
      : Promise.resolve({ data: null }),
    idsLiquidita.length
      ? supabase.from('v_saldo_liquidita').select('strumento_id, saldo_corrente').in('strumento_id', idsLiquidita)
      : Promise.resolve({ data: null }),
    idsLiquidita.length
      ? supabase.from('v_costo_liquidita').select('strumento_id, costo_totale').in('strumento_id', idsLiquidita)
      : Promise.resolve({ data: null }),
  ])

  const aggregati = new Map<string, StrumentoAggregato>()
  const voce = (id: string) => {
    let a = aggregati.get(id)
    if (!a) {
      a = { valore: 0, capitaleInvestito: 0, capitaleInvestitoNetto: 0, quantita: 0, prezzoAttuale: null, costo: 0 }
      aggregati.set(id, a)
    }
    return a
  }

  for (const s of strumenti) voce(s.id)
  for (const r of riepilogo ?? []) {
    if (!r.strumento_id) continue
    const a = voce(r.strumento_id)
    const quantita = Number(r.quantita_posseduta ?? 0)
    a.valore += Number(r.valore ?? 0)
    a.capitaleInvestito += Number(r.capitale_investito ?? 0)
    a.capitaleInvestitoNetto += quantita * Number(r.prezzo_medio_unitario ?? 0)
    a.quantita += quantita
    if (r.prezzo_attuale != null) a.prezzoAttuale = Number(r.prezzo_attuale)
  }
  for (const r of costiMercato ?? []) if (r.strumento_id) voce(r.strumento_id).costo += Number(r.costo_totale ?? 0)
  for (const r of saldi ?? []) {
    if (!r.strumento_id) continue
    const a = voce(r.strumento_id)
    const saldo = Number(r.saldo_corrente ?? 0)
    a.valore += saldo
    a.capitaleInvestito += saldo
    a.capitaleInvestitoNetto += saldo
  }
  for (const r of costiLiquidita ?? []) if (r.strumento_id) voce(r.strumento_id).costo += Number(r.costo_totale ?? 0)

  return aggregati
}

// Membri dei gruppi Personalizzati indicati, con i dati dei loro strumenti.
export async function leggiMembriPersonalizzati(
  supabase: ClientSupabase,
  contenitoreIds: string[]
): Promise<{ membri: { contenitore_id: string; strumento_id: string }[]; strumenti: StrumentoGruppo[] }> {
  if (contenitoreIds.length === 0) return { membri: [], strumenti: [] }
  const { data: membri } = await supabase
    .from('gruppi_personalizzati_strumenti')
    .select('contenitore_id, strumento_id')
    .in('contenitore_id', contenitoreIds)

  const strumentoIds = Array.from(new Set((membri ?? []).map((m) => m.strumento_id)))
  const { data: strumenti } = strumentoIds.length
    ? await supabase.from('strumenti').select('id, nome, ticker, isin, tipo, categoria').in('id', strumentoIds)
    : { data: null }

  return { membri: membri ?? [], strumenti: strumenti ?? [] }
}

export async function caricaGruppiPersonalizzati(supabase: ClientSupabase): Promise<DatiGruppi> {
  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome, data_attivazione, target_attivo')
    .eq('tipo', 'Personalizzato')
    .order('nome')

  const ids = (contenitori ?? []).map((c) => c.id)
  if (ids.length === 0) return { gruppi: [], posizioni: [], strumenti: [], storico: [] }

  const { membri, strumenti } = await leggiMembriPersonalizzati(supabase, ids)
  const strumentoIds = strumenti.map((s) => s.id)
  const liquidita = new Set(strumenti.filter((s) => s.categoria === 'Liquidita').map((s) => s.id))

  const [aggregati, { data: storicoRaw }] = await Promise.all([
    aggregaStrumenti(supabase, strumenti),
    strumentoIds.length
      ? tutteLeRighe((da, a) =>
          supabase
            .from('v_storico_valorizzazioni_per_strumento')
            .select('strumento_id, data, valore_totale, capitale_investito_totale')
            .in('strumento_id', strumentoIds)
            .order('data', { ascending: true })
            .order('strumento_id', { ascending: true })
            .range(da, a)
        )
      : Promise.resolve({ data: null }),
  ])

  const posizioni: PosizioneGruppo[] = membri.map((m) => {
    const a = aggregati.get(m.strumento_id)
    const valore = a?.valore ?? 0
    const capitale = a?.capitaleInvestito ?? 0
    const conto = liquidita.has(m.strumento_id)
    return {
      strumentoId: m.strumento_id,
      contenitoreId: m.contenitore_id,
      valore,
      capitaleInvestito: capitale,
      capitaleInvestitoNetto: a?.capitaleInvestitoNetto ?? 0,
      rendimentoPct: capitale > 0 ? Math.round(((valore - capitale) / capitale) * 10000) / 100 : conto ? 0 : null,
      prezzoAttuale: conto ? null : a?.prezzoAttuale ?? null,
      prezzoMedioUnitario: conto ? null : a && a.quantita > 0 ? a.capitaleInvestitoNetto / a.quantita : null,
      costo: a?.costo ?? 0,
    }
  })

  // Storico: la serie di ogni strumento, sommata sui membri di ogni gruppo.
  // L'appartenenza è quella di oggi, applicata anche al passato. I conti di
  // liquidità hanno registrazioni solo nei giorni in cui il saldo cambia: il
  // saldo si riporta in avanti (lib/saldi-riportati.ts), con capitale = saldo.
  const seriePerStrumento = new Map<string, Map<string, { valore: number; capitale: number | null }>>()
  for (const r of storicoRaw ?? []) {
    if (!r.strumento_id || !r.data || liquidita.has(r.strumento_id)) continue
    const serie = seriePerStrumento.get(r.strumento_id) ?? new Map()
    serie.set(r.data, {
      valore: Number(r.valore_totale ?? 0),
      capitale: r.capitale_investito_totale != null ? Number(r.capitale_investito_totale) : null,
    })
    seriePerStrumento.set(r.strumento_id, serie)
  }
  const saldiPerConto = serieSaldiPerConto((storicoRaw ?? []).filter((r) => r.strumento_id && liquidita.has(r.strumento_id)))

  const perData = new Map<string, { valore: number; capitale: number | null }>()
  for (const id of ids) {
    const membriGruppo = membri.filter((m) => m.contenitore_id === id).map((m) => m.strumento_id)
    const contiGruppo = new Map(
      membriGruppo.filter((s) => saldiPerConto.has(s)).map((s) => [s, saldiPerConto.get(s)!])
    )
    const date = new Set<string>()
    for (const s of membriGruppo) for (const d of seriePerStrumento.get(s)?.keys() ?? []) date.add(d)
    for (const serie of contiGruppo.values()) for (const p of serie) date.add(p.data)

    for (const data of date) {
      const saldo = contiGruppo.size ? saldoRiportatoAllaData(contiGruppo, data) : 0
      let valore = saldo
      let capitale: number | null = contiGruppo.size ? saldo : null
      for (const s of membriGruppo) {
        const punto = seriePerStrumento.get(s)?.get(data)
        if (!punto) continue
        valore += punto.valore
        if (punto.capitale !== null) capitale = (capitale ?? 0) + punto.capitale
      }
      aggiungiAlGiorno(perData, data, valore, capitale)
    }
  }

  const valorePerGruppo = new Map<string, number>()
  for (const p of posizioni) valorePerGruppo.set(p.contenitoreId, (valorePerGruppo.get(p.contenitoreId) ?? 0) + p.valore)

  return {
    gruppi: (contenitori ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      targetAttivo: c.target_attivo,
      dataAttivazione: c.data_attivazione,
      valore: valorePerGruppo.get(c.id) ?? 0,
    })),
    posizioni,
    strumenti,
    storico: daMappaAStorico(perData),
  }
}
