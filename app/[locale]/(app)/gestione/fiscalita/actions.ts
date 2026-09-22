'use server'

import { createClient } from '@/lib/supabase/server'

type VerificaTrattenuta = {
  vendita_id: string
  data_vendita: string
  strumento_id: string
  contenitore_id: string | null
  aliquota_attesa_pct: number
  plusvalenza_totale_vendita: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
}

type TransazioneVendita = {
  id: string
  quantita: number
  prezzo_unitario: number
}

type RiepilogoPosizione = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  valore: number | null
  rendimento_pct: number | null
}

type Strumento = { id: string; nome: string; isin: string | null }
type Contenitore = { id: string; nome: string }

export type RigaEsportazioneRealizzata = {
  Data: Date
  ISIN: string
  Strumento: string
  Valore: number
  Plusvalenza: number
  'Aliquota attesa %': number
  'Tassa attesa': number
  'Tassa trattenuta': number
  Differenza: number
  Contenitore: string
}

export async function esportaPlusMinusRealizzate(): Promise<RigaEsportazioneRealizzata[]> {
  const supabase = await createClient()

  const [{ data: verifica }, { data: strumenti }, { data: contenitori }, { data: vendite }] = await Promise.all([
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome, isin').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
    supabase
      .from('transazioni')
      .select('id, quantita, prezzo_unitario')
      .in('operazione', ['Vendita', 'Scambio_cessione'])
      .returns<TransazioneVendita[]>(),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))
  const valoreVenditaMap = new Map((vendite ?? []).map((t) => [t.id, Number(t.quantita) * Number(t.prezzo_unitario)]))

  return (verifica ?? []).map((v) => {
    const strumento = strumentoMap.get(v.strumento_id)
    return {
      Data: new Date(v.data_vendita),
      ISIN: strumento?.isin ?? '',
      Strumento: strumento?.nome ?? '',
      Valore: valoreVenditaMap.get(v.vendita_id) ?? 0,
      Plusvalenza: Number(v.plusvalenza_totale_vendita),
      'Aliquota attesa %': Number(v.aliquota_attesa_pct),
      'Tassa attesa': Number(v.tassa_attesa),
      'Tassa trattenuta': Number(v.tassa_trattenuta_effettiva),
      Differenza: Number(v.differenza),
      Contenitore: v.contenitore_id ? contenitoreMap.get(v.contenitore_id) ?? '' : 'Diretto',
    }
  })
}

export type RigaEsportazioneNonRealizzata = {
  ISIN: string
  Strumento: string
  Contenitore: string
  'Plus/minus': number
  'Rendimento %': number
}

export async function esportaPlusMinusNonRealizzate(): Promise<RigaEsportazioneNonRealizzata[]> {
  const supabase = await createClient()

  const [{ data: riepilogo }, { data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('v_riepilogo_posizione')
      .select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore, rendimento_pct')
      .returns<RiepilogoPosizione[]>(),
    supabase.from('strumenti').select('id, nome, isin').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))

  return (riepilogo ?? [])
    .filter((r) => Number(r.quantita_posseduta) > 0 && r.valore != null)
    .map((r) => {
      const strumento = strumentoMap.get(r.strumento_id)
      return {
        ISIN: strumento?.isin ?? '',
        Strumento: strumento?.nome ?? '',
        Contenitore: r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '' : 'Diretto',
        'Plus/minus': Number(r.valore) - Number(r.capitale_investito),
        'Rendimento %': r.rendimento_pct ?? 0,
      }
    })
}