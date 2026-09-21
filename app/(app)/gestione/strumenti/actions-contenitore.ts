'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const TIPI_VALIDI = ['PAC', 'Polizza', 'Liquidita']

export async function creaContenitore(formData: FormData) {
  const supabase = await createClient()

  const nome = (formData.get('nome') as string)?.trim()
  const tipo = formData.get('tipo') as string
  const dataAttivazione = (formData.get('data_attivazione') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const targetAttivo = formData.get('target_attivo') === 'on'

  if (!nome || !TIPI_VALIDI.includes(tipo)) {
    redirect('/gestione/strumenti?errore_contenitore=1')
  }

  const { error } = await supabase.from('contenitori').insert({
    nome,
    tipo,
    data_attivazione: dataAttivazione,
    note,
    target_attivo: targetAttivo,
  })

  if (error) {
    redirect('/gestione/strumenti?errore_contenitore=1')
  }

  revalidatePath('/', 'layout')
  redirect('/gestione/strumenti?successo_contenitore=1')
}

export async function rinominaContenitore(
  id: string,
  nuovoNome: string
): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const nome = nuovoNome.trim()
  if (!nome) {
    return { errore: 'Il nome non può essere vuoto.' }
  }

  const { error } = await supabase.from('contenitori').update({ nome }).eq('id', id)

  if (error) {
    return { errore: error.message }
  }

  revalidatePath('/', 'layout')
  return { successo: true }
}

export async function eliminaContenitore(id: string): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  const { error: erroreTransazioni } = await supabase
    .from('transazioni')
    .update({ contenitore_id: null })
    .eq('contenitore_id', id)

  if (erroreTransazioni) {
    return { errore: erroreTransazioni.message }
  }

  const { error: erroreMovimenti } = await supabase
    .from('movimenti_liquidita')
    .update({ contenitore_id: null })
    .eq('contenitore_id', id)

  if (erroreMovimenti) {
    return { errore: erroreMovimenti.message }
  }

  const { error: erroreTarget } = await supabase
    .from('target_allocazioni')
    .delete()
    .eq('contenitore_id', id)

  if (erroreTarget) {
    return { errore: erroreTarget.message }
  }

  const { error: erroreTargetStrumento } = await supabase
    .from('target_allocazioni_strumento')
    .delete()
    .eq('contenitore_id', id)

  if (erroreTargetStrumento) {
    return { errore: erroreTargetStrumento.message }
  }

  const { error: erroreContenitore } = await supabase.from('contenitori').delete().eq('id', id)

  if (erroreContenitore) {
    return { errore: erroreContenitore.message }
  }

  const { error: erroreRicostruzione } = await supabase.rpc('ricostruisci_storico_valorizzazioni')

  if (erroreRicostruzione) {
    return { errore: erroreRicostruzione.message }
  }

  revalidatePath('/', 'layout')
  return { successo: true }
}