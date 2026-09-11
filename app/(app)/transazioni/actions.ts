'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const CATEGORIE_VALIDE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset']

export async function aggiungiTransazione(formData: FormData) {
  const supabase = await createClient()

  const strumentoId = formData.get('strumento_id') as string
  const categoriaManuale = formData.get('categoria_manuale') as string
  const contenitoreId = formData.get('contenitore_id') as string
  const operazione = formData.get('operazione') as string
  const data = formData.get('data') as string
  const quantita = Number(formData.get('quantita'))
  const prezzoUnitario = Number(formData.get('prezzo_unitario'))
  const commissione = Number(formData.get('commissione') || 0)
  const tassaTrattenuta = Number(formData.get('tassa_trattenuta') || 0)

  let categoria: string
  let strumentoIdFinale: string | null

  if (operazione === 'Costo_contanti') {
    if (strumentoId) {
      redirect('/transazioni?errore=1')
    }
    if (!CATEGORIE_VALIDE.includes(categoriaManuale)) {
      redirect('/transazioni?errore=1')
    }
    categoria = categoriaManuale
    strumentoIdFinale = null
  } else {
    if (!strumentoId) {
      redirect('/transazioni?errore=1')
    }

    const { data: strumento, error: erroreStrumento } = await supabase
      .from('strumenti')
      .select('categoria')
      .eq('id', strumentoId)
      .single()

    if (erroreStrumento || !strumento) {
      redirect('/transazioni?errore=1')
    }

    categoria = strumento.categoria
    strumentoIdFinale = strumentoId
  }

  const { error } = await supabase.from('transazioni').insert({
    strumento_id: strumentoIdFinale,
    contenitore_id: contenitoreId === 'diretto' ? null : contenitoreId,
    categoria,
    operazione,
    data,
    valuta: 'EUR',
    quantita,
    prezzo_unitario: prezzoUnitario,
    commissione,
    tassa_trattenuta: tassaTrattenuta,
  })

  if (error) {
    redirect('/transazioni?errore=1')
  }

  revalidatePath('/')
  revalidatePath('/transazioni')
  redirect('/transazioni?successo=1')
}

// --- Import CSV massivo ---

export async function creaAssetPerImport(dati: {
  categoria: string
  tipo: string
  nome: string
  ticker: string
  isin: string
  valuta: string
  codicePrezzo: string
  titoloDiStato: boolean
  percentualeTitoliStato: number | null
}): Promise<{ id: string } | { errore: string }> {
  const supabase = await createClient()

  const isin = dati.isin.trim().toUpperCase()

  const { data: esistente } = await supabase
    .from('strumenti')
    .select('id')
    .eq('isin', isin)
    .maybeSingle()

  if (esistente) {
    return { id: esistente.id }
  }

  const { data: nuovo, error } = await supabase
    .from('strumenti')
    .insert({
      categoria: dati.categoria,
      tipo: dati.tipo,
      nome: dati.nome.trim(),
      ticker: dati.ticker.trim() || null,
      isin,
      valuta: dati.valuta.trim() || 'EUR',
      codice_prezzo: dati.codicePrezzo.trim() || null,
      titolo_di_stato: dati.titoloDiStato,
      percentuale_titoli_stato: dati.percentualeTitoliStato,
    })
    .select('id')
    .single()

  if (error || !nuovo) {
    return { errore: error?.message ?? 'Errore sconosciuto durante la creazione' }
  }

  revalidatePath('/transazioni')
  return { id: nuovo.id }
}

export type RigaImport = {
  rigaOriginale: number
  data: string
  strumentoId: string
  operazione: string
  quantita: number
  prezzoUnitario: number
  commissione: number
  tassaTrattenuta: number
  contenitoreId: string | null
}

export async function importaTransazioniBulk(
  righe: RigaImport[]
): Promise<{ inserite: number; errori: { riga: number; messaggio: string }[] }> {
  const supabase = await createClient()

  if (righe.length === 0) {
    return { inserite: 0, errori: [] }
  }

  const strumentoIds = Array.from(new Set(righe.map((r) => r.strumentoId)))
  const { data: strumentiInfo, error: erroreStrumenti } = await supabase
    .from('strumenti')
    .select('id, categoria')
    .in('id', strumentoIds)

  if (erroreStrumenti || !strumentiInfo) {
    return {
      inserite: 0,
      errori: righe.map((r) => ({ riga: r.rigaOriginale, messaggio: 'Impossibile verificare gli strumenti' })),
    }
  }

  const categoriaMap = new Map(strumentiInfo.map((s) => [s.id, s.categoria]))

  let inserite = 0
  const errori: { riga: number; messaggio: string }[] = []

  for (const r of righe) {
    const { error } = await supabase.from('transazioni').insert({
      strumento_id: r.strumentoId,
      contenitore_id: r.contenitoreId,
      categoria: categoriaMap.get(r.strumentoId) ?? null,
      operazione: r.operazione,
      data: r.data,
      valuta: 'EUR',
      quantita: r.quantita,
      prezzo_unitario: r.prezzoUnitario,
      commissione: r.commissione,
      tassa_trattenuta: r.tassaTrattenuta,
    })

    if (error) {
      errori.push({ riga: r.rigaOriginale, messaggio: error.message })
    } else {
      inserite++
    }
  }

  revalidatePath('/')
  revalidatePath('/transazioni')

  return { inserite, errori }
}