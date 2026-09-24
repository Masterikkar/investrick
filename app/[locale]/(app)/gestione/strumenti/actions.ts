'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import type { Database } from '@/types/database.types'

// aliquota_tassazione è NOT NULL senza default di colonna (rimosso apposta
// nel Passo 2): la riempie sempre il trigger applica_aliquota_default_strumento,
// mai l'app. Il generatore di tipi non vede i trigger, quindi lo marca come
// obbligatorio — il payload lo omette di proposito.
type InsertStrumento = Omit<Database['public']['Tables']['strumenti']['Insert'], 'aliquota_tassazione'>

// Legge i campi del form asset, condiviso da creaAsset e aggiornaAsset. Un
// campo nascosto per la categoria scelta (es. ISIN per la Liquidità) non
// arriva nel FormData e diventa null.
function leggiCampiAsset(formData: FormData) {
  const categoria = formData.get('categoria') as string
  const tipo = formData.get('tipo') as string
  const nome = (formData.get('nome') as string)?.trim()
  const ticker = ((formData.get('ticker') as string) || '').trim() || null
  const isinRaw = ((formData.get('isin') as string) || '').trim()
  const isin = isinRaw ? isinRaw.toUpperCase() : null
  const valuta = ((formData.get('valuta') as string) || 'EUR').trim()
  const note = ((formData.get('note') as string) || '').trim() || null
  const codicePrezzo = ((formData.get('codice_prezzo') as string) || '').trim() || null
  const provider = ((formData.get('provider') as string) || '').trim() || null
  const tassoPercentualeRaw = formData.get('tasso_percentuale') as string
  const tassoPercentuale = tassoPercentualeRaw ? Number(tassoPercentualeRaw) : null
  const dataScadenzaRaw = ((formData.get('data_scadenza') as string) || '').trim()
  const dataScadenza = dataScadenzaRaw || null
  const cedolaPercentualeRaw = formData.get('cedola_percentuale') as string
  const cedolaPercentuale = cedolaPercentualeRaw ? Number(cedolaPercentualeRaw) : null
  const frequenzaCedola = ((formData.get('frequenza_cedola') as string) || '').trim() || null

  const payload: InsertStrumento = {
    categoria,
    tipo,
    nome,
    ticker,
    isin,
    valuta,
    note,
    codice_prezzo: codicePrezzo,
    provider,
    tasso_percentuale: tassoPercentuale,
    data_scadenza: dataScadenza,
    cedola_percentuale: cedolaPercentuale,
    frequenza_cedola: frequenzaCedola,
  }
  return payload
}

export async function creaAsset(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const payload = leggiCampiAsset(formData)
  const { categoria, tipo, nome, isin } = payload

  if (!categoria || !tipo || !nome) {
    redirect({ href: '/gestione/strumenti?errore=1', locale })
  }

  if (isin) {
    const { data: esistente } = await supabase
      .from('strumenti')
      .select('id, nome')
      .eq('isin', isin)
      .maybeSingle()

    if (esistente) {
      redirect({
        href: `/gestione/strumenti?errore=duplicato&duplicato_id=${esistente.id}&duplicato_nome=${encodeURIComponent(esistente.nome)}`,
        locale,
      })
    }
  }

  const { data: nuovo, error } = await supabase
    .from('strumenti')
    .insert(payload as Database['public']['Tables']['strumenti']['Insert'])
    .select('id')
    .single()

  if (error || !nuovo) {
    redirect({ href: '/gestione/strumenti?errore=1', locale })
    return
  }

  // I conti di liquidità hanno la loro pagina di dettaglio, non quella Asset.
  redirect({ href: categoria === 'Liquidita' ? `/liquidita/${nuovo.id}` : `/asset/${nuovo.id}`, locale })
}
// Modifica di uno strumento esistente dal modale di Gestione strumenti: stessi
// campi di creaAsset, ma niente redirect (il client chiude il modale e
// aggiorna la pagina). aliquota_tassazione non fa parte del payload, quindi
// resta quella attuale anche se cambia la categoria.
export async function aggiornaAsset(
  id: string,
  formData: FormData
): Promise<{ successo: true } | { errore: 'campi' | 'generico' } | { errore: 'duplicato'; duplicatoId: string; duplicatoNome: string }> {
  const supabase = await createClient()

  const payload = leggiCampiAsset(formData)
  if (!payload.categoria || !payload.tipo || !payload.nome) return { errore: 'campi' }

  // Un altro strumento con lo stesso ISIN, escluso quello che si sta modificando.
  if (payload.isin) {
    const { data: esistente } = await supabase
      .from('strumenti')
      .select('id, nome')
      .eq('isin', payload.isin)
      .neq('id', id)
      .maybeSingle()

    if (esistente) return { errore: 'duplicato', duplicatoId: esistente.id, duplicatoNome: esistente.nome }
  }

  const { error } = await supabase.from('strumenti').update(payload).eq('id', id)
  if (error) return { errore: 'generico' }

  revalidatePath('/', 'layout')
  return { successo: true }
}

// Elimina uno strumento con tutte le sue transazioni e i suoi movimenti di
// liquidità. La funzione database elimina_strumento fa tutto in un'unica
// transazione Postgres (movimenti, transazioni, strumento — il resto è
// CASCADE — poi ricostruisci_storico_valorizzazioni): o riesce tutto o non
// cambia niente. Restituisce quante transazioni e movimenti ha eliminato.
export async function eliminaAsset(
  id: string
): Promise<{ transazioniEliminate: number; movimentiEliminati: number } | { errore: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('elimina_strumento', { p_strumento_id: id })

  if (error) {
    return { errore: error.message }
  }

  revalidatePath('/', 'layout')
  return {
    transazioniEliminate: data?.[0]?.transazioni_eliminate ?? 0,
    movimentiEliminati: data?.[0]?.movimenti_eliminati ?? 0,
  }
}
