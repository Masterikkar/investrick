'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ETICHETTA_OPERAZIONE } from '@/lib/operazioni'
import type { Database } from '@/types/database.types'
import { CATEGORIE_MERCATO } from '@/lib/categorie'
import { eseguiImportazione, type FileImport } from '@/lib/importazioni'

// Stessa ragione di app/(app)/gestione/strumenti/actions.ts: aliquota_tassazione
// la riempie il trigger, mai l'app.
type InsertStrumento = Omit<Database['public']['Tables']['strumenti']['Insert'], 'aliquota_tassazione'>


export async function aggiungiTransazione(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

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
      redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
    }
    if (!CATEGORIE_MERCATO.includes(categoriaManuale)) {
      redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
    }
    categoria = categoriaManuale
    strumentoIdFinale = null
  } else {
    if (!strumentoId) {
      redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
    }

    const { data: strumento, error: erroreStrumento } = await supabase
      .from('strumenti')
      .select('categoria')
      .eq('id', strumentoId)
      .single()

    if (erroreStrumento || !strumento || strumento.categoria === 'Liquidita') {
      redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
      return
    }

    categoria = strumento.categoria
    strumentoIdFinale = strumentoId
  }

  const { error } = await supabase.from('transazioni').insert({
    strumento_id: strumentoIdFinale,
    contenitore_id: contenitoreId || null,
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
    redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    redirect({ href: '/gestione/transazioni?errore_finanziaria=1', locale })
  }

  revalidatePath(`/${locale}`)
  revalidatePath(`/${locale}/gestione/transazioni`)
  redirect({ href: '/gestione/transazioni?successo_finanziaria=1', locale })
}

export async function aggiungiMovimentoLiquidita(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const strumentoId = formData.get('strumento_id') as string
  const contenitoreId = formData.get('contenitore_id') as string
  const tipoMovimento = formData.get('tipo_movimento') as string
  const data = formData.get('data') as string
  const importo = Number(formData.get('importo'))
  const tassaTrattenuta = Number(formData.get('tassa_trattenuta') || 0)

  if (!strumentoId) {
    redirect({ href: '/gestione/transazioni?errore_liquidita=1', locale })
  }

  const { error } = await supabase.from('movimenti_liquidita').insert({
    strumento_id: strumentoId,
    contenitore_id: contenitoreId || null,
    tipo_movimento: tipoMovimento,
    data,
    importo,
    tassa_trattenuta: tassaTrattenuta,
  })

  if (error) {
    redirect({ href: '/gestione/transazioni?errore_liquidita=1', locale })
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    redirect({ href: '/gestione/transazioni?errore_liquidita=1', locale })
  }

  revalidatePath(`/${locale}`)
  revalidatePath(`/${locale}/gestione/transazioni`)
  redirect({ href: '/gestione/transazioni?successo_liquidita=1', locale })
}

// --- Storico transazioni: riallocazione contenitore ed eliminazione ---

export async function aggiornaContenitoreTransazione(
  transazioneId: string,
  nuovoContenitoreId: string | null
): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const { error: erroreUpdate } = await supabase
    .from('transazioni')
    .update({ contenitore_id: nuovoContenitoreId })
    .eq('id', transazioneId)

  if (erroreUpdate) {
    return { errore: erroreUpdate.message }
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    return { errore: erroreRicostruzione.message }
  }

  revalidatePath('/', 'layout')

  return { successo: true }
}

export async function eliminaTransazione(id: string): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const { error: erroreDelete } = await supabase.from('transazioni').delete().eq('id', id)

  if (erroreDelete) {
    return { errore: erroreDelete.message }
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    return { errore: erroreRicostruzione.message }
  }

  revalidatePath('/', 'layout')

  return { successo: true }
}

// --- Storico movimenti liquidità: riallocazione contenitore ed eliminazione ---

export async function aggiornaContenitoreMovimentoLiquidita(
  movimentoId: string,
  nuovoContenitoreId: string | null
): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const { error: erroreUpdate } = await supabase
    .from('movimenti_liquidita')
    .update({ contenitore_id: nuovoContenitoreId })
    .eq('id', movimentoId)

  if (erroreUpdate) {
    return { errore: erroreUpdate.message }
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    return { errore: erroreRicostruzione.message }
  }

  revalidatePath('/', 'layout')

  return { successo: true }
}

export async function eliminaMovimentoLiquidita(id: string): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const { error: erroreDelete } = await supabase.from('movimenti_liquidita').delete().eq('id', id)

  if (erroreDelete) {
    return { errore: erroreDelete.message }
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    return { errore: erroreRicostruzione.message }
  }

  revalidatePath('/', 'layout')

  return { successo: true }
}

