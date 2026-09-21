'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function creaAsset(formData: FormData) {
  const supabase = await createClient()

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
    redirect('/asset/nuovo?errore=1')
  }

  if (isin) {
    const { data: esistente } = await supabase
      .from('strumenti')
      .select('id, nome')
      .eq('isin', isin)
      .maybeSingle()

    if (esistente) {
      redirect(
        `/asset/nuovo?errore=duplicato&duplicato_id=${esistente.id}&duplicato_nome=${encodeURIComponent(esistente.nome)}`
      )
    }
  }

  const { data: nuovo, error } = await supabase
    .from('strumenti')
    .insert({
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
    })
    .select('id')
    .single()

  if (error || !nuovo) {
    redirect('/asset/nuovo?errore=1')
  }

  redirect(`/asset/${nuovo.id}`)
}