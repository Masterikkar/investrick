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
  const titoloDiStato = formData.get('titolo_di_stato') === 'on'
  const percentualeTitoliStatoRaw = formData.get('percentuale_titoli_stato') as string
  const percentualeTitoliStato = percentualeTitoliStatoRaw ? Number(percentualeTitoliStatoRaw) : null
  const provider = ((formData.get('provider') as string) || '').trim() || null
  const tassoPercentualeRaw = formData.get('tasso_percentuale') as string
  const tassoPercentuale = tassoPercentualeRaw ? Number(tassoPercentualeRaw) : null

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
      titolo_di_stato: titoloDiStato,
      percentuale_titoli_stato: percentualeTitoliStato,
      provider,
      tasso_percentuale: tassoPercentuale,
    })
    .select('id')
    .single()

  if (error || !nuovo) {
    redirect('/asset/nuovo?errore=1')
  }

  redirect(`/asset/${nuovo.id}`)
}