'use server'

import { createClient } from '@/lib/supabase/server'

// Una riga per vendita fuori polizza o per riscatto di polizza (tipo_riga).
type VerificaTrattenuta = {
  data_vendita: string
  strumento_id: string | null
  contenitore_id: string | null
  tipo_riga: 'vendita' | 'riscatto_polizza'
  aliquota_attesa_pct: number
  plusvalenza_totale_vendita: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
  valore_lordo: number
  prezzo_stimato: boolean
}

// base_fiscale: fuori polizza il costo dei lotti, in polizza la quota dei
// premi residui del contratto.
type NonRealizzatoDettaglio = {
  strumento_id: string
  contenitore_id: string | null
  valore: number | null
  base_fiscale: number | null
}

type Strumento = { id: string; nome: string; isin: string | null }
type Contenitore = { id: string; nome: string }

export type RigaEsportazioneRealizzata = {
  Data: string // YYYY-MM-DD: la cella data la scrive il client (scriviColonnaDateExcel)
  ISIN: string
  Strumento: string
  Valore: number
  Plusvalenza: number
  'Aliquota attesa %': number
  'Tassa attesa': number
  'Tassa trattenuta': number
  Differenza: number
  Contenitore: string
  Tipo: string
  'Prezzo stimato': string
}

export async function esportaPlusMinusRealizzate(): Promise<RigaEsportazioneRealizzata[]> {
  const supabase = await createClient()

  const [{ data: verifica }, { data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome, isin').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))

  return (verifica ?? []).map((v) => {
    const riscatto = v.tipo_riga === 'riscatto_polizza'
    const strumento = v.strumento_id ? strumentoMap.get(v.strumento_id) : undefined
    const polizza = v.contenitore_id ? contenitoreMap.get(v.contenitore_id) ?? '' : ''
    return {
      Data: v.data_vendita,
      ISIN: strumento?.isin ?? '',
      // Un riscatto riguarda la polizza intera: al posto del fondo, il suo nome.
      Strumento: riscatto ? polizza : strumento?.nome ?? '',
      Valore: Number(v.valore_lordo),
      Plusvalenza: Number(v.plusvalenza_totale_vendita),
      'Aliquota attesa %': Number(v.aliquota_attesa_pct),
      'Tassa attesa': Number(v.tassa_attesa),
      'Tassa trattenuta': Number(v.tassa_trattenuta_effettiva),
      Differenza: Number(v.differenza),
      Contenitore: polizza,
      Tipo: riscatto ? 'Riscatto polizza' : 'Vendita',
      'Prezzo stimato': v.prezzo_stimato ? 'Sì' : '',
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

  const [{ data: dettaglio }, { data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('v_non_realizzato_dettaglio')
      .select('strumento_id, contenitore_id, valore, base_fiscale')
      .returns<NonRealizzatoDettaglio[]>(),
    supabase.from('strumenti').select('id, nome, isin').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))

  // Non realizzato fiscale: in polizza sulla quota dei premi residui.
  return (dettaglio ?? [])
    .filter((r) => r.valore != null)
    .map((r) => {
      const strumento = strumentoMap.get(r.strumento_id)
      const base = Number(r.base_fiscale ?? 0)
      const plusMinus = Number(r.valore) - base
      return {
        ISIN: strumento?.isin ?? '',
        Strumento: strumento?.nome ?? '',
        Contenitore: r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '' : '',
        'Plus/minus': plusMinus,
        'Rendimento %': base > 0 ? Math.round((plusMinus / base) * 10000) / 100 : 0,
      }
    })
}