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
    redirect('/asset/nuovo?errore_contenitore=1')
  }

  const { error } = await supabase.from('contenitori').insert({
    nome,
    tipo,
    data_attivazione: dataAttivazione,
    note,
    target_attivo: targetAttivo,
  })

  if (error) {
    redirect('/asset/nuovo?errore_contenitore=1')
  }

  revalidatePath('/', 'layout')
  redirect('/asset/nuovo?successo_contenitore=1')
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

  const [
    { count: numTransazioni },
    { count: numMovimenti },
    { count: numTarget },
    { count: numTargetStrumento },
  ] = await Promise.all([
    supabase.from('transazioni').select('id', { count: 'exact', head: true }).eq('contenitore_id', id),
    supabase.from('movimenti_liquidita').select('id', { count: 'exact', head: true }).eq('contenitore_id', id),
    supabase.from('target_allocazioni').select('id', { count: 'exact', head: true }).eq('contenitore_id', id),
    supabase
      .from('target_allocazioni_strumento')
      .select('id', { count: 'exact', head: true })
      .eq('contenitore_id', id),
  ])

  const totaleCollegati =
    (numTransazioni ?? 0) + (numMovimenti ?? 0) + (numTarget ?? 0) + (numTargetStrumento ?? 0)

  if (totaleCollegati > 0) {
    return {
      errore:
        'Non puoi eliminare questo contenitore: ha ancora transazioni, movimenti o target collegati. Spostali (da Transazioni) o rimuovili prima di eliminarlo.',
    }
  }

  const { error } = await supabase.from('contenitori').delete().eq('id', id)

  if (error) {
    return { errore: error.message }
  }

  revalidatePath('/', 'layout')
  return { successo: true }
}