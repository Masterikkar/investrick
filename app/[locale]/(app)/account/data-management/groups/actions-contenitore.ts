'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import type { Database } from '@/types/database.types'
import { ricalcolaStoricoCompleto } from '@/lib/ricalcolo-storico'

const TIPI_VALIDI = ['PAC', 'Polizza', 'Personalizzato']

type UpsertContenitore = Database['public']['Tables']['contenitori']['Insert']

// Legge i campi del form gruppo, condiviso da creaContenitore e aggiornaContenitore.
function leggiCampiContenitore(formData: FormData) {
  const nome = (formData.get('nome') as string)?.trim()
  const tipo = formData.get('tipo') as string
  const dataAttivazione = ((formData.get('data_attivazione') as string) || '').trim() || null
  const note = ((formData.get('note') as string) || '').trim() || null
  const targetAttivo = formData.get('target_attivo') === 'on'

  const payload: UpsertContenitore = {
    nome,
    tipo,
    data_attivazione: dataAttivazione,
    note,
    target_attivo: targetAttivo,
  }
  return payload
}

export async function creaContenitore(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const payload = leggiCampiContenitore(formData)

  if (!payload.nome || !TIPI_VALIDI.includes(payload.tipo)) {
    redirect({ href: '/account/data-management/groups?errore_contenitore=1', locale })
  }

  const { error } = await supabase.from('contenitori').insert(payload)

  if (error) {
    redirect({ href: '/account/data-management/groups?errore_contenitore=1', locale })
  }

  revalidatePath('/', 'layout')
  redirect({ href: '/account/data-management/groups?successo_contenitore=1', locale })
}

// Modifica di un gruppo esistente dal modale di Gruppi: stessi campi di
// creaContenitore, ma niente redirect (il client chiude il modale e aggiorna
// la pagina).
export async function aggiornaContenitore(
  id: string,
  formData: FormData
): Promise<{ successo: true } | { errore: 'campi' | 'generico' }> {
  const supabase = await createClient()

  const payload = leggiCampiContenitore(formData)
  if (!payload.nome || !TIPI_VALIDI.includes(payload.tipo)) return { errore: 'campi' }

  const { error } = await supabase.from('contenitori').update(payload).eq('id', id)
  if (error) return { errore: 'generico' }

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

  // Le transazioni del gruppo sono diventate posizioni dirette: si ricalcola
  // tutto, un gruppo alla volta (vedi lib/ricalcolo-storico.ts).
  const esitoStorico = await ricalcolaStoricoCompleto(supabase)

  if (esitoStorico) {
    return { errore: esitoStorico.errore }
  }

  revalidatePath('/', 'layout')
  return { successo: true }
}
