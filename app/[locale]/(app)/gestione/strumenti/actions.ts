'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import type { Database } from '@/types/database.types'

// aliquota_tassazione è NOT NULL senza default di colonna (rimosso apposta
// nel Passo 2): la riempie sempre il trigger applica_aliquota_default_strumento,
// mai l'app. Il generatore di tipi non vede i trigger, quindi lo marca come
// obbligatorio — il payload lo omette di proposito.
type InsertStrumento = Omit<Database['public']['Tables']['strumenti']['Insert'], 'aliquota_tassazione'>

export async function creaAsset(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

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

  const { data: nuovo, error } = await supabase
    .from('strumenti')
    .insert(payload as Database['public']['Tables']['strumenti']['Insert'])
    .select('id')
    .single()

  if (error || !nuovo) {
    redirect({ href: '/gestione/strumenti?errore=1', locale })
    return
  }

  redirect({ href: `/asset/${nuovo.id}`, locale })
}