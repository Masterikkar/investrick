'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'

export async function aggiornaAliquotaDefaultCategoria(
  categoria: string,
  nuovoDefault: number
): Promise<{ successo: true } | { errore: string }> {
  if (!Number.isFinite(nuovoDefault) || nuovoDefault < 0 || nuovoDefault > 100) {
    return { errore: "L'aliquota deve essere un numero tra 0 e 100." }
  }

  const supabase = await createClient()
  const locale = await getLocale()

  const { error } = await supabase
    .from('impostazioni_aliquote_categoria')
    .update({ aliquota_default: nuovoDefault })
    .eq('categoria', categoria)

  if (error) {
    return { errore: error.message }
  }

  revalidatePath(`/${locale}/account/impostazioni/fiscalita`)
  return { successo: true }
}

export async function reimpostaAliquotaCategoria(
  categoria: string
): Promise<{ successo: true; aggiornati: number } | { errore: string }> {
  const supabase = await createClient()
  const locale = await getLocale()

  const { data: impostazione, error: erroreLettura } = await supabase
    .from('impostazioni_aliquote_categoria')
    .select('aliquota_default')
    .eq('categoria', categoria)
    .maybeSingle()

  if (erroreLettura || !impostazione) {
    return { errore: erroreLettura?.message ?? 'Default di categoria non trovato.' }
  }

  const { data: aggiornati, error } = await supabase
    .from('strumenti')
    .update({ aliquota_tassazione: impostazione.aliquota_default })
    .eq('categoria', categoria)
    .select('id')

  if (error) {
    return { errore: error.message }
  }

  revalidatePath(`/${locale}/account/impostazioni/fiscalita`)
  return { successo: true, aggiornati: aggiornati?.length ?? 0 }
}

export async function aggiornaAliquotaStrumento(
  strumentoId: string,
  nuovaAliquota: number
): Promise<{ successo: true } | { errore: string }> {
  if (!Number.isFinite(nuovaAliquota) || nuovaAliquota < 0 || nuovaAliquota > 100) {
    return { errore: "L'aliquota deve essere un numero tra 0 e 100." }
  }

  const supabase = await createClient()
  const locale = await getLocale()

  const { error } = await supabase
    .from('strumenti')
    .update({ aliquota_tassazione: nuovaAliquota })
    .eq('id', strumentoId)

  if (error) {
    return { errore: error.message }
  }

  revalidatePath(`/${locale}/account/impostazioni/fiscalita`)
  return { successo: true }
}