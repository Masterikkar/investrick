'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { revalidatePath } from 'next/cache'

// Che il gruppo sia davvero Personalizzato lo garantisce il database: la
// chiave esterna (contenitore_id, tipo) di gruppi_personalizzati_strumenti
// accetta solo contenitori di quel tipo.

export async function aggiungiMembro(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()
  const contenitoreId = (formData.get('contenitore_id') as string) || ''
  const strumentoId = (formData.get('strumento_id') as string) || ''

  const { error } = await supabase
    .from('gruppi_personalizzati_strumenti')
    .insert({ contenitore_id: contenitoreId, strumento_id: strumentoId })

  // 23505: lo strumento è già nel gruppo (es. doppio clic), niente da fare.
  if (error && error.code !== '23505') {
    redirect({ href: `/custom-groups/${contenitoreId}/members?errore=1`, locale })
  }

  revalidatePath('/', 'layout')
}

export async function rimuoviMembro(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()
  const contenitoreId = (formData.get('contenitore_id') as string) || ''
  const strumentoId = (formData.get('strumento_id') as string) || ''

  const { error } = await supabase
    .from('gruppi_personalizzati_strumenti')
    .delete()
    .eq('contenitore_id', contenitoreId)
    .eq('strumento_id', strumentoId)

  if (error) {
    redirect({ href: `/custom-groups/${contenitoreId}/members?errore=1`, locale })
  }

  revalidatePath('/', 'layout')
}