// --- Import Excel massivo: transazioni finanziarie ---

export async function creaAssetPerImport(dati: {
  categoria: string
  tipo: string
  nome: string
  ticker: string
  isin: string
  valuta: string
  codicePrezzo: string
}): Promise<{ id: string } | { errore: string }> {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = await getTranslations('PaginaGestioneTransazioni')

  const isinPulito = dati.isin.trim().toUpperCase()
  const isin = isinPulito || null

  if (isin) {
    const { data: esistente } = await supabase
      .from('strumenti')
      .select('id')
      .eq('isin', isin)
      .maybeSingle()

    if (esistente) {
      return { id: esistente.id }
    }
  }

  const payload: InsertStrumento = {
    categoria: dati.categoria,
    tipo: dati.tipo,
    nome: dati.nome.trim(),
    ticker: dati.ticker.trim() || null,
    isin,
    valuta: dati.valuta.trim() || 'EUR',
    codice_prezzo: dati.codicePrezzo.trim() || null,
  }

  const { data: nuovo, error } = await supabase
    .from('strumenti')
    .insert(payload as Database['public']['Tables']['strumenti']['Insert'])
    .select('id')
    .single()

  if (error || !nuovo) {
    return { errore: error?.message ?? t('erroreSconosciutoCreazione') }
  }

  revalidatePath(`/${locale}/gestione/transazioni`)
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
  righe: RigaImport[],
  file: FileImport
): Promise<{ inserite: number; errori: { riga: number; messaggio: string }[]; avvisoRicostruzione?: string }> {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = await getTranslations('PaginaGestioneTransazioni')

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
      errori: righe.map((r) => ({ riga: r.rigaOriginale, messaggio: t('erroreVerificaStrumenti') })),
    }
  }

  const categoriaMap = new Map(strumentiInfo.map((s) => [s.id, s.categoria]))

  // Nel registro dell'import: la categoria se il file ne contiene una sola,
  // altrimenti nessuna.
  const categorieFile = new Set(righe.map((r) => categoriaMap.get(r.strumentoId)).filter(Boolean))
  const categoriaFile = categorieFile.size === 1 ? [...categorieFile][0]! : null

  const esito = await eseguiImportazione(supabase, file, categoriaFile, async (importazioneId) => {
    let inserite = 0
    const errori: { riga: number; messaggio: string }[] = []

    for (const r of righe) {
      const categoria = categoriaMap.get(r.strumentoId)

      if (!categoria) {
        errori.push({ riga: r.rigaOriginale, messaggio: t('erroreCategoriaSconosciuta') })
        continue
      }

      const { error } = await supabase.from('transazioni').insert({
        importazione_id: importazioneId,
        strumento_id: r.strumentoId,
        contenitore_id: r.contenitoreId,
        categoria,
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
    return { inserite, errori }
  })

  return concludiImport(esito, righe, locale, t)
}

// Dopo l'inserimento, comune ai due import: ricostruisce lo storico se è
// entrata almeno una riga e aggiorna le pagine. Se il registro dell'import non
// si è potuto creare, non è stato inserito nulla: errore su tutte le righe.
async function concludiImport(
  esito: Awaited<ReturnType<typeof eseguiImportazione>>,
  righe: { rigaOriginale: number }[],
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations<'PaginaGestioneTransazioni'>>>
): Promise<{ inserite: number; errori: { riga: number; messaggio: string }[]; avvisoRicostruzione?: string }> {
  if ('erroreRegistro' in esito) {
    return {
      inserite: 0,
      errori: righe.map((r) => ({ riga: r.rigaOriginale, messaggio: t('erroreRegistroImport', { errore: esito.erroreRegistro }) })),
    }
  }

  const { inserite, errori } = esito
  if (inserite > 0) {
    const supabase = await createClient()
    const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')
    if (erroreRicostruzione) {
      revalidatePath(`/${locale}`)
      revalidatePath(`/${locale}/gestione/transazioni`)
      return {
        inserite,
        errori,
        avvisoRicostruzione: t('avvisoRicostruzioneFallita', { errore: erroreRicostruzione.message }),
      }
    }
  }

  revalidatePath(`/${locale}`)
  revalidatePath(`/${locale}/gestione/transazioni`)

  return { inserite, errori }
}

// --- Import Excel massivo: transazioni di liquidità ---
// Nessuna creazione al volo di conti: uno strumento non trovato è un errore di riga,
// da correggere creando prima il conto in Gestione strumenti.

export type RigaImportLiquidita = {
  rigaOriginale: number
  data: string
  strumentoId: string
  tipoMovimento: string
  importo: number
  tassaTrattenuta: number
  contenitoreId: string | null
}

export async function importaMovimentiLiquiditaBulk(
  righe: RigaImportLiquidita[],
  file: FileImport
): Promise<{ inserite: number; errori: { riga: number; messaggio: string }[]; avvisoRicostruzione?: string }> {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = await getTranslations('PaginaGestioneTransazioni')

  if (righe.length === 0) {
    return { inserite: 0, errori: [] }
  }

  const esito = await eseguiImportazione(supabase, file, 'Liquidita', async (importazioneId) => {
    let inserite = 0
    const errori: { riga: number; messaggio: string }[] = []

    for (const r of righe) {
      const { error } = await supabase.from('movimenti_liquidita').insert({
        importazione_id: importazioneId,
        strumento_id: r.strumentoId,
        contenitore_id: r.contenitoreId,
        tipo_movimento: r.tipoMovimento,
        data: r.data,
        importo: r.importo,
        tassa_trattenuta: r.tassaTrattenuta,
      })

      if (error) {
        errori.push({ riga: r.rigaOriginale, messaggio: error.message })
      } else {
        inserite++
      }
    }
    return { inserite, errori }
  })

  return concludiImport(esito, righe, locale, t)
}

// --- Esportazione storico ---
// Restituiscono le righe già pronte per json_to_sheet: stesse intestazioni
// colonna dei template di import, così un file esportato è normalmente
// ri-importabile senza modifiche (eccetto le righe "Costo (in contanti)",
// mai state supportate dall'import Excel).

export type RigaEsportazioneTransazione = {
  // YYYY-MM-DD così com'è nel database: la cella data la scrive il client
  // (scriviColonnaDateExcel), senza passare da un Date e da un fuso.
  Data: string
  ISIN: string
  Ticker: string
  Strumento: string
  Operazione: string
  Quantità: number
  'Prezzo unitario': number
  Commissione: number
  'Tassa trattenuta': number
  Contenitore: string
}

export async function esportaTransazioniFinanziarie(): Promise<RigaEsportazioneTransazione[]> {
  const supabase = await createClient()

  const [{ data: transazioni }, { data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('transazioni')
      .select('data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta, strumento_id')
      .order('data', { ascending: false }),
    supabase.from('strumenti').select('id, nome, ticker, isin'),
    supabase.from('contenitori').select('id, nome'),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))

  return (transazioni ?? []).map((t) => {
    const strumento = t.strumento_id ? strumentoMap.get(t.strumento_id) : undefined
    return {
      Data: t.data,
      ISIN: strumento?.isin ?? '',
      Ticker: strumento?.ticker ?? '',
      Strumento: strumento?.nome ?? '',
      Operazione: ETICHETTA_OPERAZIONE[t.operazione] ?? t.operazione,
      Quantità: Number(t.quantita),
      'Prezzo unitario': Number(t.prezzo_unitario),
      Commissione: Number(t.commissione),
      'Tassa trattenuta': Number(t.tassa_trattenuta),
      Contenitore: t.contenitore_id ? contenitoreMap.get(t.contenitore_id) ?? '' : '',
    }
  })
}

export type RigaEsportazioneLiquidita = {
  Data: string // YYYY-MM-DD, vedi RigaEsportazioneTransazione
  Strumento: string
  'Tipo movimento': string
  Importo: number
  'Tassa trattenuta': number
  Contenitore: string
}

export async function esportaTransazioniLiquidita(): Promise<RigaEsportazioneLiquidita[]> {
  const supabase = await createClient()

  const [{ data: movimenti }, { data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('movimenti_liquidita')
      .select('data, tipo_movimento, contenitore_id, importo, tassa_trattenuta, strumento_id')
      .order('data', { ascending: false }),
    supabase.from('strumenti').select('id, nome'),
    supabase.from('contenitori').select('id, nome'),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s.nome]))
  const contenitoreMap = new Map((contenitori ?? []).map((c) => [c.id, c.nome]))

  return (movimenti ?? []).map((m) => ({
    Data: m.data,
    Strumento: strumentoMap.get(m.strumento_id) ?? '',
    'Tipo movimento': m.tipo_movimento,
    Importo: Number(m.importo),
    'Tassa trattenuta': Number(m.tassa_trattenuta),
    Contenitore: m.contenitore_id ? contenitoreMap.get(m.contenitore_id) ?? '' : '',
  }))
}